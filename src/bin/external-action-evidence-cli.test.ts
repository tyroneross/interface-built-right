import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  handleEvidenceRecord,
  readEvidenceInput,
  readEvidenceStdin,
  type EvidenceRecordCliDeps,
} from './external-action-evidence-cli.js';

const sandboxes: string[] = [];

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) rmSync(sandbox, { recursive: true, force: true });
});

async function* chunks(...values: Array<string | Buffer>): AsyncGenerator<string | Buffer> {
  for (const value of values) yield value;
}

const validInput = {
  schemaVersion: 1,
  correlationId: 'claude-action-1',
  host: { family: 'claude', executor: 'computer-use-client-handler' },
  surface: { kind: 'web', targetId: 'tab-1' },
  action: {
    kind: 'click',
    startedAt: '2026-09-13T19:00:01.000Z',
    completedAt: '2026-09-13T19:00:01.100Z',
  },
  before: { capturedAt: '2026-09-13T19:00:00.900Z', state: 'before' },
  after: { capturedAt: '2026-09-13T19:00:01.200Z', state: 'after' },
  validation: { expectedCode: 'dialog-open', observedCode: 'dialog-open', passed: true },
};

function deps(): EvidenceRecordCliDeps {
  return {
    readInput: vi.fn().mockResolvedValue(JSON.stringify(validInput)),
    record: vi.fn().mockResolvedValue({
      path: '/tmp/ear.json',
      receipt: { schemaVersion: 'ibr.external-action-receipt.v1', host: validInput.host },
    }),
  };
}

describe('handleEvidenceRecord', () => {
  it('uses metadata-only by default for a sidecar input', async () => {
    const injected = deps();
    const result = await handleEvidenceRecord({ input: '-' }, injected);

    expect(result.exitCode).toBe(0);
    expect(result.json.ok).toBe(true);
    expect(injected.readInput).toHaveBeenCalledWith('-');
    expect(injected.record).toHaveBeenCalledWith(
      validInput,
      { privacyMode: 'metadata-only', artifactRoot: undefined },
      { outputDir: undefined },
    );
  });

  it('passes through an explicit local-sensitive mode and output directory', async () => {
    const injected = deps();
    const result = await handleEvidenceRecord(
      {
        input: 'claude.json',
        privacy: 'local-sensitive',
        artifactRoot: '/tmp/artifacts',
        outputDir: '/tmp/evidence',
      },
      injected,
    );
    expect(result.exitCode).toBe(0);
    expect(injected.record).toHaveBeenCalledWith(
      validInput,
      { privacyMode: 'local-sensitive', artifactRoot: '/tmp/artifacts' },
      { outputDir: '/tmp/evidence' },
    );
  });

  it('returns a usage error for an unknown privacy mode', async () => {
    const injected = deps();
    const result = await handleEvidenceRecord({ input: '-', privacy: 'public' }, injected);
    expect(result.exitCode).toBe(2);
    expect(result.json.error).toMatch(/invalid privacy mode/);
    expect(injected.record).not.toHaveBeenCalled();
  });

  it('returns a structured failure for invalid JSON', async () => {
    const injected = deps();
    injected.readInput = vi.fn().mockResolvedValue('{"secret":"TOP_SECRET", trailing}');
    const result = await handleEvidenceRecord({ input: '-' }, injected);
    expect(result.exitCode).toBe(1);
    expect(result.json.ok).toBe(false);
    expect(result.json.code).toBe('EVIDENCE_REJECTED');
    expect(result.json.error).toBe('external action evidence rejected');
    expect(JSON.stringify(result)).not.toContain('TOP_SECRET');
  });

  it('does not expose downstream validation details in metadata-only mode', async () => {
    const injected = deps();
    injected.record = vi.fn().mockRejectedValue(new Error('Unrecognized key TOP_SECRET_CUSTOMER'));
    const result = await handleEvidenceRecord({ input: '-' }, injected);
    expect(result.json.error).toBe('external action evidence rejected');
    expect(JSON.stringify(result)).not.toContain('TOP_SECRET_CUSTOMER');
  });

  it('retains downstream error detail only after local-sensitive opt-in', async () => {
    const injected = deps();
    injected.record = vi.fn().mockRejectedValue(new Error('local review detail'));
    const result = await handleEvidenceRecord({ input: '-', privacy: 'local-sensitive' }, injected);
    expect(result.json.error).toBe('local review detail');
  });
});

describe('evidence input readers', () => {
  it('reads a real file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ibr-evidence-cli-'));
    sandboxes.push(root);
    const path = join(root, 'receipt-input.json');
    writeFileSync(path, JSON.stringify(validInput));
    expect(await readEvidenceInput(path)).toBe(JSON.stringify(validInput));
  });

  it('rejects oversized and non-regular input files before reading them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ibr-evidence-cli-'));
    sandboxes.push(root);
    const oversized = join(root, 'oversized.json');
    writeFileSync(oversized, '');
    truncateSync(oversized, 1024 * 1024 + 1);
    await expect(readEvidenceInput(oversized)).rejects.toThrow(/exceeds 1048576 bytes/);

    const regular = join(root, 'regular.json');
    const alias = join(root, 'alias.json');
    writeFileSync(regular, '{}');
    symlinkSync(regular, alias);
    await expect(readEvidenceInput(alias)).rejects.toThrow(/regular file/);
  });

  it('accepts exactly 1 MiB from stdin and rejects the next byte', async () => {
    const half = Buffer.alloc(512 * 1024, 0x61);
    expect((await readEvidenceStdin(chunks(half, half))).length).toBe(1024 * 1024);
    await expect(readEvidenceStdin(chunks(half, half, 'b'))).rejects.toThrow(/exceeds 1048576 bytes/);
  });
});
