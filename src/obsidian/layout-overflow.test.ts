import { describe, it, expect } from 'vitest';
import {
  analyzeLayoutOverflow,
  attributeCulprit,
  buildLayoutOverflowProbe,
  type LayoutOverflowNode,
} from './layout-overflow.js';

/**
 * The canonical regression: a `<button>` used as a multi-line layout container.
 *
 * Obsidian's app.css pins every button to `height: var(--input-height)` (30px).
 * The row's content measures 78px, so 48px paints outside the button and ~19px
 * of it lands on the next row's title — text over text, with the row divider
 * cutting through it.
 *
 * The fixture is GENERATED from one flag rather than hand-authored twice, so
 * the mutation check is real: `constrained: false` removes the height pin and
 * every downstream number (row height, row offsets, span positions) follows
 * from it, exactly as the browser would recompute them. Two hand-written
 * fixtures would only prove the analyzer agrees with whoever typed them.
 */

const CONTENT_H = 78; // measured intrinsic height of the row's content
const BUTTON_PIN = 30; // --input-height
const PAD_TOP = 10;
const PAD_BOTTOM = 19;
const ROW0_Y = 496;
const ROW_W = 820;

interface FixtureOptions {
  constrained: boolean;
  rows?: number;
}

function node(partial: Partial<LayoutOverflowNode> & Pick<LayoutOverflowNode, 'index' | 'selector' | 'tagName'>): LayoutOverflowNode {
  const rect = partial.rect ?? { x: 0, y: 0, width: 0, height: 0 };
  return {
    parent: null,
    depth: 0,
    ownText: '',
    clientWidth: Math.round(rect.width),
    clientHeight: Math.round(rect.height),
    scrollWidth: Math.round(rect.width),
    scrollHeight: Math.round(rect.height),
    overflowX: 'visible',
    overflowY: 'visible',
    display: 'block',
    position: 'static',
    height: `${rect.height}px`,
    minHeight: '0px',
    maxHeight: 'none',
    width: `${rect.width}px`,
    minWidth: '0px',
    maxWidth: 'none',
    boxSizing: 'border-box',
    hasTransform: false,
    inputHeightVar: '30px',
    ...partial,
    rect,
  };
}

/** Build the measured tree a real probe would return for this view. */
function focusListFixture({ constrained, rows = 3 }: FixtureOptions): LayoutOverflowNode[] {
  const buttonBoxH = constrained ? BUTTON_PIN : CONTENT_H;
  const rowH = PAD_TOP + buttonBoxH + PAD_BOTTOM;

  const nodes: LayoutOverflowNode[] = [
    node({
      index: 0,
      parent: null,
      depth: 0,
      selector: 'ul#focus-list',
      tagName: 'UL',
      rect: { x: 0, y: ROW0_Y, width: ROW_W, height: rowH * rows },
    }),
  ];

  for (let r = 0; r < rows; r++) {
    const rowY = ROW0_Y + r * rowH;
    const btnY = rowY + PAD_TOP;
    const liIndex = nodes.length;

    nodes.push(
      node({
        index: liIndex,
        parent: 0,
        depth: 1,
        selector: `ul#focus-list > li.task-row:nth-of-type(${r + 1})`,
        tagName: 'LI',
        rect: { x: 0, y: rowY, width: ROW_W, height: rowH },
      }),
    );

    const btnIndex = nodes.length;
    nodes.push(
      node({
        index: btnIndex,
        parent: liIndex,
        depth: 2,
        selector: `ul#focus-list > li.task-row:nth-of-type(${r + 1}) > button.task-row-button`,
        tagName: 'BUTTON',
        rect: { x: 0, y: btnY, width: ROW_W, height: buttonBoxH },
        display: 'grid',
        clientHeight: buttonBoxH,
        // The browser reports the FULL content extent here regardless of the pin.
        scrollHeight: CONTENT_H,
        height: `${buttonBoxH}px`,
      }),
    );

    const innerIndex = nodes.length;
    nodes.push(
      node({
        index: innerIndex,
        parent: btnIndex,
        depth: 3,
        selector: `ul#focus-list > li.task-row:nth-of-type(${r + 1}) > button.task-row-button > div.row-body`,
        tagName: 'DIV',
        rect: { x: 0, y: btnY, width: ROW_W, height: CONTENT_H },
        height: 'auto',
      }),
    );

    nodes.push(
      node({
        index: nodes.length,
        parent: innerIndex,
        depth: 4,
        selector: `ul#focus-list > li.task-row:nth-of-type(${r + 1}) > button.task-row-button > div.row-body > span.row-title`,
        tagName: 'SPAN',
        display: 'inline',
        ownText: `Task title for row ${r + 1}`,
        rect: { x: 0, y: btnY, width: 600, height: 20 },
      }),
    );

    nodes.push(
      node({
        index: nodes.length,
        parent: innerIndex,
        depth: 4,
        selector: `ul#focus-list > li.task-row:nth-of-type(${r + 1}) > button.task-row-button > div.row-body > span.row-meta`,
        tagName: 'SPAN',
        display: 'inline',
        ownText: `Overdue · row ${r + 1}`,
        rect: { x: 0, y: btnY + CONTENT_H - 20, width: 300, height: 20 },
      }),
    );
  }

  return nodes;
}

