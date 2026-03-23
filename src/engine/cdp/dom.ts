/**
 * CDP DOM domain — element queries, box model, HTML extraction.
 * Forked from Spectra — extended with querySelector, querySelectorAll, getOuterHTML.
 */

import type { CdpConnection } from './connection.js'

export class DomDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  async getElementCenter(backendNodeId: number): Promise<{ x: number; y: number }> {
    const result = await this.conn.send<{
      model: { content: number[] }
    }>('DOM.getBoxModel', { backendNodeId }, this.sessionId)

    // content quad: [x1,y1, x2,y2, x3,y3, x4,y4] — four corners
    const q = result.model.content
    const x = Math.round((q[0] + q[2] + q[4] + q[6]) / 4)
    const y = Math.round((q[1] + q[3] + q[5] + q[7]) / 4)
    return { x, y }
  }

  async getBoxModel(backendNodeId: number): Promise<{
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
    }>('DOM.getBoxModel', { backendNodeId }, this.sessionId)
    return result.model
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
