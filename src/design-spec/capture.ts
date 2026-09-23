import type { ScanResult } from '../scan.js';
import { designObservations, type DesignObservation } from './check.js';
import { DesignSpecSchema, type DesignElement, type DesignSpec, type NumberRule, type StyleRules, type TextRule } from './schema.js';

export interface CaptureOptions {
  title: string;
  viewId: string;
  route: string;
  /** Draft geometry is free by default. Exact/bounded measurements need an explicit choice. */
  geometry?: 'free' | 'exact' | 'bounded';
  tolerance?: number;
  range?: number;
  copy?: 'exact' | 'free';
}

function validateOptions(options: CaptureOptions): void {
  if (!options.title.trim() || !options.viewId.trim() || !options.route.startsWith('/')) {
    throw new Error('title and view ID are required; route must begin with /');
  }
  if (options.geometry === 'exact' && (options.tolerance === undefined || !Number.isFinite(options.tolerance) || options.tolerance < 0)) {
    throw new Error('exact geometry requires a nonnegative --tolerance');
  }
  if (options.geometry === 'bounded' && (options.range === undefined || !Number.isFinite(options.range) || options.range < 0)) {
    throw new Error('bounded geometry requires a nonnegative --range');
  }
}

function measuredNumber(value: number, label: string, options: CaptureOptions): NumberRule {
  if (options.geometry === 'exact') return { mode: 'exact', value, tolerance: options.tolerance! };
  if (options.geometry === 'bounded') return { mode: 'bounded', min: value - options.range!, max: value + options.range! };
  return { mode: 'free', guidance: `Observed ${label}: ${value} CSS px. Choose exact or bounded after review.` };
}

function capturedText(value: string, options: CaptureOptions): TextRule {
  return options.copy === 'free'
    ? { mode: 'free', guidance: `Observed illustrative copy: ${value}` }
    : { mode: 'exact', value };
}

function cssPixels(value: string | undefined): number | undefined {
  const match = value?.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : undefined;
}

