/**
 * Memory system end-to-end tests
 * Tests the full lifecycle: add → list → query → learn → promote → rules → remove
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import {
  initMemory,
  loadSummary,
  addPreference,
  getPreference,
  removePreference,
  listPreferences,
  learnFromSession,
  listLearned,
  promoteToPreference,
  rebuildSummary,
  queryMemory,
  preferencesToRules,
  createMemoryPreset,
  formatMemorySummary,
  formatPreference,
} from './memory.js';
import type { Session, EnhancedElement } from './schemas.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'ibr-memory-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('Memory initialization', () => {
  it('creates memory directory structure', async () => {
    await initMemory(testDir);
    expect(existsSync(join(testDir, 'memory', 'preferences'))).toBe(true);
    expect(existsSync(join(testDir, 'memory', 'learned'))).toBe(true);
    expect(existsSync(join(testDir, 'memory', 'archive'))).toBe(true);
  });

  it('returns empty summary when none exists', async () => {
    const summary = await loadSummary(testDir);
    expect(summary.version).toBe(1);
    expect(summary.stats.totalPreferences).toBe(0);
    expect(summary.activePreferences).toHaveLength(0);
  });
});

describe('Preference CRUD', () => {
  it('adds a preference and updates summary', async () => {
    const pref = await addPreference(testDir, {
      description: 'Primary buttons should be blue',
      category: 'color',
      componentType: 'button',
      property: 'background-color',
      value: '#3b82f6',
    });

    expect(pref.id).toMatch(/^pref_/);
    expect(pref.source).toBe('user');
    expect(pref.confidence).toBe(1.0);
    expect(pref.expectation.operator).toBe('equals');

    // Summary should reflect the new preference
    const summary = await loadSummary(testDir);
    expect(summary.stats.totalPreferences).toBe(1);
    expect(summary.activePreferences).toHaveLength(1);
    expect(summary.activePreferences[0].description).toBe('Primary buttons should be blue');
  });

  it('retrieves preference by ID', async () => {
    const pref = await addPreference(testDir, {
      description: 'Nav dark sidebar',
      category: 'navigation',
      property: 'background-color',
      operator: 'contains',
      value: 'rgb(3',
    });

    const retrieved = await getPreference(testDir, pref.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.description).toBe('Nav dark sidebar');
    expect(retrieved!.expectation.operator).toBe('contains');
  });

  it('returns null for nonexistent preference', async () => {
    const result = await getPreference(testDir, 'pref_nonexistent');
    expect(result).toBeNull();
  });

  it('removes a preference and updates summary', async () => {
    const pref = await addPreference(testDir, {
      description: 'To be removed',
      category: 'layout',
      property: 'display',
      value: 'flex',
    });

    const removed = await removePreference(testDir, pref.id);
    expect(removed).toBe(true);

    const summary = await loadSummary(testDir);
    expect(summary.stats.totalPreferences).toBe(0);
    expect(summary.activePreferences).toHaveLength(0);
  });

  it('returns false when removing nonexistent preference', async () => {
    await initMemory(testDir);
    const removed = await removePreference(testDir, 'pref_nonexistent');
    expect(removed).toBe(false);
  });

  it('lists preferences with filters', async () => {
    await addPreference(testDir, {
      description: 'Button color',
      category: 'color',
      componentType: 'button',
      property: 'background-color',
      value: 'blue',
    });
    await addPreference(testDir, {
      description: 'Layout grid',
      category: 'layout',
      property: 'display',
      value: 'grid',
    });

    const all = await listPreferences(testDir);
    expect(all).toHaveLength(2);

    const colorOnly = await listPreferences(testDir, { category: 'color' });
    expect(colorOnly).toHaveLength(1);
    expect(colorOnly[0].description).toBe('Button color');
  });

  it('lists preferences sorted by confidence', async () => {
    await addPreference(testDir, {
      description: 'Low confidence',
      category: 'color',
      property: 'color',
      value: 'red',
      confidence: 0.5,
    });
    await addPreference(testDir, {
      description: 'High confidence',
      category: 'color',
      property: 'color',
      value: 'blue',
      confidence: 1.0,
    });

    const prefs = await listPreferences(testDir);
    expect(prefs[0].description).toBe('High confidence');
    expect(prefs[1].description).toBe('Low confidence');
  });
});

describe('Learning from sessions', () => {
  const mockSession: Session = {
    id: 'sess_test123',
    name: 'Test session',
    url: 'http://localhost:3000/dashboard',
    viewport: { name: 'desktop', width: 1920, height: 1080 },
    status: 'compared',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('stores learned expectation from session', async () => {
    const learned = await learnFromSession(testDir, mockSession, [
      {
        description: 'Header background is white',
        category: 'color',
        property: 'background-color',
        value: 'rgb(255, 255, 255)',
      },
    ]);

    expect(learned.id).toMatch(/^learn_/);
    expect(learned.route).toBe('/dashboard');
    expect(learned.observations).toHaveLength(1);
  });

  it('lists learned expectations', async () => {
    await learnFromSession(testDir, mockSession, [
      { description: 'Obs 1', category: 'color', property: 'color', value: 'blue' },
    ]);
    await learnFromSession(testDir, { ...mockSession, id: 'sess_test456' }, [
      { description: 'Obs 2', category: 'layout', property: 'display', value: 'flex' },
    ]);

    const items = await listLearned(testDir);
    expect(items).toHaveLength(2);
  });

  it('promotes learned expectation to preference', async () => {
    const learned = await learnFromSession(testDir, mockSession, [
      {
        description: 'Sidebar is dark',
        category: 'navigation',
        property: 'background-color',
        value: '#1a1a1a',
      },
    ]);

    const pref = await promoteToPreference(testDir, learned.id);
    expect(pref).not.toBeNull();
    expect(pref!.source).toBe('learned');
    expect(pref!.confidence).toBe(0.8);
    expect(pref!.route).toBe('/dashboard');

    // Should now appear in summary
    const summary = await loadSummary(testDir);
    expect(summary.stats.totalPreferences).toBe(1);
  });

  it('returns null when promoting nonexistent learned', async () => {
    await initMemory(testDir);
    const result = await promoteToPreference(testDir, 'learn_nonexistent');
    expect(result).toBeNull();
  });
});

describe('Query', () => {
  it('queries by route', async () => {
    await addPreference(testDir, {
      description: 'Dashboard header',
      category: 'color',
      route: '/dashboard',
      property: 'background-color',
      value: 'white',
    });
    await addPreference(testDir, {
      description: 'Global nav',
      category: 'navigation',
      property: 'background-color',
      value: 'dark',
    });

    const results = await queryMemory(testDir, { route: '/dashboard' });
    // Global (no route) and route-matched should both appear
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('queries by category', async () => {
    await addPreference(testDir, {
      description: 'Color pref',
      category: 'color',
      property: 'color',
      value: 'blue',
    });
    await addPreference(testDir, {
      description: 'Layout pref',
      category: 'layout',
      property: 'display',
      value: 'grid',
    });

    const results = await queryMemory(testDir, { category: 'color' });
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('color');
  });
});

describe('Rules bridge', () => {
  it('converts preferences to rules', async () => {
    await addPreference(testDir, {
      description: 'Buttons blue',
      category: 'color',
      componentType: 'button',
      property: 'background-color',
      value: '#3b82f6',
      confidence: 1.0,
    });

    const summary = await loadSummary(testDir);
    const rules = preferencesToRules(summary.activePreferences);

    expect(rules).toHaveLength(1);
    expect(rules[0].id).toMatch(/^memory-pref_/);
    expect(rules[0].defaultSeverity).toBe('error'); // confidence >= 0.8

    // Test the rule check function
    const matchingElement: EnhancedElement = {
      selector: 'button.primary',
      tagName: 'button',
      bounds: { x: 0, y: 0, width: 100, height: 40 },
      computedStyles: { 'background-color': 'rgb(255, 0, 0)' }, // Wrong color
      interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      a11y: { role: 'button', ariaLabel: 'Submit', ariaDescribedBy: null },
    };

    const context = {
      isMobile: false,
      viewportWidth: 1920,
      viewportHeight: 1080,
      url: 'http://localhost:3000/dashboard',
      allElements: [matchingElement],
    };

    const violation = rules[0].check(matchingElement, context);
    expect(violation).not.toBeNull();
    expect(violation!.message).toContain('background-color');
    expect(violation!.message).toContain('#3b82f6');
  });

  it('rule passes when value matches', async () => {
    await addPreference(testDir, {
      description: 'Buttons blue',
      category: 'color',
      componentType: 'button',
      property: 'background-color',
      value: '#3b82f6',
    });

    const summary = await loadSummary(testDir);
    const rules = preferencesToRules(summary.activePreferences);

    const element: EnhancedElement = {
      selector: 'button.primary',
      tagName: 'button',
      bounds: { x: 0, y: 0, width: 100, height: 40 },
      computedStyles: { 'background-color': '#3b82f6' },
      interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    };

    const context = {
      isMobile: false, viewportWidth: 1920, viewportHeight: 1080,
      url: 'http://localhost:3000', allElements: [element],
    };

    const violation = rules[0].check(element, context);
    expect(violation).toBeNull(); // No violation - matches
  });

  it('rule skips non-matching component type', async () => {
    await addPreference(testDir, {
      description: 'Buttons blue',
      category: 'color',
      componentType: 'button',
      property: 'background-color',
      value: 'blue',
    });

    const summary = await loadSummary(testDir);
    const rules = preferencesToRules(summary.activePreferences);

    const divElement: EnhancedElement = {
      selector: 'div.card',
      tagName: 'div',
      bounds: { x: 0, y: 0, width: 200, height: 100 },
      computedStyles: { 'background-color': 'red' },
      interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    };

    const context = {
      isMobile: false, viewportWidth: 1920, viewportHeight: 1080,
      url: 'http://localhost:3000', allElements: [divElement],
    };

    const violation = rules[0].check(divElement, context);
    expect(violation).toBeNull(); // Skipped - div != button
  });

  it('creates memory preset', async () => {
    await addPreference(testDir, {
      description: 'Test pref',
      category: 'color',
      property: 'color',
      value: 'blue',
    });

    const summary = await loadSummary(testDir);
    const preset = createMemoryPreset(summary.activePreferences);

    expect(preset.name).toBe('memory');
    expect(preset.rules).toHaveLength(1);
    expect(Object.keys(preset.defaults)).toHaveLength(1);
  });

  it('low confidence produces warn severity', async () => {
    await addPreference(testDir, {
      description: 'Low confidence pref',
      category: 'color',
      property: 'color',
      value: 'blue',
      confidence: 0.5,
    });

    const summary = await loadSummary(testDir);
    const rules = preferencesToRules(summary.activePreferences);
    expect(rules[0].defaultSeverity).toBe('warn');
  });
});

describe('Summarization and eviction', () => {
  it('rebuild creates archive of previous summary', async () => {
    // Create initial state
    await addPreference(testDir, {
      description: 'First',
      category: 'color',
      property: 'color',
      value: 'red',
    });

    // Rebuild again - should archive
    await rebuildSummary(testDir);

    const archiveDir = join(testDir, 'memory', 'archive');
    const { readdir } = await import('fs/promises');
    const archives = await readdir(archiveDir);
    expect(archives.length).toBeGreaterThanOrEqual(1);
  });

  it('summary stays compact with many preferences', async () => {
    // Add 60 preferences (max active is 50)
    for (let i = 0; i < 60; i++) {
      await addPreference(testDir, {
        description: `Pref ${i}`,
        category: 'color',
        property: 'color',
        value: `value-${i}`,
        confidence: i / 60, // Varying confidence
      });
    }

    const summary = await loadSummary(testDir);
    expect(summary.stats.totalPreferences).toBe(60);
    expect(summary.activePreferences.length).toBeLessThanOrEqual(50);
  });
});

describe('Formatting', () => {
  it('formats summary for CLI', async () => {
    await addPreference(testDir, {
      description: 'Buttons blue',
      category: 'color',
      property: 'background-color',
      value: 'blue',
    });

    const summary = await loadSummary(testDir);
    const output = formatMemorySummary(summary);

    expect(output).toContain('IBR Memory');
    expect(output).toContain('Preferences: 1');
    expect(output).toContain('Buttons blue');
  });

  it('formats preference detail', async () => {
    const pref = await addPreference(testDir, {
      description: 'Nav dark',
      category: 'navigation',
      property: 'background-color',
      value: '#1a1a1a',
      route: '/dashboard',
    });

    const output = formatPreference(pref);
    expect(output).toContain('Nav dark');
    expect(output).toContain('navigation');
    expect(output).toContain('/dashboard');
    expect(output).toContain('#1a1a1a');
  });
});

describe('Operator evaluation', () => {
  it('contains operator works', async () => {
    await addPreference(testDir, {
      description: 'Dark bg',
      category: 'color',
      property: 'background-color',
      operator: 'contains',
      value: 'rgb(0',
    });

    const summary = await loadSummary(testDir);
    const rules = preferencesToRules(summary.activePreferences);

    const element: EnhancedElement = {
      selector: 'div',
      tagName: 'div',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      computedStyles: { 'background-color': 'rgb(0, 0, 0)' },
      interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    };

    const context = {
      isMobile: false, viewportWidth: 1920, viewportHeight: 1080,
      url: 'http://localhost:3000', allElements: [element],
    };

    // Should pass - contains 'rgb(0'
    expect(rules[0].check(element, context)).toBeNull();
  });

  it('matches (regex) operator works', async () => {
    await addPreference(testDir, {
      description: 'Font size 14-16px',
      category: 'typography',
      property: 'font-size',
      operator: 'matches',
      value: '^1[4-6]px$',
    });

    const summary = await loadSummary(testDir);
    const rules = preferencesToRules(summary.activePreferences);

    const element: EnhancedElement = {
      selector: 'p',
      tagName: 'p',
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      computedStyles: { 'font-size': '15px' },
      interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
      a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    };

    const context = {
      isMobile: false, viewportWidth: 1920, viewportHeight: 1080,
      url: 'http://localhost:3000', allElements: [element],
    };

    expect(rules[0].check(element, context)).toBeNull(); // 15px matches

    // 20px should fail
    element.computedStyles = { 'font-size': '20px' };
    const violation = rules[0].check(element, context);
    expect(violation).not.toBeNull();
  });
});
