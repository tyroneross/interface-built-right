import { describe, it, expect } from 'vitest';
import { collectComponentCensus } from './component-census.js';
import { makeElement, makeButton, makeCtx } from './test-fixtures.js';

describe('collectComponentCensus', () => {
  it('returns zeroed counts for empty elements', () => {
    const result = collectComponentCensus(makeCtx([]));
    expect(result.byTag).toEqual({});
    expect(result.byRole).toEqual({});
    expect(result.withHandlers).toBe(0);
    expect(result.withoutHandlers).toBe(0);
    expect(result.orphanInteractive).toHaveLength(0);
  });

  it('counts tags correctly', () => {
    const els = [
      makeElement({ tagName: 'div' }),
      makeElement({ tagName: 'div' }),
      makeElement({ tagName: 'span' }),
    ];
    const result = collectComponentCensus(makeCtx(els));
    expect(result.byTag.div).toBe(2);
    expect(result.byTag.span).toBe(1);
  });

  it('counts roles correctly', () => {
    const els = [
      makeButton('A'),
      makeButton('B'),
      makeElement({ a11y: { role: 'link', ariaLabel: null, ariaDescribedBy: null } }),
    ];
    const result = collectComponentCensus(makeCtx(els));
    expect(result.byRole.button).toBe(2);
    expect(result.byRole.link).toBe(1);
  });

  it('does not count null role in byRole', () => {
    const els = [makeElement({ a11y: { role: null, ariaLabel: null, ariaDescribedBy: null } })];
    const result = collectComponentCensus(makeCtx(els));
    expect(Object.keys(result.byRole)).toHaveLength(0);
  });

  it('withHandlers counts elements with hasOnClick', () => {
    const els = [
      makeButton('Click'),
      makeElement(),
    ];
    const result = collectComponentCensus(makeCtx(els));
    expect(result.withHandlers).toBe(1);
    expect(result.withoutHandlers).toBe(1);
  });

  it('withHandlers counts hasHref', () => {
    const els = [
      makeElement({
        interactive: {
          hasOnClick: false,
          hasHref: true,
          isDisabled: false,
          tabIndex: 0,
          cursor: 'pointer',
        },
      }),
    ];
    const result = collectComponentCensus(makeCtx(els));
    expect(result.withHandlers).toBe(1);
  });

  it('withHandlers counts hasReactHandler', () => {
    const els = [
      makeElement({
        interactive: {
          hasOnClick: false,
          hasHref: false,
          hasReactHandler: true,
          isDisabled: false,
          tabIndex: 0,
          cursor: 'default',
        },
      }),
    ];
    const result = collectComponentCensus(makeCtx(els));
    expect(result.withHandlers).toBe(1);
  });

  it('orphanInteractive picks up cursor:pointer WITHOUT any handler', () => {
    const el = makeElement({
      selector: 'div.orphan',
      text: 'Click me',
      computedStyles: {
        color: 'rgb(0,0,0)',
        backgroundColor: 'rgb(255,255,255)',
        fontSize: '16',
        fontWeight: '400',
        borderRadius: '0',
        padding: '0',
        cursor: 'pointer',
        borderWidth: '0',
        borderColor: 'transparent',
      },
      interactive: {
        hasOnClick: false,
        hasHref: false,
        hasReactHandler: false,
        hasVueHandler: false,
        hasAngularHandler: false,
        isDisabled: false,
        tabIndex: -1,
        cursor: 'pointer',
      },
    });
    const result = collectComponentCensus(makeCtx([el]));
    expect(result.orphanInteractive).toHaveLength(1);
    expect(result.orphanInteractive[0].selector).toBe('div.orphan');
    expect(result.orphanInteractive[0].reason).toBe('cursor:pointer with no handler');
  });

  it('orphanInteractive does NOT pick up cursor:pointer WITH handler', () => {
    const el = makeElement({
      text: 'Click me',
      computedStyles: {
        color: 'rgb(0,0,0)',
        backgroundColor: 'rgb(255,255,255)',
        fontSize: '16',
        fontWeight: '400',
        borderRadius: '0',
        padding: '0',
        cursor: 'pointer',
        borderWidth: '0',
        borderColor: 'transparent',
      },
      interactive: {
        hasOnClick: true,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'pointer',
      },
    });
    const result = collectComponentCensus(makeCtx([el]));
    expect(result.orphanInteractive).toHaveLength(0);
  });

  it('orphanInteractive does NOT pick up cursor:pointer with empty text', () => {
    const el = makeElement({
      text: '',
      computedStyles: {
        color: 'rgb(0,0,0)',
        backgroundColor: 'rgb(255,255,255)',
        fontSize: '16',
        fontWeight: '400',
        borderRadius: '0',
        padding: '0',
        cursor: 'pointer',
        borderWidth: '0',
        borderColor: 'transparent',
      },
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: -1,
        cursor: 'pointer',
      },
    });
    const result = collectComponentCensus(makeCtx([el]));
    expect(result.orphanInteractive).toHaveLength(0);
  });

  it('caps orphanInteractive at 20 entries', () => {
    const orphans = Array.from({ length: 25 }, (_, i) =>
      makeElement({
        selector: `div.orphan-${i}`,
        text: `Item ${i}`,
        computedStyles: {
          color: 'rgb(0,0,0)',
          backgroundColor: 'rgb(255,255,255)',
          fontSize: '16',
          fontWeight: '400',
          borderRadius: '0',
          padding: '0',
          cursor: 'pointer',
          borderWidth: '0',
          borderColor: 'transparent',
        },
        interactive: {
          hasOnClick: false,
          hasHref: false,
          isDisabled: false,
          tabIndex: -1,
          cursor: 'pointer',
        },
      })
    );
    const result = collectComponentCensus(makeCtx(orphans));
    expect(result.orphanInteractive.length).toBeLessThanOrEqual(20);
  });
});
