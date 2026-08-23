#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Tests for dashboard_build — the scaffold, and the loud skipped-grade path.

Two contracts are defended here.

The scaffold's: what `build` emits satisfies every rule `dashboard_lint` grades,
so "start from the scaffold" is a claim with a test behind it rather than a
comment that rots.

The grade's: `--check` either grades or says it did not. A build that asks for a
grade, fails to run one, and exits 0 has reported a pass it never earned — which
is the exact failure a `--check` flag exists to prevent.
"""

from __future__ import annotations

import contextlib
import io
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import dashboard_build as B  # noqa: E402
import dashboard_lint as L  # noqa: E402


def run(argv: list[str]) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        rc = B.main(argv)
    return rc, out.getvalue(), err.getvalue()


class Scaffold(unittest.TestCase):
    def test_new_emits_a_spec_that_builds(self):
        spec = B.new_spec("queue", "Release queue")
        self.assertEqual(B.SPEC_SCHEMA, spec["schema"])
        self.assertIn("<h1>Release queue</h1>", B.render(spec))

    def test_every_archetype_renders_and_lints_clean(self):
        for archetype in B.ARCHETYPES:
            with self.subTest(archetype=archetype):
                page = B.render(B.new_spec(archetype, f"A {archetype} view"))
                self.assertEqual([], L.lint_source(Path("a.html"), page))

    def test_every_state_renders_its_word(self):
        """DB501 is satisfied by construction, not by the author remembering."""
        spec = B.new_spec("status", "States")
        spec["sections"] = [{"heading": "All", "items": [
            {"label": f"Item {k}", "state": k} for k in B.STATES]}]
        page = B.render(spec)
        for key, meta in B.STATES.items():
            self.assertIn(f">{meta['label']}<", page,
                          f"state {key} rendered no word")
        self.assertEqual([], L.lint_source(Path("s.html"), page))

    def test_the_as_of_stamp_is_visible_text(self):
        page = B.render(B.new_spec("queue", "T"))
        self.assertIn("Snapshot as of", page)
        self.assertIn("<time datetime=", page)

    def test_content_is_escaped(self):
        spec = B.new_spec("queue", 'Ops <script>alert(1)</script>')
        page = B.render(spec)
        self.assertNotIn("<script>alert(1)</script>", page)
        self.assertIn("&lt;script&gt;", page)

    def test_a_bound_spec_emits_both_rungs_of_the_binding_ladder(self):
        page = B.render(dict(B.new_spec("control", "Bound"), data="./data.json"))
        self.assertIn("fetch(", page)
        self.assertIn("createElement('script')", page)
        self.assertEqual([], L.lint_source(Path("b.html"), page))


class SpecValidation(unittest.TestCase):
    def test_an_unknown_archetype_is_rejected(self):
        with self.assertRaises(B.SpecError):
            B.render({"archetype": "kanban", "title": "T", "sections": []})

    def test_an_unknown_state_is_rejected(self):
        """A typo'd state would render no word at all — silently failing DB501."""
        with self.assertRaises(B.SpecError):
            B.render({"archetype": "queue", "title": "T", "sections": [
                {"heading": "H", "items": [{"label": "x", "state": "burning"}]}]})

    def test_a_missing_title_is_rejected(self):
        with self.assertRaises(B.SpecError):
            B.render({"archetype": "queue", "title": "  ", "sections": []})

    def test_an_unknown_schema_is_rejected(self):
        with self.assertRaises(B.SpecError):
            B.render({"schema": "something/v9", "archetype": "queue",
                      "title": "T", "sections": []})


