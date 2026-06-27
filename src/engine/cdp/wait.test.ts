import { describe, it, expect } from 'vitest';
import { waitForSkeletonSettled } from './wait.js';

describe('waitForSkeletonSettled', () => {
  it('resolves immediately when evaluate returns 0', async () => {
    const evaluate = async (_expr: string) => 0;
    const result = await waitForSkeletonSettled(evaluate);
    expect(result).toEqual({ settled: true, skeletonCount: 0, timedOut: false });
  });

  it('resolves timedOut when skeleton count persists past timeout', async () => {
    const evaluate = async (_expr: string) => 3;
    const result = await waitForSkeletonSettled(evaluate, { timeout: 300, interval: 50 });
    expect(result).toEqual({ settled: false, skeletonCount: 3, timedOut: true });
  }, 2000);

  it('resolves settled when count drops to 0 after a few non-zero ticks', async () => {
    let calls = 0;
    const evaluate = async (_expr: string) => {
      calls++;
      return calls <= 2 ? 2 : 0;
    };
    const result = await waitForSkeletonSettled(evaluate, { timeout: 2000, interval: 50 });
    expect(result).toEqual({ settled: true, skeletonCount: 0, timedOut: false });
  }, 2000);

  it('resolves settled when evaluate throws (defensive — do not block scan)', async () => {
    const evaluate = async (_expr: string): Promise<unknown> => {
      throw new Error('CDP context destroyed');
    };
    const result = await waitForSkeletonSettled(evaluate, { timeout: 500 });
    expect(result).toEqual({ settled: true, skeletonCount: 0, timedOut: false });
  }, 2000);
});
