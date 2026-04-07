import { z } from 'zod';

/**
 * PageLike — structural interface that both Playwright's Page and CompatPage satisfy.
 * Use this as the parameter type in functions that need to work with either.
 */
interface ElementHandleLike {
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
    getAttribute?(name: string): Promise<string | null>;
    click?(options?: any): Promise<void>;
    fill?(value: string, options?: any): Promise<void>;
    check?(options?: any): Promise<void>;
    uncheck?(options?: any): Promise<void>;
    selectOption?(value: string | string[], options?: any): Promise<any>;
    press?(key: string, options?: any): Promise<void>;
    focus?(options?: any): Promise<void>;
    type?(text: string, options?: any): Promise<void>;
}
interface LocatorLike {
    filter(options: {
        visible?: boolean;
    }): LocatorLike;
    first(): LocatorLike;
    click(options?: {
        timeout?: number;
        force?: boolean;
    }): Promise<void>;
    fill(text: string, options?: {
        timeout?: number;
    }): Promise<void>;
    focus(options?: {
        timeout?: number;
    }): Promise<void>;
    press(key: string, options?: {
        timeout?: number;
    }): Promise<void>;
    pressSequentially(text: string, options?: {
        delay?: number;
        timeout?: number;
    }): Promise<void>;
    waitFor(options?: {
        state?: string;
        timeout?: number;
    }): Promise<void>;
}
interface PageLike {
    goto(url: string, options?: {
        waitUntil?: string;
        timeout?: number;
    }): Promise<any>;
    evaluate(fn: any, ...args: any[]): Promise<any>;
    $(selector: string): Promise<ElementHandleLike | null>;
    $$(selector: string): Promise<ElementHandleLike[]>;
    screenshot(options?: {
        path?: string;
        fullPage?: boolean;
        type?: string;
    }): Promise<Buffer>;
    addStyleTag(options: {
        content: string;
    }): Promise<any>;
    waitForSelector(selector: string, options?: {
        timeout?: number;
    }): Promise<ElementHandleLike | null>;
    waitForTimeout(ms: number): Promise<void>;
    content(): Promise<string>;
    title(): Promise<string>;
    textContent(selector: string): Promise<string | null>;
    getAttribute?(selector: string, name: string): Promise<string | null>;
    click?(selector: string, options?: {
        timeout?: number;
    }): Promise<void>;
    fill?(selector: string, value: string): Promise<void>;
    type?(selector: string, text: string, options?: {
        delay?: number;
    }): Promise<void>;
    hover?(selector: string, options?: {
        timeout?: number;
    }): Promise<void>;
    check?(selector: string): Promise<void>;
    uncheck?(selector: string): Promise<void>;
    selectOption?(selector: string, value: string): Promise<any>;
    locator?(selector: string): LocatorLike;
    on?(event: string, handler: any): void;
    off?(event: string, handler: any): void;
    url?(): string;
    keyboard?: {
        press(key: string): Promise<void>;
    };
    innerText?(selector: string): Promise<string>;
    waitForNavigation?(): Promise<any>;
    waitForLoadState?(state?: string, options?: {
        timeout?: number;
    }): Promise<void>;
}

type Page = PageLike & {
    on(event: string, handler: any): void;
    off?(event: string, handler: any): void;
};
/**
 * API request timing info
 */
interface ApiRequestTiming {
    url: string;
    method: string;
    duration: number;
    status: number;
    size: number;
    resourceType: string;
    timing: {
        dnsLookup?: number;
        tcpConnect?: number;
        tlsHandshake?: number;
        requestSent?: number;
        waiting?: number;
        contentDownload?: number;
    };
}
/**
 * API timing measurement result
 */
interface ApiTimingResult {
    requests: ApiRequestTiming[];
    summary: {
        totalRequests: number;
        totalTime: number;
        totalSize: number;
        averageTime: number;
        slowestRequest: {
            url: string;
            duration: number;
        } | null;
        fastestRequest: {
            url: string;
            duration: number;
        } | null;
        failedRequests: number;
        byStatus: Record<number, number>;
    };
}
/**
 * Options for API timing measurement
 */
interface ApiTimingOptions {
    /** Filter to only track URLs matching this pattern */
    filter?: RegExp;
    /** Include static resources (images, fonts, etc.) */
    includeStatic?: boolean;
    /** Timeout to wait for requests to complete (ms) */
    timeout?: number;
    /** Minimum duration to report (ms) - filters out fast requests */
    minDuration?: number;
}
/**
 * Measure API/network request timing on a page
 *
 * Call this before navigating to the page, then call stopMeasuring after navigation
 */
declare function measureApiTiming(page: Page, options?: ApiTimingOptions): Promise<ApiTimingResult>;
/**
 * Create an API timing tracker that records during page interactions
 */
declare function createApiTracker(page: Page, options?: ApiTimingOptions): {
    start(): void;
    stop(): ApiTimingResult;
    getRequests(): ApiRequestTiming[];
};
/**
 * Format API timing result for console output
 */
declare function formatApiTimingResult(result: ApiTimingResult): string;

/**
 * Interactive element info
 */
interface InteractiveElement {
    selector: string;
    tagName: string;
    type?: string;
    text?: string;
    hasHandler: boolean;
    isDisabled: boolean;
    isVisible: boolean;
    a11y: {
        role?: string;
        ariaLabel?: string;
        tabIndex?: number;
    };
}
/**
 * Button analysis result
 */
interface ButtonInfo extends InteractiveElement {
    buttonType?: 'submit' | 'button' | 'reset';
    formId?: string;
}
/**
 * Link analysis result
 */
interface LinkInfo extends InteractiveElement {
    href: string;
    isPlaceholder: boolean;
    opensNewTab: boolean;
    isExternal: boolean;
}
/**
 * Form analysis result
 */
interface FormInfo {
    selector: string;
    action?: string;
    method?: string;
    hasSubmitHandler: boolean;
    fields: FormFieldInfo[];
    hasValidation: boolean;
    submitButton?: ButtonInfo;
}
/**
 * Form field info
 */
interface FormFieldInfo {
    selector: string;
    name?: string;
    type: string;
    label?: string;
    required: boolean;
    hasValidation: boolean;
}
/**
 * Interactivity issue
 */
interface InteractivityIssue {
    type: 'NO_HANDLER' | 'PLACEHOLDER_LINK' | 'MISSING_LABEL' | 'DISABLED_NO_VISUAL' | 'SMALL_TOUCH_TARGET' | 'FORM_NO_SUBMIT' | 'ORPHAN_SUBMIT' | 'NO_KEYBOARD_ACCESS';
    element: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
}
/**
 * Full interactivity test result
 */
interface InteractivityResult {
    buttons: ButtonInfo[];
    links: LinkInfo[];
    forms: FormInfo[];
    issues: InteractivityIssue[];
    summary: {
        totalInteractive: number;
        withHandlers: number;
        withoutHandlers: number;
        issueCount: {
            error: number;
            warning: number;
            info: number;
        };
    };
}
/**
 * Test interactivity of all interactive elements on a page
 */
declare function testInteractivity(page: PageLike): Promise<InteractivityResult>;
/**
 * Format interactivity result for console output
 */
declare function formatInteractivityResult(result: InteractivityResult): string;

/**
 * Web Vitals metrics
 * @see https://web.dev/vitals/
 */
interface WebVitals {
    /** Largest Contentful Paint (ms) - loading performance */
    LCP: number | null;
    /** First Input Delay (ms) - interactivity (requires user interaction) */
    FID: number | null;
    /** Cumulative Layout Shift (score) - visual stability */
    CLS: number | null;
    /** Time to First Byte (ms) - server response time */
    TTFB: number | null;
    /** First Contentful Paint (ms) - initial render */
    FCP: number | null;
    /** Time to Interactive (ms) - when page becomes fully interactive */
    TTI: number | null;
}
/**
 * Performance thresholds for each metric
 * Based on Core Web Vitals guidelines
 */
declare const PERFORMANCE_THRESHOLDS: {
    LCP: {
        good: number;
        poor: number;
    };
    FID: {
        good: number;
        poor: number;
    };
    CLS: {
        good: number;
        poor: number;
    };
    TTFB: {
        good: number;
        poor: number;
    };
    FCP: {
        good: number;
        poor: number;
    };
    TTI: {
        good: number;
        poor: number;
    };
};
/**
 * Performance rating
 */
type PerformanceRating = 'good' | 'needs-improvement' | 'poor';
/**
 * Rated metric with value and rating
 */
interface RatedMetric {
    value: number | null;
    rating: PerformanceRating | null;
}
/**
 * Full performance result with ratings
 */
interface PerformanceResult {
    metrics: WebVitals;
    ratings: Record<keyof WebVitals, RatedMetric>;
    summary: {
        overallRating: PerformanceRating;
        passedVitals: number;
        totalVitals: number;
        issues: string[];
        recommendations: string[];
    };
}
/**
 * Measure Core Web Vitals from a page
 *
 * Note: FID requires actual user interaction, so it will be null
 * for automated tests. Use TTI as an alternative measure.
 */
declare function measureWebVitals(page: PageLike): Promise<WebVitals>;
/**
 * Measure performance and return rated results
 */
declare function measurePerformance(page: PageLike): Promise<PerformanceResult>;
/**
 * Format performance result for console output
 */
declare function formatPerformanceResult(result: PerformanceResult): string;

/**
 * Flow Types
 *
 * Common types used across all built-in flows.
 */

interface FlowStep {
    action: string;
    success: boolean;
    duration?: number;
    error?: string;
}
interface FlowResult {
    success: boolean;
    steps: FlowStep[];
    error?: string;
    /** Time taken in ms */
    duration: number;
}
interface FlowOptions {
    /** Timeout for the entire flow in ms */
    timeout?: number;
    /** Whether to take screenshots at each step */
    debug?: boolean;
}
/**
 * Find a form field by common label patterns
 */
declare function findFieldByLabel(page: PageLike, labels: string[]): Promise<ReturnType<PageLike['$']>>;
/**
 * Find a button by common patterns
 */
declare function findButton(page: PageLike, patterns: string[]): Promise<ReturnType<PageLike['$']>>;
/**
 * Wait for navigation or network idle
 */
declare function waitForNavigation(page: PageLike, timeout?: number): Promise<void>;
/**
 * Screenshot captured at a specific step during search flow
 */
interface StepScreenshot {
    /** Which step this screenshot was taken at */
    step: 'before' | 'after-query' | 'loading' | 'results';
    /** Path to the screenshot file */
    path: string;
    /** ISO timestamp when captured */
    timestamp: string;
    /** Milliseconds since flow start */
    timing: number;
}
/**
 * Extracted content from a single search result element
 */
interface ExtractedResult {
    /** Zero-based index in result list */
    index: number;
    /** Title text if identifiable */
    title?: string;
    /** Snippet/description text if present */
    snippet?: string;
    /** Full text content of the result element */
    fullText: string;
    /** CSS selector to locate this element */
    selector: string;
    /** Whether the element is visible in viewport */
    visible: boolean;
}
/**
 * Timing breakdown for search flow phases
 */
interface SearchTiming {
    /** Total flow duration in ms */
    total: number;
    /** Time spent typing the query */
    typing: number;
    /** Time waiting for results to load */
    waiting: number;
    /** Time for results to render after load */
    rendering: number;
}
/**
 * Extended options for AI search testing
 */
interface AISearchOptions extends FlowOptions {
    /** Search query to execute */
    query: string;
    /** CSS selector for search results container */
    resultsSelector?: string;
    /** Whether to submit the form or just type (for autocomplete) */
    submit?: boolean;
    /** Capture screenshots at each step (default: true) */
    captureSteps?: boolean;
    /** Extract text content from results (default: true) */
    extractContent?: boolean;
    /** User's intent for validation (what they expect to find) */
    userIntent?: string;
    /** Session directory for storing screenshots */
    sessionDir?: string;
}
/**
 * Extended result from AI search flow with full context for validation
 */
interface AISearchResult extends FlowResult {
    /** The search query that was executed */
    query: string;
    /** User's stated intent for validation */
    userIntent?: string;
    /** Number of results found */
    resultCount: number;
    /** Whether any results were found */
    hasResults: boolean;
    /** Timing breakdown for each phase */
    timing: SearchTiming;
    /** Screenshots captured at each step */
    screenshots: StepScreenshot[];
    /** Extracted content from result elements */
    extractedResults: ExtractedResult[];
    /** Directory where search artifacts are stored */
    artifactDir?: string;
}

/**
 * Form Submit Flow
 *
 * Handles generic form submission with field detection.
 */

interface FormField {
    /** Field name or label to search for */
    name: string;
    /** Value to fill */
    value: string;
    /** Field type (defaults to 'text') */
    type?: 'text' | 'select' | 'checkbox' | 'radio' | 'textarea';
}
interface FlowFormOptions extends FlowOptions {
    /** Fields to fill */
    fields: FormField[];
    /** Button text to click (defaults to 'submit') */
    submitButton?: string;
    /** Selector for success message */
    successSelector?: string;
}
interface FormResult extends FlowResult {
    /** Which fields were successfully filled */
    filledFields: string[];
    /** Which fields failed */
    failedFields: string[];
}
/**
 * Execute form submission flow
 */
declare function formFlow(page: PageLike, options: FlowFormOptions): Promise<FormResult>;

/**
 * Search Flow
 *
 * Handles common search patterns with result detection.
 * Includes AI-powered search testing with step screenshots and content extraction.
 */

interface FlowSearchOptions extends FlowOptions {
    /** Search query */
    query: string;
    /** Selector for search results container */
    resultsSelector?: string;
    /** Whether to submit the form or just type (for autocomplete) */
    submit?: boolean;
}
interface SearchResult extends FlowResult {
    /** Number of results found */
    resultCount: number;
    /** Whether results were found */
    hasResults: boolean;
}
/**
 * Execute search flow
 */
declare function searchFlow(page: PageLike, options: FlowSearchOptions): Promise<SearchResult>;
/**
 * Execute AI-enhanced search flow with screenshots and content extraction
 *
 * This function extends the basic search flow with:
 * - Step-by-step screenshots (before, after-query, results)
 * - Detailed timing breakdown
 * - Extraction of result content for AI validation
 * - User intent tracking for relevance checking
 */
declare function aiSearchFlow(page: PageLike, options: AISearchOptions): Promise<AISearchResult>;

/**
 * Login Flow
 *
 * Handles common login patterns with semantic field detection.
 */

interface FlowLoginOptions extends FlowOptions {
    /** Email or username */
    email: string;
    /** Password */
    password: string;
    /** What indicates successful login (intent like 'dashboard' or selector) */
    successIndicator?: string;
    /** Whether to check "remember me" if present */
    rememberMe?: boolean;
}
interface LoginResult extends FlowResult {
    /** Whether user is now authenticated */
    authenticated: boolean;
    /** Detected username after login */
    username?: string;
}
/**
 * Execute login flow
 */
declare function loginFlow(page: PageLike, options: FlowLoginOptions): Promise<LoginResult>;

/**
 * Viewport configuration for screenshot capture
 * Supports predefined names or custom dimensions
 */
declare const ViewportSchema: z.ZodObject<{
    name: z.ZodString;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    width: number;
    height: number;
}, {
    name: string;
    width: number;
    height: number;
}>;
/**
 * Predefined viewport configurations
 */
declare const VIEWPORTS: {
    readonly desktop: {
        readonly name: "desktop";
        readonly width: 1920;
        readonly height: 1080;
    };
    readonly 'desktop-lg': {
        readonly name: "desktop-lg";
        readonly width: 2560;
        readonly height: 1440;
    };
    readonly 'desktop-sm': {
        readonly name: "desktop-sm";
        readonly width: 1440;
        readonly height: 900;
    };
    readonly laptop: {
        readonly name: "laptop";
        readonly width: 1366;
        readonly height: 768;
    };
    readonly tablet: {
        readonly name: "tablet";
        readonly width: 768;
        readonly height: 1024;
    };
    readonly 'tablet-landscape': {
        readonly name: "tablet-landscape";
        readonly width: 1024;
        readonly height: 768;
    };
    readonly mobile: {
        readonly name: "mobile";
        readonly width: 375;
        readonly height: 667;
    };
    readonly 'mobile-lg': {
        readonly name: "mobile-lg";
        readonly width: 414;
        readonly height: 896;
    };
    readonly 'iphone-14': {
        readonly name: "iphone-14";
        readonly width: 390;
        readonly height: 844;
    };
    readonly 'iphone-14-pro-max': {
        readonly name: "iphone-14-pro-max";
        readonly width: 430;
        readonly height: 932;
    };
    readonly 'iphone-16': {
        readonly name: "iphone-16";
        readonly width: 393;
        readonly height: 852;
    };
    readonly 'iphone-16-plus': {
        readonly name: "iphone-16-plus";
        readonly width: 430;
        readonly height: 932;
    };
    readonly 'iphone-16-pro': {
        readonly name: "iphone-16-pro";
        readonly width: 402;
        readonly height: 874;
    };
    readonly 'iphone-16-pro-max': {
        readonly name: "iphone-16-pro-max";
        readonly width: 440;
        readonly height: 956;
    };
    readonly 'watch-series-10-42mm': {
        readonly name: "watch-series-10-42mm";
        readonly width: 176;
        readonly height: 215;
    };
    readonly 'watch-series-10-46mm': {
        readonly name: "watch-series-10-46mm";
        readonly width: 198;
        readonly height: 242;
    };
    readonly 'watch-ultra-2-49mm': {
        readonly name: "watch-ultra-2-49mm";
        readonly width: 205;
        readonly height: 251;
    };
};
/**
 * Main configuration for InterfaceBuiltRight
 */
