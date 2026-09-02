import { describe, it, expect } from 'vitest';
import { wcagContrastPresetRules } from './wcag-contrast.js';
import type { RuleContext } from '../types.js';
import type { EnhancedElement } from '../../schemas.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    isMobile: false,
    viewportWidth: 1920,
    viewportHeight: 1080,
    url: 'http://localhost:3000',
    allElements: [],
    ...overrides,
  };
}

function makeTextElement(
  text: string,
  color: string,
  backgroundColor: string,
  fontSize = '16',
  fontWeight = '400',
  overrides: Partial<EnhancedElement> = {}
): EnhancedElement {
  return {
    selector: 'p',
    tagName: 'p',
    text,
    bounds: { x: 0, y: 0, width: 200, height: 20 },
    computedStyles: {
      color,
      backgroundColor,
      fontSize,
      fontWeight,
      borderRadius: '0',
      padding: '0',
      cursor: 'default',
      borderWidth: '0',
      borderColor: 'transparent',
    },
    a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    interactive: {
      hasOnClick: false,
      hasHref: false,
      isDisabled: false,
      tabIndex: -1,
      cursor: 'default',
    },
    ...overrides,
  } as EnhancedElement;
}

const [wcagAARule, wcagAAARule] = wcagContrastPresetRules;
const ctx = makeContext();

// ─── WCAG AA Rule ───────────────────────────────────────────────────────────

