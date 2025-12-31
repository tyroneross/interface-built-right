import { chromium, type Browser } from 'playwright';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { VIEWPORTS, type Viewport } from './schemas.js';
import type { CaptureOptions } from './types.js';
import { loadAuthState, isDeployedEnvironment } from './auth.js';

/**
 * Capture result with timing and diagnostic info
 */
export interface CaptureResult {
  success: boolean;
  outputPath?: string;
  timing: {
    navigationMs: number;
    renderMs: number;
    totalMs: number;
  };
  diagnostics: {
    httpStatus?: number;
    consoleErrors: string[];
    networkErrors: string[];
    suggestions: string[];
  };
  error?: {
    type: 'timeout' | 'navigation' | 'screenshot' | 'unknown';
    message: string;
    suggestion: string;
  };
}

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
    selector,
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

    // Take screenshot - element or full page
    if (selector) {
      // Wait for element and capture just that element
      const element = await page.waitForSelector(selector, { timeout: 5000 });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot({
        path: outputPath,
        type: 'png',
      });
    } else {
      await page.screenshot({
        path: outputPath,
        fullPage,
        type: 'png',
      });
    }

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

/**
 * Enhanced capture with detailed timing and diagnostics
 * Returns actionable info for debugging slow loads or errors
 */
export async function captureWithDiagnostics(
  options: CaptureOptions & { outputDir?: string }
): Promise<CaptureResult> {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 30000,
    outputDir,
    selector,
  } = options;

  const startTime = Date.now();
  let navigationTime = 0;
  let renderTime = 0;

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const suggestions: string[] = [];
  let httpStatus: number | undefined;

  try {
    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    // Load auth state if available
    let storageState: StorageState | undefined;
    if (outputDir && !isDeployedEnvironment()) {
      const authState = await loadAuthState(outputDir);
      if (authState) {
        storageState = authState as StorageState;
      }
    }

    const browserInstance = await getBrowser();
    const context = await browserInstance.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      reducedMotion: 'reduce',
      ...(storageState ? { storageState } : {}),
    });

    const page = await context.newPage();

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect network errors
    page.on('requestfailed', request => {
      const failure = request.failure();
      networkErrors.push(`${request.url()}: ${failure?.errorText || 'failed'}`);
    });

    // Track HTTP status
    page.on('response', response => {
      if (response.url() === url || response.url() === url + '/') {
        httpStatus = response.status();
      }
    });

    try {
      const navStart = Date.now();
      await page.goto(url, {
        waitUntil: waitForNetworkIdle ? 'networkidle' : 'load',
        timeout,
      });
      navigationTime = Date.now() - navStart;
    } catch (navError) {
      await context.close();

      const errorMsg = navError instanceof Error ? navError.message : String(navError);
      const isTimeout = errorMsg.includes('Timeout');

      // Generate helpful suggestions
      if (isTimeout) {
        suggestions.push(`Page took longer than ${timeout}ms to load`);
        suggestions.push('Try increasing timeout: --timeout 60000');
        if (waitForNetworkIdle) {
          suggestions.push('Try disabling network idle wait: use "load" instead of "networkidle"');
        }
      }
      if (networkErrors.length > 0) {
        suggestions.push(`${networkErrors.length} network request(s) failed`);
      }
      if (httpStatus && httpStatus >= 400) {
        suggestions.push(`Server returned HTTP ${httpStatus}`);
      }

      return {
        success: false,
        timing: {
          navigationMs: Date.now() - startTime,
          renderMs: 0,
          totalMs: Date.now() - startTime,
        },
        diagnostics: {
          httpStatus,
          consoleErrors,
          networkErrors,
          suggestions,
        },
        error: {
          type: isTimeout ? 'timeout' : 'navigation',
          message: errorMsg,
          suggestion: isTimeout
            ? `Increase timeout or check if ${url} is responding`
            : `Check if the server is running at ${url}`,
        },
      };
    }

    // Wait for animations to settle
    await page.waitForTimeout(500);

    // Disable CSS animations
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

    // Take screenshot - element or full page
    const renderStart = Date.now();
    if (selector) {
      const element = await page.waitForSelector(selector, { timeout: 5000 });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot({
        path: outputPath,
        type: 'png',
      });
    } else {
      await page.screenshot({
        path: outputPath,
        fullPage,
        type: 'png',
      });
    }
    renderTime = Date.now() - renderStart;

    await context.close();

    // Generate performance suggestions
    if (navigationTime > 5000) {
      suggestions.push(`Slow page load: ${(navigationTime / 1000).toFixed(1)}s`);
    }
    if (consoleErrors.length > 0) {
      suggestions.push(`${consoleErrors.length} JavaScript error(s) detected`);
    }

    return {
      success: true,
      outputPath,
      timing: {
        navigationMs: navigationTime,
        renderMs: renderTime,
        totalMs: Date.now() - startTime,
      },
      diagnostics: {
        httpStatus,
        consoleErrors,
        networkErrors,
        suggestions,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      timing: {
        navigationMs: navigationTime,
        renderMs: renderTime,
        totalMs: Date.now() - startTime,
      },
      diagnostics: {
        httpStatus,
        consoleErrors,
        networkErrors,
        suggestions,
      },
      error: {
        type: 'unknown',
        message: errorMsg,
        suggestion: 'Check browser installation: npx playwright install chromium',
      },
    };
  }
}
