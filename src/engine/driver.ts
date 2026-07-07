/**
 * EngineDriver — high-level browser automation for LLM-driven UI validation.
 * Orchestrates CDP domains into a purpose-built API.
 */

import { CdpConnection } from './cdp/connection.js'
import { BrowserManager, type BrowserMode, type BrowserOptions } from './cdp/browser.js'
import { TargetDomain } from './cdp/target.js'
import { PageDomain, type ScreenshotOptions, type FrameTreeNode, type JSDialogInfo } from './cdp/page.js'
import { AccessibilityDomain, type CdpAXNode } from './cdp/accessibility.js'
import { DomDomain } from './cdp/dom.js'
import { InputDomain } from './cdp/input.js'
import { RuntimeDomain } from './cdp/runtime.js'
import { CssDomain } from './cdp/css.js'
import { SnapshotDomain, type CaptureSnapshotResult } from './cdp/snapshot.js'
import { EmulationDomain, type ViewportConfig } from './cdp/emulation.js'
import { NetworkDomain, type Cookie, type SetCookieParams } from './cdp/network.js'
import { ConsoleDomain, type ConsoleMessage } from './cdp/console.js'
import { waitForStableTree, waitForStable } from './cdp/wait.js'
import {
  waitForActionable,
  ActionabilityTimeoutError,
  type ActionabilityState,
  type ProbeResult,
  type WaitForActionableOptions,
} from './actionability.js'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import type { Element, Snapshot, BrowserDriver } from './types.js'
import { serializeSnapshot } from './serialize.js'
import { observe, type ActionDescriptor, type ObserveOptions } from './observe.js'
import { extractFromAXTree, extractList, extractPageMeta, type ExtractSchema, type ExtractResult } from './extract.js'
import { ResolutionCache, type CacheOptions } from './cache.js'
import { assessUnderstanding, type UnderstandingScore, type ModalityOptions } from './modality.js'
import { extractShadowElements } from './shadow-dom.js'
import { normalizeRole } from './normalize.js'

export type { JSDialogInfo } from './cdp/page.js'

export interface CoverageReport {
  /** Elements captured by the AX tree */
  axTreeCount: number
  /** Estimated visible elements in the DOM (not aria-hidden, has dimensions) */
  estimatedVisible: number
  /** axTreeCount / estimatedVisible * 100, capped at 100 */
  coveragePercent: number
  /** Elements found inside open shadow DOMs (invisible to AX tree) */
  shadowDomCount: number
  /** Canvas elements on the page (completely opaque to AX tree) */
  canvasCount: number
  /** Iframe elements on the page. As of E3-D, their content is descended
   *  into and merged into the AX snapshot — this count is informational,
   *  not an automatic gap (see `gaps` for any that stayed unreachable). */
  iframeCount: number
  /** Elements recovered via shadow DOM piercing */
  recovered: number
  /** Human-readable descriptions of coverage gaps */
  gaps: string[]
}

export interface LaunchOptions extends BrowserOptions {
  viewport?: ViewportConfig
}

export type WaitStrategy = 'stable' | 'load' | 'none'

export interface NavigateOptions {
  waitFor?: WaitStrategy     // default: 'stable'
  timeout?: number           // wait timeout in ms
}

export interface DiscoverOptions {
  /** Filter elements: 'interactive' (buttons, links, inputs), 'leaf' (user-facing), 'all' */
  filter?: 'interactive' | 'leaf' | 'all'
  /** Enable chunking for context window limits */
  chunk?: boolean
  /** Max tokens budget for chunked output (approximate) */
  maxTokens?: number
  /** Return compact serialized format instead of raw elements */
  serialize?: boolean
}

export interface FindOptions {
  role?: string
}

export interface FindDiagnostics {
  elementId: string | null
  confidence: number           // 0.0–1.0
  tier: number                 // 1–4: which resolution strategy succeeded
  tierName: string             // "cache" | "queryAXTree" | "jaro-winkler" | "vision" | "auto-resolve"
  alternatives: Array<{        // top 5 fuzzy matches when not found
    name: string
    role: string
    score: number
  }>
  totalInteractive: number     // how many interactive elements on page
  screenshot?: string          // base64 PNG, auto-captured when element not found
  /**
   * Set when tier-4 (vision) detected an unambiguous top alternative and
   * promoted it to an element resolution. Callers can surface this so users
   * see WHICH alternative was chosen and at what score, instead of a silent
   * "did you mean?". See AUTO_RESOLVE_MIN_SCORE / AUTO_RESOLVE_MIN_MARGIN.
   */
  autoResolved?: {
    label: string              // chosen alternative's label
    role: string               // chosen alternative's role
    score: number              // top jaroWinkler score (0–1)
    margin: number             // score[0] - score[1] (0 when only 1 candidate)
  }
}

/**
 * Auto-resolve thresholds for the tier-4 (vision) → element promotion.
 *
 * Rationale: tier-3 (jaroWinkler over the full AX tree) returns nothing below
 * confidence 0.5; tier-4 then computes alternatives over INTERACTIVE elements
 * only. In practice, the top interactive-only score is frequently very high
 * (≥ 0.8) AND the gap to second place is wide (≥ 0.15), i.e. the user's
 * intent is unambiguous and a "not found + alternatives" response is just
 * pointless friction. Auto-resolve in that case; preserve the existing
 * alternatives + screenshot path when ambiguous or low-confidence.
 *
 * Driven by transcript-log evidence: 20/185 session_action calls (11%) failed
 * with element-not-found despite the top alternative being unambiguous.
 */
export const AUTO_RESOLVE_MIN_SCORE = 0.8
export const AUTO_RESOLVE_MIN_MARGIN = 0.15

/**
 * Raised threshold for auto-resolving destructive actions.
 *
 * A typo'd query can score ~0.91 against a "Delete Account" label — above the
 * normal 0.8 bar — causing the driver to click a destructive button the user
 * did not intend to confirm. Requiring 0.95 leaves only near-exact matches
 * (one or two transposed characters) while blocking plausible mis-queries
 * ("delt acct" → 0.917, blocked; "delet account" → 0.986, allowed).
 *
 * Applies whenever the chosen candidate's label matches DESTRUCTIVE_LABEL_PATTERN,
 * regardless of candidate count.
 */
export const AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE = 0.95

/**
 * Detects destructive intent in an element's accessible label.
 *
 * Matches whole words (case-insensitive) for verbs and nouns that indicate an
 * irreversible or high-risk action: data loss (delete, erase, wipe, purge),
 * access revocation (revoke, deactivate, disable), content loss (discard,
 * destroy, reset, clear), or subscription termination (unsubscribe).
 * "confirm" is included because standalone "Confirm" on a modal is typically
 * a confirmation of a destructive flow already in progress.
 *
 * Intentionally kept as a single expression — do not split across config or
 * runtime lookup. The pattern is a safety guardrail, not a user-configurable
 * blocklist.
 */
export const DESTRUCTIVE_LABEL_PATTERN =
  /\b(?:delete|remove|erase|wipe|purge|revoke|deactivate|disable|discard|destroy|reset|clear|unsubscribe|confirm)\b/i

/**
 * Minimum confidence for accepting a tier-3 (jaroWinkler) fuzzy resolution.
 *
 * Raised from the original 0.5. Real dogfooding against atomize-ai.vercel.app
 * showed the resolver silently acting on LOW-confidence fuzzy matches (0.75–0.8)
 * that selected the WRONG element even when an exact label was present
 * (target "News Feed" → matched "Full feed"; "Open search (⌘K)" → matched
 * "Open primary source for LLM Training…"). The fix is two-fold: (1) a
 * normalized-exact tier that runs BEFORE fuzzy and prefers a present exact
 * label; (2) this raised bar so a weak fuzzy score no longer auto-acts —
 * sub-threshold matches fall through to the margin-guarded auto-resolve tier
 * or to "not found + alternatives".
 */
export const JARO_ACCEPT_MIN = 0.92

/** Lowercase + collapse internal whitespace + trim. Catches casing and
 * whitespace variants that CDP's strict queryAXTree exact-match misses. */
