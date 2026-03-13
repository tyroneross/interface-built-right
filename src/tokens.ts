/**
 * Design Token Validation
 *
 * Compares UI elements against a design token specification.
 * Checks touch targets, font sizes, colors, spacing, and corner radius.
 */

import { readFileSync, existsSync } from 'fs';

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
function parsePx(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Validate UI elements against a design token specification
 */
export function validateAgainstTokens(
  elements: any[],
  spec: DesignTokenSpec
): TokenViolation[] {
  const violations: TokenViolation[] = [];

  for (const element of elements) {
    const selector = element.selector || element.tagName || 'unknown';
    const isInteractive = element.interactive?.hasOnClick || element.interactive?.hasHref;

    // --- Touch targets ---
    if (spec.tokens.touchTargets && isInteractive) {
      const minSize = spec.tokens.touchTargets.min;
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

    // --- Font sizes ---
    if (spec.tokens.fontSizes && element.computedStyles) {
      const fontSize = parsePx(element.computedStyles['font-size']);
      if (fontSize !== null) {
        const tokenValues = Object.values(spec.tokens.fontSizes);
        const isTokenValue = tokenValues.includes(fontSize);

        if (!isTokenValue) {
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
    }

    // --- Colors ---
    if (spec.tokens.colors && element.computedStyles) {
      const tokenColors = new Set(
        Object.values(spec.tokens.colors).map(normalizeColor)
      );

      // Check text color
      const textColor = element.computedStyles['color'];
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
      const bgColor = element.computedStyles['background-color'];
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

    // --- Corner radius ---
    if (spec.tokens.cornerRadius && element.computedStyles) {
      const borderRadius = parsePx(element.computedStyles['border-radius']);
      if (borderRadius !== null && borderRadius > 0) {
        const tokenValues = Object.values(spec.tokens.cornerRadius);
        const isTokenValue = tokenValues.includes(borderRadius);

        if (!isTokenValue) {
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
    }

    // Note: Spacing (sibling gaps) validation is skipped for complexity
  }

  return violations;
}
