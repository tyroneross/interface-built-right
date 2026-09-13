import type { PageLike } from '../engine/page-like.js';
import type { EnhancedElement } from '../schemas.js';
import type { ExtractedCSSRule, DocumentMeta } from './types.js';
import { CAPTURED_STYLE_KEYS } from '../rules/style-read.js';

/**
 * Live-page extractor for CSS rules + document-level metadata used by the
 * typography, breakpoints, motion, hierarchy, and interaction-states sensors.
 *
 * Runs inside the browser via `page.evaluate(...)` so it can access
 * `document.styleSheets` and `document.fonts`. Same-origin sheets are
 * walked; cross-origin sheets throw on `.cssRules` access and are COUNTED,
 * not silently skipped — `sheetsSkipped` rides back on the result so a
 * consumer can tell "this page declares no media queries" from "we could not
 * read the stylesheet that declares them". The previous version of this
 * comment claimed the sensor layer treated missing rules as
 * `data_unavailable`; that was false when written. `data_unavailable` exists
 * only in typography.ts and refers to text elements, never to cssRules.
 *
 * Returned `cssRules` is the discriminated-union shape consumed by the
 * sensors directly (no further transformation needed downstream).
 */
export async function extractCssRulesAndMeta(
  page: PageLike,
): Promise<{
  cssRules: ExtractedCSSRule[];
  documentMeta: DocumentMeta;
  structuralElements: EnhancedElement[];
  /** How many stylesheets were present on the page. */
  sheetsSeen: number;
  /** How many of them threw on `.cssRules` (cross-origin) and were NOT read. */
  sheetsSkipped: number;
}> {
  return page.evaluate((styleKeys: string[]) => {
    // ---- helpers run inside the browser context ----
    interface InlineStyleRule {
      kind: 'style';
      selector: string;
      declarations: Record<string, string>;
      sourceUrl?: string;
    }
    interface InlineMediaRule {
      kind: 'media';
      conditionText: string;
      rules: InlineExtractedRule[];
      sourceUrl?: string;
    }
    interface InlineKeyframesRule {
      kind: 'keyframes';
      name: string;
      steps: Array<{ keyText: string; declarations: Record<string, string> }>;
      sourceUrl?: string;
    }
    interface InlineContainerRule {
      kind: 'container';
      conditionText: string;
      containerName?: string;
      rules: InlineExtractedRule[];
      sourceUrl?: string;
    }
    interface InlineSupportsRule {
      kind: 'supports';
      conditionText: string;
      rules: InlineExtractedRule[];
      sourceUrl?: string;
    }
    type InlineExtractedRule =
      | InlineStyleRule
      | InlineMediaRule
      | InlineKeyframesRule
      | InlineContainerRule
      | InlineSupportsRule;

    function declarationsFromStyle(style: CSSStyleDeclaration): Record<string, string> {
      const out: Record<string, string> = {};
      for (let i = 0; i < style.length; i++) {
        const prop = style.item(i);
        if (!prop) continue;
        const value = style.getPropertyValue(prop);
        if (value) {
          out[prop] = value.trim();
          continue;
        }
        // Chrome enumerates `style.item(i)` down to LONGHANDS even when the
        // declaration was written as a shorthand, and when the shorthand's
        // value contains an unresolved `var()` (a "pending-substitution
        // value" in the CSSOM spec) every enumerated longhand reports "" from
        // `getPropertyValue`, while the shorthand property itself still holds
        // the raw text. Observed live: `.btn:focus-visible { outline: 2px
        // solid var(--accent); outline-offset: 2px }` enumerated
        // outline-color/-style/-width as "" and only outline-offset (no
        // var()) survived — `.option:focus-visible` captured
        // `{outline-offset: '2px'}` and `.option:hover` captured `{}`.
        // Recover by walking hyphen-joined prefixes of the longhand's name
        // from longest to shortest (border-top-width -> border-top ->
        // border) and keeping the first prefix whose OWN getPropertyValue is
        // non-empty. `out` doubles as the "already added" set — dict keys
        // dedupe naturally, so a later longhand that resolves to an already-
        // recovered shorthand is a no-op.
        const parts = prop.split('-');
        // A longhand with 3+ hyphen segments can have a "drop the middle"
        // shorthand that no contiguous left-anchored prefix below would ever
        // reach: `border-top-color` -> `border-color` (not `border-top`,
        // which isn't a real property), `border-top-left-radius` ->
        // `border-radius`. Tried FIRST so the more specific two-part
        // shorthand wins over a coarser prefix (e.g. plain `border`) that
        // would also happen to resolve.
        if (parts.length >= 3) {
          const dropMiddle = `${parts[0]}-${parts[parts.length - 1]}`;
          if (!(dropMiddle in out)) {
            const dropMiddleValue = style.getPropertyValue(dropMiddle);
            if (dropMiddleValue) {
              out[dropMiddle] = dropMiddleValue.trim();
              continue;
            }
          }
        }
        for (let cut = parts.length - 1; cut >= 1; cut--) {
          const candidate = parts.slice(0, cut).join('-');
          if (candidate in out) break;
          const candidateValue = style.getPropertyValue(candidate);
          if (candidateValue) {
            out[candidate] = candidateValue.trim();
            break;
          }
        }
      }
      return out;
    }

    // Regex alternation matches left-to-right; longer alternatives MUST come
    // first so ":focus-visible" matches "focus-visible" before ":focus".
    // Mirrors STATE_RE in src/sensors/interaction-states.ts — kept as a
    // separate copy because this closure ships across CDP via
    // `page.evaluate()` and cannot import a runtime module.
    const STATE_RE = /:(focus-visible|focus-within|hover|focus|active|disabled)\b/g;
    // Matches ":focus" or ":focus-visible" but NOT ":focus-within" — a bare
    // `\b` after "focus" also sits on the boundary inside "focus-within"
    // (word char 's' -> non-word char '-'), so a naive `/:focus\b/` would
    // false-positive on `:focus-within`.
    const FOCUS_PSEUDO_RE = /:focus-visible\b|:focus(?!-within)\b/;

    // Matches an empty functional pseudo left behind by STATE_RE stripping
    // its only argument, e.g. `.btn:not(:disabled)` -> `.btn:not(:disabled)`
    // minus the state token -> `.btn:not()`, which `querySelectorAll` throws
    // on. `:not()`/`:is()`/`:where()`/`:has()` are all valid with zero
    // meaningful arguments removed this way; stripping the whole empty shell
    // is safe because an empty `:not()` matches nothing useful anyway once
    // its only argument was a state pseudo.
    const EMPTY_FUNCTIONAL_PSEUDO_RE = /:(not|is|where|has)\(\s*\)/g;

    // Selector text can carry a comma INSIDE a functional pseudo's argument
    // list (`:where(a, button)`, `:is(.a, .b)`) that is not a top-level
    // selector-list separator. A naive `selectorText.split(',')` (both here
    // and in the parseStateSelectors sibling in interaction-states.ts, which
    // has this same class of gap for its own base-selector parsing) would
    // shred `:where(a, button):focus-visible` into `:where(a` and
    // ` button):focus-visible` — neither a selector `querySelectorAll` can
    // parse. Track paren depth and only split where depth is 0.
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

    // `buildStructuralSelector` (declared below) walks the element's full
    // ancestor chain on every call. `computeFocusMatches` can call it for
    // the SAME element many times over — once per declared focus rule that
    // matches it — so memoize per element for the lifetime of this one
    // extraction call rather than re-walking the DOM each time.
    const structuralSelectorCache = new Map<Element, string>();
    function cachedStructuralSelector(el: Element): string {
      const cached = structuralSelectorCache.get(el);
      if (cached !== undefined) return cached;
      const built = buildStructuralSelector(el);
      structuralSelectorCache.set(el, built);
      return built;
    }

    /**
     * For a style rule whose `selectorText` declares a focus pseudo, resolve
     * which LIVE elements it actually matches right now, so
     * interaction-states.ts can ask "did a declared focus rule really cover
     * this element" instead of comparing selector text (which breaks on
     * compound selectors, combinators, and attribute selectors).
     *
     * For each comma-separated part that contains a focus pseudo, strip EVERY
     * state pseudo token from the part (not just the base left of the first
     * one) and query with what's left. Taking only the base left of the first
     * state pseudo is wrong for descendant/combinator selectors: for
     * `.card:hover .btn:focus-visible`, the base is `.card`, which matches
     * the card element itself, not `.btn` — the button that actually carries
     * the focus rule stays unmatched. Stripping every state pseudo instead
     * yields `.card .btn`, which correctly resolves to the button.
     *
     * Stripping can leave behind a dangling combinator (`.a > :focus` strips
     * to `.a >`, fixed up below by appending `*`) or an empty functional
     * pseudo when the pseudo's only argument WAS a state pseudo
     * (`.btn:not(:disabled)` strips to `.btn:not()`, cleaned up by
     * `EMPTY_FUNCTIONAL_PSEUDO_RE` below to `.btn`). If the stripped
     * selector still throws for some other reason, fall back to the old
     * base-only resolution (everything left of the FIRST state pseudo),
     * which is a strict subset of "elements the rule affects" for those
     * cases.
     */
    function stripStatePseudos(part: string): string {
      let stripped = part.replace(STATE_RE, '');
      // Stripping a state pseudo can leave a functional pseudo with nothing
      // inside it (`.btn:not(:disabled)` -> `.btn:not()`), which
      // `querySelectorAll` rejects as invalid. Run AFTER the state-pseudo
      // strip since that's what creates the empty shell.
      stripped = stripped.replace(EMPTY_FUNCTIONAL_PSEUDO_RE, '');
      stripped = stripped.trim();
      // Pseudos attach to compounds, so a stripped selector can only dangle
      // on a combinator when the compound following it was ENTIRELY a state
      // pseudo (`.a > :focus` -> `.a >`), never on a bare trailing combinator
      // from a non-pseudo compound.
      if (/[>+~]\s*$/.test(stripped)) stripped += ' *';
      return stripped || '*';
    }

    function computeFocusMatches(selectorText: string): string[] {
      const matched = new Set<string>();
      const parts = splitTopLevelCommas(selectorText);
      for (const part of parts) {
        if (!FOCUS_PSEUDO_RE.test(part)) continue;
        const stripped = stripStatePseudos(part);
        let found: NodeListOf<Element> | undefined;
        try {
          found = document.querySelectorAll(stripped);
        } catch {
          STATE_RE.lastIndex = 0;
          const m = STATE_RE.exec(part);
          if (!m) continue;
          const base = part.slice(0, m.index).trim() || '*';
          try {
            found = document.querySelectorAll(base);
          } catch {
            continue;
          }
        }
        for (let i = 0; i < found.length; i++) {
          if (matched.size >= 1000) break;
          matched.add(cachedStructuralSelector(found[i]!));
        }
        if (matched.size >= 1000) break;
      }
      return Array.from(matched);
    }

    function convertRule(rule: CSSRule, sourceUrl?: string): InlineExtractedRule | null {
      // CSSStyleRule
      if (rule instanceof CSSStyleRule) {
        const selector = rule.selectorText;
        const focusMatches = FOCUS_PSEUDO_RE.test(selector)
          ? computeFocusMatches(selector)
          : undefined;
        return {
          kind: 'style',
          selector,
          declarations: declarationsFromStyle(rule.style),
          ...(sourceUrl ? { sourceUrl } : {}),
          ...(focusMatches ? { focusMatches } : {}),
        };
      }
      // CSSMediaRule
      if (rule instanceof CSSMediaRule) {
        const nested: InlineExtractedRule[] = [];
        for (let i = 0; i < rule.cssRules.length; i++) {
          const child = convertRule(rule.cssRules[i]!, sourceUrl);
          if (child) nested.push(child);
        }
        return {
          kind: 'media',
          conditionText: rule.media.mediaText,
          rules: nested,
          ...(sourceUrl ? { sourceUrl } : {}),
        };
      }
      // CSSKeyframesRule
      if (rule instanceof CSSKeyframesRule) {
        const steps: Array<{ keyText: string; declarations: Record<string, string> }> = [];
        for (let i = 0; i < rule.cssRules.length; i++) {
          const kf = rule.cssRules[i] as CSSKeyframeRule;
          steps.push({ keyText: kf.keyText, declarations: declarationsFromStyle(kf.style) });
        }
        return {
          kind: 'keyframes',
          name: rule.name,
          steps,
          ...(sourceUrl ? { sourceUrl } : {}),
        };
      }
      // CSSContainerRule (relatively new — check via constructor name for cross-browser safety)

      const ContainerCtor = (window as any).CSSContainerRule;
      if (ContainerCtor && rule instanceof ContainerCtor) {

        const cr = rule as any;
        const nested: InlineExtractedRule[] = [];
        for (let i = 0; i < cr.cssRules.length; i++) {
          nested.push(...expandRule(cr.cssRules[i], sourceUrl));
        }
        return {
          kind: 'container',
          conditionText: cr.containerQuery ?? cr.conditionText ?? '',
          ...(cr.containerName ? { containerName: cr.containerName } : {}),
          rules: nested,
          ...(sourceUrl ? { sourceUrl } : {}),
        };
      }
      // CSSSupportsRule

      const SupportsCtor = (window as any).CSSSupportsRule;
      if (SupportsCtor && rule instanceof SupportsCtor) {

        const sr = rule as any;
        const nested: InlineExtractedRule[] = [];
        for (let i = 0; i < sr.cssRules.length; i++) {
          nested.push(...expandRule(sr.cssRules[i], sourceUrl));
        }
        return {
          kind: 'supports',
          conditionText: sr.conditionText ?? '',
          rules: nested,
          ...(sourceUrl ? { sourceUrl } : {}),
        };
      }
      return null;
    }

    /**
     * Convert one rule into ZERO OR MORE extracted rules.
     *
     * `convertRule` returns null for anything it does not recognise, and a
     * grouping at-rule it does not recognise takes its whole subtree with it.
     * `@layer` is the one that bit: Tailwind v4 wraps essentially everything in
     * `@layer`, so a stylesheet's media queries, transitions and :hover rules
     * were invisible to the breakpoints, motion and interaction-state sensors —
     * which then reported empty, indistinguishable from a page that declares
     * none.
     *
     * Proven by planted defect: `@layer utilities { @media (min-width: 1024px)
     * { ... } }` produced NO breakpoint at all, while an identical unwrapped
     * media query produced one.
     *
     * Handled by SHAPE rather than by name — anything that groups child rules
     * and carries no condition of its own gets flattened into its parent — so
     * `@scope` and `@starting-style` do not each need their own future fix.
     * Cascade layers affect precedence, not whether a declaration exists, and
     * these sensors ask the second question.
     */
    function expandRule(rule: CSSRule, sourceUrl?: string): InlineExtractedRule[] {
      const converted = convertRule(rule, sourceUrl);
      if (converted) return [converted];

      const group = rule as unknown as { cssRules?: CSSRuleList };
      if (!group.cssRules || group.cssRules.length === 0) return [];

      const out: InlineExtractedRule[] = [];
      for (let i = 0; i < group.cssRules.length; i++) {
        out.push(...expandRule(group.cssRules[i]!, sourceUrl));
      }
      return out;
    }

    // ---- walk all stylesheets ----
    const sheets = Array.from(document.styleSheets);
    const allRules: InlineExtractedRule[] = [];
    // COUNT the sheets we cannot read. A cross-origin stylesheet is the normal
    // case for a CDN-hosted or Tailwind-CDN site, and dropping it silently is
    // how `breakpoints: []` came to mean both "declares none" and "we could not
    // look". The counts ride back on the result so the sensors can say which.
    let sheetsSkipped = 0;
    for (const sheet of sheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        sheetsSkipped++;
        continue;
      }
      const sourceUrl = sheet.href ?? undefined;
      for (let i = 0; i < rules.length; i++) {
        allRules.push(...expandRule(rules[i]!, sourceUrl));
      }
    }

    // ---- document meta ----
    const rootFontSize = parseFloat(
      window.getComputedStyle(document.documentElement).fontSize || '16',
    );

    const fontsApi = (document as any).fonts;
    let fontsStatus: 'loading' | 'loaded' | 'unsupported' = 'unsupported';
    if (fontsApi && typeof fontsApi.status === 'string') {
      fontsStatus = fontsApi.status === 'loading' ? 'loading' : 'loaded';
    }

    // ---- structural elements for typography + hierarchy sensors ----
    // The main extractInteractiveElements() path is INTERACTIVE-focused and
    // returns only buttons/links/inputs with cursor/color/backgroundColor.
    // For sensors that need text-bearing typography and heading/landmark
    // structure, we do a SEPARATE lightweight extraction here. Non-breaking:
    // these elements are added to ctx.elements ONLY for sensor consumption,
    // not bubbled up to scan.elements.all.
    const STRUCTURAL_SELECTORS = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'header', 'nav', 'main', 'aside', 'footer', 'section', 'form',
      '[role="heading"]',
      '[role="navigation"]',
      '[role="main"]',
      '[role="complementary"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '[role="region"]',
      '[role="form"]',
      'p', 'span', 'li',  // typography: text-bearing content
    ];


    /**
     * MUST stay byte-compatible with `generateSelector` in src/extract.ts.
     *
     * It was not, and the difference was one clause: extract.ts appends
     * `:nth-of-type(n)` when a node has same-tag siblings, and this did not.
     * The navigation sensor decides which links belong to which <nav> by
     * testing whether the link's selector STARTS WITH the nav's selector — so
     * on any page with two <nav> elements (a header nav and a footer nav, i.e.
     * most sites) the link came back as
     * `nav:nth-of-type(1) > ul > li > a` while the nav came back as plain
     * `nav`, the prefix test failed, and every nav region reported
     * `roots: [], depth: 0` while `totalLinks` reported the real count.
     *
     * Proven by planted defect: two sibling <nav> elements with two links each
     * produced `roots: []` on all of them and `totalLinks: 5`.
     */
    function buildStructuralSelector(el: Element): string {
      const path: string[] = [];

      let cur: any = el;
      while (cur && cur !== document.body) {
        let s = cur.tagName.toLowerCase();
        if (cur.id) {
          path.unshift(`#${cur.id}`);
          break;
        }
        if (typeof cur.className === 'string' && cur.className.trim()) {
          const c = cur.className.split(' ').filter((x: string) => x.trim() && !x.includes(':'))[0];
          if (c) s += `.${c}`;
        }

        const parent: Element | null = cur.parentElement;
        if (parent) {
          const siblings: Element[] = Array.from(parent.children).filter(
            (c) => (c as Element).tagName === cur.tagName,
          ) as Element[];
          if (siblings.length > 1) {
            s += `:nth-of-type(${siblings.indexOf(cur as Element) + 1})`;
          }
        }

        path.unshift(s);
        cur = cur.parentElement;
      }
      return path.join(' > ').slice(0, 200);
    }

    const seenStructural = new Set<Element>();
    // Same walk as src/extract.ts's collectBackgroundChain — each
    // page.evaluate() ships its own closure across CDP, so there is no runtime
    // module to share it from. Keep the two in step; the compositing itself
    // lives in src/rules/color-parse.ts and is genuinely shared.
    const collectStructuralBackgroundChain = (
      start: HTMLElement,
    ): { chain: string[]; image: boolean } => {
      const chain: string[] = [];
      let image = false;
      let node: HTMLElement | null = start;
      let depth = 0;
      while (node && depth < 64) {
        const cs = window.getComputedStyle(node);
        chain.push(cs.backgroundColor || '');
        const bgImage = cs.backgroundImage;
        if (bgImage && bgImage !== 'none') image = true;
        node = node.parentElement;
        depth++;
      }
      return { chain, image };
    };

    const structuralElements: EnhancedElement[] = [];
    for (const sel of STRUCTURAL_SELECTORS) {
      let found: NodeListOf<Element>;
      try {
        found = document.querySelectorAll(sel);
      } catch {
        continue;
      }
      found.forEach((el) => {
        if (seenStructural.has(el)) return;
        seenStructural.add(el);
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        const computed = window.getComputedStyle(htmlEl);
        const text = (htmlEl.textContent || '').trim().slice(0, 100) || '';

        // For text-bearing tags (h1-6, p, span, li), capture typography fields.
        // For landmark tags, only capture identity (no typography needed).
        const tagLower = htmlEl.tagName.toLowerCase();
        const isTextBearing =
          /^h[1-6]$/.test(tagLower) || tagLower === 'p' || tagLower === 'span' || tagLower === 'li';

        // ONE capture contract with src/extract.ts, driven by
        // CAPTURED_STYLE_KEYS. This used to be a two-property object widened to
        // six for text-bearing tags, which starved the sensor lane of the exact
        // fields the shared contrast measurement needs. The visible symptom was
        // two lanes of ONE scan reporting opposite verdicts on the same <p>:
        // `issues` said 1.49:1 FAIL (the rule engine has backgroundChain) while
        // `sensors.contrast` said PASS (assumed white). `isTextBearing` is gone
        // — capturing a uniform property set costs a few bytes and removes a
        // whole class of "this lane cannot see what that lane sees".
        const styles: Record<string, string> = {};
        for (const key of styleKeys) {
          const value = (computed as unknown as Record<string, string>)[key];
          if (typeof value === 'string' && value !== '') styles[key] = value;
        }
        void isTextBearing;

        const ariaLevel = htmlEl.getAttribute('aria-level');

        structuralElements.push({
          selector: buildStructuralSelector(htmlEl),
          tagName: tagLower,
          id: htmlEl.id || undefined,
          className: typeof htmlEl.className === 'string' ? htmlEl.className : undefined,
          text,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          computedStyles: styles,
          // The shared measurement (src/rules/contrast-measure.ts) resolves the
          // effective background by compositing THROUGH ancestors. Without this
          // chain every structural element fell back to its own
          // `rgba(0, 0, 0, 0)` and was graded against an assumed white page —
          // light text on a dark card read as a comfortable pass.
          ...(() => {
            const bgChain = collectStructuralBackgroundChain(htmlEl);
            return {
              backgroundChain: bgChain.chain,
              ...(bgChain.image ? { backgroundImageBehind: true } : {}),
            };
          })(),
          interactive: {
            hasOnClick: false,
            hasHref: false,
            hasReactHandler: false,
            hasVueHandler: false,
            hasAngularHandler: false,
            isDisabled: false,
            tabIndex: -1,
            cursor: computed.cursor,
          },
          a11y: {
            role: htmlEl.getAttribute('role'),
            ariaLabel: htmlEl.getAttribute('aria-label'),
            ariaDescribedBy: htmlEl.getAttribute('aria-describedby'),
            ...(ariaLevel !== null ? { ariaLevel: parseInt(ariaLevel, 10) } : {}),

          } as any,
        } as EnhancedElement);
      });
    }

    return {
      cssRules: allRules as unknown as ExtractedCSSRule[],
      documentMeta: {
        rootFontSizePx: Number.isFinite(rootFontSize) ? rootFontSize : 16,
        fontsStatus,
      } as DocumentMeta,
      structuralElements,
      sheetsSeen: sheets.length,
      sheetsSkipped,
    };
  }, [...CAPTURED_STYLE_KEYS]);
}
