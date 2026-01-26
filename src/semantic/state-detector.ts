/**
 * Page State Detection
 *
 * Detects authentication state, loading state, and errors on a page.
 * Provides AI agents with actionable state information.
 */

import type { Page } from 'playwright';

export interface AuthState {
  authenticated: boolean | null; // null = can't determine
  confidence: number;
  signals: string[];
  username?: string; // If we can extract it
}

export interface LoadingState {
  loading: boolean;
  type: 'spinner' | 'skeleton' | 'progress' | 'lazy' | 'none';
  elements: number; // Count of loading indicators
}

export interface ErrorState {
  hasErrors: boolean;
  errors: ErrorInfo[];
  severity: 'none' | 'warning' | 'error' | 'critical';
}

export interface ErrorInfo {
  type: 'validation' | 'api' | 'permission' | 'notfound' | 'server' | 'network' | 'unknown';
  message: string;
  element?: string; // Selector hint
}

export interface PageState {
  auth: AuthState;
  loading: LoadingState;
  errors: ErrorState;
  ready: boolean; // True if page is ready for interaction
}

/**
 * Detect authentication state from page signals
 */
export async function detectAuthState(page: Page): Promise<AuthState> {
  const signals: string[] = [];
  let authenticated: boolean | null = null;
  let confidence = 0;
  let username: string | undefined;

  const checks = await page.evaluate(() => {
    const doc = document;
    const text = doc.body?.innerText?.toLowerCase() || '';

    // Authenticated signals
    const logoutButton = doc.querySelector(
      'button:has-text("logout"), button:has-text("sign out"), ' +
      'a:has-text("logout"), a:has-text("sign out"), ' +
      '[class*="logout"], [data-testid*="logout"]'
    );
    const userMenu = doc.querySelector(
      '[class*="user-menu"], [class*="avatar"], [class*="profile-menu"], ' +
      '[class*="account-menu"], [data-testid*="user"]'
    );
    const welcomeText = text.match(/welcome,?\s+(\w+)/i);
    const userNameEl = doc.querySelector(
      '[class*="username"], [class*="user-name"], [class*="display-name"]'
    );

    // Not authenticated signals
    const loginLink = doc.querySelector(
      'a:has-text("login"), a:has-text("sign in"), ' +
      'button:has-text("login"), button:has-text("sign in"), ' +
      '[class*="login-link"], [href*="/login"], [href*="/signin"]'
    );
    const signupLink = doc.querySelector(
      'a:has-text("sign up"), a:has-text("register"), ' +
      '[href*="/signup"], [href*="/register"]'
    );

    // Check for auth-gated content
    const authRequired = doc.querySelector(
      '[class*="auth-required"], [class*="login-required"], ' +
      '[class*="protected"]'
    );

    // Check cookies/localStorage hints (careful - limited access)
    const hasAuthCookie = document.cookie.includes('auth') ||
      document.cookie.includes('session') ||
      document.cookie.includes('token');

    return {
      hasLogoutButton: !!logoutButton,
      hasUserMenu: !!userMenu,
      hasWelcomeText: !!welcomeText,
      welcomeName: welcomeText?.[1],
      hasUserNameElement: !!userNameEl,
      userName: userNameEl?.textContent?.trim(),
      hasLoginLink: !!loginLink,
      hasSignupLink: !!signupLink,
      hasAuthRequired: !!authRequired,
      hasAuthCookie,
    };
  });

  // Score authenticated signals
  if (checks.hasLogoutButton) {
    authenticated = true;
    confidence += 40;
    signals.push('logout button present');
  }
  if (checks.hasUserMenu) {
    authenticated = true;
    confidence += 30;
    signals.push('user menu present');
  }
  if (checks.hasWelcomeText) {
    authenticated = true;
    confidence += 20;
    signals.push('welcome text');
    username = checks.welcomeName;
  }
  if (checks.hasUserNameElement) {
    authenticated = true;
    confidence += 15;
    signals.push('username displayed');
    username = username || checks.userName;
  }
  if (checks.hasAuthCookie) {
    confidence += 10;
    signals.push('auth cookie present');
  }

  // Score not authenticated signals
  if (checks.hasLoginLink && !checks.hasLogoutButton) {
    authenticated = false;
    confidence += 30;
    signals.push('login link visible');
  }
  if (checks.hasSignupLink && !checks.hasUserMenu) {
    authenticated = false;
    confidence += 20;
    signals.push('signup link visible');
  }
  if (checks.hasAuthRequired) {
    authenticated = false;
    confidence += 25;
    signals.push('auth-required message');
  }

  // Normalize confidence
  confidence = Math.min(confidence / 100, 1);

  // If no strong signals, we can't determine
  if (confidence < 0.3) {
    authenticated = null;
  }

  return {
    authenticated,
    confidence,
    signals,
    username,
  };
}

/**
 * Detect loading state from page signals
 */
