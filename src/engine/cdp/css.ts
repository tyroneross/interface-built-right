/**
 * CDP CSS domain — computed styles, matched rules.
 * NEW for IBR — direct computed style access without page.evaluate(getComputedStyle).
 */

import type { CdpConnection } from './connection.js'

export interface CSSComputedStyleProperty {
  name: string
  value: string
}

export class CssDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  async enable(): Promise<void> {
    await this.conn.send('CSS.enable', {}, this.sessionId)
  }

  /**
   * Get computed styles for a DOM node.
   * Returns all computed CSS properties as key-value pairs.
   */
  async getComputedStyle(nodeId: number): Promise<Record<string, string>> {
    const result = await this.conn.send<{
      computedStyle: CSSComputedStyleProperty[]
    }>('CSS.getComputedStyleForNode', { nodeId }, this.sessionId)

    const styles: Record<string, string> = {}
    for (const { name, value } of result.computedStyle) {
      styles[name] = value
    }
    return styles
  }

  /**
   * Get computed styles filtered to specific properties.
   * More efficient when you only need a few properties.
   */
  async getComputedStyleFiltered(
    nodeId: number,
    properties: string[],
  ): Promise<Record<string, string>> {
    const all = await this.getComputedStyle(nodeId)
    const filtered: Record<string, string> = {}
    for (const prop of properties) {
      if (prop in all) {
        filtered[prop] = all[prop]
      }
    }
    return filtered
  }

  /**
   * Get matched CSS rules for a node — includes inline, attribute,
   * inherited, pseudo-element, and keyframe styles.
   */
  async getMatchedStyles(nodeId: number): Promise<{
    inlineStyle?: { cssProperties: CSSComputedStyleProperty[] }
    matchedCSSRules: Array<{
      rule: {
        selectorList: { text: string }
        style: { cssProperties: CSSComputedStyleProperty[] }
      }
    }>
  }> {
    return this.conn.send('CSS.getMatchedStylesForNode', { nodeId }, this.sessionId)
  }
}
