/**
 * Planted-defect regression for the four ways `ibr scan` used to grade a page
 * without actually looking at it. Each `it()` below fails if its specific
 * defect comes back:
 *
 *   1. A bare scan enabled zero rule presets, so contrast and touch-target
 *      checks never ran unless `--rules` was passed.
 *   2. The rule engine only ever saw interactive elements, so body copy and
 *      headings were never contrast-graded.
 *   3. Contrast bailed out on any transparent background — which is nearly all
 *      text on a real page — and reported nothing at all.
 *   4. The verdict was computed BEFORE preset violations were aggregated, so a
 *      scan could print a contrast error and still say PASS.
 *
 * Driven through the real `scan()` against a local HTTP server, not a mocked
 * DOM: defect 3 was invisible to unit tests precisely because a hand-built
 * fixture supplies an explicit background that a browser does not.
 *
 * `projectDir` is pinned to a directory with no `.ibr/rules.json` so these
 * assertions test the BUILT-IN defaults and cannot be flipped by whatever
 * config happens to sit in the cwd of the machine running the suite.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { tmpdir } from 'os';
import { scan } from './scan.js';

/**
 * `#opaque` and `#transp` are the same color at the same size. The only
 * difference is that one declares its own background and the other inherits a
 * transparent one. Before the fix, `#opaque` was caught and `#transp` was
 * silently skipped — the two links are the planted defect.
 */
const ROUTES: Record<string, string> = {
  '/planted': `<!doctype html>
<html><head><meta charset="utf-8"><title>planted</title><style>
  body { background: #ffffff; font-family: system-ui; }
  p.low  { color: #cccccc; }
  h2.low { color: #dddddd; }
  a#tiny { display:inline-block; width:20px; height:20px; background:#0a0a0a; color:#fff; font-size:8px; }
  a#opaque { color:#cccccc; background-color:#ffffff; }
  a#transp { color:#cccccc; }
</style></head><body>
<h2 class="low">Low contrast heading</h2>
<p class="low">Low contrast body copy on a transparent background.</p>
<a id="tiny" href="/x">x</a>
<a id="opaque" href="/a">OPAQUE BG low contrast</a>
<a id="transp" href="/b">TRANSPARENT BG low contrast</a>
</body></html>`,

  '/accessible': `<!doctype html>
<html><head><meta charset="utf-8"><title>accessible</title><style>
  body { background:#ffffff; color:#111111; font-family: system-ui; }
  a { color:#0b4ea2; display:inline-block; min-width:44px; min-height:44px; line-height:44px; }
</style></head><body>
<h2>Readable heading</h2>
<p>Body copy at a comfortable contrast level for reading.</p>
<a href="/x">Go</a>
</body></html>`,

  // No background declared ANYWHERE up the tree. The browser paints its white
  // canvas; the scan must assume white, grade the text, and say that it assumed.
  '/no-background': `<!doctype html>
<html><head><meta charset="utf-8"><title>nobg</title>
<style>p { color:#dedede; }</style></head><body>
<p>No opaque background exists in the ancestor chain for this paragraph.</p>
</body></html>`,
};

function findings(result: Awaited<ReturnType<typeof scan>>, ruleId: string) {
  return result.issues.filter((i) => i.description.includes(`[${ruleId}]`));
}

describe('scan default rules — planted-defect regression', () => {
  let server: Server;
  let baseUrl: string;
  // A directory guaranteed to hold no .ibr/rules.json, so `source` is `default`.
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

  // DEFECT 1 — a bare scan ran no preset rules at all.
  it('enables the default presets with no --rules flag', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    expect(result.rulesApplied?.source).toBe('default');
    expect(result.rulesApplied?.presets).toEqual(
      expect.arrayContaining(['touch-targets', 'wcag-contrast', 'calm-precision']),
    );
  }, 60_000);

  // DEFECT 2 — headings and paragraphs never reached the rule engine.
  it('contrast-grades headings and paragraphs, not just controls', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    const aa = findings(result, 'wcag-aa-contrast');
    expect(aa.some((i) => i.description.includes('Low contrast heading'))).toBe(true);
    expect(aa.some((i) => i.description.includes('Low contrast body copy'))).toBe(true);
    expect(result.rulesApplied?.gradedContentElements).toBeGreaterThan(0);
  }, 60_000);

  // A paragraph is not a tap target. The content surface must not leak into the
  // touch-target rules, or turning defaults on would bury real findings.
  it('does not grade content elements as touch targets', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    for (const issue of result.issues) {
      if (issue.description.includes('touch-target') || issue.description.includes('pointer target')) {
        // #tiny is the only planted undersized target on the page.
        expect(issue.element).toContain('tiny');
      }
    }
  }, 60_000);

  // DEFECT 3 — the one that hid the most. Two identical low-contrast links,
  // one with an explicit background and one without.
  it('measures text on a transparent background, not just on an explicit one', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    const aa = findings(result, 'wcag-aa-contrast');
    expect(aa.some((i) => i.description.includes('OPAQUE BG low contrast'))).toBe(true);
    expect(aa.some((i) => i.description.includes('TRANSPARENT BG low contrast'))).toBe(true);
  }, 60_000);

  // DEFECT 4 — verdict was computed before preset violations were injected.
  it('reflects preset violations in the verdict and exit-worthy state', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
    expect(result.verdict).not.toBe('PASS');
  }, 60_000);

  // Zero findings must be distinguishable from zero measurements. This is the
  // structural fix for the ambiguity that hid defect 3 for as long as it did.
  it('reports how much text it actually measured', async () => {
    const result = await scan(`${baseUrl}/accessible`, { projectDir });

    expect(result.verdict).toBe('PASS');
    const cc = result.contrastCoverage;
    expect(cc).toBeDefined();
    // A clean report is only trustworthy next to a non-zero measurement count.
    expect((cc!.measured ?? 0) + (cc!.assumedWhiteBackground ?? 0)).toBeGreaterThan(0);
  }, 60_000);

  // Silence is the failure mode. With no opaque ancestor the scan assumes white
  // — the same contract src/live/measure.ts carries — and labels the finding.
  it('assumes white and says so when no opaque background resolves', async () => {
    const result = await scan(`${baseUrl}/no-background`, { projectDir });

    expect(result.contrastCoverage?.assumedWhiteBackground).toBeGreaterThan(0);
    const aa = findings(result, 'wcag-aa-contrast');
    expect(aa.length).toBeGreaterThan(0);
    expect(aa[0].description).toContain('assumed white page background');
  }, 60_000);

  // The escape hatch, kept honest: opting out must SAY it ran nothing rather
  // than look like a clean page.
  it('runs no preset rules under --rules none, and reports that it did not', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir, rules: ['none'] });

    expect(result.rulesApplied?.source).toBe('opt-out');
    expect(result.rulesApplied?.presets).toEqual([]);
    expect(findings(result, 'wcag-aa-contrast')).toHaveLength(0);
    expect(result.contrastCoverage).toBeUndefined();
  }, 60_000);
});
