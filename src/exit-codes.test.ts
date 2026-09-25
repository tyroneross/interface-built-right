import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT_PASS, EXIT_ISSUES, EXIT_TOOL_ERROR } from './exit-codes.js';

describe('exit-code contract constants', () => {
  it('are the three distinct values 0, 1, 2', () => {
    expect(EXIT_PASS).toBe(0);
    expect(EXIT_ISSUES).toBe(1);
    expect(EXIT_TOOL_ERROR).toBe(2);
  });

  it('are pairwise distinct', () => {
    // A bug that aliased two of these would recreate the exact defect this
    // contract exists to fix (T-01): a crash indistinguishable from a
    // verdict.
    const values = new Set<number>([EXIT_PASS, EXIT_ISSUES, EXIT_TOOL_ERROR]);
    expect(values.size).toBe(3);
  });

  it('the CLI has no bare-numeral process.exit(N) left outside the two documented exceptions', () => {
    // Every exit site in src/bin/ibr.ts should resolve through one of the
    // three named constants above (or a variable/ternary built from them) —
    // not a bare numeral. The two documented exceptions keep their own,
    // older contracts on purpose (see src/exit-codes.ts):
    //   - `native:request-permission` exits 77 (sysexits.h EX_NOPERM-style).
    //   - `run-script` exits with `result.exitCode`, the sandboxed script's
    //     OWN exit code — not a numeral literal, so it never matches this
    //     regex in the first place.
    const codeLines = readFileSync(join(__dirname, 'bin', 'ibr.ts'), 'utf8')
      .split('\n')
      // Skip comment lines — this file documents commander's OWN
      // `process.exit(1)` default in a code comment, which is prose, not a
      // live call site.
      .filter((line) => !line.trim().startsWith('//'));

    const bareNumeralExits = codeLines.flatMap((line) =>
      [...line.matchAll(/process\.exit\((\d+)\)/g)].map((m) => m[1]),
    );

    expect(bareNumeralExits).toEqual(['77']);
  });
});