class GradingIsNeverSilent(unittest.TestCase):
    """A grade that did not happen must never exit 0."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.spec = Path(self.dir.name) / "spec.json"
        self.spec.write_text(json.dumps(B.new_spec("queue", "Release queue")),
                             encoding="utf-8")

    def tearDown(self):
        self.dir.cleanup()

    def test_check_with_output_grades_and_passes(self):
        out = Path(self.dir.name) / "d.html"
        rc, _, err = run(["build", str(self.spec), "-o", str(out), "--check"])
        self.assertEqual(0, rc)
        self.assertIn("dashboard_lint:", err)
        self.assertNotIn(B.NOT_GRADED, err)

    def test_check_without_an_output_file_is_not_a_pass(self):
        """The page went to stdout; there is nothing on disk to grade."""
        rc, _, err = run(["build", str(self.spec), "--check"])
        self.assertNotEqual(0, rc, "an ungraded build reported success")
        self.assertIn(B.NOT_GRADED, err)
        self.assertIn("-o/--output", err)

    def test_no_check_says_so_rather_than_implying_a_pass(self):
        out = Path(self.dir.name) / "d.html"
        rc, _, err = run(["build", str(self.spec), "-o", str(out)])
        self.assertEqual(0, rc, "no grade was asked for, so 0 is honest")
        self.assertIn(B.NOT_GRADED, err)
        self.assertIn("dashboard_lint.py check", err,
                      "the message must name the command that would grade it")

    def test_quiet_still_says_it_did_not_grade(self):
        """--quiet hides the write confirmation, never the ungraded notice.

        A quiet build that prints nothing and exits 0 is indistinguishable from a
        graded pass — which is the failure --check exists to prevent.
        """
        out = Path(self.dir.name) / "d.html"
        rc, _, err = run(["build", str(self.spec), "-o", str(out), "--quiet"])
        self.assertEqual(0, rc)
        self.assertIn(B.NOT_GRADED, err)
        self.assertNotIn("wrote ", err, "--quiet should still hide the write line")

    def test_quiet_does_not_hide_an_ungraded_check(self):
        rc, _, err = run(["build", str(self.spec), "--check", "--quiet"])
        self.assertEqual(2, rc)
        self.assertIn(B.NOT_GRADED, err)

    def test_a_missing_linter_is_not_a_pass(self):
        """Deleting the grader must not turn --check into a rubber stamp."""
        out = Path(self.dir.name) / "d.html"
        out.write_text("<!doctype html><html><body></body></html>", encoding="utf-8")
        real = sys.modules.pop("dashboard_lint", None)
        saved_path = list(sys.path)
        try:
            sys.modules["dashboard_lint"] = None  # forces ImportError on import
            rc = B.grade(str(out))
        finally:
            sys.path[:] = saved_path
            if real is not None:
                sys.modules["dashboard_lint"] = real
            else:
                sys.modules.pop("dashboard_lint", None)
        self.assertEqual(2, rc)

    def test_a_linter_that_raises_is_not_a_pass(self):
        out = Path(self.dir.name) / "d.html"
        out.write_text("<html></html>", encoding="utf-8")
        original = L.lint

        def boom(*a, **k):
            raise RuntimeError("synthetic linter failure")

        L.lint = boom
        try:
            rc, _, err = run(["build", str(self.spec), "-o", str(out), "--check"])
        finally:
            L.lint = original
        self.assertEqual(2, rc)
        self.assertIn(B.NOT_GRADED, err)
        self.assertIn("RuntimeError", err)

    def test_an_unwritten_output_is_not_a_pass(self):
        rc = B.grade(str(Path(self.dir.name) / "never-written.html"))
        self.assertEqual(2, rc)

    def test_check_exits_1_when_the_page_actually_fails(self):
        """The failure path has to work, or the pass path proves nothing."""
        out = Path(self.dir.name) / "d.html"
        rc, _, _ = run(["build", str(self.spec), "-o", str(out)])
        self.assertEqual(0, rc)
        out.write_text(
            out.read_text(encoding="utf-8").replace(
                "</head>", '<script src="https://cdn.example.com/x.js"></script></head>'),
            encoding="utf-8")
        self.assertEqual(1, B.grade(str(out)))

    def test_fail_on_warn_catches_what_the_default_lets_through(self):
        out = Path(self.dir.name) / "d.html"
        run(["build", str(self.spec), "-o", str(out)])
        # Strip the as-of line, leaving a DB402 warn and nothing above it.
        undated = re.sub(r'<p class="as-of">.*?</p>', "",
                         out.read_text(encoding="utf-8"), flags=re.DOTALL)
        out.write_text(undated, encoding="utf-8")
        self.assertEqual(0, B.grade(str(out)), "DB402 is a warn and must not block")
        self.assertEqual(1, B.grade(str(out), fail_on="warn"))

    def test_a_malformed_spec_is_a_usage_error(self):
        bad = Path(self.dir.name) / "bad.json"
        bad.write_text("{not json", encoding="utf-8")
        rc, _, err = run(["build", str(bad), "-o",
                          str(Path(self.dir.name) / "x.html")])
        self.assertEqual(2, rc)
        self.assertIn("not valid JSON", err)


if __name__ == "__main__":
    unittest.main(verbosity=2)
