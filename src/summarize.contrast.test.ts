import { describe, it, expect } from 'vitest';
import { summarizeScan, formatContrastSummaryLine, type ContrastReportEntry } from './summarize.js';
import { makeElement } from './sensors/test-fixtures.js';
import type { EnhancedElement } from './schemas.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTextEl(
  text: string,
  color: string,
  backgroundColor: string,
  overrides: Partial<EnhancedElement> = {}
): EnhancedElement {
  return makeElement({
    text,
    computedStyles: {
      color,
      backgroundColor,
      fontSize: '16',
      fontWeight: '400',
      borderRadius: '0',
      padding: '0',
      cursor: 'default',
      borderWidth: '0',
      borderColor: 'transparent',
    },
    ...overrides,
  });
}

// ─── buildContrastReport (via summarizeScan) ────────────────────────────────

describe('summarizeScan contrastReport — oklch and modern colour spaces', () => {
  it('oklch dark text on light bg passes AA', () => {
    const el = makeTextEl('Hello', 'oklch(0.2 0 0)', 'oklch(0.98 0 0)');
    const entries = summarizeScan([el], 'https://example.com').contrastReport;
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('pass');
    expect(entries[0].ratio).toBeGreaterThan(4.5);
  });

  it('oklch light-gray text on light bg fails AA', () => {
    const el = makeTextEl('Hello', 'oklch(0.7 0 0)', 'oklch(0.98 0 0)');
    const entries = summarizeScan([el], 'https://example.com').contrastReport;
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('fail');
  });

  it('the same element structure under two palettes yields different ratios', () => {
    const elA = makeTextEl('Hello', 'oklch(0.2 0 0)', 'oklch(0.98 0 0)');
    const elB = makeTextEl('Hello', 'oklch(0.5 0 0)', 'oklch(0.55 0 0)');
    const ratioA = summarizeScan([elA], 'https://example.com').contrastReport[0].ratio;
    const ratioB = summarizeScan([elB], 'https://example.com').contrastReport[0].ratio;
    expect(ratioA).not.toBe(ratioB);
  });

  it('measures translucent text against an opaque ancestor, not the assumed white canvas', () => {
    const el = makeTextEl('Hello', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', {
      backgroundChain: ['rgba(0,0,0,0)', 'oklch(0.3 0 0)'],
    });
    const entries = summarizeScan([el], 'https://example.com').contrastReport;
    expect(entries).toHaveLength(1);
    expect(entries[0].status).not.toBe('unknown');
    expect(entries[0].background).not.toBe('rgb(255, 255, 255)');
  });

  it('an unparseable colour produces an unknown entry with a reason, not a silent pass', () => {
    const el = makeTextEl('Hello', 'foo(1)', 'oklch(0.98 0 0)');
    const entries = summarizeScan([el], 'https://example.com').contrastReport;
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('unknown');
    expect(entries[0].ratio).toBe(0);
    expect(entries[0].reason).toContain('unparseable colour');
  });
});

// ─── formatContrastSummaryLine ──────────────────────────────────────────────

describe('formatContrastSummaryLine', () => {
  it('returns null for no entries', () => {
    expect(formatContrastSummaryLine([])).toBeNull();
  });

  it('reports NOT MEASURED when every entry is unknown', () => {
    const entries: ContrastReportEntry[] = [
      {
        status: 'unknown',
        ratio: 0,
        foreground: 'rgb(0,0,0)',
        background: 'foo(1)',
        elementCount: 3,
        sampleElements: [],
        reason: 'unparseable colour: foo(1)',
      },
    ];
    const line = formatContrastSummaryLine(entries);
    expect(line).toContain('NOT MEASURED');
    expect(line).toContain('3');
  });

  it('excludes unknown elements from the pass count when results are mixed', () => {
    const entries: ContrastReportEntry[] = [
      {
        status: 'pass',
        ratio: 21,
        foreground: 'rgb(0, 0, 0)',
        background: 'rgb(255, 255, 255)',
        elementCount: 2,
        sampleElements: [],
      },
      {
        status: 'fail',
        ratio: 1.55,
        foreground: 'rgb(150, 150, 150)',
        background: 'rgb(200, 200, 200)',
        elementCount: 1,
        sampleElements: [],
      },
      {
        status: 'unknown',
        ratio: 0,
        foreground: 'rgb(0,0,0)',
        background: 'foo(1)',
        elementCount: 5,
        sampleElements: [],
        reason: 'unparseable colour: foo(1)',
      },
    ];
    const line = formatContrastSummaryLine(entries);
    expect(line).toBe('Contrast: 2/3 pass WCAG AA, 5 not measured (unparseable colour)');
  });
});
