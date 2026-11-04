import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

describe('CLI stdout completion', () => {
  it.each([0, 1])('drains a multi-megabyte JSON response through a pipe with exit status %i', status => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-stdout-'));
    try {
      const source = readFileSync(join(process.cwd(), 'src/bin/cli-output.ts'), 'utf8');
      const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      const file = join(dir, 'output.cjs');
      writeFileSync(file, compiled + `\nwriteCliOutput(JSON.stringify({verdict:'FAIL', evidence:'x'.repeat(2*1024*1024)}), ${status});`);
      const result = spawnSync(process.execPath, [file], { encoding: 'utf8', maxBuffer: 4*1024*1024, timeout: 10000 });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(status);
      expect(JSON.parse(result.stdout)).toEqual({ verdict: 'FAIL', evidence: 'x'.repeat(2*1024*1024) });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
