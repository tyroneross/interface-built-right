import { describe, it, expect } from 'vitest';
import { promoteDraft } from './promote.js';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function setup() {
  const project = mkdtempSync(join(tmpdir(), 'ibr-proj-'));
  const central = mkdtempSync(join(tmpdir(), 'ibr-central-'));
  mkdirSync(join(project, 'drafts'), { recursive: true });
  writeFileSync(join(project, 'drafts', 'midnight.md'), '# Midnight\n\nDraft.');
  return { project, central };
}

describe('promoteDraft', () => {
  it('in dry-run mode, does not write and returns planned target', async () => {
    const { project, central } = setup();
    const result = await promoteDraft({ slug: 'midnight', projectDir: project, centralDir: central, confirm: false });
    expect(result.dryRun).toBe(true);
    expect(result.target).toBe(join(central, 'midnight.md'));
    expect(existsSync(result.target)).toBe(false);
  });

  it('with confirm=true, writes to central and reports', async () => {
    const { project, central } = setup();
    const result = await promoteDraft({ slug: 'midnight', projectDir: project, centralDir: central, confirm: true });
    expect(result.dryRun).toBe(false);
    expect(existsSync(result.target)).toBe(true);
    expect(readFileSync(result.target, 'utf8')).toContain('# Midnight');
  });

  it('throws when slug does not exist in drafts', async () => {
    const { project, central } = setup();
    await expect(
      promoteDraft({ slug: 'missing', projectDir: project, centralDir: central, confirm: true })
    ).rejects.toThrow(/not found/);
  });
});
