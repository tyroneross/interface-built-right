import type { Page } from 'playwright';

/**
 * Interactive element info
 */
export interface InteractiveElement {
  selector: string;
  tagName: string;
  type?: string;
  text?: string;
  hasHandler: boolean;
  isDisabled: boolean;
  isVisible: boolean;
  a11y: {
    role?: string;
    ariaLabel?: string;
    tabIndex?: number;
  };
}

/**
 * Button analysis result
 */
export interface ButtonInfo extends InteractiveElement {
  buttonType?: 'submit' | 'button' | 'reset';
  formId?: string;
}

/**
 * Link analysis result
 */
export interface LinkInfo extends InteractiveElement {
  href: string;
  isPlaceholder: boolean;
  opensNewTab: boolean;
  isExternal: boolean;
}

/**
 * Form analysis result
 */
export interface FormInfo {
  selector: string;
  action?: string;
  method?: string;
  hasSubmitHandler: boolean;
  fields: FormFieldInfo[];
  hasValidation: boolean;
  submitButton?: ButtonInfo;
}

/**
 * Form field info
 */
export interface FormFieldInfo {
  selector: string;
  name?: string;
  type: string;
  label?: string;
  required: boolean;
  hasValidation: boolean;
}

/**
 * Interactivity issue
 */
export interface InteractivityIssue {
  type: 'NO_HANDLER' | 'PLACEHOLDER_LINK' | 'MISSING_LABEL' | 'DISABLED_NO_VISUAL' |
        'SMALL_TOUCH_TARGET' | 'FORM_NO_SUBMIT' | 'ORPHAN_SUBMIT' | 'NO_KEYBOARD_ACCESS';
  element: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
}

/**
 * Full interactivity test result
 */
export interface InteractivityResult {
  buttons: ButtonInfo[];
  links: LinkInfo[];
  forms: FormInfo[];
  issues: InteractivityIssue[];
  summary: {
    totalInteractive: number;
    withHandlers: number;
    withoutHandlers: number;
    issueCount: {
      error: number;
      warning: number;
      info: number;
    };
  };
}

/**
 * Test interactivity of all interactive elements on a page
 */
