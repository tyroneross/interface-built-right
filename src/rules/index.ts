import type { EnhancedElement } from '../schemas.js';
import type { Rule, RuleContext } from './engine.js';
import { wcagContrastRules } from './wcag-contrast.js';
import { touchTargetRules } from './touch-targets.js';
import { textHierarchyRules } from './text-hierarchy.js';
import { handlerIntegrityRules } from './handler-integrity.js';
import { spacingGridRules } from './spacing-grid.js';

// Re-export individual rule arrays
export { wcagContrastRules } from './wcag-contrast.js';
export { touchTargetRules } from './touch-targets.js';
export { textHierarchyRules } from './text-hierarchy.js';
export { handlerIntegrityRules } from './handler-integrity.js';
export { spacingGridRules } from './spacing-grid.js';

/**
 * Combined array of all deterministic rules.
 */
export const allRules: Rule[] = [
  ...wcagContrastRules,
  ...touchTargetRules,
  ...textHierarchyRules,
  ...handlerIntegrityRules,
  ...spacingGridRules,
];

/**
 * Structured result from the deterministic rule engine.
 */
export interface RuleEngineResult {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  element: string;
  expected: string;
  actual: string;
  evidence: Record<string, unknown>;
}

/**
 * Run all deterministic rules against a set of elements.
 * Returns a flat list of RuleEngineResult — one entry per violation.
 */
export function runAllRules(
  elements: EnhancedElement[],
  context: RuleContext,
): RuleEngineResult[] {
  const results: RuleEngineResult[] = [];

  for (const element of elements) {
    for (const rule of allRules) {
      const violation = rule.check(element, context);
      if (!violation) continue;

      // Map engine severity ('warn' | 'error') to result severity
      const severity: RuleEngineResult['severity'] =
        violation.severity === 'error' ? 'error' : 'warning';

      results.push({
        rule: violation.ruleId,
        severity,
        element: violation.element ?? element.selector,
        expected: violation.fix ?? '',
        actual: violation.message,
        evidence: {
          ruleName: violation.ruleName,
          bounds: violation.bounds,
          selector: element.selector,
          tagName: element.tagName,
          text: element.text,
        },
      });
    }
  }

  return results;
}
