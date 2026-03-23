/**
 * CDP Accessibility domain — AX tree access, queryAXTree, event subscriptions.
 * Forked from Spectra — extended with queryAXTree-first resolution and events.
 */

import type { CdpConnection } from './connection.js'
import type { Element } from '../types.js'
import { normalizeRole } from '../normalize.js'

export interface CdpAXNode {
  nodeId: string
  role: { value: string }
  name?: { value: string }
  value?: { value: string }
  properties?: Array<{ name: string; value: { value: unknown } }>
  childIds?: string[]
  backendDOMNodeId?: number
}

const SKIP_ROLES = new Set(['WebArea', 'RootWebArea', 'GenericContainer', 'none', 'IgnoredRole'])

export class AccessibilityDomain {
  private nodeMap = new Map<string, number>() // elementId → backendDOMNodeId
  private loadCompleteHandlers = new Set<() => void>()
  private nodesUpdatedHandlers = new Set<(nodes: CdpAXNode[]) => void>()

  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  async enable(): Promise<void> {
    await this.conn.send('Accessibility.enable', {}, this.sessionId)

    // Subscribe to AX tree events
    this.conn.on('Accessibility.loadComplete', () => {
      for (const handler of this.loadCompleteHandlers) handler()
    })
    this.conn.on('Accessibility.nodesUpdated', (params: unknown) => {
      const { nodes } = params as { nodes: CdpAXNode[] }
      for (const handler of this.nodesUpdatedHandlers) handler(nodes)
    })
  }

  async getSnapshot(): Promise<Element[]> {
    const result = await this.conn.send<{ nodes: CdpAXNode[] }>(
      'Accessibility.getFullAXTree',
      {},
      this.sessionId,
    )
    return this.convertToElements(result.nodes)
  }

  /**
   * queryAXTree — CDP-native search by accessible name and/or role.
   * Faster than getFullAXTree + filter for targeted element finding.
   * Computes name and role for all nodes in subtree, including ignored ones.
   */
  async queryAXTree(options: {
    accessibleName?: string
    role?: string
    backendNodeId?: number
  }): Promise<Element[]> {
    const params: Record<string, unknown> = {}
    if (options.accessibleName) params.accessibleName = options.accessibleName
    if (options.role) params.role = options.role
    if (options.backendNodeId) params.backendNodeId = options.backendNodeId

    const result = await this.conn.send<{ nodes: CdpAXNode[] }>(
      'Accessibility.queryAXTree',
      params,
      this.sessionId,
    )
    return this.convertToElements(result.nodes)
  }

  getBackendNodeId(elementId: string): number | undefined {
    return this.nodeMap.get(elementId)
  }

  /** Subscribe to Accessibility.loadComplete events. */
  onLoadComplete(handler: () => void): void {
    this.loadCompleteHandlers.add(handler)
  }

  /** Subscribe to Accessibility.nodesUpdated events. */
  onNodesUpdated(handler: (nodes: CdpAXNode[]) => void): void {
    this.nodesUpdatedHandlers.add(handler)
  }

  offLoadComplete(handler: () => void): void {
    this.loadCompleteHandlers.delete(handler)
  }

  offNodesUpdated(handler: (nodes: CdpAXNode[]) => void): void {
    this.nodesUpdatedHandlers.delete(handler)
  }

  private convertToElements(nodes: CdpAXNode[]): Element[] {
    const elements: Element[] = []
    this.nodeMap.clear()
    let idCounter = 0

    for (const node of nodes) {
      if (SKIP_ROLES.has(node.role.value)) continue

      const role = normalizeRole(node.role.value, 'web')
      const label = node.name?.value ?? ''

      // Skip unlabeled containers
      if (role === 'group' && !label) continue

      const el: Element = {
        id: `e${++idCounter}`,
        role,
        label,
        value: node.value?.value ?? null,
        enabled: this.getProperty(node, 'disabled') !== true,
        focused: this.getProperty(node, 'focused') === true,
        actions: this.inferActions(role),
        bounds: [0, 0, 0, 0],
        parent: null,
      }

      if (node.backendDOMNodeId) {
        this.nodeMap.set(el.id, node.backendDOMNodeId)
      }

      elements.push(el)
    }

    return elements
  }

  private getProperty(node: CdpAXNode, name: string): unknown {
    return node.properties?.find((p) => p.name === name)?.value?.value
  }

  private inferActions(role: string): string[] {
    switch (role) {
      case 'button':
      case 'link':
      case 'checkbox':
      case 'tab':
      case 'switch':
        return ['press']
      case 'textfield':
        return ['setValue']
      case 'slider':
        return ['increment', 'decrement', 'setValue']
      case 'select':
        return ['press', 'showMenu']
      default:
        return []
    }
  }
}