declare const ConfigSchema: z.ZodObject<{
    baseUrl: z.ZodString;
    outputDir: z.ZodDefault<z.ZodString>;
    viewport: z.ZodDefault<z.ZodObject<{
        name: z.ZodString;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        width: number;
        height: number;
    }, {
        name: string;
        width: number;
        height: number;
    }>>;
    viewports: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        width: number;
        height: number;
    }, {
        name: string;
        width: number;
        height: number;
    }>, "many">>;
    threshold: z.ZodDefault<z.ZodNumber>;
    fullPage: z.ZodDefault<z.ZodBoolean>;
    waitForNetworkIdle: z.ZodDefault<z.ZodBoolean>;
    timeout: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    threshold: number;
    outputDir: string;
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    fullPage: boolean;
    waitForNetworkIdle: boolean;
    timeout: number;
    baseUrl: string;
    viewports?: {
        name: string;
        width: number;
        height: number;
    }[] | undefined;
}, {
    baseUrl: string;
    threshold?: number | undefined;
    outputDir?: string | undefined;
    viewport?: {
        name: string;
        width: number;
        height: number;
    } | undefined;
    fullPage?: boolean | undefined;
    waitForNetworkIdle?: boolean | undefined;
    timeout?: number | undefined;
    viewports?: {
        name: string;
        width: number;
        height: number;
    }[] | undefined;
}>;
/**
 * Session query options
 */
declare const SessionQuerySchema: z.ZodObject<{
    route: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["baseline", "compared", "pending"]>>;
    name: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodDate>;
    createdBefore: z.ZodOptional<z.ZodDate>;
    viewport: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    name?: string | undefined;
    status?: "baseline" | "compared" | "pending" | undefined;
    url?: string | undefined;
    viewport?: string | undefined;
    route?: string | undefined;
    createdAfter?: Date | undefined;
    createdBefore?: Date | undefined;
}, {
    name?: string | undefined;
    status?: "baseline" | "compared" | "pending" | undefined;
    url?: string | undefined;
    viewport?: string | undefined;
    limit?: number | undefined;
    route?: string | undefined;
    createdAfter?: Date | undefined;
    createdBefore?: Date | undefined;
}>;
/**
 * Comparison result from pixelmatch
 */
declare const ComparisonResultSchema: z.ZodObject<{
    match: z.ZodBoolean;
    diffPercent: z.ZodNumber;
    diffPixels: z.ZodNumber;
    totalPixels: z.ZodNumber;
    threshold: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    threshold: number;
    match: boolean;
    diffPercent: number;
    diffPixels: number;
    totalPixels: number;
}, {
    threshold: number;
    match: boolean;
    diffPercent: number;
    diffPixels: number;
    totalPixels: number;
}>;
/**
 * Changed region detected in comparison
 */
declare const ChangedRegionSchema: z.ZodObject<{
    location: z.ZodEnum<["top", "bottom", "left", "right", "center", "full"]>;
    bounds: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        x: number;
        y: number;
    }, {
        width: number;
        height: number;
        x: number;
        y: number;
    }>;
    description: z.ZodString;
    severity: z.ZodEnum<["expected", "unexpected", "critical"]>;
}, "strip", z.ZodTypeAny, {
    location: "top" | "bottom" | "left" | "right" | "center" | "full";
    bounds: {
        width: number;
        height: number;
        x: number;
        y: number;
    };
    description: string;
    severity: "expected" | "unexpected" | "critical";
}, {
    location: "top" | "bottom" | "left" | "right" | "center" | "full";
    bounds: {
        width: number;
        height: number;
        x: number;
        y: number;
    };
    description: string;
    severity: "expected" | "unexpected" | "critical";
}>;
/**
 * Analysis verdict types
 */
declare const VerdictSchema: z.ZodEnum<["MATCH", "EXPECTED_CHANGE", "UNEXPECTED_CHANGE", "LAYOUT_BROKEN"]>;
/**
 * Analysis result
 */
declare const AnalysisSchema: z.ZodObject<{
    verdict: z.ZodEnum<["MATCH", "EXPECTED_CHANGE", "UNEXPECTED_CHANGE", "LAYOUT_BROKEN"]>;
    summary: z.ZodString;
    changedRegions: z.ZodArray<z.ZodObject<{
        location: z.ZodEnum<["top", "bottom", "left", "right", "center", "full"]>;
        bounds: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
            x: number;
            y: number;
        }, {
            width: number;
            height: number;
            x: number;
            y: number;
        }>;
        description: z.ZodString;
        severity: z.ZodEnum<["expected", "unexpected", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        location: "top" | "bottom" | "left" | "right" | "center" | "full";
        bounds: {
            width: number;
            height: number;
            x: number;
            y: number;
        };
        description: string;
        severity: "expected" | "unexpected" | "critical";
    }, {
        location: "top" | "bottom" | "left" | "right" | "center" | "full";
        bounds: {
            width: number;
            height: number;
            x: number;
            y: number;
        };
        description: string;
        severity: "expected" | "unexpected" | "critical";
    }>, "many">;
    unexpectedChanges: z.ZodArray<z.ZodObject<{
        location: z.ZodEnum<["top", "bottom", "left", "right", "center", "full"]>;
        bounds: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
            x: number;
            y: number;
        }, {
            width: number;
            height: number;
            x: number;
            y: number;
        }>;
        description: z.ZodString;
        severity: z.ZodEnum<["expected", "unexpected", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        location: "top" | "bottom" | "left" | "right" | "center" | "full";
        bounds: {
            width: number;
            height: number;
            x: number;
            y: number;
        };
        description: string;
        severity: "expected" | "unexpected" | "critical";
    }, {
        location: "top" | "bottom" | "left" | "right" | "center" | "full";
        bounds: {
            width: number;
            height: number;
            x: number;
            y: number;
        };
        description: string;
        severity: "expected" | "unexpected" | "critical";
    }>, "many">;
    recommendation: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
    summary: string;
    changedRegions: {
        location: "top" | "bottom" | "left" | "right" | "center" | "full";
        bounds: {
            width: number;
            height: number;
            x: number;
            y: number;
        };
        description: string;
        severity: "expected" | "unexpected" | "critical";
    }[];
    unexpectedChanges: {
        location: "top" | "bottom" | "left" | "right" | "center" | "full";
        bounds: {
            width: number;
            height: number;
            x: number;
            y: number;
        };
        description: string;
        severity: "expected" | "unexpected" | "critical";
    }[];
    recommendation: string | null;
}, {
    verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
    summary: string;
    changedRegions: {
        location: "top" | "bottom" | "left" | "right" | "center" | "full";
        bounds: {
            width: number;
            height: number;
            x: number;
            y: number;
        };
        description: string;
        severity: "expected" | "unexpected" | "critical";
    }[];
    unexpectedChanges: {
        location: "top" | "bottom" | "left" | "right" | "center" | "full";
        bounds: {
            width: number;
            height: number;
            x: number;
            y: number;
        };
        description: string;
        severity: "expected" | "unexpected" | "critical";
    }[];
    recommendation: string | null;
}>;
/**
 * Session status
 */
declare const SessionStatusSchema: z.ZodEnum<["baseline", "compared", "pending"]>;
/**
 * Element bounds (moved up for LandmarkElementSchema dependency)
 */
declare const BoundsSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    width: number;
    height: number;
    x: number;
    y: number;
}, {
    width: number;
    height: number;
    x: number;
    y: number;
}>;
/**
 * Landmark element detected on page
 */
declare const LandmarkElementSchema: z.ZodObject<{
    name: z.ZodString;
    selector: z.ZodString;
    found: z.ZodBoolean;
    bounds: z.ZodOptional<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        x: number;
        y: number;
    }, {
        width: number;
        height: number;
        x: number;
        y: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    selector: string;
    found: boolean;
    bounds?: {
        width: number;
        height: number;
        x: number;
        y: number;
    } | undefined;
}, {
    name: string;
    selector: string;
    found: boolean;
    bounds?: {
        width: number;
        height: number;
        x: number;
        y: number;
    } | undefined;
}>;
/**
 * Visual session
 */
declare const SessionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    url: z.ZodString;
    viewport: z.ZodObject<{
        name: z.ZodString;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        width: number;
        height: number;
    }, {
        name: string;
        width: number;
        height: number;
    }>;
    status: z.ZodEnum<["baseline", "compared", "pending"]>;
    platform: z.ZodOptional<z.ZodEnum<["web", "ios", "watchos"]>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    comparison: z.ZodOptional<z.ZodObject<{
        match: z.ZodBoolean;
        diffPercent: z.ZodNumber;
        diffPixels: z.ZodNumber;
        totalPixels: z.ZodNumber;
        threshold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        threshold: number;
        match: boolean;
        diffPercent: number;
        diffPixels: number;
        totalPixels: number;
    }, {
        threshold: number;
        match: boolean;
        diffPercent: number;
        diffPixels: number;
        totalPixels: number;
    }>>;
    analysis: z.ZodOptional<z.ZodObject<{
        verdict: z.ZodEnum<["MATCH", "EXPECTED_CHANGE", "UNEXPECTED_CHANGE", "LAYOUT_BROKEN"]>;
        summary: z.ZodString;
        changedRegions: z.ZodArray<z.ZodObject<{
            location: z.ZodEnum<["top", "bottom", "left", "right", "center", "full"]>;
            bounds: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                width: number;
                height: number;
                x: number;
                y: number;
            }, {
                width: number;
                height: number;
                x: number;
                y: number;
            }>;
            description: z.ZodString;
            severity: z.ZodEnum<["expected", "unexpected", "critical"]>;
        }, "strip", z.ZodTypeAny, {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }, {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }>, "many">;
        unexpectedChanges: z.ZodArray<z.ZodObject<{
            location: z.ZodEnum<["top", "bottom", "left", "right", "center", "full"]>;
            bounds: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                width: number;
                height: number;
                x: number;
                y: number;
            }, {
                width: number;
                height: number;
                x: number;
                y: number;
            }>;
            description: z.ZodString;
            severity: z.ZodEnum<["expected", "unexpected", "critical"]>;
        }, "strip", z.ZodTypeAny, {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }, {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }>, "many">;
        recommendation: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
        summary: string;
        changedRegions: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        unexpectedChanges: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        recommendation: string | null;
    }, {
        verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
        summary: string;
        changedRegions: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        unexpectedChanges: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        recommendation: string | null;
    }>>;
    landmarkElements: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        selector: z.ZodString;
        found: z.ZodBoolean;
        bounds: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
            x: number;
            y: number;
        }, {
            width: number;
            height: number;
            x: number;
            y: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        selector: string;
        found: boolean;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
    }, {
        name: string;
        selector: string;
        found: boolean;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
    }>, "many">>;
    pageIntent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    status: "baseline" | "compared" | "pending";
    url: string;
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    id: string;
    createdAt: string;
    updatedAt: string;
    platform?: "web" | "ios" | "watchos" | undefined;
    comparison?: {
        threshold: number;
        match: boolean;
        diffPercent: number;
        diffPixels: number;
        totalPixels: number;
    } | undefined;
    analysis?: {
        verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
        summary: string;
        changedRegions: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        unexpectedChanges: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        recommendation: string | null;
    } | undefined;
    landmarkElements?: {
        name: string;
        selector: string;
        found: boolean;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
    }[] | undefined;
    pageIntent?: string | undefined;
}, {
    name: string;
    status: "baseline" | "compared" | "pending";
    url: string;
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    id: string;
    createdAt: string;
    updatedAt: string;
    platform?: "web" | "ios" | "watchos" | undefined;
    comparison?: {
        threshold: number;
        match: boolean;
        diffPercent: number;
        diffPixels: number;
        totalPixels: number;
    } | undefined;
    analysis?: {
        verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
        summary: string;
        changedRegions: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        unexpectedChanges: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        recommendation: string | null;
    } | undefined;
    landmarkElements?: {
        name: string;
        selector: string;
        found: boolean;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
    }[] | undefined;
    pageIntent?: string | undefined;
}>;
/**
 * Full comparison report
 */
declare const ComparisonReportSchema: z.ZodObject<{
    sessionId: z.ZodString;
    sessionName: z.ZodString;
    url: z.ZodString;
    timestamp: z.ZodString;
    viewport: z.ZodObject<{
        name: z.ZodString;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        width: number;
        height: number;
    }, {
        name: string;
        width: number;
        height: number;
    }>;
    comparison: z.ZodObject<{
        match: z.ZodBoolean;
        diffPercent: z.ZodNumber;
        diffPixels: z.ZodNumber;
        totalPixels: z.ZodNumber;
        threshold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        threshold: number;
        match: boolean;
        diffPercent: number;
        diffPixels: number;
        totalPixels: number;
    }, {
        threshold: number;
        match: boolean;
        diffPercent: number;
        diffPixels: number;
        totalPixels: number;
    }>;
    analysis: z.ZodObject<{
        verdict: z.ZodEnum<["MATCH", "EXPECTED_CHANGE", "UNEXPECTED_CHANGE", "LAYOUT_BROKEN"]>;
        summary: z.ZodString;
        changedRegions: z.ZodArray<z.ZodObject<{
            location: z.ZodEnum<["top", "bottom", "left", "right", "center", "full"]>;
            bounds: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                width: number;
                height: number;
                x: number;
                y: number;
            }, {
                width: number;
                height: number;
                x: number;
                y: number;
            }>;
            description: z.ZodString;
            severity: z.ZodEnum<["expected", "unexpected", "critical"]>;
        }, "strip", z.ZodTypeAny, {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }, {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }>, "many">;
        unexpectedChanges: z.ZodArray<z.ZodObject<{
            location: z.ZodEnum<["top", "bottom", "left", "right", "center", "full"]>;
            bounds: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                width: number;
                height: number;
                x: number;
                y: number;
            }, {
                width: number;
                height: number;
                x: number;
                y: number;
            }>;
            description: z.ZodString;
            severity: z.ZodEnum<["expected", "unexpected", "critical"]>;
        }, "strip", z.ZodTypeAny, {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }, {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }>, "many">;
        recommendation: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
        summary: string;
        changedRegions: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        unexpectedChanges: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        recommendation: string | null;
    }, {
        verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
        summary: string;
        changedRegions: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        unexpectedChanges: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        recommendation: string | null;
    }>;
    files: z.ZodObject<{
        baseline: z.ZodString;
        current: z.ZodString;
        diff: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        baseline: string;
        current: string;
        diff: string;
    }, {
        baseline: string;
        current: string;
        diff: string;
    }>;
    webViewUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    sessionId: string;
    comparison: {
        threshold: number;
        match: boolean;
        diffPercent: number;
        diffPixels: number;
        totalPixels: number;
    };
    analysis: {
        verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
        summary: string;
        changedRegions: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        unexpectedChanges: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        recommendation: string | null;
    };
    sessionName: string;
    timestamp: string;
    files: {
        baseline: string;
        current: string;
        diff: string;
    };
    webViewUrl?: string | undefined;
}, {
    url: string;
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    sessionId: string;
    comparison: {
        threshold: number;
        match: boolean;
        diffPercent: number;
        diffPixels: number;
        totalPixels: number;
    };
    analysis: {
        verdict: "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN";
        summary: string;
        changedRegions: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        unexpectedChanges: {
            location: "top" | "bottom" | "left" | "right" | "center" | "full";
            bounds: {
                width: number;
                height: number;
                x: number;
                y: number;
            };
            description: string;
            severity: "expected" | "unexpected" | "critical";
        }[];
        recommendation: string | null;
    };
    sessionName: string;
    timestamp: string;
    files: {
        baseline: string;
        current: string;
        diff: string;
    };
    webViewUrl?: string | undefined;
}>;
/**
 * Element interactivity detection
 */
declare const InteractiveStateSchema: z.ZodObject<{
    hasOnClick: z.ZodBoolean;
    hasHref: z.ZodBoolean;
    isDisabled: z.ZodBoolean;
    tabIndex: z.ZodNumber;
    cursor: z.ZodString;
    hasReactHandler: z.ZodOptional<z.ZodBoolean>;
    hasVueHandler: z.ZodOptional<z.ZodBoolean>;
    hasAngularHandler: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    hasOnClick: boolean;
    hasHref: boolean;
    isDisabled: boolean;
    tabIndex: number;
    cursor: string;
    hasReactHandler?: boolean | undefined;
    hasVueHandler?: boolean | undefined;
    hasAngularHandler?: boolean | undefined;
}, {
    hasOnClick: boolean;
    hasHref: boolean;
    isDisabled: boolean;
    tabIndex: number;
    cursor: string;
    hasReactHandler?: boolean | undefined;
    hasVueHandler?: boolean | undefined;
    hasAngularHandler?: boolean | undefined;
}>;
/**
 * Accessibility attributes
 */
declare const A11yAttributesSchema: z.ZodObject<{
    role: z.ZodNullable<z.ZodString>;
    ariaLabel: z.ZodNullable<z.ZodString>;
    ariaDescribedBy: z.ZodNullable<z.ZodString>;
    ariaHidden: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    role: string | null;
    ariaLabel: string | null;
    ariaDescribedBy: string | null;
    ariaHidden?: boolean | undefined;
}, {
    role: string | null;
    ariaLabel: string | null;
    ariaDescribedBy: string | null;
    ariaHidden?: boolean | undefined;
}>;
/**
 * Enhanced element with interactivity and accessibility
 */
