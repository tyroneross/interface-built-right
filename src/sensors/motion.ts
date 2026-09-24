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
  /**
   * Raw `var(...)` token(s) that survived variable resolution unresolved
   * (no own/root/single-value declaration found, or a cycle hit the
   * recursion cap). Present only when at least one duration/delay slot
   * could not be reduced to a literal time. The entry is still reported —
   * see `resolveVars` / `MAX_VAR_DEPTH` below for why filtering it out
   * would silently hide the transition instead of surfacing "declared but
   * unresolvable".
   */
  unresolved?: string[];
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
 * Custom-property (`--*`) resolution for `var()` inside transition timing.
 *
 * WHY THIS EXISTS. `transition: opacity var(--dur) ease` — and Tailwind v4's
 * `transition-duration: var(--tw-duration, var(--default-transition-duration))`
 * with the real value declared as `--default-transition-duration: 150ms` on
 * `:root, :host` inside `@layer theme` — arrived at `parseTransitionEntry`
 * as literal `var(...)` text. Nothing in that text matches the `\d+(ms|s)`
 * time regex, so `duration_ms` stayed 0 and the zero-duration filter dropped
 * the entry. Declared motion with the timing value tokenized through a
 * custom property was indistinguishable from no motion at all.
 */
const MAX_VAR_DEPTH = 8;
const ROOT_ISH_SELECTORS = new Set(['*', ':root', ':host']);

function isRootIshSelector(selectorText: string): boolean {
  return selectorText
    .split(',')
    .map((s) => s.trim())
    .some((part) => ROOT_ISH_SELECTORS.has(part) || part.toLowerCase() === 'html');
}

interface CustomPropertyIndex {
  /** Value declared on a `:root`/`html`/`:host`/`*` selector (or a list containing one). */
  rootValues: Map<string, string>;
  /** Every distinct value seen anywhere, so a property with exactly one
   *  declared value site can still resolve even without a root declaration. */
  allValues: Map<string, Set<string>>;
}

/**
 * Walk style rules (recursing into media/container/supports, but never into
 * a `prefers-reduced-motion` block — that CSS exists to declare DIFFERENT
 * motion, so its custom-property values must not leak into resolving the
 * page's normal-motion transitions) collecting every `--*` declaration.
 */
function buildCustomPropertyIndex(rules: ExtractedCSSRule[]): CustomPropertyIndex {
  const rootValues = new Map<string, string>();
  const allValues = new Map<string, Set<string>>();

  function visitStyle(rule: Extract<ExtractedCSSRule, { kind: 'style' }>): void {
    for (const [prop, value] of Object.entries(rule.declarations)) {
      if (!prop.startsWith('--')) continue;
      const set = allValues.get(prop) ?? new Set<string>();
      set.add(value);
      allValues.set(prop, set);
      if (isRootIshSelector(rule.selector) && !rootValues.has(prop)) {
        rootValues.set(prop, value);
      }
    }
  }

  function visit(rs: ExtractedCSSRule[]): void {
    for (const r of rs) {
      if (r.kind === 'style') {
        visitStyle(r);
      } else if (r.kind === 'media') {
        if (isReducedMotionMedia(r.conditionText)) continue;
        visit(r.rules);
      } else if (r.kind === 'container' || r.kind === 'supports') {
        visit(r.rules);
      }
    }
  }

  visit(rules);
  return { rootValues, allValues };
}

/**
 * Resolution order for a custom property `name` used by `rule`: the rule's
 * own declaration first (a local override beats the root default); else a
 * root-ish declaration; else the author's own `var()` fallback,
 * when the call site provided one; only when there is NO fallback to defer
 * to does the "only distinct value declared anywhere" guess apply; else
 * unresolved.
 *
 * WHY THE FALLBACK OUTRANKS THE SINGLE-VALUE GUESS. A non-root declaration
 * like `.duration-300 { --tw-duration: 300ms }` only applies to elements
 * `.duration-300` actually matches. For an unrelated rule
 * (`.transition { transition: opacity var(--tw-duration, var(--default-
 * transition-duration)) } }`), that value says nothing about intent — it
 * being the ONLY declaration of `--tw-duration` anywhere on the page is a
 * coincidence of what else happens to be on the page, not evidence this
 * rule means to use it. The author's own fallback is the better answer.
 * `hasFallback` is passed in (rather than inferred here) so the caller
 * ( `resolveVars`) stays the single place that knows whether a given
 * `var()` occurrence declared one.
 */
