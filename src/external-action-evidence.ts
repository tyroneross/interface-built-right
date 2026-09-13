import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import { link, mkdir, open, readFile, unlink } from 'fs/promises';
import { basename, join } from 'path';
import { z } from 'zod';

const MAX_TEXT = 4096;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const FIELD_DIGEST = /^hmac-sha256:[a-f0-9]{64}$/;
const SAFE_CODE = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,255}$/;
const RECEIPT_ID = /^ear_[A-Za-z0-9][A-Za-z0-9-]{0,127}$/;
const TRANSFORMED_FIELD = /^(surface\.(targetId|url|windowTitle)|action\.target\.label|validation\.(expectedDetail|observedDetail)|(before|after)\.state|(before|after)\.artifacts\[[0-9]\]\.path)$/;

const boundedText = z.string().min(1).max(MAX_TEXT);
const timestamp = z.string().datetime({ offset: true });

const boundsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
  unit: z.enum(['points', 'pixels']),
}).strict();

const artifactSchema = z.object({
  kind: z.enum(['screenshot', 'ax-tree', 'dom-snapshot', 'console-log', 'other']),
  path: boundedText.optional(),
  sha256: z.string().regex(SHA256).optional(),
  bytes: z.number().int().nonnegative().optional(),
}).strict().refine(value => value.path !== undefined || value.sha256 !== undefined, {
  message: 'artifact requires path or sha256',
});

const observationSchema = z.object({
  capturedAt: timestamp,
  state: boundedText.optional(),
  stateDigest: z.string().regex(SHA256).optional(),
  elementCount: z.number().int().nonnegative().optional(),
  interactiveElementCount: z.number().int().nonnegative().optional(),
  bounds: boundsSchema.optional(),
  artifacts: z.array(artifactSchema).max(10).optional(),
}).strict().refine(
  value => (value.state === undefined) !== (value.stateDigest === undefined),
  { message: 'observation requires exactly one of state or stateDigest' },
);

const targetSchema = z.object({
  role: z.string().regex(SAFE_TOKEN).max(128).optional(),
  label: boundedText.optional(),
  coordinates: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    unit: z.enum(['points', 'pixels']),
    scale: z.number().finite().positive().optional(),
  }).strict().optional(),
}).strict();

/**
 * Host-neutral envelope supplied by an external computer-use executor.
 *
 * The schema intentionally carries no Codex, Claude, MCP, or provider SDK
 * types. A host adapter maps its private action result into this bounded JSON
 * shape before IBR sees it.
 */
export const ExternalActionEvidenceInputSchema = z.object({
  schemaVersion: z.literal(1),
  correlationId: z.string().regex(SAFE_TOKEN),
  host: z.object({
    family: z.string().regex(SAFE_TOKEN).max(64),
    executor: z.string().regex(SAFE_TOKEN).max(128),
    version: z.string().regex(SAFE_TOKEN).max(128).optional(),
  }).strict(),
  surface: z.object({
    kind: z.enum(['native', 'web']),
    pid: z.number().int().positive().optional(),
    bundleId: z.string().regex(SAFE_TOKEN).optional(),
    targetId: boundedText.optional(),
    url: boundedText.optional(),
    windowTitle: boundedText.optional(),
  }).strict().superRefine((surface, context) => {
    if (surface.kind === 'native' && surface.pid === undefined && surface.bundleId === undefined) {
      context.addIssue({ code: 'custom', message: 'native surface requires pid or bundleId' });
    }
    if (surface.kind === 'web' && surface.targetId === undefined && surface.url === undefined) {
      context.addIssue({ code: 'custom', message: 'web surface requires targetId or url' });
    }
  }),
  action: z.object({
    kind: z.string().regex(SAFE_TOKEN).max(128),
    target: targetSchema.optional(),
    startedAt: timestamp,
    completedAt: timestamp,
  }).strict(),
  before: observationSchema,
  after: observationSchema,
  validation: z.object({
    expectedCode: z.string().regex(SAFE_CODE),
    observedCode: z.string().regex(SAFE_CODE),
    passed: z.boolean(),
    expectedDetail: boundedText.optional(),
    observedDetail: boundedText.optional(),
  }).strict(),
}).strict();

