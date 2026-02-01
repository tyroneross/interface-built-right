/**
 * Memory System - Persistent UI/UX preferences with eviction and summarization
 *
 * Follows the "Deep Agents" context management pattern:
 * - summary.json: Always-loaded compact file (< 2KB)
 * - preferences/: Full preference detail files
 * - learned/: Expectations extracted from approved sessions
 * - archive/: Previous summary snapshots (eviction)
 */

import { readFile, writeFile, mkdir, readdir, unlink, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import type {
  MemorySummary,
  Preference,
  PreferenceCategory,
  LearnedExpectation,
  ActivePreference,
  Observation,
  ExpectationOperator,
  MemorySource,
  Violation,
  EnhancedElement,
  Session,
} from './schemas.js';
import type { Rule, RuleContext, RulePreset } from './rules/engine.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MEMORY_DIR = 'memory';
const SUMMARY_FILE = 'summary.json';
const PREFERENCES_DIR = 'preferences';
const LEARNED_DIR = 'learned';
const ARCHIVE_DIR = 'archive';
const PREF_PREFIX = 'pref_';
const LEARN_PREFIX = 'learn_';
const MAX_ACTIVE_PREFERENCES = 50;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Ensure memory directory structure exists
 */
export async function initMemory(outputDir: string): Promise<void> {
  const memoryDir = join(outputDir, MEMORY_DIR);
  await mkdir(join(memoryDir, PREFERENCES_DIR), { recursive: true });
  await mkdir(join(memoryDir, LEARNED_DIR), { recursive: true });
  await mkdir(join(memoryDir, ARCHIVE_DIR), { recursive: true });
}

// ============================================================================
// SUMMARY (Always-loaded compact state)
// ============================================================================

function getMemoryPath(outputDir: string, ...segments: string[]): string {
  return join(outputDir, MEMORY_DIR, ...segments);
}

/**
 * Load the compact summary - the "working memory"
 */
export async function loadSummary(outputDir: string): Promise<MemorySummary> {
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);

  if (!existsSync(summaryPath)) {
    return createEmptySummary();
  }

  try {
    const content = await readFile(summaryPath, 'utf-8');
    return JSON.parse(content) as MemorySummary;
  } catch {
    return createEmptySummary();
  }
}

/**
 * Save the compact summary
 */
export async function saveSummary(outputDir: string, summary: MemorySummary): Promise<void> {
  await initMemory(outputDir);
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
}

function createEmptySummary(): MemorySummary {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    stats: {
      totalPreferences: 0,
      totalLearned: 0,
      byCategory: {},
      bySource: {},
    },
    activePreferences: [],
  };
}

// ============================================================================
// PREFERENCE CRUD
// ============================================================================

/**
 * Add a new UI/UX preference
 */
export async function addPreference(
  outputDir: string,
  input: {
    description: string;
    category: PreferenceCategory;
    source?: MemorySource;
    route?: string;
    componentType?: string;
    property: string;
    operator?: ExpectationOperator;
    value: string;
    confidence?: number;
    sessionIds?: string[];
  }
): Promise<Preference> {
  await initMemory(outputDir);

  const now = new Date().toISOString();
  const pref: Preference = {
    id: `${PREF_PREFIX}${nanoid(8)}`,
    description: input.description,
    category: input.category,
    source: input.source ?? 'user',
    route: input.route,
    componentType: input.componentType,
    expectation: {
      property: input.property,
      operator: input.operator ?? 'equals',
      value: input.value,
    },
    confidence: input.confidence ?? 1.0,
    createdAt: now,
    updatedAt: now,
    sessionIds: input.sessionIds,
  };

  // Write full preference file
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${pref.id}.json`);
  await writeFile(prefPath, JSON.stringify(pref, null, 2));

  // Rebuild summary
  await rebuildSummary(outputDir);

  return pref;
}

/**
 * Get full preference detail by ID
 */
export async function getPreference(outputDir: string, prefId: string): Promise<Preference | null> {
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${prefId}.json`);

  if (!existsSync(prefPath)) return null;

  try {
    const content = await readFile(prefPath, 'utf-8');
    return JSON.parse(content) as Preference;
  } catch {
    return null;
  }
}

/**
 * Remove a preference
 */
