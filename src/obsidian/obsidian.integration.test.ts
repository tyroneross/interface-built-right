import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanObsidian } from './scan.js';
import { generateHarness } from './harness.js';
import { serveHarness } from './server.js';
import { EngineDriver } from '../engine/driver.js';

/**
 * Live-Chrome tests for the Obsidian view harness.
 *
 * Excluded from the unit job via BROWSER_INTEGRATION in vitest.config.ts — these
 * launch a real browser, which is unreliable on the bare ubuntu runner.
 *
 * They run against `fixtures/fixture-plugin.js`, a synthetic bundle, rather than
 * any installed plugin: the tests must be portable, and the point is to prove
 * the HARNESS works, not that one vault's plugin does.
 */

const FIXTURES = join(__dirname, 'fixtures');
const BUNDLE = join(FIXTURES, 'fixture-plugin.js');
const STYLES = join(FIXTURES, 'fixture-plugin.css');

const ITEMS = [
  // A deliberately long title: the checkbox-centring regression only reproduces
  // when the title WRAPS, making the row taller than one line. The precondition
  // is asserted in the test rather than assumed — see the row-height check.
  { title: 'A deliberately long item title that has to wrap onto several lines at a phone width so the row grows taller than a single line of text', done: false },
  { title: 'Short', done: false },
];

const base = {
  pluginPath: BUNDLE,
  stylesPath: STYLES,
  viewClass: 'FixtureView',
  viewport: 'iphone-14',
  viewState: { title: 'Fixture', items: ITEMS },
};

function harnessIssues(issues: { category: string; description: string }[]) {
  return issues.filter((i) => i.category === 'structure');
}

describe('scanObsidian — live Chrome', () => {
  it('mounts the view and reports real geometry', { timeout: 60000 }, async () => {
    const result = await scanObsidian(base);

    expect(harnessIssues(result.issues), 'no harness/stub failures').toEqual([]);
    expect(result.harness.viewClass).toBe('FixtureView');
    expect(result.harness.mobile).toBe(true); // inferred from the 390px viewport
    expect(result.viewport.width).toBe(390);
    // A mounted view has elements; a blank page is the failure this guards.
    expect(result.elements.all.length).toBeGreaterThan(0);
  });

  it('resolves var() to concrete rgb() — the thing a regex parser cannot do', { timeout: 60000 }, async () => {
    // This is the whole thesis of the tool. `.fx-cta` is styled
    // `background-image: var(--fx-grad-accent)`, itself built from
    // `var(--fx-accent)`. Static parsing yields the literal string "var(...)";
    // a real browser yields the computed rgb() triplet.
    const result = await scanObsidian(base);
    const cta = result.elements.all.find((e) => e.selector?.includes('fx-cta') || e.text === 'Primary');
    expect(cta, 'the CTA was extracted').toBeTruthy();

    const styles = JSON.stringify(cta);
    expect(styles).not.toContain('var(--fx-');
    expect(styles).toMatch(/rgb\(/);
  });

  it('honours an explicit mobile=false against a phone viewport', { timeout: 60000 }, async () => {
    // Platform.isMobile forks behaviour: the fixture only renders .fx-badge on
    // mobile. Proves the stub's flag reaches the plugin's branch.
    const mobile = await scanObsidian({ ...base, mobile: true });
    const desktop = await scanObsidian({ ...base, mobile: false });

    expect(JSON.stringify(mobile.elements.all)).toContain('fx-badge');
    expect(JSON.stringify(desktop.elements.all)).not.toContain('fx-badge');
    expect(desktop.harness.mobile).toBe(false);
  });

  it('runs post_mount so transient surfaces can be scanned', { timeout: 60000 }, async () => {
    // Sheets/modals only exist after an interaction, so without this hook the
    // tool could never audit them.
    const result = await scanObsidian({ ...base, postMount: 'view.openSheet(document.body)' });
    expect(harnessIssues(result.issues)).toEqual([]);
    const chips = result.elements.all.filter((e) => e.selector?.includes('fx-chip'));
    expect(chips.length).toBe(4);
  });

  it('finds undersized touch targets at 390px', { timeout: 60000 }, async () => {
    // .fx-tiny is 20x20 — under the 44px minimum, and only measurable after layout.
    const result = await scanObsidian(base);
    const tiny = result.issues.filter((i) => /touch target is 20x20px/.test(i.description));
    expect(tiny.length).toBeGreaterThan(0);
  });
});

describe('scanObsidian — the harness cannot silently pass', () => {
  // A failed mount leaves an EMPTY page. An empty page has no collisions, no
  // contrast failures and no undersized targets, so it grades as a serene PASS.
  // Each case below asserts the tool refuses that.

  it('fails loudly when the view class is not exported', { timeout: 60000 }, async () => {
    const result = await scanObsidian({ ...base, viewClass: 'NoSuchView' });
    expect(result.verdict).toBe('FAIL');
    const issues = harnessIssues(result.issues);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].description).toContain('NoSuchView');
    expect(issues[0].description).toContain('Available exports'); // names what IS there
  });

  it('fails loudly when the view uses an unstubbed obsidian API', { timeout: 60000 }, async () => {
    const result = await scanObsidian({ ...base, postMount: 'window.__IBR_OBSIDIAN.NotARealApi()' });
    expect(result.verdict).toBe('FAIL');
    expect(harnessIssues(result.issues)[0].description).toMatch(/unstubbed API used: obsidian\.NotARealApi/);
  });

  it('fails when an async onOpen() rejects', { timeout: 60000 }, async () => {
    // Obsidian's real lifecycle hook is `async onOpen()`. A synchronous
    // try/catch around it catches nothing: the rejection surfaces via
    // Runtime.exceptionThrown, which IBR's console capture does not subscribe
    // to, leaving a blank page marked "ok" — and a blank page grades PASS.
    // Guarded by awaiting the lifecycle before writing the marker.
    const result = await scanObsidian({ ...base, viewClass: 'AsyncFailView', viewState: {} });
    expect(result.verdict).toBe('FAIL');
    expect(harnessIssues(result.issues)[0].description).toMatch(/mount failed at render.*async onOpen rejected/);
  });

  it('mounts a view whose async onOpen() succeeds', { timeout: 60000 }, async () => {
    // The other half of the await change: proves it did not simply break async
    // views, and that the marker waits for the lifecycle to settle.
    const result = await scanObsidian({ ...base, viewClass: 'AsyncOkView', viewState: {} });
    expect(harnessIssues(result.issues)).toEqual([]);
    expect(result.elements.all.some((e) => e.text === 'Async ready')).toBe(true);
  });

  it('fails when the mount script never runs at all', { timeout: 60000 }, async () => {
    // The subtle one. A SyntaxError in post_mount means the mount script never
    // executes, so it emits NO console error — and Chrome reports parse errors
    // via Runtime.exceptionThrown, which IBR's console capture does not
    // subscribe to. Only the absent mount marker catches this.
    const result = await scanObsidian({ ...base, postMount: 'this is not ){ valid js', mountTimeout: 4000 });
    expect(result.verdict).toBe('FAIL');
    expect(harnessIssues(result.issues)[0].description).toMatch(/mount marker .* never appeared/);
  });
});