describe('wcag-aa-contrast rule', () => {
  it('returns null when element has no text', () => {
    const el = makeTextElement('', 'rgb(100, 100, 100)', 'rgb(150, 150, 150)');
    expect(wcagAARule.check(el, ctx)).toBeNull();
  });

  it('returns null when no computedStyles', () => {
    const el = makeTextElement('Hello', 'rgb(0,0,0)', 'rgb(255,255,255)');
    const noStyles = { ...el, computedStyles: undefined };
    expect(wcagAARule.check(noStyles as EnhancedElement, ctx)).toBeNull();
  });

  it('returns null when color is transparent (unparseable)', () => {
    const el = makeTextElement('Hello', 'transparent', 'transparent');
    expect(wcagAARule.check(el, ctx)).toBeNull();
  });

  it('returns null for high-contrast black-on-white (passes AA)', () => {
    // black on white = 21:1 — well above 4.5
    const el = makeTextElement('Hello', 'rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    expect(wcagAARule.check(el, ctx)).toBeNull();
  });

  it('returns a Violation for low-contrast text (fails AA)', () => {
    // medium grey on light grey — contrast ~1.5
    const el = makeTextElement('Low contrast text', 'rgb(150, 150, 150)', 'rgb(200, 200, 200)');
    const result = wcagAARule.check(el, ctx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('wcag-aa-contrast');
    expect(result!.severity).toBe('error');
    expect(result!.element).toBe('p');
    expect(result!.message).toContain('contrast ratio');
    expect(result!.message).toContain('fails WCAG');
  });

  it('Violation shape includes ruleName, element (selector), message, fix', () => {
    const el = makeTextElement('Bad contrast', 'rgb(150, 150, 150)', 'rgb(200, 200, 200)');
    const result = wcagAARule.check(el, ctx)!;
    expect(typeof result.ruleName).toBe('string');
    expect(typeof result.element).toBe('string');
    expect(typeof result.message).toBe('string');
    expect(typeof result.fix).toBe('string');
  });

  it('uses 3:1 threshold for large text (24px normal weight) — passes AA at borderline', () => {
    // Pick colors with ratio between 3:1 and 4.5:1 — fails normal but passes large
    // rgb(117,117,117) on white ≈ 4.48:1 → passes AA for normal but barely
    // Use something that would fail for normal text at 4.5 but pass at 3.0
    // rgb(150,150,150) on white ≈ 1.98:1 — still fails large (need >= 3)
    // rgb(100,100,100) on white ≈ 4.55:1 — passes normal
    // Use rgb(128,128,128) on white ≈ 3.95:1 — passes large (>=3), fails normal (< 4.5)
    const el = makeTextElement('Large', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)', '24', '400');
    // ratio ≈ 3.95 → large text threshold is 3.0 → passes AA → null
    expect(wcagAARule.check(el, ctx)).toBeNull();
  });

  it('flags normal text at same ratio that passes large text (4.5 threshold)', () => {
    // 3.95:1 passes large (≥3) but fails normal (< 4.5)
    const el = makeTextElement('Small', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)', '14', '400');
    const result = wcagAARule.check(el, ctx);
    expect(result).not.toBeNull();
  });

  // WCAG 2.1 defines large-scale text in POINTS: 18pt, or 14pt bold. At the CSS
  // reference of 1pt = 1.333px that is 24px and 18.66px. This test previously
  // asserted 14PX bold was large text, which encoded the same unit confusion the
  // rule itself had, so the wrong threshold passed its own test. 14px bold is
  // normal-scale text and owes the full 4.5:1.
  it('treats 14px bold as NORMAL text (14pt bold = 18.66px, not 14px)', () => {
    // rgb(128,128,128) on white ≈ 3.95 → below the 4.5 normal threshold → violation
    const el = makeTextElement('Bold14', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)', '14', '700');
    expect(wcagAARule.check(el, ctx)).not.toBeNull();
  });

  it('treats 18.66px bold as large text', () => {
    // same 3.95:1 pair clears the 3.0 large-text threshold → null
    const el = makeTextElement('Bold19', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)', '18.66', '700');
    expect(wcagAARule.check(el, ctx)).toBeNull();
  });

  it('treats 24px normal as large text, and 23px normal as not', () => {
    const large = makeTextElement('Big', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)', '24', '400');
    const notLarge = makeTextElement('Med', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)', '23', '400');
    expect(wcagAARule.check(large, ctx)).toBeNull();
    expect(wcagAARule.check(notLarge, ctx)).not.toBeNull();
  });
});

// ─── WCAG AAA Rule ──────────────────────────────────────────────────────────

describe('wcag-aaa-contrast rule', () => {
  it('has warn severity as default', () => {
    expect(wcagAAARule.defaultSeverity).toBe('warn');
  });

  it('returns a Violation for text that passes AA but fails AAA (< 7:1 normal)', () => {
    // rgb(100,100,100) on white ≈ 5.92:1 — passes AA (>4.5) but fails AAA (<7)
    const el = makeTextElement('Medium contrast', 'rgb(100, 100, 100)', 'rgb(255, 255, 255)');
    const result = wcagAAARule.check(el, ctx);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('wcag-aaa-contrast');
    expect(result!.severity).toBe('warn');
    expect(result!.message).toContain('AAA');
  });

  it('returns null for black-on-white (21:1 — passes AAA)', () => {
    const el = makeTextElement('Perfect', 'rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    expect(wcagAAARule.check(el, ctx)).toBeNull();
  });

  it('uses 4.5 threshold for large text AAA', () => {
    // 3.95:1 — large text AAA requires 4.5 → fails → Violation
    const el = makeTextElement('Big', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)', '24', '400');
    const result = wcagAAARule.check(el, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('4.5');
  });

  it('returns null when no text', () => {
    const el = makeTextElement('', 'rgb(89, 89, 89)', 'rgb(255, 255, 255)');
    expect(wcagAAARule.check(el, ctx)).toBeNull();
  });
});

// ─── Inactive components (WCAG 1.4.3 / 1.4.11 exemption) ────────────────────

describe('inactive user interface components are exempt', () => {
  // WCAG 2.1 SC 1.4.3: "Text or images of text that are part of an inactive
  // user interface component ... have no contrast requirement." 1.4.11 carries
  // the same carve-out.
  // https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
  //
  // The real case this came from: IBR's own dashboard has a disabled Send
  // button styled `text-[#5a5a72] bg-[rgba(255,255,255,0.03)] opacity-60`,
  // which IBR graded at 1.76:1 and reported as an AA error. It is a false
  // positive — and one no text colour could have satisfied, because the
  // opacity compresses both layers toward each other.

  const HOPELESS_FG = 'rgb(90, 90, 114)';
  const HOPELESS_BG = 'rgb(80, 80, 100)';

  function disabled(via: 'native' | 'aria') {
    const el = makeTextElement('Send', HOPELESS_FG, HOPELESS_BG);
    el.interactive.isDisabled = true;
    el.tagName = 'button';
    el.selector = 'button';
    if (via === 'aria') el.a11y = { ...el.a11y, role: 'button' };
    return el;
  }

  it('would fail AA when enabled — the control case that proves the gate bites', () => {
    const enabled = makeTextElement('Send', HOPELESS_FG, HOPELESS_BG);
    enabled.tagName = 'button';
    // Identical colours, only isDisabled differs. If this assertion ever goes
    // null the exemption is no longer the thing suppressing the finding, and
    // the tests below would pass for the wrong reason.
    expect(wcagAARule.check(enabled, ctx)).not.toBeNull();
  });

  it('returns null for a natively disabled control that would otherwise fail AA', () => {
    expect(wcagAARule.check(disabled('native'), ctx)).toBeNull();
  });

  it('returns null for the same control under AAA', () => {
    expect(wcagAAARule.check(disabled('native'), ctx)).toBeNull();
  });

  it('exempts aria-disabled the same as native disabled', () => {
    // interactivity.ts sets isDisabled from `disabled` OR aria-disabled="true",
    // so a div-based control that announces itself disabled is exempt on the
    // same terms as a <button>.
    expect(wcagAARule.check(disabled('aria'), ctx)).toBeNull();
  });

  it('does not exempt an enabled control that merely looks muted', () => {
    // The exemption keys on operability, never on appearance. Low-contrast text
    // a user is still expected to read and act on stays a finding.
    const muted = makeTextElement('Save', HOPELESS_FG, HOPELESS_BG);
    muted.tagName = 'button';
    muted.interactive.isDisabled = false;
    muted.interactive.hasOnClick = true;
    expect(wcagAARule.check(muted, ctx)).not.toBeNull();
  });

  it('exempts before measuring, so it cannot surface as unmeasurable either', () => {
    // An exempt element with an undecodable colour must stay silent rather than
    // reporting "could not decode" — the element was never in scope.
    const el = makeTextElement('Send', 'color-mix(in srgb, red, blue)', HOPELESS_BG);
    el.interactive.isDisabled = true;
    expect(wcagAARule.check(el, ctx)).toBeNull();
    expect(wcagAAARule.check(el, ctx)).toBeNull();
  });
});
