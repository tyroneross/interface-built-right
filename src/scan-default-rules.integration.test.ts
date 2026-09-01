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

  // Audit findings f1/f3/f5. `h2#big` is 32px bold at 3.03:1 — it PASSES WCAG
  // AA large text (3:1) and must not be reported. `img` alt text is never
  // painted and must not be contrast-graded. `li`/`td` are ordinary body copy.
  '/size-and-scope': `<!doctype html>
<html><head><meta charset="utf-8"><title>size</title><style>
  body { background:#ffffff; color:#111111; font-family: system-ui; }
  h2#big { font-size:32px; font-weight:700; color:#949494; }
  li#dim { color:#cfcfcf; }
  td#dimcell { color:#cfcfcf; }
  figure#card { background:#111111; }
</style></head><body>
<h2 id="big">Big bold hero heading</h2>
<ul><li id="dim">Low contrast list item</li></ul>
<table><tr><td id="dimcell">Low contrast table cell</td></tr></table>
<figure id="card"><img id="logo" alt="Company logo" src="/none.png" width="40" height="40"></figure>
</body></html>`,

  // Second-audit findings f3 (opacity) and f11 (aria).
  '/opacity-and-aria': `<!doctype html>
<html><head><meta charset="utf-8"><title>opacity</title><style>
  body { background:#ffffff; color:#111111; font-family: system-ui; }
  p#muted   { color:#000000; opacity:0.25; }
  p#gone    { color:#cccccc; opacity:0; }
  p#hidden  { color:#cccccc; visibility:hidden; }
</style></head><body>
<p id="muted">Muted body text faded by opacity</p>
<p id="gone">Fully transparent paragraph</p>
<p id="hidden">Visibility hidden paragraph</p>
<h2 aria-label="Real accessible name" role="note">Heading with aria</h2>
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

  // DEFECT 3, SECOND LANE. Two contrast rules ship in IBR and BOTH run on every
  // scan: `wcag/contrast` (always on, reported under `ruleEngine`) and the
  // `wcag-contrast` preset pair (reported under `issues`). They carried
  // duplicate math and the same transparent-background bail, so fixing one left
  // the other silently measuring nothing. Both now share
  // `measureElementContrast`, and this asserts the always-on lane agrees.
  it('measures transparent backgrounds in the always-on ruleEngine lane too', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    const engineContrast = (result.ruleEngine ?? []).filter((r) => r.rule.startsWith('wcag/contrast'));
    const graded = engineContrast.map((r) => r.element).join(' ');
    expect(graded).toContain('transp');
    expect(graded).toContain('opaque');
  }, 60_000);

  // The two lanes must never DISAGREE about an element they both graded — a
  // disagreement is what a duplicated implementation produces, and it is what
  // shipped before they shared `measureElementContrast`.
  //
  // They are not expected to cover the same SET: `runAllRules` is
  // interactive-only on purpose. Its rule list (touch-targets, handler
  // integrity, spacing) carries no `appliesTo` guard, so feeding it paragraphs
  // would flag body copy as an undersized tap target. Content coverage is the
  // preset lane's job, and the preset lane is now on by default. So the
  // invariant is containment plus agreement, not equality.
  it('never disagrees with the preset lane on an element both graded', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    const engineHits = new Set(
      (result.ruleEngine ?? [])
        .filter((r) => r.rule === 'wcag/contrast')
        .map((r) => r.element),
    );
    const presetHits = new Set(
      result.issues
        .filter((i) => i.description.includes('[wcag-aa-contrast]'))
        .map((i) => i.element ?? ''),
    );

    expect(engineHits.size).toBeGreaterThan(0);
    for (const element of engineHits) {
      expect(presetHits.has(element)).toBe(true);
    }
    // And the preset lane reaches strictly further — that is defect 2's fix.
    expect(presetHits.size).toBeGreaterThan(engineHits.size);
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

  // AUDIT f1 — isLargeText read fontSize/fontWeight that extract.ts never
  // captured, so parseFloat('') -> NaN -> false for EVERY element and every
  // heading was graded against the 4.5:1 normal-text bar. Routing headings into
  // this rule for the first time made a latent misclassification load-bearing.
  it('applies the WCAG large-text threshold instead of assuming normal text', async () => {
    const result = await scan(`${baseUrl}/size-and-scope`, { projectDir });

    // 32px bold #949494 on white is 3.03:1 — passes AA large text (3:1).
    const aa = findings(result, 'wcag-aa-contrast');
    expect(aa.some((i) => i.description.includes('Big bold hero heading'))).toBe(false);
  }, 60_000);

  // AUDIT f3 — alt text is never painted, so grading it invents a measurement
  // and (now that the verdict comes from `issues`) can push a page off PASS.
  it('does not contrast-grade image alt text', async () => {
    const result = await scan(`${baseUrl}/size-and-scope`, { projectDir });

    const graded = result.issues.map((i) => i.description).join(' ');
    expect(graded).not.toContain('Company logo');
  }, 60_000);

  // AUDIT f5 — list items and table cells are ordinary body copy.
  it('grades text in list items and table cells', async () => {
    const result = await scan(`${baseUrl}/size-and-scope`, { projectDir });

    const aa = findings(result, 'wcag-aa-contrast');
    expect(aa.some((i) => i.description.includes('Low contrast list item'))).toBe(true);
    expect(aa.some((i) => i.description.includes('Low contrast table cell'))).toBe(true);
  }, 60_000);

  // AUDIT f5/f8 — a count with no denominator is the same ambiguity as a
  // finding count with no measurement count. The scan must name what it graded.
  it('reports the scope it graded, not just a count', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    expect(result.rulesApplied?.gradedTags).toEqual(expect.arrayContaining(['p', 'h1', 'li', 'td']));
  }, 60_000);

  // AUDIT f3 — opacity was captured on both extraction paths and never used.
  // `opacity: 0.25` black text on white is ~2.4:1, not the 21:1 it was graded
  // at, so a real failure passed silently.
  it('folds element opacity into the measured contrast', async () => {
    const result = await scan(`${baseUrl}/opacity-and-aria`, { projectDir });

    const aa = findings(result, 'wcag-aa-contrast');
    const muted = aa.find((i) => i.description.includes('Muted body text'));
    expect(muted).toBeDefined();
    expect(muted!.description).toContain('element opacity was folded into the text color');
  }, 60_000);

  // AUDIT f3 — the 'invisible' status claimed to cover unpainted text while
  // opacity-0 and visibility-hidden text kept full layout bounds and was graded.
  it('treats opacity-0 and visibility-hidden text as unpainted', async () => {
    const result = await scan(`${baseUrl}/opacity-and-aria`, { projectDir });

    const graded = result.issues.map((i) => i.description).join(' ');
    expect(graded).not.toContain('Fully transparent paragraph');
    expect(graded).not.toContain('Visibility hidden paragraph');
    expect(result.contrastCoverage!.invisibleText).toBeGreaterThanOrEqual(2);
  }, 60_000);

  // AUDIT f2 — a third contrast implementation lived in the sensor lane with
  // the identical transparent-background bail and the superseded 18px/14px
  // thresholds. `--output summary` keeps `sensors`, so that lane's false-clean
  // accounting was what token-constrained consumers actually saw.
  it('measures transparent backgrounds in the sensor lane too', async () => {
    const result = await scan(`${baseUrl}/planted`, { projectDir });

    expect(result.sensors?.contrast.totalChecked).toBeGreaterThan(0);
    const failing = (result.sensors?.contrast.failing ?? []).map((f) => f.selector).join(' ');
    expect(failing).toContain('transp');
  }, 60_000);

  // AUDIT f5 — runAllRules is a public export and had NO surface filter, so it
  // ran every rule against whatever it was handed. It was safe only because its
  // one in-tree caller happens to pass interactive elements.
  //
  // Note on what this can and cannot prove: with today's rule set the
  // touch-target and handler rules each carry their own interactivity guard, so
  // a paragraph reaches no violation either way — a test asserting "no
  // touch-target finding on a paragraph" passes with the filter REMOVED and is
  // therefore worthless. This asserts the filter itself instead: an
  // interactive-only rule must be absent on the content surface and present on
  // the interactive one, for the same element.
  it('excludes interactive-only rules from the content surface in runAllRules', async () => {
    const { runAllRules } = await import('./rules/index.js');
    const { contentElementsToEnhanced } = await import('./rules/content-adapter.js');

    const [element] = contentElementsToEnhanced([{
      selector: 'p#dim', tagName: 'p', text: 'Low contrast paragraph',
      bounds: { x: 0, y: 0, width: 200, height: 20 },
      computedStyles: {
        color: 'rgb(204,204,204)', backgroundColor: 'rgb(255,255,255)',
        fontSize: '12px', fontWeight: '400',
        display: 'block', visibility: 'visible', opacity: '1',
      },
      contentKind: 'paragraph',
    }]);

    const ctx = {
      isMobile: false, viewportWidth: 1920, viewportHeight: 1080,
      url: 'http://example.test', allElements: [element],
    };

    // wcag/contrast declares no appliesTo, so it defaults to 'interactive'.
    const asInteractive = runAllRules([element], ctx, { surface: 'interactive' });
    const asContent = runAllRules([element], ctx, { surface: 'content' });

    expect(asInteractive.some((r) => r.rule === 'wcag/contrast')).toBe(true);
    expect(asContent.some((r) => r.rule === 'wcag/contrast')).toBe(false);
  });

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
