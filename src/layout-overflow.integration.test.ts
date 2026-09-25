/**
 * Live-Chrome regression for the clipped-content sensor added to web `scan`.
 *
 * Unlike `layout-overflow.test.ts` (hand-built fixtures, no browser), these
 * fixtures are driven through the REAL `scan()` against a local HTTP server —
 * `checkVisibility`, `Range.getClientRects()`, and grid track sizing all come
 * from Chrome's actual layout engine, not a simulated one. Pattern copied from
 * `src/scan-default-rules.integration.test.ts`: a plain `http` server, an
 * inline-HTML route table, `projectDir: tmpdir()` so no `.ibr/rules.json` on
 * the machine running the suite can change what rules apply, and
 * `hydrationStrategy: 'none'` since every fixture here is a static page with
 * no framework to wait for.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { tmpdir } from 'os';
import { scan } from './scan.js';

/**
 * A 3-up card grid, each card holding a two-column list whose `<li>` text is
 * an unbreakable token (a long file path with no break opportunity). `1fr` is
 * shorthand for `minmax(auto, 1fr)`, so the track floors at that token's
 * min-content width instead of shrinking to fit — the same shape as the
 * `dpl-focus` regression's button, just via grid track sizing instead of a
 * fixed height. `fixed` is the identical markup with `minmax(0, 1fr)` tracks
 * and `overflow-wrap: anywhere`, which is the prescribed remedy.
 */
const LONG_TOKEN = 'packages/web/lib/some/really/long/path/store-implementation-file.ts:147-155';

