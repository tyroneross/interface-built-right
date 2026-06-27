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
