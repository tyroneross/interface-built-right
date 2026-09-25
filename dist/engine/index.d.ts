/**
 * CDP WebSocket transport layer.
 * Forked from Spectra — adapted for IBR engine.
 * Uses Node.js 22+ built-in WebSocket (no ws package).
 */
type EventHandler = (params: unknown) => void;
declare class CdpConnection {
    private ws;
    private nextId;
    private pending;
    private eventHandlers;
    private timeoutMs;
    constructor(options?: {
        timeoutMs?: number;
    });
    /**
     * Open the CDP WebSocket, bounded by `timeoutMs`.
     *
     * `new WebSocket()` fires 'open' or 'error' — and NEITHER when the peer
     * completes the TCP handshake then goes silent, which is exactly what a
     * recycled ephemeral port looks like. Without the timer below this call
     * never settles: measured still pending at 25s on 2026-09-01. On timeout we
     * also close the half-open socket, or the process keeps a live handle and
     * cannot exit.
     */
    connect(wsUrl: string, options?: {
        timeoutMs?: number;
    }): Promise<void>;
    send<T = unknown>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T>;
    on(method: string, handler: EventHandler): void;
    off(method: string, handler: EventHandler): void;
    private handleMessage;
    private handleClose;
    close(): Promise<void>;
    get connected(): boolean;
}

/**
 * Chrome browser process lifecycle management.
 * Forked from Spectra — adapted for IBR engine.
 */
declare const CHROME_PATHS: string[];
declare function findChrome(): string | null;
type BrowserMode = 'local' | 'connect';
interface BrowserConnectionOptions {
    mode?: BrowserMode;
    cdpUrl?: string;
    wsEndpoint?: string;
    chromePath?: string;
}
interface BrowserOptions extends BrowserConnectionOptions {
    headless?: boolean;
    port?: number;
    userDataDir?: string;
    /**
     * Rendering normalization for mockup comparison.
     * Adds --disable-lcd-text and --force-device-scale-factor=1.
     * These improve pixel-level consistency but reduce text rendering quality.
     * Default: false
     */
    normalize?: boolean;
    /**
     * Called with each spawn step ('finding chrome', 'spawned pid 123', ...).
     * A spawn that fails silently is unusable; this makes every stage visible
     * without turning on a debugger.
     */
    onProgress?: (step: string) => void;
}
declare class BrowserManager {
    private process;
    private _port;
    private _mode;
    private _cdpUrl;
    private _wsEndpoint;
    /** Set only when this browser owns a throwaway profile it must delete on close. */
    private _ephemeralProfileDir;
    /** Tail of Chrome's stderr, so a spawn failure can say why Chrome refused. */
    private _stderrTail;
    /** Set once the child exits, so waitForDebugger stops polling a dead process. */
    private _exit;
    /** Set only when this browser holds the IBR profile lock for `userDataDir`, so close() can release it. */
    private _profileLockPath;
    launch(options?: BrowserOptions): Promise<string>;
    private spawnChromeAndWaitForDebugger;
    /**
     * Poll the freshly spawned Chrome until its debugger answers.
     *
     * This used to be `for (i < 50) { await fetch(...) }` with a comment claiming
     * "5 seconds at 100ms intervals". It was not 5 seconds and it was not
     * bounded: `fetch()` has no default deadline, so ONE attempt against a port
     * that is listening but silent blocks the whole loop forever. That is the
     * shape of the reported hang — no output, no error, no timeout of its own.
     *
     * Now: a wall-clock deadline governs the loop, each probe carries its own
     * short timeout, and an exited child ends the wait immediately instead of
     * polling a process that is never coming back.
     */
    private waitForDebugger;
    private stderrHint;
    close(): Promise<void>;
    get running(): boolean;
    get port(): number;
    get pid(): number | null;
    get mode(): BrowserMode;
    get cdpUrl(): string | null;
    get wsEndpoint(): string | null;
}

/**
 * CDP Page domain — navigation, screenshots, lifecycle events.
 * Forked from Spectra — extended with getLayoutMetrics, clip screenshots,
 * captureBeyondViewport, and CSS/script injection.
 */

interface ScreenshotOptions {
    format?: 'png' | 'jpeg';
    quality?: number;
    fullPage?: boolean;
    clip?: {
        x: number;
        y: number;
        width: number;
        height: number;
        scale?: number;
    };
}
interface LayoutMetrics {
    contentSize: {
        width: number;
        height: number;
    };
    layoutViewport: {
        pageX: number;
        pageY: number;
        clientWidth: number;
        clientHeight: number;
    };
    visualViewport: {
        offsetX: number;
        offsetY: number;
        pageX: number;
        pageY: number;
        clientWidth: number;
        clientHeight: number;
        scale: number;
    };
}
/**
 * A node in the frame hierarchy returned by Page.getFrameTree — verified
 * against the official CDP Page domain docs (chromedevtools.github.io/
 * devtools-protocol/tot/Page/#method-getFrameTree): `frame` carries at
 * least {id, parentId?, url}; `childFrames` is present only when the
 * frame has children (recursive).
 */
interface FrameTreeNode {
    frame: {
        id: string;
        parentId?: string;
        url: string;
        securityOrigin?: string;
        mimeType?: string;
    };
    childFrames?: FrameTreeNode[];
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
interface JSDialogInfo {
    message: string;
    type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
    url: string;
    frameId?: string;
    hasBrowserHandler: boolean;
    defaultPrompt?: string;
}
declare class PageDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    navigate(url: string): Promise<string>;
    screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    /**
     * Full-page screenshot via getLayoutMetrics + device metrics override.
     * Technique: get content size → override viewport to content size →
     * capture with captureBeyondViewport → restore viewport.
     */
    private fullPageScreenshot;
    getLayoutMetrics(): Promise<LayoutMetrics>;
    enableLifecycleEvents(): Promise<void>;
    /**
     * Frame hierarchy for the current page (E3-D). Used to discover iframes
     * whose accessible content today isn't reachable from the main-frame AX
     * tree (Accessibility.getFullAXTree only walks the ROOT frame by
     * default).
     */
    getFrameTree(): Promise<FrameTreeNode>;
    /**
     * Subscribe to Page.javascriptDialogOpening (E3-D). Returns an unsubscribe
     * function. Page.enable() (called by enableLifecycleEvents()) must have
     * run first for this event to fire.
     */
    onDialogOpening(handler: (dialog: JSDialogInfo) => void): () => void;
    /**
     * Subscribe to Page.javascriptDialogClosed (E3-D) — fires once a dialog
     * has been answered, whether via handleDialog() or the browser's own
     * default handling. Returns an unsubscribe function.
     */
    onDialogClosed(handler: (info: {
        result: boolean;
        userInput: string;
    }) => void): () => void;
    /**
     * Answer the currently-open JS dialog (E3-D). `promptText` is only
     * meaningful for `type: 'prompt'` dialogs; omit to accept the default.
     */
    handleDialog(accept: boolean, promptText?: string): Promise<void>;
    /**
     * Inject CSS into the page.
     * Uses callFunctionOn with CSS passed as a proper argument (not interpolated)
     * to avoid injection issues with special characters in CSS content.
     */
    addStyleTag(css: string): Promise<void>;
    /**
     * Inject script that runs on every navigation (including future ones).
     * Uses Page.addScriptToEvaluateOnNewDocument.
     */
    addScriptOnLoad(source: string): Promise<string>;
}

/**
 * Core types for the IBR browser engine.
 * Forked from Spectra — extended for UI validation use cases.
 */

