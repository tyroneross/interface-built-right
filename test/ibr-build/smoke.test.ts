import { describe, it, expect } from 'vitest';
import { indexTemplates } from '../../src/ui-guidance/library.js';
import { readGallery } from '../../src/mockup-gallery/reader.js';
import { recordImplementation } from '../../src/mockup-gallery/writer.js';
import { join, resolve } from 'path';
import { readFileSync } from 'fs';

const fixture = join(__dirname, 'fixture-project');
// Small repo-local fixture so the smoke test doesn't depend on whatever a
// developer happens to have under their home directory. The previous path
// `~/Desktop/git-folder/UI Guidance` stopped existing when the project tree
// moved to `~/dev/git-folder/...`; rather than re-pin that absolute path,
// use a checked-in markdown directory the test owns.
const centralFixture = resolve(__dirname, 'fixture-templates');

describe('/ibr:build smoke — primitives wire together', () => {
  it('reads gallery and index templates from the same fixture project', async () => {
    const gallery = await readGallery({ projectDir: fixture });
    expect(gallery.present).toBe(true);
    expect(gallery.selected.dashboard).toBe('dashboard-1.html');

    const templates = await indexTemplates({
      centralDir: centralFixture,
      projectDir: null,
    });
    expect(templates.templates.length).toBeGreaterThan(0);
  });

  it('records implementation end-to-end', async () => {
    await recordImplementation({
      projectDir: fixture,
      topic: 'dashboard',
      mockup: 'dashboard-1.html',
      commit: 'test1234',
      passed: true,
    });
    const body = JSON.parse(readFileSync(join(fixture, '.mockup-gallery', 'implemented.json'), 'utf8'));
    expect(body.entries.some((e: any) => e.topic === 'dashboard')).toBe(true);
  });
});
