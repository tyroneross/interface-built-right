import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { nanoid } from 'nanoid';
import {
  CompactContextSchema,
  type CompactContext,
  type CompactionRequest,
  type CompactionResult,
  type DecisionSummary,
} from './types.js';
import { queryDecisions, getTrackedRoutes } from '../decision-tracker.js';

const CONTEXT_DIR = 'context';
const COMPACT_FILE = 'compact.json';
const ARCHIVE_DIR = 'archive';

/**
 * Get path to compact context file
 */
function getCompactPath(outputDir: string): string {
  return join(outputDir, CONTEXT_DIR, COMPACT_FILE);
}

/**
 * Get path to archive directory
 */
function getArchiveDir(outputDir: string): string {
  return join(outputDir, CONTEXT_DIR, ARCHIVE_DIR);
}

/**
 * Load the current compact context, or create a default one
 */
export async function loadCompactContext(
  outputDir: string,
  sessionId?: string
): Promise<CompactContext> {
  const compactPath = getCompactPath(outputDir);

  if (existsSync(compactPath)) {
    const content = await readFile(compactPath, 'utf-8');
    return CompactContextSchema.parse(JSON.parse(content));
  }

  // Return empty default
  return {
    version: 1,
    session_id: sessionId || `ctx_${nanoid(8)}`,
    updated_at: new Date().toISOString(),
    active_route: undefined,
    decisions_summary: [],
    current_ui_state: {
      last_snapshot_ref: undefined,
      pending_verifications: 0,
      known_issues: [],
    },
    preferences_active: 0,
  };
}

/**
 * Save compact context to disk
 */
export async function saveCompactContext(
  outputDir: string,
  context: CompactContext
): Promise<void> {
  const contextDir = join(outputDir, CONTEXT_DIR);
  await mkdir(contextDir, { recursive: true });

  const compactPath = getCompactPath(outputDir);
  await writeFile(compactPath, JSON.stringify(context, null, 2));
}

/**
 * Update compact context with latest decisions from logs
 * Rebuilds the decisions_summary from the JSONL decision logs
 */
export async function updateCompactContext(
  outputDir: string,
  sessionId?: string
): Promise<CompactContext> {
  const current = await loadCompactContext(outputDir, sessionId);
  const routes = await getTrackedRoutes(outputDir);

  const summaries: DecisionSummary[] = [];

  for (const route of routes) {
    const decisions = await queryDecisions(outputDir, { route, limit: 100 });

    if (decisions.length === 0) continue;

    // Group by component
    const byComponent = new Map<string, typeof decisions>();
    for (const d of decisions) {
      const key = d.component || '_page';
      if (!byComponent.has(key)) {
        byComponent.set(key, []);
      }
      byComponent.get(key)!.push(d);
    }

    for (const [component, componentDecisions] of byComponent) {
      const latest = componentDecisions[0]; // Already sorted newest first
      const routeFilename = route
        .replace(/^\/+/, '')
        .replace(/\//g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        || '_root';

      summaries.push({
        route,
        component: component === '_page' ? undefined : component,
        latest_change: latest.description,
        decision_count: componentDecisions.length,
        full_log_ref: `.ibr/context/decisions/${routeFilename}.jsonl`,
      });
    }
  }

  const updated: CompactContext = {
    ...current,
    session_id: sessionId || current.session_id,
    updated_at: new Date().toISOString(),
    decisions_summary: summaries,
  };

  await saveCompactContext(outputDir, updated);
  return updated;
}

/**
 * Compact and archive current context
 */
export async function compactContext(
  outputDir: string,
  request: CompactionRequest
): Promise<CompactionResult> {
  const current = await loadCompactContext(outputDir);
  const archiveDir = getArchiveDir(outputDir);
  await mkdir(archiveDir, { recursive: true });

  // Archive current compact context
  const archiveFilename = `compact_${Date.now()}.json`;
  const archivePath = join(archiveDir, archiveFilename);
  await writeFile(archivePath, JSON.stringify(current, null, 2));

  // Count decisions being compacted
  const decisionsCompacted = current.decisions_summary.reduce(
    (sum, s) => sum + s.decision_count,
    0
  );

  // Rebuild compact context (preserving route summaries when preserve list is provided)
  const hasPreserves = (request.preserve_decisions || []).length > 0;
  const preserved = hasPreserves ? current.decisions_summary : [];

  const newContext: CompactContext = {
    version: 1,
    session_id: current.session_id,
    updated_at: new Date().toISOString(),
    active_route: current.active_route,
    decisions_summary: preserved,
    current_ui_state: {
      last_snapshot_ref: current.current_ui_state.last_snapshot_ref,
      pending_verifications: 0,
      known_issues: [],
    },
    preferences_active: current.preferences_active,
  };

  await saveCompactContext(outputDir, newContext);

  return {
    compact_context: newContext,
    archived_to: archivePath,
    decisions_compacted: decisionsCompacted,
    decisions_preserved: preserved.length,
  };
}

/**
 * Set the active route being worked on
 */
export async function setActiveRoute(
  outputDir: string,
  route: string
): Promise<CompactContext> {
  const current = await loadCompactContext(outputDir);
  const updated: CompactContext = {
    ...current,
    active_route: route,
    updated_at: new Date().toISOString(),
  };
  await saveCompactContext(outputDir, updated);
  return updated;
}

/**
 * Add a known issue to the UI state
 */
export async function addKnownIssue(
  outputDir: string,
  issue: string
): Promise<CompactContext> {
  const current = await loadCompactContext(outputDir);
  const issues = [...current.current_ui_state.known_issues, issue];
  const updated: CompactContext = {
    ...current,
    current_ui_state: {
      ...current.current_ui_state,
      known_issues: issues,
    },
    updated_at: new Date().toISOString(),
  };
  await saveCompactContext(outputDir, updated);
  return updated;
}

/**
 * Check if compact context exceeds the 4KB target
 */
export async function isCompactContextOversize(
  outputDir: string
): Promise<boolean> {
  const compactPath = getCompactPath(outputDir);
  if (!existsSync(compactPath)) return false;

  const content = await readFile(compactPath, 'utf-8');
  return Buffer.byteLength(content, 'utf-8') > 4096;
}
