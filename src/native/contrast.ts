import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { promisify } from 'util';
import { PNG } from 'pngjs';
import { contrastRatio, relativeLuminance, type Rgba } from '../live/color.js';
import type { EnhancedElement } from '../schemas.js';

/*
 * Native text contrast, measured from pixels.
 *
 * Accessibility exposes no rendered colours, so this reads the window
 * screenshot under each text element's frame: the most common colour is the
 * background, and the most contrasting colour that covers a real share of the
 * frame is the text. This catches the failure web scans cannot see in native
 * apps: a window painting a fixed dark surface while its labels resolve for the
 * light system appearance (or the reverse).
 *
 * It is an approximation. Anti-aliasing, bezels and icons share the frame, so
 * a reading is a measurement of what is on screen, not of the declared colour.
 */

const execFileAsync = promisify(execFile);

export interface PixelImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RegionMeasurement =
  | { status: 'measured'; foreground: Rgba; background: Rgba; ratio: number }
  | { status: 'unmeasurable'; reason: string };

export type Tone = 'light' | 'dark';

export interface NativeContrastEntry {
  selector: string;
  text: string;
  role: string | null;
  ratio: number;
  foreground: string;
  background: string;
  /** Text darker than the surface behind it. */
  tone: 'dark-on-light' | 'light-on-dark';
}

export interface NativeContrastReport {
  method: 'screenshot-pixels';
  /** AA threshold applied. Native frames carry no font size, so 4.5:1 throughout. */
  threshold: number;
  totalChecked: number;
  pass: number;
  fail: number;
  notMeasured: number;
  failing: NativeContrastEntry[];
  minRatio?: NativeContrastEntry;
}

export interface NativeAppearanceReport {
  /** The macOS system setting. */
  system: Tone | 'unknown';
  /** What the window actually paints, from its dominant colour. */
  surface: Tone;
  surfaceColor: string;
  /** Surface and system disagree. Legitimate for themed apps; a lead when text fails. */
  differsFromSystem: boolean;
}

/** Bits kept per channel when grouping pixels into colours. */
const QUANT_SHIFT = 3;
/** A text colour must cover at least this share of the frame, and this many pixels. */
const MIN_TEXT_SHARE = 0.02;
const MIN_TEXT_PIXELS = 4;
/** Below this ratio against the background a colour is treated as background noise. */
const NOISE_RATIO = 1.05;

const TEXT_ROLES = new Set([
  'text', 'button', 'link', 'radio', 'checkbox', 'tab', 'combobox',
  'heading', 'menuitem', 'switch', 'cell',
]);

export function decodePng(buffer: Buffer): PixelImage {
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

interface Bin { count: number; r: number; g: number; b: number }

function histogram(img: PixelImage, rect: PixelRect): { bins: Map<number, Bin>; total: number } {
  const bins = new Map<number, Bin>();
  let total = 0;
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(img.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(img.height, Math.ceil(rect.y + rect.height));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3] < 128) continue; // transparent window corners
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const key = ((r >> QUANT_SHIFT) << 10) | ((g >> QUANT_SHIFT) << 5) | (b >> QUANT_SHIFT);
      const bin = bins.get(key);
      if (bin) { bin.count++; bin.r += r; bin.g += g; bin.b += b; }
      else bins.set(key, { count: 1, r, g, b });
      total++;
    }
  }
  return { bins, total };
}

function mean(bin: Bin): Rgba {
  return { r: Math.round(bin.r / bin.count), g: Math.round(bin.g / bin.count), b: Math.round(bin.b / bin.count), a: 1 };
}

