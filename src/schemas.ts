import { z } from 'zod';

/**
 * Viewport configuration for screenshot capture
 */
export const ViewportSchema = z.object({
  name: z.enum(['desktop', 'mobile', 'tablet']),
  width: z.number().min(320).max(3840),
  height: z.number().min(480).max(2160),
});

/**
 * Predefined viewport configurations
 */
export const VIEWPORTS = {
  desktop: { name: 'desktop' as const, width: 1920, height: 1080 },
  mobile: { name: 'mobile' as const, width: 375, height: 667 },
  tablet: { name: 'tablet' as const, width: 768, height: 1024 },
} as const;

/**
 * Main configuration for InterfaceBuiltRight
 */
export const ConfigSchema = z.object({
  baseUrl: z.string().url('Must be a valid URL'),
  outputDir: z.string().default('./.ibr'),
  viewport: ViewportSchema.default(VIEWPORTS.desktop),
  threshold: z.number().min(0).max(100).default(1.0),
  fullPage: z.boolean().default(true),
  waitForNetworkIdle: z.boolean().default(true),
  timeout: z.number().min(1000).max(120000).default(30000),
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

// Type exports - auto-generated from schemas
export type Viewport = z.infer<typeof ViewportSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;
export type ChangedRegion = z.infer<typeof ChangedRegionSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type ComparisonReport = z.infer<typeof ComparisonReportSchema>;