declare const EnhancedElementSchema: z.ZodObject<{
    selector: z.ZodString;
    tagName: z.ZodString;
    id: z.ZodOptional<z.ZodString>;
    className: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    bounds: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        x: number;
        y: number;
    }, {
        width: number;
        height: number;
        x: number;
        y: number;
    }>;
    computedStyles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    interactive: z.ZodObject<{
        hasOnClick: z.ZodBoolean;
        hasHref: z.ZodBoolean;
        isDisabled: z.ZodBoolean;
        tabIndex: z.ZodNumber;
        cursor: z.ZodString;
        hasReactHandler: z.ZodOptional<z.ZodBoolean>;
        hasVueHandler: z.ZodOptional<z.ZodBoolean>;
        hasAngularHandler: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        hasOnClick: boolean;
        hasHref: boolean;
        isDisabled: boolean;
        tabIndex: number;
        cursor: string;
        hasReactHandler?: boolean | undefined;
        hasVueHandler?: boolean | undefined;
        hasAngularHandler?: boolean | undefined;
    }, {
        hasOnClick: boolean;
        hasHref: boolean;
        isDisabled: boolean;
        tabIndex: number;
        cursor: string;
        hasReactHandler?: boolean | undefined;
        hasVueHandler?: boolean | undefined;
        hasAngularHandler?: boolean | undefined;
    }>;
    a11y: z.ZodObject<{
        role: z.ZodNullable<z.ZodString>;
        ariaLabel: z.ZodNullable<z.ZodString>;
        ariaDescribedBy: z.ZodNullable<z.ZodString>;
        ariaHidden: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        role: string | null;
        ariaLabel: string | null;
        ariaDescribedBy: string | null;
        ariaHidden?: boolean | undefined;
    }, {
        role: string | null;
        ariaLabel: string | null;
        ariaDescribedBy: string | null;
        ariaHidden?: boolean | undefined;
    }>;
    sourceHint: z.ZodOptional<z.ZodObject<{
        dataTestId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        dataTestId: string | null;
    }, {
        dataTestId: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    bounds: {
        width: number;
        height: number;
        x: number;
        y: number;
    };
    selector: string;
    tagName: string;
    interactive: {
        hasOnClick: boolean;
        hasHref: boolean;
        isDisabled: boolean;
        tabIndex: number;
        cursor: string;
        hasReactHandler?: boolean | undefined;
        hasVueHandler?: boolean | undefined;
        hasAngularHandler?: boolean | undefined;
    };
    a11y: {
        role: string | null;
        ariaLabel: string | null;
        ariaDescribedBy: string | null;
        ariaHidden?: boolean | undefined;
    };
    id?: string | undefined;
    className?: string | undefined;
    text?: string | undefined;
    computedStyles?: Record<string, string> | undefined;
    sourceHint?: {
        dataTestId: string | null;
    } | undefined;
}, {
    bounds: {
        width: number;
        height: number;
        x: number;
        y: number;
    };
    selector: string;
    tagName: string;
    interactive: {
        hasOnClick: boolean;
        hasHref: boolean;
        isDisabled: boolean;
        tabIndex: number;
        cursor: string;
        hasReactHandler?: boolean | undefined;
        hasVueHandler?: boolean | undefined;
        hasAngularHandler?: boolean | undefined;
    };
    a11y: {
        role: string | null;
        ariaLabel: string | null;
        ariaDescribedBy: string | null;
        ariaHidden?: boolean | undefined;
    };
    id?: string | undefined;
    className?: string | undefined;
    text?: string | undefined;
    computedStyles?: Record<string, string> | undefined;
    sourceHint?: {
        dataTestId: string | null;
    } | undefined;
}>;
/**
 * Element issue detected during audit
 */
declare const ElementIssueSchema: z.ZodObject<{
    type: z.ZodEnum<["NO_HANDLER", "PLACEHOLDER_LINK", "TOUCH_TARGET_SMALL", "MISSING_ARIA_LABEL", "DISABLED_NO_VISUAL"]>;
    severity: z.ZodEnum<["error", "warning", "info"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "NO_HANDLER" | "PLACEHOLDER_LINK" | "TOUCH_TARGET_SMALL" | "MISSING_ARIA_LABEL" | "DISABLED_NO_VISUAL";
    severity: "error" | "warning" | "info";
}, {
    message: string;
    type: "NO_HANDLER" | "PLACEHOLDER_LINK" | "TOUCH_TARGET_SMALL" | "MISSING_ARIA_LABEL" | "DISABLED_NO_VISUAL";
    severity: "error" | "warning" | "info";
}>;
/**
 * Audit result for a captured page
 */
declare const AuditResultSchema: z.ZodObject<{
    totalElements: z.ZodNumber;
    interactiveCount: z.ZodNumber;
    withHandlers: z.ZodNumber;
    withoutHandlers: z.ZodNumber;
    issues: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["NO_HANDLER", "PLACEHOLDER_LINK", "TOUCH_TARGET_SMALL", "MISSING_ARIA_LABEL", "DISABLED_NO_VISUAL"]>;
        severity: z.ZodEnum<["error", "warning", "info"]>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type: "NO_HANDLER" | "PLACEHOLDER_LINK" | "TOUCH_TARGET_SMALL" | "MISSING_ARIA_LABEL" | "DISABLED_NO_VISUAL";
        severity: "error" | "warning" | "info";
    }, {
        message: string;
        type: "NO_HANDLER" | "PLACEHOLDER_LINK" | "TOUCH_TARGET_SMALL" | "MISSING_ARIA_LABEL" | "DISABLED_NO_VISUAL";
        severity: "error" | "warning" | "info";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    issues: {
        message: string;
        type: "NO_HANDLER" | "PLACEHOLDER_LINK" | "TOUCH_TARGET_SMALL" | "MISSING_ARIA_LABEL" | "DISABLED_NO_VISUAL";
        severity: "error" | "warning" | "info";
    }[];
    totalElements: number;
    interactiveCount: number;
    withHandlers: number;
    withoutHandlers: number;
}, {
    issues: {
        message: string;
        type: "NO_HANDLER" | "PLACEHOLDER_LINK" | "TOUCH_TARGET_SMALL" | "MISSING_ARIA_LABEL" | "DISABLED_NO_VISUAL";
        severity: "error" | "warning" | "info";
    }[];
    totalElements: number;
    interactiveCount: number;
    withHandlers: number;
    withoutHandlers: number;
}>;
type Viewport = z.infer<typeof ViewportSchema>;
type Config = z.infer<typeof ConfigSchema>;
type SessionQuery = z.infer<typeof SessionQuerySchema>;
type ComparisonResult = z.infer<typeof ComparisonResultSchema>;
type ChangedRegion = z.infer<typeof ChangedRegionSchema>;
type Verdict = z.infer<typeof VerdictSchema>;
type Analysis = z.infer<typeof AnalysisSchema>;
type SessionStatus = z.infer<typeof SessionStatusSchema>;
type LandmarkElement = z.infer<typeof LandmarkElementSchema>;
type Session = z.infer<typeof SessionSchema>;
type ComparisonReport = z.infer<typeof ComparisonReportSchema>;
type InteractiveState = z.infer<typeof InteractiveStateSchema>;
type A11yAttributes = z.infer<typeof A11yAttributesSchema>;
type Bounds = z.infer<typeof BoundsSchema>;
type EnhancedElement = z.infer<typeof EnhancedElementSchema>;
type ElementIssue = z.infer<typeof ElementIssueSchema>;
type AuditResult = z.infer<typeof AuditResultSchema>;
/**
 * Rule severity levels
 */
declare const RuleSeveritySchema: z.ZodEnum<["off", "warn", "error"]>;
/**
 * Individual rule setting
 */
declare const RuleSettingSchema: z.ZodUnion<[z.ZodEnum<["off", "warn", "error"]>, z.ZodTuple<[z.ZodEnum<["off", "warn", "error"]>, z.ZodRecord<z.ZodString, z.ZodUnknown>], null>]>;
/**
 * Rules configuration (user's .ibr/rules.json)
 */
declare const RulesConfigSchema: z.ZodObject<{
    extends: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodEnum<["off", "warn", "error"]>, z.ZodTuple<[z.ZodEnum<["off", "warn", "error"]>, z.ZodRecord<z.ZodString, z.ZodUnknown>], null>]>>>;
}, "strip", z.ZodTypeAny, {
    extends?: string[] | undefined;
    rules?: Record<string, "error" | "off" | "warn" | ["error" | "off" | "warn", Record<string, unknown>]> | undefined;
}, {
    extends?: string[] | undefined;
    rules?: Record<string, "error" | "off" | "warn" | ["error" | "off" | "warn", Record<string, unknown>]> | undefined;
}>;
/**
 * Violation detected by a rule
 */
declare const ViolationSchema: z.ZodObject<{
    ruleId: z.ZodString;
    ruleName: z.ZodString;
    severity: z.ZodEnum<["warn", "error"]>;
    message: z.ZodString;
    element: z.ZodOptional<z.ZodString>;
    bounds: z.ZodOptional<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        x: number;
        y: number;
    }, {
        width: number;
        height: number;
        x: number;
        y: number;
    }>>;
    fix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    severity: "error" | "warn";
    ruleId: string;
    ruleName: string;
    bounds?: {
        width: number;
        height: number;
        x: number;
        y: number;
    } | undefined;
    element?: string | undefined;
    fix?: string | undefined;
}, {
    message: string;
    severity: "error" | "warn";
    ruleId: string;
    ruleName: string;
    bounds?: {
        width: number;
        height: number;
        x: number;
        y: number;
    } | undefined;
    element?: string | undefined;
    fix?: string | undefined;
}>;
/**
 * Full audit report with rule violations
 */
declare const RuleAuditResultSchema: z.ZodObject<{
    url: z.ZodString;
    timestamp: z.ZodString;
    elementsScanned: z.ZodNumber;
    violations: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        ruleName: z.ZodString;
        severity: z.ZodEnum<["warn", "error"]>;
        message: z.ZodString;
        element: z.ZodOptional<z.ZodString>;
        bounds: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
            x: number;
            y: number;
        }, {
            width: number;
            height: number;
            x: number;
            y: number;
        }>>;
        fix: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        severity: "error" | "warn";
        ruleId: string;
        ruleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }, {
        message: string;
        severity: "error" | "warn";
        ruleId: string;
        ruleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        errors: z.ZodNumber;
        warnings: z.ZodNumber;
        passed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        errors: number;
        warnings: number;
        passed: number;
    }, {
        errors: number;
        warnings: number;
        passed: number;
    }>;
}, "strip", z.ZodTypeAny, {
    url: string;
    summary: {
        errors: number;
        warnings: number;
        passed: number;
    };
    timestamp: string;
    elementsScanned: number;
    violations: {
        message: string;
        severity: "error" | "warn";
        ruleId: string;
        ruleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }[];
}, {
    url: string;
    summary: {
        errors: number;
        warnings: number;
        passed: number;
    };
    timestamp: string;
    elementsScanned: number;
    violations: {
        message: string;
        severity: "error" | "warn";
        ruleId: string;
        ruleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }[];
}>;
type RuleSeverity = z.infer<typeof RuleSeveritySchema>;
type RuleSetting = z.infer<typeof RuleSettingSchema>;
type RulesConfig = z.infer<typeof RulesConfigSchema>;
type Violation = z.infer<typeof ViolationSchema>;
type RuleAuditResult = z.infer<typeof RuleAuditResultSchema>;
/**
 * Source of a UI/UX preference
 */
declare const MemorySourceSchema: z.ZodEnum<["user", "learned", "framework"]>;
/**
 * Preference categories
 */
declare const PreferenceCategorySchema: z.ZodEnum<["color", "layout", "typography", "navigation", "component", "spacing", "interaction", "content"]>;
/**
 * Expectation operator for comparing values
 */
declare const ExpectationOperatorSchema: z.ZodEnum<["equals", "contains", "matches", "gte", "lte"]>;
/**
 * A single UI/UX expectation
 */
declare const ExpectationSchema: z.ZodObject<{
    property: z.ZodString;
    operator: z.ZodEnum<["equals", "contains", "matches", "gte", "lte"]>;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    property: string;
    operator: "equals" | "contains" | "matches" | "gte" | "lte";
}, {
    value: string;
    property: string;
    operator: "equals" | "contains" | "matches" | "gte" | "lte";
}>;
/**
 * Full preference with history
 */
declare const PreferenceSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<["color", "layout", "typography", "navigation", "component", "spacing", "interaction", "content"]>;
    source: z.ZodEnum<["user", "learned", "framework"]>;
    route: z.ZodOptional<z.ZodString>;
    componentType: z.ZodOptional<z.ZodString>;
    expectation: z.ZodObject<{
        property: z.ZodString;
        operator: z.ZodEnum<["equals", "contains", "matches", "gte", "lte"]>;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        property: string;
        operator: "equals" | "contains" | "matches" | "gte" | "lte";
    }, {
        value: string;
        property: string;
        operator: "equals" | "contains" | "matches" | "gte" | "lte";
    }>;
    confidence: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    sessionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
    source: "user" | "learned" | "framework";
    expectation: {
        value: string;
        property: string;
        operator: "equals" | "contains" | "matches" | "gte" | "lte";
    };
    confidence: number;
    route?: string | undefined;
    componentType?: string | undefined;
    sessionIds?: string[] | undefined;
}, {
    description: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
    source: "user" | "learned" | "framework";
    expectation: {
        value: string;
        property: string;
        operator: "equals" | "contains" | "matches" | "gte" | "lte";
    };
    route?: string | undefined;
    componentType?: string | undefined;
    confidence?: number | undefined;
    sessionIds?: string[] | undefined;
}>;
/**
 * Observation extracted from a session
 */
declare const ObservationSchema: z.ZodObject<{
    description: z.ZodString;
    category: z.ZodEnum<["color", "layout", "typography", "navigation", "component", "spacing", "interaction", "content"]>;
    property: z.ZodString;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    description: string;
    property: string;
    category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
}, {
    value: string;
    description: string;
    property: string;
    category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
}>;
/**
 * Learned expectation from an approved session
 */
declare const LearnedExpectationSchema: z.ZodObject<{
    id: z.ZodString;
    sessionId: z.ZodString;
    route: z.ZodString;
    observations: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        category: z.ZodEnum<["color", "layout", "typography", "navigation", "component", "spacing", "interaction", "content"]>;
        property: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        description: string;
        property: string;
        category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
    }, {
        value: string;
        description: string;
        property: string;
        category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
    }>, "many">;
    approved: z.ZodBoolean;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    id: string;
    createdAt: string;
    route: string;
    observations: {
        value: string;
        description: string;
        property: string;
        category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
    }[];
    approved: boolean;
}, {
    sessionId: string;
    id: string;
    createdAt: string;
    route: string;
    observations: {
        value: string;
        description: string;
        property: string;
        category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
    }[];
    approved: boolean;
}>;
/**
 * Compact preference pointer for summary
 */
declare const ActivePreferenceSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<["color", "layout", "typography", "navigation", "component", "spacing", "interaction", "content"]>;
    route: z.ZodOptional<z.ZodString>;
    componentType: z.ZodOptional<z.ZodString>;
    property: z.ZodString;
    operator: z.ZodEnum<["equals", "contains", "matches", "gte", "lte"]>;
    value: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    value: string;
    description: string;
    id: string;
    property: string;
    operator: "equals" | "contains" | "matches" | "gte" | "lte";
    category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
    confidence: number;
    route?: string | undefined;
    componentType?: string | undefined;
}, {
    value: string;
    description: string;
    id: string;
    property: string;
    operator: "equals" | "contains" | "matches" | "gte" | "lte";
    category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
    confidence: number;
    route?: string | undefined;
    componentType?: string | undefined;
}>;
/**
 * Memory summary - always-loaded compact file
 */
declare const MemorySummarySchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    updatedAt: z.ZodString;
    stats: z.ZodObject<{
        totalPreferences: z.ZodNumber;
        totalLearned: z.ZodNumber;
        byCategory: z.ZodRecord<z.ZodString, z.ZodNumber>;
        bySource: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        totalPreferences: number;
        totalLearned: number;
        byCategory: Record<string, number>;
        bySource: Record<string, number>;
    }, {
        totalPreferences: number;
        totalLearned: number;
        byCategory: Record<string, number>;
        bySource: Record<string, number>;
    }>;
    activePreferences: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        category: z.ZodEnum<["color", "layout", "typography", "navigation", "component", "spacing", "interaction", "content"]>;
        route: z.ZodOptional<z.ZodString>;
        componentType: z.ZodOptional<z.ZodString>;
        property: z.ZodString;
        operator: z.ZodEnum<["equals", "contains", "matches", "gte", "lte"]>;
        value: z.ZodString;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        description: string;
        id: string;
        property: string;
        operator: "equals" | "contains" | "matches" | "gte" | "lte";
        category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
        confidence: number;
        route?: string | undefined;
        componentType?: string | undefined;
    }, {
        value: string;
        description: string;
        id: string;
        property: string;
        operator: "equals" | "contains" | "matches" | "gte" | "lte";
        category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
        confidence: number;
        route?: string | undefined;
        componentType?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    updatedAt: string;
    version: 1;
    stats: {
        totalPreferences: number;
        totalLearned: number;
        byCategory: Record<string, number>;
        bySource: Record<string, number>;
    };
    activePreferences: {
        value: string;
        description: string;
        id: string;
        property: string;
        operator: "equals" | "contains" | "matches" | "gte" | "lte";
        category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
        confidence: number;
        route?: string | undefined;
        componentType?: string | undefined;
    }[];
}, {
    updatedAt: string;
    version: 1;
    stats: {
        totalPreferences: number;
        totalLearned: number;
        byCategory: Record<string, number>;
        bySource: Record<string, number>;
    };
    activePreferences: {
        value: string;
        description: string;
        id: string;
        property: string;
        operator: "equals" | "contains" | "matches" | "gte" | "lte";
        category: "color" | "layout" | "typography" | "navigation" | "component" | "spacing" | "interaction" | "content";
        confidence: number;
        route?: string | undefined;
        componentType?: string | undefined;
    }[];
}>;
type MemorySource = z.infer<typeof MemorySourceSchema>;
type PreferenceCategory = z.infer<typeof PreferenceCategorySchema>;
type ExpectationOperator = z.infer<typeof ExpectationOperatorSchema>;
type Expectation = z.infer<typeof ExpectationSchema>;
type Preference = z.infer<typeof PreferenceSchema>;
type Observation = z.infer<typeof ObservationSchema>;
type LearnedExpectation = z.infer<typeof LearnedExpectationSchema>;
type ActivePreference = z.infer<typeof ActivePreferenceSchema>;
type MemorySummary = z.infer<typeof MemorySummarySchema>;
/**
 * Design system principle violation
 */
