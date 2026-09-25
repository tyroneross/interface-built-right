#!/usr/bin/env python3
"""Activation-path tests for hooks/ibr-playwright-tip.sh.

Stdlib only. Run: python3 scripts/test_playwright_tip_hook.py

This hook fires on Write|Edit|Bash for EVERY project that installs IBR. Its
entire safety property is "advisory only, never blocks" — tested here by
feeding sample tool-call JSON on stdin and asserting: a Playwright pattern
produces a tip, anything else produces `{}`, malformed input still produces
`{}`, and the exit code is always 0.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
HOOK = REPO / "hooks" / "ibr-playwright-tip.sh"


@unittest.skipUnless(shutil.which("jq"), "hook requires jq")
@unittest.skipUnless(HOOK.is_file(), "hook script not present")
class PlaywrightTipHookTests(unittest.TestCase):
    def _run(self, payload) -> subprocess.CompletedProcess:
        stdin = payload if isinstance(payload, str) else json.dumps(payload)
        return subprocess.run(
            ["bash", str(HOOK)], input=stdin, capture_output=True, text=True,
        )

    # -- matches --------------------------------------------------------
    def test_write_with_require_playwright_fires(self):
        r = self._run({
            "tool_name": "Write",
            "tool_input": {
                "file_path": "/tmp/x.ts",
                "content": "const { chromium } = require('playwright');",
            },
        })
        self.assertEqual(0, r.returncode)
        out = json.loads(r.stdout)
        self.assertIn("Playwright", out.get("systemMessage", ""))
        self.assertEqual("PreToolUse", out["hookSpecificOutput"]["hookEventName"])
        self.assertIn("session:start", out["hookSpecificOutput"]["additionalContext"])

    def test_edit_with_playwright_test_import_fires(self):
        r = self._run({
            "tool_name": "Edit",
            "tool_input": {
                "file_path": "/tmp/x.ts",
                "old_string": "a",
                "new_string": "import { test } from '@playwright/test';",
            },
        })
        self.assertEqual(0, r.returncode)
        out = json.loads(r.stdout)
        self.assertIn("Playwright", out.get("systemMessage", ""))

    def test_bash_chromium_launch_fires(self):
        r = self._run({
            "tool_name": "Bash",
            "tool_input": {"command": "node -e \"chromium.launch({headless:true})\""},
        })
        self.assertEqual(0, r.returncode)
        out = json.loads(r.stdout)
        self.assertIn("Playwright", out.get("systemMessage", ""))

    def test_tip_never_mentions_ibr_run(self):
        r = self._run({
            "tool_name": "Bash",
            "tool_input": {"command": "npm install -D @playwright/test"},
        })
        out = json.loads(r.stdout)
        tip = out["hookSpecificOutput"]["additionalContext"]
        self.assertNotIn("ibr run ", tip)

    # -- no match ---------------------------------------------------------
    def test_unrelated_write_is_silent(self):
        r = self._run({
            "tool_name": "Write",
            "tool_input": {"file_path": "/tmp/y.ts", "content": "const a = 1;"},
        })
        self.assertEqual(0, r.returncode)
        self.assertEqual("{}", r.stdout.strip())

    def test_unrelated_tool_is_silent(self):
        r = self._run({
            "tool_name": "Read",
            "tool_input": {"file_path": "/tmp/y.ts"},
        })
        self.assertEqual(0, r.returncode)
        self.assertEqual("{}", r.stdout.strip())

    # -- fail-open ----------------------------------------------------------
    def test_malformed_json_stays_silent_and_exits_zero(self):
        r = self._run("not json at all")
        self.assertEqual(0, r.returncode)
        self.assertEqual("{}", r.stdout.strip())

    def test_empty_stdin_stays_silent_and_exits_zero(self):
        r = self._run("")
        self.assertEqual(0, r.returncode)
        self.assertEqual("{}", r.stdout.strip())

    def test_always_exits_zero_even_on_match(self):
        r = self._run({
            "tool_name": "Write",
            "tool_input": {"file_path": "/tmp/x.ts", "content": "from 'playwright'"},
        })
        self.assertEqual(0, r.returncode)


if __name__ == "__main__":
    unittest.main(verbosity=2)
