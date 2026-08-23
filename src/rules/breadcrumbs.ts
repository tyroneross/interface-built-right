import type { EnhancedElement, Violation } from '../schemas.js';
import type { Rule } from './types.js';

function breadcrumbRepresentative(element: EnhancedElement) {
  const breadcrumb = element.breadcrumb;
  return breadcrumb?.representative ? breadcrumb : undefined;
}

export const breadcrumbRules: Rule[] = [
  {
    id: 'breadcrumbs/navigation-landmark',
    name: 'Breadcrumb: Navigation Landmark',
    description: 'Breadcrumb trails must use a labelled navigation landmark',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement): Violation | null => {
      const breadcrumb = breadcrumbRepresentative(element);
      if (!breadcrumb) return null;

      const isNavigation = breadcrumb.rootTag === 'nav' || breadcrumb.rootRole === 'navigation';
      if (!isNavigation) {
        return {
          ruleId: 'breadcrumbs/navigation-landmark',
          ruleName: 'Breadcrumb: Navigation Landmark',
          severity: 'warn',
          message: 'Breadcrumb trail is not contained in a navigation landmark',
          element: breadcrumb.rootSelector,
          fix: 'Wrap the breadcrumb trail in <nav aria-label="Breadcrumb"> or use role="navigation" with an accessible label',
        };
      }

      if (!breadcrumb.accessibleName) {
        return {
          ruleId: 'breadcrumbs/navigation-landmark',
          ruleName: 'Breadcrumb: Navigation Landmark',
          severity: 'warn',
          message: 'Breadcrumb navigation landmark has no accessible name',
          element: breadcrumb.rootSelector,
          fix: 'Add aria-label="Breadcrumb" or aria-labelledby to the breadcrumb navigation landmark',
        };
      }

      return null;
    },
  },
  {
    id: 'breadcrumbs/list-structure',
    name: 'Breadcrumb: List Structure',
    description: 'Breadcrumb items should be represented as a semantic list',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement): Violation | null => {
      const breadcrumb = breadcrumbRepresentative(element);
      if (!breadcrumb || breadcrumb.listTag === 'ol' || breadcrumb.listTag === 'ul') return null;

      return {
        ruleId: 'breadcrumbs/list-structure',
        ruleName: 'Breadcrumb: List Structure',
        severity: 'warn',
        message: 'Breadcrumb trail is not structured as a list',
        element: breadcrumb.rootSelector,
        fix: 'Place breadcrumb items in an <ol> or <ul> inside the navigation landmark',
      };
    },
  },
  {
    id: 'breadcrumbs/current-page',
    name: 'Breadcrumb: Current Page',
    description: 'A linked current page must use aria-current="page" on the final breadcrumb item',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement): Violation | null => {
      const breadcrumb = breadcrumbRepresentative(element);
      if (!breadcrumb) return null;

      const unsupportedValues = breadcrumb.currentValues.filter(value => value !== 'page');
      if (unsupportedValues.length > 0) {
        return {
          ruleId: 'breadcrumbs/current-page',
          ruleName: 'Breadcrumb: Current Page',
          severity: 'warn',
          message: `Breadcrumb uses aria-current="${unsupportedValues[0]}" instead of "page"`,
          element: breadcrumb.rootSelector,
          fix: 'Use aria-current="page" for the current page in a breadcrumb trail',
        };
      }

      if (breadcrumb.currentPageCount > 1) {
        return {
          ruleId: 'breadcrumbs/current-page',
          ruleName: 'Breadcrumb: Current Page',
          severity: 'warn',
          message: `Breadcrumb marks ${breadcrumb.currentPageCount} items as the current page`,
          element: breadcrumb.rootSelector,
          fix: 'Apply aria-current="page" to exactly one final breadcrumb item',
        };
      }

      // APG makes aria-current optional when the current-page item is plain
      // text. It is required here only when that final item remains a link.
      if (breadcrumb.lastItemIsLink && breadcrumb.currentPageCount === 0) {
        return {
          ruleId: 'breadcrumbs/current-page',
          ruleName: 'Breadcrumb: Current Page',
          severity: 'warn',
          message: 'Linked current breadcrumb item is missing aria-current="page"',
          element: breadcrumb.rootSelector,
          fix: 'Add aria-current="page" to the final breadcrumb link, or render the current page as plain text',
        };
      }

      if (breadcrumb.currentPageCount === 1 && !breadcrumb.currentPageIsLast) {
        return {
          ruleId: 'breadcrumbs/current-page',
          ruleName: 'Breadcrumb: Current Page',
          severity: 'warn',
          message: 'aria-current="page" is not on the final breadcrumb item',
          element: breadcrumb.rootSelector,
          fix: 'Move aria-current="page" to the final breadcrumb item',
        };
      }

      return null;
    },
  },
];
