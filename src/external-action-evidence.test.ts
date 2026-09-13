import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createExternalActionReceipt,
  recordExternalActionEvidence,
  writeExternalActionReceipt,
  type ExternalActionEvidenceInput,
} from './external-action-evidence.js';

const sandboxes: string[] = [];

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) rmSync(sandbox, { recursive: true, force: true });
});

function sandbox(): string {
  const path = mkdtempSync(join(tmpdir(), 'ibr-external-action-'));
  sandboxes.push(path);
  return path;
}

function inputFor(family: string, executor: string, artifactPath?: string): ExternalActionEvidenceInput {
  return {
    schemaVersion: 1,
    correlationId: 'ambient-drag-1',
    host: { family, executor, version: 'test' },
    surface: {
      kind: 'native',
      pid: 11473,
      bundleId: 'com.rosslabs.ambient-agent',
      targetId: 'window-42',
      windowTitle: 'Private Project — Ambient',
    },
    action: {
      kind: 'drag',
      target: {
        role: 'AXGroup',
        label: 'Secret customer header',
        coordinates: { x: 400, y: 80, unit: 'points' },
      },
      startedAt: '2026-09-13T19:00:01.000Z',
      completedAt: '2026-09-13T19:00:01.250Z',
    },
    before: {
      capturedAt: '2026-09-13T19:00:00.900Z',
      state: 'window title Private Project at x=200',
      elementCount: 23,
      interactiveElementCount: 7,
      artifacts: artifactPath ? [{ kind: 'screenshot', path: artifactPath }] : undefined,
    },
    after: {
      capturedAt: '2026-09-13T19:00:01.300Z',
      state: 'window title Private Project at x=480',
      elementCount: 23,
      interactiveElementCount: 7,
    },
    validation: {
      expectedCode: 'window-anchor-changed',
      observedCode: 'window-anchor-changed',
      passed: true,
      expectedDetail: 'Move Private Project to the right display',
      observedDetail: 'Private Project moved by 280 points',
    },
  };
}

const deterministic = {
  digestKey: 'test-only-digest-key',
  receiptId: 'ear_00000000-0000-4000-8000-000000000001',
  createdAt: '2026-09-13T19:00:02.000Z',
};

