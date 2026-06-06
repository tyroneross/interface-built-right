/**
 * Tests for the canonical device profile registry and helpers.
 *
 * These are pure-data assertions — no browser needed — so they can run
 * in every CI matrix entry. The CDP-call-ordering assertions live in
 * src/engine/cdp/emulation.test.ts where they belong.
 */

import { describe, it, expect } from 'vitest'
import {
  DEVICES,
  DEVICE_NAMES,
  deviceToViewport,
  resolveDevice,
  viewportToConfig,
  MOBILE_SAFARI_UA,
  TABLET_SAFARI_UA,
  ANDROID_CHROME_UA,
  type DeviceProfile,
} from './devices.js'
import { VIEWPORTS } from './schemas.js'

describe('DEVICES registry', () => {
  it('exports the documented canonical set', () => {
    // If you add or remove a device, update README + CLAUDE.md + the
    // help string in src/bin/ibr.ts in the same commit. The CLI help
    // text reads DEVICE_NAMES directly so it stays in sync, but the
    // docs do not.
    expect(DEVICE_NAMES).toEqual([
      'iphone-14',
      'iphone-14-pro-max',
      'pixel-7',
      'ipad-air',
      'ipad-pro-11',
      'desktop-1440',
    ])
  })

  it('mobile devices have mobile:true, touch enabled, and a mobile UA', () => {
    for (const name of DEVICE_NAMES) {
      const d = DEVICES[name]
      if (d.mobile) {
        expect(d.hasTouch, `${name}.hasTouch`).toBe(true)
        expect(d.userAgent, `${name}.userAgent`).toBeDefined()
        // The pre-1.1.0 bug was: mobile dimensions + desktop UA = sites
        // serve their desktop HTML. We never want to reintroduce that.
        expect(d.userAgent).not.toMatch(/Macintosh|Windows NT 10|X11; Linux x86_64/)
      }
    }
  })

  it('desktop profile is mobile:false with no touch', () => {
    // Annotate as DeviceProfile so the optional userAgent member is visible
    // through the `as const satisfies` literal narrowing in DEVICES.
    const d: DeviceProfile = DEVICES['desktop-1440']
    expect(d.mobile).toBe(false)
    expect(d.hasTouch).toBe(false)
    expect(d.userAgent).toBeUndefined()
  })
})

describe('resolveDevice', () => {
  it('returns the profile for a known slug', () => {
    const p = resolveDevice('iphone-14')
    expect(p.name).toBe('iphone-14')
    expect(p.width).toBe(390)
    expect(p.height).toBe(844)
  })

  it('throws a helpful error for unknown slugs', () => {
    // Failing loudly here is the whole point: pre-1.1.0 silently
    // rendered at desktop. Now the user sees the known set.
    expect(() => resolveDevice('iphone-99')).toThrowError(
      /Unknown --device "iphone-99"\. Known devices: iphone-14, /,
    )
  })
})

describe('deviceToViewport', () => {
  it('preserves all CDP-relevant fields for a mobile device', () => {
    const v = deviceToViewport(DEVICES['iphone-14'])
    expect(v).toEqual({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      userAgent: MOBILE_SAFARI_UA,
      hasTouch: true,
    })
  })

  it('preserves all CDP-relevant fields for a desktop device', () => {
    const v = deviceToViewport(DEVICES['desktop-1440'])
    expect(v).toEqual({
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
      userAgent: undefined,
      hasTouch: false,
    })
  })
})

describe('viewportToConfig', () => {
  it('forwards mobile/UA/touch from the mobile preset (1.1.0 fix)', () => {
    // Pre-1.1.0 every call site did { width, height } and dropped the
    // emulation metadata on the floor. viewportToConfig is the single
    // helper that prevents that regression.
    const c = viewportToConfig(VIEWPORTS.mobile)
    expect(c.width).toBe(390)
    expect(c.height).toBe(844)
    expect(c.mobile).toBe(true)
    expect(c.deviceScaleFactor).toBe(3)
  })

  it('forwards mobile from the tablet preset (1.1.0 fix)', () => {
    const c = viewportToConfig(VIEWPORTS.tablet)
    expect(c.width).toBe(820)
    expect(c.height).toBe(1180)
    expect(c.mobile).toBe(true)
    expect(c.deviceScaleFactor).toBe(2)
  })

  it('returns desktop unchanged', () => {
    const c = viewportToConfig(VIEWPORTS.desktop)
    expect(c.width).toBe(1920)
    expect(c.height).toBe(1080)
    expect(c.mobile).toBe(false)
  })
})

describe('canonical user agents', () => {
  it('all three UAs identify as mobile/tablet platforms', () => {
    expect(MOBILE_SAFARI_UA).toMatch(/iPhone/)
    expect(TABLET_SAFARI_UA).toMatch(/iPad/)
    expect(ANDROID_CHROME_UA).toMatch(/Android/)
  })
})
