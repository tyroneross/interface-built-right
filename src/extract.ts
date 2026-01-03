import { chromium, type Browser, type Page } from 'playwright';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { Viewport } from './schemas.js';
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