type Platform = 'web' | 'macos' | 'ios' | 'watchos';
interface Element {
    id: string;
    role: string;
    label: string;
    value: string | null;
    enabled: boolean;
    focused: boolean;
    actions: string[];
    bounds: [number, number, number, number];
    parent: string | null;
}
interface Snapshot {
    url?: string;
    appName?: string;
    platform: Platform;
    elements: Element[];
    timestamp: number;
    metadata?: SnapshotMetadata;
}
interface SnapshotMetadata {
    elementCount: number;
    stableAt?: number;
    timedOut?: boolean;
}
type ActionType = 'click' | 'type' | 'clear' | 'select' | 'scroll' | 'hover' | 'focus';
interface Action {
    type: ActionType;
    elementId: string;
    value?: string;
}
interface ActResult {
    success: boolean;
    error?: string;
    snapshot: Snapshot;
}
/**
 * Common driver interface implemented by both EngineDriver (Chrome/CDP)
 * and SafariDriver (safaridriver/WebDriver + macOS AX API).
 */
interface BrowserDriver {
    launch(options: {
        headless?: boolean;
        viewport?: {
            width: number;
            height: number;
        };
        normalize?: boolean;
        mode?: BrowserMode;
        cdpUrl?: string;
        wsEndpoint?: string;
        chromePath?: string;
    }): Promise<void>;
    navigate(url: string, options?: {
        waitFor?: 'stable' | 'load' | 'none';
        timeout?: number;
    }): Promise<void>;
    screenshot(options?: {
        clip?: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }): Promise<Buffer>;
    discover(options?: {
        filter?: 'interactive' | 'leaf' | 'all';
        serialize?: boolean;
    }): Promise<any>;
    find(name: string, options?: {
        role?: string;
    }): Promise<any | null>;
    click(elementId: string): Promise<void>;
    type(elementId: string, text: string): Promise<void>;
    fill(elementId: string, value: string): Promise<void>;
    hover(elementId: string): Promise<void>;
    pressKey(key: string): Promise<void>;
    scroll(deltaY: number, x?: number, y?: number): Promise<void>;
    evaluate<T>(expression: string): Promise<T>;
    close(): Promise<void>;
    readonly currentUrl: string;
}
interface ResolveOptions {
    intent: string;
    elements: Element[];
    mode: 'claude' | 'algorithmic';
}
interface ResolveResult {
    element: Element | null;
    confidence: number;
    candidates?: Element[];
    visionFallback?: boolean;
}

/**
 * CDP Accessibility domain — AX tree access, queryAXTree, event subscriptions.
 * Forked from Spectra — extended with queryAXTree-first resolution and events.
 */

interface CdpAXNode {
    nodeId: string;
    role: {
        value: string;
    };
    name?: {
        value: string;
    };
    value?: {
        value: string;
    };
    properties?: Array<{
        name: string;
        value: {
            value: unknown;
        };
    }>;
    childIds?: string[];
    backendDOMNodeId?: number;
}
declare class AccessibilityDomain {
    private conn;
    private sessionId?;
    private nodeMap;
    private loadCompleteHandlers;
    private nodesUpdatedHandlers;
    private enabled;
    private loadCompleteListener;
    private nodesUpdatedListener;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    enable(): Promise<void>;
    disable(): Promise<void>;
    getSnapshot(): Promise<Element[]>;
    /**
     * queryAXTree — CDP-native search by accessible name and/or role.
     * Faster than getFullAXTree + filter for targeted element finding.
     * Note: does NOT clear/repopulate nodeMap — merges into existing map.
     */
    queryAXTree(options: {
        accessibleName?: string;
        role?: string;
        backendNodeId?: number;
    }): Promise<Element[]>;
    getBackendNodeId(elementId: string): number | undefined;
    /** Subscribe to Accessibility.loadComplete events. */
    onLoadComplete(handler: () => void): void;
    /** Subscribe to Accessibility.nodesUpdated events. */
    onNodesUpdated(handler: (nodes: CdpAXNode[]) => void): void;
    offLoadComplete(handler: () => void): void;
    offNodesUpdated(handler: (nodes: CdpAXNode[]) => void): void;
    /**
     * Convert CDP AX nodes to Elements.
     * @param clearMap If true (default), clears nodeMap first. Set false for queryAXTree
     *   to merge results into existing map without invalidating prior IDs.
     */
    private convertToElements;
    private getProperty;
    private inferActions;
}

/**
 * CDP DOM domain — element queries, box model, HTML extraction.
 * Forked from Spectra — extended with querySelector, querySelectorAll, getOuterHTML.
 */

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
type NodeRef = {
    nodeId: number;
} | {
    backendNodeId: number;
};
declare class DomDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    /**
     * `sessionId` overrides the domain's default session — needed for E3-D
     * frame support, where a backendNodeId sourced from an out-of-process
     * iframe target must be resolved against THAT target's session, not the
     * main page's.
     */
    getElementCenter(ref: NodeRef, sessionId?: string): Promise<{
        x: number;
        y: number;
    }>;
    /** See getElementCenter() for the `sessionId` override rationale. */
    getBoxModel(ref: NodeRef, sessionId?: string): Promise<{
        content: number[];
        padding: number[];
        border: number[];
        margin: number[];
        width: number;
        height: number;
    }>;
    /**
     * Scroll `ref` into the viewport before a caller reads its box model for
     * a clip region — a below-the-fold element's box model is otherwise
     * outside (or clipped by) the current viewport, producing a wrong or
     * empty screenshot clip.
     */
    scrollIntoViewIfNeeded(ref: NodeRef, sessionId?: string): Promise<void>;
    getDocument(): Promise<{
        root: {
            nodeId: number;
        };
    }>;
    /**
     * Find a single element by CSS selector.
     * Returns the nodeId, or null if not found.
     */
    querySelector(nodeId: number, selector: string): Promise<number | null>;
    /**
     * Find all elements matching a CSS selector.
     * Returns array of nodeIds.
     */
    querySelectorAll(nodeId: number, selector: string): Promise<number[]>;
    /**
     * Get the outer HTML of a node.
     */
    getOuterHTML(nodeId?: number, backendNodeId?: number): Promise<string>;
    /**
     * Get attributes of a node as key-value pairs.
     */
    getAttributes(nodeId: number): Promise<Record<string, string>>;
}

/**
 * CDP Runtime domain — JavaScript evaluation in page context.
 * Forked from Spectra — extended with callFunctionOn for function+args evaluation.
 */

declare class RuntimeDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    /**
     * Evaluate a JavaScript expression string in the page context.
     */
    evaluate(expression: string): Promise<unknown>;
    /**
     * Evaluate a JavaScript expression string in the page context with
     * DevTools' `includeCommandLineAPI` flag set, exposing console-only
     * helpers ($, $$, getEventListeners, etc.) to the evaluated expression.
     *
     * Needed for real listener detection: page JS has no way to enumerate
     * addEventListener-registered handlers on itself (no public DOM API for
     * it), but DevTools' `getEventListeners(node)` can — it is backed by
     * `DOMDebugger.getEventListeners` and only reachable from an expression
     * evaluated with this flag. A separate method (not a parameter on
     * `evaluate()`) so the common path stays byte-for-byte unchanged and this
     * capability is opt-in per call site.
     */
    evaluateWithCommandLineAPI(expression: string): Promise<unknown>;
    /**
     * Call a function with structured arguments in the page context.
     * This is the CDP equivalent of Playwright's page.evaluate(fn, ...args).
     *
     * The function declaration is serialized as a string, and arguments
     * are passed as CDP CallArgument objects (primitives by value).
     *
     * Usage:
     *   await runtime.callFunctionOn(
     *     '(selector, prop) => getComputedStyle(document.querySelector(selector))[prop]',
     *     ['.header', 'color']
     *   )
     */
    callFunctionOn(functionDeclaration: string, args?: unknown[]): Promise<unknown>;
    /**
     * Enable the Runtime domain to receive events (like consoleAPICalled).
     */
    enable(): Promise<void>;
}

