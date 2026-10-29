// SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
// SPDX-License-Identifier: Apache-2.0
/**
 * The MCP server and CLI must report package.json's version, never a literal
 * that can drift from it.
 */
import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const root = resolve(__dirname, "..", "..");
const pkgVersion = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version as string;
const distServer = resolve(root, "dist", "mcp", "server.js");

describe("server version source", () => {
  it("has no hard-coded semver literal in server.ts", () => {
    const src = readFileSync(resolve(root, "src/mcp/server.ts"), "utf8");
    expect(src).not.toMatch(/version:\s*["']\d+\.\d+\.\d+["']/);
  });

  it("has no hard-coded semver literal in ibr.ts .version()", () => {
    const src = readFileSync(resolve(root, "src/bin/ibr.ts"), "utf8");
    expect(src).not.toMatch(/\.version\(\s*["']\d+\.\d+\.\d+/);
  });

  it.skipIf(!existsSync(distServer))(
    "built MCP server reports package.json version on initialize",
    async () => {
      const child = spawn("node", [distServer], { stdio: ["pipe", "pipe", "ignore"] });
      try {
        const version = await new Promise<string>((res, rej) => {
          const timer = setTimeout(() => rej(new Error("initialize timed out")), 10000);
          const rl = createInterface({ input: child.stdout! });
          rl.on("line", (line) => {
            try {
              const msg = JSON.parse(line);
              if (msg.id === 1) {
                clearTimeout(timer);
                res(msg.result.serverInfo.version);
              }
            } catch {
              // ignore non-JSON lines
            }
          });
          child.on("error", rej);
          child.stdin!.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "initialize",
              params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "t", version: "0" },
              },
            }) + "\n"
          );
        });
        expect(version).toBe(pkgVersion);
      } finally {
        child.kill();
      }
    },
    15000
  );
});
