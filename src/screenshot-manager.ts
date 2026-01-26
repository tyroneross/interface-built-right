/**
 * Screenshot Manager
 *
 * Handles screenshot storage, cleanup, and metadata management.
 * Prevents disk bloat with configurable retention policies.
 */

import type { Page } from 'playwright';
import { writeFile, readFile, readdir, stat, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, dirname } from 'path';

/**
 * Configuration for screenshot retention
 */
export interface ScreenshotConfig {
  /** Days before auto-cleanup (default: 7) */
  maxAgeDays: number;
  /** Max total storage in bytes (default: 500MB) */
  maxSizeBytes: number;
  /** Retention policy: age, size, or both */
  retentionPolicy: 'age' | 'size' | 'both';
}

/**
 * Information about a single screenshot
 */
export interface ScreenshotInfo {
  /** File path */
  path: string;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Age in milliseconds */
  ageMs: number;
  /** Associated session ID */
  sessionId?: string;
  /** Step name if from search flow */
  step?: string;
}

/**
 * Screenshot metadata for UI display
 */
export interface ScreenshotMetadata {
  path: string;
  name: string;
  size: number;
  createdAt: string;
  width?: number;
  height?: number;
  sessionId?: string;
  step?: string;
  query?: string;
  userIntent?: string;
}

/**
 * Report from cleanup operation
 */
export interface CleanupReport {
  /** Total files scanned */
  scanned: number;
  /** Files deleted */
  deleted: number;
  /** Bytes freed */
  bytesFreed: number;
  /** Files kept */
  kept: number;
  /** Errors encountered */
  errors: string[];
  /** Dry run mode */
  dryRun: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ScreenshotConfig = {
  maxAgeDays: 7,
  maxSizeBytes: 500 * 1024 * 1024, // 500MB
  retentionPolicy: 'both',
};

/**
 * Screenshot Manager class
 *
 * Manages screenshot capture, storage, and cleanup for UI testing.
 */
export class ScreenshotManager {
  private outputDir: string;
  private config: ScreenshotConfig;

