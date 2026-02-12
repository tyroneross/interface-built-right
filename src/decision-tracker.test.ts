import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import {
  recordDecision,
  getDecisionsByRoute,
  queryDecisions,
  getDecision,
  getTrackedRoutes,
  getDecisionStats,
  getDecisionsSize,
} from './decision-tracker.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'ibr-decision-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('recordDecision', () => {
  it('creates a decision with correct fields', async () => {
    const decision = await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'Changed header background to blue',
      files_changed: ['src/components/Header.tsx'],
    });

    expect(decision.id).toMatch(/^dec_/);
    expect(decision.route).toBe('/dashboard');
    expect(decision.type).toBe('css_change');
    expect(decision.description).toBe('Changed header background to blue');
    expect(decision.files_changed).toEqual(['src/components/Header.tsx']);
    expect(decision.timestamp).toBeTruthy();
  });

  it('stores optional fields when provided', async () => {
    const decision = await recordDecision(testDir, {
      route: '/dashboard',
      type: 'layout_change',
      description: 'Reorganized sidebar layout',
      component: 'Sidebar',
      rationale: 'Better use of vertical space per user request',
      before: { css: { display: 'block' } },
      after: { css: { display: 'flex' } },
      files_changed: ['src/components/Sidebar.tsx'],
      session_id: 'session_123',
    });

    expect(decision.component).toBe('Sidebar');
    expect(decision.rationale).toBe('Better use of vertical space per user request');
    expect(decision.before?.css?.display).toBe('block');
    expect(decision.after?.css?.display).toBe('flex');
    expect(decision.session_id).toBe('session_123');
  });

  it('creates context directories automatically', async () => {
    await recordDecision(testDir, {
      route: '/page',
      type: 'content_change',
      description: 'Updated page title',
      files_changed: ['src/pages/Page.tsx'],
    });

    expect(existsSync(join(testDir, 'context', 'decisions'))).toBe(true);
  });

  it('appends to JSONL file for same route', async () => {
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'First change',
      files_changed: ['a.tsx'],
    });

    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'layout_change',
      description: 'Second change',
      files_changed: ['b.tsx'],
    });

    const logPath = join(testDir, 'context', 'decisions', 'dashboard.jsonl');
    const content = await readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('creates separate files for different routes', async () => {
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'Dashboard change',
      files_changed: ['a.tsx'],
    });

    await recordDecision(testDir, {
      route: '/settings',
      type: 'css_change',
      description: 'Settings change',
      files_changed: ['b.tsx'],
    });

    expect(existsSync(join(testDir, 'context', 'decisions', 'dashboard.jsonl'))).toBe(true);
    expect(existsSync(join(testDir, 'context', 'decisions', 'settings.jsonl'))).toBe(true);
  });

  it('handles root route', async () => {
    await recordDecision(testDir, {
      route: '/',
      type: 'css_change',
      description: 'Root page change',
      files_changed: ['a.tsx'],
    });

    expect(existsSync(join(testDir, 'context', 'decisions', '_root.jsonl'))).toBe(true);
  });

  it('generates unique IDs', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const d = await recordDecision(testDir, {
        route: '/test',
        type: 'css_change',
        description: `Change ${i}`,
        files_changed: [],
      });
      ids.add(d.id);
    }
    expect(ids.size).toBe(20);
  });
});

describe('getDecisionsByRoute', () => {
  it('returns decisions for a specific route', async () => {
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'Change 1',
      files_changed: [],
    });
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'layout_change',
      description: 'Change 2',
      files_changed: [],
    });

    const decisions = await getDecisionsByRoute(testDir, '/dashboard');
    expect(decisions).toHaveLength(2);
    expect(decisions[0].description).toBe('Change 1');
    expect(decisions[1].description).toBe('Change 2');
  });

  it('returns empty array for nonexistent route', async () => {
    const decisions = await getDecisionsByRoute(testDir, '/nonexistent');
    expect(decisions).toEqual([]);
  });

  it('returns empty array when no context directory exists', async () => {
    const decisions = await getDecisionsByRoute(testDir, '/any');
    expect(decisions).toEqual([]);
  });
});

