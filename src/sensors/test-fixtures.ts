import type { EnhancedElement } from '../schemas.js';
import type { ExtractedCSSRule, DocumentMeta, SensorContext } from './types.js';

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

export function makeCtx(
  elements: EnhancedElement[],
  viewportWidth = 1920,
  viewportHeight = 1080,
  extras: { cssRules?: ExtractedCSSRule[]; documentMeta?: DocumentMeta } = {},
): SensorContext {
  return {
    elements,
    url: 'http://localhost:3000',
    viewport: { width: viewportWidth, height: viewportHeight },
    ...(extras.cssRules ? { cssRules: extras.cssRules } : {}),
    ...(extras.documentMeta ? { documentMeta: extras.documentMeta } : {}),
  };
}

/**
 * Build a CSS style rule for tests.
 */
export function makeStyleRule(
  selector: string,
  declarations: Record<string, string>,
  sourceUrl?: string,
): ExtractedCSSRule {
  return { kind: 'style', selector, declarations, ...(sourceUrl ? { sourceUrl } : {}) };
}

/**
 * Build a CSS @media rule for tests.
 */
export function makeMediaRule(
  conditionText: string,
  rules: ExtractedCSSRule[] = [],
  sourceUrl?: string,
): ExtractedCSSRule {
  return { kind: 'media', conditionText, rules, ...(sourceUrl ? { sourceUrl } : {}) };
}

/**
 * Build a CSS @keyframes rule for tests.
 */
export function makeKeyframesRule(
  name: string,
  steps: Array<{ keyText: string; declarations: Record<string, string> }>,
  sourceUrl?: string,
): ExtractedCSSRule {
  return { kind: 'keyframes', name, steps, ...(sourceUrl ? { sourceUrl } : {}) };
}

/**
 * Build a CSS @container rule for tests.
 */
export function makeContainerRule(
  conditionText: string,
  rules: ExtractedCSSRule[] = [],
  containerName?: string,
  sourceUrl?: string,
): ExtractedCSSRule {
  return {
    kind: 'container',
    conditionText,
    rules,
    ...(containerName ? { containerName } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  };
}
