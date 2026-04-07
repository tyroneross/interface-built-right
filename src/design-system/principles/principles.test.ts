import { describe, it, expect } from 'vitest';
import { gestaltRules } from './gestalt.js';
import { signalNoiseRules } from './signal-noise.js';
import { fittsRules } from './fitts.js';
import { hickRules } from './hick.js';
import { contentChromeRules } from './content-chrome.js';
import { cognitiveLoadRules } from './cognitive-load.js';
import { allCalmPrecisionRules, corePrincipleIds, stylisticPrincipleIds } from './calm-precision.js';
import type { EnhancedElement } from '../../schemas.js';
import type { RuleContext } from '../../rules/engine.js';

// Helper to create mock element
function mockElement(overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: 'div.test',
    tagName: 'div',
    bounds: { x: 0, y: 0, width: 200, height: 50 },
    interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
    a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    ...overrides,
  } as EnhancedElement;
}

function mockContext(elements: EnhancedElement[] = []): RuleContext {
  return {
    isMobile: false,
    viewportWidth: 1920,
    viewportHeight: 1080,
    url: 'http://localhost:3000',
    allElements: elements,
  };
}

describe('Calm Precision Principles', () => {
  describe('allCalmPrecisionRules', () => {
    it('has 6 rules total', () => {
      expect(allCalmPrecisionRules.length).toBe(6);
    });

    it('all rules have calm-precision/ prefix', () => {
      for (const rule of allCalmPrecisionRules) {
        expect(rule.id).toMatch(/^calm-precision\//);
      }
    });

    it('core principles are correct', () => {
      expect(corePrincipleIds).toEqual(['gestalt', 'signal-noise', 'content-chrome', 'cognitive-load']);
    });

    it('stylistic principles are correct', () => {
      expect(stylisticPrincipleIds).toEqual(['fitts', 'hick']);
    });
  });

  describe('Gestalt: Border Grouping', () => {
    const rule = gestaltRules[0];

    it('flags list items with borders', () => {
      const el = mockElement({
        tagName: 'li',
        computedStyles: { border: '1px solid black' },
      });
      const result = rule.check(el, mockContext());
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe('calm-precision/gestalt-grouping');
    });

    it('passes for list items without borders', () => {
      const el = mockElement({
        tagName: 'li',
        computedStyles: { border: 'none' },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('passes for non-list elements with borders', () => {
      const el = mockElement({
        tagName: 'div',
        computedStyles: { border: '1px solid black' },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });
  });

  describe('Signal-to-Noise: Status Indication', () => {
    const rule = signalNoiseRules[0];

    it('flags status text with heavy background', () => {
      const el = mockElement({
        text: 'Success',
        computedStyles: { backgroundColor: '#22c55e' },
      });
      const result = rule.check(el, mockContext());
      expect(result).not.toBeNull();
      expect(result!.fix).toContain('text color');
    });

    it('passes for status text without background', () => {
      const el = mockElement({
        text: 'Success',
        computedStyles: { backgroundColor: 'transparent' },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('allows subtle backgrounds (low opacity)', () => {
      const el = mockElement({
        text: 'Pending',
        computedStyles: { backgroundColor: 'rgba(0, 128, 0, 0.08)' },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('ignores non-status text', () => {
      const el = mockElement({
        text: 'Hello World',
        computedStyles: { backgroundColor: '#ff0000' },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });
  });

  describe("Fitts' Law: Button Sizing", () => {
    const rule = fittsRules[0];

    it('flags small primary action buttons', () => {
      const el = mockElement({
        tagName: 'button',
        text: 'Submit',
        bounds: { x: 0, y: 0, width: 80, height: 36 },
      });
      const result = rule.check(el, mockContext());
      expect(result).not.toBeNull();
      expect(result!.message).toContain('submit');
    });

    it('passes for adequately sized primary buttons', () => {
      const el = mockElement({
        tagName: 'button',
        text: 'Submit',
        bounds: { x: 0, y: 0, width: 200, height: 44 },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('ignores non-primary buttons', () => {
      const el = mockElement({
        tagName: 'button',
        text: 'Cancel',
        bounds: { x: 0, y: 0, width: 60, height: 30 },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('ignores non-button elements', () => {
      const el = mockElement({
        tagName: 'div',
        text: 'Submit',
        bounds: { x: 0, y: 0, width: 50, height: 20 },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });
  });

  describe("Hick's Law: Choice Count", () => {
    const rule = hickRules[0];

    it('flags too many interactive elements in a row', () => {
      const elements: EnhancedElement[] = [];
      for (let i = 0; i < 9; i++) {
        elements.push(mockElement({
          selector: `button.btn-${i}`,
          tagName: 'button',
          bounds: { x: i * 100, y: 50, width: 80, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }

      // First element should trigger (it's the first in the group)
      const result = rule.check(elements[0], mockContext(elements));
      expect(result).not.toBeNull();
      expect(result!.message).toContain('9 interactive elements');
    });

    it('passes for 7 or fewer choices', () => {
      const elements: EnhancedElement[] = [];
      for (let i = 0; i < 5; i++) {
        elements.push(mockElement({
          selector: `button.btn-${i}`,
          bounds: { x: i * 100, y: 50, width: 80, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }
      expect(rule.check(elements[0], mockContext(elements))).toBeNull();
    });
  });

  describe('Content >= Chrome', () => {
    const rule = contentChromeRules[0];

    it('flags when chrome exceeds 30%', () => {
      const nav = mockElement({
        selector: 'nav.main',
        tagName: 'nav',
        bounds: { x: 0, y: 0, width: 1920, height: 400 }, // ~37% of viewport
      });
      const el = mockElement({ selector: 'div.first' });
      const ctx = mockContext([el, nav]);

      const result = rule.check(el, ctx);
      expect(result).not.toBeNull();
    });

    it('passes when chrome is under 30%', () => {
      const nav = mockElement({
        selector: 'nav.main',
        tagName: 'nav',
        bounds: { x: 0, y: 0, width: 1920, height: 60 }, // ~3%
      });
      const el = mockElement({ selector: 'div.first' });
      const ctx = mockContext([el, nav]);

      expect(rule.check(el, ctx)).toBeNull();
    });

    it('only runs on first element', () => {
      const nav = mockElement({
        tagName: 'nav',
        bounds: { x: 0, y: 0, width: 1920, height: 400 },
      });
      const first = mockElement({ selector: 'div.first' });
      const second = mockElement({ selector: 'div.second' });

      // Second element should not trigger (not the first)
      expect(rule.check(second, mockContext([first, nav, second]))).toBeNull();
    });
  });

  describe('Cognitive Load: Element Count', () => {
    const rule = cognitiveLoadRules[0];

    it('flags containers with too many interactive children', () => {
      const container = mockElement({
        selector: 'div.container',
        bounds: { x: 0, y: 0, width: 800, height: 600 },
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
      });

      const children: EnhancedElement[] = [container];
      for (let i = 0; i < 12; i++) {
        children.push(mockElement({
          selector: `button.child-${i}`,
          bounds: { x: 10 + i * 60, y: 10, width: 50, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }

      const result = rule.check(container, mockContext(children));
      expect(result).not.toBeNull();
      expect(result!.message).toContain('interactive elements');
    });

    it('passes for containers with few children', () => {
      const container = mockElement({
        bounds: { x: 0, y: 0, width: 800, height: 600 },
      });

      const children: EnhancedElement[] = [container];
      for (let i = 0; i < 5; i++) {
        children.push(mockElement({
          selector: `button.child-${i}`,
          bounds: { x: 10, y: 10, width: 50, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }

      expect(rule.check(container, mockContext(children))).toBeNull();
    });
  });
});
