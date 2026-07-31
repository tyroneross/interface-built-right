/**
 * Live-attach integration test.
 *
 * Launches a throwaway Chrome, opens ONE page in it, and then exercises the
 * `src/live/` path exactly as it runs against Obsidian: discover targets over
 * CDP, attach to an existing one, measure a selector, detach, and confirm the
 * page survived untouched.
 *
 * Excluded from the unit job via `IBR_UNIT_ONLY=1` (see vitest.config.ts) —
 * it needs a real browser.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserManager } from '../engine/cdp/browser.js';
import { CdpConnection } from '../engine/cdp/connection.js';
import { TargetDomain } from '../engine/cdp/target.js';
import { listLiveTargets, measureLive } from './index.js';

const PAGE = `<!doctype html>
<html><head><title>IBR Live Fixture Pane</title><style>
  body { margin: 0; background: rgb(30, 30, 30); font-family: system-ui, sans-serif; }
  .pane { padding: 24px; }
  .actions { display: flex; align-items: center; gap: 8px; }
  .actions button {
    background: transparent; color: rgb(220, 221, 222);
    font-size: 13px; line-height: 18px; font-weight: 500;
    padding: 4px 10px; border: 1px solid rgb(70, 70, 70); border-radius: 4px;
  }
  .actions .tall { font-size: 18px; padding: 10px 14px; }
  .label { color: rgba(220, 221, 222, 0.4); font-size: 12px; }
</style></head>
<body><div class="pane"><div class="actions">
  <button class="a">Continue</button>
  <button class="b tall" disabled>Rewrite</button>
  <span class="label">draft</span>
</div></div></body></html>`;

const PAGE_URL = `data:text/html;charset=utf-8,${encodeURIComponent(PAGE)}`;

let browser: BrowserManager;
let cdpUrl: string;
let harnessConn: CdpConnection;
let harnessTargetId: string;

beforeAll(async () => {
  browser = new BrowserManager();
  const ws = await browser.launch({ headless: true });
  cdpUrl = `http://127.0.0.1:${browser.port}`;

  // The fixture page is created by the TEST, standing in for an app the user
  // already has open. `src/live/` must never create one itself.
  harnessConn = new CdpConnection();
  await harnessConn.connect(ws);
  harnessTargetId = await new TargetDomain(harnessConn).createPage(PAGE_URL);

  // Wait for first paint of the fixture.
  for (let i = 0; i < 50; i++) {
    const { targets } = await listLiveTargets({ cdpUrl });
    if (targets.some((t) => t.title.includes('IBR Live Fixture Pane'))) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}, 60_000);

afterAll(async () => {
  try {
    if (harnessTargetId) await new TargetDomain(harnessConn).close(harnessTargetId);
  } catch { /* browser is going away anyway */ }
  await harnessConn?.close();
  await browser?.close();
});

