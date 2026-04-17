import type { SensorContext, ComponentCensus } from './types.js';
import type { EnhancedElement } from '../schemas.js';

/**
 * Detect a React (or design-system) component name from available element data.
 *
 * Detection priority (fallback chain):
 * 1. data-component attribute (explicit annotation)
 * 2. data-testid via sourceHint.dataTestId (e.g. "submit-button" → "SubmitButton")
 * 3. PascalCase token inside className (CSS Modules convention)
 * 4. Returns null — caller falls back to tag name
 *
 * Note: `attributes` map is not in EnhancedElement schema (as of current engine).
 * When the engine captures it, detection priority 1 can be wired without changes here.
 */
function detectComponentName(el: EnhancedElement): string | null {
  // Priority 1: explicit data-component attribute via any future attributes map
  const attrs = (el as unknown as { attributes?: Record<string, string> }).attributes;
  if (attrs?.['data-component']) return attrs['data-component'];

  // Priority 2: data-testid (already captured in sourceHint)
  const testId = el.sourceHint?.dataTestId;
  if (testId) {
    // Convert "submit-button" or "submit_button" → "SubmitButton"
    const name = testId
      .split(/[-_]/)
      .filter(Boolean)
      .map(p => (p[0]?.toUpperCase() ?? '') + p.slice(1))
      .join('');
    if (name.length > 0) return name;
  }

  // Priority 3: PascalCase token in className (CSS Modules: "Button_root__abc")
  const className = el.className ?? attrs?.['class'] ?? attrs?.['className'];
  if (className) {
    const match = className.match(/\b([A-Z][a-zA-Z0-9]+)(?:_|$|\s)/);
    if (match) return match[1];
  }

  return null;
}

export function collectComponentCensus(ctx: SensorContext): ComponentCensus {
  const byTag: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  let withHandlers = 0;
  let withoutHandlers = 0;
  const orphanInteractive: ComponentCensus['orphanInteractive'] = [];

  // Component tracking: name → { count, selectors }
  const componentMap = new Map<string, { count: number; selectors: string[] }>();

  for (const el of ctx.elements) {
    const tag = el.tagName.toLowerCase();
    if (tag) byTag[tag] = (byTag[tag] ?? 0) + 1;

    const role = el.a11y.role;
    if (role) byRole[role] = (byRole[role] ?? 0) + 1;

    const interactive = el.interactive;
    const hasHandler = !!(
      interactive.hasOnClick ||
      interactive.hasHref ||
      interactive.hasReactHandler ||
      interactive.hasVueHandler ||
      interactive.hasAngularHandler
    );

    if (hasHandler) {
      withHandlers++;
    } else {
      withoutHandlers++;
      // Detect orphans: looks clickable (cursor:pointer) but no handler
      const cursor = el.computedStyles?.cursor;
      if (cursor === 'pointer' && (el.text ?? '').trim().length > 0) {
        if (orphanInteractive.length < 20) {
          orphanInteractive.push({
            selector: el.selector,
            text: (el.text ?? '').slice(0, 60),
            reason: 'cursor:pointer with no handler',
          });
        }
      }
    }

    // Component name detection
    const componentName = detectComponentName(el) ?? el.tagName.toLowerCase();
    const existing = componentMap.get(componentName);
    if (existing) {
      existing.count++;
      if (existing.selectors.length < 5) existing.selectors.push(el.selector);
    } else {
      componentMap.set(componentName, { count: 1, selectors: [el.selector] });
    }
  }

  // Build byComponent and topComponents
  const byComponent: Record<string, number> = {};
  for (const [name, data] of componentMap) {
    byComponent[name] = data.count;
  }

  const topComponents = Array.from(componentMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([name, data]) => ({ name, count: data.count, selectors: data.selectors }));

  return {
    byTag,
    byRole,
    withHandlers,
    withoutHandlers,
    orphanInteractive,
    byComponent,
    topComponents,
  };
}
