import { describe, expect, it, vi } from 'vitest';
import type { MacOSAXElement, MacOSWindowInfo } from './types.js';
import type { NativeBackend, NativePerformInput } from './backend.js';
import { notImplementedOutcome } from '../action-outcome.js';

vi.mock('./preflight.js', async () => ({
  ...await vi.importActual<typeof import('./preflight.js')>('./preflight.js'),
  macOSNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
}));

import { flattenMacOSElements, macOSActionTarget } from './actions.js';
import { NativeSessionController } from './session-controller.js';

const window: MacOSWindowInfo = { windowId: 7, title: 'Today', width: 560, height: 680 };
function element(path: number[], role: string, overrides: Partial<MacOSAXElement> = {}): MacOSAXElement {
  return { path, role, subrole: null, title: null, description: null, identifier: null,
    value: null, placeholder: null, enabled: true, focused: false, actions: [],
    position: { x: 0, y: 0 }, size: { width: 100, height: 44 }, children: [], ...overrides };
}
function sidebar(selected = false): MacOSAXElement[] {
  return [element([0], 'AXOutline', { children: [element([0, 0], 'AXRow', {
    selected, children: [element([0, 0, 0], 'AXCell', {
      children: [element([0, 0, 0, 0], 'AXStaticText', { title: 'Plan' })],
    })],
  })] })];
}
function fixture(initial: MacOSAXElement[], apply: (input: NativePerformInput, nodes: MacOSAXElement[]) => void) {
  let nodes = initial;
  const delivered: NativePerformInput[] = [];
  const backend: NativeBackend = {
    extract: async () => ({ kind: 'macos', elements: structuredClone(nodes), window }),
    performAction: async (_target, input) => { delivered.push(input); apply(input, nodes); return { success: true, action: input.action }; },
    captureScreenshot: async () => { throw new Error('No screenshot expected'); },
    keystroke: async () => notImplementedOutcome('keyboard'),
    lifecycle: async () => notImplementedOutcome('app'),
    menu: async () => notImplementedOutcome('menu'),
  };
  const controller = new NativeSessionController({ backend, store: new Map() });
  const entry = { driver: null, type: 'macos' as const, pid: 42, createdAt: 1 };
  return { delivered, action: async (request: Parameters<typeof controller.actionMacOS>[1]) => {
    const result = await controller.actionMacOS(entry, request);
    if (result.kind !== 'text') throw new Error('Expected native JSON');
    return { ...JSON.parse(result.text), isError: result.isError === true };
  }, replace: (next: MacOSAXElement[]) => { nodes = next; } };
}

describe('native sidebar targeting and outcome verification', () => {
  it('names a row from its one text label without naming the AXCell', () => {
    const nodes = flattenMacOSElements(sidebar());
    expect(nodes.find(x => x.role === 'AXRow')).toMatchObject({ label: 'Plan', selected: false });
    expect(nodes.find(x => x.role === 'AXCell')?.label).toBe('');
  });

  it('clicks a text label by selecting its row and verifies the selected state', async () => {
    const f = fixture(sidebar(), (_input, nodes) => { nodes[0].children[0].selected = true; });
    const result = await f.action({ action: 'click', target: 'Plan', role: 'AXStaticText' });
    expect(f.delivered).toEqual([{ action: 'select', elementPath: [0, 0], value: undefined }]);
    expect(result).toMatchObject({ success: true, actionDelivered: true, verificationPassed: true, axAction: 'select', resolved: { role: 'AXRow' } });
    expect(result.postAction).toMatchObject({ reason: 'target-state', targetSelected: true });
  });

  it('accepts repeated selection as an observed absolute state, not a fabricated change', async () => {
    const f = fixture(sidebar(true), () => {});
    const result = await f.action({ action: 'select', target: 'Plan' });
    expect(result).toMatchObject({ success: true, verificationPassed: true });
    expect(result.postAction).toMatchObject({ stateChanged: false, targetSelected: true });
  });

  it('does not turn a successful AXSelected write into success if selection stays false', async () => {
    const f = fixture(sidebar(), () => {});
    const result = await f.action({ action: 'click', target: 'Plan' });
    expect(f.delivered).toHaveLength(1);
    expect(result).toMatchObject({ success: false, actionDelivered: true, verificationPassed: false, isError: true });
    expect(result.postAction).toMatchObject({ settled: true, reason: 'tree-stable', effectVerified: false });
  });

  it('rejects an actionless text node without dispatching AXPress', async () => {
    const f = fixture([element([0], 'AXStaticText', { title: 'Decorative heading' })], () => {});
    const result = await f.action({ action: 'click', target: 'Decorative heading' });
    expect(f.delivered).toHaveLength(0);
    expect(result).toMatchObject({ success: false, actionDelivered: false, verificationPassed: false });
  });

  it('reports delivered but unverified when an advertised button has no observed effect', async () => {
    const f = fixture([element([0], 'AXButton', { title: 'Save', actions: ['AXPress'] })], () => {});
    const result = await f.action({ action: 'click', target: 'Save' });
    expect(result).toMatchObject({ success: false, actionDelivered: true, verificationPassed: false });
    expect(result.postAction).toMatchObject({ settled: true, stateChanged: false, effectVerified: false });
    expect(f.delivered).toHaveLength(1);
  });

  it('does not count an already-present waiter as evidence that a no-op press worked', async () => {
    const f = fixture([element([0], 'AXButton', { title: 'Save', actions: ['AXPress'] })], () => {});
    const result = await f.action({ action: 'click', target: 'Save', waitFor: 'Save', waitTimeoutMs: 0 });
    expect(result).toMatchObject({ success: false, actionDelivered: true });
    expect(result.postAction).toMatchObject({ waitForFound: true, effectVerified: false });
  });

  it('keeps a button inside a row as a button rather than selecting the row', () => {
    const button = element([0, 0, 1], 'AXButton', { title: 'Delete', actions: ['AXPress'] });
    const tree = sidebar(); tree[0].children[0].children.push(button);
    const candidate = flattenMacOSElements(tree).find(x => x.label === 'Delete')!;
    expect(macOSActionTarget(tree, candidate, 'press')).toMatchObject({ action: 'press', element: { path: button.path } });
  });

  it('does not guess a row label from multiple different text labels', () => {
    const tree = sidebar(); tree[0].children[0].children.push(element([0, 0, 1], 'AXStaticText', { title: 'Secondary text' }));
    expect(flattenMacOSElements(tree).find(x => x.role === 'AXRow')?.label).toBe('');
  });

  it('does not route through a disabled ancestor', async () => {
    const tree = sidebar(); tree[0].children[0].enabled = false;
    const f = fixture(tree, () => {});
    const result = await f.action({ action: 'click', target: 'Plan', role: 'AXStaticText' });
    expect(result.success).toBe(false); expect(f.delivered).toHaveLength(0);
  });

  it('selects SwiftUI rows whose AXEnabled is false but AXSelected is settable', async () => {
    const tree = sidebar(); tree[0].children[0].enabled = false; tree[0].children[0].selectionSettable = true;
    const f = fixture(tree, (_input, nodes) => { nodes[0].children[0].selected = true; });
    const result = await f.action({ action: 'click', target: 'Plan' });
    expect(result).toMatchObject({ success: true, verificationPassed: true });
    expect(f.delivered[0]).toMatchObject({ action: 'select', elementPath: [0, 0] });
  });
});