/**
 * CDP CSS domain — computed styles, matched rules.
 * NEW for IBR — direct computed style access without page.evaluate(getComputedStyle).
 */

interface CSSComputedStyleProperty {
    name: string;
    value: string;
}
declare class CssDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    enable(): Promise<void>;
    /**
     * Get computed styles for a DOM node.
     * Returns all computed CSS properties as key-value pairs.
     */
    getComputedStyle(nodeId: number): Promise<Record<string, string>>;
    /**
     * Get computed styles filtered to specific properties.
     * More efficient when you only need a few properties.
     */
    getComputedStyleFiltered(nodeId: number, properties: string[]): Promise<Record<string, string>>;
    /**
     * Get matched CSS rules for a node — includes inline, attribute,
     * inherited, pseudo-element, and keyframe styles.
     */
    getMatchedStyles(nodeId: number): Promise<{
        inlineStyle?: {
            cssProperties: CSSComputedStyleProperty[];
        };
        matchedCSSRules: Array<{
            rule: {
                selectorList: {
                    text: string;
                };
                style: {
                    cssProperties: CSSComputedStyleProperty[];
                };
            };
        }>;
    }>;
}

/**
 * CDP DOMSnapshot domain — one-call full DOM + layout + computed style extraction.
 * NEW for IBR — replaces dozens of individual page.evaluate() calls.
 */

interface DocumentSnapshot {
    documentURL: number;
    title: number;
    baseURL: number;
    contentLanguage: number;
    encodingName: number;
    publicId: number;
    systemId: number;
    frameId: number;
    nodes: NodeTreeSnapshot;
    layout: LayoutTreeSnapshot;
    textBoxes: TextBoxSnapshot;
    scrollOffsetX?: number;
    scrollOffsetY?: number;
    contentWidth?: number;
    contentHeight?: number;
}
interface NodeTreeSnapshot {
    parentIndex?: number[];
    nodeType?: number[];
    shadowRootType?: {
        index: number;
        value: number;
    };
    nodeName?: number[];
    nodeValue?: number[];
    backendNodeId?: number[];
    attributes?: Array<number[]>;
    textValue?: {
        index: number;
        value: number;
    };
    inputValue?: {
        index: number;
        value: number;
    };
    inputChecked?: {
        index: number;
    };
    optionSelected?: {
        index: number;
    };
    contentDocumentIndex?: {
        index: number;
        value: number;
    };
    pseudoType?: {
        index: number;
        value: number;
    };
    pseudoIdentifier?: {
        index: number;
        value: number;
    };
    isClickable?: {
        index: number;
    };
    currentSourceURL?: {
        index: number;
        value: number;
    };
    originURL?: {
        index: number;
        value: number;
    };
}
interface LayoutTreeSnapshot {
    nodeIndex: number[];
    styles: Array<number[]>;
    bounds: Array<number[]>;
    text: number[];
    stackingContexts: {
        index: number;
    };
    paintOrders?: number[];
    offsetRects?: Array<number[]>;
    scrollRects?: Array<number[]>;
    clientRects?: Array<number[]>;
    blendedBackgroundColors?: Array<number>;
    textColorOpacities?: Array<number>;
}
interface TextBoxSnapshot {
    layoutIndex: number[];
    bounds: Array<number[]>;
    start: number[];
    length: number[];
}
interface CaptureSnapshotResult {
    documents: DocumentSnapshot[];
    strings: string[];
}
interface CaptureSnapshotOptions {
    /** CSS property names to include in computed styles. */
    computedStyles: string[];
    /** Include paint order info. */
    includePaintOrder?: boolean;
    /** Include DOM rects (offsetRects, clientRects, scrollRects). */
    includeDOMRects?: boolean;
    /** Include blended background colors. */
    includeBlendedBackgroundColors?: boolean;
    /** Include text color opacities. */
    includeTextColorOpacities?: boolean;
}
declare class SnapshotDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    enable(): Promise<void>;
    /**
     * Capture full DOM snapshot — one call gets everything.
     * Returns flattened arrays with string deduplication.
     */
    captureSnapshot(options: CaptureSnapshotOptions): Promise<CaptureSnapshotResult>;
    /**
     * Helper: resolve a string index from the snapshot's strings array.
     */
    resolveString(strings: string[], index: number): string;
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
    resolveStyles(strings: string[], styleIndices: number[], requestedProperties: string[]): Record<string, string>;
}

/**
 * CDP Emulation domain — viewport, device metrics, UA, touch, media features.
 * Used by EngineDriver to make a page render as if it were a specific device
 * BEFORE the first navigate. See ../driver.ts and ../../devices.ts.
 */

interface ViewportConfig {
    width: number;
    height: number;
    /** Device pixel ratio. Default: 1. */
    deviceScaleFactor?: number;
    /** True for mobile/tablet layout viewports. Default: false. */
    mobile?: boolean;
    /** Override User-Agent string. Omit to keep Chrome's default. */
    userAgent?: string;
    /** Enable touch emulation. Default: derived from `mobile`. */
    hasTouch?: boolean;
}
declare class EmulationDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    /**
     * Override device metrics (viewport size, scale, mobile layout mode).
     * Does NOT set UA or touch — for a full device emulation, use
     * `applyDeviceProfile()` instead.
     */
    setDeviceMetrics(config: ViewportConfig): Promise<void>;
    /**
     * Clear device metrics override (restore defaults).
     */
    clearDeviceMetrics(): Promise<void>;
    /**
     * Override the User-Agent string for subsequent requests. Pages already
     * loaded keep their original UA; navigate after calling this.
     */
    setUserAgent(userAgent: string): Promise<void>;
    /**
     * Enable or disable touch event emulation. When enabled, `maxTouchPoints`
     * defaults to 5 (matches modern phones).
     */
    setTouchEmulation(enabled: boolean, maxTouchPoints?: number): Promise<void>;
    /**
     * Apply a full device profile in one call: metrics + UA + touch. Use this
     * from `EngineDriver.launch()` BEFORE the first navigate so the page sees
     * the device emulation on its initial request, not after.
     *
     * Order matters: UA override first (some sites branch on UA during the
     * initial HTML response), then metrics, then touch.
     */
    applyDeviceProfile(config: ViewportConfig): Promise<void>;
    /**
     * Hide scrollbars (useful for consistent screenshots).
     */
    setScrollbarsHidden(hidden: boolean): Promise<void>;
    /**
     * Emulate reduced motion preference (disable animations for screenshots).
     */
    setReducedMotion(enabled: boolean): Promise<void>;
}

/**
 * CDP Network domain — cookie management for auth state, plus real
 * request/response tracking for network-aware waits (E3-B).
 *
 * The in-flight tracking below replaces two historically FAKE waits:
 * - `networkidle` used to mean "AX tree stopped mutating" (compat.ts, pre
 *   E3-B) — it could report idle while a fetch/XHR was still in flight, or
 *   never report idle on a page whose AX tree legitimately never settles.
 * - `waitForNavigation`/`waitForLoadState` used to mean "sleep 500ms" or
 *   "re-navigate to the same URL and wait for AX stability" — neither
 *   reflects actual network activity.
 *
 * This tracker only reflects reality once `enable()` has been called AND
 * its event handlers are registered on the live CDP connection — see
 * `tracking` / `disableTracking()`, used by the falsifier tests in
 * engine.test.ts to prove `waitForNetworkIdle`/`waitForResponse` are driven
 * by real `Network.*` events, not a fixed sleep.
 */

