/**
 * CDP DOM domain — element queries, box model, HTML extraction.
 * Forked from Spectra — extended with querySelector, querySelectorAll, getOuterHTML.
 */

import type { CdpConnection } from './connection.js'

/**
 * CDP's DOM domain has two separate id spaces for the same node:
 * `nodeId` (only valid while the DOM tree stays "pushed" to the client via
 * DOM.getDocument/querySelector — the ids used throughout this codebase's
 * driver.ts querySelector()/querySelectorAll() path) and `backendNodeId`
 * (stable across tree pushes — the ids AccessibilityDomain hands out).
 * `DOM.getBoxModel` accepts either, but only one AT A TIME, and Chrome does
 * NOT cross-validate — sending a `nodeId` value as `backendNodeId` (or vice
 * versa) either resolves a DIFFERENT, unrelated node or returns
 * `-32000: Could not compute box model` when that numeric id happens not to
 * exist in the other space. Every caller must say which kind it has.
 */
export type NodeRef = { nodeId: number } | { backendNodeId: number }

export class DomDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  /**
   * `sessionId` overrides the domain's default session — needed for E3-D
   * frame support, where a backendNodeId sourced from an out-of-process
   * iframe target must be resolved against THAT target's session, not the
   * main page's.
   */
  async getElementCenter(ref: NodeRef, sessionId?: string): Promise<{ x: number; y: number }> {
    const result = await this.conn.send<{
      model: { content: number[] }
    }>('DOM.getBoxModel', ref, sessionId ?? this.sessionId)

    // content quad: [x1,y1, x2,y2, x3,y3, x4,y4] — four corners
    const q = result.model.content
    const x = Math.round((q[0] + q[2] + q[4] + q[6]) / 4)
    const y = Math.round((q[1] + q[3] + q[5] + q[7]) / 4)
    return { x, y }
  }

  /** See getElementCenter() for the `sessionId` override rationale. */
  async getBoxModel(ref: NodeRef, sessionId?: string): Promise<{
    content: number[]
    padding: number[]
    border: number[]
    margin: number[]
    width: number
    height: number
  }> {
    const result = await this.conn.send<{
      model: {
        content: number[]
        padding: number[]
        border: number[]
        margin: number[]
        width: number
        height: number
      }
    }>('DOM.getBoxModel', ref, sessionId ?? this.sessionId)
    return result.model
  }

  /**
   * Scroll `ref` into the viewport before a caller reads its box model for
   * a clip region — a below-the-fold element's box model is otherwise
   * outside (or clipped by) the current viewport, producing a wrong or
   * empty screenshot clip.
   */
  async scrollIntoViewIfNeeded(ref: NodeRef, sessionId?: string): Promise<void> {
    await this.conn.send('DOM.scrollIntoViewIfNeeded', ref, sessionId ?? this.sessionId)
  }

  async getDocument(): Promise<{ root: { nodeId: number } }> {
    return this.conn.send('DOM.getDocument', {}, this.sessionId)
  }

  /**
   * Find a single element by CSS selector.
   * Returns the nodeId, or null if not found.
   */
  async querySelector(nodeId: number, selector: string): Promise<number | null> {
    try {
      const result = await this.conn.send<{ nodeId: number }>(
        'DOM.querySelector', { nodeId, selector }, this.sessionId,
      )
      return result.nodeId > 0 ? result.nodeId : null
    } catch {
      return null
    }
  }

  /**
   * Find all elements matching a CSS selector.
   * Returns array of nodeIds.
   */
  async querySelectorAll(nodeId: number, selector: string): Promise<number[]> {
    try {
      const result = await this.conn.send<{ nodeIds: number[] }>(
        'DOM.querySelectorAll', { nodeId, selector }, this.sessionId,
      )
      return result.nodeIds.filter((id) => id > 0)
    } catch {
      return []
    }
  }

  /**
   * Get the outer HTML of a node.
   */
  async getOuterHTML(nodeId?: number, backendNodeId?: number): Promise<string> {
    const params: Record<string, unknown> = {}
    if (nodeId !== undefined) params.nodeId = nodeId
    if (backendNodeId !== undefined) params.backendNodeId = backendNodeId

    const result = await this.conn.send<{ outerHTML: string }>(
      'DOM.getOuterHTML', params, this.sessionId,
    )
    return result.outerHTML
  }

  /**
   * Get attributes of a node as key-value pairs.
   */
  async getAttributes(nodeId: number): Promise<Record<string, string>> {
    const result = await this.conn.send<{ attributes: string[] }>(
      'DOM.getAttributes', { nodeId }, this.sessionId,
    )
    const attrs: Record<string, string> = {}
    for (let i = 0; i < result.attributes.length; i += 2) {
      attrs[result.attributes[i]] = result.attributes[i + 1]
    }
    return attrs
  }
}
