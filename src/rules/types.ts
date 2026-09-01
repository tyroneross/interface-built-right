import type { EnhancedElement, RuleSetting, Violation } from '../schemas.js';

/** Rule context passed to each rule check. */
export interface RuleContext {
  isMobile: boolean;
  viewportWidth: number;
  viewportHeight: number;
  url: string;
  allElements: EnhancedElement[];
}

/**
 * Which element surface a rule is valid on.
 *
 * `interactive` (the default when omitted) is the historical behavior: the rule
 * only ever sees controls. Touch-target sizing and handler-integrity rules MUST
 * stay here — grading a paragraph as an undersized tap target is nonsense.
 *
 * `any` opts a rule into the content surface too (headings, paragraphs,
 * captions, quotes). Text contrast belongs here: readability failures live in
 * body copy at least as often as in buttons, and body copy was never graded.
 *
 * `text` is content-only, for rules that make no sense on a control.
 */
export type RuleSurface = 'interactive' | 'text' | 'any';

/** A rule that can evaluate one scanned element. */
export interface Rule {
  id: string;
  name: string;
  description: string;
  defaultSeverity: 'warn' | 'error';
  /** Defaults to `'interactive'` when omitted, preserving pre-existing rule scope. */
  appliesTo?: RuleSurface;
  check: (element: EnhancedElement, context: RuleContext, options?: Record<string, unknown>) => Violation | null;
}

/** A named collection of rules with default settings. */
export interface RulePreset {
  name: string;
  description: string;
  rules: Rule[];
  defaults: Record<string, RuleSetting>;
}
