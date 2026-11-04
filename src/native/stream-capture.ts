import { mkdir, appendFile, writeFile, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { PNG } from 'pngjs';
import { performance } from 'node:perf_hooks';
import { assignRefs, diffRefs, type RawElement, type RefEntry } from './compact-refs.js';

export interface StreamCaptureOptions {
  durationMs: number;
  intervalMs: number;
  maxFrames: number;
  keyframeOn: string[];
  outputDir: string;
}
export interface StreamCaptureDeps {
  read: () => Promise<{ elements: RawElement[]; [key: string]: unknown }>;
  screenshot: () => Promise<Record<string, unknown>>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Bounded polling evidence. Neither idle AX nor the end of this recording means task completion. */
export async function captureNativeStream(opts: StreamCaptureOptions, deps: StreamCaptureDeps) {
  if (!Number.isInteger(opts.durationMs) || opts.durationMs < 100 || opts.durationMs > 60000
      || !Number.isInteger(opts.intervalMs) || opts.intervalMs < 100 || opts.intervalMs > opts.durationMs
      || !Number.isInteger(opts.maxFrames) || opts.maxFrames < 0 || opts.maxFrames > 20) {
    throw new Error('Capture requires duration 100..60000ms, interval 100..duration, frames 0..20.');
  }
  const dir = resolve(opts.outputDir);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const eventsPath = join(dir, 'events.jsonl');
  // A run must never overwrite previous evidence.
  await writeFile(eventsPath, '', { mode: 0o600, flag: 'wx' });
  const now = deps.now ?? (() => performance.now());
  const sleep = deps.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
  const started = now();
  let prior: RefEntry[] = [], samples = 0, lastSample = started;
  let largestGapMs = 0;
  const frames: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let sequence = 0, frameAttempts = 0;
  const finalizationBudgetMs = 1000;
  const deadline = started + opts.durationMs;
  const bounded = async <T>(operation: () => Promise<T>, until: number): Promise<T> => {
    const remaining = until - now();
    if (remaining <= 0) throw new Error('Capture operation deadline exceeded');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Capture operation timed out; backend cancellation unavailable')), remaining); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  const matched = new Set<string>();
  const emit = async (event: Record<string, unknown>) => appendFile(eventsPath,
    `${JSON.stringify({ seq: ++sequence, sample: samples, elapsedMs: now() - started, ...event })}\n`);
  const frame = async (reason: string, until = deadline) => {
    if (frameAttempts >= opts.maxFrames) return;
    frameAttempts++;
    const acquisitionStartedMs = now() - started;
    try {
      const image = await bounded(deps.screenshot, until);
      if (typeof image.screenshotPath !== 'string') throw new Error('Screenshot artifact path missing');
      const info = await bounded(() => stat(image.screenshotPath as string), until);
      if (!info.isFile() || info.size > 16 * 1024 * 1024) throw new Error('Screenshot must be a regular PNG of at most 16 MiB');
      const bytes = await bounded(() => readFile(image.screenshotPath as string), until);
      if (bytes.length < 24 || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 32000000) throw new Error('Screenshot exceeds 32 million pixels or has an invalid header');
      const decoded = PNG.sync.read(bytes);
      if (now() >= until) throw new Error('Screenshot decoding exhausted capture deadline');
      const screenshotPath = join(dir, `frame-${randomUUID()}.png`);
      await bounded(() => writeFile(screenshotPath, bytes, { mode: 0o600, flag: 'wx' }), until);
      const record = { sample: samples, acquisitionStartedMs, elapsedMs: now() - started, reason,
        capture: { ...image, screenshotPath, width: decoded.width, height: decoded.height,
          bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } };
      frames.push(record); await emit({ type: 'keyframe', ...record });
    } catch (e) { const error = String(e); errors.push(error); await emit({ type: 'screenshot-error', error }); }
  };
  while (true) {
    const sampleStarted = now();
    try {
      const observation = await bounded(deps.read, samples === 0 ? deadline : deadline + finalizationBudgetMs);
      if (!Array.isArray(observation.elements) ||
          (typeof observation.totalElements === 'number' && observation.elements.length < observation.totalElements)) {
        await emit({ type: 'partial-observation', observation, resyncRequired: true });
        throw new Error('Incomplete native observation cannot reconcile capture state');
      }
      const current = assignRefs(observation.elements, prior);
      samples++;
      largestGapMs = Math.max(largestGapMs, sampleStarted - lastSample);
      lastSample = sampleStarted;
      const delta = diffRefs(prior, current);
      await emit(samples === 1 ? { type: 'baseline', observation, refs: current }
        : { type: 'delta', observedAt: new Date().toISOString(), ...delta });
      const text = JSON.stringify(observation.elements);
      const triggers = opts.keyframeOn.filter(t => !matched.has(t) && text.includes(t));
      triggers.forEach(t => matched.add(t));
      if (triggers.length) await emit({ type: 'trigger', detected: triggers, captureEligible: samples === 1 ? opts.maxFrames > 0 : frameAttempts < opts.maxFrames - 1 });
      // Reserve a frame for final readback when the budget permits.
      if (opts.maxFrames && samples === 1) await frame('baseline');
      else if (triggers.length && frameAttempts < opts.maxFrames - 1) await frame(`match:${triggers.join(',')}`);
      prior = current;
    } catch (e) {
      errors.push(String(e)); await emit({ type: 'observation-error', error: String(e), resyncRequired: true });
      break;
    }
    if (now() - started >= opts.durationMs) break;
    await sleep(Math.min(Math.max(0, opts.intervalMs - (now() - sampleStarted)), opts.durationMs - (now() - started)));
  }
  if (frameAttempts < opts.maxFrames) await frame(errors.length ? 'unpaired-final-after-error' : 'final', deadline + finalizationBudgetMs);
  const result = {
    schema: 'ibr.native.capture/v1', complete: errors.length === 0, taskCompletion: 'not-inferred',
    captureMode: 'polling', durationMs: now() - started, requestedIntervalMs: opts.intervalMs,
    samples, largestGapMs, frameAttempts, frames, eventsPath, errors, finalizationBudgetMs,
    oneFramePolicy: 'baseline-only', backendCancellation: 'unavailable; timed-out read-only operations may finish later',
    coverage: { transientStatesBetweenSamples: 'unobserved', pixelChangesWithoutAX: 'keyframes-only',
      semanticCoverage: 'extractor-exposed-elements', screenshotAndAXAtomic: false,
      localFilesystemFinalizationDeadline: 'best-effort; OS writes are not cancellable' },
  };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' });
  return result;
}
