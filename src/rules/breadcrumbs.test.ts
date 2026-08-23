import { describe, expect, it } from 'vitest';
import type { BreadcrumbContext, EnhancedElement } from '../schemas.js';
import { breadcrumbRules } from './breadcrumbs.js';

function makeBreadcrumb(overrides: Partial<BreadcrumbContext> = {}): BreadcrumbContext {
  return {
    rootSelector: 'nav.breadcrumb',
    rootTag: 'nav',
    rootRole: null,
    accessibleName: 'Breadcrumb',
    listTag: 'ol',
    itemCount: 3,
    linkCount: 3,
    currentValues: ['page'],
    currentPageCount: 1,
    currentPageIsLast: true,
    lastItemIsLink: true,
    representative: true,
    ...overrides,
  };
}

function makeElement(breadcrumb?: BreadcrumbContext): EnhancedElement {
  return {
    selector: 'nav.breadcrumb > ol > li > a',
    tagName: 'a',
    text: 'Home',
    bounds: { x: 0, y: 0, width: 80, height: 44 },
    computedStyles: {},
    interactive: {
      hasOnClick: false,
      hasHref: true,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    a11y: {
      role: 'link',
      ariaLabel: null,
      ariaDescribedBy: null,
      ariaCurrent: null,
    },
    ...(breadcrumb ? { breadcrumb } : {}),
  };
}

function findings(element: EnhancedElement) {
  return breadcrumbRules
    .map(rule => rule.check(element, {
      isMobile: true,
      viewportWidth: 390,
      viewportHeight: 844,
      url: 'https://example.com/toolkit/research',
      allElements: [element],
    }))
    .filter(Boolean);
}

describe('breadcrumb rules', () => {
  it('does not grade unrelated navigation', () => {
    expect(findings(makeElement())).toEqual([]);
  });

  it('passes a labelled list landmark with the final link marked current', () => {
    expect(findings(makeElement(makeBreadcrumb()))).toEqual([]);
  });

  it('allows a plain-text current item without aria-current', () => {
    const breadcrumb = makeBreadcrumb({
      linkCount: 2,
      currentValues: [],
      currentPageCount: 0,
      currentPageIsLast: false,
      lastItemIsLink: false,
    });
    expect(findings(makeElement(breadcrumb))).toEqual([]);
  });

  it('reports a trail outside a navigation landmark', () => {
    const result = findings(makeElement(makeBreadcrumb({ rootTag: 'div' })));
    expect(result.map(finding => finding?.ruleId)).toContain('breadcrumbs/navigation-landmark');
    expect(result[0]?.message).toContain('not contained in a navigation landmark');
  });

  it('reports an unnamed navigation landmark', () => {
    const result = findings(makeElement(makeBreadcrumb({ accessibleName: null })));
    expect(result[0]?.message).toContain('no accessible name');
  });

  it('reports breadcrumb items without list semantics', () => {
    const result = findings(makeElement(makeBreadcrumb({ listTag: null })));
    expect(result.map(finding => finding?.ruleId)).toContain('breadcrumbs/list-structure');
  });

  it('reports a linked current item without aria-current page', () => {
    const result = findings(makeElement(makeBreadcrumb({
      currentValues: [],
      currentPageCount: 0,
      currentPageIsLast: false,
    })));
    expect(result.map(finding => finding?.ruleId)).toContain('breadcrumbs/current-page');
    expect(result.at(-1)?.message).toContain('missing aria-current="page"');
  });

  it('reports unsupported aria-current values', () => {
    const result = findings(makeElement(makeBreadcrumb({
      currentValues: ['step'],
      currentPageCount: 0,
      currentPageIsLast: false,
    })));
    expect(result.at(-1)?.message).toContain('instead of "page"');
  });

  it('reports multiple current pages', () => {
    const result = findings(makeElement(makeBreadcrumb({
      currentValues: ['page', 'page'],
      currentPageCount: 2,
    })));
    expect(result.at(-1)?.message).toContain('marks 2 items');
  });

  it('reports aria-current page before the final item', () => {
    const result = findings(makeElement(makeBreadcrumb({ currentPageIsLast: false })));
    expect(result.at(-1)?.message).toContain('not on the final breadcrumb item');
  });

  it('grades only the representative element for each trail', () => {
    const result = findings(makeElement(makeBreadcrumb({
      representative: false,
      accessibleName: null,
      listTag: null,
      currentValues: [],
      currentPageCount: 0,
      currentPageIsLast: false,
    })));
    expect(result).toEqual([]);
  });
});
