import { describe, it, expect } from 'vitest';
import {
  buildMeasureExpression,
  finalizeMeasurements,
  type RawLiveElement,
} from './measure.js';
import { formatLiveMeasureResult, formatLiveTargets } from './format.js';

function rawElement(over: Partial<RawLiveElement> = {}): RawLiveElement {
  return {
    index: 0,
    tagName: 'button',
    className: 'ws-ai-btn',
    id: '',
    textContent: 'Continue',
    disabled: false,
    ariaDisabled: null,
    bounds: { x: 10, y: 20, width: 96, height: 28, top: 20, right: 106, bottom: 48, left: 10 },
    box: {
      height: '28px', minHeight: '0px', maxHeight: 'none', width: '96px', minWidth: '0px',
      paddingTop: '4px', paddingRight: '10px', paddingBottom: '4px', paddingLeft: '10px',
      marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px',
      borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px',
      borderLeftWidth: '1px', borderRadius: '4px', boxSizing: 'border-box',
    },
    typography: {
      fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: '500',
      lineHeight: '18px', letterSpacing: 'normal', whiteSpace: 'nowrap',
    },
    layout: {
      display: 'inline-flex', position: 'static', alignItems: 'center', alignSelf: 'auto',
      justifyContent: 'center', flexGrow: '0', flexShrink: '1', flexBasis: 'auto',
      gap: 'normal', overflow: 'visible', visibility: 'visible', opacity: '1',
    },
    colorRaw: 'rgb(220, 221, 222)',
    backgroundColorRaw: 'rgba(0, 0, 0, 0)',
    colorNorm: '#dcddde',
    backgroundChain: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', '#1e1e1e'],
    backgroundChainResolved: true,
    firstLineBaselineY: 34.5,
    ...over,
  };
}

