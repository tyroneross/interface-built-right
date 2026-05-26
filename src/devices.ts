/**
 * Canonical device profiles for CDP-direct emulation.
 *
 * IBR has no Playwright dependency, so we keep our own profile table
 * (viewport + DPR + mobile flag + UA + touch). Profiles are applied via
 * Emulation.setDeviceMetricsOverride + setUserAgentOverride +
 * setTouchEmulationEnabled BEFORE Page.navigate.
 *
 * Adding a device: pick a representative real product, copy width/height
 * from its CSS-pixel viewport, DPR from its screen, and UA from a current
 * release of the default browser. Keep the table small — exhaustiveness
 * is not the goal; covering the common breakpoints is.
 */

import type { ViewportConfig } from './engine/cdp/emulation.js'
import type { Viewport } from './schemas.js'

/**
 * Canonical mobile Safari UA (iOS 17). Used when a profile does not
 * specify its own UA.
 */
export const MOBILE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

/**
 * Canonical iPad Safari UA (iOS 17).
 */
export const TABLET_SAFARI_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

/**
 * Canonical Android Chrome UA (Chrome 121 / Android 14).
 */
export const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

/**
 * A device profile — everything the CDP Emulation domain needs to make
 * the page render as if it were that device.
 */
export interface DeviceProfile {
  /** Canonical slug (e.g. "iphone-14"). */
  name: string
  /** CSS-pixel viewport width. */
  width: number
  /** CSS-pixel viewport height. */
  height: number
  /** Device pixel ratio (default 1). */
  deviceScaleFactor: number
  /** True for phones + tablets (controls layout-viewport behavior). */
  mobile: boolean
  /** User-Agent override (omit to keep Chrome's default). */
  userAgent?: string
  /** Whether to enable touch emulation (default: derived from `mobile`). */
  hasTouch?: boolean
}

/**
 * Canonical device set. Keep small + obvious; favor "one per common
 * breakpoint" over completeness. Slugs are stable contract surface — do
 * not rename without a deprecation entry.
 */
export const DEVICES = {
  'iphone-14': {
    name: 'iphone-14',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
    userAgent: MOBILE_SAFARI_UA,
    hasTouch: true,
  },
  'iphone-14-pro-max': {
    name: 'iphone-14-pro-max',
    width: 430,
    height: 932,
    deviceScaleFactor: 3,
    mobile: true,
    userAgent: MOBILE_SAFARI_UA,
    hasTouch: true,
  },
  'pixel-7': {
    name: 'pixel-7',
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    mobile: true,
    userAgent: ANDROID_CHROME_UA,
    hasTouch: true,
  },
  'ipad-air': {
    name: 'ipad-air',
    width: 820,
    height: 1180,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent: TABLET_SAFARI_UA,
    hasTouch: true,
  },
  'ipad-pro-11': {
    name: 'ipad-pro-11',
    width: 834,
    height: 1194,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent: TABLET_SAFARI_UA,
    hasTouch: true,
  },
  'desktop-1440': {
    name: 'desktop-1440',
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    hasTouch: false,
  },
} as const satisfies Record<string, DeviceProfile>

export type DeviceName = keyof typeof DEVICES

/**
 * Known device slugs, in declaration order. Use this for `--help` and
 * docs to keep them in sync with `DEVICES`.
 */
export const DEVICE_NAMES: ReadonlyArray<DeviceName> = Object.freeze(
  Object.keys(DEVICES) as DeviceName[],
)

/**
 * Resolve a device by slug. Throws when the slug is unknown so the
 * caller can surface a useful CLI error rather than silently rendering
 * at desktop (the pre-fix behavior of `--viewport mobile`).
 */
export function resolveDevice(name: string): DeviceProfile {
  const profile = (DEVICES as Record<string, DeviceProfile>)[name]
  if (!profile) {
    const known = DEVICE_NAMES.join(', ')
    throw new Error(
      `Unknown --device "${name}". Known devices: ${known}.`,
    )
  }
  return profile
}

/**
 * Convert a DeviceProfile into the ViewportConfig shape EngineDriver.launch
 * and EmulationDomain.applyDeviceProfile both expect. Keeps the field
 * names consistent across CLI, scan(), and driver.launch().
 */
export function deviceToViewport(profile: DeviceProfile): ViewportConfig {
  return {
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: profile.deviceScaleFactor,
    mobile: profile.mobile,
    userAgent: profile.userAgent,
    hasTouch: profile.hasTouch ?? profile.mobile,
  }
}

/**
 * Normalize a Viewport preset (from VIEWPORTS) into the ViewportConfig
 * shape EngineDriver.launch expects. Use this at every driver.launch call
 * site that previously did `{ width: viewport.width, height: viewport.height }`
 * — that pattern silently dropped the mobile/UA/touch metadata and was
 * the proximate cause of the "--viewport mobile renders desktop" bug.
 */
export function viewportToConfig(viewport: Viewport): ViewportConfig {
  return {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
    userAgent: viewport.userAgent,
    hasTouch: viewport.hasTouch,
  }
}
