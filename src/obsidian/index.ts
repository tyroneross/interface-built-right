/**
 * Obsidian view harness — mount an Obsidian plugin view in a real browser so
 * IBR's standard scan can audit it with computed styles, real layout, touch
 * targets, contrast, and accessibility.
 *
 * Use this instead of `scan_static` for anything using CSS variables, grid or
 * flex, or pseudo-elements: the static scanner is a regex parser and resolves
 * none of them (`src/static/README.md`).
 */
export { buildObsidianStub, type ObsidianStubOptions } from './stub.js';
export { generateHarness, resolvePluginPaths, type HarnessInput } from './harness.js';
export { serveHarness, type HarnessServer } from './server.js';
export {
  scanObsidian,
  formatObsidianScanResult,
  deriveHarnessIssues,
  inferMobile,
  resolveObsidianViewport,
  type ObsidianScanOptions,
  type ObsidianScanResult,
} from './scan.js';
