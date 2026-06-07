/**
 * Layout-fill / gap analyzer — fixture tests.
 *
 * AX-independent. These tests construct synthetic MacOSAXElement trees in
 * memory and assert what the analyzer reports. The real Swift extractor is
 * never invoked here — the analyzer's input contract IS the JSON shape Swift
 * already emits, so the fixture covers the real flow.
 *
 * Headlines:
 *  - ET regression: a 440px child centered in a 1074px container emits a
 *    horizontal layout-fill finding with a ~29.5% leading band (the bug class
 *    that missed the ET terminal pane).
 *  - Negative: a 970px child in a 1000px container does NOT emit a finding.
 *  - Threshold respected: same fixture under threshold=0.40 emits nothing.
 *  - Vertical axis works symmetrically.
 *  - Containers with no children are silent.
 *  - Element size reports are correct.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeLayoutFill,
  reportElementSizes,
  type LayoutFillFinding,
} from './layout-fill.js';
import type { MacOSAXElement } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(opts: {
  role: string;
  title?: string | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  path?: number[];
  children?: MacOSAXElement[];
}): MacOSAXElement {
  const hasFrame = opts.x !== undefined && opts.y !== undefined && opts.w !== undefined && opts.h !== undefined;
  return {
    role: opts.role,
    subrole: null,
    title: opts.title ?? null,
    description: null,
    identifier: null,
    value: null,
    enabled: true,
    focused: false,
    actions: [],
    position: hasFrame ? { x: opts.x!, y: opts.y! } : null,
    size: hasFrame ? { width: opts.w!, height: opts.h! } : null,
    children: opts.children ?? [],
    path: opts.path ?? [],
  };
}

// ---------------------------------------------------------------------------
// ET regression — the bug that motivated this analyzer
// ---------------------------------------------------------------------------
//
// Easy Terminal rendered its terminal canvas at ~440px wide, centered inside a
// ~1074px container, with empty gutters on both sides (~317px leading + ~317px
// trailing). It passed every existing screenshot / a11y / touch-target check.
// The analyzer must catch it as a numeric finding.

describe('analyzeLayoutFill — ET regression case', () => {
  // Container: x=0..1074 (width 1074)
  // Child:     x=317..757 (width 440), centered (gutters 317 each)
  const etTree: MacOSAXElement[] = [
    el({
      role: 'AXSplitGroup',
      title: 'Main',
      x: 0,
      y: 0,
      w: 1074,
      h: 700,
      children: [
        el({
          role: 'AXGroup',
          title: 'Terminal',
          x: 317,
          y: 0,
          w: 440,
          h: 700,
        }),
      ],
    }),
  ];

  it('emits at least one horizontal layout-fill finding above default 0.12 threshold', () => {
    const findings = analyzeLayoutFill(etTree);
    const horiz = findings.filter((f) => f.axis === 'horizontal');
    expect(horiz.length).toBeGreaterThan(0);
  });

  it('reports the largest band as ~317px = ~29.5% of container width', () => {
    const findings = analyzeLayoutFill(etTree);
    const horiz = findings.find(
      (f) => f.axis === 'horizontal' && f.containerRole === 'AXSplitGroup'
    );
    expect(horiz).toBeDefined();
    expect(horiz!.emptyPx).toBe(317);
    // 317 / 1074 = 0.29516… so check within tight tolerance
    expect(horiz!.emptyPct).toBeCloseTo(0.2952, 3);
    // Position is "leading" because leading & trailing are tied and our scan
    // sees leading first (sets best from 0 → 317), so trailing must STRICTLY
    // beat to flip the verdict.
    expect(horiz!.position).toBe('leading');
    expect(horiz!.containerWidth).toBe(1074);
  });

  it('detail string carries the numbers and the container label', () => {
    const findings = analyzeLayoutFill(etTree);
    const horiz = findings.find((f) => f.axis === 'horizontal')!;
    expect(horiz.detail).toContain('317px');
    expect(horiz.detail).toContain('30%'); // 29.5 rounds to 30
    expect(horiz.detail).toContain('1074px');
    expect(horiz.detail).toContain('Main');
  });

  it('threshold = 0.40 suppresses the ET finding (29.5% < 40%)', () => {
    const findings = analyzeLayoutFill(etTree, { threshold: 0.4 });
    const horiz = findings.filter((f) => f.axis === 'horizontal');
    expect(horiz.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Negative cases — well-filled containers should be silent
// ---------------------------------------------------------------------------

describe('analyzeLayoutFill — negative cases', () => {
  it('child filling 97% of its container emits no horizontal finding', () => {
    // Container 1000 wide, child 970 wide at x=15 → gutters 15 each = 1.5%
    const tree: MacOSAXElement[] = [
      el({
        role: 'AXGroup',
        x: 0,
        y: 0,
        w: 1000,
        h: 600,
        children: [el({ role: 'AXGroup', x: 15, y: 0, w: 970, h: 600 })],
      }),
    ];
    const findings = analyzeLayoutFill(tree);
    expect(
      findings.filter((f) => f.axis === 'horizontal' && f.containerRole === 'AXGroup')
    ).toEqual([]);
  });

  it('container with no children emits nothing', () => {
    const tree: MacOSAXElement[] = [
      el({ role: 'AXGroup', x: 0, y: 0, w: 800, h: 600, children: [] }),
    ];
    expect(analyzeLayoutFill(tree)).toEqual([]);
  });

  it('container with children that have no frames is silent (no laid-out kids)', () => {
    const tree: MacOSAXElement[] = [
      el({
        role: 'AXGroup',
        x: 0,
        y: 0,
        w: 800,
        h: 600,
        children: [el({ role: 'AXStaticText' })], // no x/y/w/h
      }),
    ];
    expect(analyzeLayoutFill(tree)).toEqual([]);
  });

  it('containers below minContainerPx are skipped', () => {
    // 40px container with a narrow child — under default 50px floor.
    const tree: MacOSAXElement[] = [
      el({
        role: 'AXGroup',
        x: 0,
        y: 0,
        w: 40,
        h: 40,
        children: [el({ role: 'AXButton', x: 0, y: 0, w: 10, h: 40 })],
      }),
    ];
    expect(analyzeLayoutFill(tree)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Vertical axis
// ---------------------------------------------------------------------------

describe('analyzeLayoutFill — vertical axis', () => {
  it('reports a centered vertical child as a vertical-axis finding', () => {
    // Container 800x1000, child 800x300 at y=350 → top 350 / bottom 350 gaps
    const tree: MacOSAXElement[] = [
      el({
        role: 'AXGroup',
        title: 'Stack',
        x: 0,
        y: 0,
        w: 800,
        h: 1000,
        children: [el({ role: 'AXGroup', x: 0, y: 350, w: 800, h: 300 })],
      }),
    ];
    const findings = analyzeLayoutFill(tree);
    const vert = findings.find((f) => f.axis === 'vertical');
    expect(vert).toBeDefined();
    expect(vert!.emptyPx).toBe(350);
    expect(vert!.emptyPct).toBeCloseTo(0.35, 2);
  });
});

// ---------------------------------------------------------------------------
// Between-siblings gap — the "two columns with a chasm" case
// ---------------------------------------------------------------------------

describe('analyzeLayoutFill — between-siblings band', () => {
  it('flags a wide between-siblings gap as position="between"', () => {
    // Container 1000 wide, two children: 0..200 and 700..1000 → leading 0,
    // between 500, trailing 0. Largest band is between.
    const tree: MacOSAXElement[] = [
      el({
        role: 'AXGroup',
        x: 0,
        y: 0,
        w: 1000,
        h: 600,
        children: [
          el({ role: 'AXGroup', x: 0, y: 0, w: 200, h: 600 }),
          el({ role: 'AXGroup', x: 700, y: 0, w: 300, h: 600 }),
        ],
      }),
    ];
    const findings = analyzeLayoutFill(tree);
    const horiz = findings.find((f) => f.axis === 'horizontal')!;
    expect(horiz.position).toBe('between');
    expect(horiz.emptyPx).toBe(500);
    expect(horiz.emptyPct).toBeCloseTo(0.5, 2);
  });
});

// ---------------------------------------------------------------------------
// Recursion — nested containers each get analyzed
// ---------------------------------------------------------------------------

describe('analyzeLayoutFill — recursion', () => {
  it('walks nested containers independently', () => {
    // Outer 1200 with one inner that fills it; inner 1200 with a centered
    // 400-wide child → inner emits a finding, outer does not.
    const tree: MacOSAXElement[] = [
      el({
        role: 'AXWindow',
        x: 0,
        y: 0,
        w: 1200,
        h: 800,
        children: [
          el({
            role: 'AXGroup',
            title: 'Inner',
            x: 0,
            y: 0,
            w: 1200,
            h: 800,
            children: [el({ role: 'AXButton', x: 400, y: 350, w: 400, h: 100 })],
          }),
        ],
      }),
    ];
    const findings = analyzeLayoutFill(tree);
    // Outer's child (Inner) fills it → no outer horizontal finding.
    expect(
      findings.find((f) => f.axis === 'horizontal' && f.containerRole === 'AXWindow')
    ).toBeUndefined();
    // Inner's child is centered narrow → horizontal AND vertical findings.
    const innerHoriz = findings.find(
      (f) => f.axis === 'horizontal' && f.containerRole === 'AXGroup'
    );
    expect(innerHoriz).toBeDefined();
    expect(innerHoriz!.emptyPx).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Sort order — highest impact first
// ---------------------------------------------------------------------------

describe('analyzeLayoutFill — sort order', () => {
  it('returns findings sorted by emptyPct descending', () => {
    const tree: MacOSAXElement[] = [
      el({
        role: 'AXGroup',
        title: 'A',
        x: 0,
        y: 0,
        w: 1000,
        h: 600,
        children: [
          el({ role: 'AXGroup', x: 500, y: 0, w: 500, h: 600 }), // 50% leading band
        ],
      }),
      el({
        role: 'AXGroup',
        title: 'B',
        x: 0,
        y: 700,
        w: 1000,
        h: 600,
        children: [
          el({ role: 'AXGroup', x: 200, y: 700, w: 800, h: 600 }), // 20% leading band
        ],
      }),
    ];
    const findings = analyzeLayoutFill(tree).filter((f) => f.axis === 'horizontal');
    expect(findings[0].containerLabel).toBe('A');
    expect(findings[1].containerLabel).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Relative-size report
// ---------------------------------------------------------------------------

describe('reportElementSizes', () => {
  it('reports width/height % of window correctly', () => {
    const tree: MacOSAXElement[] = [
      el({
        role: 'AXGroup',
        x: 0,
        y: 0,
        w: 1000,
        h: 800,
        children: [el({ role: 'AXButton', title: 'X', x: 100, y: 100, w: 200, h: 80 })],
      }),
    ];
    const sizes = reportElementSizes(tree, { width: 1000, height: 800 });
    const button = sizes.find((s) => s.role === 'AXButton');
    expect(button).toBeDefined();
    expect(button!.widthPctOfWindow).toBeCloseTo(0.2, 4);
    expect(button!.heightPctOfWindow).toBeCloseTo(0.1, 4);
  });

  it('null %s when window not supplied', () => {
    const tree: MacOSAXElement[] = [
      el({ role: 'AXButton', x: 0, y: 0, w: 200, h: 80 }),
    ];
    const sizes = reportElementSizes(tree);
    expect(sizes[0].widthPctOfWindow).toBeNull();
    expect(sizes[0].heightPctOfWindow).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Smoke types — ensure exported types are usable
// ---------------------------------------------------------------------------

describe('exported types', () => {
  it('LayoutFillFinding can be narrowed by axis', () => {
    const f: LayoutFillFinding = {
      containerRole: 'AXGroup',
      containerLabel: 'X',
      axis: 'horizontal',
      emptyPx: 100,
      emptyPct: 0.5,
      position: 'leading',
      containerWidth: 200,
      containerHeight: 100,
      detail: 'whatever',
    };
    expect(f.axis).toBe('horizontal');
  });
});