declare const DesignSystemViolationSchema: z.ZodObject<{
    principleId: z.ZodString;
    principleName: z.ZodString;
    severity: z.ZodEnum<["error", "warn"]>;
    message: z.ZodString;
    element: z.ZodOptional<z.ZodString>;
    bounds: z.ZodOptional<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        x: number;
        y: number;
    }, {
        width: number;
        height: number;
        x: number;
        y: number;
    }>>;
    fix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    severity: "error" | "warn";
    principleId: string;
    principleName: string;
    bounds?: {
        width: number;
        height: number;
        x: number;
        y: number;
    } | undefined;
    element?: string | undefined;
    fix?: string | undefined;
}, {
    message: string;
    severity: "error" | "warn";
    principleId: string;
    principleName: string;
    bounds?: {
        width: number;
        height: number;
        x: number;
        y: number;
    } | undefined;
    element?: string | undefined;
    fix?: string | undefined;
}>;
/**
 * Design system check result (added to ScanResult)
 */
declare const DesignSystemResultSchema: z.ZodObject<{
    configName: z.ZodString;
    principleViolations: z.ZodArray<z.ZodObject<{
        principleId: z.ZodString;
        principleName: z.ZodString;
        severity: z.ZodEnum<["error", "warn"]>;
        message: z.ZodString;
        element: z.ZodOptional<z.ZodString>;
        bounds: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
            x: number;
            y: number;
        }, {
            width: number;
            height: number;
            x: number;
            y: number;
        }>>;
        fix: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        severity: "error" | "warn";
        principleId: string;
        principleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }, {
        message: string;
        severity: "error" | "warn";
        principleId: string;
        principleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }>, "many">;
    tokenViolations: z.ZodArray<z.ZodObject<{
        element: z.ZodString;
        property: z.ZodString;
        expected: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        actual: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        severity: z.ZodEnum<["error", "warning"]>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        expected: string | number;
        severity: "error" | "warning";
        element: string;
        property: string;
        actual: string | number;
    }, {
        message: string;
        expected: string | number;
        severity: "error" | "warning";
        element: string;
        property: string;
        actual: string | number;
    }>, "many">;
    customViolations: z.ZodArray<z.ZodObject<{
        principleId: z.ZodString;
        principleName: z.ZodString;
        severity: z.ZodEnum<["error", "warn"]>;
        message: z.ZodString;
        element: z.ZodOptional<z.ZodString>;
        bounds: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
            x: number;
            y: number;
        }, {
            width: number;
            height: number;
            x: number;
            y: number;
        }>>;
        fix: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        severity: "error" | "warn";
        principleId: string;
        principleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }, {
        message: string;
        severity: "error" | "warn";
        principleId: string;
        principleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }>, "many">;
    complianceScore: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    configName: string;
    principleViolations: {
        message: string;
        severity: "error" | "warn";
        principleId: string;
        principleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }[];
    tokenViolations: {
        message: string;
        expected: string | number;
        severity: "error" | "warning";
        element: string;
        property: string;
        actual: string | number;
    }[];
    customViolations: {
        message: string;
        severity: "error" | "warn";
        principleId: string;
        principleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }[];
    complianceScore: number;
}, {
    configName: string;
    principleViolations: {
        message: string;
        severity: "error" | "warn";
        principleId: string;
        principleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }[];
    tokenViolations: {
        message: string;
        expected: string | number;
        severity: "error" | "warning";
        element: string;
        property: string;
        actual: string | number;
    }[];
    customViolations: {
        message: string;
        severity: "error" | "warn";
        principleId: string;
        principleName: string;
        bounds?: {
            width: number;
            height: number;
            x: number;
            y: number;
        } | undefined;
        element?: string | undefined;
        fix?: string | undefined;
    }[];
    complianceScore: number;
}>;
type DesignSystemViolation = z.infer<typeof DesignSystemViolationSchema>;
type DesignSystemResult = z.infer<typeof DesignSystemResultSchema>;

/**
 * Options for starting a visual session
 */
interface StartSessionOptions {
    name?: string;
    viewport?: Viewport;
    fullPage?: boolean;
    /** CSS selector to capture specific element instead of full page */
    selector?: string;
    /** CSS selector to wait for before capturing screenshot */
    waitFor?: string;
}
/**
 * Result from starting a session
 */
interface StartSessionResult {
    sessionId: string;
    baseline: string;
    session: Session;
}
/**
 * Options for masking dynamic content during capture
 */
interface MaskOptions {
    /** CSS selectors of elements to hide (set visibility: hidden) */
    selectors?: string[];
    /** Text patterns to mask (replaced with placeholder) */
    textPatterns?: Array<string | RegExp>;
    /** Hide common dynamic elements automatically (timestamps, spinners, etc.) */
    hideDynamicContent?: boolean;
    /** Disable all animations and transitions (default: true) */
    hideAnimations?: boolean;
    /** Replace masked text with this placeholder (default: '███') */
    placeholder?: string;
}
/**
 * Default selectors for common dynamic content
 */
declare const DEFAULT_DYNAMIC_SELECTORS: string[];
/**
 * Options for capturing a screenshot
 */
interface CaptureOptions {
    url: string;
    outputPath: string;
    viewport?: Viewport;
    fullPage?: boolean;
    waitForNetworkIdle?: boolean;
    timeout?: number;
    /** CSS selector to capture specific element instead of full page */
    selector?: string;
    /** CSS selector to wait for before capturing screenshot */
    waitFor?: string;
    /** Extra ms to wait after page load and before screenshot (for JS-heavy pages) */
    delay?: number;
    /** Options for masking dynamic content */
    mask?: MaskOptions;
}
/**
 * Options for comparing images
 */
interface CompareOptions {
    baselinePath: string;
    currentPath: string;
    diffPath: string;
    threshold?: number;
}
/**
 * Session file paths
 */
interface SessionPaths {
    root: string;
    sessionJson: string;
    baseline: string;
    current: string;
    diff: string;
}
/**
 * CLI output format
 */
type OutputFormat = 'json' | 'text' | 'minimal';
/**
 * Session list item for display
 */
interface SessionListItem {
    id: string;
    name: string;
    url: string;
    status: string;
    createdAt: string;
    viewport: string;
}
/**
 * Clean options
 */
interface CleanOptions {
    olderThan?: string;
    keepLast?: number;
    dryRun?: boolean;
}
/**
 * Serve options
 */
interface ServeOptions {
    port?: number;
    open?: boolean;
}
/**
 * Authentication options for capture
 */
interface AuthOptions {
    storageStatePath?: string;
}
/**
 * Login options
 */
interface LoginOptions {
    url: string;
    outputDir: string;
    timeout?: number;
}

/**
 * Page Intent Classification
 *
 * Classifies pages by their semantic purpose based on DOM analysis.
 * This helps AI agents understand what kind of page they're looking at
 * without parsing raw accessibility trees.
 */

type PageIntent = 'auth' | 'form' | 'listing' | 'detail' | 'dashboard' | 'error' | 'landing' | 'empty' | 'unknown';
interface PageIntentResult {
    intent: PageIntent;
    confidence: number;
    signals: string[];
    secondaryIntent?: PageIntent;
}
/**
 * Classify page intent from DOM analysis
 */
declare function classifyPageIntent(page: PageLike): Promise<PageIntentResult>;
/**
 * Get human-readable description of page intent
 */
declare function getIntentDescription(intent: PageIntent): string;

/**
 * Page State Detection
 *
 * Detects authentication state, loading state, and errors on a page.
 * Provides AI agents with actionable state information.
 */

interface AuthState {
    authenticated: boolean | null;
    confidence: number;
    signals: string[];
    username?: string;
    socialLoginProviders: string[];
    hasForgotPassword: boolean;
    hasSignupLink: boolean;
    hasPasswordToggle: boolean;
}
interface LoadingState {
    loading: boolean;
    type: 'spinner' | 'skeleton' | 'progress' | 'lazy' | 'none';
    elements: number;
}
interface ErrorState {
    hasErrors: boolean;
    errors: ErrorInfo[];
    severity: 'none' | 'warning' | 'error' | 'critical';
}
interface ErrorInfo {
    type: 'validation' | 'api' | 'permission' | 'notfound' | 'server' | 'network' | 'unknown';
    message: string;
    element?: string;
}
interface PageState {
    auth: AuthState;
    loading: LoadingState;
    errors: ErrorState;
    ready: boolean;
}
/**
 * Detect authentication state from page signals
 */
declare function detectAuthState(page: PageLike): Promise<AuthState>;
/**
 * Detect loading state from page signals
 */
declare function detectLoadingState(page: PageLike): Promise<LoadingState>;
/**
 * Detect error state from page signals
 */
declare function detectErrorState(page: PageLike): Promise<ErrorState>;
/**
 * Detect full page state
 */
declare function detectPageState(page: PageLike): Promise<PageState>;
/**
 * Wait for page to be ready (not loading, no errors)
 */
declare function waitForPageReady(page: PageLike, options?: {
    timeout?: number;
    ignoreErrors?: boolean;
}): Promise<PageState>;

/**
 * Semantic Output Formatter
 *
 * Transforms raw page data into AI-friendly semantic output.
 * Provides verdicts, recommendations, and recovery hints.
 */

type SemanticVerdict = 'PASS' | 'ISSUES' | 'FAIL' | 'LOADING' | 'ERROR';
interface SemanticIssue {
    severity: 'critical' | 'major' | 'minor';
    type: string;
    element?: string;
    problem: string;
    fix: string;
}
interface AvailableAction {
    action: string;
    selector?: string;
    description: string;
}
interface RecoveryHint {
    suggestion: string;
    alternatives?: string[];
    waitFor?: string;
}
interface SemanticResult {
    verdict: SemanticVerdict;
    confidence: number;
    pageIntent: PageIntentResult;
    state: PageState;
    availableActions: AvailableAction[];
    issues: SemanticIssue[];
    recovery?: RecoveryHint;
    summary: string;
    url: string;
    title: string;
    timestamp: string;
}
/**
 * Get semantic understanding of a page
 */
declare function getSemanticOutput(page: PageLike): Promise<SemanticResult>;
/**
 * Format semantic result as concise text for AI consumption
 */
declare function formatSemanticText(result: SemanticResult): string;
/**
 * Format semantic result as JSON for structured consumption
 */
declare function formatSemanticJson(result: SemanticResult): string;

/**
 * Landmark Element Detection
 *
 * Detects common landmark elements on a page. Used for:
 * 1. Storing detected elements in baseline
 * 2. Comparing current elements against baseline
 * 3. Inferring expected elements from page intent when no baseline exists
 */

/**
 * Standard landmark selectors
 */
declare const LANDMARK_SELECTORS: {
    readonly logo: "img[src*=\"logo\"], img[alt*=\"logo\" i], [class*=\"logo\"], [id*=\"logo\"], svg[class*=\"logo\"]";
    readonly header: "header, [role=\"banner\"], [class*=\"header\"]:not([class*=\"subheader\"])";
    readonly navigation: "nav, [role=\"navigation\"], [class*=\"nav\"]:not([class*=\"subnav\"])";
    readonly main: "main, [role=\"main\"], [class*=\"main-content\"], #main";
    readonly footer: "footer, [role=\"contentinfo\"], [class*=\"footer\"]";
    readonly sidebar: "aside, [role=\"complementary\"], [class*=\"sidebar\"]";
    readonly search: "input[type=\"search\"], [role=\"search\"], [class*=\"search-input\"], input[name*=\"search\"]";
    readonly heading: "h1";
    readonly userMenu: "[class*=\"user-menu\"], [class*=\"avatar\"], [class*=\"profile\"], [class*=\"account\"]";
    readonly loginForm: "form:has(input[type=\"password\"])";
    readonly heroSection: "[class*=\"hero\"], [class*=\"banner\"], [class*=\"jumbotron\"]";
    readonly ctaButton: "[class*=\"cta\"], a[class*=\"primary\"], button[class*=\"primary\"]";
};
type LandmarkType = keyof typeof LANDMARK_SELECTORS;
/**
 * Detect all landmark elements on a page
 */
declare function detectLandmarks(page: PageLike): Promise<LandmarkElement[]>;
/**
 * Get expected landmarks based on page intent
 * Used when no baseline exists
 */
declare function getExpectedLandmarksForIntent(intent: PageIntent): LandmarkType[];
/**
 * Compare current landmarks against baseline
 * Returns missing and new elements
 */
declare function compareLandmarks(baseline: LandmarkElement[], current: LandmarkElement[]): {
    missing: LandmarkElement[];
    added: LandmarkElement[];
    unchanged: LandmarkElement[];
};
/**
 * Get expected landmarks based on user context (CLAUDE.md design framework)
 */
declare function getExpectedLandmarksFromContext(framework: {
    principles: string[];
} | null): LandmarkType[];
/**
 * Format landmark comparison for display
 */
declare function formatLandmarkComparison(comparison: ReturnType<typeof compareLandmarks>): string;

/**
 * Search Validation
 *
 * Generates structured output for Claude Code to analyze search results.
 * Provides context for AI-powered relevance checking.
 */

/**
 * Context for AI validation of search results
 */
interface ValidationContext {
    /** The search query executed */
    query: string;
    /** What the user expected to find */
    userIntent: string;
    /** Extracted results for analysis */
    results: ExtractedResult[];
    /** Paths to screenshots for visual inspection */
    screenshotPaths: string[];
    /** Timing metrics */
    timing: SearchTiming;
    /** Timestamp of the search */
    timestamp: string;
    /** Whether any results were found */
    hasResults: boolean;
    /** Total result count */
    resultCount: number;
}
/**
 * Result from AI validation
 */
interface ValidationResult {
    /** Whether results are relevant to user intent */
    relevant: boolean;
    /** Confidence in the assessment (0-1) */
    confidence: number;
    /** Explanation of the assessment */
    reasoning: string;
    /** Suggestions for improvement or next steps */
    suggestions?: string[];
    /** Specific issues found */
    issues?: ValidationIssue[];
}
/**
 * Specific issue found during validation
 */
interface ValidationIssue {
    /** Type of issue */
    type: 'irrelevant' | 'partial' | 'empty' | 'error' | 'slow';
    /** Which result index (if applicable) */
    resultIndex?: number;
    /** Description of the issue */
    description: string;
    /** Severity: low, medium, high */
    severity: 'low' | 'medium' | 'high';
}
/**
 * Generate validation context from AI search result
 */
declare function generateValidationContext(result: AISearchResult): ValidationContext;
/**
 * Generate a structured prompt for Claude Code to analyze search results
 *
 * This prompt provides all necessary context for AI-powered validation:
 * - The query and user intent
 * - Extracted result content
 * - Screenshots for visual inspection
 * - Timing metrics
 */
declare function generateValidationPrompt(context: ValidationContext): string;
/**
 * Generate a concise summary for quick validation
 */
declare function generateQuickSummary(context: ValidationContext): string;
/**
 * Analyze results for obvious issues (pre-AI check)
 *
 * Performs quick heuristic checks before involving AI:
 * - Empty results
 * - Very slow response
 * - Results with no text content
 */
declare function analyzeForObviousIssues(context: ValidationContext): ValidationIssue[];
/**
 * Format validation result for display
 */
declare function formatValidationResult(result: ValidationResult): string;
/**
 * Create a dev-mode prompt for user feedback
 *
 * Used when results seem questionable and user input is needed.
 */
declare function generateDevModePrompt(context: ValidationContext, issues: ValidationIssue[]): string;

/**
 * IBR Built-in Flows
 *
 * Common automation patterns as single commands:
 * - login: Authenticate with email/password
 * - search: Search and verify results
 * - form: Fill and submit forms
 */

declare const flows: {
    readonly login: typeof loginFlow;
    readonly search: typeof searchFlow;
    readonly aiSearch: typeof aiSearchFlow;
    readonly form: typeof formFlow;
};
type FlowName = keyof typeof flows;

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
    connect(wsUrl: string): Promise<void>;
    send<T = unknown>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T>;
    on(method: string, handler: EventHandler): void;
    off(method: string, handler: EventHandler): void;
    private handleMessage;
    private handleClose;
    close(): Promise<void>;
    get connected(): boolean;
}

