import type { Command } from 'commander';
import { readFile } from 'fs/promises';
import { recordExternalActionEvidence, type ExternalActionPrivacyMode } from '../external-action-evidence.js';

const MAX_INPUT_BYTES = 1024 * 1024;

export interface EvidenceRecordOptions {
  input: string;
  privacy?: string;
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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_INPUT_BYTES) {
      throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function defaultReadInput(path: string): Promise<string> {
  if (path === '-') return readStdin();
  const data = await readFile(path);
  if (data.byteLength > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
  return data.toString('utf8');
}

function defaultDeps(): EvidenceRecordCliDeps {
  return { readInput: defaultReadInput, record: recordExternalActionEvidence };
}

export async function handleEvidenceRecord(
  options: EvidenceRecordOptions,
  deps: EvidenceRecordCliDeps = defaultDeps(),
): Promise<EvidenceRecordCliResult> {
  if (options.privacy !== undefined && options.privacy !== 'metadata-only' && options.privacy !== 'local-sensitive') {
    return {
      exitCode: 2,
      json: { ok: false, error: `invalid privacy mode: ${options.privacy}` },
      text: `Invalid privacy mode: ${options.privacy}`,
    };
  }
  try {
    const text = await deps.readInput(options.input);
    const input: unknown = JSON.parse(text);
    const result = await deps.record(
      input,
      { privacyMode: (options.privacy ?? 'metadata-only') as ExternalActionPrivacyMode },
      { outputDir: options.outputDir },
    );
    return {
      exitCode: 0,
      json: { ok: true, path: result.path, receipt: result.receipt },
      text: `Recorded external action evidence: ${result.path}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      json: { ok: false, error: message },
      text: `Failed to record external action evidence: ${message}`,
    };
  }
}

export function registerExternalActionEvidenceCommand(program: Command): void {
  program
    .command('evidence:record <input>')
    .description('Record a privacy-bounded before/action/after receipt from an external computer-use executor')
    .option('--privacy <mode>', 'metadata-only (default) or local-sensitive', 'metadata-only')
    .option('--output-dir <dir>', 'Receipt directory (default .ibr/evidence)')
    .option('--json', 'Output as JSON')
    .action(async (input: string, options: { privacy: string; outputDir?: string; json?: boolean }) => {
      const result = await handleEvidenceRecord({ input, privacy: options.privacy, outputDir: options.outputDir });
      const output = options.json ? JSON.stringify(result.json, null, 2) : result.text;
      (result.exitCode === 0 ? console.log : console.error)(output);
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
    });
}
