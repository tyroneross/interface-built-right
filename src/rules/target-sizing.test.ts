import { describe, it, expect } from 'vitest';
import {
  evaluateTargetSize,
  isWcagInlineTarget,
  largestActivationBounds,
  tallyTargetExemptions,
  MIN_SURROUNDING_TEXT_CHARS,
  MAX_STUB_CONTROL_PX,
} from './target-sizing.js';
import type { EnhancedElement } from '../schemas.js';

function makeElement(overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: 'a',
    tagName: 'a',
    text: 'Chapter 510',
    bounds: { x: 0, y: 0, width: 91, height: 18 },
    computedStyles: { display: 'inline', visibility: 'visible', opacity: '1' },
    interactive: {
      hasOnClick: false,
      hasHref: true,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    ...overrides,
  } as EnhancedElement;
}

// ── Class 1: inline prose links (WCAG 2.5.8 "Inline" exception) ──────────────
//
// Reproduced live on rosslabs.ai/about at 390px: three <a> elements inside
// <p> prose measured 91x18, 65x20 and 147x20 and were all flagged against the
// 44px mobile minimum. WCAG 2.5.8 exempts a target "in a sentence", and
// growing such a link to 44px would reflow the paragraph, so the finding was
// unactionable by construction.

describe('isWcagInlineTarget — WCAG 2.5.8 inline exception', () => {
  it('exempts an inline link surrounded by prose (the live rosslabs.ai/about case)', () => {
    const el = makeElement({ targetContext: { surroundingTextChars: 414 } });
    expect(isWcagInlineTarget(el)).toBe(true);
  });

  it('does NOT exempt an inline-block target — it is a box, resizable without reflowing text', () => {
    const el = makeElement({
      computedStyles: { display: 'inline-block' },
      targetContext: { surroundingTextChars: 414 },
    });
    expect(isWcagInlineTarget(el)).toBe(false);
  });

  it('does NOT exempt an inline-flex target', () => {
    const el = makeElement({
      computedStyles: { display: 'inline-flex' },
      targetContext: { surroundingTextChars: 414 },
    });
    expect(isWcagInlineTarget(el)).toBe(false);
  });

  it('does NOT exempt a block-level target even when the block is full of text', () => {
    const el = makeElement({
      computedStyles: { display: 'block' },
      targetContext: { surroundingTextChars: 414 },
    });
    expect(isWcagInlineTarget(el)).toBe(false);
  });

  it('does NOT exempt an icon-only inline link — an icon is not "in a sentence"', () => {
    const el = makeElement({ text: '', targetContext: { surroundingTextChars: 414 } });
    expect(isWcagInlineTarget(el)).toBe(false);
  });

  it('does NOT exempt a whitespace-only inline link', () => {
    const el = makeElement({ text: '   ', targetContext: { surroundingTextChars: 414 } });
    expect(isWcagInlineTarget(el)).toBe(false);
  });

  it('does NOT exempt a <p> that contains nothing but the link — no sentence around it', () => {
    const el = makeElement({ targetContext: { surroundingTextChars: 0 } });
    expect(isWcagInlineTarget(el)).toBe(false);
  });

  // The precision guard: an inline nav rendered as `<a>Home</a> | <a>About</a>`
  // leaves ~3 characters of non-target text. It is a real mobile hit-area
  // problem and must stay gradable, so the threshold sits well above it.
  it('does NOT exempt a "|"-separated inline nav — separators are not prose', () => {
    const el = makeElement({ text: 'Home', targetContext: { surroundingTextChars: 3 } });
    expect(isWcagInlineTarget(el)).toBe(false);
  });

  it('is exclusive at the threshold boundary', () => {
    expect(
      isWcagInlineTarget(
        makeElement({ targetContext: { surroundingTextChars: MIN_SURROUNDING_TEXT_CHARS - 1 } }),
      ),
    ).toBe(false);
    expect(
      isWcagInlineTarget(
        makeElement({ targetContext: { surroundingTextChars: MIN_SURROUNDING_TEXT_CHARS } }),
      ),
    ).toBe(true);
  });

  it('does NOT exempt when targetContext is absent (older scans stay graded)', () => {
    const el = makeElement();
    delete (el as { targetContext?: unknown }).targetContext;
    expect(isWcagInlineTarget(el)).toBe(false);
  });
});

// ── Class 2: label-overlay controls ─────────────────────────────────────────
//
// Reproduced live on rosslabs.ai: `#nav-toggle` is
// `<input type="checkbox" class="peer sr-only">` at 1x1px, clipped by
// `clip-path: inset(50%)`. Its <label> is 44x44 and is what a finger lands on.

