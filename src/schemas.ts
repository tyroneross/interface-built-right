import { z } from 'zod';

/**
 * Viewport configuration for screenshot capture
 * Supports predefined names or custom dimensions
 */
export const ViewportSchema = z.object({
  name: z.string().min(1).max(50),
  width: z.number().min(320).max(3840),
  height: z.number().min(480).max(2160),
});

/**
 * Predefined viewport configurations
 */
export const VIEWPORTS = {
  desktop: { name: 'desktop', width: 1920, height: 1080 },
  'desktop-lg': { name: 'desktop-lg', width: 2560, height: 1440 },
  'desktop-sm': { name: 'desktop-sm', width: 1440, height: 900 },
  laptop: { name: 'laptop', width: 1366, height: 768 },
  tablet: { name: 'tablet', width: 768, height: 1024 },
  'tablet-landscape': { name: 'tablet-landscape', width: 1024, height: 768 },
  mobile: { name: 'mobile', width: 375, height: 667 },
  'mobile-lg': { name: 'mobile-lg', width: 414, height: 896 },
  'iphone-14': { name: 'iphone-14', width: 390, height: 844 },
  'iphone-14-pro-max': { name: 'iphone-14-pro-max', width: 430, height: 932 },
} as const;

/**
 * Main configuration for InterfaceBuiltRight
 */
export const ConfigSchema = z.object({
  baseUrl: z.string().url('Must be a valid URL'),
  outputDir: z.string().default('./.ibr'),
  viewport: ViewportSchema.default(VIEWPORTS.desktop),
  viewports: z.array(ViewportSchema).optional(), // Multi-viewport support
  threshold: z.number().min(0).max(100).default(1.0),
  fullPage: z.boolean().default(true),
  waitForNetworkIdle: z.boolean().default(true),
  timeout: z.number().min(1000).max(120000).default(30000),
});

/**
 * Session query options
 */
export const SessionQuerySchema = z.object({
  route: z.string().optional(),
  url: z.string().optional(),
  status: z.enum(['baseline', 'compared', 'pending']).optional(),
  name: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  viewport: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

/**
 * Comparison result from pixelmatch
 */
export const ComparisonResultSchema = z.object({
  match: z.boolean(),
  diffPercent: z.number(),
  diffPixels: z.number(),
  totalPixels: z.number(),
  threshold: z.number(),
});

/**
 * Changed region detected in comparison
 */
export const ChangedRegionSchema = z.object({
  location: z.enum(['top', 'bottom', 'left', 'right', 'center', 'full']),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  description: z.string(),
  severity: z.enum(['expected', 'unexpected', 'critical']),
});

/**
 * Analysis verdict types
 */
export const VerdictSchema = z.enum([
  'MATCH',
  'EXPECTED_CHANGE',
  'UNEXPECTED_CHANGE',
  'LAYOUT_BROKEN',
]);

/**
 * Analysis result
 */
export const AnalysisSchema = z.object({
  verdict: VerdictSchema,
  summary: z.string(),
  changedRegions: z.array(ChangedRegionSchema),
  unexpectedChanges: z.array(ChangedRegionSchema),
  recommendation: z.string().nullable(),
});

/**
 * Session status
 */
export const SessionStatusSchema = z.enum(['baseline', 'compared', 'pending']);

/**
 * Element bounds (moved up for LandmarkElementSchema dependency)
 */
export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/**
 * Landmark element detected on page
 */
export const LandmarkElementSchema = z.object({
  name: z.string(),           // e.g., 'logo', 'header', 'nav'
  selector: z.string(),       // CSS selector used to find it
  found: z.boolean(),
  bounds: BoundsSchema.optional(),
});

/**
 * Visual session
 */
export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  viewport: ViewportSchema,
  status: SessionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  comparison: ComparisonResultSchema.optional(),
  analysis: AnalysisSchema.optional(),
  // Landmark elements detected at baseline capture
  landmarkElements: z.array(LandmarkElementSchema).optional(),
  // Page intent detected at baseline
  pageIntent: z.string().optional(),
});

