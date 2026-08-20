import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import type { PageLike } from './engine/page-like.js';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Viewport, EnhancedElement, ElementIssue, AuditResult } from './schemas.js';
import { VIEWPORTS } from './schemas.js';
import { viewportToConfig } from './devices.js';
import { evaluateTargetSize } from './rules/target-sizing.js';

/**
 * Lock file to prevent concurrent extractions
 */
const LOCK_FILE = '.extracting';
const LOCK_TIMEOUT_MS = 180000; // 3 minutes (longer than extraction to prevent stale locks)
const EXTRACTION_TIMEOUT_MS = 120000; // 2 minutes - allows complex pages to load

/**
 * Extracted element information
 */
export interface ExtractedElement {
  selector: string;
  tagName: string;
  id?: string;
  className?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles: Record<string, string>;
}

/**
 * CSS custom properties (variables)
 */
export interface CSSVariables {
  [key: string]: string;
}

/**
 * Full extraction result
 */
export interface ExtractionResult {
  url: string;
  timestamp: string;
  viewport: Viewport;
  html: string;
  elements: ExtractedElement[];
  cssVariables: CSSVariables;
  screenshotPath: string;
}

/**
 * Options for HTML extraction
 */
export interface ExtractOptions {
  url: string;
  outputDir: string;
  sessionId: string;
  viewport?: Viewport;
  timeout?: number;
  /** CSS selectors to extract (defaults to semantic elements) */
  selectors?: string[];
}

/**
 * Default semantic selectors to extract
 */
const DEFAULT_SELECTORS = [
  'header',
  'nav',
  'main',
  'section',
  'article',
  'aside',
  'footer',
  'h1',
  'h2',
  'h3',
  'button',
  'a[href]',
  'form',
  'input',
  'img',
];

/**
 * Key CSS properties to extract
 */
const CSS_PROPERTIES_TO_EXTRACT = [
  'display',
  'position',
  'width',
  'height',
  'padding',
  'margin',
  'backgroundColor',
  'color',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'lineHeight',
  'textAlign',
  'borderRadius',
  'border',
  'boxShadow',
  'gap',
  'flexDirection',
  'alignItems',
  'justifyContent',
  'gridTemplateColumns',
  'gridTemplateRows',
];

// Singleton driver instance
let driver: EngineDriver | null = null;

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Check if extraction is already in progress
 */
