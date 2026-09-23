import { describe, expect, it } from 'vitest';
import type { ScanResult } from '../scan.js';
import { checkDesignSpec } from './check.js';
import { captureDesignSpec, newDesignSpec } from './capture.js';

function fullScan(): ScanResult {
  return {
    url: 'http://localhost:3000/report', route: '/report', verdict: 'PASS',
    viewport: { name: 'design', width: 1200, height: 800 },
    textCapture: 'full', visibleText: 'Report\nNext',
    elements: { all: [{
      selector: 'a', tagName: 'a', text: 'Next', href: '/next',
      bounds: { x: 20, y: 100, width: 90, height: 30 }, computedStyles: {},
      a11y: { role: 'link', ariaLabel: null },
    }], audit: {} },
    content: { elements: [{
      selector: 'h1', tagName: 'h1', text: 'Report', headingLevel: 1, contentKind: 'heading',
      bounds: { x: 20, y: 20, width: 200, height: 40 },
      computedStyles: { fontFamily: 'Inter, sans-serif', fontSize: '32px', fontWeight: '700' },
    }] },
    regions: [{ name: 'Report panel', bounds: { x: 0, y: 0, width: 400, height: 300 }, computedStyles: {} }],
  } as unknown as ScanResult;
}

describe('IBR-native design authoring', () => {
  it('creates an unreviewed authored starter without an external design file', () => {
    const spec = newDesignSpec({ title: 'Report', viewId: 'report-desktop', route: '/report', width: 1200, height: 800 });
    expect(spec.source).toEqual({ kind: 'authored', reviewed: false });
    expect(spec.views[0].elements[0].match?.name).toBe('Report');
    expect(() => newDesignSpec({ title: 'Report', viewId: 'view', route: '/report', width: NaN, height: 800 })).toThrow();
  });

  it('captures full copy, navigation, semantic regions, and measured guidance without promoting the draft', () => {
    const scan = fullScan();
    scan.elements.all[0].computedStyles = {
      backgroundColor: 'rgb(40, 47, 67)', borderTopWidth: '1px', borderStyle: 'solid',
      borderTopColor: 'rgb(57, 66, 84)', boxShadow: 'rgb(145, 155, 255) 2px 0px 0px 0px inset',
      outlineStyle: 'none', outlineWidth: '3px',
    };
    const spec = captureDesignSpec(scan, { title: 'Report', viewId: 'report-desktop', route: '/report' });
    expect(spec.source.reviewed).toBe(false);
    expect(spec.source.coverage).toEqual({ considered: 3, imported: 3, skipped: [] });
    expect(spec.views[0].visibleText).toEqual({ mode: 'exact', value: 'Report\nNext' });
    expect(spec.views[0].navigation).toEqual([{ label: 'Next', destination: { mode: 'exact', value: '/next' } }]);
    expect(spec.views[0].elements.find(el => el.match?.role === 'region')?.match?.name).toBe('Report panel');
    expect(spec.views[0].elements[0].geometry?.x).toMatchObject({ mode: 'free', guidance: expect.stringContaining('20 CSS px') });
    expect(spec.views[0].elements[0].style?.backgroundColor).toMatchObject({ mode: 'free', guidance: expect.stringContaining('rgb(40, 47, 67)') });
    expect(spec.views[0].elements[0].style?.borderTopColor).toMatchObject({ mode: 'free', guidance: expect.stringContaining('rgb(57, 66, 84)') });
    expect(spec.views[0].elements[0].style?.boxShadow).toMatchObject({ mode: 'free', guidance: expect.stringContaining('inset') });
    expect(spec.views[0].elements[0].style?.outlineWidth).toBeUndefined();
    expect(checkDesignSpec(spec, 'report-desktop', scan).verdict).toBe('PARTIAL');
    spec.source.reviewed = true;
    expect(checkDesignSpec(spec, 'report-desktop', scan).verdict).toBe('PASS');
  });

  it('requires explicit exact tolerance or bounded range and then checks the measured geometry', () => {
    const scan = fullScan();
    expect(() => captureDesignSpec(scan, { title: 'Report', viewId: 'v', route: '/report', geometry: 'exact' })).toThrow(/tolerance/);
    expect(() => captureDesignSpec(scan, { title: 'Report', viewId: 'v', route: '/report', geometry: 'bounded' })).toThrow(/range/);
    const spec = captureDesignSpec(scan, { title: 'Report', viewId: 'v', route: '/report', geometry: 'bounded', range: 4, copy: 'free' });
    expect(spec.views[0].elements[0].geometry?.x).toEqual({ mode: 'bounded', min: 16, max: 24 });
    expect(spec.views[0].visibleText?.mode).toBe('free');
    spec.source.reviewed = true;
    scan.elements.all[0].bounds.x = 30;
    expect(checkDesignSpec(spec, 'v', scan).findings.find(f => f.element === 'link-1' && f.property === 'geometry.x')?.status).toBe('fail');
  });

  it('numbers duplicate names and surfaces unbindable or incomplete observations', () => {
    const scan = fullScan();
    scan.elements.all.push({ ...scan.elements.all[0], bounds: { x: 120, y: 100, width: 90, height: 30 } });
    scan.content!.elements.push({ ...scan.content!.elements[0], text: '', headingLevel: 2 });
    scan.coverage = { axTreeCount: 4, estimatedVisible: 4, coveragePercent: 75,
      shadowDomCount: 0, canvasCount: 1, iframeCount: 0, recovered: 0, gaps: ['canvas content unavailable'] };
    const spec = captureDesignSpec(scan, { title: 'Report', viewId: 'v', route: '/report' });
    expect(spec.views[0].navigation.map(link => link.occurrence)).toEqual([1, 2]);
    expect(spec.views[0].elements.filter(el => el.match?.role === 'link').map(el => el.match?.occurrence)).toEqual([1, 2]);
    expect(spec.source.coverage?.skipped.map(item => item.reason)).toEqual([
      'visible semantic element has no accessible name', 'canvas content unavailable',
    ]);
    spec.source.reviewed = true;
    expect(checkDesignSpec(spec, 'v', scan).verdict).toBe('PARTIAL');
  });

  it('does not number same-name headings at different levels', () => {
    const scan = fullScan();
    scan.content!.elements.push({ ...scan.content!.elements[0], headingLevel: 2,
      bounds: { x: 20, y: 180, width: 200, height: 32 } });
    const spec = captureDesignSpec(scan, { title: 'Report', viewId: 'v', route: '/report' });
    const headings = spec.views[0].elements.filter(el => el.match?.role === 'heading');
    expect(headings.map(el => el.match?.occurrence)).toEqual([undefined, undefined]);
    spec.source.reviewed = true;
    expect(checkDesignSpec(spec, 'v', scan).verdict).toBe('PASS');
  });

  it('binds free copy by semantic role and order when multiple labels change', () => {
    const scan = fullScan();
    scan.elements.all.push({ ...scan.elements.all[0], text: 'More', href: '/more',
      bounds: { x: 120, y: 100, width: 90, height: 30 } });
    const spec = captureDesignSpec(scan, { title: 'Report', viewId: 'v', route: '/report', copy: 'free' });
    expect(spec.views[0].elements.filter(el => el.match?.role === 'link').map(el => el.match)).toMatchObject([
      { binding: 'role-order', occurrence: 1 }, { binding: 'role-order', occurrence: 2 },
    ]);
    spec.source.reviewed = true;
    scan.elements.all[0].text = 'Forward';
    scan.elements.all[1].text = 'Explore';
    scan.visibleText = 'Report\nForward\nExplore';
    expect(checkDesignSpec(spec, 'v', scan).verdict).toBe('PASS');
  });

  it('rejects a capped or incomplete scan instead of claiming full text coverage', () => {
    const scan = fullScan();
    scan.textCapture = undefined;
    expect(() => captureDesignSpec(scan, { title: 'Report', viewId: 'v', route: '/report' })).toThrow(/fullText/);
  });
});
