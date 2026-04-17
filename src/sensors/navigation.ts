import type { SensorContext, NavigationMap, NavigationNode, NavigationRegion } from './types.js';
import type { EnhancedElement } from '../schemas.js';

/**
 * Count the number of segments in a CSS selector path.
 * "body > header > nav > ul > li > a" → 6
 */
function selectorDepth(selector: string): number {
  return (selector || '').split(/\s*>\s*/).length;
}

/**
 * Returns true when childSelector is a descendant of ancestorSelector
 * based on CSS selector path prefix matching.
 */
function isDescendantOf(childSelector: string, ancestorSelector: string): boolean {
  if (!ancestorSelector || !childSelector) return false;
  return (
    childSelector.startsWith(ancestorSelector + ' ') ||
    childSelector.startsWith(ancestorSelector + '>') ||
    childSelector.startsWith(ancestorSelector + ' >') ||
    childSelector === ancestorSelector
  );
}

/**
 * Extract a display label from a link element.
 */
function linkLabel(el: EnhancedElement): string {
  return ((el.text ?? el.a11y.ariaLabel ?? '').trim()).slice(0, 60);
}

/**
 * Build a hierarchical tree of NavigationNodes from a flat list of link elements,
 * ordered by selector depth relative to a nav root.
 *
 * Algorithm: iterate links sorted by selector length (shallowest first).
 * For each link, find the most-recently-seen node with a shallower depth
 * that is also an ancestor (selector prefix). Attach as child of that node,
 * or as a root if none found.
 */
function buildTree(
  links: EnhancedElement[],
  navSelector: string,
): { roots: NavigationNode[]; maxDepth: number } {
  const navDepth = selectorDepth(navSelector);

  // Sort by selector length so parents are processed before children
  const sorted = [...links].sort((a, b) => a.selector.length - b.selector.length);

  const roots: NavigationNode[] = [];
  // Stack of (node, absoluteDepth) for ancestor lookup
  const stack: Array<{ node: NavigationNode; absDepth: number }> = [];

  for (const el of sorted) {
    const label = linkLabel(el);
    if (!label) continue;

    const absDepth = selectorDepth(el.selector);
    const relDepth = absDepth - navDepth; // depth relative to the nav container

    const node: NavigationNode = {
      label,
      selector: el.selector,
      depth: relDepth,
      children: [],
    };

    // Find nearest ancestor in the stack: same prefix and smaller depth
    let parentEntry: { node: NavigationNode; absDepth: number } | undefined;
    for (let i = stack.length - 1; i >= 0; i--) {
      const candidate = stack[i];
      if (
        candidate.absDepth < absDepth &&
        isDescendantOf(el.selector, candidate.node.selector)
      ) {
        parentEntry = candidate;
        break;
      }
    }

    if (parentEntry) {
      parentEntry.node.children.push(node);
    } else {
      roots.push(node);
    }

    stack.push({ node, absDepth });
  }

  // Compute max depth
  function maxD(nodes: NavigationNode[], current: number): number {
    let m = current;
    for (const n of nodes) m = Math.max(m, maxD(n.children, current + 1));
    return m;
  }
  const maxDepth = roots.length > 0 ? maxD(roots, 1) : 0;

  return { roots, maxDepth };
}

/**
 * Flatten a tree of NavigationNodes into a list (for byDepth counting).
 */
function flattenTree(nodes: NavigationNode[], depth: number, counts: number[]): void {
  for (const node of nodes) {
    counts[depth] = (counts[depth] ?? 0) + 1;
    flattenTree(node.children, depth + 1, counts);
  }
}

export function collectNavigationMap(ctx: SensorContext): NavigationMap | undefined {
  const navElements = ctx.elements.filter(el => {
    const role = el.a11y.role ?? '';
    const tag = el.tagName.toLowerCase();
    return role === 'navigation' || tag === 'nav';
  });

  const links = ctx.elements.filter(el => {
    const role = el.a11y.role ?? '';
    const tag = el.tagName.toLowerCase();
    return role === 'link' || tag === 'a';
  });

  if (links.length === 0 && navElements.length === 0) return undefined;

  // ── Hierarchical path (when nav containers are available) ──────────────────
  if (navElements.length > 0) {
    const navRegions: NavigationRegion[] = [];
    const byDepth: number[] = [];

    for (const nav of navElements) {
      // Find all links whose selector descends from this nav's selector
      const navLinks = links.filter(link =>
        isDescendantOf(link.selector, nav.selector)
      );

      const { roots, maxDepth } = buildTree(navLinks, nav.selector);
      flattenTree(roots, 0, byDepth);

      navRegions.push({
        rootSelector: nav.selector,
        roots,
        depth: maxDepth,
      });
    }

    // Build legacy flat roots (top-level across all navs) for backward compat
    const allRoots: NavigationNode[] = navRegions.flatMap(r => r.roots);
    const overallMaxDepth = navRegions.reduce((m, r) => Math.max(m, r.depth), 0);

    return {
      navs: navRegions,
      roots: allRoots.slice(0, 40),
      depth: overallMaxDepth,
      totalLinks: links.length,
      byDepth,
    };
  }

  // ── Fallback: no <nav> elements found — flat list (original behavior) ──────
  const flatRoots: NavigationNode[] = [];
  for (const link of links.slice(0, 60)) {
    const label = linkLabel(link);
    if (!label) continue;
    flatRoots.push({
      label,
      selector: link.selector,
      depth: 0,
      children: [],
    });
  }

  return {
    navs: [],
    roots: flatRoots.slice(0, 40),
    depth: 1,
    totalLinks: links.length,
    byDepth: [flatRoots.length],
  };
}