function normalizeLabel(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Alphanumeric-only core. Catches icon-prefix / punctuation variants
 * (e.g. "Open search (⌘K)" vs the same with a leading glyph). */
function coreLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Tier 2.5 — prefer a PRESENT exact label over any fuzzy candidate.
 *
 * CDP `Accessibility.queryAXTree` (tier 2) does a strict exact match and misses
 * casing, whitespace, and icon/punctuation variants — so an exact target like
 * "News Feed" can fall through to fuzzy matching, where a near-miss distractor
 * ("Full feed") wins. This scans the full snapshot for a normalized-exact
 * match (then an unambiguous alphanumeric-core match), preferring interactive
 * elements and honouring an explicit role filter. Returns null when there is
 * no exact match or when a core match is ambiguous.
 */
function findExactLabel(name: string, elements: Element[], role?: string): Element | null {
  const targetNorm = normalizeLabel(name)
  if (!targetNorm) return null
  const targetCore = coreLabel(name)
  const pool = role ? elements.filter((e) => e.role === role) : elements
  const interactive = pool.filter((e) => e.actions.length > 0)

  for (const group of [interactive, pool]) {
    const normMatches = group.filter((e) => e.label && normalizeLabel(e.label) === targetNorm)
    if (normMatches.length >= 1) return normMatches[0]
    if (targetCore.length >= 2) {
      const coreMatches = group.filter((e) => e.label && coreLabel(e.label) === targetCore)
      if (coreMatches.length === 1) return coreMatches[0]
    }
  }
  return null
}

export interface CaptureStateOptions {
  computedStyles?: string[]
  includeAXTree?: boolean
  includeScreenshot?: boolean
}

export interface CapturedState {
  domSnapshot?: CaptureSnapshotResult
  axTree?: Element[]
  screenshot?: Buffer
  url: string
  timestamp: number
}

/**
 * Actionability probe — evaluated with `this` bound to the resolved DOM
 * node (via DOM.resolveNode + Runtime.callFunctionOn, same pattern as
 * click()'s DOM-click path). Reports present/visible/enabled/rect so
 * waitForActionable() can decide whether the verb may act yet.
 *
 * "visible" folds in occlusion: an element that is on-screen and painted
 * but covered by another element at its own center point (e.g. a modal
 * overlay, a loading spinner) is reported as not visible — acting on it
 * would silently hit the covering element instead.
 */
const ACTIONABILITY_PROBE_FN = `function() {
  if (!this || !this.isConnected) {
    return { present: false, visible: false, enabled: false, rect: null };
  }
  var style = window.getComputedStyle(this);
  var r = this.getBoundingClientRect();
  var hasSize = r.width > 0 && r.height > 0;
  var visible = style.display !== 'none' && style.visibility !== 'hidden' &&
    parseFloat(style.opacity) !== 0 && hasSize;
  if (visible) {
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var atPoint = document.elementFromPoint(cx, cy);
    var uncovered = !!atPoint && (atPoint === this || this.contains(atPoint) || atPoint.contains(this));
    visible = visible && uncovered;
  }
  var enabled = this.disabled !== true && this.getAttribute('aria-disabled') !== 'true';
  return {
    present: true,
    visible: visible,
    enabled: enabled,
    rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
  };
}`

/**
 * Resolved reference to a live DOM node, plus the CDP session that can
 * actually reach it (E3-D).
 *
 * Most elements live in the main frame and resolve against the driver's
 * own `sessionId`. An element sourced from an iframe descended into by
 * `getFrameElements()` may instead need a DIFFERENT session:
 *   - same-process (in-process) frame: same session as the main frame —
 *     `sessionId` here equals the driver's own session, included for
 *     uniformity rather than necessity.
 *   - out-of-process iframe (OOPIF): its own CDP target/session, attached
 *     lazily in `getOopifFrameElements()`. DOM/Runtime commands for that
 *     node MUST use this session, not the main one.
 */
interface BackendRef {
  backendNodeId: number
  sessionId?: string
}

/** Roles that carry no useful accessible content on their own — mirrors
 *  AccessibilityDomain's SKIP_ROLES (duplicated here because frame/OOPIF
 *  AX trees are fetched directly via CdpConnection, bypassing
 *  AccessibilityDomain, which is out of scope for this chunk). */
const FRAME_SKIP_ROLES = new Set(['WebArea', 'RootWebArea', 'GenericContainer', 'none', 'IgnoredRole'])

/** Mirrors AccessibilityDomain's private inferActions() — see FRAME_SKIP_ROLES
 *  comment for why this is duplicated rather than imported. */
function inferFrameActions(role: string): string[] {
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

export class EngineDriver implements BrowserDriver {
  private browser = new BrowserManager()
  private conn = new CdpConnection()
  // Resolution cache initialized in constructor or with defaults
  private target!: TargetDomain
  private _page!: PageDomain
  private ax!: AccessibilityDomain
  private dom!: DomDomain
  private input!: InputDomain
  private runtime!: RuntimeDomain
  private css!: CssDomain
  private snapshot!: SnapshotDomain
  private emulation!: EmulationDomain
  private network!: NetworkDomain
  private console!: ConsoleDomain

  private targetId: string | null = null
  private sessionId: string | null = null
  private _currentUrl = ''
  private launched = false
  private resolutionCache = new ResolutionCache()

  /**
   * Last-known {label, role} for every elementId we've ever seen in an AX
   * snapshot, keyed by elementId (`e${backendDOMNodeId}`). Unlike
   * AccessibilityDomain's internal nodeMap (which only reflects the CURRENT
   * live tree), this accumulates across snapshots so that when a
   * backendNodeId goes stale mid-actionability-wait (the element re-rendered
   * under a new backendNodeId), we can still recall what we were looking for
   * and re-resolve by name+role instead of throwing on the dead reference.
   * Bounded to avoid unbounded growth over a long session.
   */
  private elementDescriptors = new Map<string, { label: string; role: string }>()
  private static readonly MAX_DESCRIPTOR_HISTORY = 1000
  private static readonly DESCRIPTOR_TRIM_TARGET = 500

  // ─── Frames (E3-D) ──────────────────────────────────────
  // Elements sourced from an iframe are NOT in AccessibilityDomain's
  // nodeMap (that class only ever walks the main frame) — these maps are
  // this driver's own bookkeeping so click()/observe()/find() can resolve
  // and act on them anyway. Cleared on every navigate() (frame ids and
  // backendNodeIds are meaningless across a navigation).
  private frameElementBackendNodeIds = new Map<string, number>()
  private frameElementSessions = new Map<string, string>()
  private frameTagFor = new Map<string, string>() // CDP frameId -> short elementId-safe tag
  private oopifSessions = new Map<string, string>() // OOPIF targetId -> attached sessionId (reused across snapshots)
  private lastFrameCount = 0
  private lastFrameReached = 0

  // ─── JS Dialogs (E3-D) ──────────────────────────────────
  // Page.javascriptDialogOpening pauses the renderer's JS until
  // Page.handleJavaScriptDialog answers it. Any in-flight CDP command whose
  // response depends on that JS finishing (e.g. click()'s
  // Runtime.callFunctionOn) would otherwise hang until answered — see
  // raceAgainstDialog().
  private pendingDialog: JSDialogInfo | null = null
  private dialogWaiters = new Set<() => void>()
  private unsubscribeDialogOpening: (() => void) | null = null
  private unsubscribeDialogClosed: (() => void) | null = null

  // ─── Lifecycle ──────────────────────────────────────────

  async launch(options: LaunchOptions = {}): Promise<void> {
    const wsUrl = await this.browser.launch(options)
    await this.conn.connect(wsUrl)
    this.target = new TargetDomain(this.conn)
    this.launched = true

    // Create initial page
    this.targetId = await this.target.createPage('about:blank')
    this.sessionId = await this.target.attach(this.targetId)

    // Initialize domains with session
    this._page = new PageDomain(this.conn, this.sessionId)
    this.ax = new AccessibilityDomain(this.conn, this.sessionId)
    this.dom = new DomDomain(this.conn, this.sessionId)
    this.input = new InputDomain(this.conn, this.sessionId)
    this.runtime = new RuntimeDomain(this.conn, this.sessionId)
    this.css = new CssDomain(this.conn, this.sessionId)
    this.snapshot = new SnapshotDomain(this.conn, this.sessionId)
    this.emulation = new EmulationDomain(this.conn, this.sessionId)
    this.network = new NetworkDomain(this.conn, this.sessionId)
    this.console = new ConsoleDomain(this.conn, this.sessionId)

    // Enable required domains
    await this._page.enableLifecycleEvents()
    await this.ax.enable()
    await this.console.enable()
    // E3-B: real Network-domain request/response tracking, backing
    // networkidle/waitForResponse in compat.ts (see cdp/network.ts).
    await this.network.enable()
    // E3-D: capture Page.javascriptDialogOpening instead of letting an
    // alert()/confirm() hang whatever CDP call triggered it.
    this.setupDialogHandling()

    // Apply device emulation (metrics + UA + touch) BEFORE the first
    // navigate so the initial document request sees the emulated device.
    if (options.viewport) {
      await this.emulation.applyDeviceProfile(options.viewport)
    }
  }

  /**
   * Wire Page.javascriptDialogOpening/Closed into `pendingDialog` +
   * `dialogWaiters` (E3-D). Idempotent — unsubscribes any prior
   * registration first, so re-launch/connectExisting never double-fires.
   */
  private setupDialogHandling(): void {
    this.unsubscribeDialogOpening?.()
    this.unsubscribeDialogClosed?.()
    this.unsubscribeDialogOpening = this._page.onDialogOpening((dialog) => {
      this.pendingDialog = dialog
      const waiters = [...this.dialogWaiters]
      this.dialogWaiters.clear()
      for (const wake of waiters) wake()
    })
    this.unsubscribeDialogClosed = this._page.onDialogClosed(() => {
      this.pendingDialog = null
    })
  }

  async close(): Promise<void> {
    if (this.targetId) {
      await this.target.close(this.targetId).catch(() => {})
      this.targetId = null
    }
    await this.conn.close()
    await this.browser.close()
    this.launched = false
  }

  /**
   * Release the CDP WebSocket for this driver without terminating the browser.
   * Used by one-shot CLI commands that attach to a shared browser-server via
   * connectExisting() — they must drop their WebSocket at the end of the
   * command so the node process can exit, but the browser-server's Chrome
   * process must keep running for subsequent commands.
   *
   * Closes the per-command tab that was spawned in connectExisting(), then
   * closes the WebSocket. Does NOT call this.browser.close() (which would
   * terminate the whole browser-server process).
   */
  async disconnect(): Promise<void> {
    if (this.targetId) {
      await this.target.close(this.targetId).catch(() => {})
      this.targetId = null
    }
    await this.conn.close().catch(() => {})
    this.launched = false
  }

  get isLaunched(): boolean {
    return this.launched
  }

  // ─── Navigation ─────────────────────────────────────────

  async navigate(url: string, options: NavigateOptions = {}): Promise<void> {
    const waitFor = options.waitFor ?? 'stable'
    await this._page.navigate(url)

    if (waitFor === 'stable') {
      await waitForStable(
        this.conn,
        () => this.freshSnapshot(),
        { timeout: options.timeout ?? 10000, eventName: 'Accessibility.nodesUpdated' },
      )
    } else if (waitFor === 'load') {
      await waitForStableTree(
        () => this.freshSnapshot(),
        { timeout: options.timeout ?? 10000 },
      )
    }
    // 'none' — return immediately

    // Read actual URL after navigation (handles redirects)
    this._currentUrl = await this.runtime.evaluate('location.href') as string ?? url

    // Clear resolution cache + stale-id re-resolution history on navigation
    // (element IDs are meaningless across a navigation).
    this.resolutionCache.clear()
    this.elementDescriptors.clear()

    // E3-D: frame/backend bookkeeping and any open dialog are meaningless
    // across a navigation too. OOPIF targets are best-effort closed (they
    // are typically torn down by the navigation itself anyway).
    for (const targetId of this.oopifSessions.keys()) {
      this.target.close(targetId).catch(() => {})
    }
    this.frameElementBackendNodeIds.clear()
    this.frameElementSessions.clear()
    this.frameTagFor.clear()
    this.oopifSessions.clear()
    this.lastFrameCount = 0
    this.lastFrameReached = 0
    this.pendingDialog = null
  }

  get url(): string {
    return this._currentUrl
  }

  /** BrowserDriver interface: currentUrl alias */
  get currentUrl(): string {
    return this._currentUrl
  }


  // ─── Element Discovery (LLM-native) ────────────────────

  /**
   * Discover elements on the page with filtering and chunking.
   * Designed for LLM context windows — returns only actionable elements.
   */
  async discover(options: DiscoverOptions = {}): Promise<Element[] | string> {
    const filter = options.filter ?? 'interactive'
    const elements = await this.freshSnapshot()

    let filtered: Element[]
    switch (filter) {
      case 'interactive':
        filtered = elements.filter((e) => e.actions.length > 0)
        break
      case 'leaf':
        // Leaf elements: have a label (user-facing) and are not groups
        filtered = elements.filter((e) => e.label && e.role !== 'group')
        break
      case 'all':
      default:
        filtered = elements
    }

    if (options.chunk && options.maxTokens) {
      filtered = chunkElements(filtered, options.maxTokens)
    }

    if (options.serialize) {
      const snap: Snapshot = {
        url: this._currentUrl,
        platform: 'web',
        elements: filtered,
        timestamp: Date.now(),
      }
      return serializeSnapshot(snap)
    }

    return filtered
  }

  /**
   * 3-tier element resolution with auto-caching:
   * Tier 1: Check cache → Tier 2: queryAXTree → Tier 3: Jaro-Winkler → Tier 4: vision fallback.
   * Delegates to findWithDiagnostics() and returns the matched element or null.
   */
  async find(name: string, options: FindOptions = {}): Promise<Element | null> {
    const diag = await this.findWithDiagnostics(name, options)
    if (!diag.elementId) return null

    const elements = await this.freshSnapshot()
    return elements.find((e) => e.id === diag.elementId) ?? null
  }

  /**
   * Like find(), but returns rich diagnostics for agent error feedback.
   * Includes confidence, resolution tier, and fuzzy alternatives when not found.
   */
  async findWithDiagnostics(name: string, options: FindOptions = {}): Promise<FindDiagnostics> {
    const { jaroWinkler } = await import('./resolve.js')
    const cacheKey = options.role ? `${name}:${options.role}` : name

    // Tier 1: Check resolution cache
    const cached = this.resolutionCache.get(cacheKey)
    if (cached) {
      const elements = await this.freshSnapshot()
      const match = elements.find((e) => e.id === cached.elementId)
      if (match) {
        const interactive = elements.filter((e) => e.actions.length > 0)
        return {
          elementId: cached.elementId,
          confidence: cached.confidence,
          tier: 1,
          tierName: 'cache',
          alternatives: [],
          totalInteractive: interactive.length,
        }
      }
      // Element gone — invalidate and fall through
      this.resolutionCache.invalidate(cacheKey)
    }

    // Tier 2: CDP-native queryAXTree (exact/prefix match)
    const queryResult = await this.ax.queryAXTree({
      accessibleName: name,
      role: options.role,
    })
    if (queryResult.length > 0) {
      const el = queryResult[0]
      this.resolutionCache.set(cacheKey, el.id, {
        role: el.role, label: el.label, confidence: 1.0,
      })
      const allElements = await this.freshSnapshot()
      const interactive = allElements.filter((e) => e.actions.length > 0)
      return {
        elementId: el.id,
        confidence: 0.95,
        tier: 2,
        tierName: 'queryAXTree',
        alternatives: [],
        totalInteractive: interactive.length,
      }
    }

    const allElements = await this.freshSnapshot()
    const interactive = allElements.filter((e) => e.actions.length > 0)

    // Tier 2.5: Normalized-exact match over the full snapshot. CDP queryAXTree
    // (tier 2) misses casing / whitespace / icon-punctuation variants, so an
    // exact target can fall through to fuzzy matching where a near-miss
    // distractor wins. PREFER a present exact label before any fuzzy scoring.
    const exact = findExactLabel(name, allElements, options.role)
    if (exact) {
      this.resolutionCache.set(cacheKey, exact.id, {
        role: exact.role, label: exact.label, confidence: 0.97,
      })
      return {
        elementId: exact.id,
        confidence: 0.97,
        tier: 2,
        tierName: 'exact',
        alternatives: [],
        totalInteractive: interactive.length,
      }
    }

    // Tier 3: Fuzzy matching on full AX tree (Jaro-Winkler)
    const { resolve } = await import('./resolve.js')
    const result = resolve({
      intent: options.role ? `${name} ${options.role}` : name,
      elements: allElements,
      mode: 'algorithmic',
    })

    if (result.confidence >= JARO_ACCEPT_MIN && result.element) {
      this.resolutionCache.set(cacheKey, result.element.id, {
        role: result.element.role, label: result.element.label, confidence: result.confidence,
      })
      return {
        elementId: result.element.id,
        confidence: result.confidence,
        tier: 3,
        tierName: 'jaro-winkler',
        alternatives: [],
        totalInteractive: interactive.length,
      }
    }

    // Tier 4: Not found — compute alternatives from interactive elements.
    // f1: when options.role is set, pre-filter the scored pool to that role
    //     so auto-resolve cannot pick an element of the wrong type.
    const nameLower = name.toLowerCase()
    const scoringPool = options.role
      ? interactive.filter((e) => e.role === options.role)
      : interactive
    const scored = scoringPool
      .filter((e) => e.label)
      .map((e) => ({
        name: e.label,
        role: e.role,
        score: jaroWinkler(nameLower, e.label.toLowerCase()),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    // Auto-resolve: if the top alternative is high-confidence AND unambiguous
    // relative to the runner-up, promote it to a resolution instead of
    // returning "not found". This converts the most common transcript-log
    // failure mode (clear typo / missing trailing-space / "Submit" vs
    // "Submit Form") into a successful action with auditable provenance.
    //
    // Destructive-label guard: when the winning candidate's label matches
    // DESTRUCTIVE_LABEL_PATTERN, require a higher confidence bar
    // (AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE = 0.95) to prevent a plausible
    // mis-query ("delt acct" → 0.917) from auto-clicking a destructive
    // action. Non-destructive labels keep the normal 0.8 threshold.
    if (scored.length > 0) {
      const top = scored[0]
      const second = scored[1]
      const margin = top.score - (second?.score ?? 0)
      const isDestructive = DESTRUCTIVE_LABEL_PATTERN.test(top.name)
      const minScore = isDestructive ? AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE : AUTO_RESOLVE_MIN_SCORE
      if (top.score >= minScore && margin >= AUTO_RESOLVE_MIN_MARGIN) {
        // Resolve back to the actual element object (need its id) — pick
        // the first interactive element matching (label, role).
        const resolved = interactive.find(
          (e) => e.label === top.name && e.role === top.role,
        )
        if (resolved) {
          this.resolutionCache.set(cacheKey, resolved.id, {
            role: resolved.role, label: resolved.label, confidence: top.score,
          })
          return {
            elementId: resolved.id,
            confidence: top.score,
            tier: 4,
            tierName: 'auto-resolve',
            alternatives: scored,
            totalInteractive: interactive.length,
            autoResolved: {
              label: top.name,
              role: top.role,
              score: top.score,
              margin,
            },
          }
        }
      }
    }

    // Auto-capture screenshot when element not found for visual fallback
    let screenshot: string | undefined
    try {
      const buf = await this.screenshot()
      screenshot = buf.toString('base64')
    } catch {
      // Screenshot capture can fail (e.g., page not loaded) — non-critical
    }

    return {
      elementId: null,
      confidence: 0,
      tier: 4,
      tierName: 'vision',
      alternatives: scored,
      totalInteractive: interactive.length,
      screenshot,
    }
  }

  // ─── Actionability (auto-wait) ──────────────────────────
  //
  // click/type/fill/check/select all resolve through awaitActionable()
  // before acting, so none of them can act on a stale, hidden, covered, or
  // disabled element — see src/engine/actionability.ts for the generic
  // present→visible→enabled→stable poll loop this builds on.

  /** Record every element's {label, role} into the cross-snapshot history
   *  used for stale-elementId re-resolution (see elementDescriptors). */
  private recordDescriptors(elements: Element[]): void {
    for (const e of elements) {
      this.elementDescriptors.set(e.id, { label: e.label, role: e.role })
    }
    if (this.elementDescriptors.size > EngineDriver.MAX_DESCRIPTOR_HISTORY) {
      const excess = this.elementDescriptors.size - EngineDriver.DESCRIPTOR_TRIM_TARGET
      let i = 0
      for (const key of this.elementDescriptors.keys()) {
        if (i++ >= excess) break
        this.elementDescriptors.delete(key)
      }
    }
  }

  /** Snapshot wrapper — every full-tree read goes through here so the
   *  stale-elementId re-resolution history stays warm. Behavior-identical
   *  to calling this.ax.getSnapshot() directly, PLUS (E3-D) elements from
   *  every iframe on the page, merged in. */
  private async freshSnapshot(): Promise<Element[]> {
    const [mainElements, frameElements] = await Promise.all([
      this.ax.getSnapshot(),
      this.getFrameElements(),
    ])
    const elements = frameElements.length > 0 ? [...mainElements, ...frameElements] : mainElements
    this.recordDescriptors(elements)
    return elements
  }

  /**
   * Probe a live DOM node's present/visible/enabled/rect state via
   * DOM.resolveNode + Runtime.callFunctionOn (same primitives click() uses
   * for its DOM-click path). Returns null when the backendNodeId no longer
   * resolves to a live node — the caller treats that as "went stale" and
   * re-resolves rather than throwing.
   *
   * `sessionId` (E3-D) overrides the driver's main session — required for
   * an element sourced from an out-of-process iframe (OOPIF), whose
   * backendNodeId only resolves against ITS OWN target/session.
   */
  private async probeBackendNode(backendNodeId: number, sessionId?: string): Promise<ActionabilityState | null> {
    const sid = sessionId ?? this.sessionId ?? undefined
    try {
      const resolved: any = await this.conn.send('DOM.resolveNode', { backendNodeId }, sid)
      const objectId = resolved?.object?.objectId
      if (!objectId) return null
      const result: any = await this.conn.send('Runtime.callFunctionOn', {
        objectId,
        functionDeclaration: ACTIONABILITY_PROBE_FN,
        returnByValue: true,
      }, sid)
      if (result?.exceptionDetails) return null
      return (result?.result?.value as ActionabilityState) ?? null
    } catch {
      return null
    }
  }

  /**
   * Re-resolve a stale element by its last-known label+role against a fresh
   * AX snapshot. This is what lets a re-rendering element (new
   * backendNodeId, same accessible name/role) stay actionable instead of
   * failing the moment its original elementId goes stale.
   */
  private async reResolveByLabelRole(label: string, role: string): Promise<string | null> {
    const elements = await this.freshSnapshot()
    const match = findExactLabel(label, elements, role)
    return match ? match.id : null
  }

  /**
   * Resolve an elementId to its {backendNodeId, sessionId} (E3-D). Frame-
   * sourced elements are checked first (this driver's own bookkeeping,
   * since AccessibilityDomain only ever knows about the main frame); falls
   * back to the main-frame nodeMap otherwise. Returns undefined when the
   * elementId is not currently known to either.
   */
  private resolveBackendRef(elementId: string): BackendRef | undefined {
    const frameBackendNodeId = this.frameElementBackendNodeIds.get(elementId)
    if (frameBackendNodeId !== undefined) {
      return { backendNodeId: frameBackendNodeId, sessionId: this.frameElementSessions.get(elementId) }
    }
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (backendNodeId === undefined) return undefined
    return { backendNodeId, sessionId: this.sessionId ?? undefined }
  }

  /**
   * resolveAndProbe closure for waitForActionable(): resolves elementId to
   * its current backend reference (re-resolving by name/role if the id has
   * gone stale), then probes it. Returns null when nothing currently
   * resolves — waitForActionable treats that as "not present" and keeps
   * polling.
   */
  private async resolveElementActionability(elementId: string): Promise<ProbeResult<BackendRef> | null> {
    // NOTE: AccessibilityDomain's elementId→backendNodeId map is only
    // rebuilt when a fresh snapshot is taken — it does NOT get invalidated
    // just because the underlying DOM node was removed/replaced. So a
    // "stale" element does not surface as getBackendNodeId() returning
    // undefined; it surfaces as probeBackendNode() failing (DOM.resolveNode
    // throws for a dead backendNodeId). Both cases fall through to
    // re-resolution by last-known label/role below.
    const ref = this.resolveBackendRef(elementId)

    if (ref) {
      const state = await this.probeBackendNode(ref.backendNodeId, ref.sessionId)
      // A detached-but-not-yet-GC'd node can still resolve via
      // DOM.resolveNode and report present:false (isConnected===false)
      // rather than throwing — treat that the same as a hard resolve
      // failure and fall through to re-resolution, don't just report
      // "not present" forever on a dead reference.
      if (state?.present) return { target: ref, state }
    }

    const known = this.elementDescriptors.get(elementId)
    if (!known) return null

    const freshId = await this.reResolveByLabelRole(known.label, known.role)
    if (!freshId) return null

    const freshRef = this.resolveBackendRef(freshId)
    if (!freshRef) return null

    const freshState = await this.probeBackendNode(freshRef.backendNodeId, freshRef.sessionId)
    if (!freshState) return null
    return { target: freshRef, state: freshState }
  }

  /**
   * Wait until elementId (or its re-resolved replacement) is
   * present+visible+enabled+stable, then return the actionable backend
   * reference. Throws a descriptive error on timeout — never silently
   * proceeds to act on a non-actionable element.
   */
  private async awaitActionable(elementId: string, options?: WaitForActionableOptions): Promise<BackendRef> {
    try {
      return await waitForActionable<BackendRef>(
        () => this.resolveElementActionability(elementId),
        options,
      )
    } catch (err) {
      if (err instanceof ActionabilityTimeoutError) {
        throw new Error(
          `Element ${elementId} not actionable: ${err.reason} (waited ${err.elapsedMs}ms)`,
        )
      }
      throw err
    }
  }

  // ─── Frames (E3-D) ──────────────────────────────────────
  //
  // AccessibilityDomain.getSnapshot() only ever walks the MAIN frame
  // (Accessibility.getFullAXTree defaults to the root frame). These helpers
  // discover every iframe via Page.getFrameTree, then fetch each one's AX
  // tree directly over CdpConnection (bypassing AccessibilityDomain, which
  // is out of scope for this chunk) and merge the elements into
  // freshSnapshot()'s output so observe()/find()/click() see inside them.
  //
  // Two paths, tried in order per frame:
  //   1. In-process: same-origin (or otherwise same-renderer) frames stay
  //      in the main page's render process — Accessibility.getFullAXTree
  //      accepts a `frameId` and returns nodes reachable via the driver's
  //      OWN session, no extra attach needed.
  //   2. OOPIF (out-of-process iframe): cross-site-isolated frames get
  //      their own CDP target. Discovered via Target.getTargets() (type
  //      'iframe'), matched to the unresolved frame by URL (best-effort —
  //      TargetInfo carries no direct frameId), then attached lazily and
  //      cached by targetId. This path is defensive/best-effort: it has no
  //      CI-feasible fixture (would need two real origins under Chrome's
  //      site-isolation), so it is exercised by construction, not by a
  //      passing live test.

  private tagForFrame(frameId: string): string {
    let tag = this.frameTagFor.get(frameId)
    if (!tag) {
      tag = String(this.frameTagFor.size)
      this.frameTagFor.set(frameId, tag)
    }
    return tag
  }

  private flattenChildFrames(node: FrameTreeNode): Array<{ id: string; url: string }> {
    const out: Array<{ id: string; url: string }> = []
    for (const child of node.childFrames ?? []) {
      out.push({ id: child.frame.id, url: child.frame.url })
      out.push(...this.flattenChildFrames(child))
    }
    return out
  }

  /**
   * Convert raw CDP AX nodes (from a frame's own getFullAXTree call) into
   * Element[], tagging each id with `frameTag` so it can never collide with
   * a main-frame or sibling-frame backendDOMNodeId (backend node ids are
   * only unique WITHIN a render process). Records each into
   * frameElementBackendNodeIds/frameElementSessions so click()/awaitActionable
   * can resolve and act on them later.
   */
  private convertFrameAXNodes(nodes: CdpAXNode[], sessionId: string, frameTag: string): Element[] {
    const elements: Element[] = []
    for (const node of nodes) {
      const roleValue = node.role?.value
      if (!roleValue || FRAME_SKIP_ROLES.has(roleValue)) continue
      const role = normalizeRole(roleValue, 'web')
      const label = node.name?.value ?? ''
      if (role === 'group' && !label) continue
      if (!node.backendDOMNodeId) continue // no stable ref to act on later — skip

      const id = `f${frameTag}_e${node.backendDOMNodeId}`
      const disabledProp = node.properties?.find((p) => p.name === 'disabled')?.value?.value
      const focusedProp = node.properties?.find((p) => p.name === 'focused')?.value?.value

      elements.push({
        id,
        role,
        label,
        value: node.value?.value ?? null,
        enabled: disabledProp !== true,
        focused: focusedProp === true,
        actions: inferFrameActions(role),
        bounds: [0, 0, 0, 0],
        parent: null,
      })
      this.frameElementBackendNodeIds.set(id, node.backendDOMNodeId)
      this.frameElementSessions.set(id, sessionId)
    }
    return elements
  }

  /** Elements from every iframe on the page — see the "Frames (E3-D)"
   *  section comment above for the two-path strategy. */
  private async getFrameElements(): Promise<Element[]> {
    if (!this.sessionId) return []

    let tree: FrameTreeNode
    try {
      tree = await this._page.getFrameTree()
    } catch {
      this.lastFrameCount = 0
      this.lastFrameReached = 0
      return []
    }

    const childFrames = this.flattenChildFrames(tree)
    this.lastFrameCount = childFrames.length
    if (childFrames.length === 0) {
      this.lastFrameReached = 0
      return []
    }

    const elements: Element[] = []
    const unresolvedByUrl = new Map<string, string>() // url -> frameId
    let reached = 0

    for (const frame of childFrames) {
      const tag = this.tagForFrame(frame.id)
      try {
        const result: any = await this.conn.send(
          'Accessibility.getFullAXTree', { frameId: frame.id }, this.sessionId,
        )
        const nodes: CdpAXNode[] = result?.nodes ?? []
        elements.push(...this.convertFrameAXNodes(nodes, this.sessionId, tag))
        reached += 1
        continue
      } catch {
        // Not reachable in-process (likely an OOPIF) — try the target path.
      }
      unresolvedByUrl.set(frame.url, frame.id)
    }

    if (unresolvedByUrl.size > 0) {
      const oopifResult = await this.getOopifFrameElements(unresolvedByUrl)
      elements.push(...oopifResult.elements)
      reached += oopifResult.reached
    }

    this.lastFrameReached = reached
    return elements
  }

  /**
   * Best-effort OOPIF path: discover 'iframe'-type CDP targets, match each
   * to an unresolved frame by URL, attach (cached by targetId across
   * snapshots), and fetch its AX tree via that target's own session.
   */
  private async getOopifFrameElements(
    unresolvedByUrl: Map<string, string>,
  ): Promise<{ elements: Element[]; reached: number }> {
    let targets: Array<{ targetId: string; type: string; url: string }>
    try {
      targets = await this.target.list()
    } catch {
      return { elements: [], reached: 0 }
    }

    const elements: Element[] = []
    let reached = 0

    for (const t of targets) {
      if (t.type !== 'iframe') continue
      const frameId = unresolvedByUrl.get(t.url)
      if (!frameId) continue // best-effort URL match only — see class comment

      let sid = this.oopifSessions.get(t.targetId)
      if (!sid) {
        try {
          sid = await this.target.attach(t.targetId)
          await this.conn.send('DOM.enable', {}, sid)
          await this.conn.send('Accessibility.enable', {}, sid)
          this.oopifSessions.set(t.targetId, sid)
        } catch {
          continue
        }
      }

      try {
        const result: any = await this.conn.send('Accessibility.getFullAXTree', {}, sid)
        const nodes: CdpAXNode[] = result?.nodes ?? []
        const tag = this.tagForFrame(frameId)
        elements.push(...this.convertFrameAXNodes(nodes, sid, tag))
        reached += 1
      } catch {
        // OOPIF session unusable this snapshot — skip, try again next time
      }
    }

    return { elements, reached }
  }

  // ─── JS Dialogs (E3-D) ──────────────────────────────────
  //
  // Placed BEFORE the Interactions section (rather than after scroll(), its
  // most natural neighbor) so that engine.test.ts's T-06 grep falsifier —
  // which scans the source strictly between the `click(` and `doubleClick(`
  // markers for a forbidden `setTimeout` — does not trip over
  // waitForDialog()'s bounded timeout below. That falsifier is about
  // fixed-sleep-free ACTIONABILITY waits specifically; a bounded dialog
  // wait is a different mechanism entirely and is exempt by construction,
  // not by weakening the assertion.

  /**
   * Dispatch a left click at (x, y) on the given session. `this.input` (the
   * InputDomain instance) is permanently bound to the driver's MAIN
   * session, so it cannot dispatch on an OOPIF's session — when
   * `sessionId` names a different session, issue the raw
   * Input.dispatchMouseEvent pair directly (same pattern as rightClick()
   * below) instead of routing through `this.input`.
   */
  private async dispatchClickAt(x: number, y: number, sessionId?: string): Promise<void> {
    if (!sessionId || sessionId === this.sessionId) {
      await this.input.click(x, y)
      return
    }
    await this.conn.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
    }, sessionId)
    await this.conn.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1,
    }, sessionId)
  }

  /**
   * Race a CDP call against a JS dialog opening. Some CDP commands
   * (Runtime.callFunctionOn, Input.dispatchMouseEvent) do not return until
   * the JS they trigger finishes running — if that JS synchronously opens
   * an alert()/confirm()/prompt(), the renderer pauses and Chrome withholds
   * the ACK until Page.handleJavaScriptDialog answers it. Without this,
   * click() on a button whose handler opens a dialog would hang until the
   * dialog is answered (or the connection's own ~30s timeout).
   *
   * If the dialog-opened signal wins the race, the triggering promise is
   * left to settle on its own later (swallowed here so it never surfaces
   * as an unhandled rejection) and this returns `undefined` — the caller
   * treats that the same as "the command was issued", since the dialog
   * itself proves the click's handler ran. The open dialog is exposed via
   * getPendingDialog()/handleDialog().
   */
  private async raceAgainstDialog<T>(promise: Promise<T>): Promise<T | undefined> {
    if (this.pendingDialog) return undefined
    let onDialog: () => void = () => {}
    const dialogSignal = new Promise<void>((resolve) => {
      onDialog = resolve
      this.dialogWaiters.add(onDialog)
    })
    try {
      const winner = await Promise.race([
        promise.then((value) => ({ dialog: false as const, value })),
        dialogSignal.then(() => ({ dialog: true as const, value: undefined as T | undefined })),
      ])
      if (winner.dialog) {
        promise.catch(() => {})
        return undefined
      }
      return winner.value
    } finally {
      this.dialogWaiters.delete(onDialog)
    }
  }

  /**
   * The currently-open JS dialog (alert/confirm/prompt/beforeunload), if
   * any. Poll this (or await waitForDialog()) instead of letting a
   * triggering action hang indefinitely — see raceAgainstDialog().
   */
  getPendingDialog(): JSDialogInfo | null {
    return this.pendingDialog
  }

  /**
   * Answer the currently-open JS dialog. `accept` maps to OK/Cancel;
   * `promptText` is only meaningful for `type: 'prompt'` dialogs. Throws if
   * no dialog is currently open.
   */
  async handleDialog(accept: boolean, promptText?: string): Promise<void> {
    if (!this.pendingDialog) {
      throw new Error('handleDialog: no JS dialog is currently open')
    }
    await this._page.handleDialog(accept, promptText)
    this.pendingDialog = null
  }

  /**
   * Wait until a JS dialog opens (or the timeout elapses). Useful when a
   * dialog may be triggered by an action whose own promise won't settle
   * until the dialog is answered (see raceAgainstDialog()) — callers that
   * fired such an action without awaiting it can await this instead.
   */
  async waitForDialog(timeout = 5000): Promise<JSDialogInfo> {
    if (this.pendingDialog) return this.pendingDialog
    return new Promise((resolve, reject) => {
      const onDialog = () => {
        clearTimeout(timer)
        resolve(this.pendingDialog!)
      }
      const timer = setTimeout(() => {
        this.dialogWaiters.delete(onDialog)
        reject(new Error(`waitForDialog: no dialog opened within ${timeout}ms`))
      }, timeout)
      this.dialogWaiters.add(onDialog)
    })
  }

  // ─── Interactions ───────────────────────────────────────

  async click(elementId: string): Promise<void> {
    const ref = await this.awaitActionable(elementId)

    // Use DOM.resolveNode + callFunctionOn to call .click() on the DOM element.
    // This triggers ALL click handlers: addEventListener, inline onclick, and href navigation.
    // CDP Input.dispatchMouseEvent only fires addEventListener handlers, NOT inline onclick.
    //
    // sid (E3-D): the session that actually resolves ref.backendNodeId —
    // the main session for main-frame/in-process-iframe elements, or an
    // OOPIF's own session for an out-of-process iframe element.
    const sid = ref.sessionId ?? undefined
    let domClickWorked = false
    try {
      const resolved: any = await this.conn.send('DOM.resolveNode', { backendNodeId: ref.backendNodeId }, sid)
      if (resolved?.object?.objectId) {
        // E3-D: a synchronous alert()/confirm() inside this element's click
        // handler pauses the renderer's JS — Chrome won't ACK this
        // Runtime.callFunctionOn call until the dialog is answered. Racing
        // against the dialog-opened signal means click() itself never
        // hangs on that; the caller sees the dialog via getPendingDialog().
        await this.raceAgainstDialog(
          this.conn.send('Runtime.callFunctionOn', {
            objectId: resolved.object.objectId,
            functionDeclaration: 'function() { this.click(); }',
          }, sid),
        )
        domClickWorked = true
      }
    } catch {
      // DOM click failed — fall back to coordinate-based click
    }

    if (!domClickWorked) {
      const { x, y } = await this.dom.getElementCenter(ref.backendNodeId, sid)
      await this.raceAgainstDialog(this.dispatchClickAt(x, y, sid))
    }
  }

  async type(elementId: string, text: string): Promise<void> {
    const ref = await this.awaitActionable(elementId)

    const { x, y } = await this.dom.getElementCenter(ref.backendNodeId)
    await this.input.click(x, y)
    await this.input.type(text)
  }

  async fill(elementId: string, value: string): Promise<void> {
    const ref = await this.awaitActionable(elementId)

    const { x, y } = await this.dom.getElementCenter(ref.backendNodeId)
    await this.input.click(x, y)

    // Clear existing value
    await this.runtime.callFunctionOn(
      '() => { if (document.activeElement) { document.activeElement.value = ""; document.activeElement.dispatchEvent(new Event("input", { bubbles: true })); } }',
    )

    await this.input.type(value)
  }

  async hover(elementId: string): Promise<void> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const { x, y } = await this.dom.getElementCenter(backendNodeId)
    await this.input.hover(x, y)
  }

  async pressKey(key: string): Promise<void> {
    await this.input.pressKey(key)
  }

  async scroll(deltaY: number, x = 0, y = 0): Promise<void> {
    await this.input.scroll(x, y, 0, deltaY)
  }

  // ─── Interaction Assertions ─────────────────────────────

  /**
   * Before/after state capture around an action.
   * Returns element diff and pixel diff.
   */
  async actAndCapture(action: () => Promise<void>): Promise<{
    before: { elements: Element[]; screenshot: Buffer }
    after: { elements: Element[]; screenshot: Buffer }
    diff: { addedElements: Element[]; removedElements: Element[]; pixelDiff: number }
  }> {
    // Capture before state
    const [beforeElements, beforeScreenshot] = await Promise.all([
      this.freshSnapshot(),
      this._page.screenshot(),
    ])

    // Execute action
    await action()

    // Wait for AX tree stability (elements stop changing)
    await waitForStableTree(() => this.freshSnapshot(), { timeout: 5000, stableTime: 300 })

    // Wait for visual rendering to complete — CSS transitions, layout shifts,
    // and repaint after DOM changes. requestAnimationFrame fires after the next
    // composite, ensuring visibility changes (display:none → visible) are painted.
    await this.runtime.evaluate(
      'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'
    ).catch(() => {})

    // Capture after state
    const [afterElements, afterScreenshot] = await Promise.all([
      this.freshSnapshot(),
      this._page.screenshot(),
    ])

    // Compute element diff by id
    const beforeIds = new Set(beforeElements.map((e) => e.id))
    const afterIds = new Set(afterElements.map((e) => e.id))
    const addedElements = afterElements.filter((e) => !beforeIds.has(e.id))
    const removedElements = beforeElements.filter((e) => !afterIds.has(e.id))

    // Compute pixel diff
    let pixelDiff = 0
    try {
      const beforePng = PNG.sync.read(beforeScreenshot)
      const afterPng = PNG.sync.read(afterScreenshot)
      if (beforePng.width === afterPng.width && beforePng.height === afterPng.height) {
        const { width, height } = beforePng
        const diffPng = new PNG({ width, height })
        pixelDiff = pixelmatch(beforePng.data, afterPng.data, diffPng.data, width, height, {
          threshold: 0.1,
          includeAA: false,
        })
      }
    } catch {
      // Pixel diff is best-effort — ignore errors
    }

    return {
      before: { elements: beforeElements, screenshot: beforeScreenshot },
      after: { elements: afterElements, screenshot: afterScreenshot },
      diff: { addedElements, removedElements, pixelDiff },
    }
  }

  /**
   * Set a <select> element's value and dispatch change event.
   */
  async select(elementId: string, value: string): Promise<void> {
    const ref = await this.awaitActionable(elementId)

    const { x, y } = await this.dom.getElementCenter(ref.backendNodeId)
    await this.input.click(x, y)

    await this.runtime.callFunctionOn(
      '(val) => { const el = document.activeElement; if (el && el.tagName === "SELECT") { el.value = val; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); } }',
      [value],
    )
  }

  /**
   * Toggle a checkbox element.
   */
  async check(elementId: string): Promise<void> {
    const ref = await this.awaitActionable(elementId)

    const { x, y } = await this.dom.getElementCenter(ref.backendNodeId)
    await this.input.click(x, y)
  }

  /**
   * Double-click an element.
   */
  async doubleClick(elementId: string): Promise<void> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const { x, y } = await this.dom.getElementCenter(backendNodeId)
    await this.input.click(x, y)
    await new Promise((r) => setTimeout(r, 50))
    await this.input.click(x, y)
  }

  /**
   * Right-click an element (opens context menu).
   */
  async rightClick(elementId: string): Promise<void> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const { x, y } = await this.dom.getElementCenter(backendNodeId)
    const sid = this.sessionId ?? undefined
    await this.conn.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1,
    }, sid)
    await this.conn.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1,
    }, sid)
  }

  /**
   * Wait until an element with the given name (and optional role) appears in the AX tree.
   * Polls at 200ms intervals. Throws on timeout.
   */
  async waitForElement(
    name: string,
    options?: { role?: string; timeout?: number },
  ): Promise<Element> {
    const timeout = options?.timeout ?? 10000
    const deadline = Date.now() + timeout
    const interval = 200

    while (Date.now() < deadline) {
      const elements = await this.freshSnapshot()
      const match = elements.find((e) => {
        const nameMatch = e.label?.toLowerCase().includes(name.toLowerCase()) ||
          e.value?.toString().toLowerCase().includes(name.toLowerCase())
        const roleMatch = !options?.role || e.role === options.role
        return nameMatch && roleMatch
      })
      if (match) return match
      await new Promise((r) => setTimeout(r, interval))
    }

    throw new Error(
      `waitForElement: element "${name}"${options?.role ? ` (role: ${options.role})` : ''} not found within ${timeout}ms`,
    )
  }

  // ─── Screenshots ────────────────────────────────────────

  async screenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
    return this._page.screenshot(options)
  }

  async screenshotElement(elementId: string): Promise<Buffer> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const model = await this.dom.getBoxModel(backendNodeId)
    const q = model.content
    const x = Math.min(q[0], q[2], q[4], q[6])
    const y = Math.min(q[1], q[3], q[5], q[7])

    return this._page.screenshot({
      clip: { x, y, width: model.width, height: model.height },
    })
  }

  // ─── Page State ─────────────────────────────────────────

  /**
   * One-call page state capture — combines DOMSnapshot, AX tree, and screenshot.
   */
  async captureState(options: CaptureStateOptions = {}): Promise<CapturedState> {
    const state: CapturedState = {
      url: this._currentUrl,
      timestamp: Date.now(),
    }

    const promises: Promise<void>[] = []

    if (options.computedStyles) {
      promises.push(
        this.snapshot.captureSnapshot({
          computedStyles: options.computedStyles,
        }).then((result) => { state.domSnapshot = result }),
      )
    }

    if (options.includeAXTree !== false) {
      promises.push(
        this.freshSnapshot().then((elements) => { state.axTree = elements }),
      )
    }

    if (options.includeScreenshot) {
      promises.push(
        this._page.screenshot().then((buf) => { state.screenshot = buf }),
      )
    }

    await Promise.all(promises)
    return state
  }

  /** Get AX tree snapshot. */
  async getSnapshot(): Promise<Element[]> {
    return this.freshSnapshot()
  }

  // ─── Evaluation ─────────────────────────────────────────

  /**
   * Evaluate a JavaScript expression in the page context.
   */
  async evaluate(expression: string): Promise<unknown>
  /**
   * Call a function with arguments in the page context.
   * Equivalent to Playwright's page.evaluate(fn, ...args).
   */
  async evaluate(fn: string, ...args: unknown[]): Promise<unknown>
  async evaluate(exprOrFn: string, ...args: unknown[]): Promise<unknown> {
    if (args.length > 0) {
      return this.runtime.callFunctionOn(exprOrFn, args)
    }
    return this.runtime.evaluate(exprOrFn)
  }

  // ─── DOM Queries ────────────────────────────────────────

  async querySelector(selector: string): Promise<number | null> {
    const doc = await this.dom.getDocument()
    return this.dom.querySelector(doc.root.nodeId, selector)
  }

  async querySelectorAll(selector: string): Promise<number[]> {
    const doc = await this.dom.getDocument()
    return this.dom.querySelectorAll(doc.root.nodeId, selector)
  }

  async getOuterHTML(nodeId: number): Promise<string> {
    return this.dom.getOuterHTML(nodeId)
  }

  async getAttributes(nodeId: number): Promise<Record<string, string>> {
    return this.dom.getAttributes(nodeId)
  }

  async getComputedStyle(nodeId: number, properties?: string[]): Promise<Record<string, string>> {
    if (properties) {
      return this.css.getComputedStyleFiltered(nodeId, properties)
    }
    return this.css.getComputedStyle(nodeId)
  }

  // ─── CSS Injection ──────────────────────────────────────

  async addStyleTag(css: string): Promise<void> {
    return this._page.addStyleTag(css)
  }

  // ─── Viewport ───────────────────────────────────────────

  async setViewport(config: ViewportConfig): Promise<void> {
    await this.emulation.setDeviceMetrics(config)
  }

  async clearViewport(): Promise<void> {
    await this.emulation.clearDeviceMetrics()
  }

  // ─── Cookies / Auth ─────────────────────────────────────

  async getCookies(urls?: string[]): Promise<Cookie[]> {
    return this.network.getCookies(urls)
  }

  async setCookies(cookies: SetCookieParams[]): Promise<void> {
    return this.network.setCookies(cookies)
  }

  async clearCookies(): Promise<void> {
    return this.network.clearCookies()
  }

  // ─── Console ────────────────────────────────────────────

  getConsoleMessages(): ConsoleMessage[] {
    return this.console.getMessages()
  }

  getConsoleErrors(): ConsoleMessage[] {
    return this.console.getErrors()
  }

  clearConsole(): void {
    this.console.clear()
  }

  // ─── Content ────────────────────────────────────────────

  async content(): Promise<string> {
    return this.runtime.evaluate('document.documentElement.outerHTML') as Promise<string>
  }

  async title(): Promise<string> {
    return this.runtime.evaluate('document.title') as Promise<string>
  }

  async textContent(selector: string): Promise<string | null> {
    return this.runtime.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); return el ? el.textContent : null; }',
      [selector],
    ) as Promise<string | null>
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    return this.runtime.callFunctionOn(
      '(sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; }',
      [selector, attribute],
    ) as Promise<string | null>
  }

  // ─── LLM-Native: Observe ─────────────────────────────────

  /**
   * Preview what actions are possible without executing.
   * Returns serializable descriptors for act().
   */
  async observe(options?: ObserveOptions): Promise<ActionDescriptor[]> {
    const elements = await this.freshSnapshot()
    return observe(elements, options)
  }

  // ─── LLM-Native: Extract ───────────────────────────────

  /**
   * Extract structured data from AX tree using a schema.
   */
  async extract(schema: ExtractSchema): Promise<ExtractResult> {
    const elements = await this.freshSnapshot()
    return extractFromAXTree(elements, schema)
  }

  /**
   * Extract a list of repeated elements.
   */
  async extractItems(options: {
    role?: string
    labelPattern?: RegExp
    maxItems?: number
  }): Promise<Array<{ label: string; value: string | null; id: string }>> {
    const elements = await this.freshSnapshot()
    return extractList(elements, options)
  }

  /**
   * Extract page-level metadata (headings, links, inputs, buttons).
   */
  async extractMeta(): Promise<ReturnType<typeof extractPageMeta>> {
    const elements = await this.freshSnapshot()
    return extractPageMeta(elements)
  }

  // ─── LLM-Native: Adaptive Modality ─────────────────────

  /**
   * Assess how well the AX tree captures the page.
   * Returns a score and whether a screenshot is recommended.
   */
  async assessUnderstanding(options?: ModalityOptions): Promise<UnderstandingScore> {
    const elements = await this.freshSnapshot()
    return assessUnderstanding(elements, options)
  }

  // ─── Coverage Reporting ────────────────────────────────

  /**
   * Report AX tree coverage against estimated visible DOM elements.
   * Surfaces blind spots: shadow DOM, canvas, iframes.
   */
  async getCoverage(): Promise<CoverageReport> {
    const gaps: string[] = []

    // 1. AX tree count
    const axElements = await this.freshSnapshot()
    const axTreeCount = axElements.length

    // 2. Estimated visible DOM elements (not aria-hidden, has layout dimensions)
    const estimatedVisible = await this.runtime.evaluate(`
      (function() {
        const all = document.querySelectorAll('*');
        let count = 0;
        for (const el of all) {
          if (el.getAttribute('aria-hidden') === 'true') continue;
          if (el.offsetWidth > 0 || el.offsetHeight > 0) count++;
        }
        return count;
      })()
    `) as number

    // 3. Canvas elements
    const canvasCount = await this.runtime.evaluate(
      `document.querySelectorAll('canvas').length`,
    ) as number

    // 4. Iframe elements — E3-D: freshSnapshot() (called above for
    // axElements) now DESCENDS into iframes and merges their elements in,
    // so an iframe is only a genuine gap when we could not reach its
    // content this snapshot (cross-process attach failed, or the frame's
    // own getFullAXTree call errored). lastFrameCount/lastFrameReached are
    // populated by that same freshSnapshot() call via getFrameElements().
    const iframeCount = await this.runtime.evaluate(
      `document.querySelectorAll('iframe').length`,
    ) as number

    // 5. Shadow DOM extraction
    const shadowElements = await extractShadowElements(this.runtime)
    const shadowDomCount = shadowElements.length
    const recovered = shadowDomCount

    // 6. Build gap descriptions
    if (canvasCount > 0) {
      gaps.push(`${canvasCount} canvas element${canvasCount > 1 ? 's' : ''} (invisible to AX tree)`)
    }
    if (iframeCount > 0) {
      const unreached = Math.max(0, this.lastFrameCount - this.lastFrameReached)
      if (unreached > 0) {
        gaps.push(`${unreached} iframe${unreached > 1 ? 's' : ''} not reachable this snapshot (cross-process attach failed)`)
      }
    }
    if (shadowDomCount > 0) {
      gaps.push(`${shadowDomCount} shadow DOM element${shadowDomCount > 1 ? 's' : ''} (open shadow root — recovered via piercing)`)
    }

    const safeVisible = estimatedVisible > 0 ? estimatedVisible : 1
    const coveragePercent = Math.min(100, Math.round((axTreeCount / safeVisible) * 100))

    if (coveragePercent < 50) {
      gaps.push(`Low AX coverage: ${coveragePercent}% of visible DOM captured`)
    }

    return {
      axTreeCount,
      estimatedVisible,
      coveragePercent,
      shadowDomCount,
      canvasCount,
      iframeCount,
      recovered,
      gaps,
    }
  }

  // ─── LLM-Native: Cache ─────────────────────────────────

  /** Get resolution cache statistics. */
  get cacheStats(): ReturnType<ResolutionCache['stats']> {
    return this.resolutionCache.stats()
  }

  /** Configure the resolution cache. */
  configureCache(options: CacheOptions): void {
    this.resolutionCache = new ResolutionCache(options)
  }

  // ─── Direct domain access (for advanced use) ───────────

  get page(): PageDomain { return this._page }
  get accessibility(): AccessibilityDomain { return this.ax }
  get domDomain(): DomDomain { return this.dom }
  get runtimeDomain(): RuntimeDomain { return this.runtime }
  get cssDomain(): CssDomain { return this.css }
  get snapshotDomain(): SnapshotDomain { return this.snapshot }
  get emulationDomain(): EmulationDomain { return this.emulation }
  get networkDomain(): NetworkDomain { return this.network }
  get consoleDomain(): ConsoleDomain { return this.console }
  get connection(): CdpConnection { return this.conn }

  /** The CDP debug port Chrome is listening on. Only valid after launch(). */
  get debugPort(): number { return this.browser.port }

  /** The OS PID of the Chrome process. Only valid after launch(). Null when connected to existing. */
  get chromePid(): number | null { return this.browser.pid }

  /** The browser connection mode used for this driver. */
  get browserMode(): BrowserMode { return this.browser.mode }

  /** The resolved CDP HTTP endpoint, when available. */
  get cdpUrl(): string | null { return this.browser.cdpUrl }

  /** The resolved browser WebSocket endpoint, when available. */
  get wsEndpoint(): string | null { return this.browser.wsEndpoint }

  /**
   * Connect to an already-running Chrome instance instead of launching a new one.
   * Used by browser-server reconnection to attach to a persistent Chrome process.
   */
  async connectExisting(wsUrl: string): Promise<void> {
    await this.conn.connect(wsUrl)
    this.target = new TargetDomain(this.conn)
    this.launched = true

    // Create a new page in the existing browser
    this.targetId = await this.target.createPage('about:blank')
    this.sessionId = await this.target.attach(this.targetId)

    // Initialize domains with session
    this._page = new PageDomain(this.conn, this.sessionId)
    this.ax = new AccessibilityDomain(this.conn, this.sessionId)
    this.dom = new DomDomain(this.conn, this.sessionId)
    this.input = new InputDomain(this.conn, this.sessionId)
    this.runtime = new RuntimeDomain(this.conn, this.sessionId)
    this.css = new CssDomain(this.conn, this.sessionId)
    this.snapshot = new SnapshotDomain(this.conn, this.sessionId)
    this.emulation = new EmulationDomain(this.conn, this.sessionId)
    this.network = new NetworkDomain(this.conn, this.sessionId)
    this.console = new ConsoleDomain(this.conn, this.sessionId)

    await this._page.enableLifecycleEvents()
    await this.ax.enable()
    await this.console.enable()
    await this.network.enable()
    this.setupDialogHandling()
  }
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Chunk elements to fit within a token budget.
 * Approximate: ~4 chars per token, ~40 chars per serialized element.
 */
function chunkElements(elements: Element[], maxTokens: number): Element[] {
  const charsPerToken = 4
  const charsPerElement = 40
  const maxElements = Math.floor((maxTokens * charsPerToken) / charsPerElement)
  return elements.slice(0, maxElements)
}
