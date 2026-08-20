/**
 * Integration regression test for the two touch-target finding classes that
 * were false by construction, reported after the v1.5.0 viewport fix landed
 * and reproduced live on rosslabs.ai at 390px:
 *
 *   1. INLINE PROSE LINKS — three `<a>` elements inside `<p>` prose measured
 *      91x18, 65x20 and 147x20 and were flagged against the 44px minimum.
 *      WCAG 2.5.8 exempts a target "in a sentence"; growing one to 44px would
 *      reflow the paragraph, so the finding was unactionable by construction.
 *   2. LABEL-OVERLAY CONTROLS — `#nav-toggle`, an `<input type="checkbox">`
 *      clipped to 1x1 by `clip-path: inset(50%)`, was flagged at 1x1 while
 *      its `<label>` (the actual hit area) measured 44x44.
 *
 * Together those were 4 of 4 remaining findings on that page, i.e. the rule
 * was at 0% precision there once the genuine issues had been fixed.
 *
 * The unit tests in target-sizing.test.ts cover the POLICY against handmade
 * element payloads. This test covers the MEASUREMENT: `surroundingTextChars`
 * and `labelTargetBounds` are computed in page context in src/extract.ts and
 * need a real cascade, real layout, and a real `HTMLInputElement.labels`
 * association — none of which a fixture object can prove.
 *
 * Counterexamples are asserted alongside, because a filter that suppresses
 * genuine findings is a worse defect than the one being fixed: a `|`-separated
 * inline nav, a paragraph whose only content is a link, an inline-flex icon
 * button, and a control whose label is itself undersized must all still be
 * flagged.
 *
 * Requires Chrome installed — see vitest.config.ts's BROWSER_INTEGRATION list.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BrowserPool } from '../engine/browser-pool.js'
import { scan } from '../scan.js'
import type { ScanResult } from '../scan.js'

const TEST_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; font: 16px/1.7 system-ui, sans-serif; }
  /* Tailwind's sr-only, verbatim: the element keeps a 1x1 layout box and is
     visible+opaque, so the existing display/visibility/opacity guard cannot
     exclude it. Its <label> is the real target. */
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap; border-width: 0;
  }
  .toggle-label { display: flex; width: 44px; height: 44px; align-items: center; justify-content: center; }
  .tiny-label   { display: flex; width: 30px; height: 30px; align-items: center; justify-content: center; }
  .icon-link    { display: inline-flex; width: 40px; height: 40px; }
  .chip         { display: inline-block; width: 30px; height: 20px; }
  /* Tailwind's sm:hidden — the label, and therefore the control's only
     pointer affordance, exists on mobile and is gone above the breakpoint. */
  .breakpoint-label { display: flex; width: 44px; height: 44px; }
  @media (min-width: 640px) { .breakpoint-label { display: none; } }
  /* A control big enough to point at, whose label is hidden at every width.
     Not a stub: a real, undersized target that must stay flagged. */
  .always-hidden-label { display: none; }
  .real-checkbox { width: 20px; height: 20px; margin: 0; }
