import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mergeCliConfig } from './cli-config.js';
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
});