describe('analyzeLayoutOverflow — the 30px button regression', () => {
  const findings = analyzeLayoutOverflow(focusListFixture({ constrained: true }));

  it('fires', () => {
    expect(findings.length).toBeGreaterThan(0);
  });

  it('reports the button overflowing its own box, with the exact spill', () => {
    const self = findings.filter((f) => f.kind === 'self-overflow' && f.tagName === 'BUTTON');
    expect(self).toHaveLength(3); // one per row
    // 78px of content in a 30px box.
    expect(self[0].spillPx).toBe(CONTENT_H - BUTTON_PIN);
    expect(self[0].severity).toBe('warning');
    expect(self[0].axis).toBe('vertical');
  });

  it('names Obsidian’s base rule as the culprit, not just "something overlaps"', () => {
    const self = findings.find((f) => f.kind === 'self-overflow' && f.tagName === 'BUTTON')!;
    expect(self.culprit).toBeDefined();
    expect(self.culprit!.origin).toBe('obsidian-base');
    expect(self.culprit!.property).toBe('height');
    expect(self.culprit!.value).toBe('30px');
    expect(self.culprit!.note).toContain('--input-height');
    expect(self.fix).toContain('height: auto');
    expect(self.fix).toContain('min-height: 0');
  });

  it('reports the cross-element collision as an ERROR with both texts named', () => {
    const overlaps = findings.filter((f) => f.kind === 'sibling-overlap');
    expect(overlaps.length).toBeGreaterThan(0);
    expect(overlaps[0].severity).toBe('error');
    // Row 1's meta chip lands on row 2's title. The finding names the higher
    // element first (findings are built from a y-sorted sweep).
    expect(overlaps[0].text).toContain('Overdue · row 1');
    expect(overlaps[0].otherText).toContain('Task title for row 2');
    expect(overlaps[0].spillPx).toBeGreaterThan(4);
    expect(overlaps[0].detail).toContain('text is rendering on top of text');
  });

  it('attributes the collision back to the constraining button', () => {
    const overlap = findings.find((f) => f.kind === 'sibling-overlap')!;
    expect(overlap.culprit?.origin).toBe('obsidian-base');
    expect(overlap.culprit?.selector).toContain('button.task-row-button');
  });

  it('sorts errors ahead of warnings', () => {
    expect(findings[0].severity).toBe('error');
  });
});

describe('analyzeLayoutOverflow — mutation check', () => {
  it('goes completely quiet once the height constraint is removed', () => {
    const findings = analyzeLayoutOverflow(focusListFixture({ constrained: false }));
    expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
  });

  it('the ONLY difference between the two fixtures is the height pin', () => {
    const bad = focusListFixture({ constrained: true });
    const good = focusListFixture({ constrained: false });
    const badButton = bad.find((n) => n.tagName === 'BUTTON')!;
    const goodButton = good.find((n) => n.tagName === 'BUTTON')!;
    expect(badButton.height).toBe('30px');
    expect(goodButton.height).toBe('78px');
    // Same content in both — the defect is the box, not the content.
    expect(badButton.scrollHeight).toBe(goodButton.scrollHeight);
  });
});

