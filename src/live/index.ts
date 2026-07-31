/**
 * Live-pane auditing: attach to an ALREADY-RUNNING browser or Electron app
 * (Obsidian, VS Code, any Chromium target with a debugging port) and measure a
 * CSS selector's elements against the real, fully-cascaded computed styles.
 *
 * Use this instead of `scan_obsidian` when the question is "what does the app
 * actually render right now" — for example when a plugin rule may be losing the
 * cascade to the host app's own stylesheet. The harness path in `src/obsidian/`
 * inlines the plugin into a synthetic page with a stubbed API and cannot see
 * the host cascade at all.
 *
 * Everything here is read-only against the target page: no target creation, no
 * navigation, no reload, no style injection. The single opt-in exception is
 * `measureLive({ emulateWidth })`, which forces a viewport width for one
 * measurement and restores it in a `finally` — see `measure.ts`'s header.
 */

export {
  attachToLiveTarget,
  listLiveTargets,
  resolveLiveWsEndpoint,
  selectTarget,
  toLiveTarget,
  LiveAttachError,
  DEFAULT_CDP_PROBE_TIMEOUT_MS,
  type LiveAttachment,
  type LiveAttachOptions,
  type LiveTarget,
} from './attach.js';

export {
  measureLive,
  buildMeasureExpression,
  buildDeviceMetricsOverride,
  finalizeMeasurements,
  withWidthOverride,
  type MetricsOverrideHost,
  type LiveBounds,
  type LiveBoxModel,
  type LiveColor,
  type LiveElementMeasurement,
  type LiveLayout,
  type LiveMeasureOptions,
  type LiveMeasureResult,
  type LiveTypography,
  type RawLiveElement,
  type RawLivePayload,
} from './measure.js';

export { formatLiveMeasureResult, formatLiveTargets } from './format.js';

export {
  aaThreshold,
  compositeOver,
  contrastRatio,
  formatRgba,
  isLargeText,
  isOpaque,
  parseCssColor,
  parseFontWeight,
  parsePx,
  relativeLuminance,
  resolveEffectiveBackground,
  type Rgba,
} from './color.js';
