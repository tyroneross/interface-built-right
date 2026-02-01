/**
 * Context Loader - Discovers user design preferences from CLAUDE.md files
 *
 * IBR is context-aware, not standards-enforcing. It detects the user's
 * design framework from their CLAUDE.md and validates against THAT.
 *
 * Discovery priority (highest to lowest):
 * 1. Project .claude/CLAUDE.md
 * 2. Project root CLAUDE.md
 * 3. User ~/.claude/CLAUDE.md
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { parseDesignFramework, type DesignFramework } from './framework-parser.js';
import type { MemorySummary } from './schemas.js';

export interface UserContext {
  projectDir: string;
  framework?: DesignFramework;
  sources: ContextSource[];
  config: IBRConfig;
  memory?: MemorySummary;
}

export interface ContextSource {
  path: string;
  type: 'project-claude' | 'root-claude' | 'user-claude' | 'ibrrc';
  found: boolean;
  hasFramework: boolean;
}

export interface IBRConfig {
  baseUrl?: string;
  outputDir?: string;
  viewport?: string;
  threshold?: number;
  fullPage?: boolean;
}

/**
 * Discover user context from CLAUDE.md files and config
 */
export async function discoverUserContext(projectDir: string): Promise<UserContext> {
  const sources: ContextSource[] = [];
  let framework: DesignFramework | undefined;

  // Priority 1: Project .claude/CLAUDE.md
  const projectClaudePath = join(projectDir, '.claude', 'CLAUDE.md');
  const projectClaudeResult = await tryLoadFramework(projectClaudePath, 'project-claude');
  sources.push(projectClaudeResult.source);
  if (projectClaudeResult.framework && !framework) {
    framework = projectClaudeResult.framework;
  }

  // Priority 2: Project root CLAUDE.md
  const rootClaudePath = join(projectDir, 'CLAUDE.md');
  const rootClaudeResult = await tryLoadFramework(rootClaudePath, 'root-claude');
  sources.push(rootClaudeResult.source);
  if (rootClaudeResult.framework && !framework) {
    framework = rootClaudeResult.framework;
  }

  // Priority 3: User ~/.claude/CLAUDE.md
  const userClaudePath = join(homedir(), '.claude', 'CLAUDE.md');
  const userClaudeResult = await tryLoadFramework(userClaudePath, 'user-claude');
  sources.push(userClaudeResult.source);
  if (userClaudeResult.framework && !framework) {
    framework = userClaudeResult.framework;
  }

  // Load IBR config
  const config = await loadIBRConfig(projectDir);

  // Load memory if available
  let memory: MemorySummary | undefined;
  const outputDir = config.outputDir || './.ibr';
  const memoryPath = join(outputDir, 'memory', 'summary.json');
  if (existsSync(memoryPath)) {
    try {
      const memContent = await readFile(memoryPath, 'utf-8');
      memory = JSON.parse(memContent) as MemorySummary;
    } catch {
      // Memory unavailable - not an error
    }
  }

  return {
    projectDir,
    framework,
    sources,
    config,
    memory,
  };
}

/**
 * Try to load a design framework from a CLAUDE.md file
 */
async function tryLoadFramework(
  filePath: string,
  type: ContextSource['type']
): Promise<{ source: ContextSource; framework?: DesignFramework }> {
  const source: ContextSource = {
    path: filePath,
    type,
    found: false,
    hasFramework: false,
  };

  if (!existsSync(filePath)) {
    return { source };
  }

  source.found = true;

  try {
    const content = await readFile(filePath, 'utf-8');
    const framework = parseDesignFramework(content, filePath);

    if (framework) {
      source.hasFramework = true;
      return { source, framework };
    }
  } catch (error) {
    // File exists but couldn't parse - not an error, just no framework found
  }

  return { source };
}

/**
 * Load IBR configuration from .ibrrc.json
 */
async function loadIBRConfig(projectDir: string): Promise<IBRConfig> {
  const configPath = join(projectDir, '.ibrrc.json');

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Format context for display
 */
export function formatContextSummary(context: UserContext): string {
  const lines: string[] = [];

  if (context.framework) {
    lines.push(`Design Framework: ${context.framework.name}`);
    lines.push(`Source: ${context.framework.source}`);
    lines.push(`Principles: ${context.framework.principles.length}`);
  } else {
    lines.push('No design framework detected.');
    lines.push('');
    lines.push('To enable design validation, add your framework to CLAUDE.md.');
    lines.push('IBR will parse principles and generate validation rules automatically.');
  }

  if (context.memory && context.memory.stats.totalPreferences > 0) {
    lines.push('');
    lines.push(`Memory: ${context.memory.stats.totalPreferences} preferences, ${context.memory.stats.totalLearned} learned`);
  }

  lines.push('');
  lines.push('Context sources checked:');
  for (const source of context.sources) {
    const status = !source.found
      ? '(not found)'
      : source.hasFramework
        ? '(framework detected)'
        : '(no framework)';
    lines.push(`  ${source.type}: ${source.path} ${status}`);
  }

  return lines.join('\n');
}
