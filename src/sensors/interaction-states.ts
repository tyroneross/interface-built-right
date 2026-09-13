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
 * Splits selectorText on top-level commas only — a comma inside a functional
 * pseudo's argument list (`:where(a, .btn)`, `:is(.a, .b)`) is not a
 * selector-list separator. A naive `selectorText.split(',')` shreds
 * `:where(a, .btn):focus-visible` into `:where(a` and ` .btn):focus-visible`
 * — the second part still matches STATE_RE and produces a malformed base
 * (`.btn)`, unbalanced paren, missing the `a` alternative entirely).
 *
 * Copied from `splitTopLevelCommas` in css-extract.ts (same depth-tracking
 * algorithm) rather than imported — that closure runs inside
 * `page.evaluate()` and ships across CDP as a stringified function, so it
 * cannot be imported here. Keep the two in sync by hand.
 */
function splitTopLevelCommas(selectorText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selectorText) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

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
  const parts = splitTopLevelCommas(selectorText);
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

/**
 * True when a focus/focus-visible rule's declarations only ever REMOVE the
 * outline (or box-shadow standing in for one), never actually indicate
 * focus. `*:focus { outline: none }` and `:focus:not(:focus-visible)
 * { outline: none }` (a common "no ring for mouse users" reset) both parse
 * to a base selector and a legit focus/focus-visible state, so without this
 * check they were counted as coverage — silencing every real
 * missing-focus-indicator finding on the page.
 *
 * Browsers decompose the `outline` shorthand into its longhands
 * (outline-color/-style/-width) whenever the value resolves cleanly, so a
 * literal `{ outline: 'none' }` (unit-test fixtures) and the real evidence
 * shape `{outline-color: initial, outline-style: none, outline-width:
 * initial}` (live scan, `outline: none` decomposed) must both classify as
 * removal-only. `initial` is accepted alongside the "removed" keyword for
 * each longhand because CSS's initial value for outline-style IS `none` —
 * `outline: 0` decomposes to `{outline-color: initial, outline-style:
 * initial, outline-width: 0px}` (verified live, headless Chrome), and every
 * one of those three is a removal value. `outline-offset` never counts on
 * its own — it only matters when an outline is actually visible. A rule
 * that ALSO recovers a shorthand carrying a real value (e.g. `outline: 2px
 * solid var(--accent)`, recovered by the css-extract.ts shorthand-prefix fix
 * because its longhands read "" for the unresolved var()) hits the
 * `default: return false` branch below and is correctly NOT removal-only.
 *
 * Tailwind v3's `focus:outline-none` compiles to `outline: 2px solid
 * transparent; outline-offset: 2px` — a *visible-shape, invisible-color*
 * reset, not a bare `outline: none`. Verified live (headless Chrome):
 * `outline: 2px solid transparent` decomposes to `{outline-color:
 * transparent, outline-style: solid, outline-width: 2px}` — `outline-style`
 * and `outline-width` are NOT removal values on their own (solid / 2px), so
 * without special-casing this the rule fell through to `default: return
 * false` and was wrongly treated as a real focus indicator. A transparent
 * outline paints nothing, so once `outline-color` resolves to `transparent`
 * (as a longhand, or embedded in a still-intact `outline` shorthand), the
 * whole declaration counts as removal regardless of what outline-style/
 * outline-width say.
 *
 * `cursor`, `transition`, and `transition-*` (the longhands Chrome
 * decomposes `transition: outline-color 0.2s` into: -behavior, -duration,
 * -timing-function, -delay, -property) are NEUTRAL — they don't indicate
 * focus themselves, but they also don't disqualify a rule that pairs them
 * with a real removal (`outline: none; cursor: pointer` must still be
 * removal-only). A rule containing ONLY neutral properties (e.g. bare
 * `cursor: pointer` on `:focus`, no outline/box-shadow at all) is *also*
 * removal-only — there's no declared property that visually indicates
 * focus, so it must not count as coverage either.
 */
