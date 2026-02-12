import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import {
  loadCompactContext,
  saveCompactContext,
  updateCompactContext,
  compactContext,
  setActiveRoute,
  addKnownIssue,
  isCompactContextOversize,
} from './compact.js';
import { recordDecision } from '../decision-tracker.js';
import type { CompactContext } from './types.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'ibr-compact-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('loadCompactContext', () => {
  it('returns default context when none exists', async () => {
    const ctx = await loadCompactContext(testDir);
    expect(ctx.version).toBe(1);
    expect(ctx.decisions_summary).toEqual([]);
    expect(ctx.current_ui_state.pending_verifications).toBe(0);
    expect(ctx.current_ui_state.known_issues).toEqual([]);
  });

  it('uses provided session ID', async () => {
    const ctx = await loadCompactContext(testDir, 'my-session');
    expect(ctx.session_id).toBe('my-session');
  });

  it('loads existing context from disk', async () => {
    const original: CompactContext = {
      version: 1,
      session_id: 'test-session',
      updated_at: new Date().toISOString(),
      active_route: '/dashboard',
      decisions_summary: [
        {
          route: '/dashboard',
          latest_change: 'Changed header',
          decision_count: 3,
          full_log_ref: '.ibr/context/decisions/dashboard.jsonl',
        },
      ],
      current_ui_state: {
        pending_verifications: 1,
        known_issues: ['Layout shift on mobile'],
      },
      preferences_active: 5,
    };

    await saveCompactContext(testDir, original);
    const loaded = await loadCompactContext(testDir);

    expect(loaded.session_id).toBe('test-session');
    expect(loaded.active_route).toBe('/dashboard');
    expect(loaded.decisions_summary).toHaveLength(1);
    expect(loaded.decisions_summary[0].decision_count).toBe(3);
    expect(loaded.current_ui_state.known_issues).toContain('Layout shift on mobile');
  });
});

describe('saveCompactContext', () => {
  it('creates context directory and file', async () => {
    const ctx: CompactContext = {
      version: 1,
      session_id: 'save-test',
      updated_at: new Date().toISOString(),
      decisions_summary: [],
      current_ui_state: {
        pending_verifications: 0,
        known_issues: [],
      },
      preferences_active: 0,
    };

    await saveCompactContext(testDir, ctx);
    expect(existsSync(join(testDir, 'context', 'compact.json'))).toBe(true);
  });

  it('overwrites existing compact context', async () => {
    const ctx1: CompactContext = {
      version: 1,
      session_id: 'first',
      updated_at: new Date().toISOString(),
      decisions_summary: [],
      current_ui_state: { pending_verifications: 0, known_issues: [] },
      preferences_active: 0,
    };

    const ctx2: CompactContext = {
      ...ctx1,
      session_id: 'second',
    };

    await saveCompactContext(testDir, ctx1);
    await saveCompactContext(testDir, ctx2);

    const loaded = await loadCompactContext(testDir);
    expect(loaded.session_id).toBe('second');
  });
});

describe('updateCompactContext', () => {
  it('builds summary from decision logs', async () => {
    // Record some decisions
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'Changed header bg',
      files_changed: ['header.tsx'],
    });
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'layout_change',
      description: 'Reorganized sidebar',
      component: 'Sidebar',
      files_changed: ['sidebar.tsx'],
    });
    await recordDecision(testDir, {
      route: '/settings',
      type: 'color_change',
      description: 'Updated accent color',
      files_changed: ['settings.tsx'],
    });

    const ctx = await updateCompactContext(testDir, 'test-session');

    expect(ctx.session_id).toBe('test-session');
    expect(ctx.decisions_summary.length).toBeGreaterThanOrEqual(2);

    // Check that routes are covered
    const routes = ctx.decisions_summary.map(s => s.route);
    expect(routes).toContain('/dashboard');
    expect(routes).toContain('/settings');

    // Check decision counts
    const dashboardSummaries = ctx.decisions_summary.filter(s => s.route === '/dashboard');
    const totalDashboardDecisions = dashboardSummaries.reduce((sum, s) => sum + s.decision_count, 0);
    expect(totalDashboardDecisions).toBe(2);
  });

  it('saves updated context to disk', async () => {
    await recordDecision(testDir, {
      route: '/page',
      type: 'content_change',
      description: 'Updated title',
      files_changed: [],
    });

    await updateCompactContext(testDir);
    expect(existsSync(join(testDir, 'context', 'compact.json'))).toBe(true);
  });

  it('returns empty summary when no decisions', async () => {
    const ctx = await updateCompactContext(testDir);
    expect(ctx.decisions_summary).toEqual([]);
  });
});

