import { describe, it, expect } from 'vitest';
import { runAllRules } from './index.js';
import type { RuleEngineResult } from './index.js';

function makeElement(overrides: Record<string, unknown> = {}) {
  return {
    selector: 'test-el',
    tagName: 'div',
    bounds: { x: 0, y: 0, width: 100, height: 40 },
    computedStyles: {},
    interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'default' },
    a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    ...overrides,
  } as any;
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    isMobile: false,
    viewportWidth: 1280,
    viewportHeight: 720,
    url: 'http://test',
    allElements: [],
    ...overrides,
  } as any;
}

describe('wcag/contrast', () => {
  it('flags low contrast text', () => {
    const el = makeElement({
      // text is required for wcag/contrast to run
      text: 'Sample text',
      computedStyles: { color: 'rgb(90, 90, 114)', backgroundColor: 'rgb(6, 6, 17)' },
    });
    const ctx = makeContext({ allElements: [el] });
    const results = runAllRules([el], ctx);
    const contrast = results.filter((r: RuleEngineResult) => r.rule === 'wcag/contrast');
    expect(contrast.length).toBeGreaterThan(0);
  });

  it('passes high contrast text', () => {
    const el = makeElement({
      text: 'Sample text',
      computedStyles: { color: 'rgb(240, 240, 245)', backgroundColor: 'rgb(6, 6, 17)' },
    });
    const ctx = makeContext({ allElements: [el] });
    const results = runAllRules([el], ctx);
    const contrast = results.filter((r: RuleEngineResult) => r.rule === 'wcag/contrast');
    expect(contrast.length).toBe(0);
  });

  it('skips transparent backgrounds', () => {
    const el = makeElement({
      text: 'Sample text',
      computedStyles: { color: 'rgb(90, 90, 114)', backgroundColor: 'transparent' },
    });
    const ctx = makeContext({ allElements: [el] });
    const results = runAllRules([el], ctx);
    const contrast = results.filter((r: RuleEngineResult) => r.rule === 'wcag/contrast');
    expect(contrast.length).toBe(0);
  });
});

describe('touch-targets/minimum-size', () => {
  it('flags small buttons on mobile', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 30, height: 30 },
      // role: 'button' triggers isInteractiveElement — tagName 'div' alone does not
      interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      a11y: { role: 'button', ariaLabel: 'Submit', ariaDescribedBy: null },
    });
    const ctx = makeContext({ isMobile: true, viewportWidth: 375, viewportHeight: 812, allElements: [el] });
    const results = runAllRules([el], ctx);
    const touch = results.filter((r: RuleEngineResult) => r.rule === 'touch-targets/minimum-size');
    expect(touch.length).toBeGreaterThan(0);
  });

  it('passes large buttons on mobile', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 48, height: 48 },
      interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      a11y: { role: 'button', ariaLabel: 'Submit', ariaDescribedBy: null },
    });
    const ctx = makeContext({ isMobile: true, viewportWidth: 375, viewportHeight: 812, allElements: [el] });
    const results = runAllRules([el], ctx);
    const touch = results.filter((r: RuleEngineResult) => r.rule === 'touch-targets/minimum-size');
    expect(touch.length).toBe(0);
  });

  it('does not flag non-interactive elements', () => {
    const el = makeElement({
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      // tagName 'div', no role — not interactive per isInteractiveElement()
    });
    const ctx = makeContext({ isMobile: true, viewportWidth: 375, viewportHeight: 812, allElements: [el] });
    const results = runAllRules([el], ctx);
    const touch = results.filter((r: RuleEngineResult) => r.rule === 'touch-targets/minimum-size');
    expect(touch.length).toBe(0);
  });
});

describe('handler-integrity', () => {
  it('flags elements that look interactive but have no handler', () => {
    const el = makeElement({
      a11y: { role: 'button', ariaLabel: 'Click me', ariaDescribedBy: null },
      // cursor on interactive field triggers looksInteractive()
      interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      computedStyles: { cursor: 'pointer' },
    });
    const ctx = makeContext({ allElements: [el] });
    const results = runAllRules([el], ctx);
    const handler = results.filter((r: RuleEngineResult) => r.rule.startsWith('handler-integrity'));
    expect(handler.length).toBeGreaterThan(0);
  });

  it('passes elements with handlers', () => {
    const el = makeElement({
      a11y: { role: 'button', ariaLabel: 'Submit', ariaDescribedBy: null },
      interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
    });
    const ctx = makeContext({ allElements: [el] });
    const results = runAllRules([el], ctx);
    const handler = results.filter((r: RuleEngineResult) => r.rule === 'handler-integrity/fake-interactive');
    expect(handler.length).toBe(0);
  });
});
