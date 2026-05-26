/**
 * CDP Emulation domain — viewport, device metrics, UA, touch, media features.
 * Used by EngineDriver to make a page render as if it were a specific device
 * BEFORE the first navigate. See ../driver.ts and ../../devices.ts.
 */

import type { CdpConnection } from './connection.js'

export interface ViewportConfig {
  width: number
  height: number
  /** Device pixel ratio. Default: 1. */
  deviceScaleFactor?: number
  /** True for mobile/tablet layout viewports. Default: false. */
  mobile?: boolean
  /** Override User-Agent string. Omit to keep Chrome's default. */
  userAgent?: string
  /** Enable touch emulation. Default: derived from `mobile`. */
  hasTouch?: boolean
}

export class EmulationDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  /**
   * Override device metrics (viewport size, scale, mobile layout mode).
   * Does NOT set UA or touch — for a full device emulation, use
   * `applyDeviceProfile()` instead.
   */
  async setDeviceMetrics(config: ViewportConfig): Promise<void> {
    await this.conn.send('Emulation.setDeviceMetricsOverride', {
      width: config.width,
      height: config.height,
      deviceScaleFactor: config.deviceScaleFactor ?? 1,
      mobile: config.mobile ?? false,
    }, this.sessionId)
  }

  /**
   * Clear device metrics override (restore defaults).
   */
  async clearDeviceMetrics(): Promise<void> {
    await this.conn.send('Emulation.clearDeviceMetricsOverride', {}, this.sessionId)
  }

  /**
   * Override the User-Agent string for subsequent requests. Pages already
   * loaded keep their original UA; navigate after calling this.
   */
  async setUserAgent(userAgent: string): Promise<void> {
    await this.conn.send('Emulation.setUserAgentOverride', {
      userAgent,
    }, this.sessionId)
  }

  /**
   * Enable or disable touch event emulation. When enabled, `maxTouchPoints`
   * defaults to 5 (matches modern phones).
   */
  async setTouchEmulation(enabled: boolean, maxTouchPoints = 5): Promise<void> {
    await this.conn.send('Emulation.setTouchEmulationEnabled', {
      enabled,
      maxTouchPoints: enabled ? maxTouchPoints : 1,
    }, this.sessionId)
  }

  /**
   * Apply a full device profile in one call: metrics + UA + touch. Use this
   * from `EngineDriver.launch()` BEFORE the first navigate so the page sees
   * the device emulation on its initial request, not after.
   *
   * Order matters: UA override first (some sites branch on UA during the
   * initial HTML response), then metrics, then touch.
   */
  async applyDeviceProfile(config: ViewportConfig): Promise<void> {
    if (config.userAgent) {
      await this.setUserAgent(config.userAgent)
    }
    await this.setDeviceMetrics(config)
    const wantsTouch = config.hasTouch ?? config.mobile ?? false
    await this.setTouchEmulation(wantsTouch)
  }

  /**
   * Hide scrollbars (useful for consistent screenshots).
   */
  async setScrollbarsHidden(hidden: boolean): Promise<void> {
    await this.conn.send('Emulation.setScrollbarsHidden', { hidden }, this.sessionId)
  }

  /**
   * Emulate reduced motion preference (disable animations for screenshots).
   */
  async setReducedMotion(enabled: boolean): Promise<void> {
    await this.conn.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: enabled ? 'reduce' : '' }],
    }, this.sessionId)
  }
}
