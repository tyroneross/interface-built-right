import type { EnhancedElement } from '../schemas.js';
import type { SensorContext, VisualPatternReport, VisualPatternGroup } from './types.js';

/**
 * Build a style fingerprint from an element's key visual properties.
 * Elements with matching fingerprints = same visual pattern.
 *
 * FOUR OF THESE EIGHT DIMENSIONS WERE PERMANENTLY THE EMPTY STRING. The
 * extractors captured eight computed properties and none of them was
 * borderRadius, padding, borderWidth, or borderColor — so a sensor whose whole
 * job is spotting inconsistent component styling was blind to the three
 * properties that most often distinguish one button variant from another.
 *
 * Proven by planted defect: two buttons identical except for `border-radius`
 * (2px vs 999px) and `padding` (4px 8px vs 20px 40px) were reported as ONE
 * consistent pattern with `count: 2`.
 *
 * `CAPTURED_STYLE_KEYS` now covers them, with two shape corrections:
 *   - `padding` and `borderWidth` are read as LONGHANDS. getComputedStyle
 *     resolves the longhands reliably; the shorthands are the thing that was
 *     never there. Reading `s.padding` after widening the capture list would
 *     have left this dimension blank while looking fixed.
 *   - a missing value is recorded as `(unread)` rather than `''`, so two
 *     elements neither of which could be measured do not fingerprint as
 *     identical and get counted as a deliberate shared pattern.
 */
const UNREAD = '(unread)';

function joinLonghands(s: Record<string, string>, keys: readonly string[]): string {
  const parts = keys.map((k) => s[k]);
  if (parts.every((p) => p === undefined)) return UNREAD;
  return parts.map((p) => p ?? UNREAD).join(' ');
}

function styleFingerprint(el: EnhancedElement): Record<string, string> {
  const s = el.computedStyles ?? {};
  return {
    backgroundColor: s.backgroundColor ?? UNREAD,
    color: s.color ?? UNREAD,
    borderRadius: s.borderRadius ?? UNREAD,
    padding: joinLonghands(s, ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']),
    fontSize: s.fontSize ?? UNREAD,
    fontWeight: s.fontWeight ?? UNREAD,
    borderWidth: joinLonghands(s, [
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    ]),
    borderColor: s.borderColor ?? UNREAD,
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
