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
  deriveAppCssIssues,
  resolveHarnessAppCss,
  inferMobile,
  resolveObsidianViewport,
  type ObsidianScanOptions,
  type ObsidianScanResult,
} from './scan.js';
export {
  resolveObsidianAppCss,
  findObsidianAsar,
  obsidianAsarCandidates,
  readAsarEntry,
  readAsarHeader,
  appCssCacheDir,
  appCssCacheKey,
  APP_CSS_ENTRY,
  APP_CSS_ENV_VAR,
  type ResolveAppCssOptions,
  type ResolvedAppCss,
  type AsarHeader,
} from './app-css.js';
export {
  analyzeLayoutOverflow,
  buildLayoutOverflowProbe,
  attributeCulprit,
  LAYOUT_OVERFLOW_DEFAULTS,
  type LayoutOverflowFinding,
  type LayoutOverflowNode,
  type LayoutOverflowOptions,
  type LayoutOverflowKind,
  type LayoutOverflowCulprit,
  type LayoutOverflowProbeOptions,
} from './layout-overflow.js';
