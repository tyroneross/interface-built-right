import type { PageLike as Page } from './engine/page-like.js';
import { probeActivationListeners } from './handler-listeners.js';

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
  /**
   * True when `hasHandler` is an UNVERIFIED assumption rather than a
   * confirmed signal — set only on the fallback path (no CDP capability, or
   * the DOM mutated between the static pass and the listener probe) for a
   * native `<button>` / `input[type=submit|button]`, where the pre-fix
   * behavior of assuming "wired" is restored so a non-CDP PageLike doesn't
   * regress to reporting every plain button as dead. Never set for links —
   * see PLACEHOLDER_LINK handling below.
   */
  handlerAssumed?: boolean;
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
 * Native `<button>`/`[role="button"]`/`input[type=button|submit]` query --
 * shared between the in-page static pass below and the listener-probe
 * targets expressions further down so both walk the DOM in the exact same
 * order (`probeActivationListeners`' result array is positional, not keyed
 * by selector -- see its doc comment).
 */
const BUTTON_QUERY = 'button, [role="button"], input[type="button"], input[type="submit"]';

/**
 * Test interactivity of all interactive elements on a page
 */
export async function testInteractivity(page: Page): Promise<InteractivityResult> {
  const data = await page.evaluate(({ buttonQuery }: { buttonQuery: string }) => {
    const results: {
      buttons: ButtonInfo[];
      links: LinkInfo[];
      forms: FormInfo[];
      // Internal-only, positionally aligned with buttons/links/forms above --
      // never exposed on ButtonInfo/LinkInfo/FormInfo. Consumed by the
      // second-pass listener probe (see buildNeededTargetsExpression) to
      // detect a DOM that swapped elements while keeping the same COUNT, a
      // case array-length equality alone cannot catch.
      buttonSignatures: string[];
      linkSignatures: string[];
      formSubmitSignatures: (string | null)[];
    } = {
      buttons: [],
      links: [],
      forms: [],
      buttonSignatures: [],
      linkSignatures: [],
      formSubmitSignatures: [],
    };

    // Identity fingerprint for the positional re-query safety check above --
    // tagName + id + the first 40 chars of trimmed textContent. Cheap, no
    // false negatives for the DOM-swap case this guards against (same count,
    // different elements), while tolerant of layout-only re-renders that
    // don't touch tag/id/text.
    function computeSignature(el: Element): string {
      const tag = el.tagName.toLowerCase();
      const id = el.id || '';
      const text = (el.textContent || '').trim().slice(0, 40);
      return `${tag}|${id}|${text}`;
    }

    // Helper to check if element has event handlers
    function hasEventHandler(el: Element): boolean {
      // Event-handler PROPERTIES, set as `el.onclick = fn`. These create no
      // attribute, so the getAttribute() loop below cannot see them. Missing
      // this reported every `<li role="button">` in a real app as handler-less
      // -- 22 of them -- while all 22 worked. src/extract.ts already checks the
      // property (`typeof el.onclick === 'function'` in detectHandlers); this
      // makes the two paths agree.
      const handlerProps = ['onclick', 'onmousedown', 'onmouseup', 'ontouchstart', 'ontouchend'] as const;
      for (const prop of handlerProps) {
        if (typeof (el as unknown as Record<string, unknown>)[prop] === 'function') return true;
      }

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

      // Framework handler props/state set directly on THIS element -- ported
      // from extract.ts's detectHandlers() for parity between the two
      // lanes. `probeActivationListeners` below credits React/Vue props only
      // on ANCESTORS (a real delegation pattern) and stops at the framework
      // root, so it structurally cannot see a framework handler attached to
      // the element itself -- React/Vue never attach a native DOM listener
      // for onClick/onSubmit at all; the handler lives only on the
      // fiber/props object. Before this, `<button onClick>` / `<a href="#"
      // onClick>` in a React app read as NO_HANDLER / PLACEHOLDER_LINK here,
      // while extract.ts's detectHandlers() correctly credited them --
      // passing pre-fix only because of the removed "assume wired"
      // assumption.
      const frameworkKeys = Object.keys(el);

      // React 17+ uses __reactProps$
      const reactPropsKey = frameworkKeys.find(k => k.startsWith('__reactProps$'));
      if (reactPropsKey) {
        const props = (el as any)[reactPropsKey];
        if (props?.onClick || props?.onSubmit || props?.onMouseDown) return true;
      }

      // Also check React fiber
      const fiberKey = frameworkKeys.find(k => k.startsWith('__reactFiber$'));
      if (fiberKey) {
        const fiber = (el as any)[fiberKey];
        if (fiber?.pendingProps?.onClick || fiber?.memoizedProps?.onClick) return true;
      }

      // Vue uses __vue__ or __vnode
      if ((el as any).__vue__?.$listeners?.click || (el as any).__vnode?.props?.onClick) return true;

      // Angular uses __ngContext__
      if ((el as any).__ngContext__ || el.hasAttribute('ng-click')) return true;

      const tagName = el.tagName.toLowerCase();
      // A <summary> toggles its <details> with no author handler at all --
      // genuine native behavior, unlike the deleted assumptions below.
      if (tagName === 'summary') return true;

      // getEventListeners can't be reached from plain in-page JS (no CDP
      // flag here), so `addEventListener`-only wiring is invisible to
      // everything above. This function used to paper over that gap by
      // ASSUMING every `<button>`, submit/button `<input>`, and `<a>` with a
      // resolved `.href` was wired -- which made a truly dead `<button>`
      // report `hasHandler: true` while extract.ts's NO_HANDLER audit and
      // `handler-integrity/fake-interactive` (both driven by a real listener
      // probe) correctly reported it dead, and made `<a href="#">`'s
      // resolved `.href` (always truthy -- it resolves to
      // `http://.../#`) mean PLACEHOLDER_LINK could never fire for a
      // placeholder link at all.
      //
      // What's credited below instead is NATIVE activation that genuinely
      // needs no JS anywhere: a submit control whose form (or the control's
      // own `formaction`/`formmethod` override) has a real action performs a
      // real navigation on click; `method="dialog"` closes the owning
      // `<dialog>`; a `type=reset` control needs only a form owner;
      // `popovertarget`/`commandfor` drive the native Popover API / Invoker
      // Commands API. Everything else -- a plain dead `<button>`, a submit
      // button with no form action, a placeholder `<a href="#">` -- now
      // correctly falls through to `false` here, and gets one more chance
      // via the real listener probe in `testInteractivity` below before
      // being reported as handler-less. No `type=image` branch: neither
      // BUTTON_QUERY (interactivity's buttons pass) nor the submit-button
      // selectors used for forms match `input[type="image"]`, so it can
      // never reach this function -- dead code, not a real case.
      if (tagName === 'button' || tagName === 'input') {
        const control = el as HTMLButtonElement | HTMLInputElement;
        const type = (
          control.getAttribute('type') || (tagName === 'button' ? 'submit' : 'text')
        ).toLowerCase();
        const form = control.form;

        if (form && type === 'submit') {
          // A submit button's own `formaction`/`formmethod` attributes
          // override the owning form's `action`/`method` per the HTML spec
          // (only meaningful when the control has a form owner at all), so
          // either source of a real action, or either source of
          // `method="dialog"`, is a genuine native-activation signal.
          const formAction = control.getAttribute('formaction');
          const formMethod = (control.getAttribute('formmethod') || '').toLowerCase();
          const action = form.getAttribute('action');
          const method = (form.getAttribute('method') || '').toLowerCase();
          if (formAction || formMethod === 'dialog' || action || method === 'dialog') return true;
        }
        if (form && type === 'reset') return true;
        if (el.hasAttribute('popovertarget') || el.hasAttribute('commandfor')) return true;
      }

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
    const buttons = Array.from(document.querySelectorAll(buttonQuery));
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
      results.buttonSignatures.push(computeSignature(el));
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
      results.linkSignatures.push(computeSignature(el));
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

        // The accessible name, not just a <label> element. A field labelled
        // with aria-label or aria-labelledby IS labelled; reporting it as
        // MISSING_LABEL produced a remediation ("add aria-label") for an
        // attribute already present, observed 2026-08-31 on two unrelated
        // pages. aria-labelledby wins over aria-label per the accname spec.
        const labelledBy = (field.getAttribute('aria-labelledby') || '')
          .split(/\s+/)
          .filter(Boolean)
          .map(id => el.ownerDocument?.getElementById(id)?.textContent?.trim() || '')
          .filter(Boolean)
          .join(' ');
        const accessibleName =
          labelledBy ||
          (field.getAttribute('aria-label') || '').trim() ||
          (field.getAttribute('title') || '').trim();

        fields.push({
          selector: getSelector(field),
          name: field.name || undefined,
          type: field.type || field.tagName.toLowerCase(),
          label: labelEl?.textContent?.trim() || accessibleName || undefined,
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
        const btn = submitBtn as HTMLButtonElement | HTMLInputElement;
        submitInfo = {
          selector: getSelector(btn),
          tagName: btn.tagName.toLowerCase(),
          text: btn.textContent?.trim() || ('value' in btn ? btn.value : undefined),
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
      results.formSubmitSignatures.push(submitBtn ? computeSignature(submitBtn) : null);
    }

    return results;
  }, { buttonQuery: BUTTON_QUERY });

  // Second pass: real DOM listener detection (DevTools getEventListeners via
  // CDP, see probeActivationListeners) for every control static detection
  // above left with `hasHandler: false` -- buttons/role=button widgets,
  // placeholder links, and form submit buttons. Brings this lane's verdict
  // into agreement with extract.ts's enrichWithEventListeners /
  // handler-integrity's fake-interactive check, both driven by the same
  // shared probe. Mutates the ButtonInfo/LinkInfo objects in `data` in
  // place, so the issue/summary computation below sees the updated values.
  await enrichButtonsWithListeners(page, data.buttons, data.buttonSignatures);
  await enrichPlaceholderLinksWithListeners(page, data.links, data.linkSignatures);
  await enrichFormSubmitButtonsWithListeners(page, data.forms, data.formSubmitSignatures);

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
 * Native tags eligible for the pre-fix "assume wired" fallback (see the
 * `handlerAssumed` doc comment on `InteractiveElement`). `[role="button"]`
 * elements never received that assumption -- they always required an
 * explicit signal (attribute, property, framework marker, or a real
 * listener) -- so the fallback must not grant it to them either.
 */
function isNativeButtonOrInput(tagName: string): boolean {
  return tagName === 'button' || tagName === 'input';
}

/**
 * Wraps a JS source expression that evaluates to an array inside the page so
 * only the positions in `neededIndices` survive -- every other index maps to
 * `null` -- while the array's LENGTH is unchanged. `probeActivationListeners`
 * already treats a `null` target as "no signal, skip it" (see its doc
 * comment), so this is a free way to skip `getEventListeners` and the
 * ancestor delegation walk entirely for elements static detection already
 * confirmed wired.
 *
 * ALSO guards positional integrity for the elements that ARE re-probed.
 * Array-length equality (the caller's fallback check below this function)
 * cannot detect a DOM that swapped elements while keeping the same COUNT --
 * e.g. a list re-render that removed one dead button and appended a
 * different wired one. `neededSignatures` carries one identity fingerprint
 * per needed index, computed during the static pass (see `computeSignature`
 * above, inside the page.evaluate() callback: tagName + id + first 40 chars
 * of trimmed textContent). Before returning the positional array, this
 * recomputes each needed index's LIVE signature and compares it; if ANY
 * needed element's signature no longer matches (or the element vanished),
 * the WHOLE expression evaluates to `null`, not just that one entry --
 * `probeActivationListeners` treats a non-array result as "probe failed",
 * so every caller falls into its normal unusable-probe path instead of
 * silently crediting listener state read off the wrong element.
 */
function buildNeededTargetsExpression(
  listExpression: string,
  neededIndices: number[],
  neededSignatures: string[],
): string {
  const expectedByIndex: Record<number, string> = {};
  neededIndices.forEach((idx, pos) => { expectedByIndex[idx] = neededSignatures[pos]!; });

  return `(function () {
    const needed = new Set(${JSON.stringify(neededIndices)});
    const expected = ${JSON.stringify(expectedByIndex)};
    const computeSignature = function (el) {
      var tag = el.tagName.toLowerCase();
      var id = el.id || '';
      var text = (el.textContent || '').trim().slice(0, 40);
      return tag + '|' + id + '|' + text;
    };
    const list = ${listExpression};
    for (var i = 0; i < list.length; i++) {
      if (!needed.has(i)) continue;
      var el = list[i];
      if (!el || computeSignature(el) !== expected[i]) return null;
    }
    return list.map(function (el, i) { return needed.has(i) ? el : null; });
  })()`;
}

/**
 * Runs `probeActivationListeners` for every `ButtonInfo` static detection
 * left with `hasHandler: false`, re-querying `BUTTON_QUERY` so the probe's
 * positional result array lines up with `buttons`. Positional integrity is
 * guarded primarily by the per-element signature check embedded in
 * `buildNeededTargetsExpression` -- it returns `null` for the whole
 * expression if the DOM swapped a needed element while keeping the same
 * count -- with the length comparison below as a secondary, cheaper check
 * for the coarser case (a whole list gaining/losing elements). Either
 * failure falls through to the native-button fallback exactly as a missing
 * probe would. Elements already confirmed wired are never sent through the
 * probe at all -- see buildNeededTargetsExpression.
 */
async function enrichButtonsWithListeners(page: Page, buttons: ButtonInfo[], signatures: string[]): Promise<void> {
  const neededIndices = buttons.reduce<number[]>((acc, b, i) => {
    if (!b.hasHandler) acc.push(i);
    return acc;
  }, []);
  if (neededIndices.length === 0) return;

  const targetsExpression = buildNeededTargetsExpression(
    `Array.from(document.querySelectorAll(${JSON.stringify(BUTTON_QUERY)}))`,
    neededIndices,
    neededIndices.map((i) => signatures[i]!),
  );
  const probes = await probeActivationListeners(page, targetsExpression);
  const usable = !!probes && probes.length === buttons.length;

  for (const i of neededIndices) {
    const btn = buttons[i]!;

    if (usable) {
      // The probe ran and produced a real, positionally-aligned verdict for
      // this element -- final, whichever way it goes. A `false` here means
      // getEventListeners genuinely found nothing; it must NOT fall through
      // to the "assume wired" fallback below, or every real listener probe
      // result would be silently overwritten back to the pre-fix behavior.
      const result = probes![i];
      if (result && (result.hasEventListener || result.hasDelegatedListener)) {
        btn.hasHandler = true;
      }
      continue;
    }

    // Only reached when the probe itself is unusable: no CDP capability
    // (non-CompatPage PageLike), the evaluate failed, or the DOM changed
    // shape between the static pass and this probe. Restore the pre-fix
    // assumption ONLY for native <button>/input[submit|button] -- see
    // isNativeButtonOrInput -- and mark it unverified so a caller can tell
    // an assumption from a confirmed signal.
    if (isNativeButtonOrInput(btn.tagName)) {
      btn.hasHandler = true;
      btn.handlerAssumed = true;
    }
  }
}

/**
 * Runs `probeActivationListeners` for placeholder links (`href="#"`, `""`,
 * `javascript:void(0)`) that static detection left with `hasHandler: false`
 * -- the one lane where the pre-fix assumption was an outright bug, not a
 * degradation: `<a>`'s `.href` property resolves `#` to a truthy absolute
 * URL (`http://.../#`), so `hasEventHandler`'s old anchor check made
 * PLACEHOLDER_LINK structurally unable to ever fire. Non-placeholder links
 * already have `hasHandler: true` via their real `href` and are never
 * touched here.
 *
 * Deliberately NO fallback: unlike buttons, a placeholder link does NOT get
 * the old assumption back when the probe is unavailable or mismatched --
 * that assumption was never correct for it in the first place (the known
 * "restore the pre-fix assumption" fallback below applies to buttons only).
 * Non-placeholder links are never sent through the probe at all -- see
 * buildNeededTargetsExpression.
 */
async function enrichPlaceholderLinksWithListeners(page: Page, links: LinkInfo[], signatures: string[]): Promise<void> {
  const neededIndices = links.reduce<number[]>((acc, l, i) => {
    if (l.isPlaceholder && !l.hasHandler) acc.push(i);
    return acc;
  }, []);
  if (neededIndices.length === 0) return;

  const targetsExpression = buildNeededTargetsExpression(
    `Array.from(document.querySelectorAll('a[href]'))`,
    neededIndices,
    neededIndices.map((i) => signatures[i]!),
  );
  const probes = await probeActivationListeners(page, targetsExpression);
  if (!probes || probes.length !== links.length) return;

  for (const i of neededIndices) {
    const link = links[i]!;
    const result = probes[i];
    if (result && (result.hasEventListener || result.hasDelegatedListener)) {
      link.hasHandler = true;
    }
  }
}

/**
 * Runs `probeActivationListeners` for each form's submit button
 * (`FormInfo.submitButton`) that static detection left with `hasHandler:
 * false` -- re-querying `document.querySelectorAll('form')` in the same
 * order as the static pass, then each form's own submit-button query, so
 * probe result index i lines up with `forms[i]`. Forms whose submit button
 * is already confirmed wired (or has none) are never sent through the probe
 * at all -- see buildNeededTargetsExpression.
 */
async function enrichFormSubmitButtonsWithListeners(
  page: Page,
  forms: FormInfo[],
  signatures: (string | null)[],
): Promise<void> {
  const neededIndices = forms.reduce<number[]>((acc, f, i) => {
    if (f.submitButton && !f.submitButton.hasHandler) acc.push(i);
    return acc;
  }, []);
  if (neededIndices.length === 0) return;

  const targetsExpression = buildNeededTargetsExpression(
    `Array.from(document.querySelectorAll('form')).map(function (f) {
      return f.querySelector('button[type="submit"], input[type="submit"]');
    })`,
    neededIndices,
    // A needed index always has a submitButton (filter above), so its
    // signature is always a real string, never null -- see
    // formSubmitSignatures' construction in the static pass.
    neededIndices.map((i) => signatures[i]!),
  );
  const probes = await probeActivationListeners(page, targetsExpression);
  const usable = !!probes && probes.length === forms.length;

  for (const i of neededIndices) {
    const submitButton = forms[i]!.submitButton!;

    if (usable) {
      // Final verdict, whichever way it goes -- see the identical comment in
      // enrichButtonsWithListeners for why `false` must not fall through to
      // the fallback below.
      const result = probes![i];
      if (result && (result.hasEventListener || result.hasDelegatedListener)) {
        submitButton.hasHandler = true;
      }
      continue;
    }

    // Fallback restores the pre-fix assumption for native
    // button/input[submit|button] only -- see enrichButtonsWithListeners.
    if (isNativeButtonOrInput(submitButton.tagName)) {
      submitButton.hasHandler = true;
      submitButton.handlerAssumed = true;
    }
  }
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
