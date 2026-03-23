/**
 * CDP Emulation domain — viewport, device metrics, media features.
 * NEW for IBR — responsive testing via device metrics override.
 */

import type { CdpConnection } from './connection.js'

export interface ViewportConfig {
  width: number
  height: number
  deviceScaleFactor?: number   // default: 1
  mobile?: boolean             // default: false
}

export class EmulationDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  /**
   * Override device metrics (viewport size, scale, mobile mode).
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
