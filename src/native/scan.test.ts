/**
 * D3: scanNative — the host-chrome filter and guest-AX-unreachable signal
 * must apply to every simulator platform (iOS AND watchOS), not just iOS.
 *
 * Strategy: mock every scanNative dependency so the test runs without a
 * booted simulator or the Swift extractor, following the fixture-injection
 * pattern already used in ask.test.ts / native-session-action.test.ts
 * (synthetic elements via mocked module boundaries, no live CDP/AX).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimulatorDevice } from './types.js';
import type { EnhancedElement } from '../schemas.js';

const simulatorHoist = vi.hoisted(() => ({
  getBootedDevices: vi.fn(),
  findDevice: vi.fn(),
  bootDevice: vi.fn(),
}));

vi.mock('./simulator.js', () => ({
  getBootedDevices: simulatorHoist.getBootedDevices,
  findDevice: simulatorHoist.findDevice,
  bootDevice: simulatorHoist.bootDevice,
}));

vi.mock('./capture.js', () => ({
  captureNativeScreenshot: vi.fn(),
}));

vi.mock('./viewports.js', () => ({
  getDeviceViewport: vi.fn(() => ({ name: 'native', width: 198, height: 242 })),
}));

const nativeExtractHoist = vi.hoisted(() => ({
  extractNativeElements: vi.fn(),
  mapToEnhancedElements: vi.fn(),
  isExtractorAvailable: vi.fn(() => true),
}));

vi.mock('./extract.js', () => ({
  extractNativeElements: nativeExtractHoist.extractNativeElements,
  mapToEnhancedElements: nativeExtractHoist.mapToEnhancedElements,
  isExtractorAvailable: nativeExtractHoist.isExtractorAvailable,
}));

vi.mock('./rules.js', () => ({
  auditNativeElements: vi.fn(() => []),
}));

vi.mock('../extract.js', () => ({
  analyzeElements: vi.fn(() => ({
    totalElements: 0,
    interactiveCount: 0,
    withHandlers: 0,
    withoutHandlers: 0,
    issues: [],
  })),
}));

vi.mock('../scan.js', async () => {
  const actual = await vi.importActual<typeof import('../scan.js')>('../scan.js');
  return {
    ...actual,
    aggregateIssues: vi.fn(),
    generateSummary: vi.fn(),
    applyDesignSystemCheck: vi.fn(),
    // Keep the real determineVerdict: the point of this test is that a
    // host-chrome-only extraction must actually FAIL, not that some mock
    // says so.
    determineVerdict: actual.determineVerdict,
  };
});

import { scanNative } from './scan.js';

function watchDevice(overrides: Partial<SimulatorDevice> = {}): SimulatorDevice {
  return {
    udid: 'ABCD-1234',
    name: 'Apple Watch Series 10 (46mm)',
    state: 'Booted',
    runtime: 'com.apple.CoreSimulator.SimRuntime.watchOS-26-2',
    platform: 'watchos',
    isAvailable: true,
    ...overrides,
  };
}

function hostChromeElement(overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: 'chrome-1',
    tagName: 'application',
    text: 'Simulator',
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
    a11y: { role: 'AXApplication', ariaLabel: 'Simulator', ariaDescribedBy: null },
    ...overrides,
  } as EnhancedElement;
}

describe('scanNative — D3: guest-AX-unreachable must cover watchOS, not just iOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nativeExtractHoist.isExtractorAvailable.mockReturnValue(true);
  });

  it('flags a host-chrome-only extraction on a watchOS device as a FAIL, naming the platform', async () => {
    simulatorHoist.getBootedDevices.mockResolvedValue([watchDevice()]);
    nativeExtractHoist.extractNativeElements.mockResolvedValue([]);
    // Same shape the D1/D2 fix targets: AXApplication + AXMenuBar(nav) +
    // AXMenuBarItem, mapped to the tagNames HOST_CHROME_TAGS filters.
    nativeExtractHoist.mapToEnhancedElements.mockReturnValue([
      hostChromeElement({ tagName: 'application', text: 'Simulator' }),
      hostChromeElement({ tagName: 'nav', text: '_NS:1311' }),
      hostChromeElement({ tagName: 'menubaritem', text: 'File' }),
    ]);

    const result = await scanNative({ screenshot: false });

    expect(result.platform).toBe('watchos');
    // Pre-fix behavior: device.platform === 'ios' gated the filter, so on
    // watchOS these three host-chrome elements would have passed straight
    // through as "app content" and the scan would report PASS.
    expect(result.elements.all).toEqual([]);
    // determineVerdict needs 3+ errors for FAIL and 1+ for ISSUES — the point
    // here is "not PASS" (pre-fix behavior on watchOS was a clean PASS).
    expect(result.verdict).not.toBe('PASS');
    const guestUnreachable = result.issues.find((i) =>
      i.description.includes('guest accessibility tree is unreachable'),
    );
    expect(guestUnreachable).toBeDefined();
    expect(guestUnreachable!.description).toMatch(/^watchos /);
    expect(guestUnreachable!.severity).toBe('error');
  });

  it('still reports real app content cleanly on watchOS (filter does not over-fire)', async () => {
    simulatorHoist.getBootedDevices.mockResolvedValue([watchDevice()]);
    nativeExtractHoist.extractNativeElements.mockResolvedValue([]);
    nativeExtractHoist.mapToEnhancedElements.mockReturnValue([
      hostChromeElement({ tagName: 'button', text: 'Start', interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' } } as Partial<EnhancedElement>),
      hostChromeElement({ tagName: 'div', text: 'Pomodoro' }),
    ]);

    const result = await scanNative({ screenshot: false });

    expect(result.elements.all.length).toBe(2);
    const guestUnreachable = result.issues.find((i) =>
      i.description.includes('guest accessibility tree is unreachable'),
    );
    expect(guestUnreachable).toBeUndefined();
  });
});