describe('live measure against a running browser', () => {
  it('finds the already-open page target by title substring', async () => {
    const { targets } = await listLiveTargets({ cdpUrl });
    const page = targets.find((t) => t.title.includes('IBR Live Fixture Pane'));
    expect(page).toBeDefined();
    expect(page?.type).toBe('page');
  }, 30_000);

  it('measures every button with real geometry, box, type and contrast', async () => {
    const result = await measureLive({
      cdpUrl,
      targetTitle: 'IBR Live Fixture Pane',
      selector: '.actions button',
    });

    expect(result.matched).toBe(2);
    for (const el of result.elements) {
      expect(el.tagName).toBe('button');
      expect(el.bounds.height).toBeGreaterThan(0);
      expect(el.bounds.width).toBeGreaterThan(0);
      expect(el.box.height).toMatch(/^\d+(\.\d+)?px$/);
      expect(el.box.paddingLeft).toMatch(/^\d+(\.\d+)?px$/);
      expect(el.box.paddingRight).toMatch(/^\d+(\.\d+)?px$/);
      expect(el.typography.fontSize).toMatch(/^\d+(\.\d+)?px$/);
      expect(el.color.contrastRatio).not.toBeNull();
      expect(Number.isNaN(el.color.contrastRatio)).toBe(false);
      expect(el.firstLineBaselineY).not.toBeNull();
    }

    // Declared padding survives the round trip.
    expect(result.elements[0].box.paddingLeft).toBe('10px');
    expect(result.elements[1].box.paddingLeft).toBe('14px');
    // `disabled` is reported where the IDL attribute exists.
    expect(result.elements[0].disabled).toBe(false);
    expect(result.elements[1].disabled).toBe(true);
  }, 30_000);

  it('resolves a transparent control against the opaque ancestor behind it', async () => {
    const result = await measureLive({
      cdpUrl,
      targetTitle: 'IBR Live Fixture Pane',
      selector: '.actions button.a',
    });
    const el = result.elements[0];
    expect(el.color.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(el.color.effectiveBackgroundResolved).toBe(true);
    expect(el.color.effectiveBackgroundColor).toBe('rgb(30, 30, 30)');
    expect(el.color.contrastRatio).toBeGreaterThan(4.5);
    expect(el.color.passesAA).toBe(true);
  }, 30_000);

  it('measures non-interactive containers and spans, not just controls', async () => {
    const result = await measureLive({
      cdpUrl,
      targetTitle: 'IBR Live Fixture Pane',
      selector: '.pane, .actions, .label',
    });
    expect(result.matched).toBe(3);
    expect(result.elements.map((e) => e.tagName)).toEqual(['div', 'div', 'span']);
    // Document order, and the container reports its flex layout.
    expect(result.elements[1].layout.display).toBe('flex');
    expect(result.elements[1].layout.gap).toBe('8px');
    expect(result.elements[1].box.paddingLeft).toBe('0px');
  }, 30_000);

  it('detects the baseline mismatch between differently-sized siblings', async () => {
    const result = await measureLive({
      cdpUrl,
      targetTitle: 'IBR Live Fixture Pane',
      selector: '.actions button, .actions .label',
    });
    const baselines = result.elements.map((e) => e.firstLineBaselineY);
    expect(baselines.every((b) => b !== null)).toBe(true);
    // align-items: center on differing font sizes does NOT align baselines.
    const spread = Math.max(...(baselines as number[])) - Math.min(...(baselines as number[]));
    expect(spread).toBeGreaterThan(0);
  }, 30_000);

  it('leaves the page on the same URL with the same DOM after measuring', async () => {
    const before = await measureLive({
      cdpUrl, targetTitle: 'IBR Live Fixture Pane', selector: '.pane',
    });
    await measureLive({ cdpUrl, targetTitle: 'IBR Live Fixture Pane', selector: 'body *' });
    const after = await measureLive({
      cdpUrl, targetTitle: 'IBR Live Fixture Pane', selector: '.pane',
    });

    expect(after.page.url).toBe(before.page.url);
    expect(after.page.scrollY).toBe(before.page.scrollY);
    expect(after.elements[0].bounds).toEqual(before.elements[0].bounds);

    // No stray canvas or other node was left behind in the document.
    const { targets } = await listLiveTargets({ cdpUrl });
    expect(targets.filter((t) => t.type === 'page' && t.title.includes('IBR Live Fixture Pane')))
      .toHaveLength(1);
    const canvases = await measureLive({
      cdpUrl, targetTitle: 'IBR Live Fixture Pane', selector: 'canvas',
    });
    expect(canvases.matched).toBe(0);
  }, 60_000);

  it('fails with an actionable message when the port is dead', async () => {
    await expect(
      measureLive({ cdpUrl: 'http://127.0.0.1:1', selector: 'body', probeTimeoutMs: 1500 }),
    ).rejects.toThrow(/Nothing is listening/);
  }, 30_000);
});