export async function testInteractivity(page: Page): Promise<InteractivityResult> {
  const data = await page.evaluate(() => {
    const results: {
      buttons: ButtonInfo[];
      links: LinkInfo[];
      forms: FormInfo[];
    } = {
      buttons: [],
      links: [],
      forms: [],
    };

    // Helper to check if element has event handlers
    function hasEventHandler(el: Element): boolean {
      // Check for inline handlers
      const inlineHandlers = ['onclick', 'onmousedown', 'onmouseup', 'ontouchstart', 'ontouchend'];
      for (const handler of inlineHandlers) {
        if (el.getAttribute(handler)) return true;
      }

      // Check for common framework patterns
      const attrs = Array.from(el.attributes).map(a => a.name);
      const frameworkPatterns = ['@click', 'v-on:click', 'ng-click', '(click)'];
      for (const pattern of frameworkPatterns) {
        if (attrs.some(a => a.includes(pattern) || a.startsWith(pattern))) return true;
      }

      // Check for data attributes that suggest handlers
      if (el.getAttribute('data-action') || el.getAttribute('data-onclick')) return true;

      // Can't detect addEventListener from DOM, assume true for semantic elements
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'a' && (el as HTMLAnchorElement).href) return true;
      if (tagName === 'button') return true;
      if (tagName === 'input' && ['submit', 'button'].includes((el as HTMLInputElement).type)) return true;

      return false;
    }

    // Helper to get unique selector
    function getSelector(el: Element): string {
      if (el.id) return `#${el.id}`;
      const classes = Array.from(el.classList).slice(0, 2).join('.');
      const tag = el.tagName.toLowerCase();
      if (classes) return `${tag}.${classes}`;
      return tag;
    }

    // Helper to check visibility
    function isVisible(el: Element): boolean {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0' &&
             rect.width > 0 &&
             rect.height > 0;
    }

    // Analyze buttons
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
    for (const btn of buttons) {
      const el = btn as HTMLButtonElement | HTMLInputElement;
      results.buttons.push({
        selector: getSelector(el),
        tagName: el.tagName.toLowerCase(),
        type: el.type || undefined,
        text: el.textContent?.trim() || (el as HTMLInputElement).value || undefined,
        hasHandler: hasEventHandler(el),
        isDisabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        isVisible: isVisible(el),
        a11y: {
          role: el.getAttribute('role') || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          tabIndex: el.tabIndex,
        },
        buttonType: (el as HTMLButtonElement).type as 'submit' | 'button' | 'reset' || undefined,
        formId: el.form?.id || undefined,
      });
    }

    // Analyze links
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const link of links) {
      const el = link as HTMLAnchorElement;
      const href = el.getAttribute('href') || '';
      const isPlaceholder = href === '#' || href === '' || href === 'javascript:void(0)';

      results.links.push({
        selector: getSelector(el),
        tagName: 'a',
        text: el.textContent?.trim() || undefined,
        hasHandler: hasEventHandler(el) || !isPlaceholder,
        isDisabled: el.getAttribute('aria-disabled') === 'true',
        isVisible: isVisible(el),
        a11y: {
          role: el.getAttribute('role') || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          tabIndex: el.tabIndex,
        },
        href,
        isPlaceholder,
        opensNewTab: el.target === '_blank',
        isExternal: el.hostname !== window.location.hostname,
      });
    }

    // Analyze forms
    const forms = Array.from(document.querySelectorAll('form'));
    for (const form of forms) {
      const el = form as HTMLFormElement;
      const fields: FormFieldInfo[] = [];

      // Get form fields
      const inputs = Array.from(el.querySelectorAll('input, select, textarea'));
      for (const input of inputs) {
        const field = input as HTMLInputElement;
        if (['hidden', 'submit', 'button'].includes(field.type)) continue;

        const labelEl = el.querySelector(`label[for="${field.id}"]`) ||
                        field.closest('label');

        fields.push({
          selector: getSelector(field),
          name: field.name || undefined,
          type: field.type || field.tagName.toLowerCase(),
          label: labelEl?.textContent?.trim() || undefined,
          required: field.required,
          hasValidation: field.hasAttribute('pattern') ||
                         field.hasAttribute('min') ||
                         field.hasAttribute('max') ||
                         field.hasAttribute('minlength') ||
                         field.hasAttribute('maxlength'),
        });
      }

      // Find submit button
      const submitBtn = el.querySelector('button[type="submit"], input[type="submit"]');
      let submitInfo: ButtonInfo | undefined;
      if (submitBtn) {
        const btn = submitBtn as HTMLButtonElement;
        submitInfo = {
          selector: getSelector(btn),
          tagName: btn.tagName.toLowerCase(),
          text: btn.textContent?.trim() || (btn as HTMLInputElement).value || undefined,
          hasHandler: hasEventHandler(btn),
          isDisabled: btn.disabled,
          isVisible: isVisible(btn),
          a11y: {
            role: btn.getAttribute('role') || undefined,
            ariaLabel: btn.getAttribute('aria-label') || undefined,
          },
          buttonType: 'submit',
        };
      }

      // Check for submit handler on form
      const hasSubmitHandler = hasEventHandler(el) ||
                               el.getAttribute('action') !== null ||
                               submitBtn !== null;

      results.forms.push({
        selector: getSelector(el),
        action: el.action || undefined,
        method: el.method || undefined,
        hasSubmitHandler,
        fields,
        hasValidation: fields.some(f => f.hasValidation || f.required),
        submitButton: submitInfo,
      });
    }

    return results;
  });

  // Analyze for issues
  const issues: InteractivityIssue[] = [];

  // Check buttons
  for (const btn of data.buttons) {
    if (!btn.hasHandler && !btn.isDisabled) {
      issues.push({
        type: 'NO_HANDLER',
        element: btn.selector,
        severity: 'warning',
        description: `Button "${btn.text || btn.selector}" has no click handler`,
      });
    }

    if (btn.isDisabled && btn.isVisible) {
      // Check if disabled state is visually indicated
      // This is a heuristic - we can't fully check CSS from here
    }

    if (!btn.a11y.ariaLabel && !btn.text) {
      issues.push({
        type: 'MISSING_LABEL',
        element: btn.selector,
        severity: 'error',
        description: `Button has no accessible label (no text or aria-label)`,
      });
    }
  }

  // Check links
  for (const link of data.links) {
    if (link.isPlaceholder && !link.hasHandler) {
      issues.push({
        type: 'PLACEHOLDER_LINK',
        element: link.selector,
        severity: 'error',
        description: `Link "${link.text || link.selector}" has placeholder href without handler`,
      });
    }

    if (!link.a11y.ariaLabel && !link.text) {
      issues.push({
        type: 'MISSING_LABEL',
        element: link.selector,
        severity: 'error',
        description: `Link has no accessible label (no text or aria-label)`,
      });
    }
  }

  // Check forms
  for (const form of data.forms) {
    if (!form.hasSubmitHandler) {
      issues.push({
        type: 'FORM_NO_SUBMIT',
        element: form.selector,
        severity: 'warning',
        description: `Form has no submit handler or action`,
      });
    }

    // Check for labels on fields
    for (const field of form.fields) {
      if (!field.label && field.type !== 'hidden') {
        issues.push({
          type: 'MISSING_LABEL',
          element: field.selector,
          severity: 'warning',
          description: `Form field "${field.name || field.selector}" has no label`,
        });
      }
    }
  }

  // Calculate summary
  const allInteractive = [...data.buttons, ...data.links];
  const withHandlers = allInteractive.filter(e => e.hasHandler).length;

  return {
    buttons: data.buttons,
    links: data.links,
    forms: data.forms,
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

/**
 * Format interactivity result for console output
 */
export function formatInteractivityResult(result: InteractivityResult): string {
  const lines: string[] = [];

  lines.push('Interactivity Analysis');
  lines.push('======================');
  lines.push('');

  // Summary
  lines.push(`Total interactive elements: ${result.summary.totalInteractive}`);
  lines.push(`  With handlers: ${result.summary.withHandlers}`);
  lines.push(`  Without handlers: ${result.summary.withoutHandlers}`);
  lines.push('');

  // Breakdown
  lines.push(`Buttons: ${result.buttons.length}`);
  lines.push(`Links: ${result.links.length}`);
  lines.push(`Forms: ${result.forms.length}`);
  lines.push('');

  // Forms detail
  if (result.forms.length > 0) {
    lines.push('Forms:');
    for (const form of result.forms) {
      const icon = form.hasSubmitHandler ? '✓' : '!';
      lines.push(`  ${icon} ${form.selector} (${form.fields.length} fields)`);
    }
    lines.push('');
  }

  // Issues
  if (result.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '\x1b[31m✗\x1b[0m' :
                   issue.severity === 'warning' ? '\x1b[33m!\x1b[0m' : 'i';
      lines.push(`  ${icon} [${issue.type}] ${issue.description}`);
    }
  } else {
    lines.push('No issues detected.');
  }

  return lines.join('\n');
}
