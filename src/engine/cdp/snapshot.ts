/**
 * CDP DOMSnapshot domain — one-call full DOM + layout + computed style extraction.
 * NEW for IBR — replaces dozens of individual page.evaluate() calls.
 */

import type { CdpConnection } from './connection.js'

export interface DocumentSnapshot {
  documentURL: number       // index into strings array
  title: number             // index into strings array
  baseURL: number           // index into strings array
  contentLanguage: number   // index into strings array
  encodingName: number      // index into strings array
  publicId: number
  systemId: number
  frameId: number
  nodes: NodeTreeSnapshot
  layout: LayoutTreeSnapshot
  textBoxes: TextBoxSnapshot
  scrollOffsetX?: number
  scrollOffsetY?: number
  contentWidth?: number
  contentHeight?: number
}

export interface NodeTreeSnapshot {
  parentIndex?: number[]
  nodeType?: number[]
  shadowRootType?: { index: number; value: number }
  nodeName?: number[]
  nodeValue?: number[]
  backendNodeId?: number[]
  attributes?: Array<number[]>   // pairs: [nameIndex, valueIndex]
  textValue?: { index: number; value: number }
  inputValue?: { index: number; value: number }
  inputChecked?: { index: number }
  optionSelected?: { index: number }
  contentDocumentIndex?: { index: number; value: number }
  pseudoType?: { index: number; value: number }
  pseudoIdentifier?: { index: number; value: number }
  isClickable?: { index: number }
  currentSourceURL?: { index: number; value: number }
  originURL?: { index: number; value: number }
}

export interface LayoutTreeSnapshot {
  nodeIndex: number[]
  styles: Array<number[]>       // indices into computedStyles strings
  bounds: Array<number[]>       // [x, y, width, height] per node
  text: number[]
  stackingContexts: { index: number }
  paintOrders?: number[]
  offsetRects?: Array<number[]>
  scrollRects?: Array<number[]>
  clientRects?: Array<number[]>
  blendedBackgroundColors?: Array<number>
  textColorOpacities?: Array<number>
}

export interface TextBoxSnapshot {
  layoutIndex: number[]
  bounds: Array<number[]>
  start: number[]
  length: number[]
}

export interface CaptureSnapshotResult {
  documents: DocumentSnapshot[]
  strings: string[]
}

export interface CaptureSnapshotOptions {
  /** CSS property names to include in computed styles. */
  computedStyles: string[]
  /** Include paint order info. */
  includePaintOrder?: boolean
  /** Include DOM rects (offsetRects, clientRects, scrollRects). */
  includeDOMRects?: boolean
  /** Include blended background colors. */
  includeBlendedBackgroundColors?: boolean
  /** Include text color opacities. */
  includeTextColorOpacities?: boolean
}

export class SnapshotDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  async enable(): Promise<void> {
    await this.conn.send('DOMSnapshot.enable', {}, this.sessionId)
  }

  /**
   * Capture full DOM snapshot — one call gets everything.
   * Returns flattened arrays with string deduplication.
   */
  async captureSnapshot(options: CaptureSnapshotOptions): Promise<CaptureSnapshotResult> {
    return this.conn.send<CaptureSnapshotResult>(
      'DOMSnapshot.captureSnapshot',
      {
        computedStyles: options.computedStyles,
        includePaintOrder: options.includePaintOrder,
        includeDOMRects: options.includeDOMRects,
        includeBlendedBackgroundColors: options.includeBlendedBackgroundColors,
        includeTextColorOpacities: options.includeTextColorOpacities,
      },
      this.sessionId,
    )
  }

  /**
   * Helper: resolve a string index from the snapshot's strings array.
   */
  resolveString(strings: string[], index: number): string {
    return strings[index] ?? ''
  }

  /**
   * Helper: extract computed style values for a layout node.
   *
   * CDP format: `styles[nodeIndex]` is an array of string indices.
   * Each index maps to the value of the corresponding property in the
   * `computedStyles` parameter you passed to `captureSnapshot`.
   * The property names are known — they're the strings you requested.
   *
   * @param strings The strings array from CaptureSnapshotResult
   * @param styleIndices The style indices for one layout node (from LayoutTreeSnapshot.styles[n])
   * @param requestedProperties The computedStyles array you passed to captureSnapshot
   */
  resolveStyles(
    strings: string[],
    styleIndices: number[],
    requestedProperties: string[],
  ): Record<string, string> {
    const result: Record<string, string> = {}
    for (let i = 0; i < styleIndices.length && i < requestedProperties.length; i++) {
      const name = requestedProperties[i]
      const value = strings[styleIndices[i]]
      if (name) result[name] = value ?? ''
    }
    return result
  }
}
