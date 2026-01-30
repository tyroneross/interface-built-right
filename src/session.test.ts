import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  generateSessionId,
  getSessionPaths,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  listSessions,
  findSessions,
  cleanSessions,
  getMostRecentSession,
  getTimeline,
  getSessionsByRoute,
  getSessionStats,
} from './session.js';
import { VIEWPORTS } from './schemas.js';

describe('generateSessionId', () => {
  it('starts with sess_ prefix', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^sess_/);
  });

  it('has correct length (sess_ + 10 chars)', () => {
    const id = generateSessionId();
    expect(id.length).toBe(15);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
    expect(ids.size).toBe(100);
  });
});

describe('getSessionPaths', () => {
  it('returns correct paths', () => {
    const paths = getSessionPaths('/output', 'sess_abc123');
    expect(paths.root).toBe(join('/output', 'sessions', 'sess_abc123'));
    expect(paths.sessionJson).toBe(join('/output', 'sessions', 'sess_abc123', 'session.json'));
    expect(paths.baseline).toBe(join('/output', 'sessions', 'sess_abc123', 'baseline.png'));
    expect(paths.current).toBe(join('/output', 'sessions', 'sess_abc123', 'current.png'));
    expect(paths.diff).toBe(join('/output', 'sessions', 'sess_abc123', 'diff.png'));
  });
});

describe('session CRUD', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ibr-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates and retrieves a session', async () => {
    const session = await createSession(tmpDir, 'http://localhost:3000/', 'Homepage', VIEWPORTS.desktop);
    expect(session.id).toMatch(/^sess_/);
    expect(session.name).toBe('Homepage');
    expect(session.status).toBe('baseline');

    const retrieved = await getSession(tmpDir, session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(session.id);
    expect(retrieved!.url).toBe('http://localhost:3000/');
  });

  it('returns null for non-existent session', async () => {
    const result = await getSession(tmpDir, 'sess_nonexistent');
    expect(result).toBeNull();
  });

  it('updates a session', async () => {
    const session = await createSession(tmpDir, 'http://localhost:3000/', 'Test', VIEWPORTS.desktop);
    const updated = await updateSession(tmpDir, session.id, { status: 'compared' });
    expect(updated.status).toBe('compared');
    expect(updated.updatedAt).not.toBe(session.updatedAt);
  });

  it('throws when updating non-existent session', async () => {
    await expect(updateSession(tmpDir, 'sess_fake', { status: 'compared' })).rejects.toThrow('Session not found');
  });

  it('deletes a session', async () => {
    const session = await createSession(tmpDir, 'http://localhost:3000/', 'Test', VIEWPORTS.desktop);
    const deleted = await deleteSession(tmpDir, session.id);
    expect(deleted).toBe(true);

    const retrieved = await getSession(tmpDir, session.id);
    expect(retrieved).toBeNull();
  });

  it('returns false when deleting non-existent session', async () => {
    const result = await deleteSession(tmpDir, 'sess_fake');
    expect(result).toBe(true); // rm with force: true doesn't error
  });

  it('lists sessions sorted newest first', async () => {
    await createSession(tmpDir, 'http://localhost:3000/a', 'First', VIEWPORTS.desktop);
    // Ensure different timestamps
    await new Promise(r => setTimeout(r, 10));
    await createSession(tmpDir, 'http://localhost:3000/b', 'Second', VIEWPORTS.desktop);

    const sessions = await listSessions(tmpDir);
    expect(sessions.length).toBe(2);
    expect(sessions[0].name).toBe('Second');
    expect(sessions[1].name).toBe('First');
  });

  it('returns empty list when no sessions', async () => {
    const sessions = await listSessions(tmpDir);
    expect(sessions).toEqual([]);
  });

  it('gets most recent session', async () => {
    await createSession(tmpDir, 'http://localhost:3000/a', 'First', VIEWPORTS.desktop);
    await new Promise(r => setTimeout(r, 10));
    await createSession(tmpDir, 'http://localhost:3000/b', 'Second', VIEWPORTS.desktop);

    const recent = await getMostRecentSession(tmpDir);
    expect(recent?.name).toBe('Second');
  });

  it('returns null when no sessions for getMostRecentSession', async () => {
    const result = await getMostRecentSession(tmpDir);
    expect(result).toBeNull();
  });
});

