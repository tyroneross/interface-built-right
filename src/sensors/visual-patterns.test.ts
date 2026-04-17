import { describe, it, expect } from 'vitest';
import { collectVisualPatterns } from './visual-patterns.js';
import { makeElement, makeButton, makeCtx } from './test-fixtures.js';

describe('collectVisualPatterns', () => {
  it('returns empty array for empty elements', () => {
    const result = collectVisualPatterns(makeCtx([]));
    expect(result).toEqual([]);
  });

  it('returns empty array when no categorizable elements (only plain divs)', () => {
    const els = [
      makeElement({ tagName: 'div', text: 'hello' }),
      makeElement({ tagName: 'span', text: 'world' }),
    ];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result).toEqual([]);
  });

  it('two buttons with same styles produce one group with count=2', () => {
    const sharedStyles = {
      backgroundColor: 'rgb(0, 0, 255)',
      color: 'rgb(255, 255, 255)',
      borderRadius: '4px',
      padding: '8px 16px',
      fontSize: '14',
      fontWeight: '400',
      borderWidth: '0',
      borderColor: 'transparent',
    };
    const els = [
      makeButton('Save', { computedStyles: sharedStyles }),
      makeButton('Cancel', { computedStyles: sharedStyles }),
    ];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result).toHaveLength(1);
    const report = result[0];
    expect(report.category).toBe('button');
    expect(report.totalElements).toBe(2);
    expect(report.distinctPatterns).toBe(1);
    expect(report.groups[0].count).toBe(2);
  });

  it('two buttons with different bgColor produce two distinct groups', () => {
    const base = {
      color: 'rgb(255, 255, 255)',
      borderRadius: '4px',
      padding: '8px',
      fontSize: '14',
      fontWeight: '400',
      borderWidth: '0',
      borderColor: 'transparent',
    };
    const els = [
      makeButton('Primary', { computedStyles: { ...base, backgroundColor: 'rgb(0, 0, 255)' } }),
      makeButton('Danger', { computedStyles: { ...base, backgroundColor: 'rgb(255, 0, 0)' } }),
    ];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result).toHaveLength(1);
    const report = result[0];
    expect(report.totalElements).toBe(2);
    expect(report.distinctPatterns).toBe(2);
    expect(report.groups).toHaveLength(2);
  });

  it('category: tagName=a → link', () => {
    const els = [makeElement({ tagName: 'a', text: 'Home' })];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('link');
  });

  it('category: tagName=h1 → heading', () => {
    const els = [makeElement({ tagName: 'h1', text: 'Title' })];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('heading');
  });

  it('category: tagName=h3 → heading', () => {
    const els = [makeElement({ tagName: 'h3', text: 'Sub' })];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result[0].category).toBe('heading');
  });

  it('category: tagName=input → input', () => {
    const els = [makeElement({ tagName: 'input', text: '' })];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('input');
  });

  it('category: tagName=button → button', () => {
    const els = [makeButton('Click')];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result[0].category).toBe('button');
  });

  it('dominant set when >80% share one pattern', () => {
    // 9 buttons same style, 1 with different style → 90% share → dominant
    const sharedStyles = {
      backgroundColor: 'rgb(0, 0, 255)',
      color: 'rgb(255, 255, 255)',
      borderRadius: '4px',
      padding: '8px',
      fontSize: '14',
      fontWeight: '400',
      borderWidth: '0',
      borderColor: 'transparent',
    };
    const els = [
      ...Array.from({ length: 9 }, (_, i) => makeButton(`Btn${i}`, { computedStyles: sharedStyles })),
      makeButton('Other', { computedStyles: { ...sharedStyles, backgroundColor: 'rgb(255, 0, 0)' } }),
    ];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result[0].dominant).toBeDefined();
    expect(result[0].dominant!.count).toBe(9);
  });

  it('dominant undefined when 50/50 split', () => {
    const styles1 = {
      backgroundColor: 'rgb(0, 0, 255)',
      color: 'rgb(255, 255, 255)',
      borderRadius: '0',
      padding: '0',
      fontSize: '14',
      fontWeight: '400',
      borderWidth: '0',
      borderColor: 'transparent',
    };
    const styles2 = { ...styles1, backgroundColor: 'rgb(255, 0, 0)' };
    const els = [
      makeButton('A', { computedStyles: styles1 }),
      makeButton('B', { computedStyles: styles2 }),
    ];
    const result = collectVisualPatterns(makeCtx(els));
    expect(result[0].dominant).toBeUndefined();
  });

  it('separate reports per category when both buttons and links present', () => {
    const els = [
      makeButton('Save'),
      makeElement({ tagName: 'a', text: 'Home' }),
    ];
    const result = collectVisualPatterns(makeCtx(els));
    const categories = result.map(r => r.category);
    expect(categories).toContain('button');
    expect(categories).toContain('link');
  });
});
