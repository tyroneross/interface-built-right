import { describe, it, expect } from 'vitest';
import { handlerIntegrityRules } from './handler-integrity.js';
import type { EnhancedElement } from '../schemas.js';
import type { RuleContext } from './types.js';

const fakeInteractiveRule = handlerIntegrityRules[0];

function makeElement(overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: '#btn',
    tagName: 'div',
    text: 'Save',
    bounds: { x: 0, y: 0, width: 44, height: 44 },
    interactive: {
      hasOnClick: false,
      hasHref: false,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    a11y: {
      role: 'button',
      ariaLabel: null,
      ariaDescribedBy: null,
    },
    ...overrides,
  } as EnhancedElement;
}

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    isMobile: false,
    viewportWidth: 1440,
    viewportHeight: 900,
    url: 'http://test',
    allElements: [],
    ...overrides,
  };
}

describe('handler-integrity/fake-interactive — real listener detection', () => {
  it('flags a role=button div with no detected handler at all (the true-negative case)', () => {
    const el = makeElement();
    const result = fakeInteractiveRule.check(el, makeContext());
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('handler-integrity/fake-interactive');
  });

  it('does not flag when interactive.hasEventListener is true, even with hasOnClick false', () => {
    // Regression for the addEventListener-wired-button false positive: real
    // scans reported #rail-designer/#start-btn as fake-interactive because
    // detectHandlers() (onclick property/attribute + framework props only)
    // cannot see addEventListener listeners. enrichWithEventListeners in
    // extract.ts sets hasOnClick=true alongside hasEventListener, but this
    // test pins hasAnyHandler()'s own fallback in case a future caller ever
    // populates hasEventListener without also folding it into hasOnClick.
    const el = makeElement({
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'pointer',
        hasEventListener: true,
      },
    });
    const result = fakeInteractiveRule.check(el, makeContext());
    expect(result).toBeNull();
  });

  it('does not flag when interactive.hasDelegatedListener is true (event delegation from a non-root ancestor)', () => {
    const el = makeElement({
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'pointer',
        hasDelegatedListener: true,
      },
    });
    const result = fakeInteractiveRule.check(el, makeContext());
    expect(result).toBeNull();
  });

  it('still flags when hasEventListener/hasDelegatedListener are both explicitly false', () => {
    const el = makeElement({
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'pointer',
        hasEventListener: false,
        hasDelegatedListener: false,
      },
    });
    const result = fakeInteractiveRule.check(el, makeContext());
    expect(result).not.toBeNull();
  });
});