describe('queryDecisions', () => {
  beforeEach(async () => {
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'Dashboard CSS',
      component: 'Header',
      files_changed: ['header.tsx'],
    });
    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'layout_change',
      description: 'Dashboard layout',
      component: 'Sidebar',
      files_changed: ['sidebar.tsx'],
    });
    await new Promise(r => setTimeout(r, 10));
    await recordDecision(testDir, {
      route: '/settings',
      type: 'color_change',
      description: 'Settings color',
      files_changed: ['settings.tsx'],
    });
  });

  it('returns all decisions when no filters', async () => {
    const results = await queryDecisions(testDir);
    expect(results).toHaveLength(3);
  });

  it('returns decisions sorted newest first', async () => {
    const results = await queryDecisions(testDir);
    expect(results[0].description).toBe('Settings color');
    expect(results[2].description).toBe('Dashboard CSS');
  });

  it('filters by route', async () => {
    const results = await queryDecisions(testDir, { route: '/dashboard' });
    expect(results).toHaveLength(2);
    expect(results.every(d => d.route === '/dashboard')).toBe(true);
  });

  it('filters by component', async () => {
    const results = await queryDecisions(testDir, { component: 'Header' });
    expect(results).toHaveLength(1);
    expect(results[0].component).toBe('Header');
  });

  it('filters by type', async () => {
    const results = await queryDecisions(testDir, { type: 'css_change' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('css_change');
  });

  it('filters by since timestamp', async () => {
    const all = await queryDecisions(testDir);
    // Use the middle decision's timestamp as the cutoff
    const since = all[1].timestamp;
    const results = await queryDecisions(testDir, { since });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('applies limit', async () => {
    const results = await queryDecisions(testDir, { limit: 1 });
    expect(results).toHaveLength(1);
  });

  it('returns empty for nonexistent context directory', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'ibr-empty-'));
    const results = await queryDecisions(emptyDir);
    expect(results).toEqual([]);
    await rm(emptyDir, { recursive: true, force: true });
  });
});

describe('getDecision', () => {
  it('finds a decision by ID', async () => {
    const created = await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'Find me',
      files_changed: [],
    });

    const found = await getDecision(testDir, created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.description).toBe('Find me');
  });

  it('returns null for nonexistent ID', async () => {
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'Exists',
      files_changed: [],
    });

    const found = await getDecision(testDir, 'dec_nonexistent');
    expect(found).toBeNull();
  });

  it('returns null when no context directory', async () => {
    const found = await getDecision(testDir, 'dec_any');
    expect(found).toBeNull();
  });
});

describe('getTrackedRoutes', () => {
  it('lists routes with decision logs', async () => {
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'A',
      files_changed: [],
    });
    await recordDecision(testDir, {
      route: '/settings',
      type: 'css_change',
      description: 'B',
      files_changed: [],
    });

    const routes = await getTrackedRoutes(testDir);
    expect(routes).toHaveLength(2);
    expect(routes).toContain('/dashboard');
    expect(routes).toContain('/settings');
  });

  it('returns empty array when no context', async () => {
    const routes = await getTrackedRoutes(testDir);
    expect(routes).toEqual([]);
  });
});

describe('getDecisionStats', () => {
  it('returns correct counts', async () => {
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'A',
      files_changed: [],
    });
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'layout_change',
      description: 'B',
      files_changed: [],
    });
    await recordDecision(testDir, {
      route: '/settings',
      type: 'css_change',
      description: 'C',
      files_changed: [],
    });

    const stats = await getDecisionStats(testDir);
    expect(stats.total).toBe(3);
    expect(stats.byRoute['/dashboard']).toBe(2);
    expect(stats.byRoute['/settings']).toBe(1);
    expect(stats.byType['css_change']).toBe(2);
    expect(stats.byType['layout_change']).toBe(1);
  });
});

describe('getDecisionsSize', () => {
  it('returns 0 when no decisions', async () => {
    const size = await getDecisionsSize(testDir);
    expect(size).toBe(0);
  });

  it('returns non-zero after recording decisions', async () => {
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'Some change',
      files_changed: ['file.tsx'],
    });

    const size = await getDecisionsSize(testDir);
    expect(size).toBeGreaterThan(0);
  });
});
