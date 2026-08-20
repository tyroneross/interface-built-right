import type { Bounds, EnhancedElement } from '../schemas.js';

/**
 * Target-size policy shared by every touch/pointer-target rule.
 *
 * The defect this module exists to fix: the size rules graded an element's
 * OWN layout box, and graded every interactive element. Two element classes
 * are false by construction under that reading —
 *
 *   1. INLINE PROSE LINKS. An `<a>` inside a sentence measures its text box
 *      (69x17px, say) and gets flagged. WCAG 2.5.8 Target Size (Minimum)
 *      exempts a target that is "in a sentence or whose size is otherwise
 *      constrained by the line-height of non-target text". Growing such a
 *      link to 44px would break the paragraph, so the finding is
 *      unactionable by construction — not a bug the author can fix.
 *
 *   2. LABEL-OVERLAY CONTROLS. A visually-hidden (`sr-only`, `opacity:0`,
 *      `clip-path: inset(50%)`) `<input>` whose hit area is supplied by an
 *      associated visible `<label>` measures at its own size (1x1px for the
 *      CSS-only nav-toggle pattern) while the thing a finger actually lands
 *      on is the label. Clicking an associated label activates the control,
 *      so the label IS the target. Same shape as any radio/checkbox card.
 *
 * Neither fix loosens the gate: (1) is the standard's own normative
 * exception, and (2) measures the real activation rect instead of a proxy
 * that was never the target. Both decisions are recorded (see
 * `TargetSizeDecision.exemption`) so a caller can report what it skipped
 * rather than dropping findings silently.
 *
 * The DOM-side measurements these policies read (`targetContext`) are
 * captured in src/extract.ts; the thresholds and the decision live here so
 * they are unit-testable without a browser.
 */

/** Why a target that would otherwise have been flagged was not. */
export type TargetExemptionKind = 'wcag-inline' | 'label-hit-area';

export interface TargetExemption {
  kind: TargetExemptionKind;
  reason: string;
}

export interface TargetSizeDecision {
  /** Bounds actually graded — the largest activation rect, not always the element's own box. */
  bounds: Bounds;
  /** True when `bounds` fails the minimum in either dimension. */
  violates: boolean;
  /**
   * Non-null only when the element's OWN box would have failed the minimum
   * but no violation is reported. Lets callers count and surface suppressed
   * findings instead of dropping them invisibly.
   */
  exemption: TargetExemption | null;
}

/**
 * Minimum non-target text (whitespace-collapsed characters) that must sit
 * in a target's nearest block ancestor before the WCAG "Inline" exception
 * applies.
 *
 * Guards the separator case: a row of inline `<a>` links joined by " | "
 * leaves ~1-3 characters of non-target text and stays gradable, while any
 * real sentence clears 12 characters several times over. Deliberately far
 * below a sentence and far above a separator, so neither side is a
 * judgement call.
 */
export const MIN_SURROUNDING_TEXT_CHARS = 12;

/**
 * Largest box (in either dimension) a labelled control may have and still be
 * treated as a positioning stub rather than the affordance itself.
 *
 * Only used to decide the responsive case: a control whose associated
 * `<label>` is hidden at THIS viewport. A 1x1 `sr-only` checkbox is a stub —
 * nothing points at it, and above the breakpoint its `sm:hidden` label is
 * gone too, so no pointer target exists to grade. A visible 20x20 checkbox
 * whose label happens to be hidden is NOT a stub: it is a real, undersized
 * target and must stay flagged. 4px separates those cleanly.
 */
export const MAX_STUB_CONTROL_PX = 4;

function area(b: Bounds): number {
  return Math.max(0, b.width) * Math.max(0, b.height);
}

/**
 * WCAG 2.5.8 "Inline" exception.
 *
 * Requires all three: the target is in inline flow (`display: inline` —
 * NOT `inline-block`/`inline-flex`, which are laid out as boxes and can be
 * resized without reflowing the sentence), the target is itself text (an
 * icon-only inline link is not "in a sentence"), and its nearest block
 * ancestor carries enough non-target text to be prose.
 */