export type ExternalActionEvidenceInput = z.infer<typeof ExternalActionEvidenceInputSchema>;
export type ExternalActionPrivacyMode = 'metadata-only' | 'local-sensitive';
export type ExternalActionArtifactKind = z.infer<typeof artifactSchema>['kind'];

const artifactReceiptSchema = z.object({
  kind: artifactSchema.shape.kind,
  sha256: z.string().regex(SHA256),
  bytes: z.number().int().nonnegative().optional(),
  path: boundedText.optional(),
}).strict();

const observationReceiptSchema = z.object({
  capturedAt: timestamp,
  stateDigest: z.union([z.string().regex(SHA256), z.string().regex(FIELD_DIGEST)]),
  state: boundedText.optional(),
  elementCount: z.number().int().nonnegative().optional(),
  interactiveElementCount: z.number().int().nonnegative().optional(),
  bounds: boundsSchema.optional(),
  artifacts: z.array(artifactReceiptSchema).max(10).optional(),
}).strict();

const surfaceReceiptSchema = z.object({
  kind: z.enum(['native', 'web']),
  pid: z.number().int().positive().optional(),
  bundleId: z.string().regex(SAFE_TOKEN).optional(),
  targetIdDigest: z.string().regex(FIELD_DIGEST).optional(),
  urlDigest: z.string().regex(FIELD_DIGEST).optional(),
  windowTitleDigest: z.string().regex(FIELD_DIGEST).optional(),
  targetId: boundedText.optional(),
  url: boundedText.optional(),
  windowTitle: boundedText.optional(),
}).strict().superRefine((surface, context) => {
  if (surface.kind === 'native' && surface.pid === undefined && surface.bundleId === undefined) {
    context.addIssue({ code: 'custom', message: 'native surface requires pid or bundleId' });
  }
  if (
    surface.kind === 'web'
    && surface.targetId === undefined
    && surface.targetIdDigest === undefined
    && surface.url === undefined
    && surface.urlDigest === undefined
  ) {
    context.addIssue({ code: 'custom', message: 'web surface requires targetId or url evidence' });
  }
});