  constructor(outputDir: string, config: Partial<ScreenshotConfig> = {}) {
    this.outputDir = outputDir;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Capture a screenshot from a Playwright page
   */
  async capture(
    page: Page,
    name: string,
    options: {
      sessionId?: string;
      fullPage?: boolean;
      selector?: string;
    } = {}
  ): Promise<string> {
    const { sessionId, fullPage = false, selector } = options;

    // Determine output path
    let outputPath: string;
    if (sessionId) {
      const sessionDir = join(this.outputDir, 'sessions', sessionId);
      await mkdir(sessionDir, { recursive: true });
      outputPath = join(sessionDir, `${name}.png`);
    } else {
      await mkdir(this.outputDir, { recursive: true });
      outputPath = join(this.outputDir, `${name}.png`);
    }

    // Disable animations
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    // Capture screenshot
    if (selector) {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot({ path: outputPath, type: 'png' });
    } else {
      await page.screenshot({
        path: outputPath,
        fullPage,
        type: 'png',
      });
    }

    return outputPath;
  }

  /**
   * List all screenshots for a session
   */
  async list(sessionId: string): Promise<ScreenshotInfo[]> {
    const sessionDir = join(this.outputDir, 'sessions', sessionId);
    if (!existsSync(sessionDir)) {
      return [];
    }

    const screenshots: ScreenshotInfo[] = [];
    await this.scanDirectory(sessionDir, sessionId, screenshots);

    // Sort by creation time, newest first
    screenshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return screenshots;
  }

  /**
   * List all screenshots across all sessions
   */
  async listAll(): Promise<ScreenshotInfo[]> {
    const sessionsDir = join(this.outputDir, 'sessions');
    if (!existsSync(sessionsDir)) {
      return [];
    }

    const screenshots: ScreenshotInfo[] = [];
    const sessions = await readdir(sessionsDir);

    for (const sessionId of sessions) {
      const sessionDir = join(sessionsDir, sessionId);
      const stats = await stat(sessionDir);
      if (stats.isDirectory()) {
        await this.scanDirectory(sessionDir, sessionId, screenshots);
      }
    }

    // Sort by creation time, newest first
    screenshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return screenshots;
  }

  /**
   * Scan a directory for PNG files
   */
  private async scanDirectory(
    dir: string,
    sessionId: string,
    results: ScreenshotInfo[]
  ): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories (e.g., search-xxx directories)
        await this.scanDirectory(fullPath, sessionId, results);
      } else if (entry.name.endsWith('.png')) {
        const stats = await stat(fullPath);
        const now = Date.now();

        // Parse step name from filename (e.g., "01-before.png" -> "before")
        const stepMatch = entry.name.match(/^\d+-(.+)\.png$/);
        const step = stepMatch ? stepMatch[1] : undefined;

        results.push({
          path: fullPath,
          name: entry.name,
          size: stats.size,
          createdAt: stats.birthtime,
          ageMs: now - stats.birthtime.getTime(),
          sessionId,
          step,
        });
      }
    }
  }

  /**
   * Get metadata for a specific screenshot
   */
  async getMetadata(path: string): Promise<ScreenshotMetadata | null> {
    if (!existsSync(path)) {
      return null;
    }

    const stats = await stat(path);
    const name = basename(path);
    const dir = dirname(path);

    // Try to parse step from filename
    const stepMatch = name.match(/^\d+-(.+)\.png$/);
    const step = stepMatch ? stepMatch[1] : undefined;

    // Try to get session ID from path
    const sessionMatch = dir.match(/sessions[/\\]([^/\\]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : undefined;

    // Try to load associated results.json for query/intent
    let query: string | undefined;
    let userIntent: string | undefined;

    const resultsPath = join(dir, 'results.json');
    if (existsSync(resultsPath)) {
      try {
        const resultsContent = await readFile(resultsPath, 'utf-8');
        const results = JSON.parse(resultsContent);
        query = results.query;
        userIntent = results.userIntent;
      } catch {
        // Ignore parse errors
      }
    }

    return {
      path,
      name,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
      sessionId,
      step,
      query,
      userIntent,
    };
  }

  /**
   * Cleanup old screenshots based on retention policy
   */
  async cleanup(options: { dryRun?: boolean } = {}): Promise<CleanupReport> {
    const { dryRun = false } = options;
    const report: CleanupReport = {
      scanned: 0,
      deleted: 0,
      bytesFreed: 0,
      kept: 0,
      errors: [],
      dryRun,
    };

    // Get all screenshots
    const screenshots = await this.listAll();
    report.scanned = screenshots.length;

    if (screenshots.length === 0) {
      return report;
    }

    const toDelete: ScreenshotInfo[] = [];
    const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1000;

    // Determine which files to delete based on policy
    if (this.config.retentionPolicy === 'age' || this.config.retentionPolicy === 'both') {
      // Delete files older than maxAge
      for (const shot of screenshots) {
        if (shot.ageMs > maxAgeMs && !toDelete.includes(shot)) {
          toDelete.push(shot);
        }
      }
    }

    if (this.config.retentionPolicy === 'size' || this.config.retentionPolicy === 'both') {
      // Calculate total size
      let totalSize = screenshots.reduce((sum, s) => sum + s.size, 0);

      // Delete oldest files until under limit
      // Sort by age (oldest first) for deletion
      const sortedByAge = [...screenshots].sort((a, b) => b.ageMs - a.ageMs);

      for (const shot of sortedByAge) {
        if (totalSize <= this.config.maxSizeBytes) break;
        if (!toDelete.includes(shot)) {
          toDelete.push(shot);
          totalSize -= shot.size;
        }
      }
    }

    // Delete files
    for (const shot of toDelete) {
      try {
        if (!dryRun) {
          await unlink(shot.path);
        }
        report.deleted++;
        report.bytesFreed += shot.size;
      } catch (error) {
        report.errors.push(`Failed to delete ${shot.path}: ${error}`);
      }
    }

    report.kept = report.scanned - report.deleted;
    return report;
  }

  /**
   * Get total storage used by screenshots
   */
  async getStorageUsage(): Promise<{
    totalBytes: number;
    fileCount: number;
    oldestFile?: Date;
    newestFile?: Date;
  }> {
    const screenshots = await this.listAll();

    if (screenshots.length === 0) {
      return { totalBytes: 0, fileCount: 0 };
    }

    const totalBytes = screenshots.reduce((sum, s) => sum + s.size, 0);
    const sorted = [...screenshots].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      totalBytes,
      fileCount: screenshots.length,
      oldestFile: sorted[0].createdAt,
      newestFile: sorted[sorted.length - 1].createdAt,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ScreenshotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Save configuration to file
   */
  async saveConfig(): Promise<void> {
    const configPath = join(this.outputDir, 'screenshot-config.json');
    await writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<void> {
    const configPath = join(this.outputDir, 'screenshot-config.json');
    if (existsSync(configPath)) {
      try {
        const content = await readFile(configPath, 'utf-8');
        const loaded = JSON.parse(content);
        this.config = { ...DEFAULT_CONFIG, ...loaded };
      } catch {
        // Use default config on error
      }
    }
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration to human-readable string
 */
export function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}
