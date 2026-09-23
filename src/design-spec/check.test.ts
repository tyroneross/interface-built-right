import { describe, expect, it } from 'vitest';
import type { ScanResult } from '../scan.js';
import { DesignSpecSchema } from './schema.js';
import { checkDesignSpec } from './check.js';
import { designSpecFromFigmaFile } from './figma.js';

const spec = DesignSpecSchema.parse({
  version: 1,
  title: 'Report',
  source: { kind: 'authored' },
  sharedStyle: { heading: {
    fontFamily: { mode: 'exact', value: 'Inter' },
    fontSize: { mode: 'bounded', min: 31, max: 33 },
    color: { mode: 'free', guidance: 'Color can vary by page' },
  } },
  views: [{
    id: 'report-desktop', route: '/report', viewport: { width: 1200, height: 800 },
    visibleText: { mode: 'exact', value: 'Report\nNext' },
    navigation: [{ label: 'Next', destination: { mode: 'exact', value: '/next' } }],
    freeRegions: [{ name: 'Background illustration' }],
    elements: [{
      id: 'heading', match: { role: 'heading', name: 'Report', level: 1 },
      text: { mode: 'exact', value: 'Report' },
      geometry: { x: { mode: 'exact', value: 20, tolerance: 1 } },
    }, {
      id: 'orb', match: { role: 'image', name: 'Orb' },
      geometry: { circumference: { mode: 'exact', value: Math.PI * 40, tolerance: 0.01 } },
    }],
  }],
});