export const ExternalActionReceiptSchema = z.object({
  schemaVersion: z.literal('ibr.external-action-receipt.v1'),
  receiptId: z.string().regex(RECEIPT_ID),
  createdAt: timestamp,
  correlationId: z.string().regex(SAFE_TOKEN),
  host: ExternalActionEvidenceInputSchema.shape.host,
  surface: surfaceReceiptSchema,
  action: z.object({
    kind: z.string().regex(SAFE_TOKEN).max(128),
    target: z.object({
      role: z.string().regex(SAFE_TOKEN).max(128).optional(),
      labelDigest: z.string().regex(FIELD_DIGEST).optional(),
      label: boundedText.optional(),
      coordinates: targetSchema.shape.coordinates.optional(),
    }).strict().optional(),
    startedAt: timestamp,
    completedAt: timestamp,
    durationMs: z.number().int().nonnegative(),
  }).strict(),
  before: observationReceiptSchema,
  after: observationReceiptSchema,
  validation: z.object({
    expectedCode: z.string().regex(SAFE_CODE),
    observedCode: z.string().regex(SAFE_CODE),
    passed: z.boolean(),
    expectedDetailDigest: z.string().regex(FIELD_DIGEST).optional(),
    observedDetailDigest: z.string().regex(FIELD_DIGEST).optional(),
    expectedDetail: boundedText.optional(),
    observedDetail: boundedText.optional(),
  }).strict(),
  privacy: z.object({
    mode: z.enum(['metadata-only', 'local-sensitive']),
    fieldDigestAlgorithm: z.literal('hmac-sha256-ephemeral-key'),
    artifactDigestAlgorithm: z.literal('sha256'),
    transformedFields: z.array(z.string().regex(TRANSFORMED_FIELD)).max(64),
    artifactPathsRetained: z.boolean(),
  }).strict(),
}).strict().superRefine((receipt, context) => {
  for (const message of chronologyIssues(receipt)) {
    context.addIssue({ code: 'custom', message });
  }
  const duration = Date.parse(receipt.action.completedAt) - Date.parse(receipt.action.startedAt);
  if (receipt.action.durationMs !== duration) {
    context.addIssue({ code: 'custom', message: 'action.durationMs does not match action timestamps' });
  }
  if (receipt.privacy.mode === 'metadata-only') {
    const rawFields = [
      receipt.surface.targetId,
      receipt.surface.url,
      receipt.surface.windowTitle,
      receipt.action.target?.label,
      receipt.before.state,
      receipt.after.state,
      receipt.validation.expectedDetail,
      receipt.validation.observedDetail,
      ...(receipt.before.artifacts ?? []).map(artifact => artifact.path),
      ...(receipt.after.artifacts ?? []).map(artifact => artifact.path),
    ];
    if (rawFields.some(value => value !== undefined)) {
      context.addIssue({ code: 'custom', message: 'metadata-only receipt contains a raw sensitive field' });
    }
    if (receipt.privacy.artifactPathsRetained) {
      context.addIssue({ code: 'custom', message: 'metadata-only receipt cannot retain artifact paths' });
    }
  }
  const hasArtifactPath = [
    ...(receipt.before.artifacts ?? []),
    ...(receipt.after.artifacts ?? []),
  ].some(artifact => artifact.path !== undefined);
  if (receipt.privacy.artifactPathsRetained !== hasArtifactPath) {
    context.addIssue({ code: 'custom', message: 'privacy.artifactPathsRetained does not match retained artifact paths' });
  }
});

export type ExternalActionArtifactReceipt = z.infer<typeof artifactReceiptSchema>;
export type ExternalActionObservationReceipt = z.infer<typeof observationReceiptSchema>;
export type ExternalActionReceipt = z.infer<typeof ExternalActionReceiptSchema>;

export interface CreateExternalActionReceiptOptions {
  privacyMode?: ExternalActionPrivacyMode;
  /** Test/embedding seam. Production callers should let IBR create a random key. */
  digestKey?: string | Buffer;
  receiptId?: string;
  createdAt?: string;
}

export interface WriteExternalActionReceiptOptions {
  outputDir?: string;
}

export interface RecordedExternalActionReceipt {
  receipt: ExternalActionReceipt;
  path: string;
}

const createOptionsSchema = z.object({
  privacyMode: z.enum(['metadata-only', 'local-sensitive']).optional(),
  digestKey: z.union([z.string().min(1), z.instanceof(Buffer)]).optional(),
  receiptId: z.string().regex(RECEIPT_ID).optional(),
  createdAt: timestamp.optional(),
}).strict();

const writeOptionsSchema = z.object({
  outputDir: boundedText.optional(),
}).strict();

function fieldDigest(key: string | Buffer, field: string, value: string): string {
  return `hmac-sha256:${createHmac('sha256', key).update(`ibr.external-action.v1\0${field}\0${value}`).digest('hex')}`;
}

async function artifactDigest(path: string): Promise<{ sha256: string; bytes: number }> {
  const data = await readFile(path);
  return {
    sha256: `sha256:${createHash('sha256').update(data).digest('hex')}`,
    bytes: data.byteLength,
  };
}

type ChronologicalEvidence = Pick<ExternalActionEvidenceInput, 'action' | 'before' | 'after'>;

