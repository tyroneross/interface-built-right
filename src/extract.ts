import { chromium, type Browser, type Page } from 'playwright';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { Viewport, EnhancedElement, ElementIssue, AuditResult } from './schemas.js';
import { VIEWPORTS } from './schemas.js';

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

// Singleton browser instance
let browser: Browser | null = null;

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
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
  page: Page,
  selector: string
): Promise<ExtractedElement[]> {
  return page.evaluate(
    ({ sel, props }) => {
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
export async function extractInteractiveElements(page: Page): Promise<EnhancedElement[]> {
  return page.evaluate((selectors) => {
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
            },
            a11y: {
              role: htmlEl.getAttribute('role'),
              ariaLabel: htmlEl.getAttribute('aria-label'),
              ariaDescribedBy: htmlEl.getAttribute('aria-describedby'),
              ariaHidden: htmlEl.getAttribute('aria-hidden') === 'true' || undefined,
            },
            sourceHint: {
              dataTestId: htmlEl.getAttribute('data-testid'),
            },
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
    return isButton || isLink || isInput || looksClickable;
  });

  for (const el of interactiveElements) {
    const isButton = el.tagName === 'button' || el.a11y.role === 'button';
    const isLink = el.tagName === 'a';
    const hasHandler = el.interactive.hasOnClick || el.interactive.hasHref;

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
    const minSize = isMobile ? 44 : 24;
    if (el.bounds.width < minSize || el.bounds.height < minSize) {
      issues.push({
        type: 'TOUCH_TARGET_SMALL',
        severity: isMobile ? 'error' : 'warning',
        message: `"${el.text || el.selector}" touch target is ${el.bounds.width}x${el.bounds.height}px (min: ${minSize}px)`,
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
async function extractCSSVariables(page: Page): Promise<CSSVariables> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const computed = window.getComputedStyle(root);
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

  const browserInstance = await getBrowser();
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    // Set up hard timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${timeout}ms`));
      }, timeout);
    });

    const extractionPromise = async () => {
      const context = await browserInstance.newContext({
        viewport: {
          width: viewport.width,
          height: viewport.height,
        },
        reducedMotion: 'reduce',
      });

      const page = await context.newPage();

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
        await context.close();
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
