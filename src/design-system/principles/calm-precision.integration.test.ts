/**
 * Calm Precision trust regression, driven through the real `scan()` in Chrome.
 *
 * IBR verdicts are only useful if a page that FOLLOWS Calm Precision passes.
 * `calm-compliant.html` holds every pattern the rules used to flag wrongly
 * (one-sided dividers, tinted cards mentioning "failed", sections that split
 * controls, a <details>/<summary> with an id, form answer buttons, slim
 * chrome) and must produce zero findings from the five checks below. Each
 * other fixture plants ONE true violation that must still fire, so a fix that
 * silences a rule outright fails here too.
 *
 * `projectDir` is a directory with no `.ibr/rules.json`, so the built-in
 * default presets (which include calm-precision) are what runs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scan, type ScanResult } from '../../scan.js';

const FIXTURES = join(__dirname, 'fixtures');
const ROUTES = ['calm-compliant', 'boxed-list', 'status-pill', 'crowded-section', 'overlap', 'chrome-heavy'];

const RULES = [
  'calm-precision/gestalt-grouping',
  'calm-precision/signal-noise-status',
  'calm-precision/cognitive-load-elements',
  'calm-precision/content-chrome-ratio',
] as const;

function findings(result: ScanResult, ruleId: string) {
  // Prefix match also catches the `-unmeasurable` variants.
  return result.issues.filter((i) => i.description.startsWith(`[${ruleId}`));
}

describe('calm-precision rules on real pages', () => {
  let server: Server;
  let baseUrl: string;
  const projectDir = tmpdir();
  const results = new Map<string, ScanResult>();

  const scanRoute = async (route: string): Promise<ScanResult> => {
    const cached = results.get(route);
    if (cached) return cached;
    const result = await scan(`${baseUrl}/${route}`, { projectDir });
    results.set(route, result);
    return result;
  };

  beforeAll(async () => {
    const result = await new Promise<{ server: Server; url: string }>((resolve) => {
      const srv = createServer((req, res) => {
        const route = (req.url || '/').split('?')[0]!.replace(/^\//, '');
        if (!ROUTES.includes(route)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(FIXTURES, `${route}.html`), 'utf8'));
      });
      srv.listen(0, '127.0.0.1', () => {
        const address = srv.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        resolve({ server: srv, url: `http://127.0.0.1:${port}` });
      });
    });
    server = result.server;
    baseUrl = result.url;
  });

  afterAll(async () => {
    const { closeBrowser } = await import('../../extract.js');
    await closeBrowser();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('a Calm-Precision-compliant page', () => {
    for (const ruleId of RULES) {
      it(`produces no ${ruleId} finding`, async () => {
        const result = await scanRoute('calm-compliant');
        expect(result.rulesApplied?.presets).toContain('calm-precision');
        expect(findings(result, ruleId).map((i) => i.description)).toEqual([]);
      }, 60_000);
    }

    it('reports no layout collision (summary inside its own details is not one)', async () => {
      const result = await scanRoute('calm-compliant');
      // Precondition: the <summary> with an id and its <details> were both
      // extracted, so the self-collision had its chance to appear.
      const selectors = result.elements.all.map((e) => e.selector);
      expect(selectors).toContain('#copy-sum');
      expect(selectors.some((s) => /details\.card$/.test(s))).toBe(true);
      expect(result.layoutCollisions?.collisions ?? []).toEqual([]);
    }, 60_000);
  });

  it('gestalt-grouping still fires on individually four-side-bordered list items', async () => {
    const result = await scanRoute('boxed-list');
    const hits = findings(result, 'calm-precision/gestalt-grouping');
    expect(hits.map((h) => h.element)).toEqual(expect.arrayContaining(['#boxed-1', '#boxed-2', '#boxed-3']));
    expect(hits[0]!.description).toContain('individually boxed');
  }, 60_000);

  it('signal-noise-status still fires on a saturated pill and a square flex-row badge', async () => {
    const result = await scanRoute('status-pill');
    const hits = findings(result, 'calm-precision/signal-noise-status');
    expect(hits.map((h) => h.element).sort()).toEqual(['#chip', '#pill']);
  }, 60_000);

  it('cognitive-load-elements fires on the section owning 12 controls, not on <main>', async () => {
    const result = await scanRoute('crowded-section');
    const hits = findings(result, 'calm-precision/cognitive-load-elements');
    expect(hits.map((h) => h.element)).toEqual(['#crowded']);
    expect(hits[0]!.description).toContain('12 visible controls');
  }, 60_000);

  it('layout collision still reports two overlapping sibling buttons', async () => {
    const result = await scanRoute('overlap');
    const pairs = (result.layoutCollisions?.collisions ?? [])
      .map((c) => [c.element1.selector, c.element2.selector].sort().join(' | '));
    expect(pairs).toEqual(['#left | #right']);
  }, 60_000);

  it('content-chrome-ratio fires on a chrome-heavy page and names each chrome element', async () => {
    const result = await scanRoute('chrome-heavy');
    const hits = findings(result, 'calm-precision/content-chrome-ratio');
    expect(hits).toHaveLength(1);
    const hit = hits[0]!;
    for (const name of ['#site-header', '#side-nav', '#site-footer']) {
      expect(hit.description).toContain(name);
    }
    const named = (hit.evidence?.chromeElements ?? []) as Array<{ selector: string; bounds: { width: number } }>;
    expect(named.map((c) => c.selector).sort()).toEqual(['#side-nav', '#site-footer', '#site-header']);
    expect(named.every((c) => c.bounds.width > 0)).toBe(true);
  }, 60_000);
});
