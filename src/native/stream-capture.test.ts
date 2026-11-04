import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { captureNativeStream } from './stream-capture.js';

describe('bounded streaming capture', () => {
  it('records ordered state-only deltas and selected keyframes within a budget', async () => {
    let clock = 0;
    const outputDir = await mkdtemp(join(tmpdir(), 'ibr-stream-'));
    const pngPath = join(outputDir, 'source.png');
    await writeFile(pngPath, PNG.sync.write(new PNG({ width: 1, height: 1 })));
    const result = await captureNativeStream({ durationMs: 400, intervalMs: 100, maxFrames: 3,
      keyframeOn: ['Error'], outputDir }, {
      now: () => clock, sleep: async ms => { clock += ms; },
      read: async () => ({ elements: [{ role: 'AXTextArea', identifier: 'reply', value: clock === 200 ? 'Error' : `Reply ${clock}` },
        { role: 'AXButton', label: 'Send', enabled: clock >= 300 }] }),
      screenshot: async () => ({ type: 'macos', screenshotPath: pngPath }),
    });
    expect(result.complete).toBe(true);
    expect(result.samples).toBe(5);
    expect(result.frames.map(f => f.reason)).toEqual(['baseline', 'match:Error', 'final']);
    const events = (await readFile(result.eventsPath, 'utf8')).trim().split('\n').map(s => JSON.parse(s));
    expect(events.filter(e => e.type === 'keyframe')).toHaveLength(3);
    expect(events.map(e => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events.filter(e => e.type === 'delta').every(e => e.updated.length > 0)).toBe(true);
    expect(result.taskCompletion).toBe('not-inferred');
    await expect(captureNativeStream({ durationMs: 100, intervalMs: 100, maxFrames: 0, keyframeOn: [], outputDir }, {
      read: async () => ({ elements: [] }), screenshot: async () => ({}),
    })).rejects.toThrow();
  });
  it('records observation failure without claiming continuity or completion', async () => {
    const result = await captureNativeStream({ durationMs: 100, intervalMs: 100, maxFrames: 0,
      keyframeOn: [], outputDir: await mkdtemp(join(tmpdir(), 'ibr-stream-error-')) }, {
      read: async () => { throw new Error('lost AX'); }, screenshot: async () => ({}),
    });
    expect(result.complete).toBe(false);
    expect(result.errors[0]).toContain('lost AX');
    expect(await readFile(result.eventsPath, 'utf8')).toContain('resyncRequired');
  });
});

it('times out a stalled read and retains a failed manifest', async () => {
  const result = await captureNativeStream({ durationMs: 100, intervalMs: 100, maxFrames: 0,
    keyframeOn: [], outputDir: await mkdtemp(join(tmpdir(), 'ibr-stream-timeout-')) }, {
    read: () => new Promise(() => {}), screenshot: async () => ({}),
  });
  expect(result.complete).toBe(false);
  expect(result.errors[0]).toContain('timed out');
});

it('counts failed screenshot attempts against the budget and rejects missing images', async () => {
  let clock = 0;
  const result = await captureNativeStream({ durationMs: 200, intervalMs: 100, maxFrames: 1,
    keyframeOn: ['Error'], outputDir: await mkdtemp(join(tmpdir(), 'ibr-stream-frame-error-')) }, {
    now: () => clock, sleep: async ms => { clock += ms; },
    read: async () => ({ elements: [{ role: 'AXStaticText', label: 'Error' }] }), screenshot: async () => ({}),
  });
  expect(result.complete).toBe(false);
  expect(result.frameAttempts).toBe(1);
  expect(result.frames).toHaveLength(0);
  expect(result.errors[0]).toContain('artifact path missing');
});

it('rejects partial observations without emitting authoritative removals', async () => {
  const result = await captureNativeStream({ durationMs: 100, intervalMs: 100, maxFrames: 0,
    keyframeOn: [], outputDir: await mkdtemp(join(tmpdir(), 'ibr-stream-partial-')) }, {
    read: async () => ({ elements: [], totalElements: 20 }), screenshot: async () => ({}),
  });
  expect(result.complete).toBe(false);
  const events = await readFile(result.eventsPath, 'utf8');
  expect(events).toContain('partial-observation');
  expect(events).not.toContain('"type":"delta"');
});