async function checkLock(outputDir: string): Promise<boolean> {
  const lockPath = join(outputDir, LOCK_FILE);
  if (!existsSync(lockPath)) {
    return false;
  }

  try {
    const content = await readFile(lockPath, 'utf-8');
    const timestamp = parseInt(content, 10);
    const age = Date.now() - timestamp;

    // Lock is stale if older than timeout
    if (age > LOCK_TIMEOUT_MS) {
      await unlink(lockPath);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create extraction lock
 */
async function createLock(outputDir: string): Promise<void> {
  const lockPath = join(outputDir, LOCK_FILE);
  await writeFile(lockPath, Date.now().toString());
}

/**
 * Release extraction lock
 */
async function releaseLock(outputDir: string): Promise<void> {
  const lockPath = join(outputDir, LOCK_FILE);
  try {
    await unlink(lockPath);
  } catch {
    // Ignore errors
  }
}

/**
 * Extract computed styles for an element
 */
async function extractElementStyles(
  page: PageLike,
  selector: string
): Promise<ExtractedElement[]> {
  return page.evaluate(
    ({ sel, props }: { sel: string; props: string[] }) => {
      const elements = document.querySelectorAll(sel);
      const results: ExtractedElement[] = [];

      elements.forEach((el, index) => {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        const computed = window.getComputedStyle(htmlEl);

        const styles: Record<string, string> = {};
        props.forEach((prop) => {
          const value = computed.getPropertyValue(
            prop.replace(/([A-Z])/g, '-$1').toLowerCase()
          );
          if (value && value !== 'none' && value !== 'normal' && value !== '0px') {
            styles[prop] = value;
          }
        });

        results.push({
          selector: `${sel}:nth-of-type(${index + 1})`,
          tagName: htmlEl.tagName.toLowerCase(),
          id: htmlEl.id || undefined,
          className: htmlEl.className || undefined,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          computedStyles: styles,
        });
      });

      return results;
    },
    { sel: selector, props: CSS_PROPERTIES_TO_EXTRACT }
  );
}

/**
 * Interactive element selectors for audit
 */
const INTERACTIVE_SELECTORS = [
  'button',
  'a[href]',
  'a:not([href])',  // Links without href (potential issues)
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="text"]',
  'input[type="email"]',
  'input[type="password"]',
  // Same class of native form control as text/email/password above — these
  // were silently invisible to scan/audit even though observe/session_action
  // (the CDP AX-tree path in engine/cdp/accessibility.ts) already see them.
  'input[type="radio"]',
  'input[type="checkbox"]',
  'input[type="search"]',
  'input[type="tel"]',
  'input[type="url"]',
  'input[type="number"]',
  'input[type="date"]',
  'input[type="file"]',
  'input[type="range"]',
  'input[type="color"]',
  // <summary> genuinely toggles <details> open/closed; a bare
  // contenteditable region genuinely accepts typing. Neither needs a JS
  // handler to be interactive — see isContentEditable capture below and
  // summarize.ts's isLooksInteractive/buildInteractionMap for how the
  // audit avoids flagging them as "looks interactive, no handler".
  'details',
  'summary',
  // Exclude contenteditable="false", which explicitly opts OUT of editing.
  '[contenteditable]:not([contenteditable="false"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
];

/**
 * Extract enhanced interactive elements with handler detection
 */
export async function extractInteractiveElements(page: PageLike): Promise<EnhancedElement[]> {
  return page.evaluate((selectors: string[]) => {
    const seen = new Set<Element>();
    const elements: EnhancedElement[] = [];

    // Helper: Generate unique selector (arrow function to avoid __name bundling issue)
    const generateSelector = (el: HTMLElement): string => {
      if (el.id) return `#${el.id}`;

      const path: string[] = [];
      let current: HTMLElement | null = el;

      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = `#${current.id}`;
          path.unshift(selector);
          break;
        } else if (current.className && typeof current.className === 'string') {
          const classes = current.className.split(' ').filter(c => c.trim() && !c.includes(':'));
          if (classes.length > 0) {
            selector += `.${classes[0]}`;
          }
        }

        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            c => c.tagName === current!.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }

        path.unshift(selector);
        current = current.parentElement;
      }

      return path.join(' > ').slice(0, 200);
    };

    // Helper: Detect click handlers (arrow function to avoid __name bundling issue)
    const detectHandlers = (el: HTMLElement) => {
      const keys = Object.keys(el);

      // React 17+ uses __reactProps$
      const reactPropsKey = keys.find(k => k.startsWith('__reactProps$'));
      let hasReactHandler = false;
      if (reactPropsKey) {
        const props = (el as any)[reactPropsKey];
        hasReactHandler = !!(props?.onClick || props?.onSubmit || props?.onMouseDown);
      }

      // Also check React fiber
      const fiberKey = keys.find(k => k.startsWith('__reactFiber$'));
      if (!hasReactHandler && fiberKey) {
        const fiber = (el as any)[fiberKey];
        hasReactHandler = !!(fiber?.pendingProps?.onClick || fiber?.memoizedProps?.onClick);
      }

      // Vue uses __vue__ or __vnode
      const hasVueHandler = !!(
        (el as any).__vue__?.$listeners?.click ||
        (el as any).__vnode?.props?.onClick
      );

      // Angular uses __ngContext__
      const hasAngularHandler = !!(el as any).__ngContext__ || el.hasAttribute('ng-click');

      // Vanilla DOM
      const hasVanillaHandler = typeof (el as any).onclick === 'function' ||
                                 el.hasAttribute('onclick');

      return {
        hasReactHandler,
        hasVueHandler,
        hasAngularHandler,
        hasVanillaHandler,
        hasAnyHandler: hasReactHandler || hasVueHandler || hasAngularHandler || hasVanillaHandler,
      };
    };

    // Helper: bounds of the largest VISIBLE <label> that activates this
    // control. Clicking an associated label activates its control, so for a
    // visually-hidden input (`sr-only`, `clip-path: inset(50%)`, `opacity:0`)
    // the label is the thing a finger actually lands on — the input's own
    // 1x1 box never was the target. Read by src/rules/target-sizing.ts.
    const measureLabelTarget = (el: HTMLElement): {
      bounds?: { x: number; y: number; width: number; height: number };
      count: number;
    } => {
      const labelled = el as HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null };
      let labels: HTMLElement[] = labelled.labels ? Array.from(labelled.labels) : [];
      if (labels.length === 0) {
        // Non-labelable elements (e.g. a [role="checkbox"] div) can still sit
        // inside a <label> that forwards the click.
        const ancestor = el.closest?.('label');
        if (ancestor) labels = [ancestor as HTMLElement];
      }

      let best: { x: number; y: number; width: number; height: number } | undefined;
      let bestArea = 0;
      for (const label of labels) {
        const style = window.getComputedStyle(label);
        // A label that is itself hidden or click-through supplies no hit area.
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (style.opacity === '0' || style.pointerEvents === 'none') continue;
        const r = label.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const labelArea = r.width * r.height;
        if (labelArea <= bestArea) continue;
        bestArea = labelArea;
        best = {
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      }
      // `count` is reported even when no label is VISIBLE: a control whose
      // only label is hidden at this viewport (a `sm:hidden` nav toggle above
      // the breakpoint) has no pointer target to grade at all.
      return { bounds: best, count: labels.length };
    };

    // Helper: how much NON-target text sits in this element's nearest
    // block-level ancestor. Feeds the WCAG 2.5.8 "Inline" exception — a link
    // in a sentence is surrounded by hundreds of characters of prose, while a
    // link in a `|`-separated inline nav is surrounded by one or two. The
    // threshold itself lives in src/rules/target-sizing.ts so it is tunable
    // and unit-testable without a browser.
    const TARGET_SELECTOR = 'a,button,input,select,textarea,[role="button"],[role="link"],[onclick]';
    const measureSurroundingText = (el: HTMLElement): number => {
      // Walk out of inline wrappers (<strong>, <em>, <span>) to the block
      // that establishes the line box — that is the "sentence" WCAG means.
      let block: HTMLElement | null = el.parentElement;
      while (block && window.getComputedStyle(block).display.startsWith('inline')) {
        block = block.parentElement;
      }
      if (!block) return 0;

      const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
      const blockText = collapse(block.textContent || '');
      if (!blockText) return 0;

      let targetChars = 0;
      block.querySelectorAll(TARGET_SELECTOR).forEach((t) => {
        targetChars += collapse(t.textContent || '').length;
      });

      // Nested targets are counted twice and can drive this negative; clamp
      // to 0 so ambiguity errs toward grading the target, never toward
      // exempting it.
      return Math.max(0, blockText.length - targetChars);
    };

    // Process each selector
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);

          const htmlEl = el as HTMLElement;
          const rect = htmlEl.getBoundingClientRect();
          const computed = window.getComputedStyle(htmlEl);
          const handlers = detectHandlers(htmlEl);

          // Check href for links
          const href = htmlEl.getAttribute('href');
          const hasValidHref = href !== null && href !== '#' && href !== '' &&
                               !href.startsWith('javascript:');

          elements.push({
            selector: generateSelector(htmlEl),
            tagName: htmlEl.tagName.toLowerCase(),
            id: htmlEl.id || undefined,
            className: typeof htmlEl.className === 'string' ? htmlEl.className : undefined,
            text: (htmlEl.textContent || '').trim().slice(0, 100) || undefined,
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            computedStyles: {
              cursor: computed.cursor,
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              // display/visibility/opacity: the touch-targets rule's
              // isNonVisibleOrZeroArea guard (src/rules/touch-targets.ts)
              // reads these three fields to exclude non-visible elements.
              // Before this, they were never populated here — the guard's
              // display/visibility/opacity branches were unreachable in
              // production (only its bounds<=0 branch ever fired, which
              // happens to zero out for display:none via
              // getBoundingClientRect, but does NOT zero out for
              // visibility:hidden or opacity:0 — those retain full layout
              // bounds and were silently graded for touch-target size).
              display: computed.display,
              visibility: computed.visibility,
              opacity: computed.opacity,
            },
            interactive: {
              hasOnClick: handlers.hasAnyHandler,
              hasHref: hasValidHref,
              isDisabled: htmlEl.hasAttribute('disabled') ||
                          htmlEl.getAttribute('aria-disabled') === 'true' ||
                          computed.pointerEvents === 'none',
              tabIndex: parseInt(htmlEl.getAttribute('tabindex') || '0', 10),
              cursor: computed.cursor,
              hasReactHandler: handlers.hasReactHandler || undefined,
              hasVueHandler: handlers.hasVueHandler || undefined,
              hasAngularHandler: handlers.hasAngularHandler || undefined,
              // .isContentEditable resolves inherited contenteditable
              // correctly, unlike a raw getAttribute('contenteditable') check.
              isContentEditable: htmlEl.isContentEditable || undefined,
            },
            a11y: {
              role: htmlEl.getAttribute('role'),
              ariaLabel: htmlEl.getAttribute('aria-label'),
              ariaDescribedBy: htmlEl.getAttribute('aria-describedby'),
              // Own attribute OR any ancestor's — an element nested inside
              // an `aria-hidden="true"` container is just as unreachable to
              // assistive tech as one hidden directly, so rules that key off
              // this field (touch-targets, static/scan's aria-hidden check)
              // should treat both the same way. Mirrors the `inForm` closest()
              // pattern below.
              ariaHidden: !!htmlEl.closest?.('[aria-hidden="true"]') || undefined,
              ariaHaspopup: htmlEl.getAttribute('aria-haspopup'),
            },
            // What the touch/pointer-target rules must measure instead of
            // this element's own layout box — see TargetContextSchema and
            // src/rules/target-sizing.ts.
            targetContext: (() => {
              const label = measureLabelTarget(htmlEl);
              return {
                surroundingTextChars: measureSurroundingText(htmlEl),
                labelTargetBounds: label.bounds,
                associatedLabels: label.count,
              };
            })(),
            sourceHint: {
              dataTestId: htmlEl.getAttribute('data-testid'),
            },
            inForm: htmlEl instanceof HTMLButtonElement
              ? htmlEl.form !== null
              : !!htmlEl.closest?.('form'),
            buttonType: htmlEl instanceof HTMLButtonElement
              ? (htmlEl.getAttribute('type') ?? 'submit')
              : null,
          });
        });
      } catch {
        // Skip invalid selectors
      }
    }

    return elements;
  }, INTERACTIVE_SELECTORS);
}