</style>
</head><body>
  <!-- Class 2: label supplies the hit area (the live #nav-toggle pattern). -->
  <input type="checkbox" id="nav-toggle" class="sr-only" aria-label="Toggle navigation menu">
  <label for="nav-toggle" class="toggle-label">M</label>

  <!-- Counterexample: same pattern, but the label is itself under 44px. -->
  <input type="checkbox" id="tiny-toggle" class="sr-only" aria-label="Tiny toggle">
  <label for="tiny-toggle" class="tiny-label">x</label>

  <!-- Class 2 at the OTHER viewport: above 640px the label is display:none,
       so the 1x1 stub is the only thing left and there is no target to size. -->
  <input type="checkbox" id="breakpoint-toggle" class="sr-only" aria-label="Breakpoint toggle">
  <label for="breakpoint-toggle" class="breakpoint-label">B</label>

  <!-- Counterexample: hidden label, but the control itself is a real 20x20
       pointer target. Undersized at both minimums, and must stay flagged. -->
  <input type="checkbox" id="real-checkbox" class="real-checkbox" aria-label="Real checkbox">
  <label for="real-checkbox" class="always-hidden-label">R</label>

  <!-- Class 1: an inline link in a sentence. -->
  <p class="prose">Ross wrote about the whole argument at length, and the clearest
  version of it lives in <a class="prose-link" href="/chapter">Chapter 510</a>, which
  is worth reading before anything else in this section.</p>

  <!-- Counterexample: a paragraph whose only content is the link. Not a sentence. -->
  <p class="lonely"><a class="lonely-link" href="/solo">Solo</a></p>

  <!-- Counterexample: a "|"-separated inline nav. Inline, but separators are
       not prose, and the small hit areas are a genuine mobile problem. -->
  <p class="sep-nav"><a class="nav-a" href="/home">Home</a> | <a class="nav-b" href="/about">About</a></p>

  <!-- Counterexample: an inline-FLEX icon button in a paragraph of text. It is
       a box, resizable without reflowing the sentence, so it stays gradable. -->
  <p class="icon-para">Follow along on the usual channels, or reach out directly if
  something here is wrong: <a class="icon-link" href="/li" aria-label="LinkedIn"></a></p>

  <!-- Counterexample: an inline-BLOCK chip inside prose. Same reasoning. -->
  <p class="chip-para">The release notes describe every change in detail and the
  short summary is here: <a class="chip" href="/chip" aria-label="Chip"></a></p>
</body></html>`

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE)

const pool = new BrowserPool({ launchOptions: { headless: true } })
let result: ScanResult
let desktopResult: ScanResult

beforeAll(async () => {
  // The defect was reported at BOTH viewports, and the responsive nav-toggle
  // behaves differently at each, so both are scanned.
  result = await scan(TEST_URL, { viewport: 'mobile', pool })
  desktopResult = await scan(TEST_URL, { viewport: 'desktop', pool })
}, 60000)

afterAll(async () => {
  await pool.close()
})

function elementBySelectorPart(part: string, from: ScanResult = result) {
  return from.elements.all.find((el) => el.selector.includes(part))
}

function flagged(part: string, from: ScanResult = result): boolean {
  return (from.ruleEngine ?? []).some(
    (f) => f.rule === 'touch-targets/minimum-size' && f.element.includes(part),
  )
}

describe('target-sizing measurement in a real browser', () => {
  it('scans at the mobile viewport, so the 44px minimum is the one in play', () => {
    expect(result.viewport.width).toBe(390)
  })

  it('measures the <label> that supplies a sr-only checkbox its hit area', () => {
    const toggle = elementBySelectorPart('nav-toggle')
    expect(toggle, 'sr-only checkbox must still be extracted').toBeDefined()
    // The defect surface: a real 1x1 box that no visibility guard excludes.
    expect(toggle!.bounds.width).toBeLessThan(44)
    expect(toggle!.bounds.height).toBeLessThan(44)
    expect(toggle!.computedStyles?.display).not.toBe('none')
    expect(toggle!.computedStyles?.visibility).toBe('visible')
    // HTMLInputElement.labels resolved the for=/id= association.
    expect(toggle!.targetContext?.labelTargetBounds).toMatchObject({ width: 44, height: 44 })
  })

  it('measures the prose surrounding an inline link', () => {
    const link = elementBySelectorPart('prose-link')
    expect(link).toBeDefined()
    expect(link!.computedStyles?.display).toBe('inline')
    expect(link!.targetContext?.surroundingTextChars).toBeGreaterThan(100)
  })

  it('reports near-zero surrounding text for a paragraph containing only a link', () => {
    const link = elementBySelectorPart('lonely-link')
    expect(link).toBeDefined()
    expect(link!.targetContext?.surroundingTextChars).toBe(0)
  })

  it('reports separator-only surrounding text for a "|"-separated inline nav', () => {
    const link = elementBySelectorPart('nav-a')
    expect(link).toBeDefined()
    // "Home | About" minus "Home" and "About" leaves " | " collapsed to "|"
    // plus its spaces — a handful of characters, nowhere near prose.
    expect(link!.targetContext?.surroundingTextChars).toBeLessThan(12)
  })
})

describe('touch-targets/minimum-size against the measured page', () => {
  it('does NOT flag the inline prose link (WCAG 2.5.8 inline exception)', () => {
    expect(flagged('prose-link')).toBe(false)
  })

  it('does NOT flag the sr-only checkbox whose label is 44x44', () => {
    expect(flagged('nav-toggle')).toBe(false)
  })

  it('DOES flag the control whose label is itself only 30x30, reporting the label bounds', () => {
    const finding = (result.ruleEngine ?? []).find(
      (f) => f.rule === 'touch-targets/minimum-size' && f.element.includes('tiny-toggle'),
    )
    expect(finding, 'an undersized label is a real, actionable finding').toBeDefined()
    expect(finding!.evidence).toMatchObject({ bounds: { width: 30, height: 30 } })
  })

  it('DOES flag the small links in a "|"-separated inline nav', () => {
    expect(flagged('nav-a')).toBe(true)
    expect(flagged('nav-b')).toBe(true)
  })

  it('DOES flag a link that is the sole content of its paragraph', () => {
    expect(flagged('lonely-link')).toBe(true)
  })

  it('DOES flag an inline-flex icon button sitting in a sentence', () => {
    expect(flagged('icon-link')).toBe(true)
  })

  it('DOES flag an inline-block chip sitting in a sentence', () => {
    expect(flagged('chip')).toBe(true)
  })

  it('DOES flag a 20x20 checkbox whose label is hidden — a real target, not a stub', () => {
    expect(flagged('real-checkbox')).toBe(true)
  })
})

// The reported defect appeared at both viewports, and the responsive toggle
// is a DIFFERENT case at each: on mobile its <label> supplies a 44x44 hit
// area; above the breakpoint the label is display:none and the 1x1 stub is
// all that remains, with no pointer target to size at all.
describe('the same page at desktop, where the toggle label is display:none', () => {
  it('measures a visible label on mobile', () => {
    const toggle = elementBySelectorPart('breakpoint-toggle')
    expect(toggle!.targetContext?.labelTargetBounds).toMatchObject({ width: 44, height: 44 })
    expect(toggle!.targetContext?.associatedLabels).toBe(1)
    expect(flagged('breakpoint-toggle')).toBe(false)
  })

  it('records the label association but no visible label bounds at desktop', () => {
    expect(desktopResult.viewport.width).toBeGreaterThanOrEqual(1024)
    const toggle = elementBySelectorPart('breakpoint-toggle', desktopResult)
    expect(toggle, 'the control is still in the DOM at desktop').toBeDefined()
    expect(toggle!.targetContext?.associatedLabels).toBe(1)
    expect(toggle!.targetContext?.labelTargetBounds).toBeUndefined()
  })

  it('does NOT flag the stub at desktop — the affordance is switched off there', () => {
    expect(flagged('breakpoint-toggle', desktopResult)).toBe(false)
  })

  it('still flags the 20x20 checkbox at desktop against the 24px minimum', () => {
    expect(flagged('real-checkbox', desktopResult)).toBe(true)
  })

  it('still flags the undersized 30x30 label at desktop', () => {
    expect(flagged('tiny-toggle', desktopResult)).toBe(false) // 30x30 clears the 24px desktop minimum
    expect(flagged('tiny-toggle')).toBe(true) // but not the 44px mobile one
  })
})