interface WaitForNetworkIdleOptions {
    /** How long the in-flight count must stay at/below `maxInflight` before
     *  considering the network idle. Default 500ms (matches the common
     *  Playwright/Puppeteer `networkidle`/`networkidle0` convention). */
    idleMs?: number;
    /** Max concurrent in-flight requests still considered "idle" (Puppeteer's
     *  networkidle0 = 0, networkidle2 = 2). Default 0. */
    maxInflight?: number;
    /** Max total wait, ms. Default 10000. */
    timeout?: number;
}
interface NetworkIdleResult {
    /** True if the timeout elapsed before the network reached idle. */
    timedOut: boolean;
    /** In-flight request count at the time this result was produced. */
    inflightCount: number;
}
interface WaitForResponseOptions {
    /** Max total wait, ms. Default 30000. */
    timeout?: number;
}
interface MatchedResponse {
    url: string;
    status: number;
}
type ResponsePredicate = (url: string, status: number) => boolean;
interface Cookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    size: number;
    httpOnly: boolean;
    secure: boolean;
    session: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}
interface SetCookieParams {
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    expires?: number;
}
declare class NetworkDomain {
    private conn;
    private sessionId?;
    private inflight;
    private lastActivityAt;
    private handlersRegistered;
    private responseWaiters;
    private readonly onRequestWillBeSent;
    private readonly onResponseReceived;
    private readonly onLoadingFinished;
    private readonly onLoadingFailed;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    enable(): Promise<void>;
    private registerHandlers;
    /**
     * Detach the Network-domain event listeners without disabling the CDP
     * domain itself. Used by tests to simulate "Network-domain events
     * disabled" — with tracking off, in-flight state is frozen at whatever
     * it was, so `waitForNetworkIdle` reports idle immediately even while a
     * real request is in flight, proving the wait would be FAKE without real
     * event wiring.
     */
    disableTracking(): void;
    /** True once `enable()` has registered real event handlers. */
    get tracking(): boolean;
    /** Current in-flight request count (only meaningful while `tracking`). */
    get inflightCount(): number;
    /**
     * Wait until the in-flight request count has been at or below
     * `maxInflight` for `idleMs` consecutive milliseconds — REAL CDP
     * Network-domain quiescence (requestWillBeSent / responseReceived /
     * loadingFinished / loadingFailed), not AX-tree stability and not a
     * fixed sleep. Never throws: resolves `{ timedOut: true, ... }` at the
     * deadline instead, so callers can treat it as best-effort.
     */
    waitForNetworkIdle(options?: WaitForNetworkIdleOptions): Promise<NetworkIdleResult>;
    /**
     * Wait for a response whose (url, status) satisfies `predicate`. Resolves
     * the moment a matching `Network.responseReceived` event fires; rejects
     * on timeout. Driven entirely by real CDP events — with tracking
     * disabled this never resolves and always times out (no fake success).
     */
    waitForResponse(predicate: ResponsePredicate, options?: WaitForResponseOptions): Promise<MatchedResponse>;
    /**
     * Get all cookies, optionally filtered by URLs.
     */
    getCookies(urls?: string[]): Promise<Cookie[]>;
    /**
     * Set a cookie.
     */
    setCookie(cookie: SetCookieParams): Promise<boolean>;
    /**
     * Set multiple cookies at once.
     */
    setCookies(cookies: SetCookieParams[]): Promise<void>;
    /**
     * Clear all browser cookies.
     */
    clearCookies(): Promise<void>;
    /**
     * Delete specific cookies by name and optional URL/domain.
     */
    deleteCookies(params: {
        name: string;
        url?: string;
        domain?: string;
        path?: string;
    }): Promise<void>;
}

/**
 * CDP Console capture — subscribe to Runtime.consoleAPICalled events.
 * NEW for IBR — replaces Playwright's page.on('console') for error detection.
 */

type ConsoleLevel = 'log' | 'debug' | 'info' | 'error' | 'warning' | 'dir' | 'dirxml' | 'table' | 'trace' | 'clear' | 'startGroup' | 'startGroupCollapsed' | 'endGroup' | 'assert' | 'profile' | 'profileEnd' | 'count' | 'timeEnd';
interface ConsoleMessage {
    type: ConsoleLevel;
    text: string;
    url?: string;
    lineNumber?: number;
    timestamp: number;
}
type ConsoleHandler$1 = (message: ConsoleMessage) => void;
declare class ConsoleDomain {
    private conn;
    private sessionId?;
    private handlers;
    private messages;
    private enabled;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    /**
     * Enable console capture.
     * Must call Runtime.enable first to receive consoleAPICalled events.
     */
    enable(): Promise<void>;
    /** Subscribe to console messages. */
    onMessage(handler: ConsoleHandler$1): void;
    offMessage(handler: ConsoleHandler$1): void;
    /** Get all captured messages. */
    getMessages(): ConsoleMessage[];
    /** Get only errors and warnings. */
    getErrors(): ConsoleMessage[];
    /** Clear captured messages. */
    clear(): void;
}

interface MockResponse {
    status?: number;
    body?: string | object;
    headers?: Record<string, string>;
}

/**
 * Observe — preview what actions are possible without executing.
 * Inspired by Stagehand's observe() primitive.
 *
 * Returns serializable action descriptors that can be logged, cached,
 * or passed back to act() for execution.
 */

interface ActionDescriptor {
    /** Element ID for act() */
    elementId: string;
    /** Human-readable description */
    description: string;
    /** Available actions */
    actions: string[];
    /** Element role */
    role: string;
    /** Element label */
    label: string;
    /** Compact serialized form */
    serialized: string;
}
interface ObserveOptions {
    /** Only include elements matching this intent */
    intent?: string;
    /** Filter by role */
    role?: string;
    /** Max results */
    limit?: number;
}
/**
 * Observe the current page — return what actions are possible.
 * Does NOT execute anything. Returns descriptors for act().
 */
declare function observe(elements: Element[], options?: ObserveOptions): ActionDescriptor[];

/**
 * Extract — pull structured data from the page using schemas.
 * Inspired by Stagehand's extract() with Zod-like output typing.
 *
 * Unlike Stagehand (which uses an LLM to extract), this uses
 * CDP DOM queries + AX tree to extract data deterministically.
 * Claude interprets the result — we just provide structured data.
 */

interface ExtractField {
    /** CSS selector to find the element */
    selector?: string;
    /** AX role to match */
    role?: string;
    /** AX label pattern (substring match) */
    label?: string;
    /** What to extract: 'text' | 'value' | 'attribute' | 'html' */
    extract: 'text' | 'value' | 'attribute' | 'html' | 'exists';
    /** Attribute name (when extract === 'attribute') */
    attribute?: string;
}
interface ExtractSchema {
    [fieldName: string]: ExtractField;
}
interface ExtractResult {
    [fieldName: string]: string | boolean | null;
}
/**
 * Extract data from the AX tree based on a schema.
 * No DOM queries needed — works entirely from the accessibility tree.
 */
declare function extractFromAXTree(elements: Element[], schema: ExtractSchema): ExtractResult;
/**
 * Extract a list of items from repeated AX tree patterns.
 * Useful for tables, lists, cards — any repeated structure.
 */
declare function extractList(elements: Element[], options: {
    role?: string;
    labelPattern?: RegExp;
    maxItems?: number;
}): Array<{
    label: string;
    value: string | null;
    id: string;
}>;
/**
 * Extract page-level metadata from the AX tree.
 */
declare function extractPageMeta(elements: Element[]): {
    headings: string[];
    links: Array<{
        label: string;
        id: string;
    }>;
    inputs: Array<{
        label: string;
        value: string | null;
        id: string;
    }>;
    buttons: Array<{
        label: string;
        enabled: boolean;
        id: string;
    }>;
};

