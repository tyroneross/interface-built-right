import { z } from 'zod';

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
    baseUrl: string;
    outputDir: string;
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    threshold: number;
    fullPage: boolean;
    waitForNetworkIdle: boolean;
    timeout: number;
    viewports?: {
        name: string;
        width: number;
        height: number;
    }[] | undefined;
}, {
    baseUrl: string;
    outputDir?: string | undefined;
    viewport?: {
        name: string;
        width: number;
        height: number;
    } | undefined;
    viewports?: {
        name: string;
        width: number;
        height: number;
    }[] | undefined;
    threshold?: number | undefined;
    fullPage?: boolean | undefined;
    waitForNetworkIdle?: boolean | undefined;
    timeout?: number | undefined;
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
    viewport?: string | undefined;
    url?: string | undefined;
    route?: string | undefined;
    createdAfter?: Date | undefined;
    createdBefore?: Date | undefined;
}, {
    name?: string | undefined;
    status?: "baseline" | "compared" | "pending" | undefined;
    viewport?: string | undefined;
    url?: string | undefined;
    route?: string | undefined;
    createdAfter?: Date | undefined;
    createdBefore?: Date | undefined;
    limit?: number | undefined;
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
}, "strip", z.ZodTypeAny, {
    name: string;
    status: "baseline" | "compared" | "pending";
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    id: string;
    url: string;
    createdAt: string;
    updatedAt: string;
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
}, {
    name: string;
    status: "baseline" | "compared" | "pending";
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    id: string;
    url: string;
    createdAt: string;
    updatedAt: string;
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
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    url: string;
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
    sessionId: string;
    sessionName: string;
    timestamp: string;
    files: {
        baseline: string;
        current: string;
        diff: string;
    };
    webViewUrl?: string | undefined;
}, {
    viewport: {
        name: string;
        width: number;
        height: number;
    };
    url: string;
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
    sessionId: string;
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
 * Element bounds
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
    selector: string;
    bounds: {
        width: number;
        height: number;
        x: number;
        y: number;
    };
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
    selector: string;
    bounds: {
        width: number;
        height: number;
        x: number;
        y: number;
    };
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

export { type A11yAttributes, A11yAttributesSchema, type Analysis, AnalysisSchema, type ApiCall, type ApiRoute, type AuditResult, AuditResultSchema, type AuthOptions, type Bounds, BoundsSchema, type CaptureOptions, type CaptureResult, type ChangedRegion, ChangedRegionSchema, type CleanOptions, type CompareOptions, type ComparisonReport, ComparisonReportSchema, type ComparisonResult, ComparisonResultSchema, type Config, ConfigSchema, type ConsistencyOptions, type ConsistencyResult, type CrawlOptions, type CrawlResult, type DiscoveredPage, type ElementIssue, ElementIssueSchema, type EnhancedElement, EnhancedElementSchema, type Inconsistency, type InteractiveState, InteractiveStateSchema, InterfaceBuiltRight, type LoginOptions, type OutputFormat, type PageMetrics, type RuleAuditResult, RuleAuditResultSchema, type RuleSetting, RuleSettingSchema, type RuleSeverity, RuleSeveritySchema, type RulesConfig, RulesConfigSchema, type ServeOptions, type Session, type SessionListItem, type SessionPaths, type SessionQuery, SessionQuerySchema, SessionSchema, type SessionStatus, SessionStatusSchema, type StartSessionOptions, type StartSessionResult, VIEWPORTS, type Verdict, VerdictSchema, type Viewport, ViewportSchema, type Violation, ViolationSchema, analyzeComparison, captureScreenshot, captureWithDiagnostics, checkConsistency, cleanSessions, closeBrowser, compareImages, createSession, deleteSession, detectChangedRegions, discoverApiRoutes, discoverPages, extractApiCalls, filePathToRoute, filterByEndpoint, filterByMethod, findOrphanEndpoints, findSessions, formatConsistencyReport, formatReportJson, formatReportMinimal, formatReportText, formatSessionSummary, generateReport, generateSessionId, getMostRecentSession, getNavigationLinks, getSession, getSessionPaths, getSessionStats, getSessionsByRoute, getTimeline, getVerdictDescription, getViewport, groupByEndpoint, groupByFile, listSessions, markSessionCompared, scanDirectoryForApiCalls, updateSession };
