import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import { extractContentElements, extractInteractiveElements } from './extract.js';
import { contentElementsToEnhanced } from './rules/content-adapter.js';
import { extractCssRulesAndMeta } from './sensors/css-extract.js';
import { collectContrastReport } from './sensors/contrast-report.js';
import type { SensorContext } from './sensors/types.js';
import { analyzeThemeConsistency } from './consistency.js';
import { measureElementContrast } from './rules/contrast-measure.js';

// Real Chrome rendering: these fixtures validate the checker, not an app UI.
describe('system canvas text contrast', () => {
  const driver = new EngineDriver();
  let page: CompatPage;
  beforeAll(async () => {
    await driver.launch({ headless: true });
    page = new CompatPage(driver);
  }, 30000);
  afterAll(async () => { await driver.close(); });
  for (const scheme of ['light', 'dark']) {
    for (const readable of [true, false]) {
      it(`${scheme} transparent page: ${readable ? 'readable' : 'low contrast'} text`, async () => {
        const color = readable ? (scheme === 'dark' ? '#eee' : '#111') : (scheme === 'dark' ? '#222' : '#eee');
        await page.goto(`data:text/html,${encodeURIComponent(`<html style="color-scheme:${scheme}"><body style="color:${color};font:16px sans-serif"><p>Canvas text</p><button style="background:transparent;color:inherit;border:0">Canvas button</button></body></html>`)}`);
        const content = contentElementsToEnhanced(await extractContentElements(page));
        const interactive = await extractInteractiveElements(page);
        const structural = (await extractCssRulesAndMeta(page)).structuralElements;
        const report = collectContrastReport({ elements: structural } as SensorContext);
        expect(report.assumedBackground).toBe(0);
        expect(report.fail > 0).toBe(!readable);
        for (const el of [content.find(e => e.tagName === 'p'), interactive.find(e => e.tagName === 'button')]) {
          expect(el).toBeDefined();
          const m = measureElementContrast(el!);
          expect(m.status).toBe('measured');
          if (m.status === 'measured') {
            expect(m.backgroundResolved).toBe(true);
            expect(m.ratio >= 4.5).toBe(readable);
          }
        }
      }, 20000);
    }
  }
  it('does not call translucent white cards a light theme on a dark page', async () => {
    await page.goto(`data:text/html,${encodeURIComponent('<html style="background:#111"><body><main><div class="card" style="background:rgba(255,255,255,.03);height:100px">Card</div></main></body></html>')}`);
    expect((await analyzeThemeConsistency(page)).themeMismatch).toBe(false);
  });

});