/**
 * Analyze elements and detect issues
 */
export function analyzeElements(elements: EnhancedElement[], isMobile = false): AuditResult {
  const issues: ElementIssue[] = [];
  let withHandlers = 0;
  let withoutHandlers = 0;

  const interactiveElements = elements.filter(el => {
    const isButton = el.tagName === 'button' || el.a11y.role === 'button';
    const isLink = el.tagName === 'a';
    const isInput = ['input', 'select', 'textarea'].includes(el.tagName);
    const looksClickable = el.interactive.cursor === 'pointer';
    // <summary> and contenteditable regions are natively interactive
    // (expand/collapse, accept typing) without a JS handler or role.
    const isNativelyEditableOrToggleable = el.tagName === 'summary' || !!el.interactive.isContentEditable;
    return isButton || isLink || isInput || looksClickable || isNativelyEditableOrToggleable;
  });

  for (const el of interactiveElements) {
    const isButton = el.tagName === 'button' || el.a11y.role === 'button';
    const isLink = el.tagName === 'a';
    // Native interactivity (contenteditable / <summary>) needs no JS handler
    // to be legitimately wired — count it as handled rather than flagging
    // withoutHandlers for controls the browser drives natively.
    const hasHandler = el.interactive.hasOnClick || el.interactive.hasHref ||
      !!el.interactive.isContentEditable || el.tagName === 'summary';

    if (hasHandler) {
      withHandlers++;
    } else {
      withoutHandlers++;
    }

    // Check: Button without handler
    if (isButton && !el.interactive.hasOnClick && !el.interactive.isDisabled) {
      issues.push({
        type: 'NO_HANDLER',
        severity: 'error',
        message: `Button "${el.text || el.selector}" has no click handler`,
      });
    }

    // Check: Link with placeholder href
    if (isLink && !el.interactive.hasHref && !el.interactive.hasOnClick) {
      issues.push({
        type: 'PLACEHOLDER_LINK',
        severity: 'error',
        message: `Link "${el.text || el.selector}" has placeholder href and no handler`,
      });
    }

    // Check: Touch target too small (mobile)
    // Grades the real activation rect (an associated <label> when one
    // supplies the hit area) and skips targets WCAG 2.5.8 exempts as inline
    // text in a sentence — see src/rules/target-sizing.ts.
    const minSize = isMobile ? 44 : 24;
    const targetSize = evaluateTargetSize(el, minSize);
    if (targetSize.violates) {
      issues.push({
        type: 'TOUCH_TARGET_SMALL',
        severity: isMobile ? 'error' : 'warning',
        message: `"${el.text || el.selector}" touch target is ${targetSize.bounds.width}x${targetSize.bounds.height}px (min: ${minSize}px)`,
      });
    }

    // Check: Missing aria-label on interactive element without text
    if (hasHandler && !el.text && !el.a11y.ariaLabel) {
      issues.push({
        type: 'MISSING_ARIA_LABEL',
        severity: 'warning',
        message: `"${el.selector}" is interactive but has no text or aria-label`,
      });
    }
  }

  return {
    totalElements: elements.length,
    interactiveCount: interactiveElements.length,
    withHandlers,
    withoutHandlers,
    issues,
  };
}

