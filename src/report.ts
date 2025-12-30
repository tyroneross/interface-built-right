import type { Session, ComparisonResult, Analysis, ComparisonReport } from './schemas.js';
import { getVerdictDescription } from './compare.js';
import { getSessionPaths } from './session.js';

/**
 * Generate a full comparison report
 */
export function generateReport(
  session: Session,
  comparison: ComparisonResult,
  analysis: Analysis,
  outputDir: string,
  webViewPort?: number
): ComparisonReport {
  const paths = getSessionPaths(outputDir, session.id);

  const report: ComparisonReport = {
    sessionId: session.id,
    sessionName: session.name,
    url: session.url,
    timestamp: new Date().toISOString(),
    viewport: session.viewport,
    comparison,
    analysis,
    files: {
      baseline: paths.baseline,
      current: paths.current,
      diff: paths.diff,
    },
  };

  if (webViewPort) {
    report.webViewUrl = `http://localhost:${webViewPort}/sessions/${session.id}`;
  }

  return report;
}

/**
 * Format report as human-readable text
 */
export function formatReportText(report: ComparisonReport): string {
  const lines: string[] = [];

  lines.push(`Session: ${report.sessionName} (${report.sessionId})`);
  lines.push(`URL: ${report.url}`);
  lines.push(`Viewport: ${report.viewport.name} (${report.viewport.width}x${report.viewport.height})`);
  lines.push('');
  lines.push('Comparison Results:');
  lines.push(`  Match: ${report.comparison.match ? 'Yes' : 'No'}`);
  lines.push(`  Diff: ${report.comparison.diffPercent}% (${report.comparison.diffPixels.toLocaleString()} pixels)`);
  lines.push(`  Threshold: ${report.comparison.threshold}%`);
  lines.push('');
  lines.push(`Verdict: ${report.analysis.verdict}`);
  lines.push(`  ${getVerdictDescription(report.analysis.verdict)}`);
  lines.push('');
  lines.push(`Summary: ${report.analysis.summary}`);

  if (report.analysis.recommendation) {
    lines.push('');
    lines.push(`Recommendation: ${report.analysis.recommendation}`);
  }

  if (report.analysis.unexpectedChanges.length > 0) {
    lines.push('');
    lines.push('Unexpected Changes:');
    for (const change of report.analysis.unexpectedChanges) {
      lines.push(`  - ${change.location}: ${change.description}`);
    }
  }

  lines.push('');
  lines.push('Files:');
  lines.push(`  Baseline: ${report.files.baseline}`);
  lines.push(`  Current: ${report.files.current}`);
  lines.push(`  Diff: ${report.files.diff}`);

  if (report.webViewUrl) {
    lines.push('');
    lines.push(`View in browser: ${report.webViewUrl}`);
  }

  return lines.join('\n');
}

/**
 * Format report as minimal output (for scripts)
 */
export function formatReportMinimal(report: ComparisonReport): string {
  const status = report.comparison.match ? 'PASS' : 'FAIL';
  return `${status} ${report.sessionId} ${report.analysis.verdict} ${report.comparison.diffPercent}%`;
}

/**
 * Format report as JSON
 */
export function formatReportJson(report: ComparisonReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Generate a summary line for session listing
 */
export function formatSessionSummary(session: Session): string {
  const status = session.status.padEnd(8);
  const viewport = `${session.viewport.name}`.padEnd(8);
  const date = new Date(session.createdAt).toLocaleDateString();

  let diffInfo = '';
  if (session.comparison) {
    diffInfo = session.comparison.match
      ? ' (no diff)'
      : ` (${session.comparison.diffPercent}% diff)`;
  }

  return `${session.id}  ${status}  ${viewport}  ${date}  ${session.name}${diffInfo}`;
}
