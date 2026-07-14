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

// ---------------------------------------------------------------------------
// Source-level guards on src/bin/ibr.ts (unimportable: program.parse() runs at
// module top level — same pattern as the mcp/tools.test.ts parity gates).
// ---------------------------------------------------------------------------
describe('ibr.ts CLI wiring guards', () => {
  const src = readFileSync(join(__dirname, 'ibr.ts'), 'utf8');

  it('the -t option declares no inline commander default (root cause of the clobber)', () => {
    const optionLine = src.match(/\.option\(\s*'-t, --threshold[^)]*\)/);
    expect(optionLine, 'the -t, --threshold option must exist').not.toBeNull();
    // A third argument to .option() is a commander default — it makes the flag
    // value always-present and indistinguishable from an explicit -t 1.0.
    expect(optionLine![0]).not.toMatch(/,\s*'[\d.]+'\s*\)$/);
  });

  it('createIBR merges via mergeCliConfig (the tested helper), not an inline spread', () => {
    expect(src).toMatch(/mergeCliConfig\(config, options\)/);
    // The buggy truthy form must not reappear anywhere in the CLI.
    expect(src).not.toMatch(/options\.threshold\s*\?\s*\{/);
  });
});