function chronologyIssues(input: ChronologicalEvidence): string[] {
  const startedAt = Date.parse(input.action.startedAt);
  const completedAt = Date.parse(input.action.completedAt);
  const beforeAt = Date.parse(input.before.capturedAt);
  const afterAt = Date.parse(input.after.capturedAt);
  const issues: string[] = [];
  if (completedAt < startedAt) issues.push('action.completedAt must be at or after action.startedAt');
  if (beforeAt > startedAt) issues.push('before.capturedAt must be at or before action.startedAt');
  if (afterAt < completedAt) issues.push('after.capturedAt must be at or after action.completedAt');
  return issues;
}

function assertChronology(input: ChronologicalEvidence): void {
  const [issue] = chronologyIssues(input);
  if (issue) throw new Error(issue);
}

async function normalizeArtifact(
  artifact: NonNullable<ExternalActionEvidenceInput['before']['artifacts']>[number],
  retainPath: boolean,
  location: string,
): Promise<ExternalActionArtifactReceipt> {
  let measured: Awaited<ReturnType<typeof artifactDigest>> | undefined;
  try {
    measured = artifact.path ? await artifactDigest(artifact.path) : undefined;
  } catch (error) {
    if (retainPath) throw error;
    throw new Error(`unable to read artifact at ${location}`);
  }
  if (artifact.sha256 && measured && artifact.sha256 !== measured.sha256) {
    const target = retainPath ? basename(artifact.path as string) : location;
    throw new Error(`artifact digest mismatch for ${target}`);
  }
  return {
    kind: artifact.kind,
    sha256: measured?.sha256 ?? artifact.sha256 as string,
    bytes: measured?.bytes ?? artifact.bytes,
    ...(retainPath && artifact.path ? { path: artifact.path } : {}),
  };
}

async function normalizeObservation(
  observation: ExternalActionEvidenceInput['before'],
  field: 'before' | 'after',
  mode: ExternalActionPrivacyMode,
  key: string | Buffer,
  transformed: Set<string>,
): Promise<ExternalActionObservationReceipt> {
  const retain = mode === 'local-sensitive';
  if (observation.state !== undefined && !retain) transformed.add(`${field}.state`);
  const stateDigest = observation.stateDigest ?? fieldDigest(key, 'observation.state', observation.state as string);
  const artifacts = observation.artifacts
    ? await Promise.all(observation.artifacts.map(async (artifact, index) => {
        if (artifact.path && !retain) transformed.add(`${field}.artifacts[${index}].path`);
        return normalizeArtifact(artifact, retain, `${field}.artifacts[${index}]`);
      }))
    : undefined;
  return {
    capturedAt: observation.capturedAt,
    stateDigest,
    ...(retain && observation.state !== undefined ? { state: observation.state } : {}),
    elementCount: observation.elementCount,
    interactiveElementCount: observation.interactiveElementCount,
    bounds: observation.bounds,
    artifacts,
  };
}

