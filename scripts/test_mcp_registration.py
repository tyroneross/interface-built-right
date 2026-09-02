#!/usr/bin/env python3
"""Validate MCP registration for both supported plugin hosts.

The MCP server ships DORMANT on both hosts. cb4a561 moved the Claude config out
of auto-discovery and fa75a42 did the same for Codex, because this plugin is
CLI-first and a background server nobody asked for is a cost the user pays on
every session. Each host reads its own file, so each host needs its own opt-out,
and the one-host-only miss fa75a42 fixed is the exact regression these tests
exist to catch.

So there are two invariants, not one:
  1. Each host's opt-in config is present, well-formed, and actually runnable —
     a user who opts in must not land on a broken command.
  2. Neither host's AUTO-DISCOVERY path is populated — no `.mcp.json`, no
     `.codex-plugin/mcp.json`, and no `mcpServers` key in either manifest.
     Restoring any one of those silently re-arms the server for that host only.

Stdlib only. Run: python3 scripts/test_mcp_registration.py
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent

# Opt-in configs. A user copies one of these into place deliberately.
MCP_CONFIGS = {
    "claude": REPO_ROOT / "optional-mcp" / "mcp.json",
    "codex": REPO_ROOT / "optional-mcp" / "codex-mcp.json",
}

# Paths each host auto-discovers. Populated => the server starts unasked.
AUTO_DISCOVERY_PATHS = {
    "claude": REPO_ROOT / ".mcp.json",
    "codex": REPO_ROOT / ".codex-plugin" / "mcp.json",
}

PLUGIN_MANIFESTS = {
    "claude": REPO_ROOT / ".claude-plugin" / "plugin.json",
    "codex": REPO_ROOT / ".codex-plugin" / "plugin.json",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_servers(path: Path) -> dict:
    config = load_json(path)
    servers = config.get("mcpServers")
    if not isinstance(servers, dict):
        raise AssertionError(f"{path.relative_to(REPO_ROOT)} mcpServers must be an object")
    return servers


def expand_plugin_root(arg: str) -> str:
    return arg.replace("${CLAUDE_PLUGIN_ROOT}", str(REPO_ROOT))


class McpOptInConfigTests(unittest.TestCase):
    """A user who opts in must get a config that works."""

    def test_host_mcp_configs_exist_and_are_valid(self) -> None:
        for host, path in MCP_CONFIGS.items():
            with self.subTest(host=host):
                self.assertTrue(path.is_file(), f"missing {path.relative_to(REPO_ROOT)}")
                servers = load_servers(path)
                self.assertGreater(len(servers), 0, f"{host} MCP config declares no servers")

    def test_server_names_are_unique_within_each_host_config(self) -> None:
        for host, path in MCP_CONFIGS.items():
            with self.subTest(host=host):
                servers = load_servers(path)
                self.assertEqual(len(servers), len(set(servers)), f"duplicate server names in {host}")

    def test_node_server_args_resolve(self) -> None:
        for host, path in MCP_CONFIGS.items():
            for name, config in load_servers(path).items():
                with self.subTest(host=host, server=name):
                    self.assertIsInstance(config, dict)
                    self.assertTrue(config.get("command"), "MCP server command is required")
                    for arg in config.get("args", []):
                        if "${CLAUDE_PLUGIN_ROOT}" not in arg:
                            continue
                        resolved = Path(expand_plugin_root(arg))
                        if resolved.suffix:
                            self.assertTrue(
                                resolved.exists(),
                                f"server {name!r} references missing path {resolved}",
                            )


class McpDormancyTests(unittest.TestCase):
    """Neither host may start the server without the user asking."""

    def test_auto_discovery_paths_are_empty(self) -> None:
        for host, path in AUTO_DISCOVERY_PATHS.items():
            with self.subTest(host=host):
                self.assertFalse(
                    path.is_file(),
                    f"{path.relative_to(REPO_ROOT)} exists — the MCP server auto-starts on "
                    f"{host} again. The opt-in copy belongs in optional-mcp/.",
                )

    def test_manifests_declare_no_mcp_servers(self) -> None:
        for host, path in PLUGIN_MANIFESTS.items():
            with self.subTest(host=host):
                if not path.is_file():
                    continue
                self.assertNotIn(
                    "mcpServers",
                    load_json(path),
                    f"{path.relative_to(REPO_ROOT)} declares mcpServers — that re-arms the "
                    f"background server on {host} only, the exact one-host miss fa75a42 fixed.",
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
