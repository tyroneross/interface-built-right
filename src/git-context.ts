/**
 * Git repository context detection for organizing sessions by app and branch
 *
 * This module provides utilities to detect git repository information and combine it
 * with package.json metadata to create organized session storage paths.
 *
 * @example
 * ```typescript
 * const context = await getAppContext(process.cwd());
 * const sessionPath = getSessionBasePath('.ibr', context);
 * // Returns: .ibr/apps/my-app/main/sessions (if git context available)
 * //      or: .ibr/sessions (fallback for non-git projects)
 * ```
 */

import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { execSync } from 'child_process';

/**
 * Git repository context information
 */
export interface GitContext {
  /** Repository name (e.g., "interface-built-right") */
  repoName: string | null;
  /** Current branch name (e.g., "main", "feature-xyz") */
  branch: string | null;
  /** Remote name (e.g., "origin") */
  remote: string | null;
  /** Remote URL (e.g., "git@github.com:user/repo.git") */
  remoteUrl: string | null;
}

/**
 * Application context combining git and package.json info
 */
export interface AppContext extends GitContext {
  /** Application name from package.json */
  appName: string;
}

/**
 * Parse git config file to extract remote information
 */
async function parseGitConfig(configPath: string): Promise<{ remote: string | null; remoteUrl: string | null }> {
  try {
    const content = await readFile(configPath, 'utf-8');
    const lines = content.split('\n');

    let currentRemote: string | null = null;
    let remoteUrl: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match [remote "origin"] pattern
      const remoteMatch = trimmed.match(/^\[remote "(.+)"\]$/);
      if (remoteMatch) {
        currentRemote = remoteMatch[1];
        continue;
      }

      // Match url = ... pattern
      if (currentRemote && trimmed.startsWith('url = ')) {
        remoteUrl = trimmed.substring(6).trim();
        break; // Use first remote found (typically "origin")
      }
    }

    return { remote: currentRemote, remoteUrl };
  } catch {
    return { remote: null, remoteUrl: null };
  }
}

/**
 * Extract repository name from remote URL
 */
function extractRepoName(remoteUrl: string): string | null {
  try {
    // Handle SSH format: git@github.com:user/repo.git
    const sshMatch = remoteUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      const parts = sshMatch[1].split('/');
      return parts[parts.length - 1].replace(/\.git$/, '');
    }

    // Handle HTTPS format: https://github.com/user/repo.git
    const httpsMatch = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (httpsMatch) {
      return httpsMatch[1].replace(/\.git$/, '');
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get current git branch using git command
 */
function getCurrentBranch(dir: string): string | null {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return branch || null;
  } catch {
    return null;
  }
}

/**
 * Get git context from directory
 * Detects git repository information including repo name, branch, and remote
 */
export async function getGitContext(dir: string): Promise<GitContext> {
  const gitConfigPath = join(dir, '.git', 'config');

  // Parse git config for remote info
  const { remote, remoteUrl } = await parseGitConfig(gitConfigPath);

  // Extract repo name from remote URL
  const repoName = remoteUrl ? extractRepoName(remoteUrl) : null;

  // Get current branch
  const branch = getCurrentBranch(dir);

  return {
    repoName,
    branch,
    remote,
    remoteUrl,
  };
}

/**
 * Get app name from package.json
 * Falls back to directory name if package.json not found or has no name field
 */
export async function getAppName(dir: string): Promise<string> {
  try {
    const packageJsonPath = join(dir, 'package.json');
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    if (packageJson.name) {
      // Remove scope if present (e.g., "@tyroneross/package" -> "package")
      const name = packageJson.name;
      const scopeMatch = name.match(/^@[^/]+\/(.+)$/);
      return scopeMatch ? scopeMatch[1] : name;
    }
  } catch {
    // Fall through to directory name
  }

  // Fallback to directory name
  return basename(dir);
}

/**
 * Get full app context (git + package.json)
 * Combines git repository information with application name
 */
export async function getAppContext(dir: string): Promise<AppContext> {
  const [gitContext, appName] = await Promise.all([
    getGitContext(dir),
    getAppName(dir),
  ]);

  return {
    ...gitContext,
    appName,
  };
}

/**
 * Compute session base path from context
 * Returns organized path: {outputDir}/apps/{appName}/{branch}/sessions/
 * Falls back to: {outputDir}/sessions/ for backward compatibility
 */
export function getSessionBasePath(outputDir: string, context: AppContext): string {
  // If we have git context (repo name and branch), use organized structure
  if (context.repoName && context.branch) {
    return join(outputDir, 'apps', context.appName, context.branch, 'sessions');
  }

  // Fallback to flat structure for backward compatibility
  return join(outputDir, 'sessions');
}
