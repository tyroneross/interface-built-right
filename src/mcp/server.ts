#!/usr/bin/env node
/**
 * IBR (Interface Built Right) MCP Server
 *
 * JSON-RPC 2.0 over stdio (MCP protocol).
 * Exposes UI validation tools: scan, snapshot, compare, list_sessions.
 */

import { createInterface } from "readline";
import { TOOLS, handleToolCall, closeMcpBrowserPool } from "./tools.js";

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
process.on("beforeExit", () => {
  shutdownPool();
});

// --- JSON-RPC transport over stdio ---

const rl = createInterface({ input: process.stdin, terminal: false });
let buffer = "";

rl.on("line", (line) => {
  buffer += line;
  try {
    const msg = JSON.parse(buffer);
    buffer = "";
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
