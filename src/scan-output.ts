import type { ScanResult } from './scan.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OUTPUT_MODES = ['full', 'summary', 'raw', 'compact'];

/** Commander may attach --output to the global directory option instead. */
export function resolveScanOutput(mode = 'full', format?: string, globalOutput?: string) {
  const globalIsMode = format === undefined && OUTPUT_MODES.includes(globalOutput ?? '');
  const resolved = format ?? (globalIsMode ? globalOutput! : mode);
  if (!OUTPUT_MODES.includes(resolved)) {
    throw new Error('Unknown scan output mode. Use full, summary, raw, or compact.');
  }
  return { mode: resolved, directory: globalIsMode ? './.ibr' : globalOutput || './.ibr' };
}

/** Keep every finding and measurement gap; omit only verbose inventories. */
export function compactScanReport(result: ScanResult, fullReport: string) {
  if (!fullReport) throw new Error('Compact output requires a saved full report');
  return {
    schema: 'ibr.scan.compact/v1',
    fullReport,
    url: result.url,
    route: result.route,
    timestamp: result.timestamp,
    viewport: result.viewport,
    verdict: result.verdict,
    partialReason: result.partialReason,
    summary: result.summary,
    issues: result.issues,
    ruleEngine: result.ruleEngine,
    console: result.console,
    rulesApplied: result.rulesApplied,
    contrastCoverage: result.contrastCoverage,
    coverage: result.coverage,
    hydration: result.hydration,
    skeleton: result.skeleton,
    layoutCollisions: result.layoutCollisions,
    layoutOverflow: result.layoutOverflow,
    sensorFindings: result.sensors ? {
      // These findings are not all promoted into ScanResult.issues.
      hierarchy: result.sensors.hierarchy,
      interactionStates: result.sensors.interactionStates?.findings,
      missingHandlers: result.sensors.interactionMap?.missingHandlers,
      orphanInteractive: result.sensors.componentCensus?.orphanInteractive,
      contrast: result.sensors.contrast,
      typography: result.sensors.typography ? {
        font_loading_pending: result.sensors.typography.font_loading_pending,
        data_unavailable: result.sensors.typography.data_unavailable,
      } : undefined,
    } : undefined,
    semantic: result.semantic ? {
      pageIntent: result.semantic.pageIntent,
      state: result.semantic.state,
    } : undefined,
    measured: {
      interactiveElements: result.elements.all.length,
      contentElements: result.content?.elements.length,
    },
  };
}

export async function saveFullScanReport(result: ScanResult, path: string): Promise<string> {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, JSON.stringify(result), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return absolute;
}

/**
 * Apply output mode filtering post-scan.
 * Keeps library API (scan()) unchanged — trimming happens in the CLI layer.
 *
 * full    — default, no change
 * summary — omits elements.all and interactivity.detailedResults; keeps sensors, verdict, issues, rulesApplied, contrastCoverage, console, semantic intent/state (~60% token reduction)
 * raw     — omits sensors; keeps everything else
 */
export function applyOutputMode(result: import('./scan.js').ScanResult, mode: string): Partial<import('./scan.js').ScanResult> {
  if (mode === 'summary') {
    return {
      url: result.url,
      route: result.route,
      timestamp: result.timestamp,
      verdict: result.verdict,
      summary: result.summary,
      issues: result.issues,
      sensors: result.sensors,
      // Summary mode kept `sensors` while dropping BOTH of these. The one mode
      // designed for token-constrained model consumption was therefore the one
      // mode that showed contrast numbers with no way to tell "clean page" from
      // "measured nothing" — the exact ambiguity these fields exist to close.
      // They are two small objects; the ~60% reduction comes from dropping
      // elements.all, not from these.
      rulesApplied: result.rulesApplied,
      contrastCoverage: result.contrastCoverage,
      console: result.console,
      semantic: result.semantic ? {
        pageIntent: (result.semantic as unknown as Record<string, unknown>).pageIntent,
        state: (result.semantic as unknown as Record<string, unknown>).state,
      } as import('./scan.js').ScanResult['semantic'] : undefined,
      coverage: result.coverage,
      hydration: result.hydration,
    };
  }
  if (mode === 'raw') {

    const { sensors: _sensors, ...rest } = result as unknown as Record<string, unknown>;
    return rest as Partial<import('./scan.js').ScanResult>;
  }
  return result;
}

