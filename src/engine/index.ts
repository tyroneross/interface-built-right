/**
 * IBR Browser Engine — CDP-based browser automation for LLM-driven UI validation.
 * Built from scratch on Chrome DevTools Protocol. Zero Playwright dependency.
 */

// ─── Engine Driver ──────────────────────────────────────────
export { EngineDriver } from './driver.js'
export type {
  LaunchOptions,
  NavigateOptions,
  DiscoverOptions,
  FindOptions,
  CaptureStateOptions,
  CapturedState,
  WaitStrategy,
} from './driver.js'

// ─── Types ──────────────────────────────────────────────────
export type {
  Platform,
  Element,
  Snapshot,
  SnapshotMetadata,
  Action,
  ActionType,
  ActResult,
  ResolveOptions,
  ResolveResult,
} from './types.js'

// ─── CDP Transport ──────────────────────────────────────────
export { CdpConnection } from './cdp/connection.js'
export { BrowserManager, findChrome, CHROME_PATHS } from './cdp/browser.js'
export type { BrowserOptions } from './cdp/browser.js'

// ─── CDP Domains ────────────────────────────────────────────
export { TargetDomain } from './cdp/target.js'
export { PageDomain } from './cdp/page.js'
export type { ScreenshotOptions, LayoutMetrics } from './cdp/page.js'
export { AccessibilityDomain } from './cdp/accessibility.js'
export type { CdpAXNode } from './cdp/accessibility.js'
export { DomDomain } from './cdp/dom.js'
export { InputDomain } from './cdp/input.js'
export { RuntimeDomain } from './cdp/runtime.js'
export { CssDomain } from './cdp/css.js'
export type { CSSComputedStyleProperty } from './cdp/css.js'
export { SnapshotDomain } from './cdp/snapshot.js'
export type {
  CaptureSnapshotOptions,
  CaptureSnapshotResult,
  DocumentSnapshot,
} from './cdp/snapshot.js'
export { EmulationDomain } from './cdp/emulation.js'
export type { ViewportConfig } from './cdp/emulation.js'
export { NetworkDomain } from './cdp/network.js'
export type { Cookie, SetCookieParams } from './cdp/network.js'
export { ConsoleDomain } from './cdp/console.js'
export type { ConsoleMessage, ConsoleLevel } from './cdp/console.js'

// ─── Wait Strategies ────────────────────────────────────────
export {
  buildFingerprint,
  waitForStableTree,
  waitForEvent,
  waitForStable,
} from './cdp/wait.js'
export type { WaitOptions } from './cdp/wait.js'

// ─── Core Utilities ─────────────────────────────────────────
export { normalizeRole } from './normalize.js'
export { serializeSnapshot, serializeElement } from './serialize.js'
export { resolve, jaroWinkler, parseSpatialHints } from './resolve.js'
export type { SpatialHints } from './resolve.js'

// ─── LLM-Native: Observe/Act/Extract ────────────────────────
export { observe } from './observe.js'
export type { ActionDescriptor, ObserveOptions } from './observe.js'

export { extractFromAXTree, extractList, extractPageMeta } from './extract.js'
export type { ExtractSchema, ExtractField, ExtractResult } from './extract.js'

// ─── LLM-Native: Resolution Cache ──────────────────────────
export { ResolutionCache } from './cache.js'
export type { CachedResolution, CacheOptions } from './cache.js'

// ─── LLM-Native: Adaptive Modality ─────────────────────────
export { assessUnderstanding } from './modality.js'
export type { UnderstandingScore, ModalityOptions } from './modality.js'

// ─── Playwright Compatibility ───────────────────────────────
export { CompatPage, CompatElementHandle, CompatLocator } from './compat.js'
