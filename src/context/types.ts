import { z } from 'zod';

/**
 * Types of UI decisions that can be tracked
 */
export const DecisionTypeSchema = z.enum([
  'css_change',
  'layout_change',
  'color_change',
  'spacing_change',
  'component_add',
  'component_remove',
  'component_modify',
  'content_change',
]);

/**
 * Before/after state snapshot for a decision
 */
export const DecisionStateSchema = z.object({
  css: z.record(z.string(), z.string()).optional(),
  html_snippet: z.string().optional(),
  screenshot_ref: z.string().optional(),
});

/**
 * A single UI decision entry stored in JSONL logs
 */
export const DecisionEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  route: z.string(),
  component: z.string().optional(),
  type: DecisionTypeSchema,
  description: z.string(),
  rationale: z.string().optional(),
  before: DecisionStateSchema.optional(),
  after: DecisionStateSchema.optional(),
  files_changed: z.array(z.string()),
  session_id: z.string().optional(),
});

/**
 * Route-level decision summary for compact context
 */
export const DecisionSummarySchema = z.object({
  route: z.string(),
  component: z.string().optional(),
  latest_change: z.string(),
  decision_count: z.number(),
  full_log_ref: z.string(),
});

/**
 * Current UI state tracking in compact context
 */
export const CurrentUIStateSchema = z.object({
  last_snapshot_ref: z.string().optional(),
  pending_verifications: z.number(),
  known_issues: z.array(z.string()),
});

/**
 * Compact context — always-loaded LLM-friendly summary (<4KB target)
 */
export const CompactContextSchema = z.object({
  version: z.literal(1),
  session_id: z.string(),
  updated_at: z.string().datetime(),
  active_route: z.string().optional(),
  decisions_summary: z.array(DecisionSummarySchema),
  current_ui_state: CurrentUIStateSchema,
  preferences_active: z.number(),
});

/**
 * Request to compact current context
 */
export const CompactionRequestSchema = z.object({
  reason: z.enum(['session_ending', 'context_limit', 'manual']),
  preserve_decisions: z.array(z.string()).optional(),
});

/**
 * Result of context compaction
 */
export const CompactionResultSchema = z.object({
  compact_context: CompactContextSchema,
  archived_to: z.string(),
  decisions_compacted: z.number(),
  decisions_preserved: z.number(),
});

// Type exports
export type DecisionType = z.infer<typeof DecisionTypeSchema>;
export type DecisionState = z.infer<typeof DecisionStateSchema>;
export type DecisionEntry = z.infer<typeof DecisionEntrySchema>;
export type DecisionSummary = z.infer<typeof DecisionSummarySchema>;
export type CurrentUIState = z.infer<typeof CurrentUIStateSchema>;
export type CompactContext = z.infer<typeof CompactContextSchema>;
export type CompactionRequest = z.infer<typeof CompactionRequestSchema>;
export type CompactionResult = z.infer<typeof CompactionResultSchema>;
