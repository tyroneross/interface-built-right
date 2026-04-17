import type { Rule, RuleContext } from './engine.js';
import type { EnhancedElement, Violation } from '../schemas.js';

/**
 * Hierarchy levels derived from tag/role semantics.
 */
type HierarchyLevel = 'title' | 'description' | 'metadata' | 'unknown';

const TITLE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const DESCRIPTION_TAGS = new Set(['p', 'blockquote', 'figcaption', 'li']);

function inferLevel(element: EnhancedElement): HierarchyLevel {
  const tag = element.tagName.toLowerCase();
  const role = element.a11y?.role ?? '';

  if (TITLE_TAGS.has(tag) || role === 'heading') return 'title';
  if (DESCRIPTION_TAGS.has(tag) || role === 'paragraph') return 'description';

  // Span or small with very small font = metadata
  if (tag === 'span' || tag === 'small' || tag === 'label') {
    const size = parseFloat(element.computedStyles?.fontSize ?? '0');
    if (size > 0 && size <= 12) return 'metadata';
  }

  return 'unknown';
}

function parseFontSize(element: EnhancedElement): number | null {
  const raw = element.computedStyles?.fontSize;
  if (!raw) return null;
  const val = parseFloat(raw);
  return isNaN(val) ? null : val;
}

/**
 * Text hierarchy rule — checks that title-level elements have larger font than
 * description-level elements co-located on the same page.
 *
 * Strategy: collect all title and description elements, find the minimum title
 * font size and maximum description font size, flag if description >= title.
 *
 * Because Rule.check is called per element, we attach page-level analysis on
 * the first title element encountered after scanning all elements. This
 * avoids duplicate violations by only firing once.
 */
export const textHierarchyRules: Rule[] = [
  {
    id: 'text-hierarchy/title-vs-description',
    name: 'Text Hierarchy: Title vs Description Size',
    description: 'Title-level elements must be visually larger than description-level elements',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, context: RuleContext): Violation | null => {
      // Only fire on title elements (one violation at most per title, not per description)
      if (inferLevel(element) !== 'title') return null;

      const titleSize = parseFontSize(element);
      if (titleSize === null) return null;

      // Find description-level elements with larger font than this title
      for (const other of context.allElements) {
        if (inferLevel(other) !== 'description') continue;
        const descSize = parseFontSize(other);
        if (descSize === null) continue;

        if (descSize >= titleSize) {
          const titleLabel = element.text?.slice(0, 30) || element.selector;
          const descLabel = other.text?.slice(0, 30) || other.selector;
          return {
            ruleId: 'text-hierarchy/title-vs-description',
            ruleName: 'Text Hierarchy: Title vs Description Size',
            severity: 'warn',
            message: `Title "${titleLabel}" (${titleSize}px) is not larger than description "${descLabel}" (${descSize}px)`,
            element: element.selector,
            bounds: element.bounds,
            fix: 'Ensure heading/title font sizes are larger than body/description text',
          };
        }
      }

      return null;
    },
  },
];
