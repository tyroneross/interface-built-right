/**
 * Design Token Validation
 *
 * Compares UI elements against a design token specification.
 * Checks touch targets, font sizes, colors, spacing, and corner radius.
 */

import { readFileSync, existsSync } from 'fs';
import type { EnhancedElement } from './schemas.js';

export interface DesignTokenSpec {
  name: string;
  tokens: {
    colors?: Record<string, string>;       // tokenName → "#hex" or "rgb(...)"
    spacing?: Record<string, number>;       // tokenName → px value
    fontSizes?: Record<string, number>;     // tokenName → px value
    touchTargets?: { min: number };         // minimum touch target size
    cornerRadius?: Record<string, number>;  // tokenName → px value
  };
}

export interface TokenViolation {
  element: string;       // selector or description
  property: string;      // "touch-target" | "font-size" | "color" | "spacing" | "corner-radius"
  expected: string | number;
  actual: string | number;
  severity: 'error' | 'warning';
  message: string;
}

interface TokenValidator {
  name: string;
  validate(elements: EnhancedElement[], spec: DesignTokenSpec): TokenViolation[];
}

/**
 * Load a design token spec from a JSON file
 */
export function loadTokenSpec(specPath: string): DesignTokenSpec {
  if (!existsSync(specPath)) {
    throw new Error(`Token spec not found: ${specPath}`);
  }

  let spec: DesignTokenSpec;
  try {
    const content = readFileSync(specPath, 'utf-8');
    spec = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse token spec: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Validate that at least one token category exists
  const { tokens } = spec;
  const hasAnyTokens = tokens.colors || tokens.spacing || tokens.fontSizes || tokens.touchTargets || tokens.cornerRadius;

  if (!hasAnyTokens) {
    throw new Error('Token spec must define at least one token category (colors, spacing, fontSizes, touchTargets, or cornerRadius)');
  }

  return spec;
}

/**
 * Normalize color to lowercase hex format for comparison
 */
export function normalizeColor(color: string): string {
  if (!color) return '';

  // Already hex
  if (color.startsWith('#')) {
    return color.toLowerCase();
  }

  // Convert rgb/rgba to hex
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Fallback: return as-is
  return color.toLowerCase();
}

/**
 * Parse px value from a CSS string
 */
export function parsePx(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Get a computed style value, checking both camelCase and kebab-case keys.
 * CDP returns camelCase (fontSize), but CSS convention is kebab-case (font-size).
 */
export function getStyle(styles: Record<string, string> | undefined, kebab: string): string | undefined {
  if (!styles) return undefined;
  // Try kebab-case first
  const val = styles[kebab];
  if (val !== undefined) return val;
  // Try camelCase
  const camel = kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return styles[camel];
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

const touchTargetValidator: TokenValidator = {
  name: 'touchTargets',
  validate(elements, spec) {
    const violations: TokenViolation[] = [];
    if (!spec.tokens.touchTargets) return violations;
    const minSize = spec.tokens.touchTargets.min;

    for (const element of elements) {
      const selector = element.selector || element.tagName || 'unknown';
      const isInteractive = element.interactive?.hasOnClick || element.interactive?.hasHref;
      if (!isInteractive) continue;

      const actualSize = Math.min(element.bounds.width, element.bounds.height);
      if (actualSize < minSize) {
        violations.push({
          element: selector,
          property: 'touch-target',
          expected: minSize,
          actual: actualSize,
          severity: 'error',
          message: `Touch target too small: ${actualSize}px < ${minSize}px (${selector})`,
        });
      }
    }
    return violations;
  },
};

const fontSizeValidator: TokenValidator = {
  name: 'fontSizes',
  validate(elements, spec) {
    const violations: TokenViolation[] = [];
    if (!spec.tokens.fontSizes) return violations;
    const tokenValues = Object.values(spec.tokens.fontSizes);

    for (const element of elements) {
      const selector = element.selector || element.tagName || 'unknown';
      if (!element.computedStyles) continue;

      const fontSize = parsePx(getStyle(element.computedStyles, 'font-size'));
      if (fontSize === null) continue;

      if (!tokenValues.includes(fontSize)) {
        violations.push({
          element: selector,
          property: 'font-size',
          expected: `one of ${tokenValues.join(', ')}px`,
          actual: fontSize,
          severity: 'warning',
          message: `Non-token font size: ${fontSize}px (expected one of ${tokenValues.join(', ')}px) (${selector})`,
        });
      }
    }
    return violations;
  },
};

const colorValidator: TokenValidator = {
  name: 'colors',
  validate(elements, spec) {
    const violations: TokenViolation[] = [];
    if (!spec.tokens.colors) return violations;

    const tokenColors = new Set(
      Object.values(spec.tokens.colors).map(normalizeColor)
    );

    for (const element of elements) {
      const selector = element.selector || element.tagName || 'unknown';
      if (!element.computedStyles) continue;

      // Check text color
      const textColor = getStyle(element.computedStyles, 'color');
      if (textColor) {
        const normalized = normalizeColor(textColor);
        if (!tokenColors.has(normalized)) {
          violations.push({
            element: selector,
            property: 'color',
            expected: 'token color',
            actual: textColor,
            severity: 'warning',
            message: `Non-token text color: ${textColor} (${selector})`,
          });
        }
      }

      // Check background color
      const bgColor = getStyle(element.computedStyles, 'background-color');
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        const normalized = normalizeColor(bgColor);
        if (!tokenColors.has(normalized)) {
          violations.push({
            element: selector,
            property: 'color',
            expected: 'token color',
            actual: bgColor,
            severity: 'warning',
            message: `Non-token background color: ${bgColor} (${selector})`,
          });
        }
      }
    }
    return violations;
  },
};

const cornerRadiusValidator: TokenValidator = {
  name: 'cornerRadius',
  validate(elements, spec) {
    const violations: TokenViolation[] = [];
    if (!spec.tokens.cornerRadius) return violations;
    const tokenValues = Object.values(spec.tokens.cornerRadius);

    for (const element of elements) {
      const selector = element.selector || element.tagName || 'unknown';
      if (!element.computedStyles) continue;

      const borderRadius = parsePx(getStyle(element.computedStyles, 'border-radius'));
      if (borderRadius === null || borderRadius === 0) continue;

      if (!tokenValues.includes(borderRadius)) {
        violations.push({
          element: selector,
          property: 'corner-radius',
          expected: `one of ${tokenValues.join(', ')}px`,
          actual: borderRadius,
          severity: 'warning',
          message: `Non-token border radius: ${borderRadius}px (expected one of ${tokenValues.join(', ')}px) (${selector})`,
        });
      }
    }
    return violations;
  },
};

const spacingValidator: TokenValidator = {
  name: 'spacing',
  validate(elements, spec) {
    const violations: TokenViolation[] = [];
    if (!spec.tokens.spacing) return violations;
    const tokenValues = Object.values(spec.tokens.spacing);

    for (const element of elements) {
      const selector = element.selector || element.tagName || 'unknown';
      if (!element.computedStyles) continue;

      for (const prop of ['gap', 'padding', 'margin'] as const) {
        const raw = element.computedStyles[prop];
        const value = parsePx(raw);
        if (value === null || value === 0) continue;

        if (!tokenValues.includes(value)) {
          violations.push({
            element: selector,
            property: 'spacing',
            expected: `one of ${tokenValues.join(', ')}px`,
            actual: value,
            severity: 'warning',
            message: `Non-token ${prop}: ${value}px (expected one of ${tokenValues.join(', ')}px) (${selector})`,
          });
        }
      }
    }
    return violations;
  },
};

// ---------------------------------------------------------------------------
// Registry — exported so external design-system extensions can add validators
// ---------------------------------------------------------------------------

export const tokenValidators: Map<string, TokenValidator> = new Map([
  ['touchTargets', touchTargetValidator],
  ['fontSizes', fontSizeValidator],
  ['colors', colorValidator],
  ['cornerRadius', cornerRadiusValidator],
  ['spacing', spacingValidator],
]);

export type { TokenValidator };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate UI elements against a design token specification
 */
export function validateAgainstTokens(
  elements: EnhancedElement[],
  spec: DesignTokenSpec
): TokenViolation[] {
  const violations: TokenViolation[] = [];
  for (const [key, validator] of tokenValidators) {
    if (spec.tokens[key as keyof typeof spec.tokens]) {
      violations.push(...validator.validate(elements, spec));
    }
  }
  return violations;
}