describe('analyzeLayoutOverflow — precision guards', () => {
  it('ignores scrollable boxes: overflow:auto is a scroll region, not a defect', () => {
    const nodes = focusListFixture({ constrained: true }).map((n) =>
      n.tagName === 'BUTTON' ? { ...n, overflowY: 'auto', overflowX: 'auto' } : n,
    );
    expect(nodes.some((n) => n.overflowY === 'auto')).toBe(true);
    expect(analyzeLayoutOverflow(nodes).some((f) => f.kind === 'self-overflow')).toBe(false);
  });

  it('ignores out-of-flow elements — an absolute overlay is positioned on purpose', () => {
    const nodes = focusListFixture({ constrained: true }).map((n) =>
      n.display === 'inline' ? { ...n, position: 'absolute' } : n,
    );
    expect(analyzeLayoutOverflow(nodes).some((f) => f.kind === 'sibling-overlap')).toBe(false);
  });

  it('ignores transformed elements — a transform moves paint, not layout', () => {
    const nodes = focusListFixture({ constrained: true }).map((n) =>
      n.display === 'inline' ? { ...n, hasTransform: true } : n,
    );
    expect(analyzeLayoutOverflow(nodes).some((f) => f.kind === 'sibling-overlap')).toBe(false);
  });

  it('never reports an ancestor overlapping its own descendant', () => {
    const nodes = focusListFixture({ constrained: true });
    const findings = analyzeLayoutOverflow(nodes);
    const bySelector = new Map(nodes.map((n) => [n.selector, n]));
    for (const f of findings.filter((x) => x.kind === 'sibling-overlap')) {
      const a = bySelector.get(f.selector)!;
      const b = bySelector.get(f.otherSelector!)!;
      expect(a.selector.startsWith(b.selector)).toBe(false);
      expect(b.selector.startsWith(a.selector)).toBe(false);
    }
  });

  it('stays quiet on a clean layout', () => {
    const clean: LayoutOverflowNode[] = [
      node({ index: 0, selector: 'div#root', tagName: 'DIV', rect: { x: 0, y: 0, width: 400, height: 100 } }),
      node({
        index: 1,
        parent: 0,
        depth: 1,
        selector: 'div#root > p.a',
        tagName: 'P',
        ownText: 'first',
        rect: { x: 0, y: 0, width: 400, height: 50 },
      }),
      node({
        index: 2,
        parent: 0,
        depth: 1,
        selector: 'div#root > p.b',
        tagName: 'P',
        ownText: 'second',
        rect: { x: 0, y: 50, width: 400, height: 50 },
      }),
    ];
    expect(analyzeLayoutOverflow(clean)).toEqual([]);
  });

  it('respects raised thresholds', () => {
    const nodes = focusListFixture({ constrained: true });
    expect(
      analyzeLayoutOverflow(nodes, { selfOverflowPx: 500, overlapPx: 500, containerEscapePx: 500 }),
    ).toEqual([]);
  });

  it('raising one threshold does not convert a suppressed finding into an emitted one', () => {
    // Suppression keys off the measured overflow, not off whether a finding
    // cleared the report threshold. Raising selfOverflowPx must silence the
    // self-overflow WITHOUT unmasking the container-escape it was hiding.
    const nodes = focusListFixture({ constrained: true });
    const quietened = analyzeLayoutOverflow(nodes, { selfOverflowPx: 500 });
    expect(quietened.some((f) => f.kind === 'self-overflow')).toBe(false);
    expect(quietened.some((f) => f.kind === 'container-escape')).toBe(false);
  });

  it('caps the finding count', () => {
    const nodes = focusListFixture({ constrained: true, rows: 40 });
    expect(analyzeLayoutOverflow(nodes, { maxFindings: 5 })).toHaveLength(5);
  });

  it('handles an empty measurement without throwing', () => {
    expect(analyzeLayoutOverflow([])).toEqual([]);
  });
});