function isFocusRemovalOnly(declarations: Record<string, string>): boolean {
  const props = Object.keys(declarations);
  if (props.length === 0) return true;

  const norm = (v: string | undefined) => (v ?? '').trim().toLowerCase();
  const outlineColor = norm(declarations['outline-color']);
  const outlineShorthand = norm(declarations['outline']);
  const transparentOutline =
    outlineColor === 'transparent' ||
    (outlineShorthand !== '' && outlineShorthand.includes('transparent'));

  return props.every((prop) => {
    const value = norm(declarations[prop]);
    switch (prop) {
      case 'outline':
      case 'outline-style':
        return value === 'none' || value === 'initial' || transparentOutline;
      case 'outline-width':
        return value === '0' || value === '0px' || value === 'initial' || transparentOutline;
      case 'outline-color':
        return value === 'transparent' || value === 'initial';
      case 'outline-offset':
        return true;
      case 'box-shadow':
        return value === 'none';
      case 'cursor':
      case 'transition':
        return true;
      default:
        return prop.startsWith('transition-');
    }
  });
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
 * True for elements that look interactive — buttons, links, role=button/link,
 * or anything with an onClick/href handler. Used to decide which elements
 * must carry a declared focus indicator.
 */
function isInteractiveElement(el: SensorContext['elements'][number]): boolean {
  const tag = el.tagName.toLowerCase();
  const role = el.a11y?.role ?? '';
  return (
    tag === 'button' ||
    tag === 'a' ||
    role === 'button' ||
    role === 'link' ||
    Boolean(el.interactive?.hasOnClick) ||
    Boolean(el.interactive?.hasHref)
  );
}

export function collectInteractionStates(ctx: SensorContext): InteractionStatesReport {
  const rules = ctx.cssRules ?? [];
  if (rules.length === 0) {
    return { states: [], findings: [] };
  }

  const states: StateRule[] = [];
  // Structural selectors (see `buildStructuralSelector` in css-extract.ts) of
  // every LIVE element some declared `:focus`/`:focus-visible` rule actually
  // matched at scan time (`ExtractedCSSRule.focusMatches`). This is the
  // precise coverage source — it survives compound selectors, combinators,
  // and attribute selectors that the string-based `hasFocus` map below
  // cannot compare against. Populated only when the sensor context came from
  // a live browser scan; empty for static/fixture contexts, which then rely
  // on the legacy string match.
  const focusCoveredSelectors = new Set<string>();

  // Legacy string match: a focus/focus-visible rule's base selector equals
  // the element's own generated selector, its bare tag name, or one of its
  // classes. Kept as a fallback for contexts with no `focusMatches` data
  // (static fixtures, unit tests) and as a fast path for the common
  // bare-tag/bare-class case. Populated inline below, gated by
  // `isFocusRemovalOnly` — needs the SAME rule's declarations that produced
  // each (base, state) pair, so it can't be rebuilt from `states` alone
  // after the fact without re-associating declarations back to rules.
  const hasFocus = new Map<string, boolean>();

  walkRules(rules, (style, walkCtx) => {
    const parsed = parseStateSelectors(style.selector);
    // Computed once per rule and shared by the legacy hasFocus map and the
    // structural focusMatches set below — both describe coverage from the
    // SAME declaration block, so a rule that only removes the outline must
    // fail to provide coverage through either path.
    const removalOnly = isFocusRemovalOnly(style.declarations);
    for (const { base, state } of parsed) {
      const entry: StateRule = {
        selector: base,
        state,
        properties: { ...style.declarations },
        ...(walkCtx.insideHoverMedia ? { conditional_hover: true } : {}),
      };
      states.push(entry);
      if ((state === 'focus' || state === 'focus-visible') && !removalOnly) {
        hasFocus.set(base, true);
      }
    }
    if (style.focusMatches && !removalOnly) {
      for (const sel of style.focusMatches) focusCoveredSelectors.add(sel);
    }
  });

  // Findings are keyed to the ELEMENT's own selector, not to a base string
  // pulled off a CSS rule. The prior version put each interactive element's
  // selector, tag, and classes into one flat set and reported every base
  // string lacking an EXACT-STRING focus/focus-visible rule — so a universal
  // `button:focus-visible {}` rule cleared the bare "button" entry while
  // `#start-btn` (a DIFFERENT entry in the same set) stayed flagged, and
  // id-less elements were reported under unwritable structural DOM paths.
  // Real evidence: 27 findings including `#workspace-refresh`, `button`, and
  // `#baseline-screen > section.baseline-comment > div.baseline-comment-actions
  // > button.btn-primary`. Now: one element is one finding candidate, covered
  // if ANY of {its selector, its tag, any of its classes} has a legacy focus
  // rule, OR its selector is in `focusCoveredSelectors` (a declared focus
  // rule really matched it in the live DOM).
  const findings: StateFinding[] = [];
  const seen = new Set<string>();
  for (const el of ctx.elements) {
    if (!isInteractiveElement(el)) continue;
    if (seen.has(el.selector)) continue;

    const tag = el.tagName.toLowerCase();
    const classes =
      typeof el.className === 'string'
        ? el.className.split(/\s+/).filter((c) => c && !c.includes(':'))
        : [];
    const legacyCovered =
      hasFocus.get(el.selector) === true ||
      hasFocus.get(tag) === true ||
      classes.some((c) => hasFocus.get(`.${c}`) === true);
    const structurallyCovered = focusCoveredSelectors.has(el.selector);

    if (legacyCovered || structurallyCovered) continue;

    seen.add(el.selector);
    findings.push({ selector: el.selector, missing: 'focus_indicator' });
  }

  return { states, findings };
}
