import { nanoid } from 'nanoid';
import { mkdir, readFile, writeFile, readdir, rm } from 'fs/promises';
import { join } from 'path';
import { SessionSchema, type Session, type Viewport, type ComparisonResult, type Analysis } from './schemas.js';
import type { SessionPaths, CleanOptions } from './types.js';

const SESSION_PREFIX = 'sess_';

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `${SESSION_PREFIX}${nanoid(10)}`;
}

/**
 * Get paths for a session
 */
export function getSessionPaths(outputDir: string, sessionId: string): SessionPaths {
  const root = join(outputDir, 'sessions', sessionId);
  return {
    root,
    sessionJson: join(root, 'session.json'),
    baseline: join(root, 'baseline.png'),
    current: join(root, 'current.png'),
    diff: join(root, 'diff.png'),
  };
}

/**
 * Create a new session
 */
export async function createSession(
  outputDir: string,
  url: string,
  name: string,
  viewport: Viewport
): Promise<Session> {
  const sessionId = generateSessionId();
  const paths = getSessionPaths(outputDir, sessionId);
  const now = new Date().toISOString();

  const session: Session = {
    id: sessionId,
    name,
    url,
    viewport,
    status: 'baseline',
    createdAt: now,
    updatedAt: now,
  };

  // Create session directory
  await mkdir(paths.root, { recursive: true });

  // Write session file
  await writeFile(paths.sessionJson, JSON.stringify(session, null, 2));

  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(outputDir: string, sessionId: string): Promise<Session | null> {
  const paths = getSessionPaths(outputDir, sessionId);

  try {
    const content = await readFile(paths.sessionJson, 'utf-8');
    const data = JSON.parse(content);
    return SessionSchema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Update a session
 */
export async function updateSession(
  outputDir: string,
  sessionId: string,
  updates: Partial<Omit<Session, 'id' | 'createdAt'>>
): Promise<Session> {
  const session = await getSession(outputDir, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const updated: Session = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const paths = getSessionPaths(outputDir, sessionId);
  await writeFile(paths.sessionJson, JSON.stringify(updated, null, 2));

  return updated;
}

/**
 * Mark session as compared with results
 */
export async function markSessionCompared(
  outputDir: string,
  sessionId: string,
  comparison: ComparisonResult,
  analysis: Analysis
): Promise<Session> {
  return updateSession(outputDir, sessionId, {
    status: 'compared',
    comparison,
    analysis,
  });
}

/**
 * List all sessions
 */
export async function listSessions(outputDir: string): Promise<Session[]> {
  const sessionsDir = join(outputDir, 'sessions');

  try {
    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const sessions: Session[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(SESSION_PREFIX)) {
        const session = await getSession(outputDir, entry.name);
        if (session) {
          sessions.push(session);
        }
      }
    }

    // Sort by creation date, newest first
    return sessions.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * Get the most recent session
 */
export async function getMostRecentSession(outputDir: string): Promise<Session | null> {
  const sessions = await listSessions(outputDir);
  return sessions[0] || null;
}

/**
 * Delete a session
 */
export async function deleteSession(outputDir: string, sessionId: string): Promise<boolean> {
  const paths = getSessionPaths(outputDir, sessionId);

  try {
    await rm(paths.root, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(d|h|m|s)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '7d', '24h', '30m', '60s'`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    case 's': return value * 1000;
    default: return value * 1000;
  }
}

/**
 * Clean old sessions
 */
export async function cleanSessions(
  outputDir: string,
  options: CleanOptions = {}
): Promise<{ deleted: string[]; kept: string[] }> {
  const { olderThan, keepLast = 0, dryRun = false } = options;
  const sessions = await listSessions(outputDir);

  const deleted: string[] = [];
  const kept: string[] = [];

  // Sessions to keep based on keepLast
  const keepIds = new Set(sessions.slice(0, keepLast).map(s => s.id));

  // Calculate cutoff time if olderThan is specified
  const cutoffTime = olderThan
    ? Date.now() - parseDuration(olderThan)
    : 0;

  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const shouldDelete = !keepIds.has(session.id) &&
      (olderThan ? sessionTime < cutoffTime : true);

    if (shouldDelete && !keepIds.has(session.id)) {
      if (!dryRun) {
        await deleteSession(outputDir, session.id);
      }
      deleted.push(session.id);
    } else {
      kept.push(session.id);
    }
  }

  return { deleted, kept };
}