/**
 * Full comparison report
 */
export const ComparisonReportSchema = z.object({
  sessionId: z.string(),
  sessionName: z.string(),
  url: z.string(),
  timestamp: z.string().datetime(),
  viewport: ViewportSchema,
  comparison: ComparisonResultSchema,
  analysis: AnalysisSchema,
  files: z.object({
    baseline: z.string(),
    current: z.string(),
    diff: z.string(),
  }),
  webViewUrl: z.string().optional(),
});

/**
 * Element interactivity detection
 */
export const InteractiveStateSchema = z.object({
  hasOnClick: z.boolean(),
  hasHref: z.boolean(),
  isDisabled: z.boolean(),
  tabIndex: z.number(),
  cursor: z.string(),
  // Framework-specific detection
  hasReactHandler: z.boolean().optional(),
  hasVueHandler: z.boolean().optional(),
  hasAngularHandler: z.boolean().optional(),
});

/**
 * Accessibility attributes
 */
export const A11yAttributesSchema = z.object({
  role: z.string().nullable(),
  ariaLabel: z.string().nullable(),
  ariaDescribedBy: z.string().nullable(),
  ariaHidden: z.boolean().optional(),
});

/**
 * Enhanced element with interactivity and accessibility
 */
export const EnhancedElementSchema = z.object({
  // Identity
  selector: z.string(),
  tagName: z.string(),
  id: z.string().optional(),
  className: z.string().optional(),
  text: z.string().optional(),

  // Position
  bounds: BoundsSchema,

  // Styles (subset)
  computedStyles: z.record(z.string(), z.string()).optional(),

  // Interactivity
  interactive: InteractiveStateSchema,

  // Accessibility
  a11y: A11yAttributesSchema,

  // Source hints for debugging
  sourceHint: z.object({
    dataTestId: z.string().nullable(),
  }).optional(),
});

/**
 * Element issue detected during audit
 */
export const ElementIssueSchema = z.object({
  type: z.enum([
    'NO_HANDLER',           // Interactive-looking but no handler
    'PLACEHOLDER_LINK',     // href="#" without handler
    'TOUCH_TARGET_SMALL',   // < 44px on mobile
    'MISSING_ARIA_LABEL',   // Interactive without label
    'DISABLED_NO_VISUAL',   // Disabled but no visual indication
  ]),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
});

/**
 * Audit result for a captured page
 */
export const AuditResultSchema = z.object({
  totalElements: z.number(),
  interactiveCount: z.number(),
  withHandlers: z.number(),
  withoutHandlers: z.number(),
  issues: z.array(ElementIssueSchema),
});

// Type exports - auto-generated from schemas
export type Viewport = z.infer<typeof ViewportSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type SessionQuery = z.infer<typeof SessionQuerySchema>;
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;
export type ChangedRegion = z.infer<typeof ChangedRegionSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type LandmarkElement = z.infer<typeof LandmarkElementSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type ComparisonReport = z.infer<typeof ComparisonReportSchema>;
export type InteractiveState = z.infer<typeof InteractiveStateSchema>;
export type A11yAttributes = z.infer<typeof A11yAttributesSchema>;
export type Bounds = z.infer<typeof BoundsSchema>;
export type EnhancedElement = z.infer<typeof EnhancedElementSchema>;
export type ElementIssue = z.infer<typeof ElementIssueSchema>;
export type AuditResult = z.infer<typeof AuditResultSchema>;

/**
 * Rule severity levels
 */
export const RuleSeveritySchema = z.enum(['off', 'warn', 'error']);

/**
 * Individual rule setting
 */
export const RuleSettingSchema = z.union([
  RuleSeveritySchema,
  z.tuple([RuleSeveritySchema, z.record(z.string(), z.unknown())]),
]);

/**
 * Rules configuration (user's .ibr/rules.json)
 */
