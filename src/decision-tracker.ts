import { nanoid } from 'nanoid';
import { mkdir, readFile, appendFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  DecisionEntrySchema,
  type DecisionEntry,
  type DecisionType,
  type DecisionState,
} from './context/types.js';

const CONTEXT_DIR = 'context';
const DECISIONS_DIR = 'decisions';

/**
 * Options for recording a UI decision
 */
export interface RecordDecisionOptions {
  route: string;
  type: DecisionType;
  description: string;
  component?: string;
  rationale?: string;
  before?: DecisionState;
  after?: DecisionState;
  files_changed: string[];
  session_id?: string;
}

/**
 * Options for querying decisions
 */
export interface QueryDecisionsOptions {
  route?: string;
  component?: string;
  type?: DecisionType;
  since?: string; // ISO 8601 timestamp
  limit?: number;
}

/**
 * Get the decisions directory path
 */
function getDecisionsDir(outputDir: string): string {
  return join(outputDir, CONTEXT_DIR, DECISIONS_DIR);
}

/**
 * Sanitize a route path into a safe filename
 */
function routeToFilename(route: string): string {
  return route
    .replace(/^\/+/, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    || '_root';
}

/**
 * Get the JSONL file path for a route
 */
function getRouteLogPath(outputDir: string, route: string): string {
  const filename = `${routeToFilename(route)}.jsonl`;
  return join(getDecisionsDir(outputDir), filename);
}

/**
 * Ensure the context directories exist
 */
async function ensureContextDirs(outputDir: string): Promise<void> {
  await mkdir(getDecisionsDir(outputDir), { recursive: true });
}

/**
 * Record a UI decision to the JSONL log for its route
 */
export async function recordDecision(
  outputDir: string,
  options: RecordDecisionOptions
): Promise<DecisionEntry> {
  await ensureContextDirs(outputDir);

  const entry: DecisionEntry = {
    id: `dec_${nanoid(10)}`,
    timestamp: new Date().toISOString(),
    route: options.route,
    component: options.component,
    type: options.type,
    description: options.description,
    rationale: options.rationale,
    before: options.before,
    after: options.after,
    files_changed: options.files_changed,
    session_id: options.session_id,
  };

  // Validate the entry
  DecisionEntrySchema.parse(entry);

  // Append to route-specific JSONL file
  const logPath = getRouteLogPath(outputDir, options.route);
  await appendFile(logPath, JSON.stringify(entry) + '\n');

  return entry;
}

/**
 * Read all decisions from a route's JSONL log
 */
export async function getDecisionsByRoute(
  outputDir: string,
  route: string
): Promise<DecisionEntry[]> {
  const logPath = getRouteLogPath(outputDir, route);

  if (!existsSync(logPath)) {
    return [];
  }

  const content = await readFile(logPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  return lines.map(line => DecisionEntrySchema.parse(JSON.parse(line)));
}

/**
 * Query decisions across all routes with filtering
 */
export async function queryDecisions(
  outputDir: string,
  options: QueryDecisionsOptions = {}
): Promise<DecisionEntry[]> {
  const { route, component, type, since, limit = 50 } = options;

  let decisions: DecisionEntry[] = [];

  if (route) {
    // Query specific route
    decisions = await getDecisionsByRoute(outputDir, route);
  } else {
    // Query all routes
    const decisionsDir = getDecisionsDir(outputDir);
    if (!existsSync(decisionsDir)) {
      return [];
    }

    const files = await readdir(decisionsDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = join(decisionsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        decisions.push(DecisionEntrySchema.parse(JSON.parse(line)));
      }
    }
  }

  // Apply filters
  if (component) {
    decisions = decisions.filter(d => d.component === component);
  }
  if (type) {
    decisions = decisions.filter(d => d.type === type);
  }
  if (since) {
    const sinceTime = new Date(since).getTime();
    decisions = decisions.filter(d => new Date(d.timestamp).getTime() >= sinceTime);
  }

  // Sort by timestamp descending (newest first)
  decisions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return decisions.slice(0, limit);
}

/**
 * Get a single decision by ID (searches all route logs)
 */
export async function getDecision(
  outputDir: string,
  decisionId: string
): Promise<DecisionEntry | null> {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!existsSync(decisionsDir)) {
    return null;
  }

  const files = await readdir(decisionsDir);
  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;

    const filePath = join(decisionsDir, file);
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const entry = DecisionEntrySchema.parse(JSON.parse(line));
      if (entry.id === decisionId) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Get list of routes that have decision logs
 */
export async function getTrackedRoutes(outputDir: string): Promise<string[]> {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!existsSync(decisionsDir)) {
    return [];
  }

  const files = await readdir(decisionsDir);
  return files
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('.jsonl', '').replace(/_/g, '/').replace(/^\/?/, '/'));
}

/**
 * Get decision counts by route
 */
export async function getDecisionStats(outputDir: string): Promise<{
  total: number;
  byRoute: Record<string, number>;
  byType: Record<string, number>;
}> {
  const all = await queryDecisions(outputDir, { limit: 10000 });

  const byRoute: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const d of all) {
    byRoute[d.route] = (byRoute[d.route] || 0) + 1;
    byType[d.type] = (byType[d.type] || 0) + 1;
  }

  return { total: all.length, byRoute, byType };
}

/**
 * Get the size of the decisions directory in bytes
 */
export async function getDecisionsSize(outputDir: string): Promise<number> {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!existsSync(decisionsDir)) {
    return 0;
  }

  const files = await readdir(decisionsDir);
  let total = 0;

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;
    const s = await stat(join(decisionsDir, file));
    total += s.size;
  }

  return total;
}