describe('largestActivationBounds — label supplies the hit area', () => {
  it('measures the label when it is larger than the control (the sr-only nav-toggle case)', () => {
    const el = makeElement({
      tagName: 'input',
      selector: '#nav-toggle',
      bounds: { x: -1, y: -1, width: 1, height: 1 },
      targetContext: { labelTargetBounds: { x: 10, y: 10, width: 44, height: 44 } },
    });
    expect(largestActivationBounds(el)).toEqual({ x: 10, y: 10, width: 44, height: 44 });
  });

  it('keeps the control box when the label is smaller — the bigger rect is the target', () => {
    const el = makeElement({
      tagName: 'input',
      bounds: { x: 0, y: 0, width: 48, height: 48 },
      targetContext: { labelTargetBounds: { x: 0, y: 60, width: 20, height: 12 } },
    });
    expect(largestActivationBounds(el)).toEqual({ x: 0, y: 0, width: 48, height: 48 });
  });

  it('keeps the control box when no label was measured', () => {
    const el = makeElement({ bounds: { x: 3, y: 4, width: 20, height: 20 } });
    expect(largestActivationBounds(el)).toEqual({ x: 3, y: 4, width: 20, height: 20 });
  });

  // Largest-single-rect, not a geometric union: control and label are often
  // disjoint (an sr-only input parked off-screen), and the bounding box of
  // two disjoint rects overstates the target by the gap between them.
  it('does not inflate the target with the empty space between a disjoint control and label', () => {
    const el = makeElement({
      tagName: 'input',
      bounds: { x: -1000, y: 0, width: 1, height: 1 },
      targetContext: { labelTargetBounds: { x: 0, y: 0, width: 30, height: 30 } },
    });
    // A union would report 1031px wide and wrongly clear any minimum.
    expect(largestActivationBounds(el)).toEqual({ x: 0, y: 0, width: 30, height: 30 });
  });
});

describe('evaluateTargetSize', () => {
  it('reports no violation and records a wcag-inline exemption for a prose link', () => {
    const el = makeElement({ targetContext: { surroundingTextChars: 414 } });
    const decision = evaluateTargetSize(el, 44);
    expect(decision.violates).toBe(false);
    expect(decision.exemption?.kind).toBe('wcag-inline');
  });

  it('records no exemption for a prose link that already meets the minimum — nothing was suppressed', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 60, height: 60 },
      targetContext: { surroundingTextChars: 414 },
    });
    const decision = evaluateTargetSize(el, 44);
    expect(decision.violates).toBe(false);
    expect(decision.exemption).toBeNull();
  });

  it('reports no violation and records a label-hit-area exemption for the sr-only toggle', () => {
    const el = makeElement({
      tagName: 'input',
      selector: '#nav-toggle',
      text: '',
      computedStyles: { display: 'block' },
      bounds: { x: -1, y: -1, width: 1, height: 1 },
      targetContext: { labelTargetBounds: { x: 10, y: 10, width: 44, height: 44 } },
    });
    const decision = evaluateTargetSize(el, 44);
    expect(decision.violates).toBe(false);
    expect(decision.exemption?.kind).toBe('label-hit-area');
    expect(decision.exemption?.reason).toContain('44x44');
  });

  // The label is measured, not trusted: a genuinely undersized label still
  // fails, and the reported bounds name the label's size so the fix is
  // actionable on the right element.
  it('still violates when the label is itself too small, and reports the LABEL bounds', () => {
    const el = makeElement({
      tagName: 'input',
      bounds: { x: -1, y: -1, width: 1, height: 1 },
      computedStyles: { display: 'block' },
      text: '',
      targetContext: { labelTargetBounds: { x: 10, y: 10, width: 30, height: 30 } },
    });
    const decision = evaluateTargetSize(el, 44);
    expect(decision.violates).toBe(true);
    expect(decision.bounds).toEqual({ x: 10, y: 10, width: 30, height: 30 });
    expect(decision.exemption).toBeNull();
  });

  it('still violates for an undersized block-level control with no label and no prose', () => {
    const el = makeElement({
      tagName: 'button',
      text: 'X',
      computedStyles: { display: 'flex' },
      bounds: { x: 0, y: 0, width: 40, height: 40 },
      targetContext: { surroundingTextChars: 500 },
    });
    const decision = evaluateTargetSize(el, 44);
    expect(decision.violates).toBe(true);
    expect(decision.bounds).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it('grades desktop minimums the same way', () => {
    const el = makeElement({
      tagName: 'button',
      computedStyles: { display: 'flex' },
      bounds: { x: 0, y: 0, width: 20, height: 20 },
    });
    expect(evaluateTargetSize(el, 24).violates).toBe(true);
    expect(evaluateTargetSize(el, 16).violates).toBe(false);
  });
});

