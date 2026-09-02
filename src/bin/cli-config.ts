import { VIEWPORTS, type Config, type Viewport } from '../schemas.js';

/** Every viewport preset name accepted by `-v/--viewport` and by `.ibrrc.json`. */
export const VIEWPORT_NAMES = Object.keys(VIEWPORTS);

function isViewportName(name: string): name is keyof typeof VIEWPORTS {
  return Object.prototype.hasOwnProperty.call(VIEWPORTS, name);
}

/**
 * Resolve a viewport PRESET NAME to its Viewport object, or throw naming the
 * valid presets.
 *
 * Throwing is the point. The previous form was
 * `VIEWPORTS[name as keyof typeof VIEWPORTS]`, which yields `undefined` for an
 * unknown name; spread into the config that reads as "viewport not provided",
 * so `ConfigSchema`'s `.default(VIEWPORTS.desktop)` silently rendered a typo'd
 * `-v mobil` at 1920x1080 desktop. A wrong viewport is invisible in the output
 * — every measurement is internally consistent, just taken at the wrong width.
 */
export function resolveViewportName(name: string): Viewport {
  if (isViewportName(name)) return VIEWPORTS[name];
  throw new Error(
    `Unknown viewport "${name}". Available viewports: ${VIEWPORT_NAMES.join(', ')}`,
  );
}

/**
 * Normalize a raw parsed `.ibrrc.json` into the shape `ConfigSchema` accepts.
 *
 * The config file documents `viewport` as a preset NAME (`"viewport": "desktop"`
 * — README "Configuration", and the literal object `ibr init` writes), while
 * `ConfigSchema.viewport` is a Viewport OBJECT. Nothing bridged the two:
 * `loadConfig()` handed the raw JSON straight to `ConfigSchema.parse`, so every
 * command routed through `createIBR` died on its own documented config with a
 * raw Zod dump — `expected object, received string`. Passing `-v desktop`
 * masked it, because the CLI merge overwrote the string with the object.
 *
 * That made `ibr init && ibr start` — the documented first run — fail.
 *
 * Object form stays accepted so an existing hand-written config keeps working.
 */
export function normalizeFileConfig(raw: unknown): Partial<Config> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const config = { ...(raw as Record<string, unknown>) };

  if (typeof config.viewport === 'string') {
    config.viewport = resolveViewportName(config.viewport);
  }
  if (Array.isArray(config.viewports)) {
    config.viewports = config.viewports.map((v) =>
      typeof v === 'string' ? resolveViewportName(v) : v,
    );
  }

  return config as Partial<Config>;
}

/**
 * Merge global CLI options over a `.ibrrc.json` config. A CLI value is applied
 * only when the flag was actually provided — options with commander defaults
 * must NOT declare them inline (see the `-t, --threshold` regression: a
 * commander default of '1.0' is always present, so a truthy check here
 * silently overwrote the config file's threshold on every run). Defaults for
 * unset values belong downstream (ConfigSchema / verdict policy), not here.
 */
export function mergeCliConfig(
  config: Partial<Config>,
  options: Record<string, unknown>
): Partial<Config> {
  return {
    ...config,
    ...(options.baseUrl ? { baseUrl: String(options.baseUrl) } : {}),
    ...(options.output ? { outputDir: String(options.output) } : {}),
    ...(options.viewport ? { viewport: resolveViewportName(String(options.viewport)) } : {}),
    ...(options.threshold !== undefined ? { threshold: Number(options.threshold) } : {}),
    ...(options.fullPage !== undefined ? { fullPage: Boolean(options.fullPage) } : {}),
    ...(options.browserMode ? { browserMode: String(options.browserMode) as Config['browserMode'] } : {}),
    ...(options.cdpUrl ? { cdpUrl: String(options.cdpUrl) } : {}),
    ...(options.wsEndpoint ? { wsEndpoint: String(options.wsEndpoint) } : {}),
    ...(options.chromePath ? { chromePath: String(options.chromePath) } : {}),
  };
}