function resolveCustomProp(
  name: string,
  rule: Extract<ExtractedCSSRule, { kind: 'style' }>,
  index: CustomPropertyIndex,
  hasFallback: boolean,
): string | undefined {
  const own = rule.declarations[name];
  if (own !== undefined) return own;
  const root = index.rootValues.get(name);
  if (root !== undefined) return root;
  if (hasFallback) return undefined;
  const all = index.allValues.get(name);
  if (all && all.size === 1) return [...all][0];
  return undefined;
}

/** One `var(--name[, fallback])` occurrence, paren-depth-aware so a fallback
 *  containing its own `var(...)` or a comma doesn't split early. */
interface VarCall {
  start: number;
  end: number;
  name: string;
  fallback?: string;
}

function findVarCalls(value: string): VarCall[] {
  const calls: VarCall[] = [];
  let i = 0;
  while (i < value.length) {
    const idx = value.indexOf('var(', i);
    if (idx === -1) break;
    let depth = 1;
    let j = idx + 4;
    while (j < value.length && depth > 0) {
      if (value[j] === '(') depth++;
      else if (value[j] === ')') depth--;
      j++;
    }
    const inner = value.slice(idx + 4, depth === 0 ? j - 1 : j);
    let commaIdx = -1;
    let innerDepth = 0;
    for (let k = 0; k < inner.length; k++) {
      if (inner[k] === '(') innerDepth++;
      else if (inner[k] === ')') innerDepth--;
      else if (inner[k] === ',' && innerDepth === 0) {
        commaIdx = k;
        break;
      }
    }
    const name = (commaIdx === -1 ? inner : inner.slice(0, commaIdx)).trim();
    const fallback = commaIdx === -1 ? undefined : inner.slice(commaIdx + 1).trim();
    calls.push({ start: idx, end: j, name, fallback });
    i = j;
  }
  return calls;
}

/**
 * Substitute every `var(...)` in `value` using `index`, scoped to `rule` for
 * "own declaration wins" resolution. Recurses on the substituted text (a
 * resolved/fallback value can itself contain `var(...)`) up to
 * `MAX_VAR_DEPTH`, which is what makes a declared cycle
 * (`--a: var(--b); --b: var(--a)`) terminate instead of hang — depth is a
 * plain counter, not per-name cycle detection, so it also bounds any
 * pathologically deep legitimate chain the same way. Whatever `var(...)`
 * text is still present when the cap is hit is left as-is (unresolved).
 */
function resolveVars(
  value: string,
  rule: Extract<ExtractedCSSRule, { kind: 'style' }>,
  index: CustomPropertyIndex,
  depth = 0,
): string {
  if (depth >= MAX_VAR_DEPTH || !value.includes('var(')) return value;
  const calls = findVarCalls(value);
  if (calls.length === 0) return value;

  let result = '';
  let last = 0;
  for (const call of calls) {
    result += value.slice(last, call.start);
    const resolved = resolveCustomProp(call.name, rule, index, call.fallback !== undefined);
    if (resolved !== undefined) {
      result += resolveVars(resolved, rule, index, depth + 1);
    } else if (call.fallback !== undefined) {
      result += resolveVars(call.fallback, rule, index, depth + 1);
    } else {
      result += value.slice(call.start, call.end);
    }
    last = call.end;
  }
  result += value.slice(last);
  return result;
}

