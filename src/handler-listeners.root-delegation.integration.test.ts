/**
 * Integration regression test: root-level (document/body) click delegation.
 *
 * Reported: buttons wired only through a document-level delegated listener
 * (`document.addEventListener('click', e => { const b =
 * e.target.closest('[data-action]'); if (b) run(b.dataset.action) })`) were
 * flagged NO_HANDLER / fake-interactive, because enrichWithEventListeners
 * excludes root listeners from its ancestor walk (see
 * handler-listeners.integration.test.ts: a root menu-dismissal listener must
 * not rescue every dead control).
 *
 * Fix: a root click listener is credited to a control only when its handler
 * source names that control (selector literal it matches, its id with an
 * `.id` read, or a `dataset.<key>` read it carries). Each page below is
 * isolated so one page's delegating listener cannot leak credit into
 * another case.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserPool } from './engine/browser-pool.js';
import { CompatPage } from './engine/compat.js';
import { extractInteractiveElements, analyzeElements } from './extract.js';
import { handlerIntegrityRules } from './rules/handler-integrity.js';
import type { EnhancedElement } from './schemas.js';
import type { PageLike } from './engine/page-like.js';

const page = (body: string, script: string) =>
  'data:text/html,' + encodeURIComponent(
    `<!doctype html><html><head></head><body>${body}<script>${script}</script></body></html>`,
  );

const PAGES = {
  // (1) + (4): document-level closest('[data-action]') delegation.
  documentClosest: page(
    `<div class="toolbar-plain">
       <button type="button" data-action="save">Save action</button>
       <button type="button" data-action="delete"><span>Delete action</span></button>
       <button type="button" data-action="share">Share action</button>
     </div>
     <button type="button" id="stray">Stray button</button>`,
    `function run(a) { window.__last = a; }
     document.addEventListener('click', function (e) {
       var b = e.target.closest('[data-action]');
       if (b) run(b.dataset.action);
     });`,
  ),
  // (2) + (4): body-level .matches('.copy-btn') delegation.
  bodyMatches: page(
    `<button type="button" class="copy-btn">Copy one</button>
     <button type="button" class="copy-btn">Copy two</button>
     <button type="button" class="other-btn">Other button</button>`,
    `document.body.addEventListener('click', function (e) {
       if (e.target.matches('.copy-btn')) navigator.clipboard && navigator.clipboard.writeText('x');
     });`,
  ),
  // (3): pure dismissal listener names no selector -> dead button stays flagged.
  dismissal: page(
    `<div id="menu">Menu</div>
     <button type="button" id="dead-btn">Dead button</button>`,
    `document.addEventListener('click', function (e) {
       var menu = document.getElementById('menu');
       if (!menu.contains(e.target)) menu.hidden = true;
     });`,
  ),
  // id comparison + dataset read on window.
  idAndDataset: page(
    `<button type="button" id="run-btn">Run by id</button>
     <button type="button" data-cmd="go">Run by dataset</button>
     <button type="button" id="walk-btn">Unnamed id button</button>`,
    `window.addEventListener('click', function (e) {
       if (e.target.id === 'run-btn') window.__ran = true;
       if (e.target.dataset.cmd) window.__cmd = e.target.dataset.cmd;
     });`,
  ),
  // Opaque (bound -> native code) root listener: not credited, message hedged.
  opaque: page(
    `<button type="button" id="opaque-dead">Opaque dead</button>`,
    `document.addEventListener('click', function (e) { if (e.target.closest('#opaque-dead')) {} }.bind(null));`,
  ),
  // Incidental bare-tag / universal literals must not credit via an ancestor.
  incidentalLiterals: page(
    `<div class="card"><button type="button" id="in-card">In card dead</button></div>`,
    `document.addEventListener('click', function (e) {
       var d = document.createElement('div'); var all = document.querySelectorAll('*');
       if (!document.body.matches('body')) console.log(d, all);
     });`,
  ),
  // Generic type selectors (analytics tracker / outside-click closer) name
  // no particular control and must not credit a dead button on self-match.
  genericTypeSelector: page(
    `<button type="button" id="tracked">Tracked dead</button>`,
    `document.addEventListener('click', function (e) {
       var t = e.target.closest('a,button'); if (t) console.log('track', t.textContent);
       if (!e.target.closest('button')) console.log('close menus');
       if (e.target.closest('a, button, .btn')) console.log('mixed list');
       if (e.target.closest('button:not(.x)')) console.log('negated');
     });`,
  ),
} as const;

const pool = new BrowserPool({ launchOptions: { headless: true } });
const fakeInteractiveRule = handlerIntegrityRules[0];
const results: Record<string, { elements: EnhancedElement[]; noHandler: string[]; fake: Set<string> }> = {};
let noEnrichmentNoHandler: string[] = [];

function analyze(url: string, elements: EnhancedElement[]) {
  const noHandler = analyzeElements(elements).issues
    .filter((i) => i.type === 'NO_HANDLER')
    .map((i) => i.message);
  const ctx = { isMobile: false, viewportWidth: 1440, viewportHeight: 900, url, allElements: elements };
  const fake = new Set<string>();
  for (const el of elements) if (fakeInteractiveRule.check(el, ctx)) fake.add(el.text ?? el.selector);
  return { elements, noHandler, fake };
}

const flagged = (key: keyof typeof PAGES, name: string) =>
  results[key].noHandler.some((m) => m.includes(`"${name}"`));

beforeAll(async () => {
  const driver = await pool.acquire();
  try {
    for (const [key, url] of Object.entries(PAGES)) {
      await driver.navigate(url);
      const cp = new CompatPage(driver);
      results[key] = analyze(url, await extractInteractiveElements(cp));
      if (key === 'documentClosest') {
        const bare = new CompatPage(driver);
        const noEnrichment = { goto: bare.goto.bind(bare), evaluate: bare.evaluate.bind(bare) } as unknown as PageLike;
        noEnrichmentNoHandler = analyze(url, await extractInteractiveElements(noEnrichment)).noHandler;
      }
    }
  } finally {
    pool.release();
  }
}, 90_000);

afterAll(async () => { await pool.close(); });

describe('root-level click delegation credited only with evidence', () => {
  it('(1) document closest("[data-action]") delegation: no data-action button is flagged', () => {
    for (const name of ['Save action', 'Delete action', 'Share action']) {
      expect(flagged('documentClosest', name)).toBe(false);
      expect(results.documentClosest.fake.has(name)).toBe(false);
    }
  });

  it('(1) pre-fix control: without enrichment the data-action buttons ARE flagged', () => {
    expect(noEnrichmentNoHandler.some((m) => m.includes('"Save action"'))).toBe(true);
  });

  it('(2) body .matches(".copy-btn") delegation: copy buttons are not flagged', () => {
    expect(flagged('bodyMatches', 'Copy one')).toBe(false);
    expect(flagged('bodyMatches', 'Copy two')).toBe(false);
    expect(results.bodyMatches.fake.has('Copy one')).toBe(false);
  });

  it('(3) dismissal-only document listener: dead button still flagged with the flat message', () => {
    const msg = results.dismissal.noHandler.find((m) => m.includes('"Dead button"'));
    expect(msg).toBe('Button "Dead button" has no click handler');
    expect(results.dismissal.fake.has('Dead button')).toBe(true);
  });

  it('(4) a button matching none of the delegating selectors is still flagged', () => {
    expect(flagged('documentClosest', 'Stray button')).toBe(true);
    expect(flagged('bodyMatches', 'Other button')).toBe(true);
    expect(results.bodyMatches.fake.has('Other button')).toBe(true);
  });

  it('credits id comparison and dataset reads, but not an unrelated id', () => {
    expect(flagged('idAndDataset', 'Run by id')).toBe(false);
    expect(flagged('idAndDataset', 'Run by dataset')).toBe(false);
    expect(flagged('idAndDataset', 'Unnamed id button')).toBe(true);
  });

  it('opaque (bound) root listener: not credited, NO_HANDLER message is hedged', () => {
    const msg = results.opaque.noHandler.find((m) => m.includes('"Opaque dead"'));
    expect(msg).toBeDefined();
    expect(msg).toContain('document-level click listener exists');
  });

  it('incidental bare-tag / universal / body literals do not credit a dead button', () => {
    expect(flagged('incidentalLiterals', 'In card dead')).toBe(true);
  });

  it('a generic type selector (closest("a,button")) does not credit a dead button', () => {
    expect(flagged('genericTypeSelector', 'Tracked dead')).toBe(true);
  });
});
