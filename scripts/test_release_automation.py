#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
# SPDX-License-Identifier: Apache-2.0
"""Verify the release automation is wired to itself.

WHY THIS EXISTS. Both publish workflows here trigger on `release: types:
[published]`, and nothing in the repo ever created a release. main sat 50 commits
and 13 days past v1.5.0, and publish-github-packages.yml had run zero times since
it was created three months earlier. Every individual file was valid; the CHAIN
between them was not, and no check looked at the chain.

release-please + a weekly cut now create the release. That introduces a second
silent-failure surface, which is what these tests cover: a bridge dispatching a
workflow file that no longer exists, a `generic` updater pointed at a file with no
version marker (it edits nothing and reports success), or a manifest that drifts
from package.json so the first release PR targets a version already published.

Every assertion below is about a JOIN between two files. Anything checkable inside
one file belongs in test_release_metadata.py.

Stdlib only — no PyYAML. The extractions are targeted line scans, not a general
YAML parser, matching test_release_metadata.py's approach to universal/tools.yaml.
"""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = REPO_ROOT / ".github" / "workflows"
PACKAGE_JSON = REPO_ROOT / "package.json"
RP_CONFIG = REPO_ROOT / "release-please-config.json"
RP_MANIFEST = REPO_ROOT / ".release-please-manifest.json"
RELEASE_PLEASE_WF = WORKFLOWS / "release-please.yml"
WEEKLY_MERGE_WF = WORKFLOWS / "release-weekly-merge.yml"

#: release-please's `generic` updater rewrites only lines carrying this marker.
#: Without it the updater runs, edits nothing, and reports success.
GENERIC_MARKER = "x-release-please-version"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def package_config() -> dict:
    return load_json(RP_CONFIG)["packages"]["."]


