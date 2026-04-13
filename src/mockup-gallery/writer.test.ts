import { describe, it, expect } from 'vitest';
import { recordImplementation } from './writer.js';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('recordImplementation', () => {
  it('creates implemented.json and appends an entry', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ibr-gallery-'));
    mkdirSync(join(project, '.mockup-gallery'));
    await recordImplementation({
      projectDir: project,
      topic: 'dashboard',
      mockup: 'dashboard-1.html',
      commit: 'abc1234',
      passed: true,
    });
    const body = JSON.parse(readFileSync(join(project, '.mockup-gallery', 'implemented.json'), 'utf8'));
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].topic).toBe('dashboard');
    expect(body.entries[0].passed).toBe(true);
  });

  it('preserves existing entries when appending', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ibr-gallery-'));
    mkdirSync(join(project, '.mockup-gallery'));
    writeFileSync(
      join(project, '.mockup-gallery', 'implemented.json'),
      JSON.stringify({ entries: [{ topic: 'old', mockup: 'o.html', commit: 'x', passed: true, at: '2026-01-01' }] })
    );
    await recordImplementation({ projectDir: project, topic: 'new', mockup: 'n.html', commit: 'y', passed: false });
    const body = JSON.parse(readFileSync(join(project, '.mockup-gallery', 'implemented.json'), 'utf8'));
    expect(body.entries).toHaveLength(2);
    expect(body.entries.map((e: any) => e.topic)).toEqual(['old', 'new']);
  });
});
