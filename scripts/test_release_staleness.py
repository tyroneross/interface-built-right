#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
# SPDX-License-Identifier: Apache-2.0
"""Tests for the release-cadence detector.

Every case is built against a synthetic git repo, never against this checkout.
Asserting on the live repo would make the test a mirror of today's release state:
red until someone cut a release and green forever after, which is the opposite of
what a regression test is for.

unittest, not pytest: `npm run validate:release` invokes each Python test file as
`python3 scripts/<file>.py`, and the three sibling files here are unittest. Ported
verbatim from build-loop, this file was pytest — under that runner it defined its
cases, ran none of them, and exited 0. A test suite that reports success while
asserting nothing is worse than no suite.
"""
from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "release_staleness", Path(__file__).parent / "release_staleness.py"
)
rs = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader
_SPEC.loader.exec_module(rs)

NOW = datetime(2026, 9, 1, tzinfo=timezone.utc)


def _git(repo: Path, *args: str, when: datetime | None = None) -> None:
    env = None
    if when is not None:
        stamp = when.isoformat()
        env = {
            "GIT_AUTHOR_DATE": stamp,
            "GIT_COMMITTER_DATE": stamp,
            "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin",
            "HOME": str(repo),
        }
    subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True, capture_output=True, text=True, env=env,
    )


def _tag(repo: Path, name: str) -> None:
    """Annotated + explicitly unsigned.

    A bare `git tag <name>` inherits the ambient user config: `tag.forceSignAnnotated`
    turns it annotated and it dies with "no tag message?", and `tag.gpgSign` makes it
    reach for a key the runner does not have. Real release tags are annotated anyway.
    """
    _git(repo, "-c", "tag.gpgSign=false", "tag", "-a", name, "-m", name)


def _commit(repo: Path, msg: str, when: datetime) -> None:
    (repo / "f.txt").write_text(msg)
    _git(repo, "add", "f.txt")
    _git(repo, "commit", "-m", msg, when=when)


class ReleaseStalenessTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.repo = Path(self._tmp.name) / "repo"
        self.repo.mkdir()
        _git(self.repo, "init", "-q", "-b", "main")
        _git(self.repo, "config", "user.email", "t@example.com")
        _git(self.repo, "config", "user.name", "T")
        _git(self.repo, "config", "commit.gpgsign", "false")
        _git(self.repo, "config", "tag.gpgSign", "false")

    def test_quiet_week_is_not_stale(self) -> None:
        """The whole point of the AND: an old tag with nothing after it is CORRECT.

        Firing here would mean an alert every quiet week, and an alert that cries
        wolf is the reason a real one gets ignored.
        """
        _commit(self.repo, "feat: initial", NOW - timedelta(days=200))
        _tag(self.repo, "v1.0.0")
        verdict = rs.evaluate(str(self.repo), "main", now=NOW)
        self.assertIs(verdict["stale"], False)
        self.assertEqual(verdict["commits_since_tag"], 0)

    def test_unreleased_work_past_the_window_is_stale(self) -> None:
        """The exact shape of the outage: work landed, no release followed."""
        _commit(self.repo, "feat: initial", NOW - timedelta(days=60))
        _tag(self.repo, "v1.0.0")
        _commit(self.repo, "fix: something users hit", NOW - timedelta(days=30))
        verdict = rs.evaluate(str(self.repo), "main", now=NOW)
        self.assertIs(verdict["stale"], True)
        self.assertEqual(verdict["commits_since_tag"], 1)
        self.assertGreater(verdict["age_days"], 10)

    def test_recent_work_inside_the_window_is_not_stale(self) -> None:
        """A release cut two days ago with a commit after it is a healthy cadence."""
        _commit(self.repo, "feat: initial", NOW - timedelta(days=3))
        _tag(self.repo, "v1.0.0")
        _commit(self.repo, "fix: minor", NOW - timedelta(days=2))
        self.assertIs(rs.evaluate(str(self.repo), "main", now=NOW)["stale"], False)

    def test_commit_burst_is_stale_even_inside_the_age_window(self) -> None:
        """A fast cadence failure. 60 commits in three days is still 60 unreleased."""
        _commit(self.repo, "feat: initial", NOW - timedelta(days=3))
        _tag(self.repo, "v1.0.0")
        for i in range(60):
            _commit(self.repo, f"fix: change {i}", NOW - timedelta(days=2))
        verdict = rs.evaluate(str(self.repo), "main", max_commits=50, now=NOW)
        self.assertIs(verdict["stale"], True)
        self.assertEqual(verdict["commits_since_tag"], 60)

    def test_housekeeping_tags_are_not_release_tags(self) -> None:
        """Regression for the real reason an outage like this goes unseen.

        A check that treated the newest tag by date as the newest release would
        report FRESH throughout, because housekeeping tags keep arriving.
        """
        _commit(self.repo, "feat: initial", NOW - timedelta(days=60))
        _tag(self.repo, "v1.0.0")
        _commit(self.repo, "fix: later work", NOW - timedelta(days=30))
        _tag(self.repo, "archive/2026-08-25/some-branch")
        _tag(self.repo, "rescue/peer-abc1234")
        # The one that exercises the leading anchor. The two above contain no
        # dotted triple, so an UNANCHORED regex still ignores them and the test
        # would pass against a broken matcher — a guard asserting only the
        # working path. This tag looks exactly like a release to a loose regex.
        _tag(self.repo, "archive/2026-08-25/release-9.9.9")
        # A pre-release tag is not a release either. This is the case the
        # trailing `$` uniquely covers: `v9.9.9-rc1` starts with a valid triple,
        # so only the end-anchor keeps it out. Without it, cutting an rc would
        # silence the cadence alarm for a version that never shipped.
        _tag(self.repo, "v9.9.9-rc1")
        verdict = rs.evaluate(str(self.repo), "main", now=NOW)
        self.assertEqual(verdict["tag"], "v1.0.0")
        self.assertIs(verdict["stale"], True)

    def test_newest_tag_is_chosen_by_version_not_by_date(self) -> None:
        """v0.9.0 created after v0.10.0 must not outrank it."""
        _commit(self.repo, "feat: initial", NOW - timedelta(days=60))
        _tag(self.repo, "v0.10.0")
        _commit(self.repo, "fix: more", NOW - timedelta(days=59))
        _tag(self.repo, "v0.9.0")
        self.assertEqual(rs.newest_release_tag(str(self.repo)), "v0.10.0")

    def test_no_release_tag_at_all_is_stale_once_work_exists(self) -> None:
        _commit(self.repo, "feat: initial", NOW - timedelta(days=1))
        verdict = rs.evaluate(str(self.repo), "main", now=NOW)
        self.assertIs(verdict["stale"], True)
        self.assertIsNone(verdict["tag"])

    def test_cli_exit_codes(self) -> None:
        """Exit 1 must mean stale — the workflow branches on it."""
        _commit(self.repo, "feat: initial", NOW - timedelta(days=200))
        _tag(self.repo, "v1.0.0")
        self.assertEqual(rs.main(["--workdir", str(self.repo), "--branch", "main"]), 0)
        _commit(self.repo, "fix: later", NOW - timedelta(days=100))
        self.assertEqual(rs.main(["--workdir", str(self.repo), "--branch", "main"]), 1)

    def test_a_non_repo_reports_error_not_fresh(self) -> None:
        """Fail loud, never fail-green: a broken check must not read as 'no problem'."""
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(rs.main(["--workdir", str(Path(d) / "nope"), "--json"]), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
