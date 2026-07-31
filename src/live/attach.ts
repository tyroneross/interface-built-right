/**
 * Attach to an ALREADY-RUNNING browser target (Electron app, Obsidian, a real
 * Chrome tab) and hold a CDP session against it.
 *
 * Hard constraints, because the subject is someone's live application:
 *   - never `Target.createTarget`
 *   - never `Page.navigate` / `Page.reload`
 *   - never `Target.closeTarget`
 * The only mutation-free primitives used are `Target.getTargets`,
 * `Target.attachToTarget`, `Runtime.evaluate`, `Target.detachFromTarget`.
 */

import { CdpConnection } from '../engine/cdp/connection.js';
import { TargetDomain, type TargetInfo } from '../engine/cdp/target.js';

export const DEFAULT_CDP_PROBE_TIMEOUT_MS = 4000;

export interface LiveTarget {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
}

export interface LiveAttachOptions {
  /** CDP HTTP endpoint, e.g. http://127.0.0.1:9222 */
  cdpUrl?: string;
  /** Browser-level CDP WebSocket endpoint (skips the HTTP probe) */
  wsEndpoint?: string;
  /** Case-insensitive substring match against the target's title */
  targetTitle?: string;
  /** Case-insensitive substring match against the target's URL */
  targetUrl?: string;
  /** Exact target id (wins over title/url) */
  targetId?: string;
  /** HTTP probe timeout, ms. Default 4000. */
  probeTimeoutMs?: number;
}

/**
 * Thrown when the CDP endpoint is unreachable. Carries a message that names the
 * URL, states plainly that nothing answered, and says what to do — the existing
 * `resolveWsEndpoint` in `engine/cdp/browser.ts` surfaces a naked
 * `TypeError: fetch failed` with none of that.
 */
export class LiveAttachError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveAttachError';
  }
}

function deadEndpointMessage(cdpUrl: string, timeoutMs: number, cause: string): string {
  return [
    `No CDP endpoint answered at ${cdpUrl}.`,
    `Nothing is listening there (${cause}; gave up after ${timeoutMs}ms).`,
    '',
    'To fix:',
    '  1. Start the app with remote debugging enabled, e.g.',
    '       Obsidian: launch with --remote-debugging-port=9222',
    '       Chrome:   /path/to/chrome --remote-debugging-port=9222',
    `  2. Confirm it is up:  curl ${cdpUrl}/json/version`,
    `  3. Re-run with --cdp-url ${cdpUrl}`,
  ].join('\n');
}

/**
 * Resolve the browser-level WebSocket endpoint, with a timeout and a diagnosis.
 */
export async function resolveLiveWsEndpoint(
  options: LiveAttachOptions,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{
  wsEndpoint: string;
  cdpUrl?: string;
}> {
  // Explicit flags beat environment, and within each level a WebSocket
  // endpoint beats an HTTP one (it needs no probe). Deliberately NOT
  // `resolveBrowserConnectionOptions`, whose env-wins-over-flag ordering would
  // let a stray IBR_WS_ENDPOINT silently redirect an explicit --cdp-url.
  if (options.wsEndpoint) {
    return { wsEndpoint: options.wsEndpoint, cdpUrl: options.cdpUrl };
  }
  if (!options.cdpUrl && env.IBR_WS_ENDPOINT) {
    return { wsEndpoint: env.IBR_WS_ENDPOINT, cdpUrl: env.IBR_CDP_URL };
  }

  const cdpUrl = options.cdpUrl || env.IBR_CDP_URL;
  if (!cdpUrl) {
    throw new LiveAttachError(
      'No CDP endpoint given. Pass --cdp-url http://127.0.0.1:9222 '
      + '(or --ws-endpoint ws://..., or set IBR_CDP_URL).',
    );
  }

  const timeoutMs = options.probeTimeoutMs ?? DEFAULT_CDP_PROBE_TIMEOUT_MS;
  const base = cdpUrl.replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const reason = error instanceof Error
      ? (error.name === 'TimeoutError' ? 'connection timed out' : error.message)
      : String(error);
    throw new LiveAttachError(deadEndpointMessage(base, timeoutMs, reason));
  }

  if (!res.ok) {
    throw new LiveAttachError(
      deadEndpointMessage(base, timeoutMs, `HTTP ${res.status} from /json/version`),
    );
  }

  const data = (await res.json()) as { webSocketDebuggerUrl?: string };
  if (!data.webSocketDebuggerUrl) {
    throw new LiveAttachError(
      `${base}/json/version answered but returned no webSocketDebuggerUrl. `
      + 'That endpoint is not a Chrome DevTools Protocol server.',
    );
  }
  return { wsEndpoint: data.webSocketDebuggerUrl, cdpUrl: base };
}

