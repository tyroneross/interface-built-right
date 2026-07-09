import type { EnhancedElement, RuleSetting, Violation } from '../schemas.js';

/** Rule context passed to each rule check. */
export interface RuleContext {
  isMobile: boolean;
  viewportWidth: number;
  viewportHeight: number;
  url: string;
  allElements: EnhancedElement[];
}

/** A rule that can evaluate one scanned element. */
export interface Rule {
  id: string;
  name: string;
  description: string;
  defaultSeverity: 'warn' | 'error';
  check: (element: EnhancedElement, context: RuleContext, options?: Record<string, unknown>) => Violation | null;
}

/** A named collection of rules with default settings. */
export interface RulePreset {
  name: string;
  description: string;
  rules: Rule[];
  defaults: Record<string, RuleSetting>;
}