describe('createExternalActionReceipt', () => {
  it('defaults to metadata-only and removes raw UI content and artifact paths', async () => {
    const root = sandbox();
    const screenshot = join(root, 'private-screen.png');
    writeFileSync(screenshot, 'pixels');

    const receipt = await createExternalActionReceipt(
      inputFor('codex', 'unified-computer-use', screenshot),
      deterministic,
    );
    const json = JSON.stringify(receipt);

    expect(receipt.schemaVersion).toBe('ibr.external-action-receipt.v1');
    expect(receipt.action.durationMs).toBe(250);
    expect(receipt.privacy.mode).toBe('metadata-only');
    expect(receipt.privacy.artifactPathsRetained).toBe(false);
    expect(receipt.surface.windowTitleDigest).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(receipt.action.target?.labelDigest).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(receipt.before.stateDigest).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(receipt.before.artifacts?.[0].sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(receipt.before.artifacts?.[0].bytes).toBe(6);
    expect(json).not.toContain('Private Project');
    expect(json).not.toContain('Secret customer header');
    expect(json).not.toContain(screenshot);
  });

  it('normalizes Codex sidecar and Claude client-handler envelopes to the same contract', async () => {
    const codex = await createExternalActionReceipt(
      inputFor('codex', 'unified-computer-use'),
      { ...deterministic, receiptId: 'ear_codex' },
    );
    const claude = await createExternalActionReceipt(
      inputFor('claude', 'computer-use-client-handler'),
      { ...deterministic, receiptId: 'ear_claude' },
    );

    expect(codex.host).toEqual({ family: 'codex', executor: 'unified-computer-use', version: 'test' });
    expect(claude.host).toEqual({ family: 'claude', executor: 'computer-use-client-handler', version: 'test' });
    expect(codex.before).toEqual(claude.before);
    expect(codex.after).toEqual(claude.after);
    expect(codex.validation).toEqual(claude.validation);
    expect(codex.action).toEqual(claude.action);
  });

  it('retains schema-defined sensitive fields only after explicit opt-in', async () => {
    const root = sandbox();
    const screenshot = join(root, 'screen.png');
    writeFileSync(screenshot, 'pixels');
    const receipt = await createExternalActionReceipt(
      inputFor('custom-host', 'custom-executor', screenshot),
      { ...deterministic, privacyMode: 'local-sensitive' },
    );

    expect(receipt.privacy.mode).toBe('local-sensitive');
    expect(receipt.surface.windowTitle).toBe('Private Project — Ambient');
    expect(receipt.action.target?.label).toBe('Secret customer header');
    expect(receipt.before.state).toContain('Private Project');
    expect(receipt.before.artifacts?.[0].path).toBe(screenshot);
    expect(receipt.validation.observedDetail).toContain('280 points');
    expect(receipt.privacy.transformedFields).not.toContain('before.state');
    expect(receipt.privacy.transformedFields).not.toContain('after.state');
  });

  it('reports artifact path retention only when a path is retained', async () => {
    const withoutArtifact = await createExternalActionReceipt(
      inputFor('custom-host', 'custom-executor'),
      { ...deterministic, privacyMode: 'local-sensitive' },
    );
    expect(withoutArtifact.privacy.artifactPathsRetained).toBe(false);

    const root = sandbox();
    const screenshot = join(root, 'screen.png');
    writeFileSync(screenshot, 'pixels');
    const withArtifact = await createExternalActionReceipt(
      inputFor('custom-host', 'custom-executor', screenshot),
      { ...deterministic, privacyMode: 'local-sensitive' },
    );
    expect(withArtifact.privacy.artifactPathsRetained).toBe(true);
  });

  it('rejects unknown host fields and invalid chronology', async () => {
    const unknown = { ...inputFor('codex', 'sidecar'), host: { family: 'codex', executor: 'sidecar', token: 'secret' } };
    await expect(createExternalActionReceipt(unknown, deterministic)).rejects.toThrow(/unrecognized key/i);

    const chronology = inputFor('codex', 'sidecar');
    chronology.action.completedAt = '2026-09-13T18:59:59.000Z';
    await expect(createExternalActionReceipt(chronology, deterministic)).rejects.toThrow(/completedAt/);
  });

  it('rejects unsafe metadata, invalid runtime options and path-traversing receipt ids', async () => {
    const unsafe = inputFor('codex', 'sidecar');
    unsafe.correlationId = 'customer name with spaces';
    await expect(createExternalActionReceipt(unsafe, deterministic)).rejects.toThrow();

    await expect(createExternalActionReceipt(inputFor('codex', 'sidecar'), {
      ...deterministic,
      privacyMode: 'public' as 'metadata-only',
    })).rejects.toThrow();
    await expect(createExternalActionReceipt(inputFor('codex', 'sidecar'), {
      ...deterministic,
      createdAt: 'yesterday',
    })).rejects.toThrow();
    await expect(createExternalActionReceipt(inputFor('codex', 'sidecar'), {
      ...deterministic,
      receiptId: 'ear_../outside',
    })).rejects.toThrow();
  });

  it('uses one state digest domain so unchanged before/after state compares equal', async () => {
    const input = inputFor('codex', 'sidecar');
    input.after.state = input.before.state;
    const receipt = await createExternalActionReceipt(input, deterministic);
    expect(receipt.before.stateDigest).toBe(receipt.after.stateDigest);
  });

  it('rejects a supplied artifact digest that does not match the local file', async () => {
    const root = sandbox();
    const screenshot = join(root, 'secret-customer-screen.png');
    writeFileSync(screenshot, 'pixels');
    const input = inputFor('codex', 'sidecar', screenshot);
    input.before.artifacts = [{ kind: 'screenshot', path: screenshot, sha256: `sha256:${'0'.repeat(64)}` }];
    try {
      await createExternalActionReceipt(input, deterministic);
      throw new Error('expected digest mismatch');
    } catch (error) {
      expect(String(error)).toContain('digest mismatch');
      expect(String(error)).not.toContain('secret-customer-screen.png');
    }
  });

  it('does not expose a missing artifact path in metadata-only errors', async () => {
    const root = sandbox();
    const missing = join(root, 'secret-client-missing.png');
    const input = inputFor('codex', 'sidecar', missing);
    try {
      await createExternalActionReceipt(input, deterministic);
      throw new Error('expected missing artifact failure');
    } catch (error) {
      expect(String(error)).toContain('before.artifacts[0]');
      expect(String(error)).not.toContain('secret-client-missing.png');
      expect(String(error)).not.toContain(root);
    }
  });
});

describe('receipt persistence', () => {
  it('writes a private, complete receipt and refuses to replace an existing id', async () => {
    const root = sandbox();
    const receipt = await createExternalActionReceipt(inputFor('codex', 'sidecar'), deterministic);
    const path = await writeExternalActionReceipt(receipt, { outputDir: root });

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(receipt);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    await expect(writeExternalActionReceipt(receipt, { outputDir: root })).rejects.toThrow(/EEXIST/);

    const escaped = { ...receipt, receiptId: 'ear_../outside' };
    await expect(writeExternalActionReceipt(escaped, { outputDir: root })).rejects.toThrow(/receiptId/);
  });

  it('rejects a receipt whose output surface loses its required correlation', async () => {
    const root = sandbox();
    const receipt = await createExternalActionReceipt(inputFor('codex', 'sidecar'), deterministic);
    const invalid = { ...receipt, surface: { kind: 'web' as const } };
    await expect(writeExternalActionReceipt(invalid, { outputDir: root })).rejects.toThrow(/targetId or url evidence/);
  });

  it('rejects forged receipt chronology and invalid writer options', async () => {
    const root = sandbox();
    const receipt = await createExternalActionReceipt(inputFor('codex', 'sidecar'), deterministic);
    const forged = {
      ...receipt,
      before: { ...receipt.before, capturedAt: '2026-09-13T19:00:01.100Z' },
    };
    await expect(writeExternalActionReceipt(forged, { outputDir: root })).rejects.toThrow(/before.capturedAt/);
    await expect(writeExternalActionReceipt(receipt, {
      outputDir: 42 as unknown as string,
    })).rejects.toThrow();
  });

  it('composes and writes through the one-call operational API', async () => {
    const root = sandbox();
    const result = await recordExternalActionEvidence(
      inputFor('claude', 'computer-use-client-handler'),
      deterministic,
      { outputDir: root },
    );
    expect(result.path).toBe(join(root, `${deterministic.receiptId}.json`));
    expect(result.receipt.host.family).toBe('claude');
  });
});