export async function detectLoadingState(page: Page): Promise<LoadingState> {
  const checks = await page.evaluate(() => {
    const doc = document;

    // Spinner detection
    const spinners = doc.querySelectorAll(
      '[class*="spinner"], [class*="loading"], [class*="loader"], ' +
      '[role="progressbar"][aria-busy="true"], ' +
      '.animate-spin, [class*="spin"]'
    );

    // Skeleton detection
    const skeletons = doc.querySelectorAll(
      '[class*="skeleton"], [class*="shimmer"], [class*="placeholder"], ' +
      '[class*="pulse"], [aria-busy="true"]'
    );

    // Progress bar detection
    const progress = doc.querySelectorAll(
      'progress, [role="progressbar"], [class*="progress-bar"], ' +
      '[class*="loading-bar"]'
    );

    // Lazy loading detection
    const lazyImages = doc.querySelectorAll(
      'img[loading="lazy"]:not([src]), [class*="lazy"]:not([src])'
    );

    // Check if body has loading class
    const bodyLoading = doc.body?.classList.contains('loading') ||
      doc.body?.getAttribute('aria-busy') === 'true';

    return {
      spinnerCount: spinners.length,
      skeletonCount: skeletons.length,
      progressCount: progress.length,
      lazyCount: lazyImages.length,
      bodyLoading,
    };
  });

  // Determine loading type
  let type: LoadingState['type'] = 'none';
  let elements = 0;
  let loading = false;

  if (checks.spinnerCount > 0) {
    type = 'spinner';
    elements = checks.spinnerCount;
    loading = true;
  } else if (checks.skeletonCount > 0) {
    type = 'skeleton';
    elements = checks.skeletonCount;
    loading = true;
  } else if (checks.progressCount > 0) {
    type = 'progress';
    elements = checks.progressCount;
    loading = true;
  } else if (checks.lazyCount > 0) {
    type = 'lazy';
    elements = checks.lazyCount;
    loading = true;
  } else if (checks.bodyLoading) {
    type = 'spinner';
    loading = true;
  }

  return { loading, type, elements };
}

/**
 * Detect error state from page signals
 */
export async function detectErrorState(page: Page): Promise<ErrorState> {
  const errors: ErrorInfo[] = [];

  const checks = await page.evaluate(() => {
    const doc = document;
    const text = doc.body?.innerText || '';

    // Validation errors
    const validationErrors = doc.querySelectorAll(
      '[class*="error"]:not([class*="error-boundary"]), ' +
      '[class*="invalid"], [aria-invalid="true"], ' +
      '.field-error, .form-error, .validation-error'
    );

    // API/Server errors
    const apiErrors = doc.querySelectorAll(
      '[class*="api-error"], [class*="server-error"], ' +
      '[class*="fetch-error"], [class*="network-error"]'
    );

    // Permission errors
    const permissionText = text.match(/access denied|forbidden|unauthorized|not allowed/i);

    // 404 errors
    const notFoundText = text.match(/not found|404|page doesn't exist|no longer available/i);

    // Server errors
    const serverText = text.match(/500|server error|something went wrong|internal error/i);

    // Toast/notification errors
    const toastErrors = doc.querySelectorAll(
      '[class*="toast"][class*="error"], [class*="notification"][class*="error"], ' +
      '[role="alert"][class*="error"], [class*="snackbar"][class*="error"]'
    );

    // Extract error messages
    const extractText = (el: Element) => el.textContent?.trim().slice(0, 200) || '';

    return {
      validationErrors: Array.from(validationErrors).map(extractText).filter(Boolean),
      apiErrors: Array.from(apiErrors).map(extractText).filter(Boolean),
      toastErrors: Array.from(toastErrors).map(extractText).filter(Boolean),
      hasPermissionError: !!permissionText,
      hasNotFoundError: !!notFoundText,
      hasServerError: !!serverText,
    };
  });

  // Build error list
  if (checks.hasPermissionError) {
    errors.push({
      type: 'permission',
      message: 'Access denied or unauthorized',
    });
  }

  if (checks.hasNotFoundError) {
    errors.push({
      type: 'notfound',
      message: 'Page or resource not found',
    });
  }

  if (checks.hasServerError) {
    errors.push({
      type: 'server',
      message: 'Server error occurred',
    });
  }

  for (const msg of checks.validationErrors) {
    errors.push({
      type: 'validation',
      message: msg,
    });
  }

  for (const msg of checks.apiErrors) {
    errors.push({
      type: 'api',
      message: msg,
    });
  }

  for (const msg of checks.toastErrors) {
    errors.push({
      type: 'unknown',
      message: msg,
    });
  }

  // Determine severity
  let severity: ErrorState['severity'] = 'none';
  if (errors.length > 0) {
    const hasCritical = errors.some(e =>
      e.type === 'server' || e.type === 'permission'
    );
    const hasError = errors.some(e =>
      e.type === 'api' || e.type === 'notfound'
    );
    const hasWarning = errors.some(e => e.type === 'validation');

    if (hasCritical) severity = 'critical';
    else if (hasError) severity = 'error';
    else if (hasWarning) severity = 'warning';
  }

  return {
    hasErrors: errors.length > 0,
    errors,
    severity,
  };
}

/**
 * Detect full page state
 */
export async function detectPageState(page: Page): Promise<PageState> {
  const [auth, loading, errors] = await Promise.all([
    detectAuthState(page),
    detectLoadingState(page),
    detectErrorState(page),
  ]);

  // Page is ready if not loading and no critical errors
  const ready = !loading.loading &&
    errors.severity !== 'critical' &&
    errors.severity !== 'error';

  return {
    auth,
    loading,
    errors,
    ready,
  };
}

/**
 * Wait for page to be ready (not loading, no errors)
 */
export async function waitForPageReady(
  page: Page,
  options: { timeout?: number; ignoreErrors?: boolean } = {}
): Promise<PageState> {
  const { timeout = 10000, ignoreErrors = false } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const state = await detectPageState(page);

    if (!state.loading.loading) {
      if (ignoreErrors || !state.errors.hasErrors) {
        return state;
      }
    }

    // Wait a bit before checking again
    await page.waitForTimeout(200);
  }

  // Return final state even if not ready
  return detectPageState(page);
}
