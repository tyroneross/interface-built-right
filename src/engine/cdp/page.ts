/**
 * CDP Page domain — navigation, screenshots, lifecycle events.
 * Forked from Spectra — extended with getLayoutMetrics, clip screenshots,
 * captureBeyondViewport, and CSS/script injection.
 */

import type { CdpConnection } from './connection.js'

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg'
  quality?: number           // JPEG quality (0-100)
  fullPage?: boolean         // Capture entire scrollable page
  clip?: {                   // Capture specific region
    x: number
    y: number
    width: number
    height: number
    scale?: number
  }
}

export interface LayoutMetrics {
  contentSize: { width: number; height: number }
  layoutViewport: { pageX: number; pageY: number; clientWidth: number; clientHeight: number }
  visualViewport: { offsetX: number; offsetY: number; pageX: number; pageY: number; clientWidth: number; clientHeight: number; scale: number }
}

export class PageDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  async navigate(url: string): Promise<string> {
    const result = await this.conn.send<{ frameId: string }>(
      'Page.navigate', { url }, this.sessionId,
    )
    return result.frameId
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
    const format = options.format ?? 'png'

    if (options.fullPage) {
      return this.fullPageScreenshot(format, options.quality)
    }

    const params: Record<string, unknown> = { format }
    if (options.quality !== undefined) params.quality = options.quality
    if (options.clip) {
      params.clip = { ...options.clip, scale: options.clip.scale ?? 1 }
    }

    const result = await this.conn.send<{ data: string }>(
      'Page.captureScreenshot', params, this.sessionId,
    )
    return Buffer.from(result.data, 'base64')
  }

  /**
   * Full-page screenshot via getLayoutMetrics + device metrics override.
   * Technique: get content size → override viewport to content size →
   * capture with captureBeyondViewport → restore viewport.
   */
  private async fullPageScreenshot(format: 'png' | 'jpeg', quality?: number): Promise<Buffer> {
    const metrics = await this.getLayoutMetrics()
    const { width, height } = metrics.contentSize

    // Override viewport to content dimensions
    await this.conn.send('Emulation.setDeviceMetricsOverride', {
      width: Math.ceil(width),
      height: Math.ceil(height),
      deviceScaleFactor: 1,
      mobile: false,
    }, this.sessionId)

    try {
      const params: Record<string, unknown> = {
        format,
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height, scale: 1 },
      }
      if (quality !== undefined) params.quality = quality

      const result = await this.conn.send<{ data: string }>(
        'Page.captureScreenshot', params, this.sessionId,
      )
      return Buffer.from(result.data, 'base64')
    } finally {
      // Restore original viewport
      await this.conn.send('Emulation.clearDeviceMetricsOverride', {}, this.sessionId)
    }
  }

  async getLayoutMetrics(): Promise<LayoutMetrics> {
    return this.conn.send<LayoutMetrics>(
      'Page.getLayoutMetrics', {}, this.sessionId,
    )
  }

  async enableLifecycleEvents(): Promise<void> {
    await this.conn.send('Page.setLifecycleEventsEnabled', { enabled: true }, this.sessionId)
    await this.conn.send('Page.enable', {}, this.sessionId)
  }

  /**
   * Inject CSS into the page.
   * Uses callFunctionOn with CSS passed as a proper argument (not interpolated)
   * to avoid injection issues with special characters in CSS content.
   */
  async addStyleTag(css: string): Promise<void> {
    // Get a reference to document for callFunctionOn
    const docResult = await this.conn.send<{
      result: { objectId: string }
    }>('Runtime.evaluate', {
      expression: 'document',
      returnByValue: false,
    }, this.sessionId)

    await this.conn.send('Runtime.callFunctionOn', {
      functionDeclaration: '(cssText) => { const style = document.createElement("style"); style.textContent = cssText; document.head.appendChild(style); }',
      objectId: docResult.result.objectId,
      arguments: [{ value: css }],
      returnByValue: true,
    }, this.sessionId)
  }

  /**
   * Inject script that runs on every navigation (including future ones).
   * Uses Page.addScriptToEvaluateOnNewDocument.
   */
  async addScriptOnLoad(source: string): Promise<string> {
    const result = await this.conn.send<{ identifier: string }>(
      'Page.addScriptToEvaluateOnNewDocument', { source }, this.sessionId,
    )
    return result.identifier
  }
}