/**
 * Extract CSS custom properties (variables)
 */
async function extractCSSVariables(page: PageLike): Promise<CSSVariables> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const variables: CSSVariables = {};

    // Get all CSS rules from stylesheets
    const sheets = Array.from(document.styleSheets);
    sheets.forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach((rule) => {
          if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith('--')) {
                variables[prop] = style.getPropertyValue(prop).trim();
              }
            }
          }
        });
      } catch {
        // Cross-origin stylesheets will throw
      }
    });

    // Also get computed custom properties from :root
    const rootStyles = getComputedStyle(root);
    // Check common variable prefixes
    ['--primary', '--secondary', '--accent', '--background', '--foreground', '--border', '--radius', '--spacing']
      .forEach(prefix => {
        for (let i = 0; i < 20; i++) {
          const variations = [
            prefix,
            `${prefix}-${i}`,
            `${prefix}-color`,
            `${prefix}-bg`,
          ];
          variations.forEach(varName => {
            const value = rootStyles.getPropertyValue(varName).trim();
            if (value && !variables[varName]) {
              variables[varName] = value;
            }
          });
        }
      });

    return variables;
  });
}

/**
 * Extract HTML, CSS, and screenshot from a live URL
 */
export async function extractFromURL(
  options: ExtractOptions
): Promise<ExtractionResult> {
  const {
    url,
    outputDir,
    sessionId,
    viewport = VIEWPORTS.desktop,
    timeout = EXTRACTION_TIMEOUT_MS,
    selectors = DEFAULT_SELECTORS,
  } = options;

  // Check for concurrent extraction
  if (await checkLock(outputDir)) {
    throw new Error('Another extraction is in progress. Please wait.');
  }

  // Create session directory
  const sessionDir = join(outputDir, 'sessions', sessionId);
  await mkdir(sessionDir, { recursive: true });

  // Create lock
  await createLock(outputDir);

  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    // Set up hard timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${timeout}ms`));
      }, timeout);
    });

    const extractionPromise = async () => {
      const driverInstance = new EngineDriver();
      await driverInstance.launch({
        headless: true,
        viewport: viewportToConfig(viewport),
      });
      const page = new CompatPage(driverInstance);

      try {
        // Navigate to URL
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: timeout,
        });

        // Wait for animations to settle
        await page.waitForTimeout(500);

        // Disable animations for screenshot
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `,
        });

        // Extract HTML
        const html = await page.content();

        // Extract elements
        const elements: ExtractedElement[] = [];
        for (const selector of selectors) {
          const extracted = await extractElementStyles(page, selector);
          elements.push(...extracted);
        }

        // Extract CSS variables
        const cssVariables = await extractCSSVariables(page);

        // Take screenshot
        const screenshotPath = join(sessionDir, 'reference.png');
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: 'png',
        });

        const result: ExtractionResult = {
          url,
          timestamp: new Date().toISOString(),
          viewport,
          html,
          elements,
          cssVariables,
          screenshotPath,
        };

        // Save extraction data
        await writeFile(
          join(sessionDir, 'reference.json'),
          JSON.stringify(result, null, 2)
        );

        // Save HTML separately for easier access
        await writeFile(join(sessionDir, 'reference.html'), html);

        return result;
      } finally {
        await driverInstance.close();
      }
    };

    // Race between extraction and timeout
    const result = await Promise.race([extractionPromise(), timeoutPromise]);
    return result;
  } finally {
    // Clear timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    // Release lock
    await releaseLock(outputDir);
  }
}

/**
 * Get paths for a reference session
 */
export function getReferenceSessionPaths(outputDir: string, sessionId: string) {
  const root = join(outputDir, 'sessions', sessionId);
  return {
    root,
    sessionJson: join(root, 'session.json'),
    reference: join(root, 'reference.png'),
    referenceHtml: join(root, 'reference.html'),
    referenceData: join(root, 'reference.json'),
    current: join(root, 'current.png'),
    diff: join(root, 'diff.png'),
  };
}
