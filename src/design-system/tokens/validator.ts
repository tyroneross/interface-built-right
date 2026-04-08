import type { EnhancedElement } from '../../schemas.js';
import type { TokenViolation } from '../../tokens.js';
import { validateAgainstTokens, parsePx, getStyle } from '../../tokens.js';
import type { ExtendedTokenSpec } from './schema.js';
import { toDesignTokenSpec } from './schema.js';

/**
 * Validate font weights against token spec
 */
function validateFontWeights(elements: EnhancedElement[], weights: Record<string, number>): TokenViolation[] {
  const violations: TokenViolation[] = [];
  const validWeights = new Set(Object.values(weights));

  for (const element of elements) {
    const style = element.computedStyles;
    if (!style) continue;

    const fw = getStyle(style, 'font-weight');
    if (!fw) continue;

    const weight = parseInt(fw, 10);
    if (isNaN(weight)) continue;

    if (!validWeights.has(weight)) {
      violations.push({
        element: element.selector || element.tagName || 'unknown',
        property: 'font-weight',
        expected: `one of ${Array.from(validWeights).join(', ')}`,
        actual: weight,
        severity: 'warning',
        message: `Non-token font weight: ${weight} (expected one of ${Array.from(validWeights).join(', ')}) (${element.selector || element.tagName})`,
      });
    }
  }
  return violations;
}

/**
 * Validate line heights against token spec
 */
function validateLineHeights(elements: EnhancedElement[], lineHeights: Record<string, number>): TokenViolation[] {
  const violations: TokenViolation[] = [];
  const validHeights = new Set(Object.values(lineHeights));

  for (const element of elements) {
    const style = element.computedStyles;
    if (!style) continue;

    const lh = getStyle(style, 'line-height');
    if (!lh || lh === 'normal') continue;

    // line-height can be px or unitless
    let value: number;
    const pxVal = parsePx(lh);
    if (pxVal !== null) {
      // Convert px to ratio using font-size
      const fontSize = parsePx(getStyle(style, 'font-size'));
      if (fontSize && fontSize > 0) {
        value = Math.round((pxVal / fontSize) * 100) / 100;
      } else {
        continue;
      }
    } else {
      value = parseFloat(lh);
      if (isNaN(value)) continue;
    }

    // Check with tolerance (0.05)
    const isValid = Array.from(validHeights).some(vh => Math.abs(vh - value) < 0.05);
    if (!isValid) {
      violations.push({
        element: element.selector || element.tagName || 'unknown',
        property: 'line-height',
        expected: `one of ${Array.from(validHeights).join(', ')}`,
        actual: value,
        severity: 'warning',
        message: `Non-token line height: ${value} (expected one of ${Array.from(validHeights).join(', ')}) (${element.selector || element.tagName})`,
      });
    }
  }
  return violations;
}

/**
 * Validate elements against the full extended token spec.
 * Uses the old validator registry for existing categories + new validators for extended categories.
 */
export function validateExtendedTokens(
  elements: EnhancedElement[],
  tokens: ExtendedTokenSpec,
  systemName: string
): TokenViolation[] {
  const violations: TokenViolation[] = [];

  // Use existing validators via the old format bridge
  const oldSpec = toDesignTokenSpec(tokens, systemName);
  violations.push(...validateAgainstTokens(elements, oldSpec));

  // Run extended validators
  if (tokens.typography?.fontWeights) {
    violations.push(...validateFontWeights(elements, tokens.typography.fontWeights));
  }

  if (tokens.typography?.lineHeights) {
    violations.push(...validateLineHeights(elements, tokens.typography.lineHeights));
  }

  return violations;
}

/**
 * Calculate compliance score (0-100).
 * Percentage of checked properties that match tokens.
 */
export function calculateComplianceScore(totalChecked: number, violationCount: number): number {
  if (totalChecked === 0) return 100;
  const passing = totalChecked - violationCount;
  return Math.round((passing / totalChecked) * 100);
}