/**
 * Resolution cache — auto-caching for intent → element mappings.
 * Inspired by Stagehand's selector auto-caching.
 *
 * When an intent resolves to an element, cache the mapping.
 * Next time the same intent appears, replay the cached resolution
 * without re-querying the AX tree. If replay fails (element gone),
 * re-resolve and update the cache.
 *
 * Stagehand reports 3-5x speed improvement from caching.
 */
interface CachedResolution {
    /** The original intent string */
    intent: string;
    /** Matched element's backendDOMNodeId-based ID */
    elementId: string;
    /** Role of the matched element */
    role: string;
    /** Label of the matched element */
    label: string;
    /** Confidence of the original resolution */
    confidence: number;
    /** When this cache entry was created */
    createdAt: number;
    /** Number of successful cache hits */
    hits: number;
    /** Last successful hit time */
    lastHit: number;
}
interface CacheOptions {
    /** Max cache entries (default: 100) */
    maxEntries?: number;
    /** Cache entry TTL in ms (default: 5 minutes) */
    ttl?: number;
    /** Minimum confidence to cache (default: 0.7) */
    minConfidence?: number;
}
declare class ResolutionCache {
    private cache;
    private maxEntries;
    private ttl;
    private minConfidence;
    constructor(options?: CacheOptions);
    /**
     * Look up a cached resolution for an intent.
     * Returns the cached elementId if found and not expired, null otherwise.
     */
    get(intent: string): CachedResolution | null;
    /**
     * Cache a successful resolution.
     * Only caches if confidence meets threshold.
     */
    set(intent: string, elementId: string, metadata: {
        role: string;
        label: string;
        confidence: number;
    }): void;
    /**
     * Invalidate a specific cache entry (e.g., when element is gone).
     */
    invalidate(intent: string): void;
    /**
     * Clear all cache entries (e.g., after navigation).
     */
    clear(): void;
    /**
     * Get cache statistics.
     */
    stats(): {
        entries: number;
        totalHits: number;
        avgConfidence: number;
    };
    private normalizeKey;
    private evictOldest;
}

/**
 * Adaptive modality — Understanding Score calculator.
 * Inspired by V-GEMS (arxiv 2603.02626).
 *
 * Scores how well the AX tree captures the page's content.
 * High score → use AX tree only (fast, cheap).
 * Low score → include screenshot (accurate, expensive).
 *
 * Dimensions:
 * 1. Text Quality — do elements have meaningful labels?
 * 2. Semantic Relevance — are interactive elements well-labeled?
 * 3. Structural Clarity — is the AX tree well-organized?
 * 4. Special Case Penalties — known problematic patterns
 */

interface UnderstandingScore {
    /** Overall score 0-1. Below threshold → include screenshot. */
    score: number;
    /** Whether a screenshot is recommended */
    needsScreenshot: boolean;
    /** Breakdown of individual dimension scores */
    dimensions: {
        textQuality: number;
        semanticRelevance: number;
        structuralClarity: number;
        specialCasePenalty: number;
    };
    /** Human-readable reasoning */
    reasoning: string;
}
interface ModalityOptions {
    /** Score threshold below which screenshot is recommended (default: 0.6) */
    threshold?: number;
}
/**
 * Assess how well the AX tree captures the page content.
 * Returns a score and recommendation for whether to include a screenshot.
 */
declare function assessUnderstanding(elements: Element[], options?: ModalityOptions): UnderstandingScore;

/**
 * EngineDriver — high-level browser automation for LLM-driven UI validation.
 * Orchestrates CDP domains into a purpose-built API.
 */