/**
 * Parse a single transition entry. Per CSS spec, order is flexible:
 * property is the first non-time non-keyword token; first time is duration;
 * second time is delay; the rest is easing.
 *
 * Review follow-up: a single left-to-right pass that treated an unresolved
 * `var(...)` token as if it WERE a time (original version of this function)
 * misattributed real literal times. `var(--prop) 200ms ease` counted the var
 * as filling the duration slot at 0ms, which bumped the literal `200ms` into
 * the DELAY slot instead of duration — a var() the scanner cannot classify
 * was corrupting a value it COULD read perfectly well.
 *
 * Two-phase rule, scanning the whole entry before deciding anything:
 * property and easing come only from literal (non-var, non-time) tokens —
 * a var() is never one of those. Then:
 *   - An unresolved var() sandwiched strictly between the
 *     identifier property and the first literal time (`opacity var(--dur)
 *     50ms`) IS the duration the author intended — that positioning is the
 *     one case where a var() genuinely reads as a time, not a placeholder.
 *     It gets `duration_ms: 0` + `unresolved`, and the literal time that
 *     follows becomes the DELAY (not the duration) since the duration slot
 *     is already spoken for.
 *   - Otherwise, when the entry has ANY literal time, literal times are
 *     authoritative: first = duration, second = delay. No other var() fills
 *     a time slot or sets `unresolved` in this case — a var() the scanner
 *     cannot place positionally must not be allowed to relabel a number it
 *     COULD read correctly.
 *   - Only when the entry has NO literal time at all does a var() stand in
 *     for the (otherwise entirely absent) duration, so a wholly
 *     var()-timed transition is reported instead of silently dropped as
 *     "no motion declared":
 *       - identifier present (e.g. `opacity var(--d) ease`) → the FIRST var
 *         is the duration.
 *       - no identifier, 2+ vars (e.g. `var(--p) var(--d)`) → the first var
 *         is a positional property placeholder (property stays 'all'), the
 *         SECOND is the duration.
 *       - no identifier, exactly 1 var (e.g. `var(--d)` alone) → that var is
 *         the duration.
 *     The chosen duration var is recorded in `unresolved`; every other var
 *     token is a silent placeholder (property or easing) that never sets
 *     `unresolved`.
 */
function parseTransitionEntry(
  part: string,
): { property: string; duration_ms: number; easing: string; delay_ms: number; unresolved?: string[] } {
  const tokens = tokenizeTransitionPart(part);
  const isVarTok = (tok: string): boolean => tok.startsWith('var(');
  const isTimeTok = (tok: string): boolean => /^[\d.]+(ms|s)$/i.test(tok);
  const isEasingTok = (tok: string): boolean =>
    /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|cubic-bezier|steps)/i.test(tok);

  let property = 'all';
  let easing = 'ease';
  let propertyIndex: number | undefined;
  const literalTimeIndices: number[] = [];
  const varIndices: number[] = [];

  tokens.forEach((tok, idx) => {
    if (isVarTok(tok)) {
      varIndices.push(idx);
      return;
    }
    if (isTimeTok(tok)) {
      literalTimeIndices.push(idx);
      return;
    }
    if (isEasingTok(tok)) {
      if (easing === 'ease') easing = tok;
    } else if (property === 'all') {
      property = tok;
      propertyIndex = idx;
    }
  });

  const literalTimes = literalTimeIndices.map((idx) => parseTimeMs(tokens[idx]!));
  const firstLiteralTimeIndex = literalTimeIndices[0];

  let duration_ms = 0;
  let delay_ms = 0;
  let unresolved: string[] | undefined;

  if (literalTimes.length > 0) {
    // A var() strictly between the identifier and the first
    // literal time is the duration placeholder; the literal time it
    // displaces becomes the delay. Accepted trade-off: this also fires on
    // the unusual-but-valid order `opacity var(--ease) 200ms`, where the
    // var is really the EASING — we can't distinguish that from a genuine
    // duration var positionally, so it reads as duration 0 / delay 200.
    const durationVarIndex =
      propertyIndex !== undefined && firstLiteralTimeIndex !== undefined
        ? varIndices.find((i) => i > propertyIndex! && i < firstLiteralTimeIndex!)
        : undefined;

    if (durationVarIndex !== undefined) {
      unresolved = [tokens[durationVarIndex]!];
      delay_ms = literalTimes[0] ?? 0;
    } else {
      duration_ms = literalTimes[0] ?? 0;
      delay_ms = literalTimes[1] ?? 0;
    }
  } else if (varIndices.length > 0) {
    const hasIdentifier = property !== 'all';
    const durationVarIndex = hasIdentifier
      ? varIndices[0]
      : varIndices.length >= 2
        ? varIndices[1]
        : varIndices[0];
    if (durationVarIndex !== undefined) unresolved = [tokens[durationVarIndex]!];
  }

  return { property, duration_ms, easing, delay_ms, ...(unresolved ? { unresolved } : {}) };
}

