/**
 * Coordinate helpers for native element interaction
 *
 * These utilities bridge the gap between AX element data (frames with x/y/width/height)
 * and the coordinate-based IDB interaction API.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ensureExtractor } from './extract.js';
import { mapRoleToAriaRole } from './role-map.js';
import type { MacOSAXElement, NativeElement } from './types.js';

const execFileAsync = promisify(execFile);

// ─── AX Action Types ──────────────────────────────────────

export type NativeAction =
  | 'press'
  | 'setValue'
  | 'increment'
  | 'decrement'
  | 'showMenu'
  | 'confirm'
  | 'cancel'
  | 'focus'
  | 'scrollToVisible';

export interface NativeActionOptions {
  pid: number;
  deviceName?: string;
  elementPath: number[];
  action: NativeAction;
  value?: string;
}

export interface NativeActionResult {
  success: boolean;
  action: string;
  error?: string;
}

export interface NativeElementCandidate {
  path?: number[];
  role: string;
  label: string;
  identifier?: string | null;
  value?: string | null;
  enabled: boolean;
  actions: string[];
  frame?: { x: number; y: number; width: number; height: number };
}

export interface NativeElementResolution {
  element: NativeElementCandidate;
  confidence: number;
  tier: 'identifier' | 'label' | 'value' | 'contains';
  alternatives: Array<{
    label: string;
    role: string;
    identifier?: string | null;
    confidence: number;
  }>;
  totalCandidates: number;
}

/**
 * Execute a macOS accessibility action on an element identified by its index path.
 *
 * The element path is the `path` field on MacOSAXElement — a sequence of child
 * indices from the app root to the target element (e.g. [0, 2, 1]).
 *
 * Delegates to the compiled Swift binary which calls the macOS Accessibility API
 * directly — no Playwright or Appium involved.
 */
export async function performNativeAction(
  options: NativeActionOptions
): Promise<NativeActionResult> {
  const extractorPath = await ensureExtractor();

  const args: string[] = [
    '--pid', String(options.pid),
    '--action', options.action,
    '--element-path', options.elementPath.join(','),
  ];

  if (options.deviceName !== undefined) {
    args.push('--device-name', options.deviceName);
  }

  if (options.value !== undefined) {
    args.push('--value', options.value);
  }

  try {
    const { stdout } = await execFileAsync(extractorPath, args, { timeout: 10000 });
    return JSON.parse(stdout) as NativeActionResult;
  } catch (err: unknown) {
    // The binary exits 1 on failure — try to parse stdout for structured error
    if (err && typeof err === 'object' && 'stdout' in err) {
      const execErr = err as { stdout?: string; stderr?: string; message?: string };
      const raw = (execErr.stdout ?? '').trim();
      if (raw) {
        try {
          return JSON.parse(raw) as NativeActionResult;
        } catch {
          // Fall through to generic error
        }
      }
    }

    const message = err instanceof Error ? err.message : 'Action failed';
    return {
      success: false,
      action: options.action,
      error: message,
    };
  }
}

/**
 * Search a tree of MacOSAXElements for an element whose identifier, title,
 * or description exactly matches the given string.
 *
 * Returns the element's `path` array (suitable for passing to performNativeAction)
 * or null if no match is found.  The search is depth-first; the first match wins.
 */
export function findElementPath(
  elements: MacOSAXElement[],
  identifier: string
): number[] | null {
  function search(nodes: MacOSAXElement[]): number[] | null {
    for (const el of nodes) {
      const matches =
        (el.identifier !== null && el.identifier === identifier) ||
        (el.title !== null && el.title === identifier) ||
        (el.description !== null && el.description === identifier);

      if (matches) {
        return el.path;
      }

      if (el.children.length > 0) {
        const found = search(el.children);
        if (found !== null) return found;
      }
    }
    return null;
  }

  return search(elements);
}

export function resolveMacOSElement(
  elements: MacOSAXElement[],
  target: string,
  options: { role?: string } = {}
): NativeElementResolution | null {
  return resolveNativeCandidate(flattenMacOSElements(elements), target, options);
}

export function resolveSimulatorElement(
  elements: NativeElement[],
  target: string,
  options: { role?: string } = {}
): NativeElementResolution | null {
  return resolveNativeCandidate(flattenSimulatorElements(elements), target, options);
}

