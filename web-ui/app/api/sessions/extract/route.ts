import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { chromium, type Browser, type Page } from 'playwright';

const IBR_DIR = process.env.IBR_DIR || './.ibr';
const LOCK_FILE = '.extracting';
const LOCK_TIMEOUT_MS = 180000; // 3 minutes (longer than extraction to prevent stale locks)
const EXTRACTION_TIMEOUT_MS = 120000; // 2 minutes - allows complex pages to load

// Singleton browser
let browser: Browser | null = null;

interface ExtractedElement {
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

interface ReferenceMetadata {
  framework?: string;
  componentLibrary?: string;
  targetPath?: string;
  notes?: string;
  originalUrl: string;
  extractedAt: string;
  dimensions: {
    width: number;
    height: number;
  };
}

interface ReferenceSession {
  id: string;
  name: string;
  url: string;
  type: 'reference';
  viewport: {
    name: string;
    width: number;
    height: number;
  };
  status: 'baseline';
  createdAt: string;
  updatedAt: string;
  referenceMetadata: ReferenceMetadata;
}

// Default semantic selectors to extract
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

// Key CSS properties to extract
const CSS_PROPERTIES = [
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
];

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

async function checkLock(outputDir: string): Promise<boolean> {
  const lockPath = join(outputDir, LOCK_FILE);
  if (!existsSync(lockPath)) {
    return false;
  }

  try {
    const content = await readFile(lockPath, 'utf-8');
    const timestamp = parseInt(content, 10);
    const age = Date.now() - timestamp;

    if (age > LOCK_TIMEOUT_MS) {
      await unlink(lockPath);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function createLock(outputDir: string): Promise<void> {
  const lockPath = join(outputDir, LOCK_FILE);
  await mkdir(outputDir, { recursive: true });
  await writeFile(lockPath, Date.now().toString());
}

async function releaseLock(outputDir: string): Promise<void> {
  const lockPath = join(outputDir, LOCK_FILE);
  try {
    await unlink(lockPath);
  } catch {
    // Ignore
  }
}

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
        props.forEach((prop: string) => {
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
    { sel: selector, props: CSS_PROPERTIES }
  );
}

async function extractCSSVariables(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const variables: Record<string, string> = {};

    // Get CSS rules from stylesheets
    const sheets = Array.from(document.styleSheets);
    sheets.forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach((rule) => {
          if (
            rule instanceof CSSStyleRule &&
            rule.selectorText === ':root'
          ) {
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

    return variables;
  });
}

export async function POST(request: NextRequest) {
  const ibrDir = join(process.cwd(), IBR_DIR);

  // Check for concurrent extraction
  if (await checkLock(ibrDir)) {
    return NextResponse.json(
      { error: 'Another extraction is in progress. Please wait.' },
      { status: 429 }
    );
  }

  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    const body = await request.json();
    const { url, metadata } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const name = metadata?.name || new URL(url).hostname;

    // Create lock
    await createLock(ibrDir);

    // Generate session ID and create directory
    const sessionId = `sess_${nanoid(10)}`;
    const sessionDir = join(ibrDir, 'sessions', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const browserInstance = await getBrowser();

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${EXTRACTION_TIMEOUT_MS}ms`));
      }, EXTRACTION_TIMEOUT_MS);
    });

    const extractionPromise = async () => {
      const context = await browserInstance.newContext({
        viewport: { width: 1920, height: 1080 },
        reducedMotion: 'reduce',
      });

      const page = await context.newPage();

      try {
        // Navigate
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: EXTRACTION_TIMEOUT_MS,
        });

        // Wait for animations
        await page.waitForTimeout(500);

        // Disable animations
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              transition-duration: 0s !important;
            }
          `,
        });

        // Extract HTML
        const html = await page.content();

        // Extract elements
        const elements: ExtractedElement[] = [];
        for (const selector of DEFAULT_SELECTORS) {
          try {
            const extracted = await extractElementStyles(page, selector);
            elements.push(...extracted);
          } catch {
            // Some selectors might not exist
          }
        }

        // Extract CSS variables
        const cssVariables = await extractCSSVariables(page);

        // Get viewport dimensions
        const viewportSize = page.viewportSize() || { width: 1920, height: 1080 };

        // Take screenshot
        const screenshotPath = join(sessionDir, 'reference.png');
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: 'png',
        });

        // Save extraction data
        const extractionData = {
          url,
          timestamp: new Date().toISOString(),
          viewport: viewportSize,
          elements,
          cssVariables,
        };

        await writeFile(
          join(sessionDir, 'reference.json'),
          JSON.stringify(extractionData, null, 2)
        );

        // Save HTML
        await writeFile(join(sessionDir, 'reference.html'), html);

        // Create session
        const now = new Date().toISOString();
        const session: ReferenceSession = {
          id: sessionId,
          name: name.trim(),
          url,
          type: 'reference',
          viewport: {
            name: 'desktop',
            width: viewportSize.width,
            height: viewportSize.height,
          },
          status: 'baseline',
          createdAt: now,
          updatedAt: now,
          referenceMetadata: {
            framework: metadata?.framework || undefined,
            componentLibrary: metadata?.componentLibrary || undefined,
            targetPath: metadata?.targetPath || undefined,
            notes: metadata?.notes || undefined,
            originalUrl: url,
            extractedAt: now,
            dimensions: viewportSize,
          },
        };

        await writeFile(
          join(sessionDir, 'session.json'),
          JSON.stringify(session, null, 2)
        );

        return { session, sessionId, extractionData };
      } finally {
        await context.close();
      }
    };

    // Race extraction vs timeout
    const result = await Promise.race([extractionPromise(), timeoutPromise]);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to extract from URL',
      },
      { status: 500 }
    );
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    await releaseLock(ibrDir);
  }
}
