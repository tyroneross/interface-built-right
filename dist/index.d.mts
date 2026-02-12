import { Page, Browser, BrowserContext } from 'playwright';
import { z } from 'zod';

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
declare function testInteractivity(page: Page): Promise<InteractivityResult>;
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
declare function measureWebVitals(page: Page): Promise<WebVitals>;
/**
 * Measure performance and return rated results
 */
declare function measurePerformance(page: Page): Promise<PerformanceResult>;
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
declare function findFieldByLabel(page: Page, labels: string[]): Promise<ReturnType<Page['$']>>;
/**
 * Find a button by common patterns
 */
declare function findButton(page: Page, patterns: string[]): Promise<ReturnType<Page['$']>>;
/**
 * Wait for navigation or network idle
 */
declare function waitForNavigation(page: Page, timeout?: number): Promise<void>;
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
declare function formFlow(page: Page, options: FlowFormOptions): Promise<FormResult>;

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
declare function searchFlow(page: Page, options: FlowSearchOptions): Promise<SearchResult>;
/**
 * Execute AI-enhanced search flow with screenshots and content extraction
 *
 * This function extends the basic search flow with:
 * - Step-by-step screenshots (before, after-query, results)
 * - Detailed timing breakdown
 * - Extraction of result content for AI validation
 * - User intent tracking for relevance checking
 */
declare function aiSearchFlow(page: Page, options: AISearchOptions): Promise<AISearchResult>;

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
declare function loginFlow(page: Page, options: FlowLoginOptions): Promise<LoginResult>;

/**
 * Viewport configuration for screenshot capture
 * Supports predefined names or custom dimensions
 */
declare const ViewportSchema: z.ZodObject<{
    name: z.ZodString;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, z.core.$strip>;
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
    }, z.core.$strip>>;
    viewports: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, z.core.$strip>>>;
    threshold: z.ZodDefault<z.ZodNumber>;
    fullPage: z.ZodDefault<z.ZodBoolean>;
    waitForNetworkIdle: z.ZodDefault<z.ZodBoolean>;
    timeout: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Session query options
 */
declare const SessionQuerySchema: z.ZodObject<{
    route: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        baseline: "baseline";
        compared: "compared";
        pending: "pending";
    }>>;
    name: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodDate>;
    createdBefore: z.ZodOptional<z.ZodDate>;
    viewport: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Comparison result from pixelmatch
 */
declare const ComparisonResultSchema: z.ZodObject<{
    match: z.ZodBoolean;
    diffPercent: z.ZodNumber;
    diffPixels: z.ZodNumber;
    totalPixels: z.ZodNumber;
    threshold: z.ZodNumber;
}, z.core.$strip>;
/**
 * Changed region detected in comparison
 */
declare const ChangedRegionSchema: z.ZodObject<{
    location: z.ZodEnum<{
        top: "top";
        bottom: "bottom";
        left: "left";
        right: "right";
        center: "center";
        full: "full";
    }>;
    bounds: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, z.core.$strip>;
    description: z.ZodString;
    severity: z.ZodEnum<{
        expected: "expected";
        unexpected: "unexpected";
        critical: "critical";
    }>;
}, z.core.$strip>;
/**
 * Analysis verdict types
 */
declare const VerdictSchema: z.ZodEnum<{
    MATCH: "MATCH";
    EXPECTED_CHANGE: "EXPECTED_CHANGE";
    UNEXPECTED_CHANGE: "UNEXPECTED_CHANGE";
    LAYOUT_BROKEN: "LAYOUT_BROKEN";
}>;
/**
 * Analysis result
 */
