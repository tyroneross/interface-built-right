import type { SensorContext, ContrastReport, ContrastReportEntry } from './types.js';

// ── Inline WCAG helpers (the preset versions are private to the rules engine) ──

type RGB = [number, number, number];

function parseColor(color: string): RGB | null {
  if (!color || color === 'transparent' || color === 'initial' || color === 'inherit' || color === 'unset') {
    return null;
  }
  const rgbaMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbaMatch) {
    const alpha = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    if (alpha === 0) return null;
    return [parseInt(rgbaMatch[1], 10), parseInt(rgbaMatch[2], 10), parseInt(rgbaMatch[3], 10)];
  }
  const hex6 = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const hex3 = color.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    return [
      parseInt(hex3[1][0], 16) * 17,
      parseInt(hex3[1][1], 16) * 17,
      parseInt(hex3[1][2], 16) * 17,
    ];
  }
  return null;
}

function linearize(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(fg: RGB, bg: RGB): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isLargeText(styles: Record<string, string>): boolean {
  const fontSize = parseFloat(styles.fontSize ?? '');
  if (isNaN(fontSize)) return false;
  const fw = styles.fontWeight ?? '400';
  const isBold = fw === 'bold' || parseInt(fw, 10) >= 700;
  return fontSize >= 18 || (isBold && fontSize >= 14);
}

// ── Sensor ──────────────────────────────────────────────────────────────────

export function collectContrastReport(ctx: SensorContext): ContrastReport {
  let pass = 0;
  let fail = 0;
  let passAAA = 0;
  const failing: ContrastReportEntry[] = [];
  let minRatio: ContrastReportEntry | undefined;
  let lightOnDark = 0;
  let darkOnLight = 0;

  for (const el of ctx.elements) {
    const text = (el.text ?? '').trim();
    if (!text) continue;

    const styles = el.computedStyles;
    if (!styles) continue;

    const fg = parseColor(styles.color ?? '');
    const bg = parseColor(styles.backgroundColor ?? '');
    if (!fg || !bg) continue;

    const large = isLargeText(styles);
    const ratio = contrastRatio(fg, bg);
    const aaThreshold = large ? 3 : 4.5;
    const aaaThreshold = large ? 4.5 : 7;
    const fontSize = parseFloat(styles.fontSize ?? '16') || 16;

    const entry: ContrastReportEntry = {
      selector: el.selector,
      text: text.slice(0, 60),
      ratio: Number(ratio.toFixed(2)),
      pass: ratio >= aaaThreshold ? 'AAA' : ratio >= aaThreshold ? 'AA' : 'FAIL',
      fontSize,
      largeText: large,
    };

    if (ratio >= aaThreshold) {
      pass++;
    } else {
      fail++;
      if (failing.length < 50) failing.push(entry);
    }
    if (ratio >= aaaThreshold) passAAA++;

    if (!minRatio || ratio < minRatio.ratio) minRatio = entry;

    // Tone: average channel brightness to classify fg vs bg
    const fgAvg = (fg[0] + fg[1] + fg[2]) / 3;
    const bgAvg = (bg[0] + bg[1] + bg[2]) / 3;
    if (fgAvg > bgAvg) lightOnDark++; else darkOnLight++;
  }

  return {
    totalChecked: pass + fail,
    pass,
    fail,
    passAAA,
    failing,
    minRatio,
    byTone: { lightOnDark, darkOnLight },
  };
}
