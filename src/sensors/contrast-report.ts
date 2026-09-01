import type { SensorContext, ContrastReport, ContrastReportEntry } from './types.js';
import { measureElementContrast } from '../rules/contrast-measure.js';

/*
 * THIS FILE USED TO BE THE THIRD CONTRAST IMPLEMENTATION.
 *
 * It carried its own parseColor / linearize / luminance / contrastRatio /
 * isLargeText, and reproduced the exact defect the rule lanes were fixed for:
 * it read only `styles.backgroundColor` with no ancestor chain, and
 * `if (!fg || !bg) continue` skipped every element whose background computed to
 * `rgba(0, 0, 0, 0)` — which is nearly all text on a real page. Its
 * `totalChecked` therefore reported ~0 while looking like a completed audit.
 * It also still used the superseded large-text thresholds (18px / 14px bold
 * instead of 24px / 18.66px), so the two lanes disagreed about which
 * requirement applied even when both did measure.
 *
 * That mattered more than a third copy normally would: `--output summary`
 * KEEPS `sensors` while dropping `issues`-side detail, so the token-cheap mode
 * surfaced this lane's false-clean accounting to models and humans alike.
 *
 * It now calls the one `measureElementContrast` in ../rules/contrast-measure.ts.
 * Do not reintroduce local color math here.
 */

export function collectContrastReport(ctx: SensorContext): ContrastReport {
  let pass = 0;
  let fail = 0;
  let passAAA = 0;
  let notMeasured = 0;
  let assumedBackground = 0;
  const failing: ContrastReportEntry[] = [];
  let minRatio: ContrastReportEntry | undefined;
  let lightOnDark = 0;
  let darkOnLight = 0;

  for (const el of ctx.elements) {
    const m = measureElementContrast(el);

    // A color we could not decode is a MEASUREMENT GAP, not a skip. Counting it
    // separately is what lets a reader tell "this page is clean" apart from
    // "this sensor could not look at this page".
    if (m.status === 'unmeasurable') {
      notMeasured++;
      continue;
    }
    if (m.status !== 'measured') continue;

    if (!m.backgroundResolved) assumedBackground++;

    const styles = el.computedStyles ?? {};
    const aaThreshold = m.large ? 3 : 4.5;
    const aaaThreshold = m.large ? 4.5 : 7;
    const fontSize = parseFloat(styles.fontSize ?? '16') || 16;
    const ratio = m.ratio;

    const entry: ContrastReportEntry = {
      selector: el.selector,
      text: m.text.slice(0, 60),
      ratio: Number(ratio.toFixed(2)),
      pass: ratio >= aaaThreshold ? 'AAA' : ratio >= aaThreshold ? 'AA' : 'FAIL',
      fontSize,
      largeText: m.large,
    };

    if (ratio >= aaThreshold) {
      pass++;
    } else {
      fail++;
      if (failing.length < 50) failing.push(entry);
    }
    if (ratio >= aaaThreshold) passAAA++;

    if (!minRatio || ratio < minRatio.ratio) minRatio = entry;

    // Tone: compare the text against the background actually behind it.
    const fgAvg = m.foreground[0] + m.foreground[1] + m.foreground[2];
    const bgAvg = m.background[0] + m.background[1] + m.background[2];
    if (fgAvg > bgAvg) lightOnDark++; else darkOnLight++;
  }

  return {
    totalChecked: pass + fail,
    pass,
    fail,
    passAAA,
    notMeasured,
    assumedBackground,
    failing,
    minRatio,
    byTone: { lightOnDark, darkOnLight },
  };
}
