import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  mergeCliConfig,
  normalizeFileConfig,
  resolveViewportName,
  VIEWPORT_NAMES,
} from './cli-config.js';
import { VIEWPORTS } from '../schemas.js';

// ---------------------------------------------------------------------------
// Regression: a commander default for -t ('1.0') was always present on
// program.opts(), so the truthy merge overwrote .ibrrc.json's threshold on
// every invocation — the config file could never win. The flag must only be
// applied when actually provided.
// ---------------------------------------------------------------------------
describe('mergeCliConfig threshold precedence', () => {
  it('.ibrrc.json threshold survives when -t is not passed', () => {
    const merged = mergeCliConfig({ threshold: 5 }, {});
    expect(merged.threshold).toBe(5);
  });

  it('an explicit -t wins over the config file', () => {
    const merged = mergeCliConfig({ threshold: 5 }, { threshold: '2.5' });
    expect(merged.threshold).toBe(2.5);
  });

  it('an explicit -t 0 (exact-match tolerance) is applied, not dropped', () => {
    const merged = mergeCliConfig({ threshold: 5 }, { threshold: '0' });
    expect(merged.threshold).toBe(0);
  });

  it('neither flag nor config leaves threshold unset (schema default applies downstream)', () => {
    const merged = mergeCliConfig({}, {});
    expect(merged.threshold).toBeUndefined();
  });

  it('other provided flags still override the config file', () => {
    const merged = mergeCliConfig(
      { baseUrl: 'http://config', fullPage: true },
      { baseUrl: 'http://flag', viewport: 'mobile', fullPage: false }
    );
    expect(merged.baseUrl).toBe('http://flag');
    expect(merged.viewport).toEqual(VIEWPORTS.mobile);
    expect(merged.fullPage).toBe(false);
  });
});