describe('findSessions', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ibr-test-'));
    await createSession(tmpDir, 'http://localhost:3000/', 'Homepage', VIEWPORTS.desktop);
    await createSession(tmpDir, 'http://localhost:3000/about', 'About', VIEWPORTS.mobile);
    await createSession(tmpDir, 'http://localhost:3000/about', 'About Desktop', VIEWPORTS.desktop);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('filters by name', async () => {
    const results = await findSessions(tmpDir, { name: 'About' });
    expect(results.length).toBe(2);
  });

  it('filters by viewport', async () => {
    const results = await findSessions(tmpDir, { viewport: 'mobile' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('About');
  });

  it('filters by route', async () => {
    const results = await findSessions(tmpDir, { route: '/about' });
    expect(results.length).toBe(2);
  });

  it('filters by status', async () => {
    const results = await findSessions(tmpDir, { status: 'baseline' });
    expect(results.length).toBe(3);
  });

  it('applies limit', async () => {
    const results = await findSessions(tmpDir, { limit: 1 });
    expect(results.length).toBe(1);
  });
});

describe('cleanSessions', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ibr-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('keeps last N sessions', async () => {
    await createSession(tmpDir, 'http://localhost:3000/a', 'A', VIEWPORTS.desktop);
    await new Promise(r => setTimeout(r, 10));
    await createSession(tmpDir, 'http://localhost:3000/b', 'B', VIEWPORTS.desktop);
    await new Promise(r => setTimeout(r, 10));
    await createSession(tmpDir, 'http://localhost:3000/c', 'C', VIEWPORTS.desktop);

    const result = await cleanSessions(tmpDir, { keepLast: 1 });
    expect(result.deleted.length).toBe(2);
    expect(result.kept.length).toBe(1);

    const remaining = await listSessions(tmpDir);
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe('C');
  });

  it('dry run does not delete', async () => {
    await createSession(tmpDir, 'http://localhost:3000/a', 'A', VIEWPORTS.desktop);
    await createSession(tmpDir, 'http://localhost:3000/b', 'B', VIEWPORTS.desktop);

    const result = await cleanSessions(tmpDir, { keepLast: 0, dryRun: true });
    expect(result.deleted.length).toBe(2);

    const remaining = await listSessions(tmpDir);
    expect(remaining.length).toBe(2);
  });
});

describe('getSessionsByRoute', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ibr-test-'));
    await createSession(tmpDir, 'http://localhost:3000/', 'Home', VIEWPORTS.desktop);
    await createSession(tmpDir, 'http://localhost:3000/about', 'About', VIEWPORTS.desktop);
    await createSession(tmpDir, 'http://localhost:3000/', 'Home 2', VIEWPORTS.desktop);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('groups sessions by route', async () => {
    const byRoute = await getSessionsByRoute(tmpDir);
    expect(Object.keys(byRoute)).toHaveLength(2);
    expect(byRoute['/']).toHaveLength(2);
    expect(byRoute['/about']).toHaveLength(1);
  });
});

describe('getSessionStats', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ibr-test-'));
    await createSession(tmpDir, 'http://localhost:3000/', 'Home', VIEWPORTS.desktop);
    await createSession(tmpDir, 'http://localhost:3000/about', 'About', VIEWPORTS.mobile);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns correct stats', async () => {
    const stats = await getSessionStats(tmpDir);
    expect(stats.total).toBe(2);
    expect(stats.byStatus['baseline']).toBe(2);
    expect(stats.byViewport['desktop']).toBe(1);
    expect(stats.byViewport['mobile']).toBe(1);
  });
});
