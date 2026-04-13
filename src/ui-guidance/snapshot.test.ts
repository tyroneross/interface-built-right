import { describe, it, expect } from 'vitest';
import { snapshotTemplate } from './snapshot.js';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('snapshotTemplate', () => {
  it('copies the template to <projectDir>/active.md with a snapshot header', async () => {
    const src = join(mkdtempSync(join(tmpdir(), 'ibr-src-')), 'warm-craft.md');
    writeFileSync(src, '# Warm Craft\n\nBody.');
    const projectDir = mkdtempSync(join(tmpdir(), 'ibr-proj-'));

    const result = await snapshotTemplate({ sourcePath: src, projectDir });

    expect(result.activePath).toBe(join(projectDir, 'active.md'));
    expect(existsSync(result.activePath)).toBe(true);
    const body = readFileSync(result.activePath, 'utf8');
    expect(body).toContain('# Snapshot');
    expect(body).toContain('warm-craft.md');
    expect(body).toContain('# Warm Craft');
  });
});