/** Background = the most common colour; text = the most contrasting colour with real coverage. */
export function measureRegion(img: PixelImage, rect: PixelRect): RegionMeasurement {
  const { bins, total } = histogram(img, rect);
  if (total === 0) return { status: 'unmeasurable', reason: 'frame is outside the captured window' };
  let bgBin: Bin | undefined;
  for (const bin of bins.values()) if (!bgBin || bin.count > bgBin.count) bgBin = bin;
  const background = mean(bgBin!);
  const minCount = Math.max(MIN_TEXT_PIXELS, total * MIN_TEXT_SHARE);
  let best: { color: Rgba; ratio: number } | undefined;
  for (const bin of bins.values()) {
    if (bin === bgBin || bin.count < minCount) continue;
    const color = mean(bin);
    const ratio = contrastRatio(color, background);
    if (ratio < NOISE_RATIO) continue;
    if (!best || ratio > best.ratio) best = { color, ratio };
  }
  if (!best) return { status: 'unmeasurable', reason: 'no text pixels distinct from the background' };
  return { status: 'measured', foreground: best.color, background, ratio: best.ratio };
}

function hex(c: Rgba): string {
  return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function toneOf(c: Rgba): Tone {
  // Mid-grey (#777) sits near luminance 0.18; above it a surface reads as light.
  return relativeLuminance(c) > 0.18 ? 'light' : 'dark';
}

export interface WindowGeometry {
  /** Window size in points. */
  width: number;
  height: number;
  /** Window top-left in AX global points. */
  originX: number;
  originY: number;
}

/**
 * Measure every text-bearing, enabled element. Disabled controls are exempt
 * under WCAG 1.4.3, so they are left out rather than counted as passes.
 */
export function analyzeNativeContrast(
  img: PixelImage,
  window: WindowGeometry,
  elements: EnhancedElement[],
  threshold = 4.5,
): NativeContrastReport {
  const scale = img.width / window.width;
  let pass = 0, fail = 0, notMeasured = 0;
  const failing: NativeContrastEntry[] = [];
  let minRatio: NativeContrastEntry | undefined;
  for (const el of elements) {
    const text = el.text?.trim();
    const role = el.a11y?.role ?? null;
    if (!text || !role || !TEXT_ROLES.has(role) || el.interactive?.isDisabled) continue;
    const { x, y, width, height } = el.bounds;
    if (width < 2 || height < 2) continue;
    const m = measureRegion(img, {
      x: (x - window.originX) * scale,
      y: (y - window.originY) * scale,
      width: width * scale,
      height: height * scale,
    });
    if (m.status !== 'measured') { notMeasured++; continue; }
    const entry: NativeContrastEntry = {
      selector: el.selector,
      text: text.slice(0, 60),
      role,
      ratio: m.ratio,
      foreground: hex(m.foreground),
      background: hex(m.background),
      tone: relativeLuminance(m.foreground) > relativeLuminance(m.background) ? 'light-on-dark' : 'dark-on-light',
    };
    if (m.ratio >= threshold) pass++;
    else { fail++; if (failing.length < 50) failing.push(entry); }
    if (!minRatio || m.ratio < minRatio.ratio) minRatio = entry;
  }
  return { method: 'screenshot-pixels', threshold, totalChecked: pass + fail, pass, fail, notMeasured, failing, minRatio };
}

export function analyzeSurface(img: PixelImage, system: Tone | 'unknown'): NativeAppearanceReport {
  const { bins } = histogram(img, { x: 0, y: 0, width: img.width, height: img.height });
  let top: Bin | undefined;
  for (const bin of bins.values()) if (!top || bin.count > top.count) top = bin;
  const color = top ? mean(top) : { r: 0, g: 0, b: 0, a: 1 };
  const surface = toneOf(color);
  return { system, surface, surfaceColor: hex(color), differsFromSystem: system !== 'unknown' && system !== surface };
}

/** `AppleInterfaceStyle` is "Dark" in dark mode and absent in light mode. */
export async function readSystemAppearance(): Promise<Tone | 'unknown'> {
  if (process.platform !== 'darwin') return 'unknown';
  try {
    const { stdout } = await execFileAsync('defaults', ['read', '-g', 'AppleInterfaceStyle'], { timeout: 3000 });
    return stdout.trim() === 'Dark' ? 'dark' : 'light';
  } catch (err) {
    // `defaults` exits 1 when the key is absent, which is light mode.
    return (err as { code?: number }).code === 1 ? 'light' : 'unknown';
  }
}

export async function readPng(path: string): Promise<PixelImage> {
  return decodePng(await readFile(path));
}
