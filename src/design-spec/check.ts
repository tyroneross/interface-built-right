import type { ContentElement } from '../extract.js';
import type { EnhancedElement } from '../schemas.js';
import type { ScanResult } from '../scan.js';
import { DesignSpecSchema, type DesignElement, type DesignSpec, type NumberRule, type StyleRules, type TextRule } from './schema.js';

type Status = 'pass' | 'fail' | 'free' | 'unmeasurable';

export interface DesignSpecFinding {
  view: string;
  element?: string;
  property: string;
  status: Status;
  expected?: unknown;
  observed?: unknown;
  reason?: string;
}

export interface DesignSpecReport {
  verdict: 'PASS' | 'FAIL' | 'PARTIAL';
  coverage: 'listed' | 'all-scanned';
  counts: Record<Status, number>;
  findings: DesignSpecFinding[];
}

interface Observation {
  role: NonNullable<DesignElement['match']>['role'];
  name: string;
  level?: number;
  text?: string;
  href?: string | null;
  src?: string;
  bounds: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function observations(scan: ScanResult): Observation[] {
  const out: Observation[] = [];
  for (const el of scan.elements.all) {
    if (!isVisible(el.bounds, el.computedStyles, el.a11y.ariaHidden, el.ancestorOpacity)) continue;
    const role = interactiveRole(el);
    if (!role) continue;
    out.push({
      role,
      name: normalizeName(el.a11y.ariaLabel || el.text || ''),
      text: el.text,
      href: el.href,
      bounds: el.bounds,
      styles: el.computedStyles ?? {},
    });
  }
  for (const el of scan.content?.elements ?? []) {
    if (!isVisible(el.bounds, el.computedStyles, el.ariaHidden, el.ancestorOpacity)) continue;
    const role = contentRole(el);
    if (!role) continue;
    out.push({
      role,
      name: normalizeName(role === 'image' ? (el.alt || el.ariaLabel || '') : (el.ariaLabel || el.text || '')),
      level: el.headingLevel,
      text: el.text,
      src: el.src,
      bounds: el.bounds,
      styles: el.computedStyles,
    });
  }
  for (const region of scan.regions ?? []) {
    if (!isVisible(region.bounds, region.computedStyles, region.ariaHidden, region.ancestorOpacity)) continue;
    out.push({ role: 'region', name: normalizeName(region.name), bounds: region.bounds, styles: region.computedStyles });
  }
  return out;
}

function isVisible(
  bounds: { width: number; height: number },
  styles: Record<string, string> | undefined,
  ariaHidden?: boolean,
  ancestorOpacity?: number,
): boolean {
  if (ariaHidden || bounds.width <= 0 || bounds.height <= 0) return false;
  if (styles?.display === 'none' || styles?.visibility === 'hidden' || styles?.visibility === 'collapse') return false;
  if (Number(styles?.opacity ?? '1') <= 0 || (ancestorOpacity !== undefined && ancestorOpacity <= 0)) return false;
  return true;
}

function interactiveRole(el: EnhancedElement): Observation['role'] | undefined {
  const role = el.a11y.role;
  if (role === 'link' || el.tagName === 'a') return 'link';
  if (role === 'button' || el.tagName === 'button') return 'button';
  return undefined;
}

function contentRole(el: ContentElement): Observation['role'] | undefined {
  switch (el.contentKind) {
    case 'heading': return 'heading';
    case 'paragraph': return 'paragraph';
    case 'image': return 'image';
    case 'caption': return 'caption';
    case 'quote': return 'quote';
    default: return undefined;
  }
}

function numericStyle(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : undefined;
}

function circumference(observation: Observation): number | undefined {
  const { width, height } = observation.bounds;
  if (Math.abs(width - height) > 1 || width <= 0) return undefined;
  const radius = observation.styles.borderRadius?.trim();
  if (!radius) return undefined;
  const [horizontalRaw, verticalRaw] = radius.split('/').map(part => part.trim());
  const expand = (raw: string): string[] => {
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return [tokens[0], tokens[0], tokens[0], tokens[0]];
    if (tokens.length === 2) return [tokens[0], tokens[1], tokens[0], tokens[1]];
    if (tokens.length === 3) return [tokens[0], tokens[1], tokens[2], tokens[1]];
    return tokens;
  };
  const radiusPx = (raw: string, size: number): number | undefined => {
    if (raw.endsWith('%')) {
      const value = Number(raw.slice(0, -1));
      return Number.isFinite(value) ? value * size / 100 : undefined;
    }
    if (raw === '0') return 0;
    return numericStyle(raw);
  };
  const horizontal = expand(horizontalRaw);
  const vertical = expand(verticalRaw || horizontalRaw);
  const circular = horizontal.length === 4 && vertical.length === 4 &&
    horizontal.every(value => (radiusPx(value, width) ?? -1) >= width / 2) &&
    vertical.every(value => (radiusPx(value, height) ?? -1) >= height / 2);
  return circular ? Math.PI * width : undefined;
}

function checkText(rule: TextRule, value: string | undefined): { status: Status; reason?: string } {
  if (rule.mode === 'free') return { status: 'free' };
  if (value === undefined) return { status: 'unmeasurable', reason: 'property was not captured' };
  if (rule.mode === 'exact') return { status: value === rule.value ? 'pass' : 'fail' };
  return { status: rule.oneOf.includes(value) ? 'pass' : 'fail' };
}

function checkNumber(rule: NumberRule, value: number | undefined): { status: Status; reason?: string } {
  if (rule.mode === 'free') return { status: 'free' };
  if (value === undefined || !Number.isFinite(value)) return { status: 'unmeasurable', reason: 'property was not captured' };
  if (rule.mode === 'exact') return { status: Math.abs(value - rule.value) <= rule.tolerance ? 'pass' : 'fail' };
  return { status: value >= rule.min && value <= rule.max ? 'pass' : 'fail' };
}

/** Compare one specified view with a scan taken at that view's route and viewport. */
export function checkDesignSpec(input: DesignSpec, viewId: string, scan: ScanResult): DesignSpecReport {
  const spec = DesignSpecSchema.parse(input);
  const view = spec.views.find(v => v.id === viewId);
  if (!view) throw new Error(`Unknown design view: ${viewId}`);
  const findings: DesignSpecFinding[] = [];
  const add = (property: string, status: Status, element?: string, expected?: unknown, observed?: unknown, reason?: string) => {
    findings.push({ view: viewId, element, property, status, expected, observed, reason });
  };

  add('route', scan.route === view.route ? 'pass' : 'fail', undefined, view.route, scan.route);
  add('viewport.width', scan.viewport.width === view.viewport.width ? 'pass' : 'fail', undefined, view.viewport.width, scan.viewport.width);
  add('viewport.height', scan.viewport.height === view.viewport.height ? 'pass' : 'fail', undefined, view.viewport.height, scan.viewport.height);
  if (spec.source.coverage?.skipped.length) {
    add('source.coverage', 'unmeasurable', undefined, 0, spec.source.coverage.skipped,
      'source import skipped visible nodes');
  }
  if (scan.verdict === 'PARTIAL') add('scan', 'unmeasurable', undefined, undefined, scan.partialReason, 'source scan is partial');
  if (view.visibleText) {
    const result = checkText(view.visibleText, scan.visibleText);
    add('visibleText', result.status, undefined, view.visibleText, scan.visibleText, result.reason);
  }

  const measured = observations(scan);
  const matched = new Set<Observation>();
  const boundElements = new Set<Observation>();
  for (const [index, link] of view.navigation.entries()) {
    const allCandidates = measured.filter(o => o.role === 'link' && o.name === normalizeName(link.label));
    const candidates = link.occurrence === undefined ? allCandidates : allCandidates.slice(link.occurrence - 1, link.occurrence);
    if (candidates.length !== 1) {
      add(`navigation.${index}`, candidates.length ? 'unmeasurable' : 'fail', undefined, link.label, candidates.length,
        candidates.length ? 'link label matched multiple links' : 'required link was not found');
      continue;
    }
    matched.add(candidates[0]);
    const result = checkText(link.destination, candidates[0].href ?? undefined);
    add(`navigation.${index}`, result.status, undefined, link.destination, candidates[0].href, result.reason);
  }
  for (const element of view.elements) {
    if (!element.match) {
      add('match', 'unmeasurable', element.id, undefined, undefined, 'element needs a semantic binding');
      continue;
    }
    const match = element.match;
    const allowedNames = new Set([normalizeName(match.name)]);
    if (element.text?.mode === 'bounded') {
      for (const allowed of element.text.oneOf) allowedNames.add(normalizeName(allowed));
    }
    const sameRole = measured.filter(o => o.role === match.role && (match.level === undefined || o.level === match.level));
    let candidates = sameRole.filter(o => allowedNames.has(o.name));
    if (candidates.length === 0 && element.text?.mode === 'free' && sameRole.length === 1) candidates = sameRole;
    if (match.occurrence !== undefined) candidates = candidates.slice(match.occurrence - 1, match.occurrence);
    if (candidates.length !== 1) {
      const needsContent = match.role !== 'link' && match.role !== 'button' && match.role !== 'region';
      const status: Status = candidates.length || (needsContent && !scan.content) || (match.role === 'region' && !scan.regions)
        ? 'unmeasurable' : 'fail';
      add('match', status, element.id, match, candidates.length,
        candidates.length ? 'semantic identity matched multiple elements' : status === 'fail' ? 'required element was not found' : 'content or regions were not captured');
      continue;
    }
    const found = candidates[0];
    if (boundElements.has(found)) {
      add('match', 'fail', element.id, match, found.name, 'required elements cannot share one rendered element');
      continue;
    }
    boundElements.add(found);
    matched.add(found);
    const textRule = (key: string, rule: TextRule | undefined, value: string | undefined) => {
      if (!rule) return;
      if (key === 'text' && scan.textCapture !== 'full' && value && value.length >= (found.role === 'link' || found.role === 'button' ? 100 : 300)) {
        add(key, 'unmeasurable', element.id, rule, value, 'source scan capped text; rescan with fullText');
        return;
      }
      const result = checkText(rule, value);
      add(key, result.status, element.id, rule, value, result.reason);
    };
    const numberRule = (key: string, rule: NumberRule | undefined, value: number | undefined) => {
      if (!rule) return;
      const result = checkNumber(rule, value);
      add(key, result.status, element.id, rule, value, result.reason);
    };

    textRule('text', element.text, found.text);
    textRule('href', element.href, found.href ?? undefined);
    textRule('src', element.src, found.src);
    for (const key of ['x', 'y', 'width', 'height'] as const) numberRule(`geometry.${key}`, element.geometry?.[key], found.bounds[key]);
    numberRule('geometry.circumference', element.geometry?.circumference, circumference(found));

    const style: StyleRules = { ...(found.role === 'heading' ? spec.sharedStyle?.heading : {}), ...element.style };
    const primaryFont = found.styles.fontFamily?.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
    textRule('style.fontFamily', style.fontFamily, primaryFont);
    numberRule('style.fontSize', style.fontSize, numericStyle(found.styles.fontSize));
    textRule('style.fontWeight', style.fontWeight, found.styles.fontWeight);
    textRule('style.color', style.color, found.styles.color);
    textRule('style.backgroundColor', style.backgroundColor, found.styles.backgroundColor);
    textRule('style.backgroundImage', style.backgroundImage, found.styles.backgroundImage);
    numberRule('style.borderRadius', style.borderRadius, numericStyle(found.styles.borderRadius));
  }

  for (const [index, region] of view.freeRegions.entries()) {
    add(`freeRegions.${index}`, 'free', undefined, undefined, undefined, region.name);
    if (view.coverage === 'all-scanned' && !region.bounds) {
      add(`freeRegions.${index}.bounds`, 'unmeasurable', undefined, undefined, undefined,
        'all-scanned coverage needs bounds to locate this free region');
    }
  }
  if (view.coverage === 'all-scanned') {
    const hasUnboundedFreeRegion = view.freeRegions.some(region => !region.bounds);
    if (!scan.content) add('coverage.content', 'unmeasurable', undefined, undefined, undefined, 'content extraction did not run');
    if (!scan.regions) add('coverage.regions', 'unmeasurable', undefined, undefined, undefined, 'named region extraction did not run');
    for (const observed of measured) {
      if (matched.has(observed)) continue;
      const inFreeRegion = view.freeRegions.some(region => region.bounds &&
        observed.bounds.x >= region.bounds.x && observed.bounds.y >= region.bounds.y &&
        observed.bounds.x + observed.bounds.width <= region.bounds.x + region.bounds.width &&
        observed.bounds.y + observed.bounds.height <= region.bounds.y + region.bounds.height);
      if (inFreeRegion) {
        add('coverage.freeRegion', 'free', undefined, undefined, { role: observed.role, name: observed.name });
        continue;
      }
      const status: Status = !observed.name || hasUnboundedFreeRegion ? 'unmeasurable' : 'fail';
      add('coverage.unlisted', status, undefined, undefined,
        { role: observed.role, name: observed.name }, !observed.name ? 'element has no semantic name' :
          hasUnboundedFreeRegion ? 'unbounded free region prevents locating this extra element' : 'semantic element is absent from the spec');
    }
  }

  const counts: Record<Status, number> = { pass: 0, fail: 0, free: 0, unmeasurable: 0 };
  for (const finding of findings) counts[finding.status]++;
  return {
    verdict: counts.fail ? 'FAIL' : counts.unmeasurable ? 'PARTIAL' : 'PASS',
    coverage: view.coverage,
    counts,
    findings,
  };
}
