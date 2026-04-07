import { describe, it, expect } from 'vitest';
import { validateExtendedTokens, calculateComplianceScore } from './validator.js';
import type { EnhancedElement } from '../../schemas.js';
import type { ExtendedTokenSpec } from './schema.js';

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

describe('Extended Token Validation', () => {
  describe('validateExtendedTokens', () => {
    it('detects non-token font weights', () => {
      const elements = [mockElement({ computedStyles: { 'font-weight': '300' } })];
      const tokens: ExtendedTokenSpec = {
        typography: { fontWeights: { normal: 400, bold: 700 } },
      };

      const violations = validateExtendedTokens(elements, tokens, 'Test');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.property === 'font-weight')).toBe(true);
    });

    it('passes valid font weights', () => {
      const elements = [mockElement({ computedStyles: { 'font-weight': '400' } })];
      const tokens: ExtendedTokenSpec = {
        typography: { fontWeights: { normal: 400, bold: 700 } },
      };

      const violations = validateExtendedTokens(elements, tokens, 'Test');
      expect(violations.filter(v => v.property === 'font-weight')).toHaveLength(0);
    });

    it('bridges to old validators for colors', () => {
      const elements = [mockElement({ computedStyles: { color: '#ff0000' } })];
      const tokens: ExtendedTokenSpec = {
        colors: { primary: '#3b82f6', secondary: '#8b5cf6' },
      };

      const violations = validateExtendedTokens(elements, tokens, 'Test');
      expect(violations.some(v => v.property === 'color')).toBe(true);
    });

    it('validates spacing via bridge', () => {
      const elements = [mockElement({ computedStyles: { gap: '13px' } })];
      const tokens: ExtendedTokenSpec = {
        spacing: [4, 8, 12, 16, 24, 32],
      };

      const violations = validateExtendedTokens(elements, tokens, 'Test');
      expect(violations.some(v => v.property === 'spacing')).toBe(true);
    });

    it('returns empty for elements matching all tokens', () => {
      const elements = [mockElement({
        computedStyles: {
          'font-weight': '400',
          'font-size': '16px',
          color: '#3b82f6',
          gap: '16px',
        },
        bounds: { x: 0, y: 0, width: 200, height: 50 },
      })];
      const tokens: ExtendedTokenSpec = {
        colors: { primary: '#3b82f6' },
        typography: {
          fontSizes: { base: 16 },
          fontWeights: { normal: 400 },
        },
        spacing: [4, 8, 12, 16, 24],
      };

      const violations = validateExtendedTokens(elements, tokens, 'Test');
      // Font weight and font size should pass. Color should pass. Spacing should pass.
      expect(violations.filter(v =>
        v.property === 'font-weight' ||
        v.property === 'font-size' ||
        v.property === 'spacing'
      )).toHaveLength(0);
    });
  });

  describe('calculateComplianceScore', () => {
    it('returns 100 when no violations', () => {
      expect(calculateComplianceScore(50, 0)).toBe(100);
    });

    it('returns 0 when all violations', () => {
      expect(calculateComplianceScore(10, 10)).toBe(0);
    });

    it('returns percentage', () => {
      expect(calculateComplianceScore(100, 25)).toBe(75);
    });

    it('handles zero total', () => {
      expect(calculateComplianceScore(0, 0)).toBe(100);
    });
  });
});
