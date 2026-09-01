import { loadDesignSystemConfig, getDefaultSeverity } from './config.js';
import { validateExtendedTokens, calculateComplianceScore } from './tokens/index.js';
import { allCalmPrecisionRules, principleToRules } from './principles/calm-precision.js';
import type { EnhancedElement, DesignSystemResult } from '../schemas.js';
import type { RuleContext } from '../rules/types.js';

/**
 * Token categories that actually have a registered validator.
 *
 * `DesignSystemConfigSchema` accepts `shadows` and `transitions`, but
 * `tokenValidators` (src/tokens.ts) registers five categories and
 * `toDesignTokenSpec` maps only those five. Declaring an unvalidated category
 * used to raise `complianceScore` while checking nothing — it is now reported
 * as a coverage gap instead.
 */
const VALIDATED_TOKEN_CATEGORIES: ReadonlySet<string> = new Set([
  'colors',
  'spacing',
  'fontSizes',
  'touchTargets',
  'cornerRadius',
  'typography',
]);

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

  // ── Compliance score ───────────────────────────────────────────────────
  //
  // THE OLD DENOMINATOR WAS INVENTED, and three separate absurdities followed
  // from it. All three were proven by planted config against the installed
  // binary, on one unchanged fixture page:
  //
  //   const totalChecked = elements.length * Math.max(tokenCategories, 1);
  //
  //   1. IT COULD GO NEGATIVE. `colorValidator` emits up to two violations per
  //      element (text colour AND background), so violations routinely exceed
  //      `elements × categories`. A config declaring one category scored
  //      **-58**.
  //   2. DECLARING MORE TOKENS RAISED THE SCORE. `shadows` and `transitions`
  //      pass the schema but have NO registered validator (see
  //      `tokenValidators` in src/tokens.ts — five entries, and
  //      `toDesignTokenSpec` drops the other two). Adding them enlarged the
  //      denominator and checked nothing: the identical page with the identical
  //      52 violations moved from **-58 to +47**.
  //   3. CHECKING NOTHING SCORED 100. A config with no `tokens` key gave
  //      `tokenCategories = 0`, `Math.max(0,1) = 1`, zero violations — and a
  //      perfect score for grading nothing.
  //
  // The replacement counts REAL UNITS on both sides: how many elements were
  // evaluable (they carry computed styles the validators can read), and how
  // many of those carried no violation. Numerator and denominator are the same
  // kind of thing, so the result cannot go negative, cannot exceed 100, and
  // cannot be inflated by declaring a token nobody validates.
  //
  // When nothing was evaluable the score is `null`, never a number — "we could
  // not measure" must not be readable as "it passed".

  const declaredCategories = Object.keys(config.tokens ?? {}).filter(
    k => config.tokens![k as keyof typeof config.tokens] !== undefined
  );
  const categoriesWithoutValidator = declaredCategories.filter(
    k => !VALIDATED_TOKEN_CATEGORIES.has(k),
  );

  // A validator can only read an element that has computed styles. Every
  // validator in tokens.ts and validator.ts opens with the same
  // `if (!element.computedStyles) continue`, so this is the honest population.
  const evaluableElements = elements.filter(el => !!el.computedStyles);
  const elementsWithViolations = new Set(tokenViolations.map(v => v.element)).size;

  // AND there has to be something to check. A config declaring no validated
  // token category runs every validator over the full element list, each one
  // returns immediately, zero violations come back — and dividing 33 by 33
  // scored a page full of defects at 100. Proven by planted config:
  // `{"version":1,"name":"proof"}` scored 100 against 52 violations' worth of
  // page. If no declared category has a validator, no check happened, and the
  // honest answer is `null`.
  const validatedCategoriesDeclared = declaredCategories.filter(
    k => VALIDATED_TOKEN_CATEGORIES.has(k),
  );
  const complianceScore = validatedCategoriesDeclared.length === 0
    ? null
    : calculateComplianceScore(evaluableElements.length, elementsWithViolations);

  return {
    configName: config.name,
    principleViolations,
    tokenViolations,
    customViolations,
    complianceScore,
    coverage: {
      /**
       * The population this score was computed over.
       *
       * Named because the number is meaningless without it: the check was
       * previously handed only the interactive element list, so a page-level
       * "compliance score" graded buttons and links and nothing else. Naming
       * the scope is what stops a subset score from being read as the page's.
       */
      scope: 'interactive + content + containers',
      elementsConsidered: elements.length,
      elementsEvaluated: evaluableElements.length,
      elementsSkippedNoStyles: elements.length - evaluableElements.length,
      declaredCategories,
      /** Declared AND backed by a validator — the categories actually checked. */
      validatedCategoriesDeclared,
      // Declared in config, silently checked by nothing. These used to INFLATE
      // the score; now they are named so the reader can delete them or ask for
      // a validator.
      categoriesWithoutValidator,
    },
  };
}
