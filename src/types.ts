import type {
  Config,
  Session,
  ComparisonResult,
  ComparisonReport,
  Viewport,
  Analysis,
} from './schemas.js';

/**
 * Options for starting a visual session
 */
export interface StartSessionOptions {
  name?: string;
  viewport?: Viewport;
  fullPage?: boolean;
  /** CSS selector to capture specific element instead of full page */
  selector?: string;
  /** CSS selector to wait for before capturing screenshot */
  waitFor?: string;
}

/**
 * Result from starting a session
 */
export interface StartSessionResult {
  sessionId: string;
  baseline: string;
  session: Session;
}

/**
 * Options for capturing a screenshot
 */
export interface CaptureOptions {
  url: string;
  outputPath: string;
  viewport?: Viewport;
  fullPage?: boolean;
  waitForNetworkIdle?: boolean;
  timeout?: number;
  /** CSS selector to capture specific element instead of full page */
  selector?: string;
  /** CSS selector to wait for before capturing screenshot */
  waitFor?: string;
}

/**
 * Options for comparing images
 */
export interface CompareOptions {
  baselinePath: string;
  currentPath: string;
  diffPath: string;
  threshold?: number;
}

/**
 * Session file paths
 */
export interface SessionPaths {
  root: string;
  sessionJson: string;
  baseline: string;
  current: string;
  diff: string;
}

/**
 * CLI output format
 */
export type OutputFormat = 'json' | 'text' | 'minimal';

/**
 * Session list item for display
 */
export interface SessionListItem {
  id: string;
  name: string;
  url: string;
  status: string;
  createdAt: string;
  viewport: string;
}

/**
 * Clean options
 */
export interface CleanOptions {
  olderThan?: string; // e.g., '7d', '24h'
  keepLast?: number;
  dryRun?: boolean;
}

/**
 * Serve options
 */
export interface ServeOptions {
  port?: number;
  open?: boolean;
}

/**
 * Authentication options for capture
 */
export interface AuthOptions {
  storageStatePath?: string;
}

/**
 * Login options
 */
export interface LoginOptions {
  url: string;
  outputDir: string;
  timeout?: number;
}

// Re-export schema types for convenience
export type {
  Config,
  Session,
  ComparisonResult,
  ComparisonReport,
  Viewport,
  Analysis,
};
