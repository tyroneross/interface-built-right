import { describe, it, expect } from 'vitest';
import { indexTemplates } from './library.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function makeDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ibr-lib-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

describe('indexTemplates', () => {
  it('returns central templates with name and first-paragraph summary', async () => {
    const central = makeDir({
      'aurora-glass.md': '# Aurora Glass\n\nA glass system with light.',
      'warm-craft.md': '# Warm Craft\n\nEarthy and tactile.',
    });
    const result = await indexTemplates({ centralDir: central, projectDir: null });
    expect(result.templates).toHaveLength(2);
    expect(result.templates.map((t) => t.name).sort()).toEqual(['aurora-glass', 'warm-craft']);
    expect(result.templates[0].summary.length).toBeGreaterThan(0);
    expect(result.templates[0].source).toBe('central');
  });

  it('includes project-local drafts and marks precedence', async () => {
    const central = makeDir({ 'aurora-glass.md': '# Aurora Glass\n\nCentral version.' });
    const project = makeDir({
      'drafts/aurora-glass.md': '# Aurora Glass\n\nProject override.',
      'drafts/custom.md': '# Custom\n\nProject-only.',
    });
    const result = await indexTemplates({ centralDir: central, projectDir: project });
    const aurora = result.templates.find((t) => t.name === 'aurora-glass')!;
    expect(aurora.source).toBe('project');
    expect(aurora.summary).toContain('Project override');
    expect(result.templates.find((t) => t.name === 'custom')).toBeDefined();
  });

  it('returns empty list when central dir missing', async () => {
    const result = await indexTemplates({ centralDir: '/nonexistent/path', projectDir: null });
    expect(result.templates).toEqual([]);
    expect(result.warnings).toContain('central-missing');
  });
});
