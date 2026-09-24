/**
 * Unit coverage for probeActivationListeners' null-capability path -- the one
 * behavior testable without a real DOM (everything else requires actual
 * `getEventListeners` support and is pinned by
 * src/handler-listeners.integration.test.ts against real Chrome instead).
 *
 * `probeActivationListeners` must return `null`, not throw and not resolve
 * to `[]`, when the PageLike doesn't expose `evaluateWithCommandLineAPI` --
 * every caller (extract.ts, interactivity.ts) treats `null` as "leave
 * elements exactly as static detection left them", so returning anything
 * else here would silently regress every PageLike that isn't CompatPage
 * (Playwright, a future WebKit driver, etc).
 */

import { describe, it, expect, vi } from 'vitest';
import { probeActivationListeners } from './handler-listeners.js';
import type { PageLike } from './engine/page-like.js';

describe('probeActivationListeners — capability detection', () => {
  it('returns null when the PageLike has no evaluateWithCommandLineAPI at all', async () => {
    const bare = {
      goto: vi.fn(),
      evaluate: vi.fn(),
    } as unknown as PageLike;

    const result = await probeActivationListeners(bare, 'Array.from(document.querySelectorAll("button"))');
    expect(result).toBeNull();
  });

  it('returns null with no throw when the field is present as a TRUTHY non-function value', async () => {
    const malformed = {
      goto: vi.fn(),
      evaluate: vi.fn(),
      // Deliberately truthy and non-callable -- a defensive shape a
      // hand-rolled PageLike test double (or a future implementation) could
      // produce. `?.bind(page)` alone would happily bind this and only
      // throw later, on invocation; the `typeof ... === 'function'` guard
      // must reject it up front without throwing at all.
      evaluateWithCommandLineAPI: 'x',
    } as unknown as PageLike;

    const result = await probeActivationListeners(malformed, 'Array.from(document.querySelectorAll("button"))');
    expect(result).toBeNull();
  });

  it('returns null when evaluateWithCommandLineAPI throws (getEventListeners unavailable)', async () => {
    const throwing = {
      goto: vi.fn(),
      evaluate: vi.fn(),
      evaluateWithCommandLineAPI: vi.fn().mockRejectedValue(new Error('includeCommandLineAPI not supported')),
    } as unknown as PageLike;

    const result = await probeActivationListeners(throwing, 'Array.from(document.querySelectorAll("button"))');
    expect(result).toBeNull();
  });

  it('returns null when evaluateWithCommandLineAPI resolves to a non-array', async () => {
    const malformedResult = {
      goto: vi.fn(),
      evaluate: vi.fn(),
      evaluateWithCommandLineAPI: vi.fn().mockResolvedValue({ not: 'an array' }),
    } as unknown as PageLike;

    const result = await probeActivationListeners(malformedResult, 'Array.from(document.querySelectorAll("button"))');
    expect(result).toBeNull();
  });

  it('passes the targetsExpression through verbatim into the evaluated source and returns the resolved array', async () => {
    const evaluateWithCommandLineAPI = vi.fn().mockResolvedValue([
      { hasEventListener: true, hasDelegatedListener: false },
      null,
    ]);
    const page = {
      goto: vi.fn(),
      evaluate: vi.fn(),
      evaluateWithCommandLineAPI,
    } as unknown as PageLike;

    const targetsExpression = 'Array.from(document.querySelectorAll("button"))';
    const result = await probeActivationListeners(page, targetsExpression);

    expect(result).toEqual([
      { hasEventListener: true, hasDelegatedListener: false },
      null,
    ]);
    expect(evaluateWithCommandLineAPI).toHaveBeenCalledTimes(1);
    const sentExpression = evaluateWithCommandLineAPI.mock.calls[0]?.[0] as string;
    expect(sentExpression).toContain(targetsExpression);
  });
});
