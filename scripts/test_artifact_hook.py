#!/usr/bin/env python3
"""Activation-path tests for the artifact-lint arm of ibr-post-change.sh.

Stdlib only. Run: python3 test_artifact_hook.py

This hook fires on Write|Edit in EVERY project that installs IBR. The opt-in gate
is the entire safety property, so it is tested in both directions: silent without
config, and only then firing with it. Reading the script and concluding it is
gated is not verification — these tests execute it.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
HOOK = REPO / "hooks" / "ibr-post-change.sh"

sys.path.insert(0, str(HERE))
from test_artifact_lint import CLEAN  # noqa: E402

DIRTY = ('<title>Dashboard</title>\n'
         '<script src="https://cdn.test/a.js"></script>\n'
         '<style>body{color:#111}</style>\n<p>x</p>\n')


@unittest.skipUnless(shutil.which("jq"), "hook requires jq")
@unittest.skipUnless(HOOK.is_file(), "hook script not present")
class HookGateTests(unittest.TestCase):
    def _run(self, workdir: str, file_path: str) -> subprocess.CompletedProcess:
        payload = json.dumps({"tool_input": {"file_path": file_path}})
        return subprocess.run(
            ["bash", str(HOOK)], input=payload, capture_output=True, text=True,
            cwd=workdir, env={**os.environ, "CLAUDE_PROJECT_DIR": workdir},
        )

    def _project(self, td: str, html: str, config: dict | None,
                 name: str = "page.html") -> str:
        p = Path(td) / name
        p.write_text(html, encoding="utf-8")
        if config is not None:
            (Path(td) / ".ibrrc.json").write_text(json.dumps(config), encoding="utf-8")
        return str(p)

    # -- the gate -----------------------------------------------------------
    def test_silent_without_any_ibrrc(self):
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, DIRTY, None)
            r = self._run(td, f)
            self.assertEqual(0, r.returncode)
            self.assertEqual("", r.stdout.strip())

    def test_silent_when_ibrrc_omits_the_key(self):
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, DIRTY, {"baseUrl": "http://localhost:3000"})
            self.assertEqual("", self._run(td, f).stdout.strip())

    def test_silent_when_explicitly_disabled(self):
        with tempfile.TemporaryDirectory() as td:
            for cfg in ({"artifactLint": False}, {"artifactLint": {"enabled": False}}):
                f = self._project(td, DIRTY, cfg)
                self.assertEqual("", self._run(td, f).stdout.strip(), str(cfg))

    # -- opted in -----------------------------------------------------------
    def test_fires_with_boolean_true(self):
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, DIRTY, {"artifactLint": True})
            out = self._run(td, f).stdout
            self.assertIn("IBR artifact lint", out)
            self.assertIn("AX002", out)

    def test_fires_with_object_form(self):
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, DIRTY, {"artifactLint": {"enabled": True}})
            self.assertIn("AX002", self._run(td, f).stdout)

    def test_clean_page_stays_silent_even_when_enabled(self):
        """Opting in must not mean noise on every write."""
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, CLEAN, {"artifactLint": True})
            self.assertEqual("", self._run(td, f).stdout.strip())

    def test_min_severity_is_honored(self):
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, DIRTY,
                              {"artifactLint": {"enabled": True, "minSeverity": "error"}})
            out = self._run(td, f).stdout
            self.assertIn("AX002", out)
            self.assertNotIn("AD303", out)

    def test_disable_list_is_honored(self):
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, DIRTY,
                              {"artifactLint": {"enabled": True, "disable": "AX002"}})
            self.assertNotIn("AX002", self._run(td, f).stdout)

    # -- scope --------------------------------------------------------------
    def test_non_html_is_ignored(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "app.tsx"
            p.write_text("export const A = 1;\n", encoding="utf-8")
            (Path(td) / ".ibrrc.json").write_text('{"artifactLint": true}', encoding="utf-8")
            self.assertEqual("", self._run(td, str(p)).stdout.strip())

    def test_missing_file_is_ignored(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / ".ibrrc.json").write_text('{"artifactLint": true}', encoding="utf-8")
            r = self._run(td, str(Path(td) / "gone.html"))
            self.assertEqual(0, r.returncode)
            self.assertEqual("", r.stdout.strip())

    # -- never blocks -------------------------------------------------------
    def test_always_exits_zero(self):
        """PostToolUse advisory: findings inform, they never fail the write."""
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, DIRTY, {"artifactLint": True})
            self.assertEqual(0, self._run(td, f).returncode)

    def test_malformed_ibrrc_does_not_break_the_hook(self):
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, DIRTY, None)
            (Path(td) / ".ibrrc.json").write_text("{not json", encoding="utf-8")
            r = self._run(td, f)
            self.assertEqual(0, r.returncode)
            self.assertEqual("", r.stdout.strip())

    def test_dev_server_arm_still_gated_on_baseline(self):
        """The pre-existing flow must not start running just because we read stdin earlier."""
        with tempfile.TemporaryDirectory() as td:
            f = self._project(td, CLEAN, {"artifactLint": True})
            out = self._run(td, f).stdout
            self.assertNotIn("Post-Change Verification", out)
            self.assertNotIn("scan failed", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
