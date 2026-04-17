import type { SensorContext, InteractionMap } from './types.js';

export function collectInteractionMap(ctx: SensorContext): InteractionMap {
  const missingHandlers: InteractionMap['missingHandlers'] = [];
  let total = 0;
  let withHandlers = 0;
  let withoutHandlers = 0;
  let disabled = 0;
  let formCount = 0;

  for (const el of ctx.elements) {
    const tag = el.tagName.toLowerCase();
    const role = el.a11y.role ?? '';
    const cursor = el.computedStyles?.cursor;

    const looksInteractive =
      tag === 'button' ||
      tag === 'a' ||
      role === 'button' ||
      role === 'link' ||
      cursor === 'pointer';

    if (tag === 'form') formCount++;
    if (!looksInteractive) continue;

    total++;

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
      if (missingHandlers.length < 25) {
        missingHandlers.push({
          selector: el.selector,
          text: (el.text ?? '').slice(0, 60),
          tagName: tag,
          role: role || undefined,
        });
      }
    }

    if (interactive.isDisabled) disabled++;
  }

  return { total, withHandlers, withoutHandlers, missingHandlers, disabled, formCount };
}
