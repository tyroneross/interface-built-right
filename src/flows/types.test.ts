/**
 * B1: regression coverage for the `:has-text(...)` crash fix.
 *
 * The helpers in `flows/types.ts` previously chained Playwright pseudo
 * selectors (`:has-text(...)`) into a single `querySelector` call. Native
 * Chromium querySelector rejected the entire selector list, crashing the
 * scan with `Failed to execute 'querySelector'`.
 *
 * These tests stub a `PageLike` with stand-ins for `$` and `evaluate`, and
 * assert:
 *  1. `findButton` no longer passes `:has-text(...)` to `page.$`.
 *  2. The text-content fallback runs via `page.evaluate`.
 *  3. `combinedTextOrCssQuery` exists and accepts cssSelectors + tags.
 */

import { describe, it, expect } from 'vitest';
import { findButton, findFieldByLabel, combinedTextOrCssQuery } from './types.js';

function makePage(opts: {
  hits?: Record<string, unknown>;
  evalResult?: unknown;
  onSelector?: (s: string) => void;
} = {}) {
  const sawSelectors: string[] = [];
  const evalCalls: string[] = [];
  const page = {
    $: async (selector: string) => {
      sawSelectors.push(selector);
      opts.onSelector?.(selector);
      return (opts.hits && selector in opts.hits) ? opts.hits[selector] : null;
    },
    $$: async () => [],
    evaluate: async (fn: any, ..._args: any[]) => {
      evalCalls.push(typeof fn === 'string' ? fn : fn.toString());
      return opts.evalResult;
    },
  } as any;
  return { page, sawSelectors, evalCalls };
}

describe('findButton', () => {
  it('does NOT pass `:has-text(...)` to page.$', async () => {
    const { page, sawSelectors } = makePage({});
    await findButton(page, ['login', 'sign in']);
    for (const sel of sawSelectors) {
      expect(sel).not.toContain(':has-text');
    }
  });

  it('uses page.evaluate for text-based fallback', async () => {
    const { page, evalCalls } = makePage({});
    await findButton(page, ['logout']);
    expect(evalCalls.length).toBeGreaterThan(0);
    // The evaluator should reference the needle and the tag list.
    const evalSrc = evalCalls.join('\n');
    expect(evalSrc).toContain('logout');
    expect(evalSrc).toContain('button');
  });

  it('returns the handle resolved from the path the evaluator hands back',
    async () => {
      const fakeHandle = { _h: true };
      const { page, sawSelectors } = makePage({
        evalResult: 'button:nth-of-type(2)',
        hits: { 'button:nth-of-type(2)': fakeHandle },
      });
      const handle = await findButton(page, ['login']);
      expect(handle).toBe(fakeHandle);
      // The path produced by the evaluator must be a valid CSS selector
      // that page.$ can consume — no `:has-text`.
      expect(sawSelectors).toContain('button:nth-of-type(2)');
    });
});

describe('findFieldByLabel', () => {
  it('does NOT pass `:has-text(...)` to page.$', async () => {
    const { page, sawSelectors } = makePage({});
    await findFieldByLabel(page, ['email']);
    for (const sel of sawSelectors) {
      expect(sel).not.toContain(':has-text');
    }
  });

  it('tries attribute selectors before evaluator', async () => {
    const fakeHandle = { _h: 'attr-hit' };
    const { page, sawSelectors } = makePage({
      hits: { 'input[name*="email" i]': fakeHandle },
    });
    const result = await findFieldByLabel(page, ['email']);
    expect(result).toBe(fakeHandle);
    // Attribute selector was tried; we don't need the evaluator path.
    expect(sawSelectors[0]).toBe('input[name*="email" i]');
  });
});

describe('combinedTextOrCssQuery', () => {
  it('runs in-page (via page.evaluate) and returns whatever path the eval gives back',
    async () => {
      const { page, evalCalls } = makePage({ evalResult: 'div > a' });
      const out = await combinedTextOrCssQuery(page, {
        cssSelectors: ['[class*="logout"]', '[data-testid*="logout"]'],
        tags: ['button', 'a'],
        textNeedles: ['logout', 'sign out'],
      });
      expect(out).toBe('div > a');
      // Evaluator source mentions both inputs so we know we composed it
      // correctly.
      const src = evalCalls.join('\n');
      expect(src).toContain('logout');
      expect(src).toContain('sign out');
      // JSON.stringify of the array escapes the inner quotes — match the
      // shape that actually lands in the evaluator source.
      expect(src).toMatch(/\[class\*=\\"logout\\"\]/);
    });
});
