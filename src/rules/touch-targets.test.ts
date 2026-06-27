import { describe, it, expect } from 'vitest';
import { touchTargetRules } from './touch-targets.js';
import type { EnhancedElement } from '../schemas.js';
import type { RuleContext } from './engine.js';

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
});
