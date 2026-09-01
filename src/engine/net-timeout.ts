/**
 * Bounded network primitives for every connect/spawn path.
 *
 * Node's `fetch()` and `new WebSocket()` have NO default deadline. A peer that
 * completes the TCP handshake and then never answers blocks both forever —
 * measured on 2026-09-01 against a socket that accepts and never responds:
 * both were still pending at 25s with no error and no output. That is how a
 * one-line liveness probe turns into an indefinite hang.
 *
 * Connection-refused is fast, so the dangerous case is not a dead port. It is a
 * port that IS listening and belongs to something else — an ephemeral CDP port
 * (49152-65535) recycled to another process while a stale manifest still names
 * it — or a Chrome that bound the port under load and stalled before serving
 * /json/version.
 *
 * Every helper here names WHAT it was waiting on in the failure message, so a
 * timeout is a diagnosis and not just an abort.
 */

/** CDP HTTP probe (`GET /json/version`). Short: it is a liveness question. */
export const CDP_PROBE_TIMEOUT_MS = envMs('IBR_CDP_PROBE_TIMEOUT_MS', 3000);

/** CDP WebSocket upgrade. Longer: a busy browser can be slow to accept. */
export const WS_CONNECT_TIMEOUT_MS = envMs('IBR_WS_CONNECT_TIMEOUT_MS', 10_000);

/** Chrome spawn → debugger answering. Covers a cold start on a loaded machine. */
export const BROWSER_SPAWN_TIMEOUT_MS = envMs('IBR_BROWSER_SPAWN_TIMEOUT_MS', 30_000);

function envMs(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Thrown when a bounded operation ran out of time. Distinct from a transport
 * error so callers can tell "no answer in time" from "actively refused".
 */
export class ConnectTimeoutError extends Error {
  constructor(
    /** Human phrase for what was awaited, e.g. `CDP probe http://…/json/version`. */
    public readonly waitingOn: string,
    public readonly timeoutMs: number,
    public readonly elapsedMs: number = timeoutMs,
  ) {
    super(
      `Timed out after ${elapsedMs}ms waiting on ${waitingOn} `
      + `(limit ${timeoutMs}ms). The endpoint accepted the connection or was `
      + 'unreachable but never answered.',
    );
    this.name = 'ConnectTimeoutError';
  }
}

/**
 * `fetch()` with a hard deadline. Converts the AbortError into a message that
 * names the URL and the limit, so a caller printing `error.message` says what
 * it was waiting on without extra plumbing.
 */
export async function fetchWithTimeout(
  url: string,
  options: { timeoutMs?: number; waitingOn?: string } & RequestInit = {},
): Promise<Response> {
  const { timeoutMs = CDP_PROBE_TIMEOUT_MS, waitingOn = url, ...init } = options;
  const started = Date.now();
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (isAbort(err)) {
      throw new ConnectTimeoutError(waitingOn, timeoutMs, Date.now() - started);
    }
    throw err;
  }
}

/**
 * Bound any promise. Note the losing promise keeps running — callers that own
 * a socket must still close it in their own timeout path.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  waitingOn: string,
): Promise<T> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ConnectTimeoutError(waitingOn, timeoutMs, Date.now() - started)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isAbort(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}
