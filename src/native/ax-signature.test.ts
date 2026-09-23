import { describe, it, expect } from 'vitest';
import { axSignature } from './ax-signature.js';
import type { NativeExtraction } from './backend.js';
import type { MacOSAXElement, NativeElement } from './types.js';

function macElement(overrides: Partial<MacOSAXElement> = {}): MacOSAXElement {
  return {
    role: 'AXButton',
    subrole: null,
    title: 'Save',
    description: null,
    identifier: null,
    value: null,
    enabled: true,
    focused: false,
    actions: ['AXPress'],
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
    children: [],
    path: [0],
    ...overrides,
  };
}

function macExtraction(overrides: {
  windowId?: number;
  title?: string;
  elements?: MacOSAXElement[];
} = {}): NativeExtraction {
  return {
    kind: 'macos',
    elements: overrides.elements ?? [],
    window: {
      windowId: overrides.windowId ?? 1,
      width: 800,
      height: 600,
      title: overrides.title ?? 'Untitled',
    },
  };
}

function simElement(overrides: Partial<NativeElement> = {}): NativeElement {
  return {
    identifier: 'row',
    label: 'Row',
    role: 'Cell',
    traits: [],
    frame: { x: 0, y: 0, width: 10, height: 10 },
    isEnabled: true,
    value: null,
    path: [0],
    children: [],
    ...overrides,
  };
}

function simExtraction(elements: NativeElement[]): NativeExtraction {
  return {
    kind: 'simulator',
    elements,
    device: {
      udid: 'abc',
      name: 'iPhone 16',
      state: 'Booted',
      runtime: 'iOS 18.0',
      platform: 'ios',
      isAvailable: true,
    },
  };
}

describe('axSignature', () => {
  it('differs for a macOS row reorder with identical window/count/focus', () => {
    const cardA = macElement({ role: 'AXRow', title: 'Card A', path: [0] });
    const cardB = macElement({ role: 'AXRow', title: 'Card B', path: [1] });

    const before = macExtraction({ elements: [cardA, cardB] });
    const after = macExtraction({ elements: [cardB, cardA] });

    expect(axSignature(before)).not.toBe(axSignature(after));
  });

  it('is identical for two identical macOS trees', () => {
    const cardA = macElement({ role: 'AXRow', title: 'Card A', path: [0] });
    const cardB = macElement({ role: 'AXRow', title: 'Card B', path: [1] });

    const first = macExtraction({ elements: [cardA, cardB] });
    const second = macExtraction({
      elements: [
        macElement({ role: 'AXRow', title: 'Card A', path: [0] }),
        macElement({ role: 'AXRow', title: 'Card B', path: [1] }),
      ],
    });

    expect(axSignature(first)).toBe(axSignature(second));
  });

  it('differs for a simulator row reorder with identical count', () => {
    const rowA = simElement({ label: 'Card A', path: [0] });
    const rowB = simElement({ label: 'Card B', path: [1] });

    const before = simExtraction([rowA, rowB]);
    const after = simExtraction([rowB, rowA]);

    expect(axSignature(before)).not.toBe(axSignature(after));
  });
});
