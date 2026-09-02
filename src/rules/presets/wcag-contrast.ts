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

/*
 * WCAG 2.1 exempts inactive components from contrast entirely. SC 1.4.3
 * Contrast (Minimum): "Text or images of text that are part of an inactive user
 * interface component ... have no contrast requirement." SC 1.4.11 Non-text
 * Contrast carries the same carve-out. An inactive component is one that is
 * "visible but not currently operable" — the canonical example in the spec is a
 * submit button that stays disabled until the form is complete.
 *   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 *
 * Grading them anyway is not conservatism, it is a false positive, and a false
 * positive in an accessibility checker is expensive twice over: it costs the
 * reader time, and it teaches them to skim past this rule's output — which is
 * how a REAL contrast failure gets scrolled past later.
 *
 * This is also the shape of the wider defect. 4.5:1 is not a property of text;
 * it is a property of text that a person is expected to read and act on. A rule
 * that applies the number without asking whether the element is operable has
 * hard-coded the threshold and dropped the relationship that gives it meaning.
 *
 * `isDisabled` is set from BOTH the native `disabled` property and
 * `aria-disabled="true"` (see interactivity.ts), so a div-based control that
 * announces itself disabled is exempt on the same terms as a <button>.
 *
 * SCOPE, stated rather than implied: this exempts an element that is ITSELF
 * disabled. Text in a child element of a disabled control is not yet exempt,
 * because a rule receives one element and has no parent link here. That gap is
 * filed, not forgotten.
 */
function isInactiveComponent(element: EnhancedElement): boolean {
  return element.interactive?.isDisabled === true;
}

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
    // WCAG 1.4.3 / 1.4.11 exempt inactive components. Checked BEFORE measuring,
    // so an exempt element cannot surface as an "unmeasurable" finding either.
    if (isInactiveComponent(element)) return null;

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
    // WCAG 1.4.3 / 1.4.11 exempt inactive components. Checked BEFORE measuring,
    // so an exempt element cannot surface as an "unmeasurable" finding either.
    if (isInactiveComponent(element)) return null;

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