function describe(t: LiveTarget): string {
  return `  ${t.type.padEnd(7)} ${JSON.stringify(t.title)}  ${t.url}`;
}

/**
 * Pick exactly one page target. Refuses to guess: an ambiguous match is an
 * error, because picking the wrong window means auditing the wrong app.
 */
export function selectTarget(targets: LiveTarget[], options: LiveAttachOptions): LiveTarget {
  const pages = targets.filter((t) => t.type === 'page');

  if (options.targetId) {
    const exact = targets.find((t) => t.targetId === options.targetId);
    if (!exact) {
      throw new LiveAttachError(
        `No target with id ${options.targetId}.\nAvailable targets:\n`
        + targets.map(describe).join('\n'),
      );
    }
    return exact;
  }

  if (pages.length === 0) {
    throw new LiveAttachError(
      'The browser is running but exposes no page targets.\nTargets seen:\n'
      + (targets.length ? targets.map(describe).join('\n') : '  (none)'),
    );
  }

  const needleTitle = options.targetTitle?.toLowerCase();
  const needleUrl = options.targetUrl?.toLowerCase();

  let matches = pages;
  if (needleTitle) {
    matches = matches.filter((t) => t.title.toLowerCase().includes(needleTitle));
  }
  if (needleUrl) {
    matches = matches.filter((t) => t.url.toLowerCase().includes(needleUrl));
  }

  if (matches.length === 0) {
    const filter = [
      needleTitle ? `title contains ${JSON.stringify(options.targetTitle)}` : null,
      needleUrl ? `url contains ${JSON.stringify(options.targetUrl)}` : null,
    ].filter(Boolean).join(' and ');
    throw new LiveAttachError(
      `No page target matched ${filter}.\nPage targets available:\n`
      + pages.map(describe).join('\n'),
    );
  }

  if (matches.length > 1) {
    throw new LiveAttachError(
      `${matches.length} page targets matched — refusing to guess which live window to measure.\n`
      + 'Narrow it with --target-title, --target-url, or --target-id:\n'
      + matches.map((t) => `${describe(t)}  [id ${t.targetId}]`).join('\n'),
    );
  }

  return matches[0];
}

export function toLiveTarget(info: TargetInfo): LiveTarget {
  return {
    targetId: info.targetId,
    type: info.type,
    title: info.title ?? '',
    url: info.url ?? '',
    attached: Boolean(info.attached),
  };
}

export interface LiveAttachment {
  connection: CdpConnection;
  sessionId: string;
  target: LiveTarget;
  wsEndpoint: string;
  cdpUrl?: string;
  /** Evaluate an expression in the page's main world. Read-only by contract. */
  evaluate<T = unknown>(expression: string): Promise<T>;
  /** Detach the session and close the socket. The page keeps running. */
  release(): Promise<void>;
}

/** List every target the running browser exposes. */
export async function listLiveTargets(options: LiveAttachOptions): Promise<{
  targets: LiveTarget[];
  wsEndpoint: string;
  cdpUrl?: string;
}> {
  const { wsEndpoint, cdpUrl } = await resolveLiveWsEndpoint(options);
  const connection = new CdpConnection();
  try {
    await connection.connect(wsEndpoint);
    const targets = (await new TargetDomain(connection).listDetailed()).map(toLiveTarget);
    return { targets, wsEndpoint, cdpUrl };
  } finally {
    await connection.close();
  }
}

/** Attach to one already-running page target. Creates nothing, navigates nowhere. */
export async function attachToLiveTarget(options: LiveAttachOptions): Promise<LiveAttachment> {
  const { wsEndpoint, cdpUrl } = await resolveLiveWsEndpoint(options);
  const connection = new CdpConnection();
  await connection.connect(wsEndpoint);

  let sessionId: string;
  let target: LiveTarget;
  const domain = new TargetDomain(connection);
  try {
    const targets = (await domain.listDetailed()).map(toLiveTarget);
    target = selectTarget(targets, options);
    sessionId = await domain.attach(target.targetId);
  } catch (error) {
    await connection.close();
    throw error;
  }

  return {
    connection,
    sessionId,
    target,
    wsEndpoint,
    cdpUrl,
    async evaluate<T = unknown>(expression: string): Promise<T> {
      const result = await connection.send<{
        result: { value?: unknown };
        exceptionDetails?: { text: string; exception?: { description?: string } };
      }>(
        'Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
      );
      if (result.exceptionDetails) {
        const msg = result.exceptionDetails.exception?.description
          ?? result.exceptionDetails.text;
        throw new LiveAttachError(`Evaluation failed in the live page: ${msg}`);
      }
      return result.result.value as T;
    },
    async release(): Promise<void> {
      try {
        await domain.detach(sessionId);
      } catch {
        // Detach is best-effort; closing the socket releases the session anyway.
      }
      await connection.close();
    },
  };
}
