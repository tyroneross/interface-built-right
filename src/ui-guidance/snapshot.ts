import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';

export interface SnapshotOptions {
  sourcePath: string;
  projectDir: string;
}

export interface SnapshotResult {
  activePath: string;
}

export async function snapshotTemplate(opts: SnapshotOptions): Promise<SnapshotResult> {
  await mkdir(opts.projectDir, { recursive: true });
  const content = await readFile(opts.sourcePath, 'utf8');
  const activePath = join(opts.projectDir, 'active.md');
  const header = [
    '<!-- # Snapshot',
    `Source: ${basename(opts.sourcePath)}`,
    `Snapshotted: ${new Date().toISOString()}`,
    '-->',
    '',
  ].join('\n');
  await writeFile(activePath, header + content, 'utf8');
  return { activePath };
}