describe('harness — layout regression detection', () => {
  // scan() extracts INTERACTIVE elements only, so a container like `.fx-row` never
  // appears in ScanResult.elements and "is the control centred in its card?"
  // cannot be asked of a scan result. It can be asked of the harness, which is the
  // unit under test here — so this drives the page directly. It also exercises
  // generateHarness + serveHarness as a composable pair.
  it('renders a control centred against a multi-line row', { timeout: 60000 }, async () => {
    const html = generateHarness({
      bundlePath: BUNDLE, stylesPath: STYLES, viewClass: 'FixtureView',
      mobile: true, viewState: { title: 'Fixture', items: ITEMS },
    });
    const server = await serveHarness(html);
    const driver = new EngineDriver();
    try {
      await driver.launch({ viewport: { width: 390, height: 844 } } as never);
      await driver.navigate(server.url);

      const measured = await driver.evaluate(`(() => {
        var rows = [].slice.call(document.querySelectorAll('.fx-row'));
        return rows.map(function (row) {
          var check = row.querySelector('.fx-check');
          var rb = row.getBoundingClientRect();
          var cb = check.getBoundingClientRect();
          return {
            rowHeight: rb.height,
            rowCentre: rb.top + rb.height / 2,
            checkCentre: cb.top + cb.height / 2,
            gridRow: getComputedStyle(check).gridRow,
            alignSelf: getComputedStyle(check).alignSelf,
          };
        });
      })()`) as { rowHeight: number; rowCentre: number; checkCentre: number; gridRow: string; alignSelf: string }[];

      expect(measured.length).toBe(2);
      const tall = measured.sort((a, b) => b.rowHeight - a.rowHeight)[0];

      // FALSIFIER PRECONDITION — asserted, not assumed. The regression only
      // reproduces when the title WRAPS: in a single-line row the centred and
      // top-pinned positions coincide, so a non-wrapping fixture would let this
      // test pass while proving nothing. If font metrics ever collapse the long
      // title to one line, fail here loudly rather than degrade into a no-op.
      expect(tall.rowHeight, 'the long title must WRAP or this test proves nothing').toBeGreaterThan(60);

      expect(Math.abs(tall.rowCentre - tall.checkCentre), 'control is vertically centred in its row').toBeLessThan(2);
      expect(tall.gridRow).toBe('1 / -1');
      expect(tall.alignSelf).toBe('center');
    } finally {
      await driver.close();
      await server.close();
    }
  });
});
