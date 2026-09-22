import { describe, expect, it } from 'vitest';
import type { EnhancedElement } from '../../schemas.js';
import { isVisibleInteractive } from './visibility.js';

function interactiveElement(overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: 'button.test',
    tagName: 'button',
    bounds: { x: 20, y: 20, width: 80, height: 40 },
    computedStyles: { display: 'block', visibility: 'visible', opacity: '1' },
    interactive: {
      hasOnClick: true,
      hasHref: false,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    a11y: { role: 'button', ariaLabel: 'Test', ariaDescribedBy: null },
    ...overrides,
  } as EnhancedElement;
}

describe('isVisibleInteractive', () => {
  it('accepts a visible interactive element', () => {
    expect(isVisibleInteractive(interactiveElement())).toBe(true);
  });

  it.each([
    ['display none', { computedStyles: { display: 'none', visibility: 'visible', opacity: '1' } }],
    ['visibility hidden', { computedStyles: { display: 'block', visibility: 'hidden', opacity: '1' } }],
    ['visibility collapse', { computedStyles: { display: 'block', visibility: 'collapse', opacity: '1' } }],
    ['own opacity zero', { computedStyles: { display: 'block', visibility: 'visible', opacity: '0' } }],
    ['ancestor opacity zero', { ancestorOpacity: 0 }],
    ['zero width', { bounds: { x: 20, y: 20, width: 0, height: 40 } }],
    ['zero height', { bounds: { x: 20, y: 20, width: 80, height: 0 } }],
  ])('rejects %s independently', (_label, overrides) => {
    expect(isVisibleInteractive(interactiveElement(overrides as Partial<EnhancedElement>))).toBe(false);
  });

  it('rejects a visible non-interactive element', () => {
    expect(isVisibleInteractive(interactiveElement({
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: -1,
        cursor: 'default',
      },
    }))).toBe(false);
  });
});