function elementFromObservation(observed: DesignObservation, index: number, occurrence: number | undefined, options: CaptureOptions): DesignElement {
  const element: DesignElement = {
    id: `${observed.role}-${index + 1}`,
    match: { role: observed.role, name: observed.name, ...(observed.level ? { level: observed.level } : {}),
      ...(options.copy === 'free' ? { binding: 'role-order' as const } : {}),
      ...(occurrence ? { occurrence } : {}) },
    geometry: {
      x: measuredNumber(observed.bounds.x, 'x', options),
      y: measuredNumber(observed.bounds.y, 'y', options),
      width: measuredNumber(observed.bounds.width, 'width', options),
      height: measuredNumber(observed.bounds.height, 'height', options),
    },
  };
  if (observed.text) element.text = capturedText(observed.text, options);
  if (observed.href) element.href = { mode: 'exact', value: observed.href };
  const style: StyleRules = {};
  const paint = observed.styles.backgroundColor;
  if (paint && !['transparent', 'rgba(0, 0, 0, 0)', 'rgb(0 0 0 / 0)'].includes(paint)) {
    style.backgroundColor = { mode: 'free', guidance: `Observed surface fill: ${paint}. Promote after review.` };
  }
  for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
    const widthKey = `border${side}Width` as const;
    const colorKey = `border${side}Color` as const;
    const width = cssPixels(observed.styles[widthKey]);
    if (!width || width <= 0) continue;
    style[widthKey] = { mode: 'free', guidance: `Observed ${side.toLowerCase()} edge width: ${width} CSS px. Promote after review.` };
    if (observed.styles[colorKey]) style[colorKey] = {
      mode: 'free', guidance: `Observed ${side.toLowerCase()} edge color: ${observed.styles[colorKey]}. Promote after review.`,
    };
  }
  const radius = cssPixels(observed.styles.borderRadius);
  if (radius && radius > 0) style.borderRadius = {
    mode: 'free', guidance: `Observed corner radius: ${radius} CSS px. Promote after review.`,
  };
  if (observed.styles.boxShadow && observed.styles.boxShadow !== 'none') {
    style.boxShadow = { mode: 'free', guidance: `Observed shadow: ${observed.styles.boxShadow}. Promote after review.` };
  }
  const outlineWidth = cssPixels(observed.styles.outlineWidth);
  if (outlineWidth && outlineWidth > 0 && observed.styles.outlineStyle !== 'none') {
    style.outlineWidth = { mode: 'free', guidance: `Observed focus outline width: ${outlineWidth} CSS px. Promote after review.` };
    if (observed.styles.outlineColor) style.outlineColor = {
      mode: 'free', guidance: `Observed focus outline color: ${observed.styles.outlineColor}. Promote after review.`,
    };
  }
  if (observed.role === 'heading') {
    const primaryFont = observed.styles.fontFamily?.split(',')[0]?.trim().replace(/^["']|["']$/g, '');
    const fontSize = cssPixels(observed.styles.fontSize);
    if (primaryFont) style.fontFamily = { mode: 'free', guidance: `Observed heading font: ${primaryFont}. Set a shared rule after review.` };
    if (fontSize) style.fontSize = { mode: 'free', guidance: `Observed heading size: ${fontSize} CSS px. Set a shared rule after review.` };
    if (observed.styles.fontWeight) style.fontWeight = {
      mode: 'free', guidance: `Observed heading weight: ${observed.styles.fontWeight}. Set a shared rule after review.`,
    };
  }
  if (Object.keys(style).length) element.style = style;
  return element;
}

/** Start an IBR design contract directly, with no external design file. */
export function newDesignSpec(options: Pick<CaptureOptions, 'title' | 'viewId' | 'route'> & { width: number; height: number }): DesignSpec {
  if (!options.title.trim() || !options.viewId.trim() || !options.route.startsWith('/') ||
      !Number.isFinite(options.width) || options.width <= 0 || !Number.isFinite(options.height) || options.height <= 0) {
    throw new Error('title and view ID are required; route must begin with /; viewport dimensions must be positive');
  }
  return DesignSpecSchema.parse({
    version: 1, title: options.title, source: { kind: 'authored', reviewed: false },
    views: [{
      id: options.viewId, route: options.route, viewport: { width: options.width, height: options.height },
      coverage: 'all-scanned', visibleText: { mode: 'exact', value: options.title },
      navigation: [], elements: [{ id: 'page-title', match: { role: 'heading', name: options.title, level: 1 },
        text: { mode: 'exact', value: options.title } }],
      freeRegions: [],
    }],
  });
}

/** Capture a rendered prototype as a reviewable draft; a source scan is evidence, not design authority. */
export function captureDesignSpec(scan: ScanResult, options: CaptureOptions): DesignSpec {
  validateOptions(options);
  if (scan.textCapture !== 'full' || scan.visibleText === undefined || !scan.content || !scan.regions) {
    throw new Error('capture requires an IBR scan with content and fullText enabled');
  }
  if (!Number.isFinite(scan.viewport.width) || !Number.isFinite(scan.viewport.height)) {
    throw new Error('capture requires a measured viewport');
  }
  const observed = designObservations(scan);
  const totals = new Map<string, number>();
  for (const item of observed) {
    const key = `${item.role}\0${item.name}\0${item.level ?? ''}`;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const seenRoles = new Map<string, number>();
  const elements: DesignElement[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const navigation: Array<{ label: string; binding?: 'role-order'; occurrence?: number; destination: TextRule }> = [];
  for (const [index, item] of observed.entries()) {
    const roleKey = `${item.role}\0${item.level ?? ''}`;
    const roleOccurrence = (seenRoles.get(roleKey) ?? 0) + 1;
    seenRoles.set(roleKey, roleOccurrence);
    if (!item.name) {
      skipped.push({ id: `${item.role}-${index + 1}`, reason: 'visible semantic element has no accessible name' });
      continue;
    }
    const key = `${item.role}\0${item.name}\0${item.level ?? ''}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const numbered = options.copy === 'free' ? roleOccurrence : (totals.get(key) ?? 0) > 1 ? occurrence : undefined;
    elements.push(elementFromObservation(item, index, numbered, options));
    if (item.role === 'link' && item.href) {
      navigation.push({ label: item.name,
        ...(options.copy === 'free' ? { binding: 'role-order' as const } : {}),
        ...(numbered ? { occurrence: numbered } : {}),
        destination: { mode: 'exact', value: item.href } });
    }
  }
  for (const [index, gap] of (scan.coverage?.gaps ?? []).entries()) {
    skipped.push({ id: `coverage-gap-${index + 1}`, reason: gap });
  }
  return DesignSpecSchema.parse({
    version: 1, title: options.title,
    source: { kind: 'authored', ref: scan.url, reviewed: false,
      coverage: { considered: observed.length + (scan.coverage?.gaps.length ?? 0), imported: elements.length, skipped } },
    views: [{
      id: options.viewId, route: options.route,
      viewport: { width: scan.viewport.width, height: scan.viewport.height },
      coverage: 'all-scanned', visibleText: capturedText(scan.visibleText, options),
      navigation, elements, freeRegions: [],
    }],
  });
}
