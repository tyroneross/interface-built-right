/**
 * Core types for the IBR browser engine.
 * Forked from Spectra — extended for UI validation use cases.
 */

import type { BrowserMode } from './cdp/browser.js'

// ─── Platform ───────────────────────────────────────────────
export type Platform = 'web' | 'macos' | 'ios' | 'watchos'

// ─── Elements ───────────────────────────────────────────────
export interface Element {
  id: string
  role: string
  label: string
  value: string | null
  enabled: boolean
  focused: boolean
  actions: string[]
  bounds: [number, number, number, number]
  parent: string | null
}

// ─── Snapshots ──────────────────────────────────────────────
export interface Snapshot {
  url?: string
  appName?: string
  platform: Platform
  elements: Element[]
  timestamp: number
  metadata?: SnapshotMetadata
}

export interface SnapshotMetadata {
  elementCount: number
  stableAt?: number
  timedOut?: boolean
}

// ─── Actions ────────────────────────────────────────────────
export type ActionType = 'click' | 'type' | 'clear' | 'select' | 'scroll' | 'hover' | 'focus'

export interface Action {
  type: ActionType
  elementId: string
  value?: string
}

export interface ActResult {
  success: boolean
  error?: string
  snapshot: Snapshot
}

// ─── BrowserDriver ──────────────────────────────────────────
/**
 * Common driver interface implemented by both EngineDriver (Chrome/CDP)
 * and SafariDriver (safaridriver/WebDriver + macOS AX API).
 */
export interface BrowserDriver {
  launch(options: {
    headless?: boolean
    viewport?: { width: number; height: number }
    normalize?: boolean
    mode?: BrowserMode
    cdpUrl?: string
    wsEndpoint?: string
    chromePath?: string
  }): Promise<void>

  navigate(url: string, options?: {
    waitFor?: 'stable' | 'load' | 'none'
    timeout?: number
  }): Promise<void>

  screenshot(options?: {
    clip?: { x: number; y: number; width: number; height: number }
  }): Promise<Buffer>

  discover(options?: {
    filter?: 'interactive' | 'leaf' | 'all'
    serialize?: boolean
  }): Promise<any>

  find(name: string, options?: { role?: string }): Promise<any | null>

  click(elementId: string): Promise<void>
  type(elementId: string, text: string): Promise<void>
  fill(elementId: string, value: string): Promise<void>
  hover(elementId: string): Promise<void>
  pressKey(key: string): Promise<void>
  scroll(deltaY: number, x?: number, y?: number): Promise<void>

  evaluate<T>(expression: string): Promise<T>

  close(): Promise<void>

  readonly currentUrl: string
}

// ─── Resolution ─────────────────────────────────────────────
export interface ResolveOptions {
  intent: string
  elements: Element[]
  mode: 'claude' | 'algorithmic'
}

export interface ResolveResult {
  element: Element | null
  confidence: number
  candidates?: Element[]
  visionFallback?: boolean
}
