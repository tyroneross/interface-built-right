import { loadDesignSystemConfig, getDefaultSeverity } from './config.js';
import { validateExtendedTokens, calculateComplianceScore } from './tokens/index.js';
import { allCalmPrecisionRules, principleToRules } from './principles/calm-precision.js';
import type { EnhancedElement, DesignSystemResult } from '../schemas.js';
import type { RuleContext } from '../rules/engine.js';

export { loadDesignSystemConfig, type DesignSystemConfig } from './config.js';

/**
 * Run all design system checks against extracted elements.
 * Returns undefined if no design system config exists (backward compatible).
 */
export async function runDesignSystemCheck(
  elements: EnhancedElement[],
  context: RuleContext,
  projectDir: string
): Promise<DesignSystemResult | undefined> {
  const config = await loadDesignSystemConfig(projectDir);
  if (!config) return undefined;

  // Run Calm Precision principle rules
  const principleViolations: DesignSystemResult['principleViolations'] = [];

  for (const rule of allCalmPrecisionRules) {
    // Find which principle this rule belongs to
    const principleId = Object.entries(principleToRules).find(
      ([, ruleIds]) => ruleIds.includes(rule.id)
    )?.[0];

    if (!principleId) continue;

    const severity = getDefaultSeverity(principleId, config);
    if (severity === 'off') continue;

    for (const element of elements) {
      const violation = rule.check(element, context);
      if (violation) {
        principleViolations.push({
          principleId: rule.id,
          principleName: rule.name,
          severity: severity === 'error' ? 'error' : 'warn',
          message: violation.message,
          element: violation.element,
          bounds: violation.bounds,
          fix: violation.fix,
        });
      }
    }
  }

  // Run custom principle checks
  const customViolations: DesignSystemResult['customViolations'] = [];
  for (const custom of config.principles.custom) {
    if (custom.severity === 'off') continue;

    for (const element of elements) {
      for (const check of custom.checks) {
        const style = element.computedStyles;
        if (!style) continue;

        const actual = style[check.property];
        if (!actual) continue;

        let violated = false;
        switch (check.operator) {
          case 'in-set':
            violated = !check.values.map(String).includes(actual);
            break;
          case 'not-in-set':
            violated = check.values.map(String).includes(actual);
            break;
          case 'equals':
            violated = actual !== String(check.values[0]);
            break;
          case 'gte':
            violated = parseFloat(actual) < Number(check.values[0]);
            break;
          case 'lte':
            violated = parseFloat(actual) > Number(check.values[0]);
            break;
          case 'contains':
            violated = !String(check.values[0]).split(',').some(v => actual.includes(v.trim()));
            break;
        }

        if (violated) {
          customViolations.push({
            principleId: custom.id,
            principleName: custom.name,
            severity: custom.severity as 'error' | 'warn',
            message: `${custom.name}: ${check.property} is "${actual}" (expected ${check.operator} ${check.values.join(', ')})`,
            element: element.selector,
            bounds: element.bounds,
            fix: custom.description,
          });
        }
      }
    }
  }

  // Run token validation
  const tokenViolations = config.tokens
    ? validateExtendedTokens(elements, config.tokens, config.name)
    : [];

  // Calculate compliance score
  // Total checkable = elements × active token categories
  const tokenCategories = Object.keys(config.tokens).filter(
    k => config.tokens[k as keyof typeof config.tokens] !== undefined
  ).length;
  const totalChecked = elements.length * Math.max(tokenCategories, 1);
  const complianceScore = calculateComplianceScore(totalChecked, tokenViolations.length);

  return {
    configName: config.name,
    principleViolations,
    tokenViolations,
    customViolations,
    complianceScore,
  };
}
