import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface RecordOptions {
  projectDir: string;
  topic: string;
  mockup: string;
  commit: string;
  passed: boolean;
}

interface Implemented {
  entries: Array<{ topic: string; mockup: string; commit: string; passed: boolean; at: string }>;
}

export async function recordImplementation(opts: RecordOptions): Promise<void> {
  const dir = join(opts.projectDir, '.mockup-gallery');
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'implemented.json');
  let current: Implemented = { entries: [] };
  try {
    current = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(current.entries)) current = { entries: [] };
  } catch {
    current = { entries: [] };
  }
  current.entries.push({
    topic: opts.topic,
    mockup: opts.mockup,
    commit: opts.commit,
    passed: opts.passed,
    at: new Date().toISOString(),
  });
  await writeFile(path, JSON.stringify(current, null, 2), 'utf8');
}
