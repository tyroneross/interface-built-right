import { describe, it, expect } from 'vitest';
import { touchTargetRules } from './touch-targets.js';
import type { EnhancedElement } from '../schemas.js';
import type { RuleContext } from './types.js';

const rule = touchTargetRules[0];

function makeElement(overrides: Partial<EnhancedElement> & { computedStyles?: Record<string, string> } = {}): EnhancedElement {
  return {
    selector: 'button',
    tagName: 'button',
    text: 'Submit',
    bounds: { x: 0, y: 0, width: 20, height: 20 },
    interactive: {
      hasOnClick: true,
      hasHref: false,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    a11y: {
      role: 'button',
      ariaLabel: 'Submit',
      ariaDescribedBy: null,
    },
    ...overrides,
  } as EnhancedElement;
}

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    isMobile: true,
    viewportWidth: 390,
    viewportHeight: 844,
    url: 'http://test',
    allElements: [],
    ...overrides,
  };
}

describe('touch-targets/minimum-size — isNonVisibleOrZeroArea guard', () => {
  it('flags a visible interactive element that is too small on mobile', () => {
    const el = makeElement({ bounds: { x: 0, y: 0, width: 20, height: 20 } });
    const ctx = makeContext({ isMobile: true, viewportWidth: 390 });
    const result = rule.check(el, ctx, undefined);
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('touch-targets/minimum-size');
  });

  it('skips an element with computedStyles.display === "none"', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      computedStyles: { display: 'none' },
    });
    const ctx = makeContext();
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  it('skips an element with computedStyles.display === "none" even when bounds are non-zero', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      computedStyles: { display: 'none' },
    });
    const ctx = makeContext();
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  it('skips an element with computedStyles.visibility === "hidden"', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 20, height: 20 },
      computedStyles: { visibility: 'hidden' },
    });
    const ctx = makeContext();
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  it('skips an element with computedStyles.opacity === "0"', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 20, height: 20 },
      computedStyles: { opacity: '0' },
    });
    const ctx = makeContext();
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  it('skips an element with zero width (one-dimension zero area)', () => {
    const el = makeElement({ bounds: { x: 0, y: 0, width: 0, height: 40 } });
    const ctx = makeContext();
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  it('skips an element with zero height (one-dimension zero area)', () => {
    const el = makeElement({ bounds: { x: 0, y: 0, width: 40, height: 0 } });
    const ctx = makeContext();
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  it('returns null for a compliant visible element (48x48 on mobile) — size OK', () => {
    const el = makeElement({ bounds: { x: 0, y: 0, width: 48, height: 48 } });
    const ctx = makeContext({ isMobile: true, viewportWidth: 390 });
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  it('skips elements with no computedStyles (undefined) when bounds are zero', () => {
    const el = makeElement({ bounds: { x: 0, y: 0, width: 0, height: 0 } });
    // No computedStyles at all — should still be caught by bounds guard
    delete (el as any).computedStyles;
    const ctx = makeContext();
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  // Regression: a11y.ariaHidden is populated by src/extract.ts via
  // `htmlEl.closest('[aria-hidden="true"]')`, which is true for the
  // element's OWN aria-hidden attribute OR any ancestor's. This test
  // exercises the rule's use of that field directly (the closest()
  // ancestor walk itself lives in extract.ts and needs a real DOM —
  // covered by the browser-pool viewport-leak integration test, not
  // unit-testable here without a browser).
  it('skips an element with a11y.ariaHidden even when bounds/size are otherwise compliant', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 48, height: 48 },
      a11y: { role: 'button', ariaLabel: 'Submit', ariaDescribedBy: null, ariaHidden: true },
    });
    const ctx = makeContext({ isMobile: true, viewportWidth: 390 });
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  // Regression evidence from the reported bug: a Tailwind `hidden md:flex`
  // nav link, CORRECTLY measured under an actually-applied mobile viewport,
  // has computedStyles.display === 'none' and zero-area bounds — the rule
  // must return null. (The bug was never a missing filter here; it was the
  // scan layer feeding this rule DESKTOP-viewport bounds/styles while
  // claiming a mobile scan — fixed in src/scan.ts's initScanViewport. See
  // src/engine/browser-pool.test.ts for that regression test.)
  it('skips a mobile-hidden desktop-nav link when the viewport was actually applied (display:none, zero bounds)', () => {
    const el = makeElement({
      tagName: 'a',
      selector: 'nav.relative > div.flex:nth-of-type(1) > a.hidden',
      text: 'Home',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      computedStyles: { display: 'none' },
      interactive: { hasOnClick: false, hasHref: true, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    });
    const ctx = makeContext({ isMobile: true, viewportWidth: 390, viewportHeight: 844 });
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull();
  });

  // Every reported bound for a genuinely-mobile-emulated element must fit
  // inside the mobile viewport's width — the direct assertion the bug
  // report used to prove desktop coordinates were leaking through
  // (x=562, width=600 on a 390px viewport is impossible). Compliant AND
  // non-compliant elements alike must respect this once the viewport fix
  // is in place.
  it('reported bounds fit inside the mobile viewport width for a correctly-measured element', () => {
    const el = makeElement({ bounds: { x: 12, y: 300, width: 44, height: 44 } });
    const ctx = makeContext({ isMobile: true, viewportWidth: 390, viewportHeight: 844 });
    expect(el.bounds.x + el.bounds.width).toBeLessThanOrEqual(ctx.viewportWidth);
    const result = rule.check(el, ctx, undefined);
    expect(result).toBeNull(); // 44x44 meets the 44px mobile minimum
  });
});