export async function createExternalActionReceipt(
  rawInput: unknown,
  options: CreateExternalActionReceiptOptions = {},
): Promise<ExternalActionReceipt> {
  const input = ExternalActionEvidenceInputSchema.parse(rawInput);
  assertChronology(input);
  const parsedOptions = createOptionsSchema.parse(options);
  const mode = parsedOptions.privacyMode ?? 'metadata-only';
  const key = parsedOptions.digestKey ?? randomBytes(32);
  const transformed = new Set<string>();
  const retain = mode === 'local-sensitive';

  const digestOrRetain = (
    field: string,
    value: string | undefined,
  ): { raw?: string; digest?: string } => {
    if (value === undefined) return {};
    if (retain) return { raw: value };
    transformed.add(field);
    return { digest: fieldDigest(key, field, value) };
  };

  const targetId = digestOrRetain('surface.targetId', input.surface.targetId);
  const url = digestOrRetain('surface.url', input.surface.url);
  const windowTitle = digestOrRetain('surface.windowTitle', input.surface.windowTitle);
  const targetLabel = digestOrRetain('action.target.label', input.action.target?.label);
  const expectedDetail = digestOrRetain('validation.expectedDetail', input.validation.expectedDetail);
  const observedDetail = digestOrRetain('validation.observedDetail', input.validation.observedDetail);
  const startedAt = Date.parse(input.action.startedAt);
  const completedAt = Date.parse(input.action.completedAt);
  const artifactPathsRetained = retain && [
    ...(input.before.artifacts ?? []),
    ...(input.after.artifacts ?? []),
  ].some(artifact => artifact.path !== undefined);

  return {
    schemaVersion: 'ibr.external-action-receipt.v1',
    receiptId: parsedOptions.receiptId ?? `ear_${randomUUID()}`,
    createdAt: parsedOptions.createdAt ?? new Date().toISOString(),
    correlationId: input.correlationId,
    host: input.host,
    surface: {
      kind: input.surface.kind,
      pid: input.surface.pid,
      bundleId: input.surface.bundleId,
      ...(targetId.raw ? { targetId: targetId.raw } : {}),
      ...(targetId.digest ? { targetIdDigest: targetId.digest } : {}),
      ...(url.raw ? { url: url.raw } : {}),
      ...(url.digest ? { urlDigest: url.digest } : {}),
      ...(windowTitle.raw ? { windowTitle: windowTitle.raw } : {}),
      ...(windowTitle.digest ? { windowTitleDigest: windowTitle.digest } : {}),
    },
    action: {
      kind: input.action.kind,
      target: input.action.target ? {
        role: input.action.target.role,
        ...(targetLabel.raw ? { label: targetLabel.raw } : {}),
        ...(targetLabel.digest ? { labelDigest: targetLabel.digest } : {}),
        coordinates: input.action.target.coordinates,
      } : undefined,
      startedAt: input.action.startedAt,
      completedAt: input.action.completedAt,
      durationMs: completedAt - startedAt,
    },
    before: await normalizeObservation(input.before, 'before', mode, key, transformed),
    after: await normalizeObservation(input.after, 'after', mode, key, transformed),
    validation: {
      expectedCode: input.validation.expectedCode,
      observedCode: input.validation.observedCode,
      passed: input.validation.passed,
      ...(expectedDetail.raw ? { expectedDetail: expectedDetail.raw } : {}),
      ...(expectedDetail.digest ? { expectedDetailDigest: expectedDetail.digest } : {}),
      ...(observedDetail.raw ? { observedDetail: observedDetail.raw } : {}),
      ...(observedDetail.digest ? { observedDetailDigest: observedDetail.digest } : {}),
    },
    privacy: {
      mode,
      fieldDigestAlgorithm: 'hmac-sha256-ephemeral-key',
      artifactDigestAlgorithm: 'sha256',
      transformedFields: [...transformed].sort(),
      artifactPathsRetained,
    },
  };
}

export async function writeExternalActionReceipt(
  receipt: ExternalActionReceipt,
  options: WriteExternalActionReceiptOptions = {},
): Promise<string> {
  const validated = ExternalActionReceiptSchema.parse(receipt);
  const parsedOptions = writeOptionsSchema.parse(options);
  const outputDir = parsedOptions.outputDir ?? join(process.cwd(), '.ibr', 'evidence');
  await mkdir(outputDir, { recursive: true });
  const destination = join(outputDir, `${validated.receiptId}.json`);
  const temporary = join(outputDir, `.${validated.receiptId}.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(validated, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
  return destination;
}

export async function recordExternalActionEvidence(
  input: unknown,
  createOptions: CreateExternalActionReceiptOptions = {},
  writeOptions: WriteExternalActionReceiptOptions = {},
): Promise<RecordedExternalActionReceipt> {
  const receipt = await createExternalActionReceipt(input, createOptions);
  const path = await writeExternalActionReceipt(receipt, writeOptions);
  return { receipt, path };
}
