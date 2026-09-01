#!/usr/bin/env node
/**
 * IBR (Interface Built Right) MCP Server
 *
 * JSON-RPC 2.0 over stdio (MCP protocol).
 * Exposes UI validation tools: scan, snapshot, compare, list_sessions.
 */

import { createInterface } from "readline";
import { TOOLS, handleToolCall, closeMcpBrowserPool } from "./tools.js";
import { configuredSessionIdleMs } from "../session-idle.js";
import { sweepIdleSessions } from "./sessions.js";
import { ensureToolchainPath } from "../native/toolchain-env.js";

// Repair PATH before any native tool spawns swift/xcrun/osascript. A GUI/MCP
// parent (Claude Code) hands us a minimal launchd PATH lacking /usr/bin +
// the Xcode toolchain, which is what made scan_macos fail with "swift ENOENT".
ensureToolchainPath();

// Best-effort cleanup of the warm browser pool on graceful exit. The pool is
// lazy-init in tools.ts; this just closes it if it was ever opened. Hard
// kills (SIGKILL) skip this — Chrome process is reaped by the OS.
let cleanedUp = false;
async function shutdownPool() {
  if (cleanedUp) return;
  cleanedUp = true;
  try {
    await closeMcpBrowserPool();
  } catch {
    // never throw from a signal handler
  }
}
process.on("SIGINT", () => {
  shutdownPool().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  shutdownPool().finally(() => process.exit(0));
});
process.on("SIGHUP", () => {
  shutdownPool().finally(() => process.exit(0));
});
process.on("beforeExit", () => {
  shutdownPool();
});

// --- Lifecycle L3: parent-death watchdog ---
// Poll ppid every 5s (per mcp-lifecycle SPEC.md L3). If this process gets
// reparented to init/launchd (ppid becomes 1), the host that spawned us died
// without delivering a signal or closing stdin (hard kill). Flush and exit 0.
const PPID_POLL_MS = 5000;
const ppidWatchdog = setInterval(() => {
  if (process.ppid === 1) {
    shutdownPool().finally(() => process.exit(0));
  }
}, PPID_POLL_MS);
// Never let this timer hold the event loop open on its own.
ppidWatchdog.unref();

// --- Lifecycle L4: idle timeout (implemented always, disabled by default) ---
// Tracks the timestamp of the last inbound JSON-RPC frame. If MCP_IDLE_TIMEOUT_MS
// is set and no frame arrives within that window, flush and exit 0.
//
// Default when unset: 0 (disabled). This host does not respawn a stdio MCP
// server once it exits — its tools are deregistered for the rest of the
// session (verified empirically 2026-08-12, see SPEC.md). A non-zero default
// would silently strip this server's tools from any session that goes quiet.
// The variable is read once, unconditionally — no host detection anywhere in
// this file. Enable per deployment via MCP_IDLE_TIMEOUT_MS in the host's MCP
// config, never by branching on who spawned us.
function parseIdleTimeoutMs(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
const IDLE_TIMEOUT_MS = parseIdleTimeoutMs(process.env.MCP_IDLE_TIMEOUT_MS);
let lastFrameAt = Date.now();

if (IDLE_TIMEOUT_MS > 0) {
  const IDLE_POLL_MS = 1000;
  const idleWatchdog = setInterval(() => {
    if (Date.now() - lastFrameAt >= IDLE_TIMEOUT_MS) {
      shutdownPool().finally(() => process.exit(0));
    }
  }, IDLE_POLL_MS);
  idleWatchdog.unref();
}

// --- Session idle sweep ---
// Closes SESSIONS that have gone untouched for IBR_SESSION_IDLE_MS. Distinct
// from L4 above: L4 exits the whole server, this one only releases idle
// browsers and leaves the server serving.
//
// Default: one hour. Every session-addressed tool call refreshes its timestamp,
// so active sessions stay alive. Set IBR_SESSION_IDLE_MS=0 to disable.
const SESSION_IDLE_MS = configuredSessionIdleMs();
if (SESSION_IDLE_MS > 0) {
  const sweep = setInterval(() => {
    void sweepIdleSessions(SESSION_IDLE_MS).then((closed) => {
      if (closed.length > 0) {
        process.stderr.write(
          `ibr-mcp: swept ${closed.length} idle session(s) after ${SESSION_IDLE_MS}ms\n`,
        );
      }
    }).catch(() => { /* sweeping is best-effort; never take the server down */ });
  }, Math.min(SESSION_IDLE_MS, 60_000));
  sweep.unref();
}

// --- JSON-RPC transport over stdio ---

const rl = createInterface({ input: process.stdin, terminal: false });
let buffer = "";

rl.on("line", (line) => {
  buffer += line;
  try {
    const msg = JSON.parse(buffer);
    buffer = "";
    lastFrameAt = Date.now();
    handleMessage(msg);
  } catch {
    // Incomplete JSON, keep buffering
  }
});

function send(msg: unknown) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function sendResult(id: string | number, result: unknown) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id: string | number, code: number, message: string) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

// --- MCP Protocol ---

const SERVER_INFO = {
  name: "ibr",
  version: "1.0.0",
};

const CAPABILITIES = {
  tools: {},
};

// --- Message handler ---

async function handleMessage(msg: {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: unknown;
}) {
  if (msg.jsonrpc !== "2.0") return;

  const { id, method, params } = msg;

  try {
    switch (method) {
      case "initialize": {
        sendResult(id!, {
          protocolVersion: "2025-11-25",
          serverInfo: SERVER_INFO,
          capabilities: CAPABILITIES,
        });
        break;
      }

      case "notifications/initialized": {
        // Client acknowledged — no response needed
        break;
      }

      case "tools/list": {
        sendResult(id!, { tools: TOOLS });
        break;
      }

      case "tools/call": {
        const { name, arguments: args } = params as {
          name: string;
          arguments?: Record<string, unknown>;
        };
        const result = await handleToolCall(name, args || {});
        sendResult(id!, result);
        break;
      }

      default: {
        if (id !== undefined) {
          sendError(id, -32601, `Method not found: ${method}`);
        }
      }
    }
  } catch (err) {
    if (id !== undefined) {
      sendError(
        id,
        -32000,
        err instanceof Error ? err.message : "Internal error"
      );
    }
  }
}

// Log to stderr so it doesn't interfere with the protocol
process.stderr.write("IBR MCP server started\n");
// Dormant/opt-in notice: someone explicitly re-enabled this server (it is no
// longer auto-discovered via .mcp.json at the plugin root), so let them know
// the supported surfaces going forward are the CLI and the programmatic API.
// STDOUT is the MCP transport — this must never write there.
process.stderr.write(
  "[ibr] MCP server is dormant/opt-in. The supported surfaces are the ibr CLI and the programmatic API. See optional-mcp/README.md.\n"
);
