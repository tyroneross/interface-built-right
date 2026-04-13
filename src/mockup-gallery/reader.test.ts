import { describe, it, expect } from 'vitest';
import { readGallery } from './reader.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('readGallery', () => {
  it('returns ratings and selections when gallery dir exists', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ibr-gallery-'));
    const galleryDir = join(project, '.mockup-gallery');
    mkdirSync(galleryDir);
    writeFileSync(join(galleryDir, 'ratings.json'), JSON.stringify({
      'dashboard-1.html': { rating: 'yay', notes: 'Clean layout' },
    }));
    writeFileSync(join(galleryDir, 'selected.json'), JSON.stringify({
      'dashboard': 'dashboard-1.html',
    }));

    const result = await readGallery({ projectDir: project });
    expect(result.present).toBe(true);
    expect(result.ratings['dashboard-1.html'].rating).toBe('yay');
    expect(result.selected['dashboard']).toBe('dashboard-1.html');
  });

  it('returns present=false when dir missing', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ibr-gallery-'));
    const result = await readGallery({ projectDir: project });
    expect(result.present).toBe(false);
    expect(result.ratings).toEqual({});
    expect(result.selected).toEqual({});
  });

  it('handles malformed JSON without throwing', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ibr-gallery-'));
    const galleryDir = join(project, '.mockup-gallery');
    mkdirSync(galleryDir);
    writeFileSync(join(galleryDir, 'ratings.json'), '{ not json');
    const result = await readGallery({ projectDir: project });
    expect(result.present).toBe(true);
    expect(result.ratings).toEqual({});
    expect(result.warnings).toContain('ratings-malformed');
  });
});
