import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanObsidian, isAppCssFidelityIssue } from './scan.js';
import { generateHarness } from './harness.js';
import { serveHarness } from './server.js';
import { findObsidianAsar, resolveObsidianAppCss } from './app-css.js';
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

/**
 * Is a real Obsidian install present on this machine?
 *
 * Obsidian's app.css is proprietary and never vendored, so assertions about
 * what IT contributes to the cascade cannot run on a CI runner. Those are
 * gated on this rather than left to fail: a test that can only pass on the
 * author's laptop reds the pipeline forever and stops meaning anything.
 * Declared here, above the first describe, so every suite can reach it.
 */
const localAsar = findObsidianAsar();

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

/**
 * Genuine harness/mount failures.
 *
 * The base-CSS fidelity advisory also carries `category: 'structure'`, and it
 * fires on any machine without Obsidian installed — i.e. every CI runner. It
 * is an environment report, not a mount failure, so it is excluded here. Not
 * excluding it made these tests pass locally and fail on macos-14 forever:
 * `toEqual([])` saw the advisory, and `[0]` indexed it instead of the mount
 * error. A test whose verdict depends on what is installed on the machine
 * certifies nothing.
 */
function harnessIssues(issues: { category: string; description: string }[]) {
  return issues.filter((i) => i.category === 'structure' && !isAppCssFidelityIssue(i));
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
    // `.fx-tiny` declares 20x20 and renders WIDER than that, because Obsidian's
    // app.css gives every button `padding: var(--size-4-1) var(--size-4-3)`.
    // Asserted on the measured element rather than on a literal "20x20px"
    // string: the declared size is not the rendered size once the real base
    // stylesheet is in the cascade, and that difference is the point of loading
    // it. Pinning the exact number would also make this test fail on an
    // Obsidian release that retunes its spacing tokens.
    const result = await scanObsidian(base);

    const tinyButtons = result.elements.all.filter((e) => e.selector?.includes('fx-tiny'));
    expect(tinyButtons.length, 'the tiny buttons were extracted').toBeGreaterThan(0);
    for (const button of tinyButtons) {
      expect(button.bounds.width).toBeLessThan(44);
      expect(button.bounds.height).toBeLessThan(44);
      // Proof the base stylesheet is actually applied: 20px declared, wider
      // rendered. Only meaningful where Obsidian's app.css is loadable — the
      // padding doing the widening is Obsidian's, not the fixture's. The
      // undersized-target detection above is the user-facing behaviour and
      // runs everywhere, including CI.
      if (localAsar) {
        expect(button.bounds.width, 'app.css padding widened the declared 20px').toBeGreaterThan(20);
      }
    }

    const tiny = result.issues.filter((i) => /"x" touch target is \d+x\d+px \(min: 44px\)/.test(i.description));
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

/**
 * Obsidian base-CSS fidelity, end to end.
 *
 * This is the test that would have caught the shipped defect. It runs the whole
 * chain — locate the local Obsidian install, unpack `app.css` out of
 * `obsidian.asar`, inject it ahead of the plugin stylesheet, mount, measure,
 * analyze — against a fixture view that is CORRECT ON ITS OWN and only breaks
 * once Obsidian's real base rules are in the cascade.
 *
 * Skipped with a message when Obsidian is absent, because a silently-vacuous
 * pass here is the exact failure mode the feature exists to eliminate.
 */
const OVERFLOW_ROWS = [
  { title: 'Draft the quarterly planning memo', meta: 'Overdue by 2 hours', tags: '#work #writing' },
  { title: 'Reply to the vendor contract thread', meta: 'Due today at 4pm', tags: '#work #legal' },
  { title: 'Book the dentist appointment', meta: 'Due tomorrow', tags: '#personal' },
];

const overflowBase = {
  pluginPath: BUNDLE,
  stylesPath: STYLES,
  viewClass: 'OverflowRowView',
  viewport: 'iphone-14',
  viewState: { rows: OVERFLOW_ROWS },
};

if (!localAsar) {
  console.warn('[obsidian.integration] SKIPPING base-CSS fidelity tests: no local Obsidian install.');
}

describe('scanObsidian — Obsidian base CSS', () => {
  it.runIf(localAsar)('loads the real app.css by default and reports where it came from', { timeout: 60000 }, async () => {
    const result = await scanObsidian(overflowBase);

    expect(result.harness.appCss.loaded).toBe(true);
    expect(result.harness.appCss.source).toBe(localAsar);
    // The real stylesheet is ~half a megabyte. Anything small means we injected
    // a header fragment, or the eight-line approximation, and the render is a lie.
    expect(result.harness.appCss.bytes).toBeGreaterThan(100_000);
  });

  it.runIf(localAsar)('resolves var() against Obsidian\'s OWN palette, not the plugin\'s fallback', { timeout: 60000 }, async () => {
    const html = generateHarness({
      bundlePath: BUNDLE, stylesPath: STYLES, viewClass: 'OverflowRowView',
      mobile: true, viewState: { rows: OVERFLOW_ROWS },
      appCss: resolveObsidianAppCss()!.css,
    });
    const server = await serveHarness(html);
    const driver = new EngineDriver();
    try {
      await driver.launch({ viewport: { width: 390, height: 844 } } as never);
      await driver.navigate(server.url);
      const vars = await driver.evaluate(`(() => {
        var cs = getComputedStyle(document.body);
        return {
          textNormal: cs.getPropertyValue('--text-normal').trim(),
          background: cs.getPropertyValue('--background-primary').trim(),
          inputHeight: cs.getPropertyValue('--input-height').trim(),
        };
      })()`) as { textNormal: string; background: string; inputHeight: string };

      // These are DEFINED here and undefined without app.css. That difference is
      // the whole fidelity claim.
      expect(vars.textNormal).not.toBe('');
      expect(vars.background).not.toBe('');
      expect(vars.inputHeight).toBe('30px');
    } finally {
      await driver.close();
      await server.close();
    }
  });

  it.runIf(localAsar)('pins a multi-line <button> to 30px — the rule the harness used to miss', { timeout: 60000 }, async () => {
    const html = generateHarness({
      bundlePath: BUNDLE, stylesPath: STYLES, viewClass: 'OverflowRowView',
      mobile: true, viewState: { rows: OVERFLOW_ROWS },
      appCss: resolveObsidianAppCss()!.css,
    });
    const server = await serveHarness(html);
    const driver = new EngineDriver();
    try {
      await driver.launch({ viewport: { width: 390, height: 844 } } as never);
      await driver.navigate(server.url);
      const measured = await driver.evaluate(`(() => {
        var b = document.querySelector('.fx-task-button');
        return { clientHeight: b.clientHeight, scrollHeight: b.scrollHeight, height: getComputedStyle(b).height };
      })()`) as { clientHeight: number; scrollHeight: number; height: string };

      expect(measured.height).toBe('30px');
      expect(measured.clientHeight).toBe(30);
      // 25 + 8 + 20 + 8 + 17 = 78px of content in a 30px box.
      expect(measured.scrollHeight).toBe(78);
    } finally {
      await driver.close();
      await server.close();
    }
  });
});

describe('scanObsidian — layout overflow (end-to-end mutation check)', () => {
  it.runIf(localAsar)('DETECTS the button-height spill', { timeout: 60000 }, async () => {
    const result = await scanObsidian(overflowBase);

    expect(result.harness.appCss.loaded, 'precondition: base CSS is loaded').toBe(true);
    expect(result.layoutOverflow, 'layout overflow ran').toBeDefined();

    const self = result.layoutOverflow!.filter(
      (f) => f.kind === 'self-overflow' && f.tagName === 'BUTTON',
    );
    expect(self.length, JSON.stringify(result.layoutOverflow, null, 2)).toBeGreaterThan(0);
    expect(self[0].spillPx).toBe(48); // 78 - 30
    expect(self[0].culprit?.origin).toBe('obsidian-base');
    expect(self[0].culprit?.value).toBe('30px');
    expect(self[0].fix).toContain('height: auto');

    // The user-visible symptom: text painted on top of text.
    const overlaps = result.layoutOverflow!.filter((f) => f.kind === 'sibling-overlap');
    expect(overlaps.length, 'rows overlap each other').toBeGreaterThan(0);
    expect(overlaps[0].severity).toBe('error');

    // And it reaches issues[], so the verdict moves off PASS.
    expect(result.issues.some((i) => i.description.includes('layout-overflow:'))).toBe(true);
    expect(result.verdict).not.toBe('PASS');
  });

  it.runIf(localAsar)('GOES QUIET once the height constraint is removed', { timeout: 60000 }, async () => {
    // The mutation: one declaration, applied through the same cascade the fix
    // would use in the plugin's own stylesheet. Everything else is identical.
    const result = await scanObsidian({
      ...overflowBase,
      extraCss: '.fx-task-button { height: auto; min-height: 0; }',
    });

    expect(result.harness.appCss.loaded).toBe(true);
    const relevant = (result.layoutOverflow ?? []).filter((f) =>
      (f.selector + (f.otherSelector ?? '')).includes('fx-task'),
    );
    expect(relevant, JSON.stringify(relevant, null, 2)).toEqual([]);
    expect(result.issues.some((i) => i.description.includes('layout-overflow:'))).toBe(false);
  });

  it.runIf(localAsar)('is BLIND to the same defect without base CSS — the regression this feature closes', { timeout: 60000 }, async () => {
    // Same plugin, same fixture, same detector. Only app.css is missing, and
    // the defect vanishes: this is the state the harness shipped in.
    const result = await scanObsidian({ ...overflowBase, obsidianCss: false });

    expect(result.harness.appCss.loaded).toBe(false);
    expect(result.harness.appCss.reason).toBe('disabled');
    expect(
      (result.layoutOverflow ?? []).filter((f) => f.tagName === 'BUTTON' && f.kind === 'self-overflow'),
    ).toEqual([]);

    // ...and the scan says so rather than quietly grading the page.
    const warning = result.issues.find((i) => i.description.includes('Base-CSS fidelity is OFF'));
    expect(warning, 'the degraded scan announces itself').toBeDefined();
    expect(warning!.severity).toBe('warning');
    expect(warning!.description).toContain('UNDETECTABLE');
  });

  it.runIf(localAsar)('can be disabled', { timeout: 60000 }, async () => {
    const result = await scanObsidian({ ...overflowBase, layoutOverflow: false });
    expect(result.layoutOverflow).toBeUndefined();
    expect(result.issues.some((i) => i.description.includes('layout-overflow:'))).toBe(false);
  });

  it.runIf(localAsar)('accepts an explicit app.css path', { timeout: 60000 }, async () => {
    const result = await scanObsidian({ ...overflowBase, obsidianCss: localAsar! });
    expect(result.harness.appCss.loaded).toBe(true);
    expect(result.harness.appCss.source).toBe(localAsar);
  });

  it('grades PARTIAL, never PASS, when Obsidian cannot be found', { timeout: 60000 }, async () => {
    // Forced by pointing the resolver at a path that does not exist. A scan
    // that measured a different page than the app renders must not report
    // itself as a clean pass.
    //
    // ONE row on purpose: each row costs one "button has no click handler"
    // error (IBR's interactivity check reads inline/framework handlers, not
    // addEventListener), and three of them trip determineVerdict's `>= 3` FAIL
    // threshold — which would mask the rule under test. One row lands on
    // ISSUES, and the PARTIAL downgrade is what this asserts.
    const result = await scanObsidian({
      ...overflowBase,
      viewState: { rows: [OVERFLOW_ROWS[0]] },
      obsidianCss: '/nonexistent/app.css',
    });

    expect(result.harness.appCss.loaded).toBe(false);
    expect(result.harness.appCss.reason).toBe('not-found');
    expect(result.verdict).toBe('PARTIAL');
    expect(result.partialReason).toContain('base CSS');
  });

  it('leaves a FAIL alone — a real failure outranks an incomplete scan', { timeout: 60000 }, async () => {
    // Three rows = three interactivity errors = FAIL on its own merits. PARTIAL
    // would be a DOWNGRADE of that signal, so the low-fidelity warning is
    // recorded in issues[] and the verdict is left as the louder of the two.
    const result = await scanObsidian({ ...overflowBase, obsidianCss: '/nonexistent/app.css' });

    expect(result.issues.filter((i) => i.severity === 'error').length).toBeGreaterThanOrEqual(3);
    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some((i) => i.description.includes('Base-CSS fidelity is OFF'))).toBe(true);
  });
});