interface CoverageReport {
    /** Elements captured by the AX tree */
    axTreeCount: number;
    /** Estimated visible elements in the DOM (not aria-hidden, has dimensions) */
    estimatedVisible: number;
    /** axTreeCount / estimatedVisible * 100, capped at 100 */
    coveragePercent: number;
    /** Elements found inside open shadow DOMs (invisible to AX tree) */
    shadowDomCount: number;
    /** Canvas elements on the page (completely opaque to AX tree) */
    canvasCount: number;
    /** Iframe elements on the page. As of E3-D, their content is descended
     *  into and merged into the AX snapshot — this count is informational,
     *  not an automatic gap (see `gaps` for any that stayed unreachable). */
    iframeCount: number;
    /** Elements recovered via shadow DOM piercing */
    recovered: number;
    /** Human-readable descriptions of coverage gaps */
    gaps: string[];
}
interface LaunchOptions extends BrowserOptions {
    viewport?: ViewportConfig;
}
type WaitStrategy = 'stable' | 'load' | 'none';
interface NavigateOptions {
    waitFor?: WaitStrategy;
    timeout?: number;
}
interface DiscoverOptions {
    /** Filter elements: 'interactive' (buttons, links, inputs), 'leaf' (user-facing), 'all' */
    filter?: 'interactive' | 'leaf' | 'all';
    /** Enable chunking for context window limits */
    chunk?: boolean;
    /** Max tokens budget for chunked output (approximate) */
    maxTokens?: number;
    /** Return compact serialized format instead of raw elements */
    serialize?: boolean;
}
interface FindOptions {
    role?: string;
}
interface FindDiagnostics {
    elementId: string | null;
    confidence: number;
    tier: number;
    tierName: string;
    alternatives: Array<{
        name: string;
        role: string;
        score: number;
    }>;
    totalInteractive: number;
    screenshot?: string;
    /**
     * Set when tier-4 (vision) detected an unambiguous top alternative and
     * promoted it to an element resolution. Callers can surface this so users
     * see WHICH alternative was chosen and at what score, instead of a silent
     * "did you mean?". See AUTO_RESOLVE_MIN_SCORE / AUTO_RESOLVE_MIN_MARGIN.
     */
    autoResolved?: {
        label: string;
        role: string;
        score: number;
        margin: number;
    };
}
interface CaptureStateOptions {
    computedStyles?: string[];
    includeAXTree?: boolean;
    includeScreenshot?: boolean;
}
interface CapturedState {
    domSnapshot?: CaptureSnapshotResult;
    axTree?: Element[];
    screenshot?: Buffer;
    url: string;
    timestamp: number;
}
declare class EngineDriver implements BrowserDriver {
    private browser;
    private conn;
    private target;
    private _page;
    private ax;
    private dom;
    private input;
    private runtime;
    private css;
    private snapshot;
    private emulation;
    private network;
    private console;
    private fetch;
    private targetId;
    private sessionId;
    private ownsTarget;
    private _currentUrl;
    private launched;
    private resolutionCache;
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
    private elementDescriptors;
    private static readonly MAX_DESCRIPTOR_HISTORY;
    private static readonly DESCRIPTOR_TRIM_TARGET;
    private frameElementBackendNodeIds;
    private frameElementSessions;
    private frameTagFor;
    private oopifSessions;
    private lastFrameCount;
    private lastFrameReached;
    private pendingDialog;
    private dialogWaiters;
    private unsubscribeDialogOpening;
    private unsubscribeDialogClosed;
    launch(options?: LaunchOptions): Promise<void>;
    /**
     * Wire Page.javascriptDialogOpening/Closed into `pendingDialog` +
     * `dialogWaiters` (E3-D). Idempotent — unsubscribes any prior
     * registration first, so re-launch/connectExisting never double-fires.
     */
    private setupDialogHandling;
    close(): Promise<void>;
    /**
     * Release the CDP WebSocket for this driver without terminating the browser.
     * Used by one-shot CLI commands that attach to a shared browser-server via
     * connectExisting() — they must detach from a supplied persisted target and
     * drop their WebSocket at the end of the command so the node process can
     * exit, while the browser-server and session tab remain alive.
     *
     * A target created without a supplied target ID is still owned by this
     * driver and is closed on disconnect. Does NOT call this.browser.close().
     */
    disconnect(): Promise<void>;
    /** Fulfill requests whose URL matches `pattern` (glob or RegExp) with `response` via CDP Fetch. */
    mock(pattern: string | RegExp, response: MockResponse): Promise<void>;
    /** Remove all network mocks and disable request interception. */
    clearMocks(): Promise<void>;
    get isLaunched(): boolean;
    navigate(url: string, options?: NavigateOptions): Promise<void>;
    get url(): string;
    /** BrowserDriver interface: currentUrl alias */
    get currentUrl(): string;
    /**
     * Discover elements on the page with filtering and chunking.
     * Designed for LLM context windows — returns only actionable elements.
     */
    discover(options?: DiscoverOptions): Promise<Element[] | string>;
    /**
     * 3-tier element resolution with auto-caching:
     * Tier 1: Check cache → Tier 2: queryAXTree → Tier 3: Jaro-Winkler → Tier 4: vision fallback.
     * Delegates to findWithDiagnostics() and returns the matched element or null.
     */
    find(name: string, options?: FindOptions): Promise<Element | null>;
    /**
     * Like find(), but returns rich diagnostics for agent error feedback.
     * Includes confidence, resolution tier, and fuzzy alternatives when not found.
     */
    findWithDiagnostics(name: string, options?: FindOptions): Promise<FindDiagnostics>;
    /** Record every element's {label, role} into the cross-snapshot history
     *  used for stale-elementId re-resolution (see elementDescriptors). */
    private recordDescriptors;
    /** Snapshot wrapper — every full-tree read goes through here so the
     *  stale-elementId re-resolution history stays warm. Behavior-identical
     *  to calling this.ax.getSnapshot() directly, PLUS (E3-D) elements from
     *  every iframe on the page, merged in. */
    private freshSnapshot;
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
    private probeBackendNode;
    /**
     * Re-resolve a stale element by its last-known label+role against a fresh
     * AX snapshot. This is what lets a re-rendering element (new
     * backendNodeId, same accessible name/role) stay actionable instead of
     * failing the moment its original elementId goes stale.
     */
    private reResolveByLabelRole;
    /**
     * Resolve an elementId already produced by find()/findWithDiagnostics()
     * against the LIVE page: a fresh snapshot may no longer contain that exact
     * id even though the element is still present (e.g. a re-render replaced
     * its backendNodeId between resolution and this call).
     * Falls back to the last-known {label, role} in elementDescriptors before
     * declaring the element gone.
     */
    resolveLiveElement(elementId: string): Promise<Element | null>;
    /**
     * Resolve an elementId to its {backendNodeId, sessionId} (E3-D). Frame-
     * sourced elements are checked first (this driver's own bookkeeping,
     * since AccessibilityDomain only ever knows about the main frame); falls
     * back to the main-frame nodeMap otherwise. Returns undefined when the
     * elementId is not currently known to either.
     */
    private resolveBackendRef;
    /**
     * resolveAndProbe closure for waitForActionable(): resolves elementId to
     * its current backend reference (re-resolving by name/role if the id has
     * gone stale), then probes it. Returns null when nothing currently
     * resolves — waitForActionable treats that as "not present" and keeps
     * polling.
     */
    private resolveElementActionability;
    /**
     * Wait until elementId (or its re-resolved replacement) is
     * present+visible+enabled+stable, then return the actionable backend
     * reference. Throws a descriptive error on timeout — never silently
     * proceeds to act on a non-actionable element.
     */
    private awaitActionable;
    private tagForFrame;
    private flattenChildFrames;
    /**
     * Convert raw CDP AX nodes (from a frame's own getFullAXTree call) into
     * Element[], tagging each id with `frameTag` so it can never collide with
     * a main-frame or sibling-frame backendDOMNodeId (backend node ids are
     * only unique WITHIN a render process). Records each into
     * frameElementBackendNodeIds/frameElementSessions so click()/awaitActionable
     * can resolve and act on them later.
     */
    private convertFrameAXNodes;
    /** Elements from every iframe on the page — see the "Frames (E3-D)"
     *  section comment above for the two-path strategy. */
    private getFrameElements;
    /**
     * Best-effort OOPIF path: discover 'iframe'-type CDP targets, match each
     * to an unresolved frame by URL, attach (cached by targetId across
     * snapshots), and fetch its AX tree via that target's own session.
     */
    private getOopifFrameElements;
    /**
     * Dispatch a left click at (x, y) on the given session. `this.input` (the
     * InputDomain instance) is permanently bound to the driver's MAIN
     * session, so it cannot dispatch on an OOPIF's session — when
     * `sessionId` names a different session, issue the raw
     * Input.dispatchMouseEvent pair directly (same pattern as rightClick()
     * below) instead of routing through `this.input`.
     */
    private dispatchClickAt;
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
    private raceAgainstDialog;
    /**
     * The currently-open JS dialog (alert/confirm/prompt/beforeunload), if
     * any. Poll this (or await waitForDialog()) instead of letting a
     * triggering action hang indefinitely — see raceAgainstDialog().
     */
    getPendingDialog(): JSDialogInfo | null;
    /**
     * Answer the currently-open JS dialog. `accept` maps to OK/Cancel;
     * `promptText` is only meaningful for `type: 'prompt'` dialogs. Throws if
     * no dialog is currently open.
     */
    handleDialog(accept: boolean, promptText?: string): Promise<void>;
    /**
     * Wait until a JS dialog opens (or the timeout elapses). Useful when a
     * dialog may be triggered by an action whose own promise won't settle
     * until the dialog is answered (see raceAgainstDialog()) — callers that
     * fired such an action without awaiting it can await this instead.
     */
    waitForDialog(timeout?: number): Promise<JSDialogInfo>;
    click(elementId: string): Promise<void>;
    type(elementId: string, text: string): Promise<void>;
    fill(elementId: string, value: string): Promise<void>;
    hover(elementId: string): Promise<void>;
    pressKey(key: string): Promise<void>;
    scroll(deltaY: number, x?: number, y?: number): Promise<void>;
    /**
     * Before/after state capture around an action.
     * Returns element diff and pixel diff.
     */
    actAndCapture(action: () => Promise<void>): Promise<{
        before: {
            elements: Element[];
            screenshot: Buffer;
        };
        after: {
            elements: Element[];
            screenshot: Buffer;
        };
        diff: {
            addedElements: Element[];
            removedElements: Element[];
            pixelDiff: number;
        };
    }>;
    /**
     * Set a <select> element's value and dispatch change event.
     */
    select(elementId: string, value: string): Promise<void>;
    /**
     * Toggle a checkbox element.
     */
    check(elementId: string): Promise<void>;
    /**
     * Double-click an element.
     */
    doubleClick(elementId: string): Promise<void>;
    /**
     * Right-click an element (opens context menu).
     */
    rightClick(elementId: string): Promise<void>;
    /**
     * Wait until an element with the given name (and optional role) appears in the AX tree.
     * Polls at 200ms intervals. Throws on timeout.
     */
    waitForElement(name: string, options?: {
        role?: string;
        timeout?: number;
    }): Promise<Element>;
    screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    screenshotElement(elementId: string): Promise<Buffer>;
    /**
     * One-call page state capture — combines DOMSnapshot, AX tree, and screenshot.
     */
    captureState(options?: CaptureStateOptions): Promise<CapturedState>;
    /** Get AX tree snapshot. */
    getSnapshot(): Promise<Element[]>;
    /**
     * Evaluate a JavaScript expression in the page context.
     */
    evaluate(expression: string): Promise<unknown>;
    /**
     * Call a function with arguments in the page context.
     * Equivalent to Playwright's page.evaluate(fn, ...args).
     */
    evaluate(fn: string, ...args: unknown[]): Promise<unknown>;
    /**
     * Evaluate with DevTools' `includeCommandLineAPI` enabled — see
     * RuntimeDomain.evaluateWithCommandLineAPI. Used for real listener
     * detection (getEventListeners), not needed by ordinary callers.
     */
    evaluateWithCommandLineAPI(expression: string): Promise<unknown>;
    querySelector(selector: string): Promise<number | null>;
    querySelectorAll(selector: string): Promise<number[]>;
    getOuterHTML(nodeId: number): Promise<string>;
    getAttributes(nodeId: number): Promise<Record<string, string>>;
    getComputedStyle(nodeId: number, properties?: string[]): Promise<Record<string, string>>;
    addStyleTag(css: string): Promise<void>;
    setViewport(config: ViewportConfig): Promise<void>;
    clearViewport(): Promise<void>;
    getCookies(urls?: string[]): Promise<Cookie[]>;
    setCookies(cookies: SetCookieParams[]): Promise<void>;
    clearCookies(): Promise<void>;
    getConsoleMessages(): ConsoleMessage[];
    getConsoleErrors(): ConsoleMessage[];
    clearConsole(): void;
    content(): Promise<string>;
    title(): Promise<string>;
    textContent(selector: string): Promise<string | null>;
    getAttribute(selector: string, attribute: string): Promise<string | null>;
    /**
     * Preview what actions are possible without executing.
     * Returns serializable descriptors for act().
     */
    observe(options?: ObserveOptions): Promise<ActionDescriptor[]>;
    /**
     * Extract structured data from AX tree using a schema.
     */
    extract(schema: ExtractSchema): Promise<ExtractResult>;
    /**
     * Extract a list of repeated elements.
     */
    extractItems(options: {
        role?: string;
        labelPattern?: RegExp;
        maxItems?: number;
    }): Promise<Array<{
        label: string;
        value: string | null;
        id: string;
    }>>;
    /**
     * Extract page-level metadata (headings, links, inputs, buttons).
     */
    extractMeta(): Promise<ReturnType<typeof extractPageMeta>>;
    /**
     * Assess how well the AX tree captures the page.
     * Returns a score and whether a screenshot is recommended.
     */
    assessUnderstanding(options?: ModalityOptions): Promise<UnderstandingScore>;
    /**
     * Report AX tree coverage against estimated visible DOM elements.
     * Surfaces blind spots: shadow DOM, canvas, iframes.
     */
    getCoverage(): Promise<CoverageReport>;
    /** Get resolution cache statistics. */
    get cacheStats(): ReturnType<ResolutionCache['stats']>;
    /** Configure the resolution cache. */
    configureCache(options: CacheOptions): void;
    get page(): PageDomain;
    get accessibility(): AccessibilityDomain;
    get domDomain(): DomDomain;
    get runtimeDomain(): RuntimeDomain;
    get cssDomain(): CssDomain;
    get snapshotDomain(): SnapshotDomain;
    get emulationDomain(): EmulationDomain;
    get networkDomain(): NetworkDomain;
    get consoleDomain(): ConsoleDomain;
    get connection(): CdpConnection;
    /** The CDP debug port Chrome is listening on. Only valid after launch(). */
    get debugPort(): number;
    /** The OS PID of the Chrome process. Only valid after launch(). Null when connected to existing. */
    get chromePid(): number | null;
    /** The browser connection mode used for this driver. */
    get browserMode(): BrowserMode;
    /** The resolved CDP HTTP endpoint, when available. */
    get cdpUrl(): string | null;
    /** The resolved browser WebSocket endpoint, when available. */
    get wsEndpoint(): string | null;
    /** Current CDP page target. Persist this to reattach without navigating. */
    get pageTargetId(): string | null;
    /**
     * Connect to an already-running Chrome instance instead of launching a new one.
     * Used by browser-server reconnection to attach to a persistent Chrome process.
     */
    connectExisting(wsUrl: string, targetId?: string): Promise<void>;
}

