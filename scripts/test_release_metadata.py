#!/usr/bin/env python3
"""Verify that every shipped IBR metadata surface carries one version."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = REPO_ROOT / "package.json"
CLAUDE_PLUGIN_JSON = REPO_ROOT / ".claude-plugin" / "plugin.json"
CODEX_PLUGIN_JSON = REPO_ROOT / ".codex-plugin" / "plugin.json"
MARKETPLACE_JSON = REPO_ROOT / ".claude-plugin" / "marketplace.json"
UNIVERSAL_TOOLS = REPO_ROOT / "universal" / "tools.yaml"
SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class ReleaseMetadataTests(unittest.TestCase):
    @property
    def package_version(self) -> str:
        return load_json(PACKAGE_JSON)["version"]

    def test_package_version_is_semver(self) -> None:
        self.assertRegex(self.package_version, SEMVER_RE)

    def test_plugin_manifest_versions_match_package(self) -> None:
        # Plugin manifests use auto-SHA (version omitted → resolves to git commit SHA).
        # Assert a match only for a version that IS set; an omitted version is valid.
        for label, path in {
            "Claude plugin": CLAUDE_PLUGIN_JSON,
            "Codex plugin": CODEX_PLUGIN_JSON,
        }.items():
            with self.subTest(surface=label):
                v = load_json(path).get("version")
                if v is not None:
                    self.assertEqual(v, self.package_version)

    def test_marketplace_metadata_matches_package(self) -> None:
        marketplace = load_json(MARKETPLACE_JSON)
        self.assertEqual(marketplace.get("metadata", {}).get("version"), self.package_version)
        plugins = [plugin for plugin in marketplace.get("plugins", []) if plugin.get("name") == "ibr"]
        self.assertEqual(len(plugins), 1, "marketplace must contain exactly one IBR plugin entry")
        entry_v = plugins[0].get("version")  # omitted under auto-SHA; if set it must match
        if entry_v is not None:
            self.assertEqual(entry_v, self.package_version)

    def test_universal_tool_metadata_matches_package(self) -> None:
        contents = UNIVERSAL_TOOLS.read_text(encoding="utf-8")
        match = re.search(r'^  version:\s*"?([^"\s]+)"?\s*$', contents, re.MULTILINE)
        self.assertIsNotNone(match, "universal/tools.yaml meta.version is missing")
        self.assertEqual(match.group(1), self.package_version)


if __name__ == "__main__":
    unittest.main(verbosity=2)
