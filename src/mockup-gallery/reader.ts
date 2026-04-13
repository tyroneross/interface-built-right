import { readFile, access } from 'fs/promises';
import { join } from 'path';

export interface GalleryData {
  present: boolean;
  galleryDir: string;
  ratings: Record<string, { rating: 'yay' | 'nay'; notes?: string }>;
  selected: Record<string, string>;
  warnings: string[];
}

export interface ReadOptions {
  projectDir: string;
}

async function readJsonSafe<T>(path: string, fallback: T, warnings: string[], warnKey: string): Promise<T> {
  try {
    const text = await readFile(path, 'utf8');
    return JSON.parse(text) as T;
  } catch (err: any) {
    if (err.code === 'ENOENT') return fallback;
    warnings.push(warnKey);
    return fallback;
  }
}

export async function readGallery(opts: ReadOptions): Promise<GalleryData> {
  const galleryDir = join(opts.projectDir, '.mockup-gallery');
  const warnings: string[] = [];
  try {
    await access(galleryDir);
  } catch {
    return { present: false, galleryDir, ratings: {}, selected: {}, warnings };
  }
  const ratings = await readJsonSafe(join(galleryDir, 'ratings.json'), {}, warnings, 'ratings-malformed');
  const selected = await readJsonSafe(join(galleryDir, 'selected.json'), {}, warnings, 'selected-malformed');
  return { present: true, galleryDir, ratings, selected, warnings };
}
