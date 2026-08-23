/**
 * Real-browser coverage for breadcrumb detection in src/extract.ts. Unit tests
 * cover the rule decisions; this proves the DOM measurement actually supplies
 * those decisions with landmark, list, and current-page facts.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BrowserPool } from '../engine/browser-pool.js'
import { scan, type ScanResult } from '../scan.js'

const TEST_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 16px/1.5 system-ui, sans-serif; }
  a { display: inline-flex; min-width: 44px; min-height: 44px; align-items: center; }
</style>
</head><body>
  <div class="breadcrumb-page-shell">
    <nav class="good-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/toolkit">Toolkit</a></li>
        <li><a href="/toolkit/research" aria-current="page">Research</a></li>
      </ol>
    </nav>
  </div>

  <nav class="plain-breadcrumb" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="/projects">Projects</a></li>
      <li>Graph Engineering</li>
    </ol>
  </nav>

  <nav class="unnamed-breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="/preview" aria-current="page">Preview</a></li>
    </ol>
  </nav>

  <div class="broken-breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <a href="/settings">Settings</a>
  </div>
</body></html>`

const pool = new BrowserPool({ launchOptions: { headless: true } })
let result: ScanResult

beforeAll(async () => {
  result = await scan('data:text/html,' + encodeURIComponent(TEST_PAGE), {
    viewport: 'mobile',
    pool,
  })
}, 60000)

afterAll(async () => {
  await pool.close()
})

function breadcrumbFindings(rootSelectorPart: string) {
  return (result.ruleEngine ?? []).filter(finding =>
    finding.rule.startsWith('breadcrumbs/') && finding.element.includes(rootSelectorPart)
  )
}

describe('breadcrumb extraction and rules in a real browser', () => {
  it('captures the labelled landmark, list, and final current page', () => {
    const home = result.elements.all.find(element =>
      element.selector.includes('good-breadcrumb') && element.text === 'Home'
    )
    expect(home?.breadcrumb).toMatchObject({
      rootTag: 'nav',
      accessibleName: 'Breadcrumb',
      listTag: 'ol',
      itemCount: 3,
      currentValues: ['page'],
      currentPageCount: 1,
      currentPageIsLast: true,
      lastItemIsLink: true,
      representative: true,
    })
    expect(breadcrumbFindings('good-breadcrumb')).toEqual([])
  })

  it('accepts a plain-text current page without aria-current', () => {
    const home = result.elements.all.find(element =>
      element.selector.includes('plain-breadcrumb') && element.text === 'Home'
    )
    expect(home?.breadcrumb).toMatchObject({
      itemCount: 3,
      currentPageCount: 0,
      lastItemIsLink: false,
    })
    expect(breadcrumbFindings('plain-breadcrumb')).toEqual([])
  })

  it('reports an unnamed breadcrumb landmark', () => {
    expect(breadcrumbFindings('unnamed-breadcrumb').map(finding => finding.rule))
      .toContain('breadcrumbs/navigation-landmark')
  })

  it('reports a non-landmark trail without list semantics or current-page state', () => {
    const rules = breadcrumbFindings('broken-breadcrumb').map(finding => finding.rule)
    expect(rules).toEqual(expect.arrayContaining([
      'breadcrumbs/navigation-landmark',
      'breadcrumbs/list-structure',
      'breadcrumbs/current-page',
    ]))
  })
})
