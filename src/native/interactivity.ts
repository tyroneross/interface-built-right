import type { EnhancedElement } from '../schemas.js';
import type {
  InteractivityResult,
  ButtonInfo,
  LinkInfo,
  FormInfo,
  InteractivityIssue,
} from '../interactivity.js';

/**
 * Build an InteractivityResult from extracted native EnhancedElements
 *
 * Since we extract handler/action info from AX attributes (hasOnClick from AXPress),
 * we can build the same interactivity analysis without Playwright.
 */
export function buildNativeInteractivity(elements: EnhancedElement[]): InteractivityResult {
  const buttons: ButtonInfo[] = [];
  const links: LinkInfo[] = [];
  const forms: FormInfo[] = [];
  const issues: InteractivityIssue[] = [];

  for (const el of elements) {
    const isButton = el.tagName === 'button' || el.a11y.role === 'button';
    const isLink = el.tagName === 'a' || el.a11y.role === 'link';
    if (isButton) {
      const btn: ButtonInfo = {
        selector: el.selector,
        tagName: el.tagName,
        text: el.text,
        hasHandler: el.interactive.hasOnClick,
        isDisabled: el.interactive.isDisabled,
        isVisible: el.bounds.width > 0 && el.bounds.height > 0,
        a11y: {
          role: el.a11y.role || undefined,
          ariaLabel: el.a11y.ariaLabel || undefined,
          tabIndex: el.interactive.tabIndex,
        },
        buttonType: 'button',
      };
      buttons.push(btn);

      // Check for issues
      if (!btn.hasHandler && !btn.isDisabled) {
        issues.push({
          type: 'NO_HANDLER',
          element: el.selector,
          severity: 'warning',
          description: `Button "${el.text || el.selector}" has no press action`,
        });
      }

      if (!el.text && !el.a11y.ariaLabel) {
        issues.push({
          type: 'MISSING_LABEL',
          element: el.selector,
          severity: 'error',
          description: `Button has no accessible label (no text or accessibility label)`,
        });
      }
    }

    if (isLink) {
      const link: LinkInfo = {
        selector: el.selector,
        tagName: el.tagName,
        text: el.text,
        hasHandler: el.interactive.hasOnClick || el.interactive.hasHref,
        isDisabled: el.interactive.isDisabled,
        isVisible: el.bounds.width > 0 && el.bounds.height > 0,
        a11y: {
          role: el.a11y.role || undefined,
          ariaLabel: el.a11y.ariaLabel || undefined,
          tabIndex: el.interactive.tabIndex,
        },
        href: '', // Native links don't have traditional hrefs
        isPlaceholder: false,
        opensNewTab: false,
        isExternal: false,
      };
      links.push(link);

      if (!el.text && !el.a11y.ariaLabel) {
        issues.push({
          type: 'MISSING_LABEL',
          element: el.selector,
          severity: 'error',
          description: `Link has no accessible label (no text or accessibility label)`,
        });
      }
    }

    // Detect form-like groups: look for clusters of inputs near a button
    // This is handled below after collecting all elements
  }

  // Detect form-like patterns: group of inputs followed by a submit-like button
  const inputs = elements.filter(e =>
    ['input', 'textarea', 'select'].includes(e.tagName) ||
    e.a11y.role === 'textbox'
  );

  if (inputs.length > 0) {
    // Find the nearest button (likely submit)
    const submitButton = buttons.find(b =>
      b.text?.toLowerCase().includes('submit') ||
      b.text?.toLowerCase().includes('save') ||
      b.text?.toLowerCase().includes('login') ||
      b.text?.toLowerCase().includes('sign') ||
      b.text?.toLowerCase().includes('unlock') ||
      b.text?.toLowerCase().includes('confirm')
    );

    if (inputs.length >= 1) {
      forms.push({
        selector: 'native-form',
        hasSubmitHandler: !!submitButton,
        fields: inputs.map(inp => ({
          selector: inp.selector,
          name: inp.id || undefined,
          type: inp.a11y.role === 'textbox' ? 'text' : inp.tagName,
          label: inp.a11y.ariaLabel || inp.text || undefined,
          required: false,
          hasValidation: false,
        })),
        hasValidation: false,
        submitButton: submitButton,
      });
    }
  }

  // Calculate summary
  const allInteractive = [...buttons, ...links];
  const withHandlers = allInteractive.filter(e => e.hasHandler).length;

  return {
    buttons,
    links,
    forms,
    issues,
    summary: {
      totalInteractive: allInteractive.length,
      withHandlers,
      withoutHandlers: allInteractive.length - withHandlers,
      issueCount: {
        error: issues.filter(i => i.severity === 'error').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
      },
    },
  };
}