describe('container-escape', () => {
  it('catches an escape that scrollHeight cannot see, and is suppressed when it can', () => {
    // A child sticking out of a parent that reports NO self-overflow — the case
    // scrollHeight misses (here: the parent is a clean box, the child is not).
    const nodes: LayoutOverflowNode[] = [
      node({
        index: 0,
        selector: 'div#card',
        tagName: 'DIV',
        rect: { x: 0, y: 0, width: 300, height: 100 },
        clientHeight: 100,
        scrollHeight: 100,
      }),
      node({
        index: 1,
        parent: 0,
        depth: 1,
        selector: 'div#card > div.badge',
        tagName: 'DIV',
        rect: { x: 0, y: 60, width: 300, height: 80 }, // 40px past the parent
      }),
    ];
    const findings = analyzeLayoutOverflow(nodes);
    const escape = findings.find((f) => f.kind === 'container-escape');
    expect(escape).toBeDefined();
    expect(escape!.spillPx).toBe(40);
    expect(escape!.otherSelector).toBe('div#card');
    expect(escape!.detail).toContain('below');

    // The button case DOES report self-overflow, so the escape is suppressed
    // and the defect is reported exactly once from the parent's side.
    const button = analyzeLayoutOverflow(focusListFixture({ constrained: true }));
    expect(
      button.filter((f) => f.kind === 'container-escape' && f.otherSelector?.includes('button')),
    ).toHaveLength(0);
  });
});

describe('attributeCulprit', () => {
  const base = node({
    index: 0,
    selector: 'div#x',
    tagName: 'DIV',
    rect: { x: 0, y: 0, width: 100, height: 30 },
  });

  it('claims obsidian-base only for a form control matching --input-height', () => {
    const button = { ...base, tagName: 'BUTTON', height: '30px', inputHeightVar: '30px', scrollHeight: 78 };
    expect(attributeCulprit(button, 'vertical').origin).toBe('obsidian-base');

    // Same numbers, but a <div> — Obsidian's rule does not apply to it.
    const div = { ...button, tagName: 'DIV' };
    expect(attributeCulprit(div, 'vertical').origin).toBe('author');

    // A button whose height does NOT match the variable was sized by someone else.
    const custom = { ...button, height: '44px' };
    expect(attributeCulprit(custom, 'vertical').origin).toBe('author');

    // No --input-height defined at all = the harness ran without app.css.
    const noVar = { ...button, inputHeightVar: '' };
    expect(attributeCulprit(noVar, 'vertical').origin).toBe('author');
  });

  it('reports max-height when that is what caps the box', () => {
    const capped = { ...base, height: 'auto', maxHeight: '40px', scrollHeight: 120 };
    const culprit = attributeCulprit(capped, 'vertical');
    expect(culprit.property).toBe('max-height');
    expect(culprit.value).toBe('40px');
  });

  it('says "unknown" rather than guessing when nothing on the element constrains it', () => {
    const unconstrained = { ...base, height: 'auto', maxHeight: 'none', scrollHeight: 30 };
    expect(attributeCulprit(unconstrained, 'vertical').origin).toBe('unknown');
  });
});

describe('buildLayoutOverflowProbe', () => {
  it('is a self-contained expression with no template-literal leakage', () => {
    const probe = buildLayoutOverflowProbe();
    expect(probe.startsWith('(function ()')).toBe(true);
    expect(probe.trimEnd().endsWith('})()')).toBe(true);
    expect(probe).not.toContain('${');
  });

  it('embeds the root selector and node cap as literals', () => {
    const probe = buildLayoutOverflowProbe({ rootSelector: '#custom', maxNodes: 12 });
    expect(probe).toContain('"#custom"');
    expect(probe).toContain('var MAX = 12;');
  });

  it('defaults to the harness container', () => {
    expect(buildLayoutOverflowProbe()).toContain('"#ibr-container"');
  });

  it('reads --input-height, which is what makes the attribution possible', () => {
    expect(buildLayoutOverflowProbe()).toContain("getPropertyValue('--input-height')");
  });

  it('parses as valid JavaScript', () => {
    // A syntax error here would surface as a silently-lost probe, so it is
    // worth catching in the unit job rather than in a browser run.
    expect(() => new Function(`return ${buildLayoutOverflowProbe()};`)).not.toThrow();
  });
});
