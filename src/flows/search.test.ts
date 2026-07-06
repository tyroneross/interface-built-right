/**
 * Unit tests for openSearchPaletteAndFindInput and its integration into
 * searchFlow via the palette fallback path.
 *
 * All tests use a minimal mock PageLike — no real browser, no CDP.
 * waitForTimeout always resolves immediately in the mock.
 */

import { describe, it, expect, vi } from 'vitest';
import { openSearchPaletteAndFindInput, searchFlow } from './search.js';
import type { PageLike, ElementHandleLike } from '../engine/page-like.js';
import { InputDomain } from '../engine/cdp/input.js';
import type { CdpConnection } from '../engine/cdp/connection.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeFakeElement(): ElementHandleLike {
  return {
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
    textContent: vi.fn().mockResolvedValue(''),
    boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 30 }),
    fill: vi.fn().mockResolvedValue(undefined),
    press: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockPage(overrides: Partial<PageLike> = {}): PageLike {
  return {
    goto: vi.fn().mockResolvedValue(null),
    evaluate: vi.fn().mockResolvedValue(null),
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
    addStyleTag: vi.fn().mockResolvedValue(null),
    waitForSelector: vi.fn().mockResolvedValue(null),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue(''),
    title: vi.fn().mockResolvedValue(''),
    textContent: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as PageLike;
}

// ─── InputDomain.pressKey — modifier chord synthesis (T-08a mutation-first) ───
//
// Bug: pressKey('Meta+k') fell through to per-character `type()`, dispatching
// one keyDown+keyUp pair PER LITERAL CHARACTER of the string "Meta+k" (M, e,
// t, a, +, k) instead of a real Meta-held-down + K chord. Consequence: the
// ⌘K command-palette fallback in openSearchPaletteAndFindInput (below) never
// actually opened a palette in a real browser — it just typed garbage into
// whatever was focused. These tests use a recording fake CdpConnection (no
// real WebSocket/browser) to inspect exactly which CDP Input events fire.

function makeRecordingConnection(): {
  conn: CdpConnection;
  calls: Array<{ method: string; params?: Record<string, unknown> }>;
} {
  const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
  const conn = {
    send: vi.fn(async (method: string, params?: Record<string, unknown>) => {
      calls.push({ method, params });
      return undefined;
    }),
  } as unknown as CdpConnection;
  return { conn, calls };
}

describe('InputDomain.pressKey — modifier chord synthesis (T-08a mutation-first)', () => {
  it('dispatches a real Meta+K chord for pressKey("Meta+k") — not literal characters "Meta+k"', async () => {
    const { conn, calls } = makeRecordingConnection();
    const input = new InputDomain(conn);

    await input.pressKey('Meta+k');

    const keyEvents = calls.filter((c) => c.method === 'Input.dispatchKeyEvent');

    // The bug: per-character literal typing of "Meta+k" (M, e, t, a, +, k),
    // each carrying a single-char `text` field and no `modifiers` bitmask.
    const literalCharEvents = keyEvents.filter(
      (c) => typeof c.params?.text === 'string' && (c.params!.text as string).length === 1
    );
    expect(literalCharEvents.length).toBe(0);

    // The fix: Meta held down (modifiers bit 4 per CDP Input.dispatchKeyEvent
    // semantics: Alt=1, Ctrl=2, Meta/Command=4, Shift=8) ...
    const metaDown = keyEvents.find((c) => c.params?.key === 'Meta' && c.params?.type === 'keyDown');
    expect(metaDown).toBeDefined();
    expect(metaDown?.params?.modifiers).toBe(4);

    // ... K pressed while Meta is held (modifiers=4, no literal text insertion) ...
    const kDown = keyEvents.find((c) => c.params?.code === 'KeyK' && c.params?.type === 'keyDown');
    expect(kDown).toBeDefined();
    expect(kDown?.params?.modifiers).toBe(4);
    expect(kDown?.params?.text).toBeUndefined();

    const kUp = keyEvents.find((c) => c.params?.code === 'KeyK' && c.params?.type === 'keyUp');
    expect(kUp).toBeDefined();
    expect(kUp?.params?.modifiers).toBe(4);

    // ... then Meta released (modifiers back to 0).
    const metaUp = keyEvents.find((c) => c.params?.key === 'Meta' && c.params?.type === 'keyUp');
    expect(metaUp).toBeDefined();
    expect(metaUp?.params?.modifiers).toBe(0);
  });

  it('dispatches a real Ctrl+Shift+P chord — multi-modifier chords parse in order', async () => {
    const { conn, calls } = makeRecordingConnection();
    const input = new InputDomain(conn);

    await input.pressKey('Ctrl+Shift+P');

    const keyEvents = calls.filter((c) => c.method === 'Input.dispatchKeyEvent');

    const ctrlDown = keyEvents.find((c) => c.params?.key === 'Control' && c.params?.type === 'keyDown');
    expect(ctrlDown?.params?.modifiers).toBe(2); // Ctrl=2

    const shiftDown = keyEvents.find((c) => c.params?.key === 'Shift' && c.params?.type === 'keyDown');
    expect(shiftDown?.params?.modifiers).toBe(2 | 8); // Ctrl+Shift held

    const pDown = keyEvents.find((c) => c.params?.code === 'KeyP' && c.params?.type === 'keyDown');
    expect(pDown?.params?.modifiers).toBe(2 | 8);
  });
});

// ─── openSearchPaletteAndFindInput ────────────────────────────────────────────

describe('openSearchPaletteAndFindInput', () => {
  it('returns the input when a trigger element is clicked via evaluate', async () => {
    const fakeEl = makeFakeElement();
    const page = makeMockPage({
      evaluate: vi.fn().mockResolvedValue(true),
      $: vi.fn().mockResolvedValue(fakeEl),
    });

    const result = await openSearchPaletteAndFindInput(page);

    expect(result).toBe(fakeEl);
  });

  it('returns the input after keyboard shortcut when no trigger is found', async () => {
    const fakeEl = makeFakeElement();
    const keyboardPress = vi.fn().mockResolvedValue(undefined);
    const page = makeMockPage({
      evaluate: vi.fn().mockResolvedValue(false),
      keyboard: { press: keyboardPress },
      $: vi.fn().mockResolvedValue(fakeEl),
    });

    const result = await openSearchPaletteAndFindInput(page);

    expect(result).toBe(fakeEl);
    expect(keyboardPress).toHaveBeenCalledWith('Meta+k');
    expect(keyboardPress).toHaveBeenCalledWith('Control+k');
  });

  it('returns null when neither trigger nor keyboard surfaces an input', async () => {
    const page = makeMockPage({
      evaluate: vi.fn().mockResolvedValue(false),
      // no keyboard property → keyboard shortcut path skipped
      $: vi.fn().mockResolvedValue(null),
    });

    const result = await openSearchPaletteAndFindInput(page);

    expect(result).toBeNull();
  });

  it('drives a real InputDomain to fire genuine Meta+k / Control+k chords — the ⌘K fallback is no longer dead code', async () => {
    // Wires `page.keyboard.press` to a REAL InputDomain (recording fake CDP
    // connection, no browser) instead of a bare vi.fn mock, so this exercises
    // the actual fix end-to-end through openSearchPaletteAndFindInput's
    // keyboard-shortcut fallback (search.ts lines ~117-123) — proving that
    // path now synthesizes real chords instead of typing "Meta+k" literally.
    const { conn, calls } = makeRecordingConnection();
    const input = new InputDomain(conn);
    const fakeEl = makeFakeElement();

    const page = makeMockPage({
      evaluate: vi.fn().mockResolvedValue(false), // no trigger element found
      keyboard: { press: (key: string) => input.pressKey(key) },
      $: vi.fn().mockResolvedValue(fakeEl),
    });

    const result = await openSearchPaletteAndFindInput(page, 50);
    expect(result).toBe(fakeEl);

    const keyEvents = calls.filter((c) => c.method === 'Input.dispatchKeyEvent');

    const metaDown = keyEvents.find((c) => c.params?.key === 'Meta' && c.params?.type === 'keyDown');
    expect(metaDown?.params?.modifiers).toBe(4);

    const controlDown = keyEvents.find((c) => c.params?.key === 'Control' && c.params?.type === 'keyDown');
    expect(controlDown?.params?.modifiers).toBe(2);

    // Never falls back to per-character literal typing of "Meta+k"/"Control+k".
    const literalCharEvents = keyEvents.filter(
      (c) => typeof c.params?.text === 'string' && (c.params!.text as string).length === 1
    );
    expect(literalCharEvents.length).toBe(0);
  });
});

// ─── searchFlow: palette fallback integration ─────────────────────────────────

describe('searchFlow: palette fallback', () => {
  it('succeeds via palette when no persistent search input is found', async () => {
    const fakeEl = makeFakeElement();

    // Evaluate call ordering in searchFlow:
    //   #1-#4  findFieldByLabel label-text walk (one per label: search/query/q/find)
    //   #5     openSearchPaletteAndFindInput trigger search → true (click happened)
    //   #6     combinedTextOrCssQuery empty-state detection → null
    let evaluateCount = 0;
    const page = makeMockPage({
      evaluate: vi.fn().mockImplementation(() => {
        evaluateCount++;
        return Promise.resolve(evaluateCount === 5 ? true : null);
      }),
      // $ returns fakeEl only for the palette selector (uniquely identified by
      // [cmdk-input], which is absent from all other selector strings used in
      // findFieldByLabel / searchFlow's CSS fallback).
      $: vi.fn().mockImplementation((sel: string) => {
        if (sel.includes('[cmdk-input]')) return Promise.resolve(fakeEl);
        return Promise.resolve(null);
      }),
      $$: vi.fn().mockResolvedValue([]),
    });

    // Use submit:false to avoid waitForNavigation complexity in the mock.
    const result = await searchFlow(page, { query: 'hello', submit: false });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.steps.some((s) => s.action === 'opened search palette')).toBe(true);
  });
});