describe('compactContext', () => {
  it('archives current context and resets', async () => {
    // Set up some context
    await recordDecision(testDir, {
      route: '/dashboard',
      type: 'css_change',
      description: 'A change',
      files_changed: [],
    });
    await updateCompactContext(testDir, 'old-session');

    // Compact it
    const result = await compactContext(testDir, { reason: 'session_ending' });

    expect(result.archived_to).toContain('compact_');
    expect(result.decisions_compacted).toBeGreaterThanOrEqual(1);
    expect(existsSync(result.archived_to)).toBe(true);

    // Verify archive contains the old data
    const archived = JSON.parse(await readFile(result.archived_to, 'utf-8'));
    expect(archived.session_id).toBe('old-session');
  });

  it('creates archive directory', async () => {
    await updateCompactContext(testDir, 'test');
    await compactContext(testDir, { reason: 'manual' });
    expect(existsSync(join(testDir, 'context', 'archive'))).toBe(true);
  });
});

describe('setActiveRoute', () => {
  it('updates the active route', async () => {
    const ctx = await setActiveRoute(testDir, '/dashboard');
    expect(ctx.active_route).toBe('/dashboard');
  });

  it('persists to disk', async () => {
    await setActiveRoute(testDir, '/settings');
    const loaded = await loadCompactContext(testDir);
    expect(loaded.active_route).toBe('/settings');
  });
});

describe('addKnownIssue', () => {
  it('appends an issue', async () => {
    await addKnownIssue(testDir, 'Layout broken on mobile');
    const ctx = await loadCompactContext(testDir);
    expect(ctx.current_ui_state.known_issues).toContain('Layout broken on mobile');
  });

  it('accumulates multiple issues', async () => {
    await addKnownIssue(testDir, 'Issue 1');
    await addKnownIssue(testDir, 'Issue 2');
    const ctx = await loadCompactContext(testDir);
    expect(ctx.current_ui_state.known_issues).toHaveLength(2);
  });
});

describe('isCompactContextOversize', () => {
  it('returns false when no context exists', async () => {
    const oversize = await isCompactContextOversize(testDir);
    expect(oversize).toBe(false);
  });

  it('returns false for small context', async () => {
    await updateCompactContext(testDir);
    const oversize = await isCompactContextOversize(testDir);
    expect(oversize).toBe(false);
  });

  it('returns true for large context', async () => {
    // Create a context with many entries to exceed 4KB
    for (let i = 0; i < 100; i++) {
      await recordDecision(testDir, {
        route: `/route-${i}`,
        type: 'css_change',
        description: `Long description for route ${i} that adds some meaningful content to push the size up: ${'x'.repeat(20)}`,
        files_changed: [`src/components/Component${i}.tsx`],
      });
    }

    await updateCompactContext(testDir);
    const oversize = await isCompactContextOversize(testDir);
    expect(oversize).toBe(true);
  });
});

describe('compact context size target', () => {
  it('stays under 4KB for typical workload (10 routes)', async () => {
    // Simulate a typical session: 10 routes, 2-3 decisions each
    const routes = ['/dashboard', '/settings', '/profile', '/login', '/signup',
      '/products', '/cart', '/checkout', '/orders', '/help'];

    for (const route of routes) {
      for (let i = 0; i < 3; i++) {
        await recordDecision(testDir, {
          route,
          type: 'css_change',
          description: `Updated styling for ${route} component ${i}`,
          files_changed: [`src/pages${route}.tsx`],
        });
      }
    }

    await updateCompactContext(testDir);
    const oversize = await isCompactContextOversize(testDir);
    expect(oversize).toBe(false);
  });
});
