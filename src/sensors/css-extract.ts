import type { PageLike } from '../engine/page-like.js';
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
): Promise<{ cssRules: ExtractedCSSRule[]; documentMeta: DocumentMeta }> {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ContainerCtor = (window as any).CSSContainerRule;
      if (ContainerCtor && rule instanceof ContainerCtor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SupportsCtor = (window as any).CSSSupportsRule;
      if (SupportsCtor && rule instanceof SupportsCtor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      let rules: CSSRuleList | null = null;
      try {
        rules = sheet.cssRules;
      } catch {
        // cross-origin — skip
        continue;
      }
      if (!rules) continue;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fontsApi = (document as any).fonts;
    let fontsStatus: 'loading' | 'loaded' | 'unsupported' = 'unsupported';
    if (fontsApi && typeof fontsApi.status === 'string') {
      fontsStatus = fontsApi.status === 'loading' ? 'loading' : 'loaded';
    }

    return {
      cssRules: allRules as unknown as ExtractedCSSRule[],
      documentMeta: {
        rootFontSizePx: Number.isFinite(rootFontSize) ? rootFontSize : 16,
        fontsStatus,
      } as DocumentMeta,
    };
  });
}