interface BrowserOptions {
    headless?: boolean;
    port?: number;
    userDataDir?: string;
    chromePath?: string;
    /**
     * Rendering normalization for mockup comparison.
     * Adds --disable-lcd-text and --force-device-scale-factor=1.
     * These improve pixel-level consistency but reduce text rendering quality.
     * Default: false
     */
    normalize?: boolean;
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

declare class DomDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    getElementCenter(backendNodeId: number): Promise<{
        x: number;
        y: number;
    }>;
    getBoxModel(backendNodeId: number): Promise<{
        content: number[];
        padding: number[];
        border: number[];
        margin: number[];
        width: number;
        height: number;
    }>;
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
 * CDP Emulation domain — viewport, device metrics, media features.
 * NEW for IBR — responsive testing via device metrics override.
 */

interface ViewportConfig {
    width: number;
    height: number;
    deviceScaleFactor?: number;
    mobile?: boolean;
}
declare class EmulationDomain {
    private conn;
    private sessionId?;
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    /**
     * Override device metrics (viewport size, scale, mobile mode).
     */
    setDeviceMetrics(config: ViewportConfig): Promise<void>;
    /**
     * Clear device metrics override (restore defaults).
     */
    clearDeviceMetrics(): Promise<void>;
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
 * CDP Network domain — cookie management for auth state.
 * NEW for IBR — replaces Playwright's storageState for auth persistence.
 */

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
    constructor(conn: CdpConnection, sessionId?: string | undefined);
    enable(): Promise<void>;
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
    /** Iframe elements on the page (separate AX trees) */
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
    private targetId;
    private sessionId;
    private _currentUrl;
    private launched;
    private resolutionCache;
    launch(options?: LaunchOptions): Promise<void>;
    close(): Promise<void>;
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
    disconnect(): Promise<void>;
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
    /**
     * Connect to an already-running Chrome instance instead of launching a new one.
     * Used by browser-server reconnection to attach to a persistent Chrome process.
     */
    connectExisting(wsUrl: string): Promise<void>;
}

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
    waitFor(options?: {
        state?: string;
        timeout?: number;
    }): Promise<void>;
    private resolveNode;
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

/**
 * Capture result with timing and diagnostic info
 */
interface CaptureResult {
    success: boolean;
    outputPath?: string;
    timing: {
        navigationMs: number;
        renderMs: number;
        totalMs: number;
    };
    diagnostics: {
        httpStatus?: number;
        consoleErrors: string[];
        networkErrors: string[];
        suggestions: string[];
    };
    error?: {
        type: 'timeout' | 'navigation' | 'screenshot' | 'unknown';
        message: string;
        suggestion: string;
    };
}
/**
 * Close the browser instance
 */
declare function closeBrowser(): Promise<void>;
/**
 * Capture a screenshot of a URL
 */
declare function captureScreenshot(options: CaptureOptions & {
    outputDir?: string;
}): Promise<string>;
/**
 * Get viewport dimensions by name
 */
declare function getViewport(name: 'desktop' | 'mobile' | 'tablet'): Viewport;
/**
 * Enhanced capture with detailed timing and diagnostics
 * Returns actionable info for debugging slow loads or errors
 */
declare function captureWithDiagnostics(options: CaptureOptions & {
    outputDir?: string;
}): Promise<CaptureResult>;

interface ThemeAnalysis {
    pageBackground: {
        color: string;
        luminance: number;
    };
    contentCards: Array<{
        selector: string;
        color: string;
        luminance: number;
    }>;
    themeMismatch: boolean;
    mismatchDetails?: string;
}
/**
 * UI metrics extracted from a page for consistency checking
 */
interface PageMetrics {
    url: string;
    path: string;
    title: string;
    layout: {
        headerHeight: number | null;
        navWidth: number | null;
        contentPadding: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        } | null;
        footerHeight: number | null;
    };
    typography: {
        bodyFontFamily: string | null;
        bodyFontSize: string | null;
        headingFontFamily: string | null;
        h1FontSize: string | null;
        h2FontSize: string | null;
        lineHeight: string | null;
    };
    colors: {
        backgroundColor: string | null;
        textColor: string | null;
        linkColor: string | null;
        primaryButtonBg: string | null;
        primaryButtonText: string | null;
    };
    spacing: {
        buttonPadding: string | null;
        cardPadding: string | null;
        sectionGap: string | null;
    };
}
/**
 * Inconsistency found between pages
 */
interface Inconsistency {
    type: 'layout' | 'typography' | 'color' | 'spacing';
    property: string;
    severity: 'info' | 'warning' | 'error';
    description: string;
    pages: Array<{
        path: string;
        value: string | number | null;
    }>;
    suggestion?: string;
}
/**
 * Consistency check result
 */
interface ConsistencyResult {
    pages: PageMetrics[];
    inconsistencies: Inconsistency[];
    score: number;
    summary: string;
}
/**
 * Consistency check options
 */
interface ConsistencyOptions {
    /** URLs to check */
    urls: string[];
    /** Enable verbose output */
    verbose?: boolean;
    /** Timeout per page (ms) */
    timeout?: number;
    /** Ignore certain property types */
    ignore?: Array<'layout' | 'typography' | 'color' | 'spacing'>;
}
/**
 * Check UI consistency across multiple pages
 */
declare function checkConsistency(options: ConsistencyOptions): Promise<ConsistencyResult>;
/**
 * Format consistency result for display
 */
declare function formatConsistencyReport(result: ConsistencyResult): string;

/**
 * Region detection configuration
 * Divides page into semantic regions based on common layout patterns
 */
interface RegionConfig {
    name: string;
    location: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'full';
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
}
/**
 * Analyze diff image to detect which regions have changes
 */
declare function detectChangedRegions(diffData: Uint8Array, width: number, height: number, regions?: RegionConfig[]): ChangedRegion[];
/**
 * Extended comparison result with diff image data for regional analysis
 */
interface ExtendedComparisonResult extends ComparisonResult {
    diffData?: Uint8Array;
    width?: number;
    height?: number;
}
/**
 * Compare two images using pixelmatch
 */
declare function compareImages(options: CompareOptions): Promise<ExtendedComparisonResult>;
/**
 * Analyze comparison result and generate verdict with regional analysis
 */
declare function analyzeComparison(result: ExtendedComparisonResult, thresholdPercent?: number): Analysis;
/**
 * Get a human-readable verdict description
 */
declare function getVerdictDescription(verdict: Verdict): string;

interface CrawlOptions {
    /** Starting URL */
    url: string;
    /** Maximum number of pages to discover (default: 5) */
    maxPages?: number;
    /** Only crawl pages under this path prefix */
    pathPrefix?: string;
    /** Timeout per page in ms (default: 10000) */
    timeout?: number;
    /** Include external links (default: false) */
    includeExternal?: boolean;
}
interface DiscoveredPage {
    url: string;
    path: string;
    title: string;
    linkText?: string;
    depth: number;
}
interface CrawlResult {
    baseUrl: string;
    pages: DiscoveredPage[];
    totalLinks: number;
    crawlTime: number;
}
/**
 * Discover pages on a website by crawling from the starting URL
 * Returns up to maxPages unique pages within the same origin
 */
declare function discoverPages(options: CrawlOptions): Promise<CrawlResult>;
/**
 * Quick scan to get navigation links from a page
 * Useful for finding main pages without full crawl
 */
declare function getNavigationLinks(url: string): Promise<DiscoveredPage[]>;

/**
 * Generate a unique session ID
 */
declare function generateSessionId(): string;
/**
 * Get paths for a session (legacy flat structure)
 */
declare function getSessionPaths(outputDir: string, sessionId: string): SessionPaths;
/**
 * Create a new session
 */
declare function createSession(outputDir: string, url: string, name: string, viewport: Viewport, platform?: 'web' | 'ios' | 'watchos'): Promise<Session>;
/**
 * Get a session by ID
 */
declare function getSession(outputDir: string, sessionId: string): Promise<Session | null>;
/**
 * Update a session
 */
declare function updateSession(outputDir: string, sessionId: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>): Promise<Session>;
/**
 * Mark session as compared with results
 */
declare function markSessionCompared(outputDir: string, sessionId: string, comparison: ComparisonResult, analysis: Analysis): Promise<Session>;
/**
 * List all sessions
 */
declare function listSessions(outputDir: string): Promise<Session[]>;
/**
 * Get the most recent session
 */
declare function getMostRecentSession(outputDir: string): Promise<Session | null>;
/**
 * Delete a session
 */
declare function deleteSession(outputDir: string, sessionId: string): Promise<boolean>;
/**
 * Clean old sessions
 */
declare function cleanSessions(outputDir: string, options?: CleanOptions): Promise<{
    deleted: string[];
    kept: string[];
}>;
/**
 * Find sessions matching query criteria
 */
declare function findSessions(outputDir: string, query?: Partial<SessionQuery>): Promise<Session[]>;
/**
 * Get timeline of sessions for a specific route/URL
 * Returns sessions in chronological order (oldest first) for tracking changes over time
 */
declare function getTimeline(outputDir: string, route: string, limit?: number): Promise<Session[]>;
/**
 * Get sessions grouped by route
 */
declare function getSessionsByRoute(outputDir: string): Promise<Record<string, Session[]>>;
/**
 * Get session statistics
 */
declare function getSessionStats(outputDir: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byViewport: Record<string, number>;
    byVerdict: Record<string, number>;
}>;

/**
 * Generate a full comparison report
 */
declare function generateReport(session: Session, comparison: ComparisonResult, analysis: Analysis, outputDir: string, webViewPort?: number): ComparisonReport;
/**
 * Format report as human-readable text
 */
declare function formatReportText(report: ComparisonReport): string;
/**
 * Format report as minimal output (for scripts)
 */
declare function formatReportMinimal(report: ComparisonReport): string;
/**
 * Format report as JSON
 */
declare function formatReportJson(report: ComparisonReport): string;
/**
 * Generate a summary line for session listing
 */
declare function formatSessionSummary(session: Session): string;

/**
 * integration.ts
 * Extract API calls from TypeScript/React component files
 *
 * Detects:
 * - fetch() calls
 * - axios methods (get, post, put, delete, patch, etc.)
 * - Template literals and variable URLs
 */
interface ApiCall {
    endpoint: string;
    method: string;
    sourceFile: string;
    lineNumber?: number;
    callerContext?: string;
    isDynamic?: boolean;
}
/**
 * Represents an API route discovered in the project
 */
interface ApiRoute {
    route: string;
    method: string[];
    sourceFile: string;
    isDynamic: boolean;
}
/**
 * Parse a single file for fetch/axios calls
 *
 * @param filePath - Absolute path to TypeScript/React file
 * @returns Array of API calls found in the file
 */
declare function extractApiCalls(filePath: string): Promise<ApiCall[]>;
/**
 * Recursively scan directory for TypeScript/React files and extract API calls
 *
 * @param dir - Directory to scan
 * @param pattern - File pattern to match (default: TypeScript/React files)
 * @returns Array of all API calls found
 */
declare function scanDirectoryForApiCalls(dir: string, _pattern?: string): Promise<ApiCall[]>;
/**
 * Group API calls by endpoint
 */
declare function groupByEndpoint(calls: ApiCall[]): Map<string, ApiCall[]>;
/**
 * Group API calls by source file
 */
declare function groupByFile(calls: ApiCall[]): Map<string, ApiCall[]>;
/**
 * Filter calls to only include specific HTTP methods
 */
declare function filterByMethod(calls: ApiCall[], methods: string[]): ApiCall[];
/**
 * Filter calls to only include specific endpoints (supports wildcards)
 */
declare function filterByEndpoint(calls: ApiCall[], endpointPattern: string): ApiCall[];
/**
 * Discover API routes from Next.js/Remix file structure
 * Supports Next.js App Router (app/api) and Pages Router (pages/api)
 * Also searches subdirectories (like web-ui/) for nested Next.js apps
 */
declare function discoverApiRoutes(projectDir: string): Promise<ApiRoute[]>;
/**
 * Convert file path to API route
 * Examples:
 * - app/api/users/route.ts -> /api/users
 * - app/api/users/[id]/route.ts -> /api/users/[id]
 * - pages/api/users.ts -> /api/users
 * - pages/api/users/[id].ts -> /api/users/[id]
 */
declare function filePathToRoute(filePath: string, projectDir: string): string;
/**
 * Cross-reference API calls against routes, return orphans
 */
declare function findOrphanEndpoints(apiCalls: ApiCall[], apiRoutes: ApiRoute[]): {
    call: ApiCall;
    searchedLocations: string[];
}[];

/**
 * Pending operation types
 */
type OperationType = 'screenshot' | 'type' | 'click' | 'navigate' | 'evaluate' | 'fill' | 'hover' | 'wait';
/**
 * A pending operation that's currently running
 */
interface PendingOperation {
    id: string;
    type: OperationType;
    sessionId: string;
    startedAt: string;
    pid: number;
    command?: string;
}
/**
 * State file structure
 */
interface OperationState {
    pending: PendingOperation[];
    lastUpdated: string;
}
/**
 * Register a new pending operation
 * Returns the operation ID
 */
declare function registerOperation(outputDir: string, options: {
    type: OperationType;
    sessionId: string;
    command?: string;
}): Promise<string>;
/**
 * Mark an operation as complete (remove from pending)
 */
declare function completeOperation(outputDir: string, operationId: string): Promise<void>;
/**
 * Get all pending operations
 */
declare function getPendingOperations(outputDir: string): Promise<PendingOperation[]>;
/**
 * Wait for all pending operations to complete
 * Returns true if all completed, false if timeout reached
 */
declare function waitForCompletion(outputDir: string, options?: {
    timeout?: number;
    pollInterval?: number;
    onProgress?: (remaining: number) => void;
}): Promise<boolean>;
/**
 * Format pending operations for display
 */
declare function formatPendingOperations(operations: PendingOperation[]): string;
/**
 * Higher-order function to wrap an async operation with tracking
 */
declare function withOperationTracking<T>(outputDir: string, options: {
    type: OperationType;
    sessionId: string;
    command?: string;
}): (fn: () => Promise<T>) => Promise<T>;

/**
 * Retention policy configuration
 * Add to .ibrrc.json to enable auto-cleanup
 */
interface RetentionConfig {
    /** Maximum number of sessions to keep (default: no limit) */
    maxSessions?: number;
    /** Maximum age of sessions in days (default: no limit) */
    maxAgeDays?: number;
    /** Keep sessions that have failed comparisons (default: true) */
    keepFailed?: boolean;
    /** Enable automatic cleanup on session creation (default: false) */
    autoClean?: boolean;
}
/**
 * Default retention configuration
 */
declare const DEFAULT_RETENTION: RetentionConfig;
/**
 * Result of retention policy enforcement
 */
interface RetentionResult {
    /** Sessions that were deleted */
    deleted: string[];
    /** Sessions that were kept */
    kept: string[];
    /** Sessions kept because they failed (if keepFailed is true) */
    keptFailed: string[];
    /** Total sessions before cleanup */
    totalBefore: number;
    /** Total sessions after cleanup */
    totalAfter: number;
}
/**
 * Load retention config from .ibrrc.json
 */
declare function loadRetentionConfig(outputDir: string): Promise<RetentionConfig>;
/**
 * Enforce retention policy on sessions
 *
 * @example
 * ```typescript
 * // Enforce with config from .ibrrc.json
 * const result = await enforceRetentionPolicy('./.ibr');
 * console.log(`Deleted ${result.deleted.length} sessions`);
 *
 * // Enforce with explicit config
 * const result = await enforceRetentionPolicy('./.ibr', {
 *   maxSessions: 20,
 *   maxAgeDays: 7,
 *   keepFailed: true
 * });
 * ```
 */
declare function enforceRetentionPolicy(outputDir: string, config?: RetentionConfig): Promise<RetentionResult>;
/**
 * Run auto-cleanup if enabled in config
 * Call this after creating new sessions
 */
declare function maybeAutoClean(outputDir: string): Promise<RetentionResult | null>;
/**
 * Get retention status summary
 */
declare function getRetentionStatus(outputDir: string): Promise<{
    config: RetentionConfig;
    currentSessions: number;
    oldestSession: Date | null;
    newestSession: Date | null;
    wouldDelete: number;
}>;
/**
 * Format retention status for display
 */
declare function formatRetentionStatus(status: Awaited<ReturnType<typeof getRetentionStatus>>): string;

/**
 * Layout issue detected during responsive testing
 */
