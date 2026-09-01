/**
 * Adapt a ContentElement (heading, paragraph, caption, quote, image) into the
 * EnhancedElement shape the rule engine consumes.
 *
 * WHY AN ADAPTER AND NOT A LOOSER SCHEMA: `EnhancedElement.interactive` and
 * `.a11y` are REQUIRED because every interactive-surface rule reads them
 * without a guard. Making them optional to fit a paragraph would push an
 * undefined check into a dozen rules and turn a compile error into a runtime
 * one. Adapting at the boundary keeps `EnhancedElement` honest and confines the
 * "a paragraph is not a control" statement to a single file.
 *
 * The synthesized `interactive` block says exactly that: no handler, no href,
 * not focusable (`tabIndex: -1`). That block IS definitional. The `a11y` block
 * is not, and is therefore read from the DOM rather than assumed — hardcoding
 * it to nulls made "this element has no accessible name" indistinguishable from
 * "nobody looked". The surface filter in
 * `runRules` (see `RunRulesOptions.surface`) is what actually keeps
 * touch-target and handler-integrity rules away from these elements; this shape
 * is the second line of defence, not the first.
 */

import type { ContentElement } from '../extract.js';
import type { EnhancedElement } from '../schemas.js';

/** Non-interactive text content adapted for the rule engine's element shape. */
export function contentElementToEnhanced(content: ContentElement): EnhancedElement {
  return {
    selector: content.selector,
    tagName: content.tagName,
    id: content.id,
    className: content.className,
    // Deliberately NOT `content.text ?? content.alt`. Alt text is never
    // PAINTED, so handing it to a contrast rule invents a measurement: an
    // <img alt="Company logo"> on a dark card was reported as
    // '"Company logo" contrast ratio 1.13:1 fails WCAG 2.1 AA' with a fix
    // instruction that would change nothing on screen — and, now that the
    // verdict is computed from `issues`, could push a page off PASS. An image
    // takes the 'no-text' arm instead. If alt text ever needs grading it wants
    // its own rule with `appliesTo: 'text'`, not a painted-contrast rule.
    text: content.contentKind === 'image' ? undefined : content.text,
    bounds: content.bounds,
    computedStyles: content.computedStyles,
    backgroundChain: content.backgroundChain,
    backgroundImageBehind: content.backgroundImageBehind,
    interactive: {
      hasOnClick: false,
      hasHref: false,
      isDisabled: false,
      // -1, not 0: a paragraph is not in the tab order. 0 would read as
      // "focusable" to any rule that checks it.
      tabIndex: -1,
      cursor: content.computedStyles.cursor ?? 'auto',
    },
    // Read from the DOM, not invented. `role: null, ariaLabel: null` used to be
    // hardcoded here and described as definitional — it was not: an <h2
    // aria-label="..."> or <p role="note"> is ordinary markup, and no rule
    // reading these fields could have told "absent" from "never captured".
    a11y: {
      role: content.role ?? null,
      ariaLabel: content.ariaLabel ?? null,
      ariaDescribedBy: content.ariaDescribedBy ?? null,
      ...(content.ariaHidden ? { ariaHidden: true } : {}),
    },
  };
}

/** Adapt a batch, preserving order. */
export function contentElementsToEnhanced(content: readonly ContentElement[]): EnhancedElement[] {
  return content.map(contentElementToEnhanced);
}
