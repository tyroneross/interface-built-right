import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { applyDesignSystemCheck } from '../scan.js';
import type { ScanIssue } from '../scan.js';
import type { EnhancedElement, Viewport } from '../schemas.js';

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

const desktopViewport: Viewport = { name: 'desktop', width: 1920, height: 1080 };

const minimalConfig = {
  version: 1,
  name: 'Test System',
};

let TEST_DIR: string;

describe('applyDesignSystemCheck', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'ibr-ds-apply-'));
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns undefined and adds no issues when no config exists', async () => {
    const elements = [mockElement()];
    const issues: ScanIssue[] = [];

    const result = await applyDesignSystemCheck(
      elements,
      issues,
      desktopViewport,
      'http://localhost:3000',
      TEST_DIR
    );

    expect(result).toBeUndefined();
    expect(issues).toHaveLength(0);
  });

  it('adds principle violations to issues when config exists and gestalt rule fires', async () => {
    const ibrDir = join(TEST_DIR, '.ibr');
    mkdirSync(ibrDir, { recursive: true });
    writeFileSync(join(ibrDir, 'design-system.json'), JSON.stringify(minimalConfig));

    // A list item with a border triggers the gestalt grouping rule
    const elements = [
      mockElement({
        tagName: 'li',
        selector: 'ul > li',
        // Longhands, matching what getComputedStyle actually returns. The old
        // `{ border: '1px solid black' }` is a shorthand the browser never
        // reports for width and no extractor ever captured — the fixture was
        // richer than production, so the test passed while the rule could not
        // fire on any real page.
        computedStyles: {
          borderTopWidth: '1px',
          borderRightWidth: '1px',
          borderBottomWidth: '1px',
          borderLeftWidth: '1px',
          borderStyle: 'solid',
        },
      }),
    ];
    const issues: ScanIssue[] = [];

    const result = await applyDesignSystemCheck(
      elements,
      issues,
      desktopViewport,
      'http://localhost:3000',
      TEST_DIR
    );

    expect(result).toBeDefined();
    const dsIssues = issues.filter(i => i.category === 'design-system');
    expect(dsIssues.length).toBeGreaterThan(0);
    expect(dsIssues[0].severity).toMatch(/^(error|warning)$/);
  });

  it('returns DesignSystemResult with complianceScore when tokens are configured', async () => {
    const ibrDir = join(TEST_DIR, '.ibr');
    mkdirSync(ibrDir, { recursive: true });
    const configWithTokens = {
      version: 1,
      name: 'Token System',
      tokens: {
        colors: { primary: '#3b82f6' },
        spacing: [4, 8, 16, 24],
        touchTargets: { min: 44 },
      },
    };
    writeFileSync(join(ibrDir, 'design-system.json'), JSON.stringify(configWithTokens));

    const elements = [mockElement()];
    const issues: ScanIssue[] = [];

    const result = await applyDesignSystemCheck(
      elements,
      issues,
      desktopViewport,
      'http://localhost:3000',
      TEST_DIR
    );

    expect(result).toBeDefined();
    expect(result!.configName).toBe('Token System');
    // `mockElement()` carries no computedStyles, so no validator can read it
    // and NOTHING was evaluated. This assertion used to require a number, and
    // the implementation obliged with 100 — a perfect score for grading
    // nothing. `null` is the honest answer and the reason the type is nullable.
    expect(result!.complianceScore).toBeNull();
    expect(result!.coverage?.elementsEvaluated).toBe(0);
    expect(result!.coverage?.validatedCategoriesDeclared).toEqual(
      expect.arrayContaining(['colors', 'spacing', 'touchTargets']),
    );
  });

  it('does not mutate issues when design system has no violations', async () => {
    const ibrDir = join(TEST_DIR, '.ibr');
    mkdirSync(ibrDir, { recursive: true });
    writeFileSync(join(ibrDir, 'design-system.json'), JSON.stringify(minimalConfig));

    // A plain div with no border should not trigger gestalt rule
    const elements = [mockElement({ tagName: 'div', computedStyles: { border: 'none' } })];
    const issues: ScanIssue[] = [];

    await applyDesignSystemCheck(
      elements,
      issues,
      desktopViewport,
      'http://localhost:3000',
      TEST_DIR
    );

    const dsIssues = issues.filter(i => i.category === 'design-system');
    expect(dsIssues).toHaveLength(0);
  });
});
