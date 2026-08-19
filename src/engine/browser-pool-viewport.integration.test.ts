/**
 * Integration regression test for the reported bug: an `ask`/`scan` MCP
 * call with `viewport: 'mobile'` against the warm MCP BrowserPool returned
 * DESKTOP-sized bounds and flagged a Tailwind `hidden md:flex` desktop-nav
 * link as an interactive touch target — because the pool's driver never
 * received CDP device-metrics emulation for the requested viewport (see
 * `initScanViewport` in src/scan.ts, and the unit tests in
 * src/engine/browser-pool.test.ts).
 *
 * This test exercises the REAL bug surface end-to-end: a real Chrome via a
 * real BrowserPool, scanning a page whose nav link visibility is governed
 * by an actual `@media (min-width: 768px)` rule (the same mechanism
 * Tailwind's `hidden md:flex` compiles to) — not a mock. It reproduces the
 * exact reported symptoms:
 *   1. mobile scan must NOT flag the hidden nav link as a touch target
 *      (it must be excluded as display:none)
 *   2. mobile scan bounds must fit inside the 390px mobile viewport width
 *   3. a SUBSEQUENT desktop scan on the SAME pooled driver must see the
 *      link visible with desktop-width bounds — proving the pool re-applies
 *      viewport per call rather than sticking to whatever the first call
 *      requested.
 *
 * Requires Chrome installed — see vitest.config.ts's BROWSER_INTEGRATION
 * exclusion list.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { BrowserPool } from './browser-pool.js'
import { scan } from '../scan.js'

// Minimal stand-in for the reported page: a nav link hidden by default
// (mobile-first, matching Tailwind's `hidden` utility) and shown at >=768px
// (matching Tailwind's `md:flex` responsive variant). Real CSS, real media
// query — no mocking of layout or emulation.
const TEST_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; }
  nav { position: relative; }
  a.nav-link { display: none; padding: 10px 20px; }
  @media (min-width: 768px) {
    a.nav-link { display: flex; }
  }
  /* Occupies real layout space (unlike display:none) AND is undersized
     (10x10 < the 24px desktop minimum) — if the exclusion fix did NOT
     work, these would be flagged as touch-target violations on their own
     size alone, so a passing test here proves exclusion, not merely that
     the elements happen to be big enough. */
  a.visibility-hidden-link { visibility: hidden; width: 10px; height: 10px; display: block; }
  a.opacity-zero-link { opacity: 0; width: 10px; height: 10px; display: block; }
</style>
</head><body>
<nav class="relative">
  <div class="flex">
    <a class="nav-link hidden" href="/home">Home</a>
  </div>
</nav>
<a class="visibility-hidden-link" href="/invisible">Invisible</a>
<a class="opacity-zero-link" href="/ghost">Ghost</a>
</body></html>`

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE)

const pool = new BrowserPool({ launchOptions: { headless: true } })

afterAll(async () => {
  await pool.close()
})

describe('BrowserPool + scan(): per-call viewport correctness (mobile-viewport touch-target bug)', () => {
  it('mobile scan excludes the hidden nav link and reports viewport-consistent bounds', async () => {
    const result = await scan(TEST_URL, { viewport: 'mobile', pool })

    expect(result.viewport.width).toBe(390)

    const navLink = result.elements.all.find((el) => el.tagName === 'a')
    expect(navLink, 'nav link must still be extracted (present in DOM)').toBeDefined()

    // Symptom 2: bounds must be viewport-consistent, not desktop-width.
    // display:none collapses getBoundingClientRect to 0x0 when the
    // viewport is genuinely 390px wide.
    expect(navLink!.bounds.width).toBe(0)
    expect(navLink!.bounds.height).toBe(0)
    expect(navLink!.computedStyles?.display).toBe('none')

    // Symptom 1: the touch-target rule must NOT flag it.
    const touchTargetFindings = (result.ruleEngine ?? []).filter(
      (r) => r.rule === 'touch-targets/minimum-size',
    )
    const flaggedTheNavLink = touchTargetFindings.some((f) => f.element.includes('nav-link'))
    expect(flaggedTheNavLink).toBe(false)
  }, 20000)

  it('a SUBSEQUENT desktop scan on the SAME pooled driver sees the link at desktop width (no sticky mobile emulation)', async () => {
    const result = await scan(TEST_URL, { viewport: 'desktop', pool })

    expect(result.viewport.width).toBeGreaterThanOrEqual(1024)

    const navLink = result.elements.all.find((el) => el.tagName === 'a')
    expect(navLink).toBeDefined()

    // At desktop width the media query flips the link to display:flex —
    // proving the pool re-applied THIS call's viewport rather than
    // carrying over the previous (mobile) call's emulation.
    expect(navLink!.computedStyles?.display).toBe('flex')
    expect(navLink!.bounds.width).toBeGreaterThan(0)
    expect(navLink!.bounds.height).toBeGreaterThan(0)
  }, 20000)

  // Adjacent defect found while verifying the touch-targets filter (task
  // item 3): src/extract.ts never populated computedStyles.display/
  // visibility/opacity, so isNonVisibleOrZeroArea's display/visibility/
  // opacity branches were dead code in production — only the bounds<=0
  // branch ever fired. That branch happens to catch display:none (which
  // collapses getBoundingClientRect to 0x0), but visibility:hidden and
  // opacity:0 elements keep their full layout box and were silently
  // graded for touch-target size. Fixed by extracting the three fields
  // (src/extract.ts) so the existing guard's checks actually run.
  it('excludes visibility:hidden and opacity:0 elements that retain full layout bounds', async () => {
    const result = await scan(TEST_URL, { viewport: 'desktop', pool })

    const visibilityHidden = result.elements.all.find((el) =>
      el.selector.includes('visibility-hidden-link'),
    )
    const opacityZero = result.elements.all.find((el) => el.selector.includes('opacity-zero-link'))
    expect(visibilityHidden, 'visibility:hidden link must still be extracted').toBeDefined()
    expect(opacityZero, 'opacity:0 link must still be extracted').toBeDefined()

    // Both retain their full 10x10 layout box — bounds<=0 alone cannot
    // exclude them, and 10x10 is below the 24px desktop minimum, so an
    // unfixed guard would flag these as real touch-target violations
    // rather than passing for the wrong reason (size compliance).
    expect(visibilityHidden!.bounds.width).toBeGreaterThan(0)
    expect(opacityZero!.bounds.width).toBeGreaterThan(0)
    expect(visibilityHidden!.computedStyles?.visibility).toBe('hidden')
    expect(opacityZero!.computedStyles?.opacity).toBe('0')

    const touchTargetFindings = (result.ruleEngine ?? []).filter(
      (r) => r.rule === 'touch-targets/minimum-size',
    )
    expect(touchTargetFindings.some((f) => f.element.includes('visibility-hidden-link'))).toBe(false)
    expect(touchTargetFindings.some((f) => f.element.includes('opacity-zero-link'))).toBe(false)
  }, 20000)
})
