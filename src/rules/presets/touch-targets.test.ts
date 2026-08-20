import { describe, it, expect } from 'vitest';
import { touchTargetPresetRules } from './touch-targets.js';
import type { RuleContext } from '../types.js';
import type { EnhancedElement } from '../../schemas.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeContext(isMobile = false): RuleContext {
  return {
    isMobile,
    viewportWidth: isMobile ? 375 : 1920,
    viewportHeight: isMobile ? 667 : 1080,
    url: 'http://localhost:3000',
    allElements: [],
  };
}

function makeEl(
  tagName: string,
  width: number,
  height: number,
  overrides: Partial<EnhancedElement> = {}
): EnhancedElement {
  return {
    selector: tagName,
    tagName,
    text: 'Click me',
    bounds: { x: 0, y: 0, width, height },
    computedStyles: {
      color: 'rgb(0,0,0)',
      backgroundColor: 'rgb(255,255,255)',
      fontSize: '16',
      fontWeight: '400',
      cursor: 'pointer',
    },
    a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    interactive: {
      hasOnClick: true,
      hasHref: false,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    ...overrides,
  } as EnhancedElement;
}

const [mobileRule, desktopRule] = touchTargetPresetRules;
const mobileCtx = makeContext(true);
const desktopCtx = makeContext(false);

// ─── Mobile rule ─────────────────────────────────────────────────────────────

describe('touch-target-mobile rule', () => {
  it('flags 40x40 button in mobile context', () => {
    const el = makeEl('button', 40, 40);
    const result = mobileRule.check(el, mobileCtx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('touch-target-mobile');
    expect(result!.severity).toBe('error');
    expect(result!.message).toContain('40x40');
  });

  it('ignores 40x40 button in desktop context', () => {
    const el = makeEl('button', 40, 40);
    expect(mobileRule.check(el, desktopCtx)).toBeNull();
  });

  it('ignores 44x44 button in mobile (at minimum — no violation)', () => {
    const el = makeEl('button', 44, 44);
    expect(mobileRule.check(el, mobileCtx)).toBeNull();
  });

  it('ignores non-interactive text div in mobile context', () => {
    const el = makeEl('div', 30, 30, {
      tagName: 'div',
      selector: 'div',
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: -1,
        cursor: 'default',
      },
    });
    expect(mobileRule.check(el, mobileCtx)).toBeNull();
  });

  it('skips zero-width elements', () => {
    const el = makeEl('button', 0, 44);
    expect(mobileRule.check(el, mobileCtx)).toBeNull();
  });

  it('skips zero-height elements', () => {
    const el = makeEl('button', 44, 0);
    expect(mobileRule.check(el, mobileCtx)).toBeNull();
  });

  it('treats role=button as interactive', () => {
    const el = makeEl('div', 30, 30, {
      a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null },
      interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'default' },
    });
    const result = mobileRule.check(el, mobileCtx);
    expect(result).not.toBeNull();
  });

  it('treats tag=a as interactive', () => {
    const el = makeEl('a', 30, 20, {
      interactive: { hasOnClick: false, hasHref: true, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
    });
    expect(mobileRule.check(el, mobileCtx)).not.toBeNull();
  });

  it('treats hasReactHandler=true as interactive even without role/tag', () => {
    const el = makeEl('span', 20, 20, {
      tagName: 'span',
      selector: 'span',
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
      interactive: {
        hasOnClick: false,
        hasHref: false,
        hasReactHandler: true,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'pointer',
      },
    });
    expect(mobileRule.check(el, mobileCtx)).not.toBeNull();
  });
});

// ─── Desktop rule ─────────────────────────────────────────────────────────────

