import { describe, it, expect } from 'vitest';
import {
  ViewportSchema,
  ConfigSchema,
  SessionSchema,
  SessionQuerySchema,
  ComparisonResultSchema,
  ChangedRegionSchema,
  VerdictSchema,
  AnalysisSchema,
  VIEWPORTS,
} from './schemas.js';

describe('ViewportSchema', () => {
  it('accepts valid viewport', () => {
    const result = ViewportSchema.parse({ name: 'desktop', width: 1920, height: 1080 });
    expect(result.name).toBe('desktop');
  });

  it('rejects width below 320', () => {
    expect(() => ViewportSchema.parse({ name: 'tiny', width: 100, height: 480 })).toThrow();
  });

  it('rejects width above 3840', () => {
    expect(() => ViewportSchema.parse({ name: 'huge', width: 5000, height: 480 })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => ViewportSchema.parse({ name: '', width: 1920, height: 1080 })).toThrow();
  });
});

describe('ConfigSchema', () => {
  it('accepts valid config with defaults', () => {
    const result = ConfigSchema.parse({ baseUrl: 'http://localhost:3000' });
    expect(result.outputDir).toBe('./.ibr');
    expect(result.threshold).toBe(1.0);
    expect(result.fullPage).toBe(true);
    expect(result.waitForNetworkIdle).toBe(true);
    expect(result.timeout).toBe(30000);
  });

  it('rejects invalid URL', () => {
    expect(() => ConfigSchema.parse({ baseUrl: 'not-a-url' })).toThrow();
  });

  it('rejects threshold above 100', () => {
    expect(() => ConfigSchema.parse({ baseUrl: 'http://localhost:3000', threshold: 150 })).toThrow();
  });
});

describe('SessionQuerySchema', () => {
  it('applies default limit', () => {
    const result = SessionQuerySchema.parse({});
    expect(result.limit).toBe(50);
  });

  it('accepts all filter fields', () => {
    const result = SessionQuerySchema.parse({
      route: '/home',
      status: 'baseline',
      name: 'test',
      viewport: 'desktop',
      limit: 10,
    });
    expect(result.route).toBe('/home');
    expect(result.status).toBe('baseline');
  });

  it('rejects invalid status', () => {
    expect(() => SessionQuerySchema.parse({ status: 'invalid' })).toThrow();
  });
});

describe('VerdictSchema', () => {
  it('accepts all valid verdicts', () => {
    expect(VerdictSchema.parse('MATCH')).toBe('MATCH');
    expect(VerdictSchema.parse('EXPECTED_CHANGE')).toBe('EXPECTED_CHANGE');
    expect(VerdictSchema.parse('UNEXPECTED_CHANGE')).toBe('UNEXPECTED_CHANGE');
    expect(VerdictSchema.parse('LAYOUT_BROKEN')).toBe('LAYOUT_BROKEN');
  });

  it('rejects invalid verdict', () => {
    expect(() => VerdictSchema.parse('BROKEN')).toThrow();
  });
});

describe('ComparisonResultSchema', () => {
  it('accepts valid comparison result', () => {
    const result = ComparisonResultSchema.parse({
      match: true,
      diffPercent: 0,
      diffPixels: 0,
      totalPixels: 10000,
      threshold: 0.1,
    });
    expect(result.match).toBe(true);
  });
});

describe('ChangedRegionSchema', () => {
  it('accepts valid changed region', () => {
    const result = ChangedRegionSchema.parse({
      location: 'center',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      description: 'content: 5.0% changed',
      severity: 'expected',
    });
    expect(result.severity).toBe('expected');
  });

  it('rejects invalid location', () => {
    expect(() => ChangedRegionSchema.parse({
      location: 'middle',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      description: 'test',
      severity: 'expected',
    })).toThrow();
  });
});

describe('SessionSchema', () => {
  it('accepts valid session', () => {
    const result = SessionSchema.parse({
      id: 'sess_abc123',
      name: 'Homepage',
      url: 'http://localhost:3000/',
      viewport: VIEWPORTS.desktop,
      status: 'baseline',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(result.id).toBe('sess_abc123');
    expect(result.comparison).toBeUndefined();
  });

  it('accepts session with optional comparison and analysis', () => {
    const result = SessionSchema.parse({
      id: 'sess_abc123',
      name: 'Homepage',
      url: 'http://localhost:3000/',
      viewport: VIEWPORTS.desktop,
      status: 'compared',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comparison: {
        match: true,
        diffPercent: 0,
        diffPixels: 0,
        totalPixels: 10000,
        threshold: 0.1,
      },
      analysis: {
        verdict: 'MATCH',
        summary: 'No changes',
        changedRegions: [],
        unexpectedChanges: [],
        recommendation: null,
      },
    });
    expect(result.status).toBe('compared');
    expect(result.analysis?.verdict).toBe('MATCH');
  });

  it('rejects invalid URL', () => {
    expect(() => SessionSchema.parse({
      id: 'sess_abc123',
      name: 'Homepage',
      url: 'not-a-url',
      viewport: VIEWPORTS.desktop,
      status: 'baseline',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })).toThrow();
  });
});

describe('VIEWPORTS', () => {
  it('has expected preset viewports', () => {
    expect(VIEWPORTS.desktop.width).toBe(1920);
    expect(VIEWPORTS.mobile.width).toBe(375);
    expect(VIEWPORTS.tablet.width).toBe(768);
  });

  it('all presets pass schema validation', () => {
    for (const [, viewport] of Object.entries(VIEWPORTS)) {
      expect(() => ViewportSchema.parse(viewport)).not.toThrow();
    }
  });
});