/**
 * CDP Target domain — tab/target lifecycle management.
 * Forked from Spectra.
 */

declare class TargetDomain {
    private conn;
    constructor(conn: CdpConnection);
    createPage(url: string): Promise<string>;
    attach(targetId: string): Promise<string>;
    close(targetId: string): Promise<void>;
    list(): Promise<Array<{
        targetId: string;
        type: string;
        url: string;
    }>>;
    /**
     * Full `Target.getTargets` payload including `title` and `attached`.
     * `list()` narrows those away; attaching to an already-running app (see
     * `src/live/`) needs the title to pick the right window. Additive — existing
     * callers of `list()` are untouched.
     */
    listDetailed(): Promise<TargetInfo[]>;
    /**
     * Release a session created by `attach()` without closing the target.
     * Required when auditing a live app: the page must survive detach.
     */
    detach(sessionId: string): Promise<void>;
}
interface TargetInfo {
    targetId: string;
    type: string;
    title: string;
    url: string;
    attached: boolean;
    browserContextId?: string;
}

/**
 * CDP Input domain — mouse, keyboard, and scroll simulation.
 * Forked from Spectra — extended with special key support.
 */

declare class InputDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    click(x: number, y: number): Promise<void>;
    type(text: string): Promise<void>;
    /**
     * Press a special key (Enter, Tab, Escape, Backspace, etc.) or a modifier
     * chord ("Meta+k", "Cmd+K", "Ctrl+Shift+P", ...).
     */
    pressKey(key: string): Promise<void>;
    /**
     * Dispatch a real modifier chord: press each modifier down (in order,
     * accumulating the CDP `modifiers` bitmask), then keyDown/keyUp the target
     * key while the modifiers are held, then release the modifiers in reverse
     * order. No `text` is sent for the target key — a chord synthesizes a
     * shortcut, it must never insert literal characters into a focused field.
     */
    private dispatchChord;
    hover(x: number, y: number): Promise<void>;
    scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void>;
}

/**
 * Wait strategies — event-driven + polling hybrid.
 * Forked from Spectra — extended with event-driven waits and MutationObserver.
 */

interface WaitOptions {
    interval?: number;
    stableTime?: number;
    timeout?: number;
}
type SnapshotFn = () => Promise<Element[]>;
declare function buildFingerprint(elements: Element[]): string;
/**
 * Poll-based stability detection (from Spectra).
 * Waits until AX tree fingerprint stops changing.
 */
declare function waitForStableTree(getSnapshot: SnapshotFn, options?: WaitOptions): Promise<{
    elements: Element[];
    timedOut: boolean;
}>;
/**
 * Event-driven wait — listens to CDP events and resolves when condition is met.
 * Combines event notification (coarse: something changed) with
 * fingerprint stability check (fine: it stopped changing).
 */
declare function waitForEvent(conn: CdpConnection, eventName: string, options?: {
    timeout?: number;
}): Promise<void>;
/**
 * Hybrid wait — subscribe to AX events, then confirm with stability check.
 * Best of both: events for notification, polling for confirmation.
 */
declare function waitForStable(conn: CdpConnection, getSnapshot: SnapshotFn, options?: WaitOptions & {
    eventName?: string;
}): Promise<{
    elements: Element[];
    timedOut: boolean;
}>;

/**
 * Normalize raw accessibility roles to canonical names.
 * Forked from Spectra.
 */

declare function normalizeRole(rawRole: string, platform: Platform): string;

/**
 * Compact serialization of AX tree data for LLM context windows.
 * Forked from Spectra.
 */

declare function serializeSnapshot(snapshot: Snapshot): string;
declare function serializeElement(el: Element): string;

