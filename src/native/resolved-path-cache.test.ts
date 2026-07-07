import { describe, it, expect, beforeEach } from 'vitest';
import { ResolvedPathCache } from './resolved-path-cache.js';
import { nativeStateSignature } from './session-controller.js';
import type { NativeElementCandidate } from './actions.js';

/**
 * T-12: resolved-path cache invalidation.
 *
 * The falsifier the plan names: "action on a stale path after UI mutation
 * succeeds against wrong element". The cache must NEVER hand back a path whose
 * captured signature no longer matches the current tree — a signature mismatch
 * means the positional index-path may now address a different element.
 */

function candidate(overrides: Partial<NativeElementCandidate> = {}): NativeElementCandidate {
  return {
    path: [0],
    role: 'AXButton',
    label: 'Submit',
    identifier: null,
    value: null,
    enabled: true,
    actions: ['AXPress'],
    frame: { x: 0, y: 0, width: 100, height: 30 },
    ...overrides,
  };
}

describe('ResolvedPathCache (T-12)', () => {
  let cache: ResolvedPathCache;
  beforeEach(() => {
    cache = new ResolvedPathCache();
  });

  it('returns a cached path when the signature is unchanged', () => {
    const sig = nativeStateSignature({ title: 'A' }, [candidate()]);
    cache.set('s1', 'Submit', [0, 2, 1], sig);
    expect(cache.get('s1', 'Submit', sig)).toEqual([0, 2, 1]);
  });

  it('T-12 FALSIFIER: never returns a stale path after the tree signature changes', () => {
    const sigBefore = nativeStateSignature({ title: 'before' }, [
      candidate({ label: 'Submit', path: [0, 2, 1] }),
    ]);
    cache.set('s1', 'Submit', [0, 2, 1], sigBefore);

    // UI mutates — a new element inserted shifts positions; signature changes.
    const sigAfter = nativeStateSignature({ title: 'after' }, [
      candidate({ label: 'Banner', path: [0] }),
      candidate({ label: 'Submit', path: [0, 2, 2] }),
    ]);
    expect(sigAfter).not.toBe(sigBefore);

    // The cache must NOT hand back the old [0,2,1] — that path now points at a
    // different element. It returns null, forcing re-resolution.
    expect(cache.get('s1', 'Submit', sigAfter)).toBeNull();
  });

  it('evicts the stale entry on mismatch (does not keep serving it)', () => {
    const sigA = nativeStateSignature({ title: 'A' }, [candidate()]);
    const sigB = nativeStateSignature({ title: 'B' }, [candidate()]);
    cache.set('s1', 'Submit', [0], sigA);
    expect(cache.get('s1', 'Submit', sigB)).toBeNull();
    // Even asking again with the ORIGINAL signature returns null — it was evicted.
    expect(cache.get('s1', 'Submit', sigA)).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('isolates entries by sessionId and by target', () => {
    const sig = nativeStateSignature({ title: 'A' }, [candidate()]);
    cache.set('s1', 'Submit', [0], sig);
    cache.set('s2', 'Submit', [1], sig);
    cache.set('s1', 'Cancel', [2], sig);
    expect(cache.get('s1', 'Submit', sig)).toEqual([0]);
    expect(cache.get('s2', 'Submit', sig)).toEqual([1]);
    expect(cache.get('s1', 'Cancel', sig)).toEqual([2]);
    expect(cache.get('s3', 'Submit', sig)).toBeNull();
  });

  it('invalidateSession drops all entries for one session only', () => {
    const sig = nativeStateSignature({ title: 'A' }, [candidate()]);
    cache.set('s1', 'Submit', [0], sig);
    cache.set('s1', 'Cancel', [1], sig);
    cache.set('s2', 'Submit', [2], sig);
    cache.invalidateSession('s1');
    expect(cache.get('s1', 'Submit', sig)).toBeNull();
    expect(cache.get('s1', 'Cancel', sig)).toBeNull();
    expect(cache.get('s2', 'Submit', sig)).toEqual([2]);
  });

  it('returns a defensive copy — callers cannot mutate the cached path', () => {
    const sig = nativeStateSignature({ title: 'A' }, [candidate()]);
    cache.set('s1', 'Submit', [0, 1], sig);
    const got = cache.get('s1', 'Submit', sig)!;
    got.push(99);
    expect(cache.get('s1', 'Submit', sig)).toEqual([0, 1]);
  });
});
