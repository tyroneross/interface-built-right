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
        if (value) out[prop] = value.trim();
      }
      return out;
    }

    function convertRule(rule: CSSRule, sourceUrl?: string): InlineExtractedRule | null {
      // CSSStyleRule
      if (rule instanceof CSSStyleRule) {
        return {
          kind: 'style',
          selector: rule.selectorText,
          declarations: declarationsFromStyle(rule.style),
          ...(sourceUrl ? { sourceUrl } : {}),
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
          const child = convertRule(cr.cssRules[i], sourceUrl);
          if (child) nested.push(child);
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
          const child = convertRule(sr.cssRules[i], sourceUrl);
          if (child) nested.push(child);
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
        const converted = convertRule(rules[i]!, sourceUrl);
        if (converted) allRules.push(converted);
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
