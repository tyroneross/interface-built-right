/**
 * Live-browser integration test for the motion sensor's `var()` fix.
 *
 * The unit tests in motion.test.ts prove `collectMotion` resolves `var()`
 * timing correctly against HAND-BUILT `ExtractedCSSRule` fixtures. What they
 * cannot prove is that `extractCssRulesAndMeta` (css-extract.ts) actually
 * hands `collectMotion` a `--*` custom property in the first place —
 * `declarationsFromStyle` enumerates a live `CSSStyleDeclaration` via
 * `style.item(i)` + `getPropertyValue`, and whether that enumeration
 * surfaces custom properties the same way it surfaces standard ones is a
 * property of the BROWSER's CSSOM, not something a fixture can stand in
 * for. This test runs the real extraction pipeline
 * (`extractCssRulesAndMeta`) against a real Chrome tab via CDP, then feeds
 * its actual output into `collectMotion` — no fixture in between — modeled
 * on src/sensors/interaction-states.integration.test.ts's harness.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserPool } from '../engine/browser-pool.js';
import { CompatPage } from '../engine/compat.js';
import { extractCssRulesAndMeta } from './css-extract.js';
import { collectMotion } from './motion.js';
import type { SensorContext } from './types.js';
import type { MotionReport } from './motion.js';

const TEST_PAGE = `<!doctype html><html><head><style>
  :root { --accent-dur: 200ms; }
  /* Tailwind v4 shape: root fallback target the longhand's var() chain
     eventually resolves to. Real Tailwind wraps this in @layer theme;
     css-extract flattens @layer before this sensor ever sees the tree, so
     this test does not need to reproduce the @layer wrapper to exercise the
     same code path. */
  :root, :host { --default-transition-duration: 150ms; }
  .btn { transition: opacity var(--accent-dur) ease; }
  .tw-card {
    transition-property: color;
    transition-duration: var(--tw-duration, var(--default-transition-duration));
    transition-timing-function: linear;
    transition-delay: 0s;
  }
</style></head><body>
  <button class="btn">Go</button>
  <div class="tw-card">Card</div>
</body></html>`;

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE);
const pool = new BrowserPool({ launchOptions: { headless: true } });

let motion: MotionReport;
let capturedCustomProp: string | undefined;

beforeAll(async () => {
  const driver = await pool.acquire();
  try {
    await driver.navigate(TEST_URL);
    const page = new CompatPage(driver);
    const cssExtract = await extractCssRulesAndMeta(page);

    // Ground-truth check: does the REAL extractor's declarationsFromStyle
    // surface a `--*` custom property at all? If not, collectMotion has
    // nothing to resolve against no matter how correct its own logic is,
    // and the defect is upstream in css-extract.ts (out of this agent's
    // scope — see brief).
    const rootRule = cssExtract.cssRules.find(
      (r) => r.kind === 'style' && r.selector === ':root' && '--accent-dur' in r.declarations,
    );
    capturedCustomProp =
      rootRule && rootRule.kind === 'style' ? rootRule.declarations['--accent-dur'] : undefined;

    const ctx: SensorContext = {
      elements: [],
      cssRules: cssExtract.cssRules,
      documentMeta: cssExtract.documentMeta,
      url: TEST_URL,
      viewport: { width: 1280, height: 800 },
    };
    motion = collectMotion(ctx);
  } finally {
    pool.release();
  }
}, 60_000);

afterAll(async () => {
  await pool.close();
});

describe('motion integration — real browser', () => {
  it('css-extract captures the `--*` custom property declaration at all (ground truth for the fix below)', () => {
    expect(capturedCustomProp).toBeDefined();
    expect(capturedCustomProp).toBe('200ms');
  });

  it('shorthand `transition: opacity var(--accent-dur) ease` reports a resolved duration, not a dropped/zero-duration entry', () => {
    const entry = motion.transitions.find((t) => t.selector === '.btn');
    expect(entry).toBeDefined();
    expect(entry?.property).toBe('opacity');
    expect(entry?.duration_ms).toBe(200);
    expect(entry?.unresolved).toBeUndefined();
  });

  it('Tailwind v4 longhand `transition-duration: var(--tw-duration, var(--default-transition-duration))` resolves via the root fallback target', () => {
    const entry = motion.transitions.find((t) => t.selector === '.tw-card');
    expect(entry).toBeDefined();
    expect(entry?.property).toBe('color');
    expect(entry?.duration_ms).toBe(150);
    expect(entry?.easing).toBe('linear');
    expect(entry?.unresolved).toBeUndefined();
  });
});
