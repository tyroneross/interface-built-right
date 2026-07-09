#!/usr/bin/env python3
"""Validate MCP registration for both supported plugin hosts.

Stdlib only. Run: python3 scripts/test_mcp_registration.py
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MCP_CONFIGS = {
    "claude": REPO_ROOT / ".mcp.json",
    "codex": REPO_ROOT / ".codex-plugin" / "mcp.json",
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


class McpRegistrationTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