interface LayoutIssue {
    element: string;
    issue: 'overflow' | 'hidden' | 'truncated' | 'overlap' | 'too-small' | 'off-screen';
    description: string;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/**
 * Touch target analysis
 */
interface TouchTargetIssue {
    element: string;
    selector: string;
    size: {
        width: number;
        height: number;
    };
    minimumSize: number;
    isTooSmall: boolean;
}
/**
 * Text readability issue
 */
interface TextIssue {
    element: string;
    issue: 'too-small' | 'low-contrast';
    fontSize?: number;
    contrastRatio?: number;
}
/**
 * Single viewport test result
 */
interface ViewportResult {
    viewport: Viewport;
    viewportName: string;
    layoutIssues: LayoutIssue[];
    touchTargets: TouchTargetIssue[];
    textIssues: TextIssue[];
    screenshot?: string;
}
/**
 * Full responsive test result
 */
interface ResponsiveResult {
    url: string;
    results: ViewportResult[];
    summary: {
        totalIssues: number;
        viewportsWithIssues: number;
        criticalIssues: number;
    };
}
/**
 * Responsive test options
 */
interface ResponsiveTestOptions {
    /** Viewports to test. Defaults to desktop, tablet, mobile */
    viewports?: Array<'desktop' | 'tablet' | 'mobile' | Viewport>;
    /** Capture screenshots for each viewport */
    captureScreenshots?: boolean;
    /** Output directory for screenshots */
    outputDir?: string;
    /** Minimum touch target size (default: 44px per WCAG) */
    minTouchTarget?: number;
    /** Minimum font size (default: 12px) */
    minFontSize?: number;
    /** Timeout for page load */
    timeout?: number;
}
/**
 * Test responsive behavior across multiple viewports
 */
declare function testResponsive(url: string, options?: ResponsiveTestOptions): Promise<ResponsiveResult>;
/**
 * Format responsive test result for console output
 */
declare function formatResponsiveResult(result: ResponsiveResult): string;

/**
 * Rule context passed to each rule check
 */
interface RuleContext {
    isMobile: boolean;
    viewportWidth: number;
    viewportHeight: number;
    url: string;
    allElements: EnhancedElement[];
}
/**
 * Rule definition
 */
interface Rule {
    id: string;
    name: string;
    description: string;
    defaultSeverity: 'warn' | 'error';
    check: (element: EnhancedElement, context: RuleContext, options?: Record<string, unknown>) => Violation | null;
}
/**
 * Rule preset - collection of rules with default settings
 */
interface RulePreset {
    name: string;
    description: string;
    rules: Rule[];
    defaults: Record<string, RuleSetting>;
}

/**
 * Memory System - Persistent UI/UX preferences with eviction and summarization
 *
 * Follows the "Deep Agents" context management pattern:
 * - summary.json: Always-loaded compact file (< 2KB)
 * - preferences/: Full preference detail files
 * - learned/: Expectations extracted from approved sessions
 * - archive/: Previous summary snapshots (eviction)
 */

/**
 * Ensure memory directory structure exists
 */
declare function initMemory(outputDir: string): Promise<void>;
/**
 * Load the compact summary - the "working memory"
 */
declare function loadSummary(outputDir: string): Promise<MemorySummary>;
/**
 * Save the compact summary
 */
declare function saveSummary(outputDir: string, summary: MemorySummary): Promise<void>;
/**
 * Add a new UI/UX preference
 */
declare function addPreference(outputDir: string, input: {
    description: string;
    category: PreferenceCategory;
    source?: MemorySource;
    route?: string;
    componentType?: string;
    property: string;
    operator?: ExpectationOperator;
    value: string;
    confidence?: number;
    sessionIds?: string[];
}): Promise<Preference>;
/**
 * Get full preference detail by ID
 */
declare function getPreference(outputDir: string, prefId: string): Promise<Preference | null>;
/**
 * Remove a preference
 */
declare function removePreference(outputDir: string, prefId: string): Promise<boolean>;
/**
 * List preferences with optional filter
 */
declare function listPreferences(outputDir: string, filter?: {
    category?: PreferenceCategory;
    route?: string;
    componentType?: string;
}): Promise<Preference[]>;
/**
 * Extract and store expectations from an approved session
 */
declare function learnFromSession(outputDir: string, session: Session, observations: Observation[]): Promise<LearnedExpectation>;
/**
 * List learned expectations
 */
declare function listLearned(outputDir: string): Promise<LearnedExpectation[]>;
/**
 * Promote a learned expectation to a full preference
 */
declare function promoteToPreference(outputDir: string, learnedId: string): Promise<Preference | null>;
/**
 * Rebuild summary from all preference files (summarization pattern)
 */
declare function rebuildSummary(outputDir: string): Promise<MemorySummary>;
/**
 * Archive current summary before rebuilding (eviction pattern)
 */
declare function archiveSummary(outputDir: string): Promise<void>;
/**
 * Query memory for preferences matching criteria
 */
declare function queryMemory(outputDir: string, query: {
    route?: string;
    category?: string;
    componentType?: string;
}): Promise<ActivePreference[]>;
/**
 * Convert memory preferences into Rule objects for the rules engine
 */
declare function preferencesToRules(preferences: ActivePreference[]): Rule[];
/**
 * Create a RulePreset from memory preferences
 */
declare function createMemoryPreset(preferences: ActivePreference[]): RulePreset;
/**
 * Format memory summary for CLI output
 */
declare function formatMemorySummary(summary: MemorySummary): string;
/**
 * Format a single preference for display
 */
declare function formatPreference(pref: Preference): string;

/**
 * Types of UI decisions that can be tracked
 */
declare const DecisionTypeSchema: z.ZodEnum<["css_change", "layout_change", "color_change", "spacing_change", "component_add", "component_remove", "component_modify", "content_change"]>;
/**
 * Before/after state snapshot for a decision
 */
declare const DecisionStateSchema: z.ZodObject<{
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    html_snippet: z.ZodOptional<z.ZodString>;
    screenshot_ref: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    css?: Record<string, string> | undefined;
    html_snippet?: string | undefined;
    screenshot_ref?: string | undefined;
}, {
    css?: Record<string, string> | undefined;
    html_snippet?: string | undefined;
    screenshot_ref?: string | undefined;
}>;
/**
 * A single UI decision entry stored in JSONL logs
 */
declare const DecisionEntrySchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    route: z.ZodString;
    component: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["css_change", "layout_change", "color_change", "spacing_change", "component_add", "component_remove", "component_modify", "content_change"]>;
    description: z.ZodString;
    rationale: z.ZodOptional<z.ZodString>;
    before: z.ZodOptional<z.ZodObject<{
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        html_snippet: z.ZodOptional<z.ZodString>;
        screenshot_ref: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    }, {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    }>>;
    after: z.ZodOptional<z.ZodObject<{
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        html_snippet: z.ZodOptional<z.ZodString>;
        screenshot_ref: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    }, {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    }>>;
    files_changed: z.ZodArray<z.ZodString, "many">;
    session_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "css_change" | "layout_change" | "color_change" | "spacing_change" | "component_add" | "component_remove" | "component_modify" | "content_change";
    description: string;
    id: string;
    timestamp: string;
    route: string;
    files_changed: string[];
    component?: string | undefined;
    before?: {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    } | undefined;
    after?: {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    } | undefined;
    rationale?: string | undefined;
    session_id?: string | undefined;
}, {
    type: "css_change" | "layout_change" | "color_change" | "spacing_change" | "component_add" | "component_remove" | "component_modify" | "content_change";
    description: string;
    id: string;
    timestamp: string;
    route: string;
    files_changed: string[];
    component?: string | undefined;
    before?: {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    } | undefined;
    after?: {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    } | undefined;
    rationale?: string | undefined;
    session_id?: string | undefined;
}>;
/**
 * Route-level decision summary for compact context
 */
declare const DecisionSummarySchema: z.ZodObject<{
    route: z.ZodString;
    component: z.ZodOptional<z.ZodString>;
    latest_change: z.ZodString;
    decision_count: z.ZodNumber;
    full_log_ref: z.ZodString;
}, "strip", z.ZodTypeAny, {
    route: string;
    latest_change: string;
    decision_count: number;
    full_log_ref: string;
    component?: string | undefined;
}, {
    route: string;
    latest_change: string;
    decision_count: number;
    full_log_ref: string;
    component?: string | undefined;
}>;
/**
 * Current UI state tracking in compact context
 */
declare const CurrentUIStateSchema: z.ZodObject<{
    last_snapshot_ref: z.ZodOptional<z.ZodString>;
    pending_verifications: z.ZodNumber;
    known_issues: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    pending_verifications: number;
    known_issues: string[];
    last_snapshot_ref?: string | undefined;
}, {
    pending_verifications: number;
    known_issues: string[];
    last_snapshot_ref?: string | undefined;
}>;
/**
 * Compact context — always-loaded LLM-friendly summary (<4KB target)
 */
declare const CompactContextSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    session_id: z.ZodString;
    updated_at: z.ZodString;
    active_route: z.ZodOptional<z.ZodString>;
    decisions_summary: z.ZodArray<z.ZodObject<{
        route: z.ZodString;
        component: z.ZodOptional<z.ZodString>;
        latest_change: z.ZodString;
        decision_count: z.ZodNumber;
        full_log_ref: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        route: string;
        latest_change: string;
        decision_count: number;
        full_log_ref: string;
        component?: string | undefined;
    }, {
        route: string;
        latest_change: string;
        decision_count: number;
        full_log_ref: string;
        component?: string | undefined;
    }>, "many">;
    current_ui_state: z.ZodObject<{
        last_snapshot_ref: z.ZodOptional<z.ZodString>;
        pending_verifications: z.ZodNumber;
        known_issues: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        pending_verifications: number;
        known_issues: string[];
        last_snapshot_ref?: string | undefined;
    }, {
        pending_verifications: number;
        known_issues: string[];
        last_snapshot_ref?: string | undefined;
    }>;
    preferences_active: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    version: 1;
    session_id: string;
    updated_at: string;
    decisions_summary: {
        route: string;
        latest_change: string;
        decision_count: number;
        full_log_ref: string;
        component?: string | undefined;
    }[];
    current_ui_state: {
        pending_verifications: number;
        known_issues: string[];
        last_snapshot_ref?: string | undefined;
    };
    preferences_active: number;
    active_route?: string | undefined;
}, {
    version: 1;
    session_id: string;
    updated_at: string;
    decisions_summary: {
        route: string;
        latest_change: string;
        decision_count: number;
        full_log_ref: string;
        component?: string | undefined;
    }[];
    current_ui_state: {
        pending_verifications: number;
        known_issues: string[];
        last_snapshot_ref?: string | undefined;
    };
    preferences_active: number;
    active_route?: string | undefined;
}>;
/**
 * Request to compact current context
 */
declare const CompactionRequestSchema: z.ZodObject<{
    reason: z.ZodEnum<["session_ending", "context_limit", "manual"]>;
    preserve_decisions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    reason: "session_ending" | "context_limit" | "manual";
    preserve_decisions?: string[] | undefined;
}, {
    reason: "session_ending" | "context_limit" | "manual";
    preserve_decisions?: string[] | undefined;
}>;
/**
 * Result of context compaction
 */
declare const CompactionResultSchema: z.ZodObject<{
    compact_context: z.ZodObject<{
        version: z.ZodLiteral<1>;
        session_id: z.ZodString;
        updated_at: z.ZodString;
        active_route: z.ZodOptional<z.ZodString>;
        decisions_summary: z.ZodArray<z.ZodObject<{
            route: z.ZodString;
            component: z.ZodOptional<z.ZodString>;
            latest_change: z.ZodString;
            decision_count: z.ZodNumber;
            full_log_ref: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            route: string;
            latest_change: string;
            decision_count: number;
            full_log_ref: string;
            component?: string | undefined;
        }, {
            route: string;
            latest_change: string;
            decision_count: number;
            full_log_ref: string;
            component?: string | undefined;
        }>, "many">;
        current_ui_state: z.ZodObject<{
            last_snapshot_ref: z.ZodOptional<z.ZodString>;
            pending_verifications: z.ZodNumber;
            known_issues: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            pending_verifications: number;
            known_issues: string[];
            last_snapshot_ref?: string | undefined;
        }, {
            pending_verifications: number;
            known_issues: string[];
            last_snapshot_ref?: string | undefined;
        }>;
        preferences_active: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        version: 1;
        session_id: string;
        updated_at: string;
        decisions_summary: {
            route: string;
            latest_change: string;
            decision_count: number;
            full_log_ref: string;
            component?: string | undefined;
        }[];
        current_ui_state: {
            pending_verifications: number;
            known_issues: string[];
            last_snapshot_ref?: string | undefined;
        };
        preferences_active: number;
        active_route?: string | undefined;
    }, {
        version: 1;
        session_id: string;
        updated_at: string;
        decisions_summary: {
            route: string;
            latest_change: string;
            decision_count: number;
            full_log_ref: string;
            component?: string | undefined;
        }[];
        current_ui_state: {
            pending_verifications: number;
            known_issues: string[];
            last_snapshot_ref?: string | undefined;
        };
        preferences_active: number;
        active_route?: string | undefined;
    }>;
    archived_to: z.ZodString;
    decisions_compacted: z.ZodNumber;
    decisions_preserved: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    compact_context: {
        version: 1;
        session_id: string;
        updated_at: string;
        decisions_summary: {
            route: string;
            latest_change: string;
            decision_count: number;
            full_log_ref: string;
            component?: string | undefined;
        }[];
        current_ui_state: {
            pending_verifications: number;
            known_issues: string[];
            last_snapshot_ref?: string | undefined;
        };
        preferences_active: number;
        active_route?: string | undefined;
    };
    archived_to: string;
    decisions_compacted: number;
    decisions_preserved: number;
}, {
    compact_context: {
        version: 1;
        session_id: string;
        updated_at: string;
        decisions_summary: {
            route: string;
            latest_change: string;
            decision_count: number;
            full_log_ref: string;
            component?: string | undefined;
        }[];
        current_ui_state: {
            pending_verifications: number;
            known_issues: string[];
            last_snapshot_ref?: string | undefined;
        };
        preferences_active: number;
        active_route?: string | undefined;
    };
    archived_to: string;
    decisions_compacted: number;
    decisions_preserved: number;
}>;
/**
 * Operators for comparing CSS/semantic property values
 */
declare const DesignCheckOperatorSchema: z.ZodEnum<["eq", "gt", "lt", "contains", "not", "exists", "truthy"]>;
/**
 * A single verifiable check against a CSS property or semantic state
 */
declare const DesignCheckSchema: z.ZodObject<{
    property: z.ZodString;
    operator: z.ZodEnum<["eq", "gt", "lt", "contains", "not", "exists", "truthy"]>;
    value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    value: string | number;
    property: string;
    operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
    confidence: number;
}, {
    value: string | number;
    property: string;
    operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
    confidence: number;
}>;
/**
 * A structured UI change description captured at write-time (~95% accuracy)
 */
declare const DesignChangeSchema: z.ZodObject<{
    description: z.ZodString;
    element: z.ZodString;
    checks: z.ZodArray<z.ZodObject<{
        property: z.ZodString;
        operator: z.ZodEnum<["eq", "gt", "lt", "contains", "not", "exists", "truthy"]>;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string | number;
        property: string;
        operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
        confidence: number;
    }, {
        value: string | number;
        property: string;
        operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
        confidence: number;
    }>, "many">;
    source: z.ZodEnum<["structured", "parsed"]>;
    platform: z.ZodOptional<z.ZodEnum<["web", "ios", "macos"]>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    timestamp: string;
    element: string;
    source: "structured" | "parsed";
    checks: {
        value: string | number;
        property: string;
        operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
        confidence: number;
    }[];
    platform?: "web" | "ios" | "macos" | undefined;
}, {
    description: string;
    timestamp: string;
    element: string;
    source: "structured" | "parsed";
    checks: {
        value: string | number;
        property: string;
        operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
        confidence: number;
    }[];
    platform?: "web" | "ios" | "macos" | undefined;
}>;
/**
 * Extended DecisionEntry with optional design checks attached
 */
declare const DecisionEntryWithChecksSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    route: z.ZodString;
    component: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["css_change", "layout_change", "color_change", "spacing_change", "component_add", "component_remove", "component_modify", "content_change"]>;
    description: z.ZodString;
    rationale: z.ZodOptional<z.ZodString>;
    before: z.ZodOptional<z.ZodObject<{
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        html_snippet: z.ZodOptional<z.ZodString>;
        screenshot_ref: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    }, {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    }>>;
    after: z.ZodOptional<z.ZodObject<{
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        html_snippet: z.ZodOptional<z.ZodString>;
        screenshot_ref: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    }, {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    }>>;
    files_changed: z.ZodArray<z.ZodString, "many">;
    session_id: z.ZodOptional<z.ZodString>;
} & {
    checks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        property: z.ZodString;
        operator: z.ZodEnum<["eq", "gt", "lt", "contains", "not", "exists", "truthy"]>;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string | number;
        property: string;
        operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
        confidence: number;
    }, {
        value: string | number;
        property: string;
        operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
        confidence: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "css_change" | "layout_change" | "color_change" | "spacing_change" | "component_add" | "component_remove" | "component_modify" | "content_change";
    description: string;
    id: string;
    timestamp: string;
    route: string;
    files_changed: string[];
    component?: string | undefined;
    before?: {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    } | undefined;
    after?: {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    } | undefined;
    rationale?: string | undefined;
    session_id?: string | undefined;
    checks?: {
        value: string | number;
        property: string;
        operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
        confidence: number;
    }[] | undefined;
}, {
    type: "css_change" | "layout_change" | "color_change" | "spacing_change" | "component_add" | "component_remove" | "component_modify" | "content_change";
    description: string;
    id: string;
    timestamp: string;
    route: string;
    files_changed: string[];
    component?: string | undefined;
    before?: {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    } | undefined;
    after?: {
        css?: Record<string, string> | undefined;
        html_snippet?: string | undefined;
        screenshot_ref?: string | undefined;
    } | undefined;
    rationale?: string | undefined;
    session_id?: string | undefined;
    checks?: {
        value: string | number;
        property: string;
        operator: "contains" | "gt" | "lt" | "exists" | "eq" | "not" | "truthy";
        confidence: number;
    }[] | undefined;
}>;
type DecisionType = z.infer<typeof DecisionTypeSchema>;
type DecisionState = z.infer<typeof DecisionStateSchema>;
type DecisionEntry = z.infer<typeof DecisionEntrySchema>;
type DecisionEntryWithChecks = z.infer<typeof DecisionEntryWithChecksSchema>;
type DecisionSummary = z.infer<typeof DecisionSummarySchema>;
type CurrentUIState = z.infer<typeof CurrentUIStateSchema>;
type CompactContext = z.infer<typeof CompactContextSchema>;
type CompactionRequest = z.infer<typeof CompactionRequestSchema>;
type CompactionResult = z.infer<typeof CompactionResultSchema>;
type DesignCheckOperator = z.infer<typeof DesignCheckOperatorSchema>;
type DesignCheck = z.infer<typeof DesignCheckSchema>;
type DesignChange = z.infer<typeof DesignChangeSchema>;

