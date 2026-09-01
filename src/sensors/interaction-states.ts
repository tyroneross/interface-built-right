import type { SensorContext, ExtractedCSSRule } from './types.js';

/**
 * Interaction-states sensor — enumerates declared `:hover`, `:focus`,
 * `:focus-visible`, `:active`, `:disabled` rules from the page's
 * stylesheets and flags missing focus indicators on interactive selectors.
 *
 * Why this sensor exists: prior to this sensor, IBR's single-capture scan
 * could not surface state-driven styling. See linear-app-20260527.md §3
 * Navigation — "Hover / active / focus / disabled: not detectable in
 * single capture — IBR's scan did not enumerate state-specific CSS rules."
 */

export type InteractionState = 'hover' | 'focus' | 'focus-visible' | 'active' | 'disabled' | 'focus-within';

export interface StateRule {
  selector: string;                   // base selector (without the pseudo)
  state: InteractionState;
  properties: Record<string, string>;
  /** True when this rule is nested inside `@media (hover: hover)`. */
  conditional_hover?: boolean;
}

export interface StateFinding {
  selector: string;
  missing: 'focus_indicator';
}

export interface InteractionStatesReport {
  states: StateRule[];
  findings: StateFinding[];
}

// Regex alternation matches left-to-right; longer alternatives MUST come first
// so ":focus-visible" matches "focus-visible" before ":focus".
const STATE_RE = /:(focus-visible|focus-within|hover|focus|active|disabled)\b/g;

/**
 * Extract the base selector (everything left of the first pseudo-class).
 * ".btn:hover" → ".btn"
 * "a.link:focus-visible" → "a.link"
 * ".btn:hover, .alt:hover" → splits and returns each base
 */
function parseStateSelectors(
  selectorText: string,
): Array<{ base: string; state: InteractionState }> {
  const out: Array<{ base: string; state: InteractionState }> = [];
  const parts = selectorText.split(',').map((p) => p.trim());
  for (const part of parts) {
    STATE_RE.lastIndex = 0;
    const matches: Array<{ index: number; state: InteractionState }> = [];
    let m: RegExpExecArray | null;
    while ((m = STATE_RE.exec(part)) !== null) {
      matches.push({ index: m.index, state: m[1] as InteractionState });
    }
    if (matches.length === 0) continue;
    // The base selector is everything before the FIRST pseudo
    const base = part.slice(0, matches[0]!.index).trim();
    for (const { state } of matches) {
      // Avoid duplicate (base,state) within one selector segment
      if (!out.some((e) => e.base === base && e.state === state)) {
        out.push({ base, state });
      }
    }
  }
  return out;
}

function isHoverCapableMedia(conditionText: string): boolean {
  return /\(\s*hover\s*:\s*hover\s*\)/i.test(conditionText);
}

interface WalkContext {
  insideHoverMedia: boolean;
}

function walkRules(
  rules: ExtractedCSSRule[],
  visit: (rule: Extract<ExtractedCSSRule, { kind: 'style' }>, ctx: WalkContext) => void,
  ctx: WalkContext = { insideHoverMedia: false },
): void {
  for (const r of rules) {
    if (r.kind === 'style') {
      visit(r, ctx);
    } else if (r.kind === 'media') {
      const nowInside = ctx.insideHoverMedia || isHoverCapableMedia(r.conditionText);
      walkRules(r.rules, visit, { insideHoverMedia: nowInside });
    } else if (r.kind === 'container' || r.kind === 'supports') {
      walkRules(r.rules, visit, ctx);
    }
  }
}

/**
 * From the elements list, return the set of base selectors that look
 * interactive — buttons, links, role=button/link, or anything with an
 * onClick/href handler. Used to flag missing :focus indicators.
 *
 * Strategy: derive a class-or-tag matcher from each element's selector
 * so we can compare against rule selectors that target classes (".btn")
 * or tags ("button", "a").
 */
function interactiveBaseSelectors(ctx: SensorContext): Set<string> {
  const out = new Set<string>();
  for (const el of ctx.elements) {
    const tag = el.tagName.toLowerCase();
    const role = el.a11y?.role ?? '';
    const isInteractive =
      tag === 'button' ||
      tag === 'a' ||
      role === 'button' ||
      role === 'link' ||
      Boolean(el.interactive?.hasOnClick) ||
      Boolean(el.interactive?.hasHref);
    if (!isInteractive) continue;

    // Add the raw selector (e.g. "button.btn:nth-of-type(2)")
    out.add(el.selector);
    // Also add the tag name (".btn:hover" may target "button" rules)
    out.add(tag);

    // AND every class the element actually carries.
    //
    // This used to be `el.selector.match(/^\.[A-Za-z_][\w-]*/)` — the class
    // portion IF the selector starts with a class. It never does: both
    // selector generators (src/extract.ts `generateSelector`,
    // src/sensors/css-extract.ts `buildStructuralSelector`) always begin with a
    // tag name or `#id`, so that branch was unreachable in production and
    // `interactiveBases` held only DOM paths and bare tag names.
    //
    // With no bridge from a CSS class to an element, the findings loop fell
    // back to a substring test on the literal strings 'btn' / 'button' /
    // 'link'. That failed in both directions: a real `<button class="cta">`
    // with a `.cta:hover` rule and no `:focus` produced NO finding because its
    // class is not named "btn", and a stylesheet containing `.pill-btn:hover`
    // produced a finding even with no such element on the page — proven by
    // planted defect, both on one fixture.
    if (typeof el.className === 'string') {
      for (const cls of el.className.split(/\s+/)) {
        if (cls && !cls.includes(':')) out.add(`.${cls}`);
      }
    }
  }
  return out;
}

export function collectInteractionStates(ctx: SensorContext): InteractionStatesReport {
  const rules = ctx.cssRules ?? [];
  if (rules.length === 0) {
    return { states: [], findings: [] };
  }

  const states: StateRule[] = [];
  walkRules(rules, (style, walkCtx) => {
    const parsed = parseStateSelectors(style.selector);
    for (const { base, state } of parsed) {
      const entry: StateRule = {
        selector: base,
        state,
        properties: { ...style.declarations },
        ...(walkCtx.insideHoverMedia ? { conditional_hover: true } : {}),
      };
      states.push(entry);
    }
  });

  // Findings: any interactive base selector that has a :hover rule but
  // NO :focus or :focus-visible rule is missing a focus indicator.
  const interactiveBases = interactiveBaseSelectors(ctx);
  const hasHover = new Map<string, boolean>();
  const hasFocus = new Map<string, boolean>();
  for (const s of states) {
    if (s.state === 'hover') hasHover.set(s.selector, true);
    if (s.state === 'focus' || s.state === 'focus-visible') hasFocus.set(s.selector, true);
  }

  const findings: StateFinding[] = [];
  for (const sel of new Set([...hasHover.keys(), ...interactiveBases])) {
    // A finding must correspond to an element that EXISTS. The substring
    // heuristic this replaces reported `.pill-btn` as missing a focus
    // indicator on a page containing no such element — a defect invented from
    // a stylesheet, which a reader cannot act on and learns to ignore.
    // `interactiveBases` is now built from real elements and their real
    // classes, so it can carry the whole test.
    if (!interactiveBases.has(sel)) continue;
    if (!hasFocus.get(sel)) {
      findings.push({ selector: sel, missing: 'focus_indicator' });
    }
  }

  return { states, findings };
}
