import type { EnhancedElement } from '../schemas.js';
import type { SensorContext, VisualPatternReport, VisualPatternGroup } from './types.js';

/**
 * Build a style fingerprint from an element's key visual properties.
 * Elements with matching fingerprints = same visual pattern.
 */
function styleFingerprint(el: EnhancedElement): Record<string, string> {
  const s = el.computedStyles ?? {};
  return {
    backgroundColor: s.backgroundColor ?? '',
    color: s.color ?? '',
    borderRadius: s.borderRadius ?? '',
    padding: s.padding ?? '',
    fontSize: s.fontSize ?? '',
    fontWeight: s.fontWeight ?? '',
    borderWidth: s.borderWidth ?? '',
    borderColor: s.borderColor ?? '',
  };
}

function fingerprintKey(fp: Record<string, string>): string {
  return Object.entries(fp).map(([k, v]) => `${k}=${v}`).join('|');
}

function categorize(el: EnhancedElement): VisualPatternReport['category'] | null {
  const tag = el.tagName.toLowerCase();
  const role = el.a11y.role ?? '';
  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'a' || role === 'link') return 'link';
  if (
    tag === 'input' || tag === 'textarea' || tag === 'select' ||
    role === 'textbox' || role === 'combobox'
  ) return 'input';
  if (/^h[1-6]$/.test(tag) || role === 'heading') return 'heading';
  return null;
}

export function collectVisualPatterns(ctx: SensorContext): VisualPatternReport[] {
  const byCategory = new Map<VisualPatternReport['category'], EnhancedElement[]>();

  for (const el of ctx.elements) {
    const cat = categorize(el);
    if (!cat) continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(el);
  }

  const reports: VisualPatternReport[] = [];

  for (const [category, els] of byCategory.entries()) {
    const groupMap = new Map<string, VisualPatternGroup>();

    for (const el of els) {
      const fp = styleFingerprint(el);
      const key = fingerprintKey(fp);
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          patternKey: key.slice(0, 80),
          count: 0,
          elements: [],
          styleFingerprint: fp,
        });
      }
      const g = groupMap.get(key)!;
      g.count++;
      if (g.elements.length < 5) {
        g.elements.push({
          selector: el.selector,
          text: (el.text ?? '').slice(0, 40),
        });
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.count - a.count);
    const total = els.length;
    const dominant = groups[0] && groups[0].count / total > 0.8 ? groups[0] : undefined;

    reports.push({
      category,
      totalElements: total,
      distinctPatterns: groups.length,
      groups,
      dominant,
    });
  }

  return reports;
}
