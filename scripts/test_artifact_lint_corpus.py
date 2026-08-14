#!/usr/bin/env python3
"""Tests for artifact_lint_corpus.

Stdlib only. Run: python3 test_artifact_lint_corpus.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import artifact_lint as AL  # noqa: E402
import artifact_lint_corpus as ALC  # noqa: E402
from test_artifact_lint import CLEAN  # noqa: E402

SCRIPT = HERE / "artifact_lint_corpus.py"

DIRTY = '<title>Dashboard</title><script src="https://cdn.test/a.js"></script><p>x</p>'


class MeasureTests(unittest.TestCase):
    def _corpus(self, td: str, clean: int, dirty: int) -> list[Path]:
        out = []
        for i in range(clean):
            p = Path(td) / f"clean{i}.html"
            p.write_text(CLEAN, encoding="utf-8")
            out.append(p)
        for i in range(dirty):
            p = Path(td) / f"dirty{i}.html"
            p.write_text(DIRTY, encoding="utf-8")
            out.append(p)
        return out

    def test_firing_rate_matches_the_corpus_split(self):
        with tempfile.TemporaryDirectory() as td:
            data = ALC.measure(self._corpus(td, 3, 1))
            self.assertEqual(4, data["corpus_size"])
            by_id = {r["id"]: r for r in data["rules"]}
            self.assertEqual(1, by_id["AX002"]["files_fired"])
            self.assertEqual(0.25, by_id["AX002"]["firing_rate"])
            self.assertEqual(0, by_id["AS503"]["files_fired"])

    def test_clean_corpus_reports_no_findings(self):
        with tempfile.TemporaryDirectory() as td:
            data = ALC.measure(self._corpus(td, 4, 0))
            self.assertEqual(0, data["total_findings"])

    def test_every_declared_rule_appears_in_the_report(self):
        """A rule missing from the report cannot be measured, so it cannot be promoted."""
        with tempfile.TemporaryDirectory() as td:
            data = ALC.measure(self._corpus(td, 1, 1))
            self.assertEqual({r.id for r in AL.RULES}, {r["id"] for r in data["rules"]})

    def test_samples_carry_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            data = ALC.measure(self._corpus(td, 0, 2))
            s = data["samples"]["AX002"][0]
            self.assertIn("cdn.test", s["evidence"])
            self.assertIn("dirty", s["file"])

    def test_sample_limit_is_respected(self):
        with tempfile.TemporaryDirectory() as td:
            data = ALC.measure(self._corpus(td, 0, 9), sample_limit=3)
            self.assertEqual(3, len(data["samples"]["AX002"]))

    def test_unreadable_file_is_recorded_not_raised(self):
        with tempfile.TemporaryDirectory() as td:
            paths = self._corpus(td, 1, 0) + [Path(td) / "gone.html"]
            data = ALC.measure(paths)
            self.assertEqual(1, len(data["parse_errors"]))
            self.assertEqual(1, data["corpus_size"])

    def test_findings_per_firing_file_surfaces_spam(self):
        """The metric that caught AD102 emitting ~18 findings per file."""
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "many.html"
            p.write_text('<title>A B</title><style>body{background:#fff}</style>'
                         + "".join(f'<a href="https://x{i}.test/">l</a>' for i in range(7)),
                         encoding="utf-8")
            data = ALC.measure([p])
            by_id = {r["id"]: r for r in data["rules"]}
            self.assertEqual(1, by_id["AD303"]["files_fired"])
            self.assertGreaterEqual(by_id["AD303"]["findings_per_firing_file"], 1.0)


class CollectTests(unittest.TestCase):
    def test_dedupes_and_skips_missing(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "a.html"
            p.write_text(CLEAN, encoding="utf-8")
            got = ALC.collect([str(p), str(p)], "**/*.html", None)
            self.assertEqual(1, len(got))

    def test_from_file_and_glob_combine(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "a.html").write_text(CLEAN, encoding="utf-8")
            (Path(td) / "b.html").write_text(CLEAN, encoding="utf-8")
            listing = Path(td) / "list.txt"
            listing.write_text(str(Path(td) / "a.html"), encoding="utf-8")
            got = ALC.collect([td], "*.html", str(listing))
            self.assertEqual(2, len(got))


class CliTests(unittest.TestCase):
    def _run(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(SCRIPT), *args],
                              capture_output=True, text=True)

    def test_json_report(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "a.html").write_text(DIRTY, encoding="utf-8")
            r = self._run(td, "--glob", "*.html", "--json")
            self.assertEqual(0, r.returncode, r.stderr)
            data = json.loads(r.stdout)
            self.assertEqual(1, data["corpus_size"])

    def test_text_report_names_the_proxy_caveat(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "a.html").write_text(DIRTY, encoding="utf-8")
            r = self._run(td, "--glob", "*.html", "--samples", "AX002")
            self.assertIn("not precision", r.stdout)
            self.assertIn("samples: AX002", r.stdout)

    def test_empty_corpus_is_usage_error(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(2, self._run(td, "--glob", "*.nope").returncode)

    def test_no_roots_is_usage_error(self):
        self.assertEqual(2, self._run().returncode)


if __name__ == "__main__":
    unittest.main(verbosity=2)
