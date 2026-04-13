import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';

export interface PromoteOptions {
  slug: string;
  projectDir: string;
  centralDir: string;
  confirm: boolean;
}

export interface PromoteResult {
  source: string;
  target: string;
  dryRun: boolean;
}

export async function promoteDraft(opts: PromoteOptions): Promise<PromoteResult> {
  const source = join(opts.projectDir, 'drafts', `${opts.slug}.md`);
  try {
    await access(source);
  } catch {
    throw new Error(`Draft not found: ${source}`);
  }
  const target = join(opts.centralDir, `${opts.slug}.md`);
  if (!opts.confirm) {
    return { source, target, dryRun: true };
  }
  await mkdir(opts.centralDir, { recursive: true });
  const content = await readFile(source, 'utf8');
  await writeFile(target, content, 'utf8');
  return { source, target, dryRun: false };
}
