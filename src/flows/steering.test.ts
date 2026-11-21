import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { EngineDriver } from '../engine/driver.js'
import { BROWSER_SPAWN_TIMEOUT_MS } from '../engine/net-timeout.js'
import { runSteering, steeringScriptSchema } from './steering.js'

const query = { name: 'Query', role: 'textfield' }
const search = { name: 'Search', role: 'button' }
const results = { name: 'Results', role: 'heading' }
const ready = { name: 'Ready', role: 'heading' }
const click = (id: string) => ({
  id, anchor: search, target: search, vector: { dx: 0, dy: 0 },
  action: { type: 'click' }, expect: { type: 'visible', target: results }, timeoutMs: 500,
})
const script = (steps: unknown[]) => steeringScriptSchema.parse({
  version: 1, viewport: { width: 800, height: 600 }, steps,
})
const fixture = `
  <!doctype html><meta charset="utf-8">
  <style>
    input, button { position: absolute; top: 100px; width: 160px; height: 40px; box-sizing: border-box; }
    input { left: 10px; }
    #go { left: 180px; width: 100px; }
    #next { top: 200px; left: 10px; }
  </style>
  <h1>Ready</h1>
  <input id="query" aria-label="Query">
  <button id="go" onclick="search(event)">Search</button>
  <button id="next" onclick="location.href='/next'">Continue</button>
  <output id="response"></output>
  <script>
    const clicks = [];
    const moves = [];
    addEventListener('mousemove', event => moves.push([event.clientX, event.clientY]));
    const search = event => {
      clicks.push(event.isTrusted);
      if (document.querySelector('#query').value === 'snow 🌨') {
        setTimeout(() => { document.querySelector('#response').innerHTML = '<h2>Results</h2>' }, 100);
      }
    };
  </script>`

const driver = new EngineDriver()
let server: Server
let origin: string
let foreignServer: Server
let foreignOrigin: string
let foreignWrites = 0
const replay = (path: ReturnType<typeof script>) => runSteering(driver, path, origin)

async function listen(server: Server): Promise<string> {
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture port')
  return `http://127.0.0.1:${address.port}`
}

beforeAll(async () => {
  foreignServer = createServer((request, response) => {
    if (request.url === '/write') foreignWrites++
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end('<button onclick="fetch(\'/write\')">Search</button><h1>Ready</h1>')
  })
  foreignOrigin = await listen(foreignServer)
  server = createServer((request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { location: foreignOrigin + '/next' }).end()
      return
    }
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end(request.url === '/next' ? '<h1>Next page</h1>' : fixture)
  })
  origin = await listen(server)
  await driver.launch({ headless: true, mode: 'local', shareChrome: false,
    viewport: { width: 800, height: 600 } })
}, BROWSER_SPAWN_TIMEOUT_MS + 10000)

beforeEach(async () => {
  await driver.navigate(origin)
})

afterAll(async () => {
  try {
    await driver.close()
  } finally {
    await Promise.all([server, foreignServer].map(
      server => new Promise<void>(resolve => { server?.close(() => resolve()) ?? resolve() }),
    ))
  }
})

