/**
 * Shared AX-state signature — a compact fingerprint of observable AX state
 * used by both `menu.ts` and `keyboard.ts` to decide whether a delivered
 * action (menu selection, keystroke chord) produced an observable effect.
 *
 * The signature covers window identity, focused element path, element
 * count, and a content-sensitive `labels` hash. The first three alone are
 * count/identity-preserving — a reorder of same-count, same-role rows (e.g.
 * dragging a list item from position 0 to position 1) leaves them all
 * unchanged, so a capability's before/after diff would read "no observable
 * AX state change" even though the tree's content genuinely moved. `labels`
 * closes that gap: it hashes a depth-first pre-order walk of
 * `${role}:${label}` tokens, so swapping two rows' order changes the hash
 * even though window/title/count/focus are identical.
 */

import { createHash } from 'crypto';
import type { NativeExtraction } from './backend.js';
import type { MacOSAXElement, NativeElement } from './types.js';

export function countElements<T extends { children: T[] }>(elements: T[]): number {
  let total = 0;
  for (const el of elements) {
    total += 1;
    total += countElements(el.children);
  }
  return total;
}

export function findFocusedPathMacOS(
  elements: Array<{ focused: boolean; path: number[]; children: unknown[] }>,
): number[] | null {
  for (const el of elements) {
    if (el.focused) return el.path;
    if (el.children.length > 0) {
      const found = findFocusedPathMacOS(
        el.children as Array<{ focused: boolean; path: number[]; children: unknown[] }>,
      );
      if (found) return found;
    }
  }
  return null;
}

/** First non-empty string among the given candidates, or '' if none. */
function firstNonEmpty(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    if (c) return c;
  }
  return '';
}

function macOSLabelTokens(elements: MacOSAXElement[], out: string[]): void {
  for (const el of elements) {
    const label = firstNonEmpty(el.title, el.description, el.value);
    out.push(`${el.role}:${label}`);
    if (el.children.length > 0) macOSLabelTokens(el.children, out);
  }
}

function simulatorLabelTokens(elements: NativeElement[], out: string[]): void {
  for (const el of elements) {
    const label = firstNonEmpty(el.label, el.value);
    out.push(`${el.role}:${label}`);
    if (el.children.length > 0) simulatorLabelTokens(el.children, out);
  }
}

function labelsHash(tokens: string[]): string {
  return createHash('sha256').update(tokens.join('\n')).digest('hex').slice(0, 12);
}

/**
 * A compact signature of observable AX state — window identity, focused
 * element, element count, and a content-sensitive labels hash. Two
 * extractions with an identical signature are treated as "no observable
 * effect" by a capability's validator (`menu.ts`, `keyboard.ts`).
 */
export function axSignature(extraction: NativeExtraction): string {
  if (extraction.kind === 'not-found') return `not-found:${extraction.message}`;
  if (extraction.kind === 'macos') {
    const focused = findFocusedPathMacOS(extraction.elements);
    const tokens: string[] = [];
    macOSLabelTokens(extraction.elements, tokens);
    return [
      `window=${extraction.window.windowId}`,
      `title=${extraction.window.title}`,
      `count=${countElements(extraction.elements)}`,
      `focused=${focused ? focused.join('.') : 'none'}`,
      `labels=${labelsHash(tokens)}`,
    ].join('|');
  }
  // Simulator's legacy element shape exposes no `focused` flag today, so
  // element count + labels are the best-effort signal for this target kind.
  const tokens: string[] = [];
  simulatorLabelTokens(extraction.elements, tokens);
  return [`count=${countElements(extraction.elements)}`, `labels=${labelsHash(tokens)}`].join('|');
}
