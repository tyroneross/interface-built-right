/**
 * Token Validation Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { normalizeColor, validateAgainstTokens, loadTokenSpec } from './tokens.js';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

describe('normalizeColor', () => {
  it('normalizes hex colors to lowercase', () => {
    expect(normalizeColor('#3B82F6')).toBe('#3b82f6');
    expect(normalizeColor('#FFF')).toBe('#fff');
  });

  it('converts rgb to hex', () => {
    expect(normalizeColor('rgb(59, 130, 246)')).toBe('#3b82f6');
    expect(normalizeColor('rgb(255, 255, 255)')).toBe('#ffffff');
  });

  it('converts rgba to hex (ignores alpha)', () => {
    expect(normalizeColor('rgba(59, 130, 246, 0.5)')).toBe('#3b82f6');
  });

  it('returns empty string for invalid input', () => {
    expect(normalizeColor('')).toBe('');
  });
});

describe('loadTokenSpec', () => {
  const testSpecPath = join('.ibr', 'test-tokens.json');

  beforeEach(() => {
    if (!existsSync('.ibr')) {
      mkdirSync('.ibr', { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testSpecPath)) {
      unlinkSync(testSpecPath);
    }
  });

  it('loads valid token spec', () => {
    const spec = {
      name: 'Test Spec',
      tokens: {
        colors: { primary: '#3b82f6' },
      },
    };
    writeFileSync(testSpecPath, JSON.stringify(spec));

    const loaded = loadTokenSpec(testSpecPath);
    expect(loaded.name).toBe('Test Spec');
    expect(loaded.tokens.colors?.primary).toBe('#3b82f6');
  });

  it('throws on missing file', () => {
    expect(() => loadTokenSpec('nonexistent.json')).toThrow('Token spec not found');
  });

  it('throws on invalid JSON', () => {
    writeFileSync(testSpecPath, 'invalid json');
    expect(() => loadTokenSpec(testSpecPath)).toThrow('Failed to parse token spec');
  });

  it('throws if no token categories defined', () => {
    const spec = { name: 'Empty', tokens: {} };
    writeFileSync(testSpecPath, JSON.stringify(spec));
    expect(() => loadTokenSpec(testSpecPath)).toThrow('must define at least one token category');
  });
});

describe('validateAgainstTokens', () => {
  it('validates touch targets', () => {
    const spec = {
      name: 'Test',
      tokens: {
        touchTargets: { min: 44 },
      },
    };

    const elements = [
      {
        selector: 'button.small',
        tagName: 'button',
        bounds: { x: 0, y: 0, width: 32, height: 32 },
        interactive: { hasOnClick: true, hasHref: false },
        computedStyles: {},
        a11y: {},
      },
      {
        selector: 'button.ok',
        tagName: 'button',
        bounds: { x: 0, y: 0, width: 48, height: 48 },
        interactive: { hasOnClick: true, hasHref: false },
        computedStyles: {},
        a11y: {},
      },
    ];

    const violations = validateAgainstTokens(elements, spec);

    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe('button.small');
    expect(violations[0].property).toBe('touch-target');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].actual).toBe(32);
  });

  it('validates font sizes', () => {
    const spec = {
      name: 'Test',
      tokens: {
        fontSizes: { sm: 14, base: 16, lg: 18 },
      },
    };

    const elements = [
      {
        selector: 'p.invalid',
        tagName: 'p',
        bounds: { x: 0, y: 0, width: 100, height: 20 },
        interactive: { hasOnClick: false, hasHref: false },
        computedStyles: { 'font-size': '15px' },
        a11y: {},
      },
      {
        selector: 'p.valid',
        tagName: 'p',
        bounds: { x: 0, y: 0, width: 100, height: 20 },
        interactive: { hasOnClick: false, hasHref: false },
        computedStyles: { 'font-size': '16px' },
        a11y: {},
      },
    ];

    const violations = validateAgainstTokens(elements, spec);

    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe('p.invalid');
    expect(violations[0].property).toBe('font-size');
    expect(violations[0].severity).toBe('warning');
  });

  it('validates colors', () => {
    const spec = {
      name: 'Test',
      tokens: {
        colors: {
          primary: '#3b82f6',
          text: '#1f2937',
        },
      },
    };

    const elements = [
      {
        selector: 'div.invalid',
        tagName: 'div',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        interactive: { hasOnClick: false, hasHref: false },
        computedStyles: {
          color: '#333333', // not in tokens
          'background-color': '#ffffff', // not in tokens
        },
        a11y: {},
      },
      {
        selector: 'div.valid',
        tagName: 'div',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        interactive: { hasOnClick: false, hasHref: false },
        computedStyles: {
          color: '#1f2937', // matches token
          'background-color': 'transparent', // ignored
        },
        a11y: {},
      },
    ];

    const violations = validateAgainstTokens(elements, spec);

    expect(violations).toHaveLength(2); // color + background-color
    expect(violations.every(v => v.element === 'div.invalid')).toBe(true);
    expect(violations.every(v => v.property === 'color')).toBe(true);
  });

  it('validates corner radius', () => {
    const spec = {
      name: 'Test',
      tokens: {
        cornerRadius: { sm: 4, md: 8, lg: 12 },
      },
    };

    const elements = [
      {
        selector: 'div.invalid',
        tagName: 'div',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        interactive: { hasOnClick: false, hasHref: false },
        computedStyles: { 'border-radius': '6px' },
        a11y: {},
      },
      {
        selector: 'div.valid',
        tagName: 'div',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        interactive: { hasOnClick: false, hasHref: false },
        computedStyles: { 'border-radius': '8px' },
        a11y: {},
      },
    ];

    const violations = validateAgainstTokens(elements, spec);

    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe('div.invalid');
    expect(violations[0].property).toBe('corner-radius');
  });

  it('returns empty array when no violations', () => {
    const spec = {
      name: 'Test',
      tokens: {
        touchTargets: { min: 44 },
      },
    };

    const elements = [
      {
        selector: 'button',
        tagName: 'button',
        bounds: { x: 0, y: 0, width: 48, height: 48 },
        interactive: { hasOnClick: true, hasHref: false },
        computedStyles: {},
        a11y: {},
      },
    ];

    const violations = validateAgainstTokens(elements, spec);
    expect(violations).toHaveLength(0);
  });
});