/**
 * 3-tier element resolution: queryAXTree → Jaro-Winkler → vision fallback.
 * Forked from Spectra — extended with queryAXTree-first tier.
 */

declare function resolve(options: ResolveOptions): ResolveResult;
interface SpatialHints {
    position?: 'first' | 'last' | 'top' | 'bottom';
    near?: string;
}
declare function parseSpatialHints(intent: string): SpatialHints;
declare function jaroWinkler(s1: string, s2: string): number;

/**
 * Playwright compatibility adapter.
 *
 * Provides a Page-like interface backed by EngineDriver's CDP.
 * This allows incremental migration — existing IBR modules can use
 * this adapter without being rewritten, while new code uses EngineDriver directly.
 *
 * NOT a full Playwright reimplementation. Only covers the subset IBR actually uses:
 * - page.evaluate(fn, args) / page.evaluate(expression)
 * - page.$(selector) / page.$$(selector)
 * - page.goto(url, options)
 * - page.screenshot(options)
 * - page.addStyleTag({ content })
 * - page.waitForSelector(selector, options)
 * - page.waitForTimeout(ms)
 * - page.content() / page.title() / page.textContent(selector)
 * - page.getAttribute(selector, attr)
 * - page.click(selector) / page.fill(selector, value)
 * - page.on('console', handler)
 * - page.keyboard.press(key)
 * - page.locator(selector)
 */

/**
 * Element handle returned by $() and $$()
 */
declare class CompatElementHandle {
    private driver;
    private nodeId;
    constructor(driver: EngineDriver, nodeId: number);
    screenshot(options?: {
        path?: string;
        type?: string;
    }): Promise<Buffer>;
    textContent(): Promise<string | null>;
    boundingBox(): Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>;
    getAttribute(name: string): Promise<string | null>;
}
/**
 * Minimal locator compatible with IBR's usage patterns.
 */
declare class CompatLocator {
    private driver;
    private selector;
    visible: boolean;
    constructor(driver: EngineDriver, selector: string);
    filter(options: {
        visible?: boolean;
    }): CompatLocator;
    first(): CompatLocator;
    click(_options?: {
        timeout?: number;
        force?: boolean;
    }): Promise<void>;
    fill(text: string, _options?: {
        timeout?: number;
    }): Promise<void>;
    focus(_options?: {
        timeout?: number;
    }): Promise<void>;
    press(key: string, _options?: {
        timeout?: number;
    }): Promise<void>;
    pressSequentially(text: string, _options?: {
        delay?: number;
        timeout?: number;
    }): Promise<void>;
    /**
     * Choose an option in a <select>, returning the values that ended up selected.
     *
     * A native select cannot be driven by click: its option list is painted by the
     * OS rather than the page, so there is no option node in the DOM to click. The
     * value is set directly and input+change are dispatched, matching `fill`, so
     * React and other frameworks observe the change through their normal path.
     */
    selectOption(spec: {
        value?: string;
        label?: string;
        index?: number;
    }, _options?: {
        timeout?: number;
    }): Promise<string[]>;
    /** Every option on the target select, as "value (label)", for error messages. */
    listOptions(): Promise<string[]>;
    waitFor(options?: {
        state?: string;
        timeout?: number;
    }): Promise<void>;
}
type ConsoleHandler = (msg: {
    type: () => string;
    text: () => string;
}) => void;
/**
 * Playwright-compatible Page interface backed by EngineDriver.
 */
declare class CompatPage {
    private driver;
    private consoleHandlers;
    private consoleListening;
    constructor(driver: EngineDriver);
    goto(url: string, options?: {
        waitUntil?: string;
        timeout?: number;
    }): Promise<void>;
    evaluate<T>(fnOrExpr: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
    /**
     * PageLike's optional command-line-API evaluate — see page-like.ts. Backed
     * by IBR's own CDP engine (Runtime.evaluate with includeCommandLineAPI),
     * so this is real here; other PageLike implementations (Playwright, a
     * future WebKit driver) simply don't define this method and callers
     * degrade to static handler detection.
     */
    evaluateWithCommandLineAPI(expression: string): Promise<unknown>;
    $(selector: string): Promise<CompatElementHandle | null>;
    $$(selector: string): Promise<CompatElementHandle[]>;
    screenshot(options?: {
        path?: string;
        fullPage?: boolean;
        type?: string;
    }): Promise<Buffer>;
    addStyleTag(options: {
        content: string;
    }): Promise<void>;
    waitForSelector(selector: string, options?: {
        timeout?: number;
    }): Promise<CompatElementHandle | null>;
    waitForTimeout(ms: number): Promise<void>;
    waitForLoadState(_state?: string, _options?: {
        timeout?: number;
    }): Promise<void>;
    waitForNavigation(): Promise<void>;
    /**
     * Wait for a response matching `urlOrPredicate` (substring, RegExp, or a
     * `(url, status) => boolean` predicate). Resolves with `{url, status}` the
     * moment a matching `Network.responseReceived` CDP event fires — real
     * network awareness (E3-B), not a fixed sleep or polling guess. New API
     * surface; no existing caller to preserve compatibility with.
     */
    waitForResponse(urlOrPredicate: string | RegExp | ((url: string, status: number) => boolean), options?: {
        timeout?: number;
    }): Promise<{
        url: string;
        status: number;
    }>;
    content(): Promise<string>;
    title(): Promise<string>;
    textContent(selector: string): Promise<string | null>;
    innerText(selector: string): Promise<string>;
    getAttribute(selector: string, name: string): Promise<string | null>;
    click(selector: string, _options?: {
        timeout?: number;
    }): Promise<void>;
    fill(selector: string, value: string): Promise<void>;
    type(selector: string, text: string, _options?: {
        delay?: number;
    }): Promise<void>;
    check(selector: string): Promise<void>;
    uncheck(selector: string): Promise<void>;
    selectOption(selector: string, value: string): Promise<void>;
    hover(selector: string, _options?: {
        timeout?: number;
    }): Promise<void>;
    locator(selector: string): CompatLocator;
    on(event: string, handler: ConsoleHandler): void;
    url(): string;
    keyboard: {
        press: (key: string) => Promise<void>;
    };
}

export { AccessibilityDomain, type ActResult, type Action, type ActionDescriptor, type ActionType, type BrowserConnectionOptions, BrowserManager, type BrowserMode, type BrowserOptions, CHROME_PATHS, type CSSComputedStyleProperty, type CacheOptions, type CachedResolution, type CaptureSnapshotOptions, type CaptureSnapshotResult, type CaptureStateOptions, type CapturedState, type CdpAXNode, CdpConnection, CompatElementHandle, CompatLocator, CompatPage, ConsoleDomain, type ConsoleLevel, type ConsoleMessage, type Cookie, CssDomain, type DiscoverOptions, type DocumentSnapshot, DomDomain, type Element, EmulationDomain, EngineDriver, type ExtractField, type ExtractResult, type ExtractSchema, type FindDiagnostics, type FindOptions, InputDomain, type LaunchOptions, type LayoutMetrics, type ModalityOptions, type NavigateOptions, NetworkDomain, type ObserveOptions, PageDomain, type Platform, ResolutionCache, type ResolveOptions, type ResolveResult, RuntimeDomain, type ScreenshotOptions, type SetCookieParams, type Snapshot, SnapshotDomain, type SnapshotMetadata, type SpatialHints, TargetDomain, type UnderstandingScore, type ViewportConfig, type WaitOptions, type WaitStrategy, assessUnderstanding, buildFingerprint, extractFromAXTree, extractList, extractPageMeta, findChrome, jaroWinkler, normalizeRole, observe, parseSpatialHints, resolve, serializeElement, serializeSnapshot, waitForEvent, waitForStable, waitForStableTree };
