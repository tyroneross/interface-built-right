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
 * not focusable (`tabIndex: -1`). Nothing here is a guess about the DOM — it is
 * the definition of a non-interactive element. The surface filter in
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
    // <img> carries no text; alt is its readable content and is what a
    // text-oriented rule should see if one ever grades images.
    text: content.text ?? content.alt,
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
    a11y: {
      role: null,
      ariaLabel: null,
      ariaDescribedBy: null,
    },
  };
}

/** Adapt a batch, preserving order. */
export function contentElementsToEnhanced(content: readonly ContentElement[]): EnhancedElement[] {
  return content.map(contentElementToEnhanced);
}