/**
 * Options for recording a UI decision
 */
interface RecordDecisionOptions {
    route: string;
    type: DecisionType;
    description: string;
    component?: string;
    rationale?: string;
    before?: DecisionState;
    after?: DecisionState;
    files_changed: string[];
    session_id?: string;
}
/**
 * Options for querying decisions
 */
interface QueryDecisionsOptions {
    route?: string;
    component?: string;
    type?: DecisionType;
    since?: string;
    limit?: number;
}
/**
 * Record a UI decision to the JSONL log for its route
 */
declare function recordDecision(outputDir: string, options: RecordDecisionOptions): Promise<DecisionEntry>;
/**
 * Read all decisions from a route's JSONL log
 */
declare function getDecisionsByRoute(outputDir: string, route: string): Promise<DecisionEntry[]>;
/**
 * Query decisions across all routes with filtering
 */
declare function queryDecisions(outputDir: string, options?: QueryDecisionsOptions): Promise<DecisionEntry[]>;
/**
 * Get a single decision by ID (searches all route logs)
 */
declare function getDecision(outputDir: string, decisionId: string): Promise<DecisionEntry | null>;
/**
 * Get list of routes that have decision logs
 */
declare function getTrackedRoutes(outputDir: string): Promise<string[]>;
/**
 * Get decision counts by route
 */
declare function getDecisionStats(outputDir: string): Promise<{
    total: number;
    byRoute: Record<string, number>;
    byType: Record<string, number>;
}>;
/**
 * Get the size of the decisions directory in bytes
 */
declare function getDecisionsSize(outputDir: string): Promise<number>;

/**
 * Load the current compact context, or create a default one
 */
declare function loadCompactContext(outputDir: string, sessionId?: string): Promise<CompactContext>;
/**
 * Save compact context to disk
 */
declare function saveCompactContext(outputDir: string, context: CompactContext): Promise<void>;
/**
 * Update compact context with latest decisions from logs
 * Rebuilds the decisions_summary from the JSONL decision logs
 */
declare function updateCompactContext(outputDir: string, sessionId?: string): Promise<CompactContext>;
/**
 * Compact and archive current context
 */
declare function compactContext(outputDir: string, request: CompactionRequest): Promise<CompactionResult>;
/**
 * Set the active route being worked on
 */
declare function setActiveRoute(outputDir: string, route: string): Promise<CompactContext>;
/**
 * Add a known issue to the UI state
 */
declare function addKnownIssue(outputDir: string, issue: string): Promise<CompactContext>;
/**
 * Check if compact context exceeds the 4KB target
 */
declare function isCompactContextOversize(outputDir: string): Promise<boolean>;

interface LayoutCollision {
    element1: {
        selector: string;
        text: string;
        bounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    };
    element2: {
        selector: string;
        text: string;
        bounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    };
    overlapArea: number;
    overlapPercent: number;
}
interface LayoutCollisionResult {
    collisions: LayoutCollision[];
    hasCollisions: boolean;
}

/**
 * Comprehensive UI scan result combining all IBR analysis capabilities
 */
interface ScanResult {
    url: string;
    route: string;
    timestamp: string;
    viewport: Viewport;
    /** Element extraction: all interactive elements with computed styles */
    elements: {
        all: EnhancedElement[];
        audit: AuditResult;
    };
    /** Interactivity analysis: buttons, links, forms with handler detection */
    interactivity: InteractivityResult;
    /** Semantic understanding: page intent, auth/loading/error states */
    semantic: SemanticResult;
    /** Console output captured during page load */
    console: {
        errors: string[];
        warnings: string[];
    };
    /** AX tree coverage report — gaps like canvas, iframes, shadow DOM */
    coverage?: CoverageReport;
    /** Layout collision detection — overlapping text elements */
    layoutCollisions?: LayoutCollisionResult;
    /** Theme consistency — detects light content on dark page (and vice versa) */
    themeAnalysis?: ThemeAnalysis;
    /** Design system check results — principle violations, token compliance */
    designSystem?: DesignSystemResult;
    /** Overall scan verdict */
    verdict: 'PASS' | 'ISSUES' | 'FAIL' | 'PARTIAL';
    /** If verdict is PARTIAL, explains why the scan is incomplete */
    partialReason?: string;
    issues: ScanIssue[];
    summary: string;
}
/**
 * Individual issue found during scan
 */
interface ScanIssue {
    category: 'interactivity' | 'accessibility' | 'semantic' | 'console' | 'structure' | 'design-system';
    severity: 'error' | 'warning' | 'info';
    element?: string;
    description: string;
    fix?: string;
}
/**
 * Options for running a scan
 */
interface ScanOptions {
    /** Viewport to use (default: desktop) */
    viewport?: keyof typeof VIEWPORTS | Viewport;
    /** Timeout for page load in ms (default: 30000) */
    timeout?: number;
    /** Wait for this selector before scanning */
    waitFor?: string;
    /** IBR output directory for auth state */
    outputDir?: string;
    /** Whether to capture a screenshot */
    screenshot?: {
        path: string;
        fullPage?: boolean;
    };
    /** Network idle timeout in ms (default: 10000). Set higher for slow async pages */
    networkIdleTimeout?: number;
    /** Patience mode: extends all wait timeouts. Use for AI search / LLM result pages */
    patience?: number;
}
/**
 * Run a comprehensive UI scan on a URL.
 *
 * Combines all IBR analysis capabilities into a single scan:
 * 1. Element extraction (computed styles, bounds, handlers)
 * 2. Interactivity testing (buttons, links, forms)
 * 3. Semantic analysis (page intent, auth/loading/error states)
 * 4. Console error capture
 * 5. Issue aggregation with verdict
 */
declare function scan(url: string, options?: ScanOptions): Promise<ScanResult>;
/**
 * Format scan result for console output
 */
declare function formatScanResult(result: ScanResult): string;

/**
 * Design Token Validation
 *
 * Compares UI elements against a design token specification.
 * Checks touch targets, font sizes, colors, spacing, and corner radius.
 */

interface DesignTokenSpec {
    name: string;
    tokens: {
        colors?: Record<string, string>;
        spacing?: Record<string, number>;
        fontSizes?: Record<string, number>;
        touchTargets?: {
            min: number;
        };
        cornerRadius?: Record<string, number>;
    };
}
interface TokenViolation {
    element: string;
    property: string;
    expected: string | number;
    actual: string | number;
    severity: 'error' | 'warning';
    message: string;
}
/**
 * Load a design token spec from a JSON file
 */
declare function loadTokenSpec(specPath: string): DesignTokenSpec;
/**
 * Normalize color to lowercase hex format for comparison
 */
declare function normalizeColor(color: string): string;
/**
 * Validate UI elements against a design token specification
 */
declare function validateAgainstTokens(elements: EnhancedElement[], spec: DesignTokenSpec): TokenViolation[];

/**
 * Simulator device from `xcrun simctl list devices --json`
 */
interface SimulatorDevice {
    udid: string;
    name: string;
    state: 'Booted' | 'Shutdown' | 'Creating' | 'Shutting Down';
    runtime: string;
    platform: 'ios' | 'watchos';
    isAvailable: boolean;
}
/**
 * Options for capturing a native screenshot
 */
interface NativeCaptureOptions {
    device: SimulatorDevice;
    outputPath: string;
    /** Mask type for non-rectangular displays (watchOS) */
    mask?: 'black' | 'alpha' | 'ignored';
}
/**
 * Result from capturing a native screenshot
 */
interface NativeCaptureResult {
    success: boolean;
    outputPath?: string;
    device: SimulatorDevice;
    viewport: Viewport;
    timing: number;
    error?: string;
}
/**
 * Options for scanning a native simulator
 */
interface NativeScanOptions {
    /** Device name fragment, UDID, or undefined for first booted */
    device?: string;
    /** App bundle ID (for future use) */
    bundleId?: string;
    /** Whether to capture a screenshot */
    screenshot?: boolean;
    /** Output directory */
    outputDir?: string;
}
/**
 * Result from scanning a native simulator
 */
interface NativeScanResult {
    url: string;
    route: string;
    timestamp: string;
    viewport: Viewport;
    platform: 'ios' | 'watchos';
    device: {
        name: string;
        udid: string;
        runtime: string;
    };
    /** Extracted elements mapped to EnhancedElement format */
    elements: {
        all: EnhancedElement[];
        audit: AuditResult;
    };
    /** Native-specific audit issues */
    nativeIssues: ElementIssue[];
    /** Screenshot path if captured */
    screenshotPath?: string;
    /** Overall scan verdict */
    verdict: 'PASS' | 'ISSUES' | 'FAIL';
    issues: ScanIssue[];
    summary: string;
}
/**
 * Native accessibility element from the Swift AXUIElement extractor
 */
interface NativeElement {
    /** Accessibility identifier (maps to selector) */
    identifier: string;
    /** Accessibility label */
    label: string;
    /** Role (e.g., AXButton, AXStaticText, AXImage) */
    role: string;
    /** Accessibility traits */
    traits: string[];
    /** Frame in points: { x, y, width, height } */
    frame: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** Whether the element is enabled */
    isEnabled: boolean;
    /** Current value (for inputs, sliders, etc.) */
    value: string | null;
    /** Child elements */
    children: NativeElement[];
}
/**
 * AX element from the Swift extractor in macOS app mode (full format)
 */
interface MacOSAXElement {
    role: string;
    subrole: string | null;
    title: string | null;
    description: string | null;
    identifier: string | null;
    value: string | null;
    enabled: boolean;
    focused: boolean;
    actions: string[];
    position: {
        x: number;
        y: number;
    } | null;
    size: {
        width: number;
        height: number;
    } | null;
    children: MacOSAXElement[];
    /** Index path from the window root — e.g. [0, 2, 1] — used for action targeting */
    path: number[];
}
/**
 * Window info parsed from the WINDOW: header line
 */
interface MacOSWindowInfo {
    windowId: number;
    width: number;
    height: number;
    title: string;
}
/**
 * Options for scanning a running macOS native app
 */
interface MacOSScanOptions {
    /** App name to find (e.g., "Secrets Vault") */
    app?: string;
    /** Bundle identifier (e.g., "com.secretsvault.app") */
    bundleId?: string;
    /** Direct process ID */
    pid?: number;
    /** Capture screenshot */
    screenshot?: {
        path: string;
    };
}
/**
 * Result from scanning a macOS native app
 * Same shape as web ScanResult for interoperability
 */
interface MacOSScanResult {
    url: string;
    route: string;
    timestamp: string;
    viewport: Viewport;
    /** Extracted elements mapped to EnhancedElement format */
    elements: {
        all: EnhancedElement[];
        audit: AuditResult;
    };
    /** Interactivity analysis built from AX data */
    interactivity: InteractivityResult;
    /** Semantic understanding from element composition */
    semantic: SemanticResult;
    /** No console for native apps */
    console: {
        errors: string[];
        warnings: string[];
    };
    /** Overall scan verdict */
    verdict: 'PASS' | 'ISSUES' | 'FAIL';
    issues: ScanIssue[];
    summary: string;
}

/**
 * Native device viewport dimensions in points
 * These match the logical (non-Retina) dimensions used by simulators
 */
declare const NATIVE_VIEWPORTS: Record<string, Viewport>;
/**
 * Get the viewport dimensions for a simulator device
 * Falls back to reasonable defaults based on platform
 */
declare function getDeviceViewport(device: SimulatorDevice): Viewport;

/**
 * List all available simulator devices
 */
declare function listDevices(): Promise<SimulatorDevice[]>;
/**
 * Find a device by name fragment or exact UDID
 * Prioritizes booted devices, then available ones
 */
declare function findDevice(nameOrUdid: string): Promise<SimulatorDevice | null>;
/**
 * Get all currently booted simulator devices
 */
declare function getBootedDevices(): Promise<SimulatorDevice[]>;
/**
 * Boot a simulator device if not already running
 */
declare function bootDevice(udid: string): Promise<void>;
/**
 * Format device info for display
 */
declare function formatDevice(device: SimulatorDevice): string;

/**
 * Capture a screenshot from a running simulator
 *
 * Uses `xcrun simctl io <udid> screenshot` to capture the current screen.
 * For watchOS devices, applies --mask=black by default to handle round displays.
 */
declare function captureNativeScreenshot(options: NativeCaptureOptions): Promise<NativeCaptureResult>;

/**
 * Ensure the Swift AXUIElement extractor is compiled
 * Compiles on first use, then caches at .ibr/bin/ibr-ax-extract
 */
declare function ensureExtractor(): Promise<string>;
/**
 * Check if the Swift extractor is available (compiled or can be compiled)
 */
declare function isExtractorAvailable(): boolean;
/**
 * Extract native accessibility elements from a running simulator
 *
 * Uses the compiled Swift CLI to walk the Simulator.app's accessibility tree
 * via AXUIElementCreateApplication.
 */
declare function extractNativeElements(device: SimulatorDevice): Promise<NativeElement[]>;
/**
 * Map native accessibility elements to IBR's EnhancedElement format
 *
 * This allows reuse of existing analyzeElements() from src/extract.ts.
 */
declare function mapToEnhancedElements(nativeElements: NativeElement[]): EnhancedElement[];

/**
 * Run native-specific audit rules on extracted elements
 *
 * These rules supplement the standard web audit with platform-specific checks:
 * - watchOS: max 7 interactive elements per screen
 * - watchOS: no horizontal overflow beyond viewport width
 * - iOS/watchOS: 44pt minimum touch targets (always enforced, not just mobile)
 */
declare function auditNativeElements(elements: EnhancedElement[], platform: 'ios' | 'watchos', viewport: Viewport): ElementIssue[];

/**
 * Run a comprehensive native simulator scan
 *
 * Orchestrates: device resolution → boot → screenshot → element extraction → audit → verdict
 *
 * Falls back to screenshot-only mode if the Swift AXUIElement extractor is unavailable.
 */
declare function scanNative(options?: NativeScanOptions): Promise<NativeScanResult>;
/**
 * Run a comprehensive scan of a running macOS native app
 *
 * Uses the Accessibility API (AXUIElement) to extract the full view hierarchy,
 * then runs the same analysis pipeline as web scans.
 *
 * Produces a MacOSScanResult with the same shape as web ScanResult.
 */
declare function scanMacOS(options: MacOSScanOptions): Promise<MacOSScanResult>;
/**
 * Format macOS scan result for console output
 */
declare function formatMacOSScanResult(result: MacOSScanResult): string;
/**
 * Format native scan result for console output
 */
declare function formatNativeScanResult(result: NativeScanResult): string;

/**
 * Find the PID of a running macOS app by name or bundle ID
 *
 * Strategy:
 * 1. Try lsappinfo for exact bundle ID match
 * 2. Fall back to pgrep for process name match
 */
declare function findProcess(appNameOrBundleId: string): Promise<number>;
/**
 * Extract native AX elements from a running macOS app via the Swift CLI
 *
 * Returns the parsed elements and window metadata.
 */
declare function extractMacOSElements(options: {
    pid?: number;
    app?: string;
}): Promise<{
    elements: MacOSAXElement[];
    window: MacOSWindowInfo;
}>;
/**
 * Map macOS AX elements to IBR's EnhancedElement format
 *
 * Flattens the tree depth-first and generates unique selectors
 * from the tree path (e.g., "AXWindow > AXGroup[0] > AXButton[1]").
 */
declare function mapMacOSToEnhancedElements(nativeElements: MacOSAXElement[], parentPath?: string): EnhancedElement[];
/**
 * Capture a screenshot of a macOS window by its CGWindowID
 *
 * Uses the built-in `screencapture -l <windowID>` command.
 */
declare function captureMacOSScreenshot(windowId: number, outputPath: string): Promise<void>;

/**
 * Build an InteractivityResult from extracted native EnhancedElements
 *
 * Since we extract handler/action info from AX attributes (hasOnClick from AXPress),
 * we can build the same interactivity analysis without Playwright.
 */
declare function buildNativeInteractivity(elements: EnhancedElement[]): InteractivityResult;

/**
 * Build a minimal SemanticResult from native app element composition
 *
 * Since we can't run Playwright page.evaluate(), we derive semantic
 * understanding from the extracted elements and window metadata.
 */
declare function buildNativeSemantic(elements: EnhancedElement[], window: MacOSWindowInfo): SemanticResult;

