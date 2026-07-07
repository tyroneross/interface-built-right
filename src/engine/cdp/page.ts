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

/**
 * A node in the frame hierarchy returned by Page.getFrameTree — verified
 * against the official CDP Page domain docs (chromedevtools.github.io/
 * devtools-protocol/tot/Page/#method-getFrameTree): `frame` carries at
 * least {id, parentId?, url}; `childFrames` is present only when the
 * frame has children (recursive).
 */
export interface FrameTreeNode {
  frame: { id: string; parentId?: string; url: string; securityOrigin?: string; mimeType?: string }
  childFrames?: FrameTreeNode[]
}

/**
 * Page.javascriptDialogOpening event payload (E3-D / T-11) — verified
 * against the official CDP Page domain docs: fires when an alert/confirm/
 * prompt/beforeunload dialog is ABOUT TO OPEN. The renderer's JS execution
 * is paused until Page.handleJavaScriptDialog answers it — any in-flight
 * CDP command whose response depends on that JS call completing (e.g. a
 * Runtime.callFunctionOn that synchronously triggered the dialog) will not
 * resolve until then either.
 */
export interface JSDialogInfo {
  message: string
  type: 'alert' | 'confirm' | 'prompt' | 'beforeunload'
  url: string
  frameId?: string
  hasBrowserHandler: boolean
  defaultPrompt?: string
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
   * Frame hierarchy for the current page (E3-D). Used to discover iframes
   * whose accessible content today isn't reachable from the main-frame AX
   * tree (Accessibility.getFullAXTree only walks the ROOT frame by
   * default).
   */
  async getFrameTree(): Promise<FrameTreeNode> {
    const result = await this.conn.send<{ frameTree: FrameTreeNode }>(
      'Page.getFrameTree', {}, this.sessionId,
    )
    return result.frameTree
  }

  /**
   * Subscribe to Page.javascriptDialogOpening (E3-D). Returns an unsubscribe
   * function. Page.enable() (called by enableLifecycleEvents()) must have
   * run first for this event to fire.
   */
  onDialogOpening(handler: (dialog: JSDialogInfo) => void): () => void {
    const listener = (params: unknown) => handler(params as JSDialogInfo)
    this.conn.on('Page.javascriptDialogOpening', listener)
    return () => this.conn.off('Page.javascriptDialogOpening', listener)
  }

  /**
   * Subscribe to Page.javascriptDialogClosed (E3-D) — fires once a dialog
   * has been answered, whether via handleDialog() or the browser's own
   * default handling. Returns an unsubscribe function.
   */
  onDialogClosed(handler: (info: { result: boolean; userInput: string }) => void): () => void {
    const listener = (params: unknown) => handler(params as { result: boolean; userInput: string })
    this.conn.on('Page.javascriptDialogClosed', listener)
    return () => this.conn.off('Page.javascriptDialogClosed', listener)
  }

  /**
   * Answer the currently-open JS dialog (E3-D). `promptText` is only
   * meaningful for `type: 'prompt'` dialogs; omit to accept the default.
   */
  async handleDialog(accept: boolean, promptText?: string): Promise<void> {
    const params: Record<string, unknown> = { accept }
    if (promptText !== undefined) params.promptText = promptText
    await this.conn.send('Page.handleJavaScriptDialog', params, this.sessionId)
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
