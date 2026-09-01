import type { Rule, RuleContext, RulePreset } from '../types.js';
import type { EnhancedElement, Violation } from '../../schemas.js';
import { measureElementContrast, confidenceNote, type ContrastMeasurement } from '../contrast-measure.js';

/*
 * The measurement itself lives in ../contrast-measure.ts and is shared with
 * `wcag/contrast` (src/rules/wcag-contrast.ts). Both rules used to carry their
 * own copy of the luminance math AND the same
 * `if (bg.kind !== 'rgb') return null` bail, so a page whose text sat on a
 * transparent background — nearly every real page — was measured by neither.
 * Do not reintroduce a local copy here.
 *
 * SILENCE IS THE FAILURE MODE. Every path below either produces a measurement
 * or produces a finding that says what was NOT measured.
 */

function unmeasurableViolation(
  element: EnhancedElement,
  m: Extract<ContrastMeasurement, { status: 'unmeasurable' }>,
  level: 'aa' | 'aaa',
): Violation {
  return {
    ruleId: `wcag-${level}-contrast-unmeasurable`,
    ruleName: `WCAG 2.1 ${level.toUpperCase()} Contrast (not measurable)`,
    severity: 'warn',
    message: `Could not decode color "${m.raw}", so contrast for "${m.text.slice(0, 40)}" was NOT checked`,
    element: element.selector,
    bounds: element.bounds,
    fix: 'Add support for this color format in rules/color-parse.ts.',
  };
}

// ============================================
// Rules
// ============================================

const wcagAAContrastRule: Rule = {
  id: 'wcag-aa-contrast',
  name: 'WCAG 2.1 AA Contrast',
  description: 'Text must meet WCAG 2.1 AA contrast ratio: 4.5:1 normal text, 3:1 large text',
  defaultSeverity: 'error',
  // Body copy and headings are exactly where readability failures hurt a
  // reader, so this rule grades TEXT anywhere — not just controls.
  appliesTo: 'any',
  check(element: EnhancedElement, _context: RuleContext): Violation | null {
    const m = measureElementContrast(element);

    // An undecodable color is NOT the same as no color. Returning null for both
    // is what let a scan report zero findings on a page it never measured.
    if (m.status === 'unmeasurable') return unmeasurableViolation(element, m, 'aa');
    if (m.status !== 'measured') return null;

    const required = m.large ? 3.0 : 4.5;
    if (m.ratio >= required) return null;

    return {
      ruleId: 'wcag-aa-contrast',
      ruleName: 'WCAG 2.1 AA Contrast',
      severity: 'error',
      message: `"${m.text.slice(0, 40)}" contrast ratio ${m.ratio.toFixed(2)}:1 fails WCAG 2.1 AA (requires ${required}:1 for ${m.large ? 'large' : 'normal'} text)${confidenceNote(m)}`,
      element: element.selector,
      bounds: element.bounds,
      fix: `Increase contrast between foreground ${m.fgRaw} and effective background ${m.bgRaw}`,
    };
  },
};

const wcagAAAContrastRule: Rule = {
  id: 'wcag-aaa-contrast',
  name: 'WCAG 2.1 AAA Contrast',
  description: 'Text should meet WCAG 2.1 AAA contrast ratio: 7:1 normal text, 4.5:1 large text',
  defaultSeverity: 'warn',
  appliesTo: 'any',
  check(element: EnhancedElement, _context: RuleContext): Violation | null {
    const m = measureElementContrast(element);

    if (m.status === 'unmeasurable') return unmeasurableViolation(element, m, 'aaa');
    if (m.status !== 'measured') return null;

    const required = m.large ? 4.5 : 7.0;
    if (m.ratio >= required) return null;

    return {
      ruleId: 'wcag-aaa-contrast',
      ruleName: 'WCAG 2.1 AAA Contrast',
      severity: 'warn',
      message: `"${m.text.slice(0, 40)}" contrast ratio ${m.ratio.toFixed(2)}:1 below WCAG 2.1 AAA (${required}:1 for ${m.large ? 'large' : 'normal'} text)${confidenceNote(m)}`,
      element: element.selector,
      bounds: element.bounds,
      fix: `Increase contrast between foreground ${m.fgRaw} and effective background ${m.bgRaw} to ${required}:1`,
    };
  },
};

// ============================================
// Preset
// ============================================

export const wcagContrastPresetRules: Rule[] = [wcagAAContrastRule, wcagAAAContrastRule];

export const wcagContrastPreset: RulePreset = {
  name: 'wcag-contrast',
  description: 'WCAG 2.1 contrast ratio checks — AA (4.5:1 / 3:1) and AAA (7:1 / 4.5:1)',
  rules: wcagContrastPresetRules,
  defaults: {
    'wcag-aa-contrast': 'error',
    'wcag-aaa-contrast': 'warn',
  },
};