export async function removePreference(outputDir: string, prefId: string): Promise<boolean> {
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${prefId}.json`);

  if (!existsSync(prefPath)) return false;

  await unlink(prefPath);
  await rebuildSummary(outputDir);
  return true;
}

/**
 * List preferences with optional filter
 */
export async function listPreferences(
  outputDir: string,
  filter?: { category?: PreferenceCategory; route?: string; componentType?: string }
): Promise<Preference[]> {
  const prefsDir = getMemoryPath(outputDir, PREFERENCES_DIR);

  if (!existsSync(prefsDir)) return [];

  const files = await readdir(prefsDir);
  const prefs: Preference[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(join(prefsDir, file), 'utf-8');
      const pref = JSON.parse(content) as Preference;

      if (filter?.category && pref.category !== filter.category) continue;
      if (filter?.route && pref.route !== filter.route) continue;
      if (filter?.componentType && pref.componentType !== filter.componentType) continue;

      prefs.push(pref);
    } catch {
      // Skip malformed files
    }
  }

  return prefs.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// LEARNING FROM SESSIONS
// ============================================================================

/**
 * Extract and store expectations from an approved session
 */
export async function learnFromSession(
  outputDir: string,
  session: Session,
  observations: Observation[]
): Promise<LearnedExpectation> {
  await initMemory(outputDir);

  const route = new URL(session.url).pathname;
  const learned: LearnedExpectation = {
    id: `${LEARN_PREFIX}${nanoid(8)}`,
    sessionId: session.id,
    route,
    observations,
    approved: true,
    createdAt: new Date().toISOString(),
  };

  const learnPath = getMemoryPath(outputDir, LEARNED_DIR, `${learned.id}.json`);
  await writeFile(learnPath, JSON.stringify(learned, null, 2));

  return learned;
}

/**
 * List learned expectations
 */
export async function listLearned(outputDir: string): Promise<LearnedExpectation[]> {
  const learnedDir = getMemoryPath(outputDir, LEARNED_DIR);

  if (!existsSync(learnedDir)) return [];

  const files = await readdir(learnedDir);
  const items: LearnedExpectation[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(join(learnedDir, file), 'utf-8');
      items.push(JSON.parse(content) as LearnedExpectation);
    } catch {
      // Skip malformed
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Promote a learned expectation to a full preference
 */
export async function promoteToPreference(
  outputDir: string,
  learnedId: string
): Promise<Preference | null> {
  const learnedPath = getMemoryPath(outputDir, LEARNED_DIR, `${learnedId}.json`);

  if (!existsSync(learnedPath)) return null;

  const content = await readFile(learnedPath, 'utf-8');
  const learned = JSON.parse(content) as LearnedExpectation;

  if (learned.observations.length === 0) return null;

  // Promote first observation as the primary preference
  const obs = learned.observations[0];
  const pref = await addPreference(outputDir, {
    description: obs.description,
    category: obs.category,
    source: 'learned',
    route: learned.route,
    property: obs.property,
    value: obs.value,
    confidence: 0.8,
    sessionIds: [learned.sessionId],
  });

  return pref;
}

// ============================================================================
// SUMMARIZATION & EVICTION
// ============================================================================

/**
 * Rebuild summary from all preference files (summarization pattern)
 */
export async function rebuildSummary(outputDir: string): Promise<MemorySummary> {
  // Archive current summary (eviction pattern)
  await archiveSummary(outputDir);

  const prefs = await listPreferences(outputDir);
  const learned = await listLearned(outputDir);

  // Compute stats
  const byCategory: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const pref of prefs) {
    byCategory[pref.category] = (byCategory[pref.category] || 0) + 1;
    bySource[pref.source] = (bySource[pref.source] || 0) + 1;
  }

  // Build compact active preferences (only top N by confidence)
  const activePrefs = prefs
    .slice(0, MAX_ACTIVE_PREFERENCES)
    .map((pref): ActivePreference => ({
      id: pref.id,
      description: pref.description,
      category: pref.category,
      route: pref.route,
      componentType: pref.componentType,
      property: pref.expectation.property,
      operator: pref.expectation.operator,
      value: pref.expectation.value,
      confidence: pref.confidence,
    }));

  const summary: MemorySummary = {
    version: 1,
    updatedAt: new Date().toISOString(),
    stats: {
      totalPreferences: prefs.length,
      totalLearned: learned.length,
      byCategory,
      bySource,
    },
    activePreferences: activePrefs,
  };

  await saveSummary(outputDir, summary);
  return summary;
}

/**
 * Archive current summary before rebuilding (eviction pattern)
 */
export async function archiveSummary(outputDir: string): Promise<void> {
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);

  if (!existsSync(summaryPath)) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePath = getMemoryPath(outputDir, ARCHIVE_DIR, `summary_${timestamp}.json`);

  try {
    await copyFile(summaryPath, archivePath);
  } catch {
    // Non-critical if archive fails
  }
}

// ============================================================================
// QUERY
// ============================================================================

/**
 * Query memory for preferences matching criteria
 */
export async function queryMemory(
  outputDir: string,
  query: { route?: string; category?: string; componentType?: string }
): Promise<ActivePreference[]> {
  const summary = await loadSummary(outputDir);

  return summary.activePreferences.filter(pref => {
    if (query.route && pref.route && !query.route.includes(pref.route)) return false;
    if (query.category && pref.category !== query.category) return false;
    if (query.componentType && pref.componentType !== query.componentType) return false;
    return true;
  });
}

// ============================================================================
// RULES BRIDGE
// ============================================================================

/**
 * Evaluate an operator against actual and expected values
 */
function evaluateOperator(operator: ExpectationOperator, actual: string, expected: string): boolean {
  switch (operator) {
    case 'equals':
      return actual.toLowerCase() === expected.toLowerCase();
    case 'contains':
      return actual.toLowerCase().includes(expected.toLowerCase());
    case 'matches':
      try {
        return new RegExp(expected, 'i').test(actual);
      } catch {
        return false;
      }
    case 'gte':
      return parseFloat(actual) >= parseFloat(expected);
    case 'lte':
      return parseFloat(actual) <= parseFloat(expected);
    default:
      return false;
  }
}

/**
 * Convert memory preferences into Rule objects for the rules engine
 */
export function preferencesToRules(preferences: ActivePreference[]): Rule[] {
  return preferences.map((pref): Rule => ({
    id: `memory-${pref.id}`,
    name: `Memory: ${pref.description}`,
    description: `User preference: ${pref.description}`,
    defaultSeverity: pref.confidence >= 0.8 ? 'error' : 'warn',
    check: (element: EnhancedElement, context: RuleContext): Violation | null => {
      // Route scoping
      if (pref.route && !context.url.includes(pref.route)) return null;

      // Component type scoping
      if (pref.componentType) {
        const matchesTag = element.tagName.toLowerCase() === pref.componentType.toLowerCase();
        const matchesRole = element.a11y?.role?.toLowerCase() === pref.componentType.toLowerCase();
        if (!matchesTag && !matchesRole) return null;
      }

      // Property check against computed styles
      const styles = element.computedStyles;
      if (!styles) return null;

      const actual = styles[pref.property];
      if (!actual) return null;

      if (evaluateOperator(pref.operator, actual, pref.value)) return null;

      return {
        ruleId: `memory-${pref.id}`,
        ruleName: `Memory: ${pref.description}`,
        severity: pref.confidence >= 0.8 ? 'error' : 'warn',
        message: `Expected ${pref.property} to ${pref.operator} "${pref.value}", got "${actual}". (${pref.description})`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Update ${pref.property} to ${pref.value}`,
      };
    },
  }));
}