interface AnnotationTarget {
    id: number;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
declare function annotateScreenshot(screenshotPath: string, issues: AnnotationTarget[]): Promise<string | null>;

/**
 * IBR↔NavGator Bridge
 *
 * Correlates runtime AX elements (from IBR native scan) with source code
 * locations (from NavGator architecture data or direct Swift file scanning).
 *
 * Independence model:
 * - If NavGator data exists at .navgator/architecture/, uses file_map.json
 *   to locate Swift files and component data for enrichment.
 * - If NavGator data is absent, falls back to globbing .swift files
 *   from the project root.
 * - IBR works standalone; bridge gracefully degrades without NavGator.
 */

interface SourceCorrelation {
    /** Element selector or identifier from AX tree */
    elementSelector: string;
    /** Element label/text for display */
    elementLabel: string;
    /** Matched Swift source file (relative to project root) */
    sourceFile: string;
    /** Line number in source */
    sourceLine: number;
    /** View struct name if identified */
    viewName: string | null;
    /** Matched modifier/declaration text */
    matchedSnippet: string;
    /** Match strategy used */
    matchType: 'identifier' | 'label' | 'text' | 'view-name';
    /** Confidence: 1.0=identifier, 0.8=label, 0.6=text, 0.5=view-name */
    confidence: number;
}
interface BridgeResult {
    projectRoot: string;
    navgatorAvailable: boolean;
    swiftFilesScanned: number;
    correlations: SourceCorrelation[];
    unmatchedElements: string[];
}

/**
 * Fix Guide Generator
 *
 * Takes scan results + source correlations and produces structured fix
 * instructions that Claude Code can act on.
 */

interface FixableIssue {
    id: number;
    category: string;
    severity: 'error' | 'warning';
    what: string;
    where: {
        element: string;
        bounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        screenRegion: string;
    };
    current: string;
    required: string;
    source?: {
        file: string;
        line?: number;
        confidence: number;
        matchedOn: string;
        searchPattern: string;
    };
    suggestedFix: string;
}
interface FixGuide {
    screenshot: string;
    screenshotRaw: string;
    issues: FixableIssue[];
    summary: string;
}
declare function generateFixGuide(scanResult: NativeScanResult, bridgeResult: BridgeResult | null, annotatedScreenshot: string | null): FixGuide;

/**
 * Options for standalone compare function
 */
interface CompareInput {
    /** URL to capture and compare (will auto-capture current state) */
    url?: string;
    /** Path to baseline image (required if no url) */
    baselinePath?: string;
    /** Path to current image (auto-captured if url provided) */
    currentPath?: string;
    /** Pixel difference threshold (0-100, default 1.0) */
    threshold?: number;
    /** Output directory for diff and temp files */
    outputDir?: string;
    /** Viewport configuration */
    viewport?: 'desktop' | 'mobile' | 'tablet' | Viewport;
    /** Capture full page */
    fullPage?: boolean;
    /** Wait for network idle before capture */
    waitForNetworkIdle?: boolean;
    /** Capture timeout in ms */
    timeout?: number;
}
/**
 * Result from standalone compare function
 */
interface CompareResult {
    /** Whether images match within threshold */
    match: boolean;
    /** Percentage of pixels that differ */
    diffPercent: number;
    /** Number of differing pixels */
    diffPixels: number;
    /** Total pixels compared */
    totalPixels: number;
    /** Analysis verdict: MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN */
    verdict: string;
    /** Human-readable summary */
    summary: string;
    /** Regions with changes */
    changedRegions: Array<{
        location: string;
        description: string;
        severity: 'expected' | 'unexpected' | 'critical';
    }>;
    /** Recommendation for fixing issues */
    recommendation: string | null;
    /** Path to diff image (if generated) */
    diffPath?: string;
    /** Path to baseline used */
    baselinePath: string;
    /** Path to current image used */
    currentPath: string;
}
/**
 * Standalone compare function - compare images without session management
 *
 * @example
 * ```typescript
 * // Compare by URL (auto-captures current state)
 * const result = await compare({
 *   url: 'http://localhost:3000',
 *   baselinePath: './baseline.png'
 * });
 *
 * // Compare two existing images
 * const result = await compare({
 *   baselinePath: './baseline.png',
 *   currentPath: './current.png'
 * });
 *
 * // Compare URL with auto threshold
 * const result = await compare({
 *   url: 'http://localhost:3000',
 *   baselinePath: './baseline.png',
 *   threshold: 0.5  // 0.5% difference allowed
 * });
 * ```
 */
declare function compare(options: CompareInput): Promise<CompareResult>;
/**
 * Options for batch comparison
 */
interface CompareAllInput {
    /** Session ID to compare (uses most recent if not provided) */
    sessionId?: string;
    /** Output directory (defaults to .ibr) */
    outputDir?: string;
    /** Only compare sessions matching this URL pattern */
    urlPattern?: string | RegExp;
    /** Only compare sessions with these statuses */
    statuses?: Array<'baseline' | 'compared' | 'pending'>;
    /** Maximum number of sessions to compare */
    limit?: number;
}
/**
 * Batch compare all sessions or a filtered subset
 *
 * @example
 * ```typescript
 * // Compare all sessions
 * const results = await compareAll();
 *
 * // Compare sessions matching URL
 * const results = await compareAll({
 *   urlPattern: /\/dashboard/
 * });
 *
 * // Compare specific session
 * const results = await compareAll({
 *   sessionId: 'sess_abc123'
 * });
 * ```
 */
declare function compareAll(options?: CompareAllInput): Promise<CompareResult[]>;
declare class InterfaceBuiltRight {
    private config;
    constructor(options?: Partial<Config>);
    /**
     * Start a visual session by capturing a baseline screenshot
     */
    startSession(path: string, options?: StartSessionOptions): Promise<StartSessionResult>;
    /**
     * Check current state against baseline
     */
    check(sessionId?: string): Promise<ComparisonReport>;
    /**
     * Get a session by ID
     */
    getSession(sessionId: string): Promise<Session | null>;
    /**
     * Get the most recent session
     */
    getMostRecentSession(): Promise<Session | null>;
    /**
     * List all sessions
     */
    listSessions(): Promise<Session[]>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<boolean>;
    /**
     * Clean old sessions
     */
    clean(options?: CleanOptions): Promise<{
        deleted: string[];
        kept: string[];
    }>;
    /**
     * Find sessions matching query criteria
     */
    find(query?: Partial<SessionQuery>): Promise<Session[]>;
    /**
     * Get timeline of sessions for a specific route
     * Returns sessions in chronological order (oldest first)
     */
    getTimeline(route: string, limit?: number): Promise<Session[]>;
    /**
     * Get sessions grouped by route
     */
    getSessionsByRoute(): Promise<Record<string, Session[]>>;
    /**
     * Get session statistics
     */
    getStats(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        byViewport: Record<string, number>;
        byVerdict: Record<string, number>;
    }>;
    /**
     * Update baseline with current screenshot
     */
    updateBaseline(sessionId?: string): Promise<Session>;
    /**
     * Start a simplified session with semantic understanding
     *
     * This is the new simpler API - one line to start:
     * ```typescript
     * const session = await ibr.start('http://localhost:3000');
     * const understanding = await session.understand();
     * ```
     */
    start(url: string, options?: {
        viewport?: 'desktop' | 'mobile' | 'tablet';
        waitFor?: string;
        timeout?: number;
    }): Promise<IBRSession>;
    /**
     * Close the browser instance
     */
    close(): Promise<void>;
    /**
     * Get configuration
     */
    getConfig(): Config;
    /**
     * Resolve a path to full URL
     */
    private resolveUrl;
    /**
     * Generate a session name from path
     */
    private generateSessionName;
}
/**
 * IBRSession - Simplified session with semantic understanding
 *
 * Provides a cleaner API for interacting with pages and getting
 * AI-friendly semantic output.
 */
declare class IBRSession {
    /** Page interface for browser interaction */
    readonly page: CompatPage;
    private driver;
    private config;
    constructor(page: CompatPage, driver: EngineDriver, config: Config);
    /**
     * Get semantic understanding of the current page
     */
    understand(): Promise<SemanticResult>;
    /**
     * Get semantic understanding as formatted text
     */
    understandText(): Promise<string>;
    /**
     * Click an element by selector
     */
    click(selector: string): Promise<void>;
    /**
     * Type text into an element
     */
    type(selector: string, text: string): Promise<void>;
    /**
     * Navigate to a new URL
     */
    goto(url: string): Promise<void>;
    /**
     * Wait for a selector to appear
     */
    waitFor(selector: string, timeout?: number): Promise<void>;
    /**
     * Take a screenshot
     */
    screenshot(path?: string): Promise<Buffer>;
    /**
     * Mock a network request.
     * NOTE: Network mocking requires CDP Fetch domain support (not yet implemented).
     * This is a placeholder that throws until CDP Fetch is added to the engine.
     */
    mock(_pattern: string | RegExp, _response: {
        status?: number;
        body?: string | object;
        headers?: Record<string, string>;
    }): Promise<void>;
    /**
     * Built-in flows for common automation patterns
     */
    readonly flow: {
        /**
         * Login with email/password
         * @example
         * const result = await session.flow.login({ email: 'test@test.com', password: 'secret' });
         */
        login: (options: Omit<FlowLoginOptions, "timeout">) => Promise<LoginResult>;
        /**
         * Search for content
         * @example
         * const result = await session.flow.search({ query: 'test' });
         */
        search: (options: Omit<FlowSearchOptions, "timeout">) => Promise<SearchResult>;
        /**
         * Fill and submit a form
         * @example
         * const result = await session.flow.form({
         *   fields: [{ name: 'email', value: 'test@test.com' }]
         * });
         */
        form: (options: Omit<FlowFormOptions, "timeout">) => Promise<FormResult>;
    };
    /**
     * Measure Web Vitals performance metrics
     * @example
     * const result = await session.measurePerformance();
     * console.log(result.ratings.LCP); // { value: 1200, rating: 'good' }
     */
    measurePerformance(): Promise<PerformanceResult>;
    /**
     * Test interactivity of buttons, links, and forms
     * @example
     * const result = await session.testInteractivity();
     * console.log(result.issues); // List of issues with buttons/links
     */
    testInteractivity(): Promise<InteractivityResult>;
    /**
     * Start tracking API request timing
     * Call before actions, then call stop() to get results
     * @example
     * const tracker = session.trackApiTiming({ filter: /\/api\// });
     * tracker.start();
     * await session.click('button');
     * const result = tracker.stop();
     */
    trackApiTiming(options?: {
        filter?: RegExp;
        includeStatic?: boolean;
        minDuration?: number;
    }): Promise<{
        start(): void;
        stop(): ApiTimingResult;
        getRequests(): ApiRequestTiming[];
    }>;
    /**
     * Close the session and browser
     */
    close(): Promise<void>;
}

export { type A11yAttributes, A11yAttributesSchema, type AISearchOptions, type AISearchResult, type ActivePreference, ActivePreferenceSchema, type Analysis, AnalysisSchema, type ApiCall, type ApiRequestTiming, type ApiRoute, type ApiTimingOptions, type ApiTimingResult, type AuditResult, AuditResultSchema, type AuthOptions, type AuthState, type AvailableAction, type Bounds, BoundsSchema, type ButtonInfo, type CaptureOptions, type CaptureResult, type ChangedRegion, ChangedRegionSchema, type CleanOptions, type CompactContext, CompactContextSchema, type CompactionRequest, CompactionRequestSchema, type CompactionResult, CompactionResultSchema, type CompareAllInput, type CompareInput, type CompareOptions, type CompareResult, type ComparisonReport, ComparisonReportSchema, type ComparisonResult, ComparisonResultSchema, type Config, ConfigSchema, type ConsistencyOptions, type ConsistencyResult, type CrawlOptions, type CrawlResult, type CurrentUIState, CurrentUIStateSchema, DEFAULT_DYNAMIC_SELECTORS, DEFAULT_RETENTION, type DecisionEntry, DecisionEntrySchema, type DecisionEntryWithChecks, DecisionEntryWithChecksSchema, type DecisionState, DecisionStateSchema, type DecisionSummary, DecisionSummarySchema, type DecisionType, DecisionTypeSchema, type DesignChange, DesignChangeSchema, type DesignCheck, type DesignCheckOperator, DesignCheckOperatorSchema, DesignCheckSchema, type DesignSystemResult, DesignSystemResultSchema, type DesignSystemViolation, DesignSystemViolationSchema, type DesignTokenSpec, type DiscoveredPage, type ElementIssue, ElementIssueSchema, type EnhancedElement, EnhancedElementSchema, type ErrorInfo, type ErrorState, type Expectation, type ExpectationOperator, ExpectationOperatorSchema, ExpectationSchema, type ExtendedComparisonResult, type ExtractedResult, type FixGuide, type FixableIssue, type FlowFormOptions, type FlowLoginOptions, type FlowName, type FlowOptions, type FlowResult, type FlowSearchOptions, type FlowStep, type FormField, type FormFieldInfo, type FormInfo, type FormResult, IBRSession, type Inconsistency, type InteractiveElement, type InteractiveState, InteractiveStateSchema, type InteractivityIssue, type InteractivityResult, InterfaceBuiltRight, LANDMARK_SELECTORS, type LandmarkElement, LandmarkElementSchema, type LandmarkType, type LayoutIssue, type LearnedExpectation, LearnedExpectationSchema, type LinkInfo, type LoadingState, type LoginOptions, type LoginResult, type MacOSAXElement, type MacOSScanOptions, type MacOSScanResult, type MacOSWindowInfo, type MaskOptions, type MemorySource, MemorySourceSchema, type MemorySummary, MemorySummarySchema, NATIVE_VIEWPORTS, type NativeCaptureOptions, type NativeCaptureResult, type NativeElement, type NativeScanOptions, type NativeScanResult, type Observation, ObservationSchema, type OperationState, type OperationType, type OutputFormat, PERFORMANCE_THRESHOLDS, type PageIntent, type PageIntentResult, type PageMetrics, type PageState, type PendingOperation, type PerformanceRating, type PerformanceResult, type Preference, type PreferenceCategory, PreferenceCategorySchema, PreferenceSchema, type QueryDecisionsOptions, type RatedMetric, type RecordDecisionOptions, type RecoveryHint, type ResponsiveResult, type ResponsiveTestOptions, type RetentionConfig, type RetentionResult, type RuleAuditResult, RuleAuditResultSchema, type RuleSetting, RuleSettingSchema, type RuleSeverity, RuleSeveritySchema, type RulesConfig, RulesConfigSchema, type ScanIssue, type ScanOptions, type ScanResult, type SearchResult, type SearchTiming, type SemanticIssue, type SemanticResult, type SemanticVerdict, type ServeOptions, type Session, type SessionListItem, type SessionPaths, type SessionQuery, SessionQuerySchema, SessionSchema, type SessionStatus, SessionStatusSchema, type SimulatorDevice, type StartSessionOptions, type StartSessionResult, type StepScreenshot, type TextIssue, type TokenViolation, type TouchTargetIssue, VIEWPORTS, type ValidationContext, type ValidationIssue, type ValidationResult, type Verdict, VerdictSchema, type Viewport, type ViewportResult, ViewportSchema, type Violation, ViolationSchema, type WebVitals, addKnownIssue, addPreference, aiSearchFlow, analyzeComparison, analyzeForObviousIssues, annotateScreenshot, archiveSummary, auditNativeElements, bootDevice, buildNativeInteractivity, buildNativeSemantic, captureMacOSScreenshot, captureNativeScreenshot, captureScreenshot, captureWithDiagnostics, checkConsistency, classifyPageIntent, cleanSessions, closeBrowser, compactContext, compare, compareAll, compareImages, compareLandmarks, completeOperation, createApiTracker, createMemoryPreset, createSession, deleteSession, detectAuthState, detectChangedRegions, detectErrorState, detectLandmarks, detectLoadingState, detectPageState, discoverApiRoutes, discoverPages, enforceRetentionPolicy, ensureExtractor, extractApiCalls, extractMacOSElements, extractNativeElements, filePathToRoute, filterByEndpoint, filterByMethod, findButton, findDevice, findFieldByLabel, findOrphanEndpoints, findProcess, findSessions, flows, formFlow, formatApiTimingResult, formatConsistencyReport, formatDevice, formatInteractivityResult, formatLandmarkComparison, formatMacOSScanResult, formatMemorySummary, formatNativeScanResult, formatPendingOperations, formatPerformanceResult, formatPreference, formatReportJson, formatReportMinimal, formatReportText, formatResponsiveResult, formatRetentionStatus, formatScanResult, formatSemanticJson, formatSemanticText, formatSessionSummary, formatValidationResult, generateDevModePrompt, generateFixGuide, generateQuickSummary, generateReport, generateSessionId, generateValidationContext, generateValidationPrompt, getBootedDevices, getDecision, getDecisionStats, getDecisionsByRoute, getDecisionsSize, getDeviceViewport, getExpectedLandmarksForIntent, getExpectedLandmarksFromContext, getIntentDescription, getMostRecentSession, getNavigationLinks, getPendingOperations, getPreference, getRetentionStatus, getSemanticOutput, getSession, getSessionPaths, getSessionStats, getSessionsByRoute, getTimeline, getTrackedRoutes, getVerdictDescription, getViewport, groupByEndpoint, groupByFile, initMemory, isCompactContextOversize, isExtractorAvailable, learnFromSession, listDevices, listLearned, listPreferences, listSessions, loadCompactContext, loadRetentionConfig, loadSummary, loadTokenSpec, loginFlow, mapMacOSToEnhancedElements, mapToEnhancedElements, markSessionCompared, maybeAutoClean, measureApiTiming, measurePerformance, measureWebVitals, normalizeColor, preferencesToRules, promoteToPreference, queryDecisions, queryMemory, rebuildSummary, recordDecision, registerOperation, removePreference, saveCompactContext, saveSummary, scan, scanDirectoryForApiCalls, scanMacOS, scanNative, searchFlow, setActiveRoute, testInteractivity, testResponsive, updateCompactContext, updateSession, validateAgainstTokens, waitForCompletion, waitForNavigation, waitForPageReady, withOperationTracking };
