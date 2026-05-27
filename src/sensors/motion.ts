import type { SensorContext, ExtractedCSSRule } from './types.js';

/**
 * Motion sensor — extracts declared `transition` shorthand entries,
 * `@keyframes` definitions, and `prefers-reduced-motion` overrides from
 * the page's stylesheets. Reports them as separate fields so callers can
 * see what motion the page declares (independent of whether the scanner
 * happened to disable transitions for screenshot stability).
 *
 * Why this sensor exists: prior to this sensor, IBR's scan output had no
 * motion data at all. See linear-app-20260527.md §6 Motion & feedback —
 * every line marked "(not detectable in ibr-scan)".
 */

export interface TransitionEntry {
  selector: string;
  property: string;          // "opacity", "transform", "all", etc.
  duration_ms: number;
  easing: string;            // "ease-out", "linear", "cubic-bezier(...)", ...
  delay_ms: number;
}

export interface KeyframesEntry {
  name: string;
  step_count: number;
  /** Selectors observed using this keyframes via `animation` / `animation-name`. */
  used_by_selectors: string[];
}

export interface ReducedMotionOverride {
  selector: string;
  /** Declarations that override animation/transition for this selector. */
  overrides: string[];
}

export interface MotionReport {
  transitions: TransitionEntry[];
  keyframes: KeyframesEntry[];
  reduced_motion_overrides: ReducedMotionOverride[];
}

/**
 * Parse a CSS time value to milliseconds. "200ms" → 200; "0.2s" → 200.
 */
function parseTimeMs(raw: string): number {
  const trimmed = raw.trim().toLowerCase();
  const m = trimmed.match(/^([\d.]+)(ms|s)?$/);
  if (!m) return 0;
  const value = parseFloat(m[1]!);
  const unit = m[2] || 's';
  return unit === 'ms' ? value : value * 1000;
}

/**
 * Tokenize a transition shorthand value, respecting parentheses (for cubic-bezier).
 * "opacity 200ms ease-out, transform 150ms" → ["opacity 200ms ease-out", "transform 150ms"]
 */
function splitTransitionValue(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/**
 * Tokenize a single transition entry, respecting parens.
 * "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1) 50ms" → 4 tokens.
 */
function tokenizeTransitionPart(part: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of part) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (buf) tokens.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);
  return tokens;
}

/**
 * Parse a single transition entry. Per CSS spec, order is flexible:
 * property is the first non-time non-keyword token; first time is duration;
 * second time is delay; the rest is easing.
 */
function parseTransitionEntry(part: string): { property: string; duration_ms: number; easing: string; delay_ms: number } {
  const tokens = tokenizeTransitionPart(part);
  let property = 'all';
  let duration_ms = 0;
  let delay_ms = 0;
  let easing = 'ease';
  let seenTime = 0;

  for (const tok of tokens) {
    const isTime = /^[\d.]+(ms|s)$/i.test(tok);
    if (isTime) {
      if (seenTime === 0) duration_ms = parseTimeMs(tok);
      else if (seenTime === 1) delay_ms = parseTimeMs(tok);
      seenTime++;
    } else if (/^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|cubic-bezier|steps)/i.test(tok)) {
      easing = tok;
    } else {
      // first non-time, non-easing token is the property
      if (property === 'all' || property === '') property = tok;
    }
  }

  return { property, duration_ms, easing, delay_ms };
}

/**
 * Walk rules collecting transitions from style rules.
 * Inline rules (selector === '<inline>') are kept as-is so callers can trace.
 */
function collectTransitionsFromStyle(rule: Extract<ExtractedCSSRule, { kind: 'style' }>): TransitionEntry[] {
  const decls = rule.declarations;
  const transitionValue = decls.transition ?? decls['transition'];
  if (!transitionValue || transitionValue === 'none') return [];
  const parts = splitTransitionValue(transitionValue);
  return parts.map((p) => ({ selector: rule.selector, ...parseTransitionEntry(p) }));
}

/**
 * Walk rules collecting reduced-motion overrides.
 * A "reduced-motion override" is any style rule inside a @media (prefers-reduced-motion: reduce)
 * block that declares `transition: none` or `animation: none` (or sets these to short durations).
 */