declare const AnalysisSchema: z.ZodObject<{
    verdict: z.ZodEnum<{
        MATCH: "MATCH";
        EXPECTED_CHANGE: "EXPECTED_CHANGE";
        UNEXPECTED_CHANGE: "UNEXPECTED_CHANGE";
        LAYOUT_BROKEN: "LAYOUT_BROKEN";
    }>;
    summary: z.ZodString;
    changedRegions: z.ZodArray<z.ZodObject<{
        location: z.ZodEnum<{
            top: "top";
            bottom: "bottom";
            left: "left";
            right: "right";
            center: "center";
            full: "full";
        }>;
        bounds: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, z.core.$strip>;
        description: z.ZodString;
        severity: z.ZodEnum<{
            expected: "expected";
            unexpected: "unexpected";
            critical: "critical";
        }>;
    }, z.core.$strip>>;
    unexpectedChanges: z.ZodArray<z.ZodObject<{
        location: z.ZodEnum<{
            top: "top";
            bottom: "bottom";
            left: "left";
            right: "right";
            center: "center";
            full: "full";
        }>;
        bounds: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, z.core.$strip>;
        description: z.ZodString;
        severity: z.ZodEnum<{
            expected: "expected";
            unexpected: "unexpected";
            critical: "critical";
        }>;
    }, z.core.$strip>>;
    recommendation: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
/**
 * Session status
 */
declare const SessionStatusSchema: z.ZodEnum<{
    baseline: "baseline";
    compared: "compared";
    pending: "pending";
}>;
/**
 * Element bounds (moved up for LandmarkElementSchema dependency)
 */
declare const BoundsSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, z.core.$strip>;
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
    }, z.core.$strip>>;
}, z.core.$strip>;
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
    }, z.core.$strip>;
    status: z.ZodEnum<{
        baseline: "baseline";
        compared: "compared";
        pending: "pending";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    comparison: z.ZodOptional<z.ZodObject<{
        match: z.ZodBoolean;
        diffPercent: z.ZodNumber;
        diffPixels: z.ZodNumber;
        totalPixels: z.ZodNumber;
        threshold: z.ZodNumber;
    }, z.core.$strip>>;
    analysis: z.ZodOptional<z.ZodObject<{
        verdict: z.ZodEnum<{
            MATCH: "MATCH";
            EXPECTED_CHANGE: "EXPECTED_CHANGE";
            UNEXPECTED_CHANGE: "UNEXPECTED_CHANGE";
            LAYOUT_BROKEN: "LAYOUT_BROKEN";
        }>;
        summary: z.ZodString;
        changedRegions: z.ZodArray<z.ZodObject<{
            location: z.ZodEnum<{
                top: "top";
                bottom: "bottom";
                left: "left";
                right: "right";
                center: "center";
                full: "full";
            }>;
            bounds: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, z.core.$strip>;
            description: z.ZodString;
            severity: z.ZodEnum<{
                expected: "expected";
                unexpected: "unexpected";
                critical: "critical";
            }>;
        }, z.core.$strip>>;
        unexpectedChanges: z.ZodArray<z.ZodObject<{
            location: z.ZodEnum<{
                top: "top";
                bottom: "bottom";
                left: "left";
                right: "right";
                center: "center";
                full: "full";
            }>;
            bounds: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, z.core.$strip>;
            description: z.ZodString;
            severity: z.ZodEnum<{
                expected: "expected";
                unexpected: "unexpected";
                critical: "critical";
            }>;
        }, z.core.$strip>>;
        recommendation: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    landmarkElements: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        selector: z.ZodString;
        found: z.ZodBoolean;
        bounds: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    pageIntent: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
    }, z.core.$strip>;
    comparison: z.ZodObject<{
        match: z.ZodBoolean;
        diffPercent: z.ZodNumber;
        diffPixels: z.ZodNumber;
        totalPixels: z.ZodNumber;
        threshold: z.ZodNumber;
    }, z.core.$strip>;
    analysis: z.ZodObject<{
        verdict: z.ZodEnum<{
            MATCH: "MATCH";
            EXPECTED_CHANGE: "EXPECTED_CHANGE";
            UNEXPECTED_CHANGE: "UNEXPECTED_CHANGE";
            LAYOUT_BROKEN: "LAYOUT_BROKEN";
        }>;
        summary: z.ZodString;
        changedRegions: z.ZodArray<z.ZodObject<{
            location: z.ZodEnum<{
                top: "top";
                bottom: "bottom";
                left: "left";
                right: "right";
                center: "center";
                full: "full";
            }>;
            bounds: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, z.core.$strip>;
            description: z.ZodString;
            severity: z.ZodEnum<{
                expected: "expected";
                unexpected: "unexpected";
                critical: "critical";
            }>;
        }, z.core.$strip>>;
        unexpectedChanges: z.ZodArray<z.ZodObject<{
            location: z.ZodEnum<{
                top: "top";
                bottom: "bottom";
                left: "left";
                right: "right";
                center: "center";
                full: "full";
            }>;
            bounds: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, z.core.$strip>;
            description: z.ZodString;
            severity: z.ZodEnum<{
                expected: "expected";
                unexpected: "unexpected";
                critical: "critical";
            }>;
        }, z.core.$strip>>;
        recommendation: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    files: z.ZodObject<{
        baseline: z.ZodString;
        current: z.ZodString;
        diff: z.ZodString;
    }, z.core.$strip>;
    webViewUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
}, z.core.$strip>;
/**
 * Accessibility attributes
 */
declare const A11yAttributesSchema: z.ZodObject<{
    role: z.ZodNullable<z.ZodString>;
    ariaLabel: z.ZodNullable<z.ZodString>;
    ariaDescribedBy: z.ZodNullable<z.ZodString>;
    ariaHidden: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
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
    }, z.core.$strip>;
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
    }, z.core.$strip>;
    a11y: z.ZodObject<{
        role: z.ZodNullable<z.ZodString>;
        ariaLabel: z.ZodNullable<z.ZodString>;
        ariaDescribedBy: z.ZodNullable<z.ZodString>;
        ariaHidden: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    sourceHint: z.ZodOptional<z.ZodObject<{
        dataTestId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Element issue detected during audit
 */
declare const ElementIssueSchema: z.ZodObject<{
    type: z.ZodEnum<{
        NO_HANDLER: "NO_HANDLER";
        PLACEHOLDER_LINK: "PLACEHOLDER_LINK";
        TOUCH_TARGET_SMALL: "TOUCH_TARGET_SMALL";
        MISSING_ARIA_LABEL: "MISSING_ARIA_LABEL";
        DISABLED_NO_VISUAL: "DISABLED_NO_VISUAL";
    }>;
    severity: z.ZodEnum<{
        error: "error";
        warning: "warning";
        info: "info";
    }>;
    message: z.ZodString;
}, z.core.$strip>;
/**
 * Audit result for a captured page
 */
declare const AuditResultSchema: z.ZodObject<{
    totalElements: z.ZodNumber;
    interactiveCount: z.ZodNumber;
    withHandlers: z.ZodNumber;
    withoutHandlers: z.ZodNumber;
    issues: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            NO_HANDLER: "NO_HANDLER";
            PLACEHOLDER_LINK: "PLACEHOLDER_LINK";
            TOUCH_TARGET_SMALL: "TOUCH_TARGET_SMALL";
            MISSING_ARIA_LABEL: "MISSING_ARIA_LABEL";
            DISABLED_NO_VISUAL: "DISABLED_NO_VISUAL";
        }>;
        severity: z.ZodEnum<{
            error: "error";
            warning: "warning";
            info: "info";
        }>;
        message: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
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
declare const RuleSeveritySchema: z.ZodEnum<{
    error: "error";
    off: "off";
    warn: "warn";
}>;
/**
 * Individual rule setting
 */
declare const RuleSettingSchema: z.ZodUnion<readonly [z.ZodEnum<{
    error: "error";
    off: "off";
    warn: "warn";
}>, z.ZodTuple<[z.ZodEnum<{
    error: "error";
    off: "off";
    warn: "warn";
}>, z.ZodRecord<z.ZodString, z.ZodUnknown>], null>]>;
/**
 * Rules configuration (user's .ibr/rules.json)
 */
declare const RulesConfigSchema: z.ZodObject<{
    extends: z.ZodOptional<z.ZodArray<z.ZodString>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodEnum<{
        error: "error";
        off: "off";
        warn: "warn";
    }>, z.ZodTuple<[z.ZodEnum<{
        error: "error";
        off: "off";
        warn: "warn";
    }>, z.ZodRecord<z.ZodString, z.ZodUnknown>], null>]>>>;
}, z.core.$strip>;
/**
 * Violation detected by a rule
 */
declare const ViolationSchema: z.ZodObject<{
    ruleId: z.ZodString;
    ruleName: z.ZodString;
    severity: z.ZodEnum<{
        error: "error";
        warn: "warn";
    }>;
    message: z.ZodString;
    element: z.ZodOptional<z.ZodString>;
    bounds: z.ZodOptional<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, z.core.$strip>>;
    fix: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
        severity: z.ZodEnum<{
            error: "error";
            warn: "warn";
        }>;
        message: z.ZodString;
        element: z.ZodOptional<z.ZodString>;
        bounds: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, z.core.$strip>>;
        fix: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    summary: z.ZodObject<{
        errors: z.ZodNumber;
        warnings: z.ZodNumber;
        passed: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
type RuleSeverity = z.infer<typeof RuleSeveritySchema>;
type RuleSetting = z.infer<typeof RuleSettingSchema>;
type RulesConfig = z.infer<typeof RulesConfigSchema>;
type Violation = z.infer<typeof ViolationSchema>;
type RuleAuditResult = z.infer<typeof RuleAuditResultSchema>;
/**
 * Source of a UI/UX preference
 */
declare const MemorySourceSchema: z.ZodEnum<{
    user: "user";
    learned: "learned";
    framework: "framework";
}>;
/**
 * Preference categories
 */
declare const PreferenceCategorySchema: z.ZodEnum<{
    color: "color";
    layout: "layout";
    typography: "typography";
    navigation: "navigation";
    component: "component";
    spacing: "spacing";
    interaction: "interaction";
    content: "content";
}>;
/**
 * Expectation operator for comparing values
 */
declare const ExpectationOperatorSchema: z.ZodEnum<{
    equals: "equals";
    contains: "contains";
    matches: "matches";
    gte: "gte";
    lte: "lte";
}>;
/**
 * A single UI/UX expectation
 */
declare const ExpectationSchema: z.ZodObject<{
    property: z.ZodString;
    operator: z.ZodEnum<{
        equals: "equals";
        contains: "contains";
        matches: "matches";
        gte: "gte";
        lte: "lte";
    }>;
    value: z.ZodString;
}, z.core.$strip>;
/**
 * Full preference with history
 */
declare const PreferenceSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<{
        color: "color";
        layout: "layout";
        typography: "typography";
        navigation: "navigation";
        component: "component";
        spacing: "spacing";
        interaction: "interaction";
        content: "content";
    }>;
    source: z.ZodEnum<{
        user: "user";
        learned: "learned";
        framework: "framework";
    }>;
    route: z.ZodOptional<z.ZodString>;
    componentType: z.ZodOptional<z.ZodString>;
    expectation: z.ZodObject<{
        property: z.ZodString;
        operator: z.ZodEnum<{
            equals: "equals";
            contains: "contains";
            matches: "matches";
            gte: "gte";
            lte: "lte";
        }>;
        value: z.ZodString;
    }, z.core.$strip>;
    confidence: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    sessionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Observation extracted from a session
 */
declare const ObservationSchema: z.ZodObject<{
    description: z.ZodString;
    category: z.ZodEnum<{
        color: "color";
        layout: "layout";
        typography: "typography";
        navigation: "navigation";
        component: "component";
        spacing: "spacing";
        interaction: "interaction";
        content: "content";
    }>;
    property: z.ZodString;
    value: z.ZodString;
}, z.core.$strip>;
/**
 * Learned expectation from an approved session
 */
declare const LearnedExpectationSchema: z.ZodObject<{
    id: z.ZodString;
    sessionId: z.ZodString;
    route: z.ZodString;
    observations: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        category: z.ZodEnum<{
            color: "color";
            layout: "layout";
            typography: "typography";
            navigation: "navigation";
            component: "component";
            spacing: "spacing";
            interaction: "interaction";
            content: "content";
        }>;
        property: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
    approved: z.ZodBoolean;
    createdAt: z.ZodString;
}, z.core.$strip>;
/**
 * Compact preference pointer for summary
 */
declare const ActivePreferenceSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<{
        color: "color";
        layout: "layout";
        typography: "typography";
        navigation: "navigation";
        component: "component";
        spacing: "spacing";
        interaction: "interaction";
        content: "content";
    }>;
    route: z.ZodOptional<z.ZodString>;
    componentType: z.ZodOptional<z.ZodString>;
    property: z.ZodString;
    operator: z.ZodEnum<{
        equals: "equals";
        contains: "contains";
        matches: "matches";
        gte: "gte";
        lte: "lte";
    }>;
    value: z.ZodString;
    confidence: z.ZodNumber;
}, z.core.$strip>;
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
    }, z.core.$strip>;
    activePreferences: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        category: z.ZodEnum<{
            color: "color";
            layout: "layout";
            typography: "typography";
            navigation: "navigation";
            component: "component";
            spacing: "spacing";
            interaction: "interaction";
            content: "content";
        }>;
        route: z.ZodOptional<z.ZodString>;
        componentType: z.ZodOptional<z.ZodString>;
        property: z.ZodString;
        operator: z.ZodEnum<{
            equals: "equals";
            contains: "contains";
            matches: "matches";
            gte: "gte";
            lte: "lte";
        }>;
        value: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
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
declare function classifyPageIntent(page: Page): Promise<PageIntentResult>;
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
declare function detectAuthState(page: Page): Promise<AuthState>;
/**
 * Detect loading state from page signals
 */
declare function detectLoadingState(page: Page): Promise<LoadingState>;
/**
 * Detect error state from page signals
 */
declare function detectErrorState(page: Page): Promise<ErrorState>;
/**
 * Detect full page state
 */
declare function detectPageState(page: Page): Promise<PageState>;
/**
 * Wait for page to be ready (not loading, no errors)
 */
declare function waitForPageReady(page: Page, options?: {
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
declare function getSemanticOutput(page: Page): Promise<SemanticResult>;
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
declare function detectLandmarks(page: Page): Promise<LandmarkElement[]>;
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
declare function createSession(outputDir: string, url: string, name: string, viewport: Viewport): Promise<Session>;
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
declare const DecisionTypeSchema: z.ZodEnum<{
    css_change: "css_change";
    layout_change: "layout_change";
    color_change: "color_change";
    spacing_change: "spacing_change";
    component_add: "component_add";
    component_remove: "component_remove";
    component_modify: "component_modify";
    content_change: "content_change";
}>;
/**
 * Before/after state snapshot for a decision
 */
declare const DecisionStateSchema: z.ZodObject<{
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    html_snippet: z.ZodOptional<z.ZodString>;
    screenshot_ref: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * A single UI decision entry stored in JSONL logs
 */
declare const DecisionEntrySchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    route: z.ZodString;
    component: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        css_change: "css_change";
        layout_change: "layout_change";
        color_change: "color_change";
        spacing_change: "spacing_change";
        component_add: "component_add";
        component_remove: "component_remove";
        component_modify: "component_modify";
        content_change: "content_change";
    }>;
    description: z.ZodString;
    rationale: z.ZodOptional<z.ZodString>;
    before: z.ZodOptional<z.ZodObject<{
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        html_snippet: z.ZodOptional<z.ZodString>;
        screenshot_ref: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    after: z.ZodOptional<z.ZodObject<{
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        html_snippet: z.ZodOptional<z.ZodString>;
        screenshot_ref: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    files_changed: z.ZodArray<z.ZodString>;
    session_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Route-level decision summary for compact context
 */
declare const DecisionSummarySchema: z.ZodObject<{
    route: z.ZodString;
    component: z.ZodOptional<z.ZodString>;
    latest_change: z.ZodString;
    decision_count: z.ZodNumber;
    full_log_ref: z.ZodString;
}, z.core.$strip>;
/**
 * Current UI state tracking in compact context
 */
declare const CurrentUIStateSchema: z.ZodObject<{
    last_snapshot_ref: z.ZodOptional<z.ZodString>;
    pending_verifications: z.ZodNumber;
    known_issues: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
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
    }, z.core.$strip>>;
    current_ui_state: z.ZodObject<{
        last_snapshot_ref: z.ZodOptional<z.ZodString>;
        pending_verifications: z.ZodNumber;
        known_issues: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    preferences_active: z.ZodNumber;
}, z.core.$strip>;
/**
 * Request to compact current context
 */
declare const CompactionRequestSchema: z.ZodObject<{
    reason: z.ZodEnum<{
        session_ending: "session_ending";
        context_limit: "context_limit";
        manual: "manual";
    }>;
    preserve_decisions: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
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
        }, z.core.$strip>>;
        current_ui_state: z.ZodObject<{
            last_snapshot_ref: z.ZodOptional<z.ZodString>;
            pending_verifications: z.ZodNumber;
            known_issues: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        preferences_active: z.ZodNumber;
    }, z.core.$strip>;
    archived_to: z.ZodString;
    decisions_compacted: z.ZodNumber;
    decisions_preserved: z.ZodNumber;
}, z.core.$strip>;
type DecisionType = z.infer<typeof DecisionTypeSchema>;
type DecisionState = z.infer<typeof DecisionStateSchema>;
type DecisionEntry = z.infer<typeof DecisionEntrySchema>;
type DecisionSummary = z.infer<typeof DecisionSummarySchema>;
type CurrentUIState = z.infer<typeof CurrentUIStateSchema>;
type CompactContext = z.infer<typeof CompactContextSchema>;
type CompactionRequest = z.infer<typeof CompactionRequestSchema>;
type CompactionResult = z.infer<typeof CompactionResultSchema>;

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
    /** Overall scan verdict */
    verdict: 'PASS' | 'ISSUES' | 'FAIL';
    issues: ScanIssue[];
    summary: string;
}
/**
 * Individual issue found during scan
 */
interface ScanIssue {
    category: 'interactivity' | 'accessibility' | 'semantic' | 'console' | 'structure';
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
    /** Raw Playwright page for advanced use */
    readonly page: Page;
    private browser;
    private context;
    private config;
    constructor(page: Page, browser: Browser, context: BrowserContext, config: Config);
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
     * Mock a network request (thin wrapper on page.route)
     */
    mock(pattern: string | RegExp, response: {
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

export { type A11yAttributes, A11yAttributesSchema, type AISearchOptions, type AISearchResult, type ActivePreference, ActivePreferenceSchema, type Analysis, AnalysisSchema, type ApiCall, type ApiRequestTiming, type ApiRoute, type ApiTimingOptions, type ApiTimingResult, type AuditResult, AuditResultSchema, type AuthOptions, type AuthState, type AvailableAction, type Bounds, BoundsSchema, type ButtonInfo, type CaptureOptions, type CaptureResult, type ChangedRegion, ChangedRegionSchema, type CleanOptions, type CompactContext, CompactContextSchema, type CompactionRequest, CompactionRequestSchema, type CompactionResult, CompactionResultSchema, type CompareAllInput, type CompareInput, type CompareOptions, type CompareResult, type ComparisonReport, ComparisonReportSchema, type ComparisonResult, ComparisonResultSchema, type Config, ConfigSchema, type ConsistencyOptions, type ConsistencyResult, type CrawlOptions, type CrawlResult, type CurrentUIState, CurrentUIStateSchema, DEFAULT_DYNAMIC_SELECTORS, DEFAULT_RETENTION, type DecisionEntry, DecisionEntrySchema, type DecisionState, DecisionStateSchema, type DecisionSummary, DecisionSummarySchema, type DecisionType, DecisionTypeSchema, type DiscoveredPage, type ElementIssue, ElementIssueSchema, type EnhancedElement, EnhancedElementSchema, type ErrorInfo, type ErrorState, type Expectation, type ExpectationOperator, ExpectationOperatorSchema, ExpectationSchema, type ExtendedComparisonResult, type ExtractedResult, type FlowFormOptions, type FlowLoginOptions, type FlowName, type FlowOptions, type FlowResult, type FlowSearchOptions, type FlowStep, type FormField, type FormFieldInfo, type FormInfo, type FormResult, IBRSession, type Inconsistency, type InteractiveElement, type InteractiveState, InteractiveStateSchema, type InteractivityIssue, type InteractivityResult, InterfaceBuiltRight, LANDMARK_SELECTORS, type LandmarkElement, LandmarkElementSchema, type LandmarkType, type LayoutIssue, type LearnedExpectation, LearnedExpectationSchema, type LinkInfo, type LoadingState, type LoginOptions, type LoginResult, type MaskOptions, type MemorySource, MemorySourceSchema, type MemorySummary, MemorySummarySchema, type Observation, ObservationSchema, type OperationState, type OperationType, type OutputFormat, PERFORMANCE_THRESHOLDS, type PageIntent, type PageIntentResult, type PageMetrics, type PageState, type PendingOperation, type PerformanceRating, type PerformanceResult, type Preference, type PreferenceCategory, PreferenceCategorySchema, PreferenceSchema, type QueryDecisionsOptions, type RatedMetric, type RecordDecisionOptions, type RecoveryHint, type ResponsiveResult, type ResponsiveTestOptions, type RetentionConfig, type RetentionResult, type RuleAuditResult, RuleAuditResultSchema, type RuleSetting, RuleSettingSchema, type RuleSeverity, RuleSeveritySchema, type RulesConfig, RulesConfigSchema, type ScanIssue, type ScanOptions, type ScanResult, type SearchResult, type SearchTiming, type SemanticIssue, type SemanticResult, type SemanticVerdict, type ServeOptions, type Session, type SessionListItem, type SessionPaths, type SessionQuery, SessionQuerySchema, SessionSchema, type SessionStatus, SessionStatusSchema, type StartSessionOptions, type StartSessionResult, type StepScreenshot, type TextIssue, type TouchTargetIssue, VIEWPORTS, type ValidationContext, type ValidationIssue, type ValidationResult, type Verdict, VerdictSchema, type Viewport, type ViewportResult, ViewportSchema, type Violation, ViolationSchema, type WebVitals, addKnownIssue, addPreference, aiSearchFlow, analyzeComparison, analyzeForObviousIssues, archiveSummary, captureScreenshot, captureWithDiagnostics, checkConsistency, classifyPageIntent, cleanSessions, closeBrowser, compactContext, compare, compareAll, compareImages, compareLandmarks, completeOperation, createApiTracker, createMemoryPreset, createSession, deleteSession, detectAuthState, detectChangedRegions, detectErrorState, detectLandmarks, detectLoadingState, detectPageState, discoverApiRoutes, discoverPages, enforceRetentionPolicy, extractApiCalls, filePathToRoute, filterByEndpoint, filterByMethod, findButton, findFieldByLabel, findOrphanEndpoints, findSessions, flows, formFlow, formatApiTimingResult, formatConsistencyReport, formatInteractivityResult, formatLandmarkComparison, formatMemorySummary, formatPendingOperations, formatPerformanceResult, formatPreference, formatReportJson, formatReportMinimal, formatReportText, formatResponsiveResult, formatRetentionStatus, formatScanResult, formatSemanticJson, formatSemanticText, formatSessionSummary, formatValidationResult, generateDevModePrompt, generateQuickSummary, generateReport, generateSessionId, generateValidationContext, generateValidationPrompt, getDecision, getDecisionStats, getDecisionsByRoute, getDecisionsSize, getExpectedLandmarksForIntent, getExpectedLandmarksFromContext, getIntentDescription, getMostRecentSession, getNavigationLinks, getPendingOperations, getPreference, getRetentionStatus, getSemanticOutput, getSession, getSessionPaths, getSessionStats, getSessionsByRoute, getTimeline, getTrackedRoutes, getVerdictDescription, getViewport, groupByEndpoint, groupByFile, initMemory, isCompactContextOversize, learnFromSession, listLearned, listPreferences, listSessions, loadCompactContext, loadRetentionConfig, loadSummary, loginFlow, markSessionCompared, maybeAutoClean, measureApiTiming, measurePerformance, measureWebVitals, preferencesToRules, promoteToPreference, queryDecisions, queryMemory, rebuildSummary, recordDecision, registerOperation, removePreference, saveCompactContext, saveSummary, scan, scanDirectoryForApiCalls, searchFlow, setActiveRoute, testInteractivity, testResponsive, updateCompactContext, updateSession, waitForCompletion, waitForNavigation, waitForPageReady, withOperationTracking };
