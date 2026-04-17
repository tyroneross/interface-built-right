import type { EnhancedElement } from '../schemas.js';

export function makeElement(overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: 'body > div',
    tagName: 'div',
    text: '',
    bounds: { x: 0, y: 0, width: 100, height: 30 },
    computedStyles: {
      color: 'rgb(0, 0, 0)',
      backgroundColor: 'rgb(255, 255, 255)',
      fontSize: '16',
      fontWeight: '400',
      borderRadius: '0',
      padding: '0',
      cursor: 'default',
      borderWidth: '0',
      borderColor: 'transparent',
    },
    a11y: {
      role: null,
      ariaLabel: null,
      ariaDescribedBy: null,
    },
    interactive: {
      hasOnClick: false,
      hasHref: false,
      hasReactHandler: false,
      hasVueHandler: false,
      hasAngularHandler: false,
      isDisabled: false,
      tabIndex: -1,
      cursor: 'default',
    },
    ...overrides,
  } as EnhancedElement;
}

export function makeButton(text: string, overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return makeElement({
    selector: 'button',
    tagName: 'button',
    text,
    a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null },
    interactive: {
      hasOnClick: true,
      hasHref: false,
      hasReactHandler: false,
      hasVueHandler: false,
      hasAngularHandler: false,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    bounds: { x: 0, y: 0, width: 100, height: 44 },
    ...overrides,
  });
}

export function makeLink(text: string, overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return makeElement({
    selector: 'a',
    tagName: 'a',
    text,
    a11y: { role: 'link', ariaLabel: null, ariaDescribedBy: null },
    interactive: {
      hasOnClick: false,
      hasHref: true,
      hasReactHandler: false,
      hasVueHandler: false,
      hasAngularHandler: false,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    bounds: { x: 0, y: 0, width: 80, height: 24 },
    ...overrides,
  });
}

export function makeCtx(elements: EnhancedElement[], viewportWidth = 1920, viewportHeight = 1080) {
  return {
    elements,
    url: 'http://localhost:3000',
    viewport: { width: viewportWidth, height: viewportHeight },
  };
}
