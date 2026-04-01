/**
 * Coordinate helpers for native element interaction
 *
 * These utilities bridge the gap between AX element data (frames with x/y/width/height)
 * and the coordinate-based IDB interaction API.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ensureExtractor } from './extract.js';
import type { MacOSAXElement } from './types.js';

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
  | 'focus';

export interface NativeActionOptions {
  pid: number;
  elementPath: number[];
  action: NativeAction;
  value?: string;
}

export interface NativeActionResult {
  success: boolean;
  action: string;
  error?: string;
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
