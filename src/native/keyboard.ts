/** Keyboard synthesis: one explicitly selected delivery, followed by AX observation.
 * An unchanged tree does not prove a key was ignored. Never repeat it automatically.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ensureExtractor } from './extract.js';
import { findProcess } from './index.js';
import { axSignature } from './ax-signature.js';
import type { ActionOutcome } from '../action-outcome.js';
import type { KeystrokeSpec, NativeExtraction, NativeSessionTarget } from './backend.js';

const execFileAsync = promisify(execFile);

/** Settle delay between delivering a chord and re-extracting to check its effect. */
const SETTLE_MS = 220;

export interface KeystrokeDeliveryResult {
  success: boolean;
  error?: string;
}

export type KeystrokeDeliverFn = (
  pid: number,
  chord: string,
  foreground: boolean,
) => Promise<KeystrokeDeliveryResult>;

/** Resolve the pid a keystroke chord should target, for either target kind. */
export async function resolveKeystrokeTargetPid(target: NativeSessionTarget): Promise<number> {
  if (target.kind === 'macos') return target.pid;
  return findProcess('com.apple.iphonesimulator');
}

/**
 * Deliver a chord via the one-shot Swift extractor binary — the path
 * `RespawnBackend` always uses, and `DaemonBackend`'s respawn fallback uses
 * before any daemon request was dispatched.
 */
export const deliverKeystrokeOneShot: KeystrokeDeliverFn = async (pid, chord, foreground) => {
  const extractorPath = await ensureExtractor();
  const args: string[] = ['--pid', String(pid), '--keystroke', chord];
  if (foreground) args.push('--foreground');

  try {
    const { stdout } = await execFileAsync(extractorPath, args, { timeout: 5000 });
    return JSON.parse(stdout) as KeystrokeDeliveryResult;
  } catch (err: unknown) {
    // The binary exits 1 on failure — try to parse stdout for structured error.
    if (err && typeof err === 'object' && 'stdout' in err) {
      const execErr = err as { stdout?: string };
      const raw = (execErr.stdout ?? '').trim();
      if (raw) {
        try {
          return JSON.parse(raw) as KeystrokeDeliveryResult;
        } catch {
          // Fall through to the generic error below.
        }
      }
    }
    const message = err instanceof Error ? err.message : 'keystroke delivery failed';
    return { success: false, error: message };
  }
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function keystrokeSuccess(chord: string, method: string, before: string, after: string): ActionOutcome {
  return {
    success: true,
    validator: {
      expected: `AX state changes after delivering chord "${chord}"`,
      observed: `AX state changed (${method}): ${before} -> ${after}`,
      passed: true,
    },
    provenance: { waitResult: method },
  };
}

function keystrokeFailure(chord: string, before: string, after: string, diff: string): ActionOutcome {
  return {
    success: false,
    validator: {
      expected: `AX state changes after delivering chord "${chord}"`,
      observed: diff,
      passed: false,
    },
    provenance: {},
    evidence: {
      beforeSignature: before,
      afterSignature: after,
      diff,
      alternatives: [],
    },
  };
}

/** Deliver once; report unobservable effects without retrying. */
export async function runKeystrokeCapability(opts: {
  target: NativeSessionTarget;
  spec: KeystrokeSpec;
  resolvePid: () => Promise<number>;
  extract: () => Promise<NativeExtraction>;
  deliver: KeystrokeDeliverFn;
}): Promise<ActionOutcome> {
  const { spec, resolvePid, extract, deliver } = opts;
  const chord = spec.chord;

  const safeSignature = async (): Promise<string> => {
    try {
      return axSignature(await extract());
    } catch (err) {
      return `error:${err instanceof Error ? err.message : String(err)}`;
    }
  };

  try {
    const pid = await resolvePid();
    const before = await safeSignature();

    if (spec.delivery !== undefined && spec.delivery !== 'background' && spec.delivery !== 'foreground') {
      return keystrokeFailure(chord, before, before, 'delivery must be background or foreground; no key sent');
    }
    if (before.startsWith('error:')) return keystrokeFailure(chord, before, before, 'Pre-action AX observation failed; no key sent');
    const foreground = spec.delivery === 'foreground';
    const delivery = await deliver(pid, chord, foreground);
    if (delivery.success !== true) return keystrokeFailure(chord, before, before, `delivery failed or uncertain: ${delivery.error ?? 'unknown error'}`);
    await sleep(SETTLE_MS);
    const after = await safeSignature();
    if (!after.startsWith('error:') && after !== before) {
      return keystrokeSuccess(chord, foreground ? 'cgevent-foreground' : 'cgevent-pid-background', before, after);
    }
    return keystrokeFailure(chord, before, after,
      'Chord delivered once; effect unobservable in AX. Inspect before another action; no automatic retry was sent.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return keystrokeFailure(chord, 'unavailable', 'unavailable', `keystroke capability failed: ${message}`);
  }
}