function scanFixture(): ScanResult {
  return {
    route: '/report', viewport: { name: 'test', width: 1200, height: 800 },
    verdict: 'PASS', textCapture: 'full', visibleText: 'Report\nNext',
    regions: [],
    elements: { all: [{
      selector: 'a', tagName: 'a', text: 'Next', href: '/next',
      bounds: { x: 50, y: 50, width: 60, height: 20 },
      computedStyles: {}, interactive: { hasOnClick: false, hasHref: true, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    }], audit: { totalElements: 1, interactiveCount: 1, withHandlers: 1, withoutHandlers: 0, issues: [] } },
    content: { elements: [{
      selector: 'h1', tagName: 'h1', text: 'Report', headingLevel: 1, contentKind: 'heading',
      bounds: { x: 20, y: 20, width: 200, height: 40 },
      computedStyles: { fontFamily: 'Inter', fontSize: '32px', color: 'rgb(20, 20, 20)' },
    }, {
      selector: 'img', tagName: 'img', alt: 'Orb', contentKind: 'image',
      bounds: { x: 200, y: 20, width: 40, height: 40 },
      computedStyles: { borderRadius: '50%' },
    }] },
  } as unknown as ScanResult;
}

describe('design-spec checks', () => {
  it('checks exact geometry, bounded typography, whole copy, navigation, and circle circumference', () => {
    const report = checkDesignSpec(spec, 'report-desktop', scanFixture());
    expect(report.verdict).toBe('PASS');
    expect(report.counts.free).toBe(2);
    expect(report.findings.find(f => f.property === 'geometry.circumference')?.status).toBe('pass');
  });

  it('fails changed copy and navigation, while preserving free color', () => {
    const scan = scanFixture();
    scan.visibleText = 'Report\nGo';
    scan.elements.all[0].href = '/wrong';
    const report = checkDesignSpec(spec, 'report-desktop', scan);
    expect(report.verdict).toBe('FAIL');
    expect(report.findings.filter(f => f.status === 'fail').map(f => f.property)).toEqual(['visibleText', 'navigation.0']);
    expect(report.findings.find(f => f.property === 'style.color')?.status).toBe('free');
  });

  it('reports missing and ambiguous evidence as partial rather than passing', () => {
    const scan = scanFixture();
    scan.content = undefined;
    scan.visibleText = undefined;
    const report = checkDesignSpec(spec, 'report-desktop', scan);
    expect(report.verdict).toBe('PARTIAL');
    expect(report.counts.unmeasurable).toBeGreaterThan(0);
  });

  it('rejects duplicate element ids', () => {
    const raw = structuredClone(spec);
    raw.views[0].elements.push(raw.views[0].elements[0]);
    expect(() => DesignSpecSchema.parse(raw)).toThrow(/duplicate element id/);
  });

  it('binds a bounded alternate heading and ignores hidden duplicates', () => {
    const draft = structuredClone(spec);
    draft.views[0].elements[0].text = { mode: 'bounded', oneOf: ['Report', 'Summary'] };
    const scan = scanFixture();
    scan.content!.elements[0].text = 'Summary';
    scan.content!.elements.push({ ...scan.content!.elements[0], computedStyles: { visibility: 'hidden' } });
    const report = checkDesignSpec(draft, 'report-desktop', scan);
    expect(report.findings.find(f => f.element === 'heading' && f.property === 'text')?.status).toBe('pass');
    expect(report.findings.find(f => f.element === 'heading' && f.property === 'match')).toBeUndefined();
  });

  it('does not let two required elements share one rendered element', () => {
    const draft = structuredClone(spec);
    draft.views[0].elements.push({ ...draft.views[0].elements[0], id: 'second-heading' });
    const report = checkDesignSpec(draft, 'report-desktop', scanFixture());
    expect(report.findings.find(f => f.element === 'second-heading' && f.property === 'match')?.status).toBe('fail');
  });

  it('can bind repeated semantic links with explicit occurrences', () => {
    const draft = structuredClone(spec);
    draft.views[0].navigation = [
      { label: 'Next', occurrence: 1, destination: { mode: 'exact', value: '/next' } },
      { label: 'Next', occurrence: 2, destination: { mode: 'exact', value: '/next' } },
    ];
    const scan = scanFixture();
    scan.elements.all.push({ ...scan.elements.all[0], bounds: { x: 100, y: 50, width: 60, height: 20 } });
    expect(checkDesignSpec(draft, 'report-desktop', scan).verdict).toBe('PASS');
  });

  it('exempts bounded free regions from all-scanned coverage', () => {
    const draft = structuredClone(spec);
    draft.views[0].coverage = 'all-scanned';
    draft.views[0].freeRegions = [{ name: 'Illustration', bounds: { x: 500, y: 500, width: 100, height: 100 } }];
    const scan = scanFixture();
    scan.content!.elements.push({
      selector: 'p', tagName: 'p', text: 'Optional', contentKind: 'paragraph',
      bounds: { x: 510, y: 510, width: 50, height: 20 }, computedStyles: {},
    });
    const report = checkDesignSpec(draft, 'report-desktop', scan);
    expect(report.verdict).toBe('PASS');
    expect(report.findings.find(f => f.property === 'coverage.freeRegion')?.status).toBe('free');
  });

  it('reports an unbounded free region as partial rather than failing extra content', () => {
    const draft = structuredClone(spec);
    draft.views[0].coverage = 'all-scanned';
    const scan = scanFixture();
    scan.content!.elements.push({
      selector: 'p', tagName: 'p', text: 'Optional', contentKind: 'paragraph',
      bounds: { x: 510, y: 510, width: 50, height: 20 }, computedStyles: {},
    });
    const report = checkDesignSpec(draft, 'report-desktop', scan);
    expect(report.verdict).toBe('PARTIAL');
    expect(report.findings.find(f => f.property === 'coverage.unlisted')?.status).toBe('unmeasurable');
  });

  it('does not measure a square with only one rounded corner as a circle', () => {
    const scan = scanFixture();
    scan.content!.elements[1].computedStyles.borderRadius = '50% 0px 0px 0px';
    const report = checkDesignSpec(spec, 'report-desktop', scan);
    expect(report.findings.find(f => f.property === 'geometry.circumference')?.status).toBe('unmeasurable');
  });

  it('binds a named container region for frame geometry and paint', () => {
    const draft = structuredClone(spec);
    draft.views[0].elements.push({
      id: 'card', match: { role: 'region', name: 'Card' },
      geometry: { width: { mode: 'exact', value: 80, tolerance: 0 } },
      style: { backgroundColor: { mode: 'exact', value: 'rgb(255, 0, 0)' } },
    });
    const scan = scanFixture();
    scan.regions!.push({ name: 'Card', bounds: { x: 10, y: 10, width: 80, height: 80 },
      computedStyles: { backgroundColor: 'rgb(255, 0, 0)' } });
    expect(checkDesignSpec(draft, 'report-desktop', scan).verdict).toBe('PASS');
  });
});

describe('Figma file import', () => {
  it('keeps exact text and circle geometry without inventing semantic bindings', () => {
    const imported = designSpecFromFigmaFile({ document: { id: '0:0', children: [{
      id: '1:0', type: 'FRAME', name: 'Report', absoluteBoundingBox: { x: 100, y: 200, width: 1200, height: 800 },
      children: [{
        id: '1:1', type: 'TEXT', name: 'Title', characters: 'Report',
        absoluteBoundingBox: { x: 120, y: 220, width: 200, height: 40 },
        style: { fontFamily: 'Inter', fontSize: 32, fontWeight: 700 },
      }, {
        id: '1:2', type: 'ELLIPSE', name: 'Orb',
        size: { x: 40, y: 40 },
        absoluteBoundingBox: { x: 300, y: 220, width: 40, height: 40 },
      }],
    }] } }, '1:0', '/report');
    expect(imported.views[0].elements[0].text).toEqual({ mode: 'exact', value: 'Report' });
    expect(imported.views[0].elements[0].geometry?.x).toEqual({ mode: 'exact', value: 20, tolerance: 0 });
    expect(imported.views[0].elements[1].geometry?.circumference).toEqual({ mode: 'exact', value: Math.PI * 40, tolerance: 0 });
    expect(imported.views[0].elements[0].match).toBeUndefined();
    expect(imported.source.coverage).toEqual({ considered: 2, imported: 2, skipped: [] });
    expect(checkDesignSpec(imported, '1:0', scanFixture()).verdict).toBe('PARTIAL');
  });

  it('does not infer circle circumference from square render bounds alone', () => {
    const imported = designSpecFromFigmaFile({ document: { id: '0:0', children: [{
      id: '1:0', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [{ id: '1:1', type: 'ELLIPSE', absoluteBoundingBox: { x: 0, y: 0, width: 40, height: 40 } }],
    }] } }, '1:0', '/');
    expect(imported.views[0].elements[0].geometry?.circumference?.mode).toBe('free');
  });

  it('records visible leaves without measurable geometry instead of claiming full import', () => {
    const imported = designSpecFromFigmaFile({ document: { id: '0:0', children: [{
      id: '1:0', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [
        { id: '1:1', type: 'TEXT', characters: 'Hello', absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 } },
        { id: '1:2', type: 'VECTOR' },
      ],
    }] } }, '1:0', '/');
    expect(imported.source.coverage?.skipped).toEqual([{ id: '1:2', reason: 'missing id or positive absoluteBoundingBox' }]);
    expect(checkDesignSpec(imported, '1:0', scanFixture()).findings.some(f => f.property === 'source.coverage')).toBe(true);
  });

  it('keeps translucent Figma paint free until CSS compositing is specified', () => {
    const imported = designSpecFromFigmaFile({ document: { id: '0:0', children: [{
      id: '1:0', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [{ id: '1:1', type: 'RECTANGLE', absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 },
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 0.5 } }] }],
    }] } }, '1:0', '/');
    expect(imported.views[0].elements[0].style?.backgroundColor?.mode).toBe('free');
  });

  it('imports a painted container as well as its child', () => {
    const imported = designSpecFromFigmaFile({ document: { id: '0:0', children: [{
      id: '1:0', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [{ id: '1:1', type: 'FRAME', name: 'Card',
        absoluteBoundingBox: { x: 10, y: 10, width: 80, height: 80 },
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
        children: [{ id: '1:2', type: 'TEXT', characters: 'Card', absoluteBoundingBox: { x: 20, y: 20, width: 40, height: 20 } }],
      }],
    }] } }, '1:0', '/');
    expect(imported.source.coverage).toEqual({ considered: 2, imported: 2, skipped: [] });
    expect(imported.views[0].elements[0].sourceNode?.name).toBe('Card');
    expect(imported.views[0].elements[0].style?.backgroundColor).toEqual({ mode: 'exact', value: 'rgb(255, 0, 0)' });
  });

  it('maps a Figma prototype destination through an explicit route map', () => {
    const imported = designSpecFromFigmaFile({ document: { id: '0:0', children: [{
      id: '1:0', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [{ id: '1:1', type: 'RECTANGLE', absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 },
        reactions: [{ action: { destinationId: '2:0' } }] }],
    }] } }, '1:0', '/', undefined, { '2:0': '/next' });
    expect(imported.views[0].elements[0].href).toEqual({ mode: 'exact', value: '/next' });
    expect(imported.views[0].elements[0].sourceNode?.prototypeDestinationId).toBe('2:0');
  });
});