def dispatched_workflows() -> list[tuple[str, set[str]]]:
    """(workflow file, input names) for every `gh workflow run` in the bridge."""
    text = RELEASE_PLEASE_WF.read_text(encoding="utf-8")
    out: list[tuple[str, set[str]]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("gh workflow run "):
            continue
        wf = line.split()[3]
        out.append((wf, set(re.findall(r"-f\s+([A-Za-z0-9_]+)=", line))))
    return out


class ReleaseAutomationTests(unittest.TestCase):
    @property
    def package_version(self) -> str:
        return load_json(PACKAGE_JSON)["version"]

    # -- release-please inputs ------------------------------------------------

    def test_manifest_matches_package_version(self) -> None:
        """A drifted manifest makes the first release PR target a shipped version."""
        self.assertEqual(load_json(RP_MANIFEST)["."], self.package_version)

    def test_config_package_name_matches_package_json(self) -> None:
        self.assertEqual(package_config()["package-name"], load_json(PACKAGE_JSON)["name"])

    def test_last_release_sha_is_a_full_sha(self) -> None:
        sha = package_config().get("last-release-sha", "")
        self.assertRegex(sha, r"^[0-9a-f]{40}$", "last-release-sha must be a full 40-char sha")

    # -- extra-files: the silent-no-op surface --------------------------------

    def test_every_extra_file_exists(self) -> None:
        for entry in package_config().get("extra-files", []):
            path = entry["path"] if isinstance(entry, dict) else entry
            with self.subTest(path=path):
                self.assertTrue((REPO_ROOT / path).exists(), f"{path} is listed but absent")

    def test_generic_extra_files_carry_the_version_marker(self) -> None:
        """A `generic` entry without the marker edits nothing and still succeeds.

        That is the same defect shape as a documented default that does not work:
        every signal says the bump landed, and the surface keeps the old version.
        """
        for entry in package_config().get("extra-files", []):
            if not isinstance(entry, dict) or entry.get("type") != "generic":
                continue
            path = entry["path"]
            with self.subTest(path=path):
                body = (REPO_ROOT / path).read_text(encoding="utf-8")
                self.assertIn(
                    GENERIC_MARKER, body,
                    f"{path} is a `generic` extra-file but carries no {GENERIC_MARKER} marker",
                )

    def test_json_extra_file_targets_hold_the_current_version(self) -> None:
        """Every jsonpath target must read the version today, or the bump misses it."""
        for entry in package_config().get("extra-files", []):
            if not isinstance(entry, dict) or entry.get("type") != "json":
                continue
            path, jsonpath = entry["path"], entry["jsonpath"]
            with self.subTest(path=path, jsonpath=jsonpath):
                node = load_json(REPO_ROOT / path)
                # Only the `$.a.b` shape is used here; a bracket/index jsonpath
                # would need a real evaluator and is deliberately not supported.
                self.assertRegex(jsonpath, r"^\$(\.[A-Za-z_][A-Za-z0-9_]*)+$")
                for key in jsonpath.split(".")[1:]:
                    self.assertIsInstance(node, dict, f"{jsonpath} does not resolve in {path}")
                    self.assertIn(key, node, f"{jsonpath} does not resolve in {path}")
                    node = node[key]
                self.assertEqual(node, self.package_version)

    # -- the publish bridge ---------------------------------------------------

    def test_bridge_dispatches_only_workflows_that_exist(self) -> None:
        dispatched = dispatched_workflows()
        self.assertGreater(len(dispatched), 0, "the publish bridge dispatches nothing")
        for wf, _ in dispatched:
            with self.subTest(workflow=wf):
                self.assertTrue((WORKFLOWS / wf).exists(), f"bridge dispatches missing {wf}")

    def test_dispatched_workflows_accept_workflow_dispatch_and_its_inputs(self) -> None:
        """`gh workflow run` fails outright on a workflow without the trigger.

        And an input the workflow does not declare is rejected by the API, so the
        release would be created with nothing published — the worst shape of this
        failure, because the releases page looks correct.
        """
        for wf, inputs in dispatched_workflows():
            with self.subTest(workflow=wf):
                body = (WORKFLOWS / wf).read_text(encoding="utf-8")
                self.assertIn("workflow_dispatch:", body, f"{wf} has no workflow_dispatch trigger")
                for name in inputs:
                    # re.MULTILINE is load-bearing: assertRegex passes no flags,
                    # so `$` would anchor to end-of-FILE and never match a
                    # mid-file input declaration.
                    declared = re.search(rf"^\s+{re.escape(name)}:\s*$", body, re.MULTILINE)
                    self.assertIsNotNone(
                        declared,
                        f"{wf} does not declare a workflow_dispatch input '{name}'",
                    )

    def test_every_release_triggered_publisher_is_covered_by_the_bridge(self) -> None:
        """GITHUB_TOKEN-created releases do not cascade to `on: release`.

        GitHub docs, "Triggering a workflow": events triggered by the GITHUB_TOKEN
        do not create a new workflow run, and `release` is not one of the documented
        exceptions (only workflow_dispatch and repository_dispatch always cascade).
        So a publish workflow that listens on `release: published` and is NOT in the
        bridge simply never fires for an automated release. Adding one and forgetting
        the bridge is the regression this catches.
        """
        bridged = {wf for wf, _ in dispatched_workflows()}
        for path in sorted(WORKFLOWS.glob("*.yml")):
            body = path.read_text(encoding="utf-8")
            listens = re.search(r"^on:\n(?:.*\n)*?\s+release:\n\s+types:\s*\[\s*published\s*\]",
                                body, re.MULTILINE)
            if not listens:
                continue
            with self.subTest(workflow=path.name):
                self.assertIn(
                    path.name, bridged,
                    f"{path.name} triggers on a published release but the bridge never "
                    f"dispatches it — it will not run for an automated release",
                )

    # -- the weekly cut -------------------------------------------------------

    def test_weekly_cut_gates_on_a_real_workflow_file(self) -> None:
        body = WEEKLY_MERGE_WF.read_text(encoding="utf-8")
        match = re.search(r"^\s+CI_WORKFLOW_FILE:\s*(\S*)\s*$", body, re.MULTILINE)
        self.assertIsNotNone(match, "CI_WORKFLOW_FILE must be declared (use '' to disable)")
        name = match.group(1).strip("'\"")
        if name:
            self.assertTrue(
                (WORKFLOWS / name).exists(),
                f"the weekly cut gates on {name}, which does not exist — every cut would fail",
            )

    def test_weekly_cut_keeps_a_manual_escape_hatch(self) -> None:
        """An urgent fix must ship without waiting a week for the cron."""
        self.assertIn("workflow_dispatch:", WEEKLY_MERGE_WF.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
