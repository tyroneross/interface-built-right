import type { PageLike } from '../engine/page-like.js';
import type { EnhancedElement } from '../schemas.js';
import type { ExtractedCSSRule, DocumentMeta } from './types.js';

/**
 * Live-page extractor for CSS rules + document-level metadata used by the
 * typography, breakpoints, motion, hierarchy, and interaction-states sensors.
 *
 * Runs inside the browser via `page.evaluate(...)` so it can access
 * `document.styleSheets` and `document.fonts`. Same-origin sheets are
 * walked; cross-origin sheets throw on `.cssRules` access and are silently
 * skipped (the sensor layer treats missing rules as `data_unavailable`).
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
}> {
  return page.evaluate(() => {
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
    for (const sheet of sheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        // cross-origin — skip
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

        const styles: Record<string, string> = {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
        };
        if (isTextBearing) {
          // Bypass extract.ts line-198-style filtering — sensors need 'normal' too.
          styles.fontFamily = computed.fontFamily;
          styles.fontSize = computed.fontSize.replace(/px$/, ''); // strip px to match existing convention
          styles.fontWeight = computed.fontWeight;
          styles.lineHeight = computed.lineHeight;
        }

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
    };
  });
}