export function isWcagInlineTarget(element: EnhancedElement): boolean {
  if (element.computedStyles?.display !== 'inline') return false;
  if (!element.text || element.text.trim().length === 0) return false;
  const surrounding = element.targetContext?.surroundingTextChars ?? 0;
  return surrounding >= MIN_SURROUNDING_TEXT_CHARS;
}

/**
 * The largest contiguous rect a pointer can land on to activate this
 * element — its own box, or an associated `<label>`'s box when that is
 * bigger.
 *
 * Largest-single-rect rather than a geometric union: control and label are
 * often disjoint (an `sr-only` input parked off-screen beside its visible
 * label), and the bounding box of two disjoint rects overstates the target
 * by the empty space between them.
 */
export function largestActivationBounds(element: EnhancedElement): Bounds {
  const label = element.targetContext?.labelTargetBounds;
  if (!label) return element.bounds;
  return area(label) > area(element.bounds) ? label : element.bounds;
}

/**
 * Grade one element against `minSize`, applying both exemptions.
 *
 * Callers remain responsible for deciding whether the element is
 * interactive and visible at all — this function only answers "given that
 * we grade this element, what is its real target box and does it pass?".
 */
export function evaluateTargetSize(element: EnhancedElement, minSize: number): TargetSizeDecision {
  const own = element.bounds;
  const ownViolates = own.width < minSize || own.height < minSize;

  if (isWcagInlineTarget(element)) {
    return {
      bounds: own,
      violates: false,
      exemption: ownViolates
        ? {
            kind: 'wcag-inline',
            reason:
              'Target is inline text inside a block of prose — WCAG 2.5.8 exempts targets ' +
              'in a sentence, and resizing it would reflow the paragraph.',
          }
        : null,
    };
  }

  // A stub control whose every label is hidden at this viewport has no
  // pointer target at all here — the responsive nav-toggle above its
  // breakpoint. Grading the stub's own 1x1 box produces "grow this to 44px",
  // which is never the fix; the affordance simply does not exist at this
  // width. A control big enough to point at is NOT a stub and stays graded.
  const labelsHiddenAtThisViewport =
    !element.targetContext?.labelTargetBounds &&
    (element.targetContext?.associatedLabels ?? 0) > 0 &&
    own.width <= MAX_STUB_CONTROL_PX &&
    own.height <= MAX_STUB_CONTROL_PX;

  if (labelsHiddenAtThisViewport) {
    return {
      bounds: own,
      violates: false,
      exemption: ownViolates
        ? {
            kind: 'label-hit-area',
            reason:
              `Control is a ${own.width}x${own.height}px stub whose associated <label> is ` +
              'hidden at this viewport, so it has no pointer target here to size.',
          }
        : null,
    };
  }

  const bounds = largestActivationBounds(element);
  const violates = bounds.width < minSize || bounds.height < minSize;
  const measuredViaLabel = bounds !== own;

  return {
    bounds,
    violates,
    exemption:
      !violates && ownViolates && measuredViaLabel
        ? {
            kind: 'label-hit-area',
            reason:
              `Hit area is supplied by an associated <label> measuring ` +
              `${bounds.width}x${bounds.height}px; the control's own box (` +
              `${own.width}x${own.height}px) is not the target.`,
          }
        : null,
  };
}

/**
 * Tally exemptions across a set of already-gradable elements, so a caller
 * can report how many findings the two policies suppressed. Elements the
 * caller would not have graded must be filtered out before this call.
 */
export function tallyTargetExemptions(
  elements: EnhancedElement[],
  minSize: number,
): Partial<Record<TargetExemptionKind, number>> {
  const counts: Partial<Record<TargetExemptionKind, number>> = {};
  for (const element of elements) {
    const { exemption } = evaluateTargetSize(element, minSize);
    if (!exemption) continue;
    counts[exemption.kind] = (counts[exemption.kind] ?? 0) + 1;
  }
  return counts;
}
