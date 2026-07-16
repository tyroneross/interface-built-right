import { VIEWPORTS, type Config } from '../schemas.js';

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
    ...(options.viewport ? { viewport: VIEWPORTS[options.viewport as keyof typeof VIEWPORTS] } : {}),
    ...(options.threshold !== undefined ? { threshold: Number(options.threshold) } : {}),
    ...(options.fullPage !== undefined ? { fullPage: Boolean(options.fullPage) } : {}),
    ...(options.browserMode ? { browserMode: String(options.browserMode) as Config['browserMode'] } : {}),
    ...(options.cdpUrl ? { cdpUrl: String(options.cdpUrl) } : {}),
    ...(options.wsEndpoint ? { wsEndpoint: String(options.wsEndpoint) } : {}),
    ...(options.chromePath ? { chromePath: String(options.chromePath) } : {}),
  };
}