export function flattenMacOSElements(elements: MacOSAXElement[]): NativeElementCandidate[] {
  const candidates: NativeElementCandidate[] = [];

  function visit(nodes: MacOSAXElement[]): void {
    for (const el of nodes) {
      const label = el.title || el.description || el.value || el.identifier || '';
      candidates.push({
        path: el.path,
        role: el.role,
        label,
        identifier: el.identifier,
        value: el.value,
        enabled: el.enabled,
        actions: el.actions,
        frame: el.position && el.size ? {
          x: el.position.x,
          y: el.position.y,
          width: el.size.width,
          height: el.size.height,
        } : undefined,
      });
      if (el.children.length > 0) visit(el.children);
    }
  }

  visit(elements);
  return candidates;
}

export function flattenSimulatorElements(elements: NativeElement[]): NativeElementCandidate[] {
  const candidates: NativeElementCandidate[] = [];

  function visit(nodes: NativeElement[]): void {
    for (const el of nodes) {
      candidates.push({
        path: el.path,
        role: el.role,
        label: el.label || el.value || el.identifier || '',
        identifier: el.identifier || null,
        value: el.value,
        enabled: el.isEnabled,
        actions: el.traits.includes('button') || el.role === 'AXButton' ? ['AXPress'] : [],
        frame: el.frame,
      });
      if (el.children.length > 0) visit(el.children);
    }
  }

  visit(elements);
  return candidates;
}

function resolveNativeCandidate(
  candidates: NativeElementCandidate[],
  target: string,
  options: { role?: string }
): NativeElementResolution | null {
  const needle = normalize(target);
  if (!needle) return null;

  const scored = candidates
    .map(candidate => {
      const score = scoreCandidate(candidate, needle, options.role);
      return { candidate, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;

  const tier = scoreTier(best.candidate, needle);
  return {
    element: best.candidate,
    confidence: best.score,
    tier,
    alternatives: scored.slice(1, 6).map(item => ({
      label: item.candidate.label,
      role: normalizeRole(item.candidate.role),
      identifier: item.candidate.identifier,
      confidence: item.score,
    })),
    totalCandidates: candidates.length,
  };
}

function scoreCandidate(
  candidate: NativeElementCandidate,
  needle: string,
  role?: string
): number {
  if (role && normalizeRole(candidate.role) !== normalizeRole(role)) return 0;

  const identifier = normalize(candidate.identifier);
  const label = normalize(candidate.label);
  const value = normalize(candidate.value);

  if (identifier && identifier === needle) return 1;
  if (label && label === needle) return 0.96;
  if (value && value === needle) return 0.9;
  if (identifier && identifier.includes(needle)) return 0.82;
  if (label && label.includes(needle)) return 0.76;
  if (value && value.includes(needle)) return 0.7;
  return 0;
}

function scoreTier(
  candidate: NativeElementCandidate,
  needle: string
): NativeElementResolution['tier'] {
  if (normalize(candidate.identifier) === needle) return 'identifier';
  if (normalize(candidate.label) === needle) return 'label';
  if (normalize(candidate.value) === needle) return 'value';
  return 'contains';
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeRole(role: string): string {
  return (mapRoleToAriaRole(role) ?? role.replace(/^AX/, '')).toLowerCase();
}

// ─── Coordinate Helpers ───────────────────────────────────

/**
 * Compute the center point of an element's frame.
 * Returns null if the element has no frame data.
 */
export function elementCenter(element: {
  frame?: { x: number; y: number; width: number; height: number }
}): { x: number; y: number } | null {
  if (!element.frame) return null
  return {
    x: Math.round(element.frame.x + element.frame.width / 2),
    y: Math.round(element.frame.y + element.frame.height / 2),
  }
}

/**
 * Find an element by label (case-insensitive substring match) in a flat element list.
 * Returns the first matching element or null.
 */
export function findElementByLabel<T extends { label?: string; identifier?: string }>(
  elements: T[],
  label: string
): T | null {
  const needle = label.toLowerCase()
  return (
    elements.find(
      el =>
        (el.label && el.label.toLowerCase().includes(needle)) ||
        (el.identifier && el.identifier.toLowerCase().includes(needle))
    ) ?? null
  )
}