function cardGrid(colsCss: string, liCss: string): string {
  let cards = '';
  for (let i = 0; i < 3; i++) {
    cards += `
    <article class="card">
      <div class="cols" style="display:grid;${colsCss}">
        <ul><li style="${liCss}">${LONG_TOKEN} A</li></ul>
        <ul><li style="${liCss}">${LONG_TOKEN} B</li></ul>
      </div>
    </article>`;
  }
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>grid</title><style>
  body { margin: 0; font-family: system-ui; }
  .grid { display: grid; grid-template-columns: repeat(3, 348px); gap: 16px; padding: 16px; }
  .card { width: 348px; border: 1px solid #ccc; padding: 8px; }
  ul { margin: 0; padding-left: 16px; }
</style></head><body>
<div class="grid">${cards}</div>
</body></html>`;
}

const ROUTES: Record<string, string> = {
  // Broken: bare `1fr` tracks and no wrap opportunity — the track refuses to
  // shrink below the unbreakable token's min-content width and paints over
  // whatever sits below/beside it.
  '/broken': cardGrid('grid-template-columns:1fr 1fr', ''),

  // Fixed: the exact same markup with the prescribed remedy applied.
  '/fixed': cardGrid('grid-template-columns:minmax(0,1fr) minmax(0,1fr)', 'overflow-wrap:anywhere'),

  // A closed <details> holding the SAME broken markup, followed by normal
  // paragraphs. Closed disclosure content is laid out but never painted
  // (content-visibility:hidden under the hood) — it must contribute zero
  // findings, not because the defect isn't there, but because nobody sees it
  // while the disclosure is closed.
  '/details': `<!doctype html>
<html><head><meta charset="utf-8"><title>details</title><style>
  body { margin: 0; font-family: system-ui; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; width: 348px; }
  ul { margin: 0; padding-left: 16px; }
</style></head><body>
<details>
  <summary>More</summary>
  <div class="cols">
    <ul><li>${LONG_TOKEN} A</li></ul>
    <ul><li>${LONG_TOKEN} B</li></ul>
  </div>
</details>
<p>Normal paragraph one, well within its column.</p>
<p>Normal paragraph two, well within its column.</p>
</body></html>`,

  // A plain overflow:hidden box with a long single-line sentence — the `clip`
  // finding's canonical case, and its ellipsis-suppressed counterpart.
  '/clipped': `<!doctype html>
<html><head><meta charset="utf-8"><title>clipped</title><style>
  body { margin: 0; font-family: system-ui; }
  .box { width: 200px; overflow: hidden; white-space: nowrap; }
  .ellipsis { width: 200px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
</style></head><body>
<div class="box">This sentence is much too long to fit inside a 200px box without wrapping</div>
<div class="ellipsis">This sentence is much too long to fit inside a 200px box without wrapping</div>
</body></html>`,
};

function findings(result: Awaited<ReturnType<typeof scan>>, kind: string) {
  return (result.layoutOverflow ?? []).filter((f) => f.kind === kind);
}

describe('layout-overflow — live-Chrome grid-inflation regression', () => {
  let server: Server;
  let baseUrl: string;
  const projectDir = tmpdir();

  beforeAll(async () => {
    const result = await new Promise<{ server: Server; url: string }>((resolve) => {
      const srv = createServer((req, res) => {
        const path = (req.url || '/').split('?')[0];
        const html = ROUTES[path];
        res.writeHead(html ? 200 : 404, { 'Content-Type': 'text/html' });
        res.end(html ?? 'not found');
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
    const { closeBrowser } = await import('./extract.js');
    await closeBrowser();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('reports findings on the grid-inflated cards, with a matching structural issue', async () => {
    const result = await scan(`${baseUrl}/broken`, {
      projectDir,
      hydrationStrategy: 'none',
      viewport: 'desktop-sm', // 1440px
      rules: ['none'],
    });

    expect(result.layoutOverflow).toBeDefined();
    expect(result.layoutOverflow!.length).toBeGreaterThan(0);

    const onCols = (result.layoutOverflow ?? []).filter(
      (f) => f.selector.includes('cols') || f.otherSelector?.includes('cols'),
    );
    expect(
      onCols.some((f) => f.kind === 'sibling-overlap' || f.kind === 'self-overflow'),
      JSON.stringify(result.layoutOverflow, null, 2),
    ).toBe(true);

    // The grid/flex culprit branch now runs BEFORE the fixed-width branch in
    // attributeCulprit, so a REAL browser's always-resolved `width` no longer
    // masks the track-floor attribution — at least one self-overflow finding
    // on `.cols` must name the actual grid declaration responsible.
    const gridAttributed = onCols.some(
      (f) => f.kind === 'self-overflow' && f.culprit?.property === 'grid-template-columns',
    );
    expect(gridAttributed, JSON.stringify(onCols, null, 2)).toBe(true);

    const structural = result.issues.filter(
      (i) => i.category === 'structure' && i.description.startsWith('layout-overflow:'),
    );
    expect(structural.length).toBeGreaterThan(0);
  }, 60_000);

  it('goes quiet once the grid tracks can shrink and the text can wrap', async () => {
    const result = await scan(`${baseUrl}/fixed`, {
      projectDir,
      hydrationStrategy: 'none',
      viewport: 'desktop-sm',
      rules: ['none'],
    });

    expect(result.layoutOverflow, JSON.stringify(result.layoutOverflow, null, 2)).toEqual([]);
  }, 60_000);

  it('reports zero findings for the same defect sealed inside a closed <details>', async () => {
    const result = await scan(`${baseUrl}/details`, {
      projectDir,
      hydrationStrategy: 'none',
      viewport: 'desktop-sm',
      rules: ['none'],
    });

    expect(result.layoutOverflow, JSON.stringify(result.layoutOverflow, null, 2)).toEqual([]);
  }, 60_000);

  it('reports a clip finding for text cut off with no ellipsis', async () => {
    const result = await scan(`${baseUrl}/clipped`, {
      projectDir,
      hydrationStrategy: 'none',
      viewport: 'desktop-sm',
      rules: ['none'],
    });

    const clips = findings(result, 'clip');
    expect(clips.length, JSON.stringify(result.layoutOverflow, null, 2)).toBeGreaterThan(0);
    expect(clips.some((f) => f.selector.includes('box'))).toBe(true);
    expect(clips.every((f) => !f.selector.includes('ellipsis'))).toBe(true);
  }, 60_000);

  it('does not run the probe when layoutOverflow:false is passed', async () => {
    const result = await scan(`${baseUrl}/broken`, {
      projectDir,
      hydrationStrategy: 'none',
      viewport: 'desktop-sm',
      rules: ['none'],
      layoutOverflow: false,
    });

    expect(result.layoutOverflow).toBeUndefined();
  }, 60_000);
});
