import type { Command } from 'commander';
import { constants } from 'fs';
import { lstat, open } from 'fs/promises';
import { recordExternalActionEvidence, type ExternalActionPrivacyMode } from '../external-action-evidence.js';

const MAX_INPUT_BYTES = 1024 * 1024;

export interface EvidenceRecordOptions {
  input: string;
  privacy?: string;
  artifactRoot?: string;
  outputDir?: string;
}

export interface EvidenceRecordCliResult {
  exitCode: number;
  json: Record<string, unknown>;
  text: string;
}

export interface EvidenceRecordCliDeps {
  readInput: (path: string) => Promise<string>;
  record: typeof recordExternalActionEvidence;
}

export async function readEvidenceStdin(
  input: AsyncIterable<string | Buffer | Uint8Array> = process.stdin,
): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of input) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_INPUT_BYTES) {
      throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readEvidenceFile(path: string): Promise<string> {
  const beforeOpen = await lstat(path);
  if (beforeOpen.isSymbolicLink() || !beforeOpen.isFile()) {
    throw new Error('input must be a regular file');
  }
  if (beforeOpen.size > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    const afterOpen = await handle.stat();
    if (!afterOpen.isFile() || afterOpen.dev !== beforeOpen.dev || afterOpen.ino !== beforeOpen.ino) {
      throw new Error('input file changed before it could be read');
    }
    const buffer = Buffer.allocUnsafe(64 * 1024);
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
      if (totalBytes > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
  } finally {
    await handle.close();
  }
  return Buffer.concat(chunks, totalBytes).toString('utf8');
}

export async function readEvidenceInput(path: string): Promise<string> {
  if (path === '-') return readEvidenceStdin();
  return readEvidenceFile(path);
}

function defaultDeps(): EvidenceRecordCliDeps {
  return { readInput: readEvidenceInput, record: recordExternalActionEvidence };
}

export async function handleEvidenceRecord(
  options: EvidenceRecordOptions,
  deps: EvidenceRecordCliDeps = defaultDeps(),
): Promise<EvidenceRecordCliResult> {
  if (options.privacy !== undefined && options.privacy !== 'metadata-only' && options.privacy !== 'local-sensitive') {
    return {
      exitCode: 2,
      json: { ok: false, code: 'INVALID_PRIVACY_MODE', error: 'invalid privacy mode; expected metadata-only or local-sensitive' },
      text: 'Invalid privacy mode; expected metadata-only or local-sensitive',
    };
  }
  try {
    const text = await deps.readInput(options.input);
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      throw new Error('invalid JSON input');
    }
    const result = await deps.record(
      input,
      {
        privacyMode: (options.privacy ?? 'metadata-only') as ExternalActionPrivacyMode,
        artifactRoot: options.artifactRoot,
      },
      { outputDir: options.outputDir },
    );
    return {
      exitCode: 0,
      json: { ok: true, path: result.path, receipt: result.receipt },
      text: `Recorded external action evidence: ${result.path}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const publicMessage = options.privacy === 'local-sensitive'
      ? message
      : 'external action evidence rejected';
    return {
      exitCode: 1,
      json: { ok: false, code: 'EVIDENCE_REJECTED', error: publicMessage },
      text: `Failed to record external action evidence: ${publicMessage}`,
    };
  }
}

export function registerExternalActionEvidenceCommand(program: Command): void {
  program
    .command('evidence:record <input>')
    .description('Record a privacy-bounded before/action/after receipt from an external computer-use executor')
    .option('--privacy <mode>', 'metadata-only (default) or local-sensitive', 'metadata-only')
    .option('--artifact-root <dir>', 'Required allowlisted root for local artifact paths')
    .option('--output-dir <dir>', 'Receipt directory (default .ibr/evidence)')
    .option('--json', 'Output as JSON')
    .action(async (input: string, options: { privacy: string; artifactRoot?: string; outputDir?: string; json?: boolean }) => {
      const result = await handleEvidenceRecord({
        input,
        privacy: options.privacy,
        artifactRoot: options.artifactRoot,
        outputDir: options.outputDir,
      });
      const output = options.json ? JSON.stringify(result.json, null, 2) : result.text;
      (result.exitCode === 0 ? console.log : console.error)(output);
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
    });
}
