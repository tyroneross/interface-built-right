import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ScanResult } from './scan.js';
import { applyOutputMode, compactScanReport, saveFullScanReport, resolveScanOutput } from './scan-output.js';
import { Command } from 'commander';

function fixture(): ScanResult {
  return {
    url: 'http://localhost/example', route: '/example', timestamp: '2026-01-01T00:00:00Z',
    viewport: { width: 390, height: 844 }, verdict: 'PARTIAL',
    partialReason: 'Content still loading', summary: 'One broken control; incomplete coverage',
    elements: { all: Array.from({ length: 1000 }, (_, i) => ({
      selector: `button:nth-child(${i})`, text: `Action ${i}`, computedStyles: { padding: '16px' },
    })), audit: {} },
    interactivity: { detailedResults: Array.from({ length: 1000 }, (_, i) => ({ label: `Action ${i}` })) },
    sensors: { componentCensus: Array.from({ length: 1000 }, (_, i) => ({ name: `component-${i}` })) },
    semantic: { pageIntent: { intent: 'form' }, state: { loading: { loading: true } } },
    issues: [{ category: 'interactivity', severity: 'error', element: 'button', description: 'No handler', fix: 'Wire the control' }],
    ruleEngine: [{ rule: 'contrast', severity: 'error', element: 'p', expected: 'readable', actual: 'low contrast', evidence: { ratio: 2 } }],
    console: { errors: ['Render failed'], warnings: ['Content incomplete'] },
    rulesApplied: { presets: ['wcag-contrast'], source: 'default', gradedContentElements: 2, contentExtractionFailed: 'timeout' },
    contrastCoverage: { measured: 2, excluded: [{ reason: 'transparent overlay' }] },
    coverage: { gaps: ['cross-origin frame'] }, hydration: { timedOut: true, reason: 'timeout' },
    skeleton: { persistent: true, count: 1 },
    layoutCollisions: { hasCollisions: true, collisions: [{ element1: { selector: 'a' }, element2: { selector: 'b' } }] },
    layoutOverflow: [{ selector: 'p', detail: 'Clipped text' }],
    visibleText: 'Complete evidence only', probes: { custom: { failed: true } },
  } as unknown as ScanResult;
}

describe('compact scan output', () => {
  it.each([
    [['scan', 'http://localhost', '--output', 'compact'], 'compact', './.ibr'],
    [['scan', 'http://localhost', '--output', 'summary'], 'summary', './.ibr'],
    [['-o', '/private/reports', 'scan', 'http://localhost', '--format', 'compact'], 'compact', '/private/reports'],
    [['-o', 'compact', 'scan', 'http://localhost', '--format', 'compact'], 'compact', 'compact'],
    [['scan', 'http://localhost'], 'full', './.ibr'],
  ])('resolves actual Commander argument routing: %j', (args, mode, directory) => {
    const program = new Command().option('-o, --output <dir>', 'directory', './.ibr');
    let result;
    program.command('scan <url>').option('--output <mode>', 'mode', 'full')
      .option('--format <mode>').action((_url, options) => {
        result = resolveScanOutput(options.output, options.format, program.opts().output);
      });
    program.parse(args as string[], { from: 'user' });
    expect(result).toEqual({ mode, directory });
  });

  it('rejects unknown formats before launching a browser', () => {
    expect(() => resolveScanOutput('full', 'tiny')).toThrow('Unknown scan output mode');
  });

  it('keeps sensor-only findings even when the aggregate issue list is empty', () => {
    const input = fixture();
    input.issues = [];
    input.sensors = {
      hierarchy: { h1: { count: 0, finding: 'no_h1' }, level_skips: [{ from: 'h1', to: 'h3' }] },
      interactionStates: { findings: [{ selector: 'button', missing: 'focus_indicator' }] },
      interactionMap: { missingHandlers: [{ selector: 'button' }] },
      componentCensus: { orphanInteractive: [{ selector: 'div' }] },
      contrast: { fail: 1, notMeasured: 2, failing: [{ selector: 'p', ratio: 2 }] },
      typography: { font_loading_pending: true, data_unavailable: true },
    } as unknown as ScanResult['sensors'];
    const output = compactScanReport(input, '/private/full.json');
    expect(output.sensorFindings).toEqual({
      hierarchy: input.sensors!.hierarchy,
      interactionStates: input.sensors!.interactionStates?.findings,
      missingHandlers: input.sensors!.interactionMap.missingHandlers,
      orphanInteractive: input.sensors!.componentCensus.orphanInteractive,
      contrast: input.sensors!.contrast,
      typography: { font_loading_pending: true, data_unavailable: true },
    });
  });
  it('retains every failure, partial-state explanation and coverage gap', () => {
    const input = fixture();
    const output = compactScanReport(input, '/private/full.json');
    for (const key of ['verdict', 'partialReason', 'issues', 'ruleEngine', 'console', 'rulesApplied',
      'contrastCoverage', 'coverage', 'hydration', 'skeleton', 'layoutCollisions', 'layoutOverflow'] as const) {
      expect(output[key]).toEqual(input[key]);
    }
    expect(output.semantic).toEqual(input.semantic);
    expect(output.measured.interactiveElements).toBe(1000);
    expect(output).not.toHaveProperty('sensors');
    expect(JSON.stringify(output).length).toBeLessThan(JSON.stringify(input).length / 10);
  });

  it('keeps unmeasured coverage absent rather than claiming zero failures', () => {
    const input = fixture();
    delete input.contrastCoverage;
    delete input.rulesApplied;
    const output = JSON.parse(JSON.stringify(compactScanReport(input, '/private/full.json')));
    expect(output).not.toHaveProperty('contrastCoverage');
    expect(output).not.toHaveProperty('rulesApplied');
    expect(output.verdict).toBe('PARTIAL');
    expect(() => compactScanReport(input, '')).toThrow('saved full report');
  });

  it('saves complete evidence including inventories and custom probes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ibr-report-test-'));
    try {
      const input = fixture();
      const path = await saveFullScanReport(input, join(dir, 'nested', 'full.json'));
      expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(input);
      expect(compactScanReport(input, path).fullReport).toBe(path);
      await expect(saveFullScanReport({ ...input, verdict: 'PASS' }, path)).rejects.toThrow();
      expect(JSON.parse(await readFile(path, 'utf8')).verdict).toBe('PARTIAL');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it('preserves the existing full, summary and raw modes', () => {
    const input = fixture();
    expect(applyOutputMode(input, 'full')).toBe(input);
    expect(applyOutputMode(input, 'raw')).not.toHaveProperty('sensors');
    const summary = applyOutputMode(input, 'summary');
    expect(summary.sensors).toEqual(input.sensors);
    expect(summary.rulesApplied).toEqual(input.rulesApplied);
    expect(summary.contrastCoverage).toEqual(input.contrastCoverage);
    expect(summary).not.toHaveProperty('elements');
  });
});