describe('buildMeasureExpression', () => {
  it('embeds the selector as escaped JSON so quotes cannot break out', () => {
    const expr = buildMeasureExpression('.ws-actions button[data-x="1"]');
    expect(expr).toContain('var SELECTOR = ".ws-actions button[data-x=\\"1\\"]"');
  });

  it('scopes to querySelectorAll, so containers match as readily as controls', () => {
    // The existing extract path filters to interactive elements only, which is
    // why divs and spans were previously unmeasurable.
    const expr = buildMeasureExpression('.ws-view .ws-actions');
    expect(expr).toContain('document.querySelectorAll(SELECTOR)');
    expect(expr).not.toMatch(/button, \[role/);
  });

  it('honours the element limit', () => {
    expect(buildMeasureExpression('div', 7)).toContain('var LIMIT = 7');
    expect(buildMeasureExpression('div')).toContain('var LIMIT = 200');
  });

  it('collects the box, typography, layout and color properties the audit needs', () => {
    const expr = buildMeasureExpression('button');
    for (const prop of [
      'cs.height', 'cs.minHeight', 'cs.paddingLeft', 'cs.paddingRight',
      'cs.marginTop', 'cs.borderTopWidth', 'cs.boxSizing',
      'cs.fontSize', 'cs.fontFamily', 'cs.fontWeight', 'cs.lineHeight',
      'cs.letterSpacing', 'cs.whiteSpace',
      'cs.display', 'cs.alignItems', 'cs.alignSelf',
      'cs.flexGrow', 'cs.flexShrink', 'cs.flexBasis', 'cs.gap',
      'cs.color', 'cs.backgroundColor',
    ]) {
      expect(expr, prop).toContain(prop);
    }
  });

  it('reads geometry from getBoundingClientRect and walks ancestors for background', () => {
    const expr = buildMeasureExpression('button');
    expect(expr).toContain('el.getBoundingClientRect()');
    expect(expr).toContain('node.parentElement');
  });

  it('derives the baseline from a Range plus font metrics, never a guess', () => {
    const expr = buildMeasureExpression('button');
    expect(expr).toContain('document.createRange()');
    expect(expr).toContain('range.getClientRects()');
    expect(expr).toContain('fontBoundingBoxAscent');
    // Every failure branch returns null rather than an approximation.
    expect(expr).toContain('if (!textNode) return null;');
  });

  it('creates its canvas detached and never appends it to the document', () => {
    const expr = buildMeasureExpression('button');
    expect(expr).toContain("document.createElement('canvas')");
    expect(expr).not.toContain('appendChild');
    expect(expr).not.toContain('document.write');
    expect(expr).not.toContain('.style.');
  });

  it('returns a structured failure instead of throwing on a bad selector', () => {
    expect(buildMeasureExpression('button')).toContain('ok: false');
  });
});

describe('finalizeMeasurements', () => {
  it('resolves a transparent control against the opaque pane behind it', () => {
    const [m] = finalizeMeasurements([rawElement()]);
    expect(m.color.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(m.color.effectiveBackgroundColor).toBe('rgb(30, 30, 30)');
    expect(m.color.effectiveBackgroundResolved).toBe(true);
    expect(m.color.contrastRatio).toBeGreaterThan(10);
    expect(m.color.passesAA).toBe(true);
    expect(m.color.aaThreshold).toBe(4.5);
    expect(m.color.largeText).toBe(false);
  });

  it('composites translucent text over the effective background before grading', () => {
    const [m] = finalizeMeasurements([rawElement({
      colorRaw: 'rgba(220, 221, 222, 0.25)',
      colorNorm: 'rgba(220, 221, 222, 0.25)',
    })]);
    expect(m.color.resolvedTextColor).toMatch(/^rgb\(/);
    // 25%-opacity text on near-black is far dimmer than the raw color implies.
    expect(m.color.contrastRatio).toBeLessThan(3);
    expect(m.color.passesAA).toBe(false);
  });

  it('uses the 3:1 threshold for large bold text', () => {
    const [m] = finalizeMeasurements([rawElement({
      typography: { ...rawElement().typography, fontSize: '20px', fontWeight: '700' },
    })]);
    expect(m.color.largeText).toBe(true);
    expect(m.color.aaThreshold).toBe(3);
  });

  it('reports contrast as null — never NaN — when the color cannot be parsed', () => {
    const [m] = finalizeMeasurements([rawElement({
      colorRaw: 'oklch(0.8 0.1 250)',
      colorNorm: 'oklch(0.8 0.1 250)',
    })]);
    expect(m.color.contrastRatio).toBeNull();
    expect(m.color.passesAA).toBeNull();
    expect(m.color.resolvedTextColor).toBeNull();
  });

  it('flags an assumed background instead of silently pretending it resolved', () => {
    const [m] = finalizeMeasurements([rawElement({
      backgroundChain: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'],
      backgroundChainResolved: false,
    })]);
    expect(m.color.effectiveBackgroundResolved).toBe(false);
    expect(m.color.effectiveBackgroundColor).toBe('rgb(255, 255, 255)');
  });

  it('passes geometry, box, typography, layout and baseline through untouched', () => {
    const raw = rawElement();
    const [m] = finalizeMeasurements([raw]);
    expect(m.bounds).toEqual(raw.bounds);
    expect(m.box).toEqual(raw.box);
    expect(m.typography).toEqual(raw.typography);
    expect(m.layout).toEqual(raw.layout);
    expect(m.firstLineBaselineY).toBe(34.5);
    expect(m.disabled).toBe(false);
  });

  it('keeps a null baseline null rather than substituting a value', () => {
    const [m] = finalizeMeasurements([rawElement({ firstLineBaselineY: null })]);
    expect(m.firstLineBaselineY).toBeNull();
  });

  it('preserves document order across several elements', () => {
    const out = finalizeMeasurements([
      rawElement({ index: 0, textContent: 'First' }),
      rawElement({ index: 1, textContent: 'Second' }),
    ]);
    expect(out.map((e) => e.textContent)).toEqual(['First', 'Second']);
  });
});

describe('formatting', () => {
  const result = {
    ok: true as const,
    wsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/abc',
    cdpUrl: 'http://127.0.0.1:9222',
    target: {
      targetId: 'T1', type: 'page', attached: true,
      title: 'Writers Block - personal-llm-wiki', url: 'app://obsidian.md/index.html',
    },
    selector: '.ws-actions button',
    matched: 2,
    page: {
      title: 'Writers Block', url: 'app://obsidian.md/index.html',
      scrollX: 0, scrollY: 0, innerWidth: 1512, innerHeight: 900, devicePixelRatio: 2,
    },
    measuredAt: '2026-07-30T00:00:00.000Z',
    elements: finalizeMeasurements([
      rawElement({ index: 0, firstLineBaselineY: 34.5 }),
      rawElement({ index: 1, firstLineBaselineY: 36.5 }),
    ]),
  };

  it('renders each element with the numbers the audit turns on', () => {
    const text = formatLiveMeasureResult(result);
    expect(text).toContain('.ws-actions button');
    expect(text).toContain('96x28');
    expect(text).toContain('4px 10px 4px 10px');
    expect(text).toContain('13px/18px');
    expect(text).toContain('rgb(30, 30, 30)');
  });

  it('calls out a baseline mismatch between siblings', () => {
    expect(formatLiveMeasureResult(result)).toContain('spread 2px');
  });

  it('says so plainly when nothing matched', () => {
    const empty = { ...result, matched: 0, elements: [] };
    expect(formatLiveMeasureResult(empty)).toContain('No element matched');
  });

  it('lists targets with type, title, url and id', () => {
    const text = formatLiveTargets([result.target]);
    expect(text).toContain('page');
    expect(text).toContain('personal-llm-wiki');
    expect(text).toContain('T1');
  });
});
