import { describe, it, expect } from 'vitest';
import { replay, treeSignature, elementAtPoint, formatReplayReport, type ReplayFile } from './replay.js';
import { flattenMacOSElements } from './actions.js';
import type { NativeBackend } from './backend.js';
import type { MacOSAXElement } from './types.js';

function btn(title: string, path: number[], x: number): MacOSAXElement {
  return {
    role: 'AXButton', subrole: null, title, description: null, identifier: null, value: null,
    enabled: true, focused: false, actions: ['AXPress'], position: { x, y: 0 }, size: { width: 10, height: 10 },
    children: [], path,
  };
}

function fakeBackend(trees: MacOSAXElement[][], window: unknown = { w: 100 }) {
  const pressed: number[][] = [];
  let i = 0;
  const backend = {
    extract: async () => ({ kind: 'macos' as const, elements: trees[Math.min(i, trees.length - 1)], window }),
    performAction: async (_t: unknown, input: { elementPath: number[] }) => { pressed.push(input.elementPath); i++; return { success: true }; },
  } as unknown as NativeBackend;
  return { backend, pressed };
}

const target = { sessionId: 's1', kind: 'macos' as const, pid: 1 };
const sigOf = (els: MacOSAXElement[], w: unknown = { w: 100 }) => treeSignature(flattenMacOSElements(els), w);

describe('replay (macOS)', () => {
  const tree = [btn('7', [0], 0), btn('+', [1], 20)];
  const file: ReplayFile = {
    version: 1,
    steps: [
      { platform: 'macos', action: 'press', fingerprint: { role: 'AXButton', label: '7', identifier: null }, path: [0], signature: sigOf(tree) },
    ],
  };

  it('acts on the recorded path with a cache hit when the tree is unchanged', async () => {
    const { backend, pressed } = fakeBackend([tree]);
    const r = await replay(file, target, { backend, settleMs: 0 });
    expect(r[0].status).toBe('cached');
    expect(pressed).toEqual([[0]]);
  });

  it('verifies without re-resolving when the tree changed but the path still holds the element', async () => {
    const { backend, pressed } = fakeBackend([tree], { w: 300 });
    const r = await replay(file, target, { backend, settleMs: 0 });
    expect(r[0].status).toBe('verified');
    expect(pressed).toEqual([[0]]);
  });

  it('heals by fingerprint when the recorded path now addresses a different element', async () => {
    const moved = [btn('AC', [0], 0), btn('7', [3], 40)];
    const { backend, pressed } = fakeBackend([moved]);
    const r = await replay(file, target, { backend, settleMs: 0 });
    expect(r[0]).toMatchObject({ status: 'healed', from: '0', to: '3' });
    expect(pressed).toEqual([[3]]);
    expect(formatReplayReport(r, 1)).toContain('healed #1 Button "7" 0 -> 3');
  });

  it('fails (never acts on a stale path) when the element is gone', async () => {
    const { backend, pressed } = fakeBackend([[btn('AC', [0], 0)]]);
    const r = await replay(file, target, { backend, settleMs: 0 });
    expect(r[0].status).toBe('failed');
    expect(pressed).toEqual([]);
  });
});

describe('replay (simulator)', () => {
  const els = [
    { role: 'Application', label: 'Settings', identifier: null, frame: { x: 0, y: 0, width: 400, height: 800 } },
    { role: 'Button', label: 'General', identifier: 'com.apple.settings.general', frame: { x: 0, y: 100, width: 400, height: 40 } },
  ];
  const file: ReplayFile = {
    version: 1,
    steps: [{ platform: 'simulator', action: 'click', count: 1, fingerprint: { role: 'Button', label: 'General', identifier: 'com.apple.settings.general' }, point: [200, 120], signature: treeSignature(els) }],
  };
  const simTarget = { sessionId: 's2', kind: 'simulator' as const, udid: 'U' };

  it('elementAtPoint picks the smallest containing frame', () => {
    expect(elementAtPoint(els, 200, 120)?.label).toBe('General');
  });

  it('taps the recorded point when unchanged and heals to the new center when the row moved', async () => {
    const taps: number[][] = [];
    const tap = async (_u: string, x: number, y: number) => { taps.push([x, y]); return { success: true }; };
    const same = await replay(file, simTarget, { backend: {} as NativeBackend, readSimulatorElements: async () => els, tapSimulator: tap, settleMs: 0 });
    expect(same[0].status).toBe('cached');
    const moved = [els[0], { ...els[1], frame: { x: 0, y: 300, width: 400, height: 40 } }];
    const healed = await replay(file, simTarget, { backend: {} as NativeBackend, readSimulatorElements: async () => moved, tapSimulator: tap, settleMs: 0 });
    expect(healed[0]).toMatchObject({ status: 'healed', from: '200,120', to: '200,320' });
    expect(taps).toEqual([[200, 120], [200, 320]]);
  });
});
