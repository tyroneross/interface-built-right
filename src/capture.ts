import { chromium, type Browser } from 'playwright';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { VIEWPORTS, type Viewport } from './schemas.js';
import type { CaptureOptions } from './types.js';
import { loadAuthState, isDeployedEnvironment } from './auth.js';

// Playwright's storage state type
type StorageState = {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

let browser: Browser | null = null;

/**
 * Get or create a browser instance
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
 * Capture a screenshot of a URL
 */
export async function captureScreenshot(
  options: CaptureOptions & { outputDir?: string }
): Promise<string> {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 30000,
    outputDir,
  } = options;

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  // Load auth state if available (handles validation, expiration, user isolation)
  let storageState: StorageState | undefined;
  if (outputDir && !isDeployedEnvironment()) {
    const authState = await loadAuthState(outputDir);
    if (authState) {
      storageState = authState as StorageState;
      console.log('🔐 Using saved authentication state');
    }
  }

  const browserInstance = await getBrowser();
  const context = await browserInstance.newContext({
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
    // Disable animations for consistent screenshots
    reducedMotion: 'reduce',
    // Load auth state if available (Playwright accepts object or file path)
    ...(storageState ? { storageState } : {}),
  });

  const page = await context.newPage();

  try {
    // Navigate to URL
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? 'networkidle' : 'load',
      timeout,
    });

    // Wait for any remaining animations to settle
    await page.waitForTimeout(500);

    // Disable CSS animations and transitions
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

    // Take screenshot
    await page.screenshot({
      path: outputPath,
      fullPage,
      type: 'png',
    });

    return outputPath;
  } finally {
    await context.close();
  }
}

/**
 * Get viewport dimensions by name
 */
export function getViewport(name: 'desktop' | 'mobile' | 'tablet'): Viewport {
  return VIEWPORTS[name];
}

/**
 * Capture multiple viewports
 */
export async function captureMultipleViewports(
  url: string,
  outputDir: string,
  viewports: Array<'desktop' | 'mobile' | 'tablet'> = ['desktop'],
  options: Omit<CaptureOptions, 'url' | 'outputPath' | 'viewport'> = {}
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  for (const viewportName of viewports) {
    const viewport = getViewport(viewportName);
    const outputPath = `${outputDir}/${viewportName}.png`;

    await captureScreenshot({
      url,
      outputPath,
      viewport,
      ...options,
    });

    results[viewportName] = outputPath;
  }

  return results;
}