// Same clobber class as -t: -o and -v also declared inline commander defaults,
// so config-file outputDir/viewport were overwritten on every run even when
// the flags were never passed. Defaults live downstream (ConfigSchema:
// outputDir './.ibr', viewport desktop) or at the consumer fallbacks.
describe('mergeCliConfig outputDir and viewport precedence', () => {
  it('.ibrrc.json outputDir survives when -o is not passed', () => {
    const merged = mergeCliConfig({ outputDir: './custom-ibr' }, {});
    expect(merged.outputDir).toBe('./custom-ibr');
  });

  it('an explicit -o wins over the config file', () => {
    const merged = mergeCliConfig({ outputDir: './custom-ibr' }, { output: './flag-dir' });
    expect(merged.outputDir).toBe('./flag-dir');
  });

  it('.ibrrc.json viewport survives when -v is not passed', () => {
    const merged = mergeCliConfig({ viewport: VIEWPORTS.tablet }, {});
    expect(merged.viewport).toEqual(VIEWPORTS.tablet);
  });

  it('an explicit -v wins over the config file', () => {
    const merged = mergeCliConfig({ viewport: VIEWPORTS.tablet }, { viewport: 'mobile' });
    expect(merged.viewport).toEqual(VIEWPORTS.mobile);
  });

  it('neither flag nor config leaves both unset (ConfigSchema defaults apply downstream)', () => {
    const merged = mergeCliConfig({}, {});
    expect(merged.outputDir).toBeUndefined();
    expect(merged.viewport).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Source-level guards on src/bin/ibr.ts (unimportable: program.parse() runs at
// module top level — same pattern as the mcp/tools.test.ts parity gates).
// ---------------------------------------------------------------------------
describe('ibr.ts CLI wiring guards', () => {
  const src = readFileSync(join(__dirname, 'ibr.ts'), 'utf8');

  it.each(['-t, --threshold', '-o, --output', '-v, --viewport'])(
    'the global %s option declares no inline commander default (root cause of the config clobber)',
    (flag) => {
      const line = src.split('\n').find((l) => l.includes(`'${flag}`));
      expect(line, `the ${flag} option must exist`).toBeDefined();
      // A third argument to .option() is a commander default — it makes the
      // flag value always-present on program.opts(), indistinguishable from an
      // explicitly passed flag, so it clobbers .ibrrc.json in the merge.
      // Require the exact two-argument form: .option('<flags>', '<description>')
      // — [^'] cannot span a quote, so a third string argument fails the match.
      expect(line).toMatch(/\.option\('[^']+',\s*'[^']*'\)$/);
    }
  );

  it('createIBR merges via mergeCliConfig (the tested helper), not an inline spread', () => {
    expect(src).toMatch(/mergeCliConfig\(config, options\)/);
    // The buggy truthy form must not reappear anywhere in the CLI.
    expect(src).not.toMatch(/options\.threshold\s*\?\s*\{/);
  });

  it('no handler reads the global -o flag as .outputDir (it lands on program.opts().output)', () => {
    // Regression: two audit-path sites read globalOpts.outputDir, which is
    // never set — commander maps '-o, --output' to opts().output — so they
    // silently ignored an explicit -o and always fell back to '.ibr'.
    // Subcommand-local `options.outputDir` stays legal: it is the camelCase of
    // a locally declared '--output-dir <dir>' (test/iterate commands).
    expect(src).not.toMatch(/globalOpts\.outputDir\b/);
    expect(src).not.toMatch(/program\.opts\(\)\.outputDir\b/);
  });

  it('the audit visual/semantic baseline lookups honor -o via globalOpts.output', () => {
    // Scope to the audit command body so the count cannot be satisfied by the
    // many other handlers using the same idiom.
    const start = src.indexOf(".command('audit [url]')");
    expect(start, 'audit command must exist').toBeGreaterThanOrEqual(0);
    const end = src.indexOf('.command(', start + 1);
    expect(end, 'a command must follow audit').toBeGreaterThan(start);
    const auditBody = src.slice(start, end);
    // Both audit-path outputDir resolutions (visual + semantic) must read the
    // real global flag with the standard fallback — the wiring -o flows through.
    const hits = auditBody.match(/const outputDir = globalOpts\.output \|\| '\.\/\.ibr';/g) ?? [];
    expect(hits.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Regression: the config file documents `"viewport": "desktop"` (a preset
// NAME) and `ibr init` writes exactly that, but ConfigSchema.viewport is a
// Viewport OBJECT. loadConfig() handed the raw JSON straight to the schema, so
// every command routed through createIBR died on the tool's own documented
// config: `expected object, received string`. Passing `-v desktop` masked it,
// because the CLI merge replaced the string with the object.
// ---------------------------------------------------------------------------
describe('normalizeFileConfig — the documented .ibrrc.json shape', () => {
  it('resolves a viewport preset NAME to the Viewport object the schema wants', () => {
    expect(normalizeFileConfig({ viewport: 'desktop' }).viewport).toEqual(VIEWPORTS.desktop);
    expect(normalizeFileConfig({ viewport: 'mobile' }).viewport).toEqual(VIEWPORTS.mobile);
  });

  it('leaves an already-object viewport alone (hand-written configs keep working)', () => {
    expect(normalizeFileConfig({ viewport: VIEWPORTS.tablet }).viewport).toEqual(VIEWPORTS.tablet);
  });

  it('resolves preset names inside the `viewports` array too', () => {
    expect(normalizeFileConfig({ viewports: ['mobile', VIEWPORTS.desktop] }).viewports).toEqual([
      VIEWPORTS.mobile,
      VIEWPORTS.desktop,
    ]);
  });

  it('names the valid presets when the config file has a typo', () => {
    expect(() => normalizeFileConfig({ viewport: 'desktopp' })).toThrow(/Unknown viewport "desktopp"/);
    expect(() => normalizeFileConfig({ viewport: 'desktopp' })).toThrow(/desktop, desktop-lg/);
  });

  it('passes every other key through untouched', () => {
    const raw = { baseUrl: 'http://localhost:3000', outputDir: './.ibr', threshold: 1, fullPage: true };
    expect(normalizeFileConfig(raw)).toEqual(raw);
  });

  it('tolerates a non-object config body instead of crashing', () => {
    expect(normalizeFileConfig(null)).toEqual({});
    expect(normalizeFileConfig('desktop')).toEqual({});
    expect(normalizeFileConfig([1, 2])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Sibling silent-failure: `VIEWPORTS[name as keyof typeof VIEWPORTS]` yields
// undefined for a typo, which spreads as "not provided", so ConfigSchema's
// .default(desktop) rendered `-v mobil` at 1920x1080. A wrong viewport is
// invisible in the output — every measurement is self-consistent, just taken
// at the wrong width.
// ---------------------------------------------------------------------------
describe('resolveViewportName', () => {
  it('resolves every documented preset name', () => {
    for (const name of VIEWPORT_NAMES) {
      expect(resolveViewportName(name).name).toBe(name);
    }
  });

  it('throws on a typo rather than silently falling back to desktop', () => {
    expect(() => resolveViewportName('mobil')).toThrow(/Unknown viewport "mobil"/);
  });

  it('an unknown -v is rejected by the merge, not silently downgraded', () => {
    expect(() => mergeCliConfig({ viewport: VIEWPORTS.tablet }, { viewport: 'mobil' })).toThrow(
      /Unknown viewport/,
    );
  });
});
