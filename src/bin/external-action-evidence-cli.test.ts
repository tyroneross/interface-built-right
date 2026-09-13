import { describe, expect, it, vi } from 'vitest';
import { handleEvidenceRecord, type EvidenceRecordCliDeps } from './external-action-evidence-cli.js';

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
      { privacyMode: 'metadata-only' },
      { outputDir: undefined },
    );
  });

  it('passes through an explicit local-sensitive mode and output directory', async () => {
    const injected = deps();
    const result = await handleEvidenceRecord(
      { input: 'claude.json', privacy: 'local-sensitive', outputDir: '/tmp/evidence' },
      injected,
    );
    expect(result.exitCode).toBe(0);
    expect(injected.record).toHaveBeenCalledWith(
      validInput,
      { privacyMode: 'local-sensitive' },
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
    injected.readInput = vi.fn().mockResolvedValue('{');
    const result = await handleEvidenceRecord({ input: '-' }, injected);
    expect(result.exitCode).toBe(1);
    expect(result.json.ok).toBe(false);
  });
});
