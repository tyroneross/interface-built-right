import type { EnhancedElement } from '../schemas.js';
import type { MacOSWindowInfo } from './types.js';
import type { SemanticResult, SemanticVerdict, SemanticIssue } from '../semantic/output.js';
import type { PageIntentResult } from '../semantic/page-intent.js';

/**
 * Build a minimal SemanticResult from native app element composition
 *
 * Since we can't run Playwright page.evaluate(), we derive semantic
 * understanding from the extracted elements and window metadata.
 */
export function buildNativeSemantic(
  elements: EnhancedElement[],
  window: MacOSWindowInfo
): SemanticResult {
  const intent = classifyNativeIntent(elements, window.title);
  const issues: SemanticIssue[] = [];

  // Detect auth state from element composition
  const hasPasswordField = elements.some(e =>
    e.a11y.role === 'textbox' && (
      e.text?.toLowerCase().includes('password') ||
      e.a11y.ariaLabel?.toLowerCase().includes('password') ||
      e.selector.toLowerCase().includes('secure')
    )
  );
  const hasLockIcon = elements.some(e =>
    e.text?.toLowerCase().includes('lock') ||
    e.a11y.ariaLabel?.toLowerCase().includes('lock')
  );
  const hasUnlockButton = elements.some(e =>
    (e.tagName === 'button' || e.a11y.role === 'button') && (
      e.text?.toLowerCase().includes('unlock') ||
      e.text?.toLowerCase().includes('sign in') ||
      e.text?.toLowerCase().includes('log in')
    )
  );

  const isAuthScreen = hasPasswordField || (hasLockIcon && hasUnlockButton);

  // Check for error indicators
  const errorElements = elements.filter(e =>
    e.text?.toLowerCase().includes('error') ||
    e.text?.toLowerCase().includes('failed') ||
    e.a11y.ariaLabel?.toLowerCase().includes('error')
  );
  const hasErrors = errorElements.length > 0;

  if (hasErrors) {
    for (const el of errorElements.slice(0, 3)) {
      issues.push({
        severity: 'major',
        type: 'error-indicator',
        problem: `Error detected: "${el.text || el.a11y.ariaLabel}"`,
        fix: 'Investigate the error state in the native app',
      });
    }
  }

  // Determine verdict
  const verdict: SemanticVerdict = hasErrors ? 'FAIL' : 'PASS';

  // Build available actions from interactive elements
  const availableActions = elements
    .filter(e => e.interactive.hasOnClick && !e.interactive.isDisabled && e.text)
    .slice(0, 10)
    .map(e => ({
      action: e.text!.toLowerCase().replace(/\s+/g, '-'),
      selector: e.selector,
      description: e.text!,
    }));

  // Generate summary
  const interactive = elements.filter(e => e.interactive.hasOnClick).length;
  const authSignals: string[] = [];
  if (hasPasswordField) authSignals.push('password-field');
  if (hasLockIcon) authSignals.push('lock-icon');
  if (hasUnlockButton) authSignals.push('unlock-button');

  const summaryParts = [
    `${intent.intent} window`,
    `${elements.length} elements (${interactive} interactive)`,
    isAuthScreen ? 'auth required' : 'ready',
  ];

  return {
    verdict,
    confidence: intent.confidence,
    pageIntent: intent,
    state: {
      auth: {
        authenticated: isAuthScreen ? false : null,
        confidence: isAuthScreen ? 0.8 : 0.3,
        signals: authSignals,
        socialLoginProviders: [],
        hasForgotPassword: false,
        hasSignupLink: false,
        hasPasswordToggle: false,
      },
      loading: {
        loading: false,
        type: 'none',
        elements: 0,
      },
      errors: {
        hasErrors,
        errors: errorElements.map(e => ({
          type: 'unknown' as const,
          message: e.text || 'Error',
        })),
        severity: hasErrors ? 'error' as const : 'none' as const,
      },
      ready: !hasErrors,
    },
    availableActions,
    issues,
    summary: summaryParts.join(', '),
    url: `macos://${window.title}`,
    title: window.title,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Classify native app intent from element composition
 */
function classifyNativeIntent(
  elements: EnhancedElement[],
  windowTitle: string
): PageIntentResult {
  const titleLower = windowTitle.toLowerCase();

  // Auth detection
  const hasPasswordInput = elements.some(e =>
    e.selector.toLowerCase().includes('secure') ||
    e.text?.toLowerCase().includes('password')
  );
  const hasLoginButton = elements.some(e =>
    e.tagName === 'button' && (
      e.text?.toLowerCase().includes('login') ||
      e.text?.toLowerCase().includes('sign in') ||
      e.text?.toLowerCase().includes('unlock')
    )
  );
  if (hasPasswordInput || hasLoginButton) {
    return { intent: 'auth', confidence: 0.9, signals: ['password-field', 'login-button'] };
  }

  // Settings/preferences → maps to 'form' (closest PageIntent)
  if (titleLower.includes('settings') || titleLower.includes('preferences')) {
    return { intent: 'form', confidence: 0.85, signals: ['title-settings'] };
  }

  // List/table detection
  const listElements = elements.filter(e =>
    e.a11y.role === 'list' || e.a11y.role === 'listitem' ||
    e.tagName === 'ul' || e.tagName === 'li'
  );
  if (listElements.length > 3) {
    return { intent: 'listing', confidence: 0.75, signals: ['list-elements'] };
  }

  // Form detection
  const inputElements = elements.filter(e =>
    e.tagName === 'input' || e.tagName === 'textarea' ||
    e.a11y.role === 'textbox'
  );
  if (inputElements.length >= 2) {
    return { intent: 'form', confidence: 0.7, signals: ['multiple-inputs'] };
  }

  // Dashboard detection (many interactive elements, varied types)
  const interactive = elements.filter(e => e.interactive.hasOnClick).length;
  if (interactive > 5) {
    return { intent: 'dashboard', confidence: 0.6, signals: ['many-interactive'] };
  }

  // Default: detail view (closest PageIntent for general content display)
  return { intent: 'detail', confidence: 0.5, signals: ['default'] };
}