export const RulesConfigSchema = z.object({
  extends: z.array(z.string()).optional(),
  rules: z.record(z.string(), RuleSettingSchema).optional(),
});

/**
 * Violation detected by a rule
 */
export const ViolationSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  severity: z.enum(['warn', 'error']),
  message: z.string(),
  element: z.string().optional(),  // Selector of violating element
  bounds: BoundsSchema.optional(),
  fix: z.string().optional(),       // Suggested fix
});

/**
 * Full audit report with rule violations
 */
export const RuleAuditResultSchema = z.object({
  url: z.string(),
  timestamp: z.string(),
  elementsScanned: z.number(),
  violations: z.array(ViolationSchema),
  summary: z.object({
    errors: z.number(),
    warnings: z.number(),
    passed: z.number(),
  }),
});

// Rule-related type exports
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;
export type RuleSetting = z.infer<typeof RuleSettingSchema>;
export type RulesConfig = z.infer<typeof RulesConfigSchema>;
export type Violation = z.infer<typeof ViolationSchema>;
export type RuleAuditResult = z.infer<typeof RuleAuditResultSchema>;

// ============================================================================
// MEMORY SYSTEM SCHEMAS
// ============================================================================

/**
 * Source of a UI/UX preference
 */
export const MemorySourceSchema = z.enum(['user', 'learned', 'framework']);

/**
 * Preference categories
 */
export const PreferenceCategorySchema = z.enum([
  'color',
  'layout',
  'typography',
  'navigation',
  'component',
  'spacing',
  'interaction',
  'content',
]);

/**
 * Expectation operator for comparing values
 */
export const ExpectationOperatorSchema = z.enum(['equals', 'contains', 'matches', 'gte', 'lte']);

/**
 * A single UI/UX expectation
 */
export const ExpectationSchema = z.object({
  property: z.string(),
  operator: ExpectationOperatorSchema,
  value: z.string(),
});

/**
 * Full preference with history
 */
export const PreferenceSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: PreferenceCategorySchema,
  source: MemorySourceSchema,
  route: z.string().optional(),
  componentType: z.string().optional(),
  expectation: ExpectationSchema,
  confidence: z.number().min(0).max(1).default(1.0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sessionIds: z.array(z.string()).optional(),
});

/**
 * Observation extracted from a session
 */
export const ObservationSchema = z.object({
  description: z.string(),
  category: PreferenceCategorySchema,
  property: z.string(),
  value: z.string(),
});

/**
 * Learned expectation from an approved session
 */
export const LearnedExpectationSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  route: z.string(),
  observations: z.array(ObservationSchema),
  approved: z.boolean(),
  createdAt: z.string().datetime(),
});

/**
 * Compact preference pointer for summary
 */
export const ActivePreferenceSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: PreferenceCategorySchema,
  route: z.string().optional(),
  componentType: z.string().optional(),
  property: z.string(),
  operator: ExpectationOperatorSchema,
  value: z.string(),
  confidence: z.number(),
});

/**
 * Memory summary - always-loaded compact file
 */
export const MemorySummarySchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  stats: z.object({
    totalPreferences: z.number(),
    totalLearned: z.number(),
    byCategory: z.record(z.string(), z.number()),
    bySource: z.record(z.string(), z.number()),
  }),
  activePreferences: z.array(ActivePreferenceSchema),
});

// Memory type exports
export type MemorySource = z.infer<typeof MemorySourceSchema>;
export type PreferenceCategory = z.infer<typeof PreferenceCategorySchema>;
export type ExpectationOperator = z.infer<typeof ExpectationOperatorSchema>;
export type Expectation = z.infer<typeof ExpectationSchema>;
export type Preference = z.infer<typeof PreferenceSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type LearnedExpectation = z.infer<typeof LearnedExpectationSchema>;
export type ActivePreference = z.infer<typeof ActivePreferenceSchema>;
export type MemorySummary = z.infer<typeof MemorySummarySchema>;
