import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export interface TemplateRef {
  name: string;
  source: 'central' | 'project';
  path: string;
  summary: string;
}

export interface IndexResult {
  templates: TemplateRef[];
  warnings: string[];
}

export interface IndexOptions {
  centralDir: string;
  projectDir: string | null;
}

async function readMarkdownFiles(dir: string): Promise<Array<{ name: string; path: string; content: string }>> {
  try {
    const entries = await readdir(dir);
    const md: Array<{ name: string; path: string; content: string }> = [];
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const full = join(dir, entry);
      const s = await stat(full);
      if (!s.isFile()) continue;
      md.push({
        name: entry.replace(/\.md$/, ''),
        path: full,
        content: await readFile(full, 'utf8'),
      });
    }
    return md;
  } catch {
    return [];
  }
}

function firstParagraph(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let seenHeading = false;
  for (const line of lines) {
    if (line.startsWith('#')) {
      if (seenHeading && out.length) break;
      seenHeading = true;
      continue;
    }
    if (!line.trim()) {
      if (out.length) break;
      continue;
    }
    out.push(line.trim());
  }
  return out.join(' ').slice(0, 300);
}

export async function indexTemplates(opts: IndexOptions): Promise<IndexResult> {
  const warnings: string[] = [];
  const byName = new Map<string, TemplateRef>();

  const centralFiles = await readMarkdownFiles(opts.centralDir);
  if (centralFiles.length === 0) warnings.push('central-missing');
  for (const f of centralFiles) {
    byName.set(f.name, {
      name: f.name,
      source: 'central',
      path: f.path,
      summary: firstParagraph(f.content),
    });
  }

  if (opts.projectDir) {
    const draftsDir = join(opts.projectDir, 'drafts');
    const projectFiles = await readMarkdownFiles(draftsDir);
    for (const f of projectFiles) {
      byName.set(f.name, {
        name: f.name,
        source: 'project',
        path: f.path,
        summary: firstParagraph(f.content),
      });
    }
  }

  return {
    templates: Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)),
    warnings,
  };
}
