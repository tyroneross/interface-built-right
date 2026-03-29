/**
 * Shadow DOM piercing helpers — extract elements inside open shadow roots
 * that Accessibility.getFullAXTree may miss.
 */

import type { RuntimeDomain } from './cdp/runtime.js'

export interface ShadowElement {
  tagName: string
  role: string | null
  label: string | null
  textContent: string | null
  bounds: { x: number; y: number; width: number; height: number } | null
}

/**
 * Find elements inside shadow DOMs that the AX tree may miss.
 * Uses Runtime.evaluate to traverse open shadow roots.
 *
 * Only descends into *open* shadow roots (closed roots are inaccessible by
 * design). Returns a flat list of every element found inside any shadow DOM
 * on the page.
 */
export async function extractShadowElements(runtime: RuntimeDomain): Promise<ShadowElement[]> {
  const result = await runtime.evaluate(`
    (function() {
      const found = [];

      function walk(root) {
        const children = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
        for (const el of children) {
          // Descend into open shadow roots
          if (el.shadowRoot) {
            const shadowChildren = Array.from(el.shadowRoot.querySelectorAll('*'));
            for (const shadowEl of shadowChildren) {
              const rect = shadowEl.getBoundingClientRect();
              found.push({
                tagName: shadowEl.tagName.toLowerCase(),
                role: shadowEl.getAttribute('role'),
                label: shadowEl.getAttribute('aria-label') || shadowEl.getAttribute('aria-labelledby'),
                textContent: (shadowEl.textContent || '').trim().slice(0, 200) || null,
                bounds: rect.width > 0 || rect.height > 0
                  ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                  : null,
              });
              // Recurse into nested shadow roots
              if (shadowEl.shadowRoot) {
                walk(shadowEl.shadowRoot);
              }
            }
          }
        }
      }

      walk(document);
      return found;
    })()
  `)

  if (!Array.isArray(result)) return []

  return (result as Array<Record<string, unknown>>).map((item) => ({
    tagName: String(item.tagName ?? 'unknown'),
    role: item.role != null ? String(item.role) : null,
    label: item.label != null ? String(item.label) : null,
    textContent: item.textContent != null ? String(item.textContent) : null,
    bounds: item.bounds != null
      ? item.bounds as { x: number; y: number; width: number; height: number }
      : null,
  }))
}
