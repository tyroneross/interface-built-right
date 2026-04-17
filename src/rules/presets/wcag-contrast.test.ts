import { describe, it, expect } from 'vitest';
import { wcagContrastPresetRules } from './wcag-contrast.js';
import type { RuleContext } from '../engine.js';
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

  it('treats bold >= 14px as large text (14px 700 weight is large)', () => {
    // rgb(128,128,128) on white ≈ 3.95 → passes large AA threshold (3.0) → null
    const el = makeTextElement('Bold14', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)', '14', '700');
    expect(wcagAARule.check(el, ctx)).toBeNull();
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
