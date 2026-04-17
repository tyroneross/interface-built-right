import { describe, it, expect } from 'vitest';
import { runSensors } from './index.js';
import { makeElement, makeButton, makeLink, makeCtx } from './test-fixtures.js';

describe('runSensors', () => {
  it('returns all six report fields', () => {
    const result = runSensors(makeCtx([]));
    expect(result).toHaveProperty('visualPatterns');
    expect(result).toHaveProperty('componentCensus');
    expect(result).toHaveProperty('interactionMap');
    expect(result).toHaveProperty('contrast');
    expect(result).toHaveProperty('oneLiners');
    // navigation is optional (may be undefined on empty)
    expect('navigation' in result).toBe(true);
  });

  it('returns empty-ish oneLiners for a clean page with no issues', () => {
    // Single high-contrast text element, one properly-wired button
    const els = [
      makeButton('Submit'),
      makeElement({ text: 'Hello', computedStyles: {
        color: 'rgb(0,0,0)',
        backgroundColor: 'rgb(255,255,255)',
        fontSize: '16',
        fontWeight: '400',
        borderRadius: '0',
        padding: '0',
        cursor: 'default',
        borderWidth: '0',
        borderColor: 'transparent',
      }}),
    ];
    const result = runSensors(makeCtx(els));
    // No contrast failures, no missing handlers, no orphans → no contrast/handler oneLiners
    const contrastLiners = result.oneLiners.filter(l => l.includes('fail WCAG'));
    const handlerLiners = result.oneLiners.filter(l => l.includes('no handler'));
    expect(contrastLiners).toHaveLength(0);
    expect(handlerLiners).toHaveLength(0);
  });

  it('oneLiners contains contrast failure message when violations exist', () => {
    const els = [
      makeElement({
        text: 'Low contrast',
        computedStyles: {
          color: 'rgb(150,150,150)',
          backgroundColor: 'rgb(200,200,200)',
          fontSize: '16',
          fontWeight: '400',
          borderRadius: '0',
          padding: '0',
          cursor: 'default',
          borderWidth: '0',
          borderColor: 'transparent',
        },
      }),
    ];
    const result = runSensors(makeCtx(els));
    expect(result.oneLiners.some(l => l.includes('fail WCAG AA'))).toBe(true);
  });

  it('oneLiners contains missing handler message when interactive elements lack handlers', () => {
    const el = makeElement({
      tagName: 'button',
      text: 'Ghost',
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'default',
      },
    });
    const result = runSensors(makeCtx([el]));
    expect(result.oneLiners.some(l => l.includes('no handler'))).toBe(true);
  });

  it('oneLiners contains orphan message when cursor:pointer elements have no handler', () => {
    const el = makeElement({
      selector: 'div.orphan',
      tagName: 'div',
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
        isDisabled: false,
        tabIndex: -1,
        cursor: 'pointer',
      },
    });
    const result = runSensors(makeCtx([el]));
    expect(result.oneLiners.some(l => l.includes('cursor:pointer') && l.includes('no handler'))).toBe(true);
  });

  it('oneLiners contains navigation summary when links exist', () => {
    const els = [makeLink('Home'), makeLink('About')];
    const result = runSensors(makeCtx(els));
    expect(result.oneLiners.some(l => l.includes('Navigation'))).toBe(true);
  });

  it('visualPatterns is an array', () => {
    const result = runSensors(makeCtx([makeButton('Go')]));
    expect(Array.isArray(result.visualPatterns)).toBe(true);
  });

  it('componentCensus has expected shape', () => {
    const result = runSensors(makeCtx([makeButton('Go')]));
    expect(typeof result.componentCensus.withHandlers).toBe('number');
    expect(typeof result.componentCensus.withoutHandlers).toBe('number');
    expect(Array.isArray(result.componentCensus.orphanInteractive)).toBe(true);
  });

  it('interactionMap has expected shape', () => {
    const result = runSensors(makeCtx([makeButton('Go')]));
    expect(typeof result.interactionMap.total).toBe('number');
    expect(typeof result.interactionMap.withHandlers).toBe('number');
    expect(Array.isArray(result.interactionMap.missingHandlers)).toBe(true);
  });

  it('contrast has expected shape', () => {
    const result = runSensors(makeCtx([]));
    expect(typeof result.contrast.totalChecked).toBe('number');
    expect(Array.isArray(result.contrast.failing)).toBe(true);
  });

  it('does not include semanticState when no semantic context provided', () => {
    const result = runSensors(makeCtx([]));
    expect(result.semanticState).toBeUndefined();
  });
});