// The same live control at the OTHER viewport. Above 640px the toggle's
// <label> carries `sm:hidden`, so the label is gone and the 1x1 stub is all
// that is left — "grow this to 24px" is not the fix, because the affordance
// is deliberately switched off at that width.
describe('evaluateTargetSize — labelled stub whose label is hidden at this viewport', () => {
  const stub = (overrides: Partial<EnhancedElement> = {}) =>
    makeElement({
      tagName: 'input',
      selector: '#nav-toggle',
      text: '',
      computedStyles: { display: 'block', visibility: 'visible', opacity: '1' },
      bounds: { x: -1, y: -1, width: 1, height: 1 },
      targetContext: { associatedLabels: 1 },
      ...overrides,
    });

  it('exempts the 1x1 stub when its only label is hidden here', () => {
    const decision = evaluateTargetSize(stub(), 24);
    expect(decision.violates).toBe(false);
    expect(decision.exemption?.kind).toBe('label-hit-area');
    expect(decision.exemption?.reason).toContain('hidden at this viewport');
  });

  // The false-negative guard: a control large enough to point at is a real
  // target whatever its label is doing, and must stay flagged.
  it('still flags a visible 20x20 control whose label is hidden — not a stub', () => {
    const decision = evaluateTargetSize(
      stub({ bounds: { x: 0, y: 0, width: 20, height: 20 } }),
      24,
    );
    expect(decision.violates).toBe(true);
    expect(decision.exemption).toBeNull();
  });

  it('is exclusive at the stub-size boundary', () => {
    const at = MAX_STUB_CONTROL_PX;
    expect(
      evaluateTargetSize(stub({ bounds: { x: 0, y: 0, width: at, height: at } }), 24).violates,
    ).toBe(false);
    expect(
      evaluateTargetSize(stub({ bounds: { x: 0, y: 0, width: at + 1, height: at + 1 } }), 24)
        .violates,
    ).toBe(true);
  });

  // Without a label association there is no other affordance to point at, so
  // a 1x1 control is a genuine defect and keeps being reported.
  it('still flags a 1x1 control with NO label association at all', () => {
    const decision = evaluateTargetSize(stub({ targetContext: { associatedLabels: 0 } }), 24);
    expect(decision.violates).toBe(true);
  });

  it('prefers a VISIBLE label over the stub exemption, so an undersized label still fails', () => {
    const decision = evaluateTargetSize(
      stub({
        targetContext: { associatedLabels: 1, labelTargetBounds: { x: 0, y: 0, width: 20, height: 20 } },
      }),
      24,
    );
    expect(decision.violates).toBe(true);
    expect(decision.bounds).toEqual({ x: 0, y: 0, width: 20, height: 20 });
  });
});

describe('tallyTargetExemptions', () => {
  it('counts each exemption reason separately so callers can report what was skipped', () => {
    const prose = makeElement({ targetContext: { surroundingTextChars: 414 } });
    const email = makeElement({
      text: 'tyrone@rosslabs.ai',
      bounds: { x: 0, y: 0, width: 147, height: 20 },
      targetContext: { surroundingTextChars: 131 },
    });
    const toggle = makeElement({
      tagName: 'input',
      text: '',
      computedStyles: { display: 'block' },
      bounds: { x: -1, y: -1, width: 1, height: 1 },
      targetContext: { labelTargetBounds: { x: 10, y: 10, width: 44, height: 44 } },
    });
    const genuine = makeElement({
      tagName: 'button',
      computedStyles: { display: 'flex' },
      bounds: { x: 0, y: 0, width: 40, height: 40 },
    });

    expect(tallyTargetExemptions([prose, email, toggle, genuine], 44)).toEqual({
      'wcag-inline': 2,
      'label-hit-area': 1,
    });
  });

  it('returns an empty tally when nothing was suppressed', () => {
    const genuine = makeElement({
      tagName: 'button',
      computedStyles: { display: 'flex' },
      bounds: { x: 0, y: 0, width: 40, height: 40 },
    });
    expect(tallyTargetExemptions([genuine], 44)).toEqual({});
  });
});