/**
 * Create a RulePreset from memory preferences
 */
export function createMemoryPreset(preferences: ActivePreference[]): RulePreset {
  const rules = preferencesToRules(preferences);
  const defaults: Record<string, 'warn' | 'error'> = {};

  for (const rule of rules) {
    defaults[rule.id] = rule.defaultSeverity;
  }

  return {
    name: 'memory',
    description: 'UI/UX preferences from IBR memory',
    rules,
    defaults,
  };
}

// ============================================================================
// FORMAT
// ============================================================================

/**
 * Format memory summary for CLI output
 */
export function formatMemorySummary(summary: MemorySummary): string {
  const lines: string[] = [];

  lines.push('IBR Memory');
  lines.push(`Updated: ${summary.updatedAt}`);
  lines.push('');
  lines.push(`Preferences: ${summary.stats.totalPreferences}`);
  lines.push(`Learned: ${summary.stats.totalLearned}`);

  if (Object.keys(summary.stats.byCategory).length > 0) {
    lines.push('');
    lines.push('By category:');
    for (const [cat, count] of Object.entries(summary.stats.byCategory)) {
      lines.push(`  ${cat}: ${count}`);
    }
  }

  if (summary.activePreferences.length > 0) {
    lines.push('');
    lines.push('Active preferences:');
    for (const pref of summary.activePreferences) {
      const scope = pref.route ? ` (${pref.route})` : ' (global)';
      const conf = pref.confidence < 1.0 ? ` [${Math.round(pref.confidence * 100)}%]` : '';
      lines.push(`  ${pref.id}: ${pref.description}${scope}${conf}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a single preference for display
 */
export function formatPreference(pref: Preference): string {
  const lines: string[] = [];

  lines.push(`ID: ${pref.id}`);
  lines.push(`Description: ${pref.description}`);
  lines.push(`Category: ${pref.category}`);
  lines.push(`Source: ${pref.source}`);
  lines.push(`Confidence: ${Math.round(pref.confidence * 100)}%`);
  lines.push(`Expectation: ${pref.expectation.property} ${pref.expectation.operator} "${pref.expectation.value}"`);

  if (pref.route) lines.push(`Route: ${pref.route}`);
  if (pref.componentType) lines.push(`Component: ${pref.componentType}`);
  if (pref.sessionIds?.length) lines.push(`Sessions: ${pref.sessionIds.join(', ')}`);

  lines.push(`Created: ${pref.createdAt}`);
  lines.push(`Updated: ${pref.updatedAt}`);

  return lines.join('\n');
}