describe('steering in Chrome', () => {
  it('runs a guarded path twice with the same receipts, real input, and a navigation assertion', async () => {
    const next = { name: 'Continue', role: 'button' }
    const path = script([
      { ...click('conditional'), when: { type: 'visible', target: results } },
      { id: 'type', anchor: query, target: query, vector: { dx: 0, dy: 0 },
        action: { type: 'type', text: 'snow 🌨' },
        expect: { type: 'valueEquals', target: query, value: 'snow 🌨' } },
      { ...click('search'), anchor: search, vector: { dx: 0.2, dy: 0 },
        when: { type: 'visible', target: ready } },
      { ...click('continue'), anchor: next, target: next, expect: { type: 'pathEquals', path: '/next' } },
    ])
    const initial = await replay(script(path.steps.slice(0, 3)))
    expect(initial.success, JSON.stringify(initial)).toBe(true)
    expect(await driver.evaluate('clicks')).toEqual([true])
    expect(await driver.evaluate('moves')).toEqual([[90, 120], [230, 120], [250, 120]])

    await driver.navigate(origin)
    const first = await replay(path)
    expect(first.success, JSON.stringify(first)).toBe(true)
    expect(first.steps.map(step => step.status)).toEqual(['skipped', 'passed', 'passed', 'passed'])
    expect(first.steps[2].aim).toEqual({
      from: { x: 230, y: 120 }, to: { x: 250, y: 120 }, viewport: { width: 800, height: 600 },
    })
    expect(first.steps[3].after).toEqual({ matched: true, actual: '/next' })
    await driver.navigate(origin)
    expect(await replay(path)).toEqual(first)
  })

  it('halts after an unverified response and never runs the next click', async () => {
    const receipt = await replay(script([click('no-response'), click('later')]))
    expect(receipt.success).toBe(false)
    expect(receipt.remainingSteps).toBe(1)
    expect(receipt.steps[0]).toMatchObject({
      id: 'no-response', status: 'failed', after: { matched: false, actual: 'absent' },
      reason: 'Expected state did not settle within 500 ms',
    })
    expect(await driver.evaluate('clicks')).toEqual([true])
  })

  it('waits for an exact anchor and target to appear before acting', async () => {
    await driver.evaluate(`(() => {
      const button = document.querySelector('#go')
      button.remove()
      document.querySelector('#query').value = 'snow 🌨'
      setTimeout(() => document.body.appendChild(button), 150)
    })()`)
    const receipt = await replay(script([{ ...click('wait-for-controls'), readyTimeoutMs: 1200 }]))
    expect(receipt.success, JSON.stringify(receipt)).toBe(true)
    expect(await driver.evaluate('clicks')).toEqual([true])
  })

  it('rejects a viewport exit and does not send mouse input', async () => {
    const receipt = await replay(script([
      { ...click('out-of-bounds'), anchor: query, vector: { dx: -1, dy: 0 } },
    ]))
    expect(receipt.steps[0].reason).toMatch(/outside the viewport/)
    expect(await driver.evaluate('[moves.length, clicks.length]')).toEqual([0, 0])
  })

  it('rejects an aim that hits another element', async () => {
    const receipt = await replay(script([{ ...click('wrong-target'), target: query }]))
    expect(receipt.steps[0].reason).toMatch(/does not hit/)
    expect(await driver.evaluate('[moves.length, clicks.length]')).toEqual([0, 0])
  })

  it('rejects a nested ARIA control at the point even when it sits inside the named target', async () => {
    await driver.evaluate(`(() => {
      document.body.insertAdjacentHTML('beforeend', \`
        <div role="group" aria-label="Options" style="position:absolute;top:141px;left:140px;width:80px;height:36px">
          <div role="checkbox" aria-checked="false" aria-label="Enabled" style="width:100%;height:100%">Enabled</div>
        </div>\`)
      document.querySelector('[role="checkbox"]').addEventListener('click', () => clicks.push('checkbox'))
    })()`)
    const group = { name: 'Options', role: 'group' }
    const receipt = await replay(script([
      { ...click('nested-custom-action'), anchor: query, vector: { dx: 0.5625, dy: 0.975 }, target: group },
    ]))
    expect(receipt.steps[0].reason).toMatch(/does not hit/)
    expect(await driver.evaluate('[moves.length, clicks.length]')).toEqual([0, 0])
  })

  it('halts if hovering covers the target with a different button', async () => {
    await driver.evaluate(`document.querySelector('#go').addEventListener('mouseover', () => {
      const overlay = document.createElement('button')
      overlay.textContent = 'Other'
      overlay.style.cssText = 'left: 180px; width: 100px'
      overlay.onclick = () => clicks.push('other')
      document.body.appendChild(overlay)
    }, { once: true })`)
    const receipt = await replay(script([click('covered')]))
    expect(receipt.steps[0].reason).toMatch(/does not hit/)
    expect(await driver.evaluate('clicks')).toEqual([])
  })

  it('revalidates the unique semantic binding after mouse movement', async () => {
    const moveToSearch = { ...click('hover-rename'), anchor: query, vector: { dx: 0.875, dy: 0 } }
    await driver.evaluate(`document.querySelector('#go').addEventListener('mouseover', () => {
      document.querySelector('#go').setAttribute('aria-label', 'Other')
    }, { once: true })`)
    const renamed = await replay(script([moveToSearch]))
    expect(renamed.steps[0].reason).toMatch(/target no longer identifies/)
    expect(await driver.evaluate('clicks')).toEqual([])

    await driver.navigate(origin)
    await driver.evaluate(`document.querySelector('#go').addEventListener('mouseover', () => {
      document.querySelector('#query').setAttribute('aria-label', 'Other')
    }, { once: true })`)
    const anchorChanged = await replay(script([moveToSearch]))
    expect(anchorChanged.steps[0].reason).toMatch(/anchor no longer identifies/)
    expect(await driver.evaluate('clicks')).toEqual([])

    await driver.navigate(origin)
    await driver.evaluate(`document.querySelector('#go').addEventListener('mouseover', () => {
      const original = document.querySelector('#go')
      original.replaceWith(original.cloneNode(true))
    }, { once: true })`)
    const replaced = await replay(script([moveToSearch]))
    expect(replaced.steps[0].reason).toMatch(/target no longer identifies/)
    expect(await driver.evaluate('clicks')).toEqual([])

    await driver.navigate(origin)
    await driver.evaluate(`document.querySelector('#go').addEventListener('mouseover', () => {
      document.body.insertAdjacentHTML('beforeend', '<button>Search</button>')
    }, { once: true })`)
    const ambiguous = await replay(script([moveToSearch]))
    expect(ambiguous.steps[0].reason).toMatch(/Ambiguous target/)
    expect(await driver.evaluate('clicks')).toEqual([])
  })

  it('stops if hovering invalidates the guard', async () => {
    await driver.evaluate(`document.querySelector('#go').addEventListener('mouseover', () => {
      document.querySelector('h1').textContent = 'Busy'
    }, { once: true })`)
    const receipt = await replay(script([
      { ...click('changing-guard'), when: { type: 'visible', target: ready } },
    ]))
    expect(receipt.steps[0]).toMatchObject({
      reason: 'The step guard changed before input',
      guard: { observed: { matched: false, actual: 'absent' } },
    })
    expect(await driver.evaluate('clicks')).toEqual([])
  })

  it('requires the expected state to stay false through focus, before actual text input', async () => {
    await driver.evaluate(`(() => {
      const input = document.querySelector('#query')
      window.inputAttempts = 0
      input.onfocus = () => { input.value = 'snow 🌨' }
      input.onbeforeinput = event => { inputAttempts++; event.preventDefault() }
    })()`)
    const receipt = await replay(script([
      { ...click('pre-filled-on-focus'), anchor: query, target: query,
        action: { type: 'type', text: 'snow 🌨' },
        expect: { type: 'valueEquals', target: query, value: 'snow 🌨' } },
    ]))
    expect(receipt.steps[0]).toMatchObject({
      reason: 'Expected state already held before text insertion',
      before: { matched: true, actual: 'snow 🌨' },
    })
    expect(await driver.evaluate('window.inputAttempts')).toBe(0)
  })

  it('rejects both initial redirects and same-path navigation to a foreign origin', async () => {
    await driver.navigate(origin + '/redirect')
    expect(await driver.evaluate('location.origin')).toBe(foreignOrigin)
    const redirect = await replay(script([click('foreign-control')]))
    expect(redirect).toMatchObject({ success: false, failure: 'The page left the requested origin' })
    expect(foreignWrites).toBe(0)

    await driver.navigate(origin)
    await driver.evaluate(`document.querySelector('#next').onclick = () => { location.href = '${foreignOrigin}/next' }`)
    const next = { name: 'Continue', role: 'button' }
    const navigation = await replay(script([
      { ...click('foreign-path'), anchor: next, target: next, expect: { type: 'pathEquals', path: '/next' } },
      click('foreign-control'),
    ]))
    expect(navigation).toMatchObject({
      success: false, failure: 'The page left the requested origin', remainingSteps: 1,
    })
    expect(foreignWrites).toBe(0)
  })

  it('rejects an already true assertion and an assertion that became true on hover', async () => {
    const already = await replay(script([{ ...click('already'), expect: { type: 'visible', target: ready } }]))
    expect(already.steps[0].reason).toMatch(/already held/)
    await driver.evaluate(`document.querySelector('#go').addEventListener('mouseover', () => {
      document.querySelector('#response').innerHTML = '<h2>Results</h2>'
    }, { once: true })`)
    const hovered = await replay(script([click('hovered')]))
    expect(hovered.steps[0].reason).toMatch(/already held/)
    expect(await driver.evaluate('clicks')).toEqual([])
  })

  it('fails closed on ambiguous accessible names, unsupported focus and all-skipped scripts', async () => {
    const skipped = await replay(script([{ ...click('guarded'), when: { type: 'visible', target: results } }]))
    expect(skipped).toMatchObject({ success: false, failure: 'All steps were skipped' })
    await driver.evaluate(`document.querySelector('#query').onclick = () => document.querySelector('#next').focus()`)
    const focus = await replay(script([
      { ...click('lost-focus'), anchor: query, target: query, action: { type: 'type', text: 'should not type' } },
    ]))
    expect(focus.steps[0].reason).toMatch(/did not retain text focus/)
    expect(await driver.evaluate('document.querySelector("#query").value')).toBe('')
    await driver.evaluate(`document.body.insertAdjacentHTML('beforeend', '<button>Search</button>')`)
    const ambiguous = await replay(script([click('ambiguous')]))
    expect(ambiguous.steps[0].reason).toMatch(/Ambiguous target/)
    expect(await driver.evaluate('clicks')).toEqual([])
  })
})