/**
 * Walk rules collecting transitions from style rules.
 * Inline rules (selector === '<inline>') are kept as-is so callers can trace.
 */
/**
 * Rebuild the `transition` shorthand from its longhands.
 *
 * WHY THIS EXISTS. `collectTransitionsFromStyle` read `decls.transition`, and
 * that key is NEVER PRESENT. `declarationsFromStyle` (src/sensors/css-extract.ts)
 * enumerates a CSSStyleDeclaration with `style.item(i)`, which yields LONGHANDS
 * — `transition-property`, `transition-duration`, `transition-timing-function`,
 * `transition-delay` — and never the shorthand the author typed. So
 * `transitionValue` was always undefined, the function always returned [], and
 * `motion.transitions` was empty on every page ever scanned.
 *
 * Proven by planted defect: `.anim { transition: opacity 200ms ease-out 50ms }`
 * produced `transitions: []` and a one-liner reading "0 transition(s)".
 *
 * Same shape as the rule-side defects in this sweep: a lane reads a key nobody
 * produces, gets undefined, and files it as "nothing to report".
 */
function transitionFromLonghands(decls: Record<string, string>): string | undefined {
  const props = decls['transition-property'];
  if (!props || props === 'none') return undefined;

  // Paren-aware split (via `splitTransitionValue`), not a naive `.split(',')`:
  // `transition-duration: var(--tw-duration, var(--default-transition-duration))`
  // has a comma INSIDE the var() fallback, which is not a separator between
  // multiple transitions. A naive split shredded it into
  // `["var(--tw-duration", "var(--default-transition-duration))"]` — neither
  // a parseable time nor a resolvable var() — so a longhand-declared var()
  // duration was corrupted before var resolution ever ran.
  const list = (key: string): string[] => splitTransitionValue(decls[key] ?? '');

  const properties = splitTransitionValue(props);
  const durations = list('transition-duration');
  const easings = list('transition-timing-function');
  const delays = list('transition-delay');

  // Per spec each longhand list cycles independently to match the longest.
  const at = (arr: string[], i: number, fallback: string) =>
    arr.length > 0 ? arr[i % arr.length]! : fallback;

  return properties
    .map((prop, i) =>
      [prop, at(durations, i, '0s'), at(easings, i, 'ease'), at(delays, i, '0s')].join(' '),
    )
    .join(', ');
}

function collectTransitionsFromStyle(
  rule: Extract<ExtractedCSSRule, { kind: 'style' }>,
  varIndex: CustomPropertyIndex,
): TransitionEntry[] {
  const decls = rule.declarations;
  // Shorthand first for any producer that supplies one (hand-built fixtures,
  // older cached scans); longhands are what the live extractor actually emits.
  const rawTransitionValue = decls.transition ?? transitionFromLonghands(decls);
  if (!rawTransitionValue || rawTransitionValue === 'none') return [];
  // Resolve `var(...)` timing (see `resolveVars` above) before splitting —
  // splitting is comma-aware for a var()'s own fallback comma, but resolving
  // first collapses that to plain text so nothing downstream needs to know
  // variables exist at all.
  const transitionValue = resolveVars(rawTransitionValue, rule, varIndex);
  const parts = splitTransitionValue(transitionValue);
  return parts
    .map((p) => ({ selector: rule.selector, ...parseTransitionEntry(p) }))
    // A zero-duration transition is the browser's default for every element
    // that declares none; reporting those would drown the real ones. A
    // transition whose duration/delay is an unresolved var() is kept even at
    // 0ms — the `unresolved` marker distinguishes "declared but unresolvable"
    // from "not declared".
    .filter((t) => t.duration_ms > 0 || t.delay_ms > 0 || (t.unresolved && t.unresolved.length > 0));
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
  const varIndex = buildCustomPropertyIndex(rules);

  walkRules(rules, (style, insideReducedMotion) => {
    if (insideReducedMotion) {
      const override = collectReducedMotionOverridesFromRule(style);
      if (override) reducedOverrides.push(override);
    } else {
      transitions.push(...collectTransitionsFromStyle(style, varIndex));
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
