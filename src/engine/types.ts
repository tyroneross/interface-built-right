/**
 * Core types for the IBR browser engine.
 * Forked from Spectra — extended for UI validation use cases.
 */

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