describe('touch-target-desktop rule', () => {
  it('flags 20x20 button in desktop context at warn severity', () => {
    const el = makeEl('button', 20, 20);
    const result = desktopRule.check(el, desktopCtx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('touch-target-desktop');
    expect(result!.severity).toBe('warn');
    expect(result!.message).toContain('20x20');
  });

  it('ignores 24x24 button in desktop (at minimum — no violation)', () => {
    const el = makeEl('button', 24, 24);
    expect(desktopRule.check(el, desktopCtx)).toBeNull();
  });

  it('ignores desktop rule in mobile context', () => {
    const el = makeEl('button', 20, 20);
    expect(desktopRule.check(el, mobileCtx)).toBeNull();
  });

  it('skips zero-size elements', () => {
    const el = makeEl('button', 0, 0);
    expect(desktopRule.check(el, desktopCtx)).toBeNull();
  });

  it('ignores non-interactive span', () => {
    const el = makeEl('span', 10, 10, {
      tagName: 'span',
      selector: 'span',
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: -1,
        cursor: 'default',
      },
    });
    expect(desktopRule.check(el, desktopCtx)).toBeNull();
  });

  it('treats cursor:pointer + onClick handler as interactive', () => {
    const el = makeEl('div', 15, 15, {
      tagName: 'div',
      selector: 'div',
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
      interactive: {
        hasOnClick: true,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'pointer',
      },
    });
    expect(desktopRule.check(el, desktopCtx)).not.toBeNull();
  });
});

// The mobile rule is the only touch-target rule that defaults to `error`, so
// it is the one that can hard-block a build. Both unactionable-finding classes
// are verified here specifically at that severity. See
// src/rules/target-sizing.ts for why each is false by construction.
describe('preset touch-target rules — unactionable-finding classes', () => {
  it('mobile (error severity) does not flag an inline link inside prose', () => {
    const el = makeEl('a', 91, 18, {
      text: 'Chapter 510',
      computedStyles: { display: 'inline' },
      interactive: { hasOnClick: false, hasHref: true, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      targetContext: { surroundingTextChars: 414 },
    });
    expect(mobileRule.check(el, mobileCtx)).toBeNull();
  });

  it('mobile (error severity) does not flag an sr-only control whose 44x44 label is the hit area', () => {
    const el = makeEl('input', 1, 1, {
      text: '',
      computedStyles: { display: 'block' },
      targetContext: { labelTargetBounds: { x: 10, y: 10, width: 44, height: 44 } },
    });
    expect(mobileRule.check(el, mobileCtx)).toBeNull();
  });

  it('mobile still errors on a genuine 40x40 icon button', () => {
    const el = makeEl('a', 40, 40, {
      text: 'LinkedIn',
      computedStyles: { display: 'inline-flex' },
      interactive: { hasOnClick: false, hasHref: true, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      targetContext: { surroundingTextChars: 200 },
    });
    const result = mobileRule.check(el, mobileCtx);
    expect(result?.severity).toBe('error');
    expect(result?.bounds).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it('desktop applies the same two exemptions at the 24px minimum', () => {
    const prose = makeEl('a', 20, 18, {
      text: 'Chapter 510',
      computedStyles: { display: 'inline' },
      interactive: { hasOnClick: false, hasHref: true, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      targetContext: { surroundingTextChars: 414 },
    });
    const toggle = makeEl('input', 1, 1, {
      text: '',
      computedStyles: { display: 'block' },
      targetContext: { labelTargetBounds: { x: 0, y: 0, width: 30, height: 30 } },
    });
    expect(desktopRule.check(prose, desktopCtx)).toBeNull();
    expect(desktopRule.check(toggle, desktopCtx)).toBeNull();
  });

  it('reports the label bounds when the label itself is under the mobile minimum', () => {
    const el = makeEl('input', 1, 1, {
      text: '',
      computedStyles: { display: 'block' },
      targetContext: { labelTargetBounds: { x: 10, y: 10, width: 30, height: 30 } },
    });
    const result = mobileRule.check(el, mobileCtx);
    expect(result).not.toBeNull();
    expect(result?.bounds).toEqual({ x: 10, y: 10, width: 30, height: 30 });
  });
});