function isReducedMotionMedia(conditionText: string): boolean {
  return /prefers-reduced-motion\s*:\s*reduce/i.test(conditionText);
}

function collectReducedMotionOverridesFromRule(
  rule: Extract<ExtractedCSSRule, { kind: 'style' }>,
): ReducedMotionOverride | null {
  const decls = rule.declarations;
  const overrides: string[] = [];
  for (const [prop, value] of Object.entries(decls)) {
    if (/^(transition|animation)/i.test(prop)) {
      overrides.push(`${prop}: ${value}`);
    }
  }
  if (overrides.length === 0) return null;
  return { selector: rule.selector, overrides };
}

/**
 * Walk rules recursively, calling visitor on every style rule. Tracks whether
 * we are currently inside a prefers-reduced-motion media block.
 */
function walkRules(
  rules: ExtractedCSSRule[],
  visit: (rule: Extract<ExtractedCSSRule, { kind: 'style' }>, insideReducedMotion: boolean) => void,
  insideReducedMotion = false,
): void {
  for (const r of rules) {
    if (r.kind === 'style') {
      visit(r, insideReducedMotion);
    } else if (r.kind === 'media') {
      const nowInside = insideReducedMotion || isReducedMotionMedia(r.conditionText);
      walkRules(r.rules, visit, nowInside);
    } else if (r.kind === 'container' || r.kind === 'supports') {
      walkRules(r.rules, visit, insideReducedMotion);
    }
    // keyframes handled separately
  }
}

/**
 * Map keyframes → selectors that reference them via `animation` / `animation-name`.
 */
function buildKeyframesUsage(rules: ExtractedCSSRule[]): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  walkRules(rules, (style) => {
    const animationName = style.declarations['animation-name'] ?? style.declarations.animationName;
    const animationShorthand = style.declarations.animation ?? style.declarations['animation'];
    const candidates: string[] = [];
    if (animationName) candidates.push(...animationName.split(',').map((s) => s.trim()));
    if (animationShorthand) {
      // animation shorthand: name is usually the first non-time, non-keyword identifier
      for (const part of splitTransitionValue(animationShorthand)) {
        const tokens = tokenizeTransitionPart(part);
        for (const tok of tokens) {
          if (
            !/^[\d.]+(ms|s)$/i.test(tok) &&
            !/^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|cubic-bezier|steps|infinite|alternate|reverse|alternate-reverse|forwards|backwards|both|none|normal|paused|running)/i.test(
              tok,
            ) &&
            !/^\d+$/.test(tok) // skip iteration counts
          ) {
            candidates.push(tok);
            break; // only one name per shorthand entry
          }
        }
      }
    }
    for (const name of candidates) {
      const list = usage.get(name) ?? [];
      if (!list.includes(style.selector)) list.push(style.selector);
      usage.set(name, list);
    }
  });
  return usage;
}

export function collectMotion(ctx: SensorContext): MotionReport {
  const rules = ctx.cssRules ?? [];
  if (rules.length === 0) {
    return { transitions: [], keyframes: [], reduced_motion_overrides: [] };
  }

  const transitions: TransitionEntry[] = [];
  const reducedOverrides: ReducedMotionOverride[] = [];

  walkRules(rules, (style, insideReducedMotion) => {
    if (insideReducedMotion) {
      const override = collectReducedMotionOverridesFromRule(style);
      if (override) reducedOverrides.push(override);
    } else {
      transitions.push(...collectTransitionsFromStyle(style));
    }
  });

  // Collect keyframes (top-level + recursively, though spec usually puts them top-level)
  const keyframes: KeyframesEntry[] = [];
  const usage = buildKeyframesUsage(rules);
  function visitKeyframes(rs: ExtractedCSSRule[]): void {
    for (const r of rs) {
      if (r.kind === 'keyframes') {
        keyframes.push({
          name: r.name,
          step_count: r.steps.length,
          used_by_selectors: usage.get(r.name) ?? [],
        });
      } else if (r.kind === 'media' || r.kind === 'container' || r.kind === 'supports') {
        visitKeyframes(r.rules);
      }
    }
  }
  visitKeyframes(rules);

  return { transitions, keyframes, reduced_motion_overrides: reducedOverrides };
}
