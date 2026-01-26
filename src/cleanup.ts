import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { listSessions, deleteSession } from './session.js';
import type { Session } from './schemas.js';

/**
 * Retention policy configuration
 * Add to .ibrrc.json to enable auto-cleanup
 */
export interface RetentionConfig {
  /** Maximum number of sessions to keep (default: no limit) */
  maxSessions?: number;
  /** Maximum age of sessions in days (default: no limit) */
  maxAgeDays?: number;
  /** Keep sessions that have failed comparisons (default: true) */
  keepFailed?: boolean;
  /** Enable automatic cleanup on session creation (default: false) */
  autoClean?: boolean;
}

/**
 * Default retention configuration
 */
export const DEFAULT_RETENTION: RetentionConfig = {
  maxSessions: undefined,
  maxAgeDays: undefined,
  keepFailed: true,
  autoClean: false,
};

/**
 * Result of retention policy enforcement
 */
export interface RetentionResult {
  /** Sessions that were deleted */
  deleted: string[];
  /** Sessions that were kept */
  kept: string[];
  /** Sessions kept because they failed (if keepFailed is true) */
  keptFailed: string[];
  /** Total sessions before cleanup */
  totalBefore: number;
  /** Total sessions after cleanup */
  totalAfter: number;
}

/**
 * Load retention config from .ibrrc.json
 */
export async function loadRetentionConfig(outputDir: string): Promise<RetentionConfig> {
  const configPath = join(outputDir, '..', '.ibrrc.json');

  try {
    await access(configPath);
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return {
      ...DEFAULT_RETENTION,
      ...config.retention,
    };
  } catch {
    return DEFAULT_RETENTION;
  }
}

/**
 * Check if a session should be kept due to failed status
 */
function isFailedSession(session: Session): boolean {
  return session.analysis?.verdict === 'LAYOUT_BROKEN' ||
         session.analysis?.verdict === 'UNEXPECTED_CHANGE';
}

/**
 * Enforce retention policy on sessions
 *
 * @example
 * ```typescript
 * // Enforce with config from .ibrrc.json
 * const result = await enforceRetentionPolicy('./.ibr');
 * console.log(`Deleted ${result.deleted.length} sessions`);
 *
 * // Enforce with explicit config
 * const result = await enforceRetentionPolicy('./.ibr', {
 *   maxSessions: 20,
 *   maxAgeDays: 7,
 *   keepFailed: true
 * });
 * ```
 */
export async function enforceRetentionPolicy(
  outputDir: string,
  config?: RetentionConfig
): Promise<RetentionResult> {
  // Load config if not provided
  const retentionConfig = config || await loadRetentionConfig(outputDir);

  // If no retention limits set, nothing to do
  if (!retentionConfig.maxSessions && !retentionConfig.maxAgeDays) {
    const sessions = await listSessions(outputDir);
    return {
      deleted: [],
      kept: sessions.map(s => s.id),
      keptFailed: [],
      totalBefore: sessions.length,
      totalAfter: sessions.length,
    };
  }

  // Get all sessions sorted by creation date (newest first)
  const sessions = await listSessions(outputDir);
  const totalBefore = sessions.length;

  const deleted: string[] = [];
  const kept: string[] = [];
  const keptFailed: string[] = [];

  // Calculate cutoff time if maxAgeDays is set
  const cutoffTime = retentionConfig.maxAgeDays
    ? Date.now() - (retentionConfig.maxAgeDays * 24 * 60 * 60 * 1000)
    : 0;

  // Track how many non-failed sessions we've kept
  let keptCount = 0;

  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const isTooOld = retentionConfig.maxAgeDays && sessionTime < cutoffTime;
    const isOverLimit = retentionConfig.maxSessions && keptCount >= retentionConfig.maxSessions;
    const isFailed = isFailedSession(session);

    // Keep failed sessions if configured
    if (isFailed && retentionConfig.keepFailed) {
      kept.push(session.id);
      keptFailed.push(session.id);
      continue;
    }

    // Check if session should be deleted
    if (isTooOld || isOverLimit) {
      await deleteSession(outputDir, session.id);
      deleted.push(session.id);
    } else {
      kept.push(session.id);
      keptCount++;
    }
  }

  return {
    deleted,
    kept,
    keptFailed,
    totalBefore,
    totalAfter: kept.length,
  };
}

/**
 * Run auto-cleanup if enabled in config
 * Call this after creating new sessions
 */
export async function maybeAutoClean(outputDir: string): Promise<RetentionResult | null> {
  const config = await loadRetentionConfig(outputDir);

  if (!config.autoClean) {
    return null;
  }

  return enforceRetentionPolicy(outputDir, config);
}

/**
 * Get retention status summary
 */
export async function getRetentionStatus(outputDir: string): Promise<{
  config: RetentionConfig;
  currentSessions: number;
  oldestSession: Date | null;
  newestSession: Date | null;
  wouldDelete: number;
}> {
  const config = await loadRetentionConfig(outputDir);
  const sessions = await listSessions(outputDir);

  // Calculate how many would be deleted
  let wouldDelete = 0;
  const cutoffTime = config.maxAgeDays
    ? Date.now() - (config.maxAgeDays * 24 * 60 * 60 * 1000)
    : 0;

  let keptCount = 0;
  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const isTooOld = config.maxAgeDays && sessionTime < cutoffTime;
    const isOverLimit = config.maxSessions && keptCount >= config.maxSessions;
    const isFailed = isFailedSession(session);

    if (isFailed && config.keepFailed) {
      continue;
    }

    if (isTooOld || isOverLimit) {
      wouldDelete++;
    } else {
      keptCount++;
    }
  }

  return {
    config,
    currentSessions: sessions.length,
    oldestSession: sessions.length > 0
      ? new Date(sessions[sessions.length - 1].createdAt)
      : null,
    newestSession: sessions.length > 0
      ? new Date(sessions[0].createdAt)
      : null,
    wouldDelete,
  };
}

/**
 * Format retention status for display
 */
export function formatRetentionStatus(status: Awaited<ReturnType<typeof getRetentionStatus>>): string {
  const lines: string[] = [];

  lines.push('Session Retention Status');
  lines.push('========================');
  lines.push('');
  lines.push(`Current sessions: ${status.currentSessions}`);

  if (status.oldestSession) {
    lines.push(`Oldest: ${status.oldestSession.toISOString()}`);
  }
  if (status.newestSession) {
    lines.push(`Newest: ${status.newestSession.toISOString()}`);
  }

  lines.push('');
  lines.push('Retention Policy:');

  if (status.config.maxSessions) {
    lines.push(`  Max sessions: ${status.config.maxSessions}`);
  } else {
    lines.push('  Max sessions: unlimited');
  }

  if (status.config.maxAgeDays) {
    lines.push(`  Max age: ${status.config.maxAgeDays} days`);
  } else {
    lines.push('  Max age: unlimited');
  }

  lines.push(`  Keep failed: ${status.config.keepFailed ? 'yes' : 'no'}`);
  lines.push(`  Auto-clean: ${status.config.autoClean ? 'enabled' : 'disabled'}`);

  if (status.wouldDelete > 0) {
    lines.push('');
    lines.push(`⚠️  ${status.wouldDelete} session(s) would be deleted if cleanup runs`);
  } else {
    lines.push('');
    lines.push('✓ All sessions within retention policy');
  }

  return lines.join('\n');
}
