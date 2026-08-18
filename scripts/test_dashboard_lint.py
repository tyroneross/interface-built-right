#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Tests for dashboard_lint — proved by mutation, not by the happy path.

A checker whose tests only exercise the passing path certifies the hole it was
written to close: every rule could `return []` and the suite would stay green.

So the shape here is one clean dashboard — rendered by `dashboard_build.py`, so
the generator and the grader are held to the same contract — and one mutation per
rule that breaks exactly that rule. Each mutation asserts two things:

  1. the rule fires (it is not dead code), and
  2. **no other rule fires** (it is not a shotgun that would spray a build with
     findings the author cannot act on).

The second assertion is the one that matters. A rule that fires on its own defect
*and* three unrelated ones is how a gate earns the reputation that gets it
switched off.
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


def run_cli(argv: list[str]) -> tuple[int, str]:
    """Exit code plus captured stdout — a test suite should not print a report."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = L.main(argv)
    return rc, buf.getvalue()


def clean_dashboard(**overrides) -> str:
    """The baseline every mutation starts from: a page that lints silent."""
    spec = B.new_spec("queue", "Release queue")
    spec["sections"] = [{
        "heading": "Needs you now",
        "items": [
            {"label": "Sign the release", "state": "blocked", "note": "waiting on legal"},
            {"label": "Backfill the index", "state": "at-risk"},
            {"label": "Ship the changelog", "state": "done"},
        ],
    }]
    spec.update(overrides)
    return B.render(spec)


def _insert_css(page: str, css: str) -> str:
    assert "  </style>" in page
    return page.replace("  </style>", f"{css}\n  </style>", 1)


def _insert_body(page: str, markup: str) -> str:
    assert "</body>" in page
    return page.replace("</body>", f"{markup}\n</body>", 1)


def _insert_head(page: str, markup: str) -> str:
    assert "</head>" in page
    return page.replace("</head>", f"{markup}\n</head>", 1)


# Each mutation breaks exactly one rule. Keep them minimal: the smaller the edit,
# the more precisely a cross-fire implicates the rule under test.
MUTATIONS: dict[str, callable] = {
    # DB402 — strip the only thing that dates the page.
    "DB402": lambda p: re.sub(r'\s*<p class="as-of">.*?</p>', "", p, flags=re.DOTALL),

    # DB403 — one CDN script tag, the shape the corpus fires on most.
    "DB403": lambda p: _insert_head(
        p, '  <script src="https://cdn.tailwindcss.com"></script>'),

    # DB401a — a bare fetch of a local file and no <script src> fallback, so the
    # page loads and the data does not from file://.
    "DB401a": lambda p: _insert_body(
        p, "  <script>fetch('./data.json').then(function (r) "
           "{ return r.json(); });</script>"),

    # DB401b — a root-absolute path, which misses from file:// every time.
    "DB401b": lambda p: _insert_body(
        p, "  <script>fetch('/api/items');</script>"),

    # DB501 — a painted marker with no word, no label, and no labelled parent.
    "DB501": lambda p: _insert_body(
        _insert_css(p, ".status-bad { background: #a01b16; border-radius: 50%; }"),
        '  <div><span class="status-bad"></span></div>'),

    # DB502 — a pair that measures 1.4:1, well under the AA floor.
    "DB502": lambda p: _insert_css(
        p, "p.faint { color: #cccccf; background: #fcfcfd; }"),

    # DB503 — a control at 16px, under the 24px pointer floor.
    "DB503": lambda p: _insert_css(p, ".btn-tiny { height: 16px; }"),

    # DB507 — a min-width no ancestor can absorb at 320px.
    "DB507": lambda p: _insert_css(p, ".report-table { min-width: 900px; }"),
}


def fired(page: str) -> set[str]:
    return {f.rule for f in L.lint_source(Path("mutant.html"), page)}


class CleanBaseline(unittest.TestCase):
    def test_the_scaffold_lints_silent(self):
        """Every mutation below is only meaningful against a zero baseline."""
        findings = L.lint_source(Path("clean.html"), clean_dashboard())
        self.assertEqual(
            [], findings,
            "baseline is not clean: " + "; ".join(
                f"{f.rule} {f.message}" for f in findings))

    def test_a_bound_dashboard_also_lints_silent(self):
        """The binding ladder (fetch + <script src> fallback) satisfies DB401."""
        page = clean_dashboard(data="./data.json", source="record/events-*.jsonl")
        self.assertEqual([], L.lint_source(Path("bound.html"), page))

    def test_an_empty_section_still_lints_silent(self):
        page = clean_dashboard(sections=[{"heading": "Nothing yet", "items": []}])
        self.assertEqual([], L.lint_source(Path("empty.html"), page))


class MutationIsolation(unittest.TestCase):
    """One broken rule in, exactly one rule out."""

    def test_every_rule_has_a_mutation(self):
        self.assertEqual(set(L.RULES_BY_ID), set(MUTATIONS),
                         "a rule with no mutation is a rule with no proof")


def _mutation_case(rule_id: str, mutate) -> callable:
    def test(self: unittest.TestCase) -> None:
        page = mutate(clean_dashboard())
        self.assertNotEqual(page, clean_dashboard(),
                            f"{rule_id} mutation changed nothing")
        rules = fired(page)
        self.assertIn(rule_id, rules,
                      f"{rule_id} did not fire on a document that breaks it — "
                      f"fired instead: {sorted(rules) or 'nothing'}")
        self.assertEqual({rule_id}, rules,
                         f"{rule_id} mutation also tripped "
                         f"{sorted(rules - {rule_id})}; a rule that fires on "
                         f"someone else's defect makes findings unactionable")
    test.__name__ = f"test_{rule_id.lower()}_fires_alone"
    test.__doc__ = f"{rule_id}: breaking it fires it, and fires nothing else."
    return test


for _rid, _mut in MUTATIONS.items():
    setattr(MutationIsolation, f"test_{_rid.lower()}_fires_alone",
            _mutation_case(_rid, _mut))


class SeverityContract(unittest.TestCase):
    """The invariants that keep the gate from crying wolf."""

    def test_heuristic_rules_never_hard_block(self):
        for r in L.RULES:
            if r.heuristic:
                self.assertNotEqual(
                    "error", r.severity,
                    f"{r.id} reasons from a vocabulary and must never fail a build")

    def test_every_severity_is_known(self):
        for r in L.RULES:
            self.assertIn(r.severity, L.SEVERITIES)

    def test_rule_ids_are_unique(self):
        ids = [r.id for r in L.RULES]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_rule_states_a_fix(self):
        for r in L.RULES:
            self.assertTrue(r.fix.strip(), f"{r.id} has no fix")
            self.assertTrue(r.rationale.strip(), f"{r.id} has no rationale")


class KnownFalsePositives(unittest.TestCase):
    """Shapes the corpus proved were being matched wrongly. Regression guards."""

    def test_an_icon_inside_a_control_is_not_the_target(self):
        """DB503 measured `.tab-icon { height: 16px }` and called it a small tab.

        The 16px glyph inside a 40px tab is decoration; the tab is the target.
        This was the whole of DB503's firing rate on the repo corpus.
        """
        page = _insert_css(clean_dashboard(), ".tab-icon { height: 16px; width: 16px; }")
        self.assertNotIn("DB503", fired(page))

    def test_a_local_stylesheet_is_not_an_external_request(self):
        page = _insert_head(clean_dashboard(),
                            '  <link rel="stylesheet" href="shared.css">')
        self.assertNotIn("DB403", fired(page))

    def test_a_hyperlink_is_not_a_request(self):
        """DB403 grades what the page fetches, not where the reader may choose to go."""
        page = _insert_body(
            clean_dashboard(), '  <p><a href="https://example.com/spec">the spec</a></p>')
        self.assertNotIn("DB403", fired(page))

    def test_a_canonical_link_is_not_a_request(self):
        page = _insert_head(
            clean_dashboard(), '  <link rel="canonical" href="https://example.com/d">')
        self.assertNotIn("DB403", fired(page))

    def test_a_coloured_marker_beside_a_word_is_not_colour_alone(self):
        """DB501 is about state with no words, not about having a dot at all."""
        page = _insert_body(
            _insert_css(clean_dashboard(), ".status-bad { background: #a01b16; }"),
            '  <p><span class="status-bad"></span> Blocked</p>')
        self.assertNotIn("DB501", fired(page))

    def test_a_width_behind_a_wide_media_query_cannot_overflow_320(self):
        page = _insert_css(
            clean_dashboard(),
            "@media (min-width: 900px) { .split { min-width: 640px; } }")
        self.assertNotIn("DB507", fired(page))

    def test_a_non_px_size_is_not_measured(self):
        """Silence beats a guess: em and % depend on context the linter cannot see."""
        page = _insert_css(clean_dashboard(), ".btn-em { height: 1em; min-width: 5%; }")
        self.assertNotIn("DB503", fired(page))

    def test_a_builtin_global_is_not_a_data_fallback(self):
        """`window.URL` is a built-in, not a binding-ladder rung.

        Counting any uppercase property as a fallback would switch DB401a off on
        the exact page it exists to catch.
        """
        page = _insert_body(
            clean_dashboard(),
            "  <script>var u = new window.URL(location.href);"
            "fetch('./data.json');</script>")
        self.assertIn("DB401a", fired(page))

    def test_a_real_data_global_is_a_fallback(self):
        page = _insert_body(
            clean_dashboard(),
            "  <script>fetch('./data.json').catch(function () "
            "{ return window.DASHBOARD_DATA; });</script>")
        self.assertNotIn("DB401a", fired(page))

    def test_a_disabled_control_is_exempt_from_contrast(self):
        page = _insert_css(clean_dashboard(),
                           ".btn:disabled { color: #cccccf; background: #fcfcfd; }")
        self.assertNotIn("DB502", fired(page))

    def test_a_touch_media_query_raises_the_floor_to_44(self):
        """The same 32px control passes on a pointer and fails under coarse input."""
        pointer = _insert_css(clean_dashboard(), ".btn-mid { height: 32px; }")
        self.assertNotIn("DB503", fired(pointer))
        touch = _insert_css(
            clean_dashboard(),
            "@media (pointer: coarse) { .btn-mid { height: 32px; } }")
        self.assertIn("DB503", fired(touch))


class FreshnessVocabulary(unittest.TestCase):
    def test_a_time_element_satisfies_db402(self):
        page = MUTATIONS["DB402"](clean_dashboard())
        self.assertIn("DB402", fired(page))
        self.assertNotIn("DB402", fired(_insert_body(
            page, '  <p>Updated <time datetime="2026-08-18">18 Aug 2026</time></p>')))

    def test_prose_carrying_a_date_satisfies_db402(self):
        page = MUTATIONS["DB402"](clean_dashboard())
        self.assertNotIn("DB402", fired(_insert_body(
            page, "  <p>Last updated 2026-08-18 at 14:02 UTC</p>")))

    def test_a_hidden_freshness_label_does_not_count(self):
        """DB402 says *visible*: a screen-reader-only stamp still reads as live."""
        page = MUTATIONS["DB402"](clean_dashboard())
        self.assertIn("DB402", fired(_insert_body(
            page, '  <p class="sr-only">Last updated 2026-08-18</p>')))


class Cli(unittest.TestCase):
    def test_rules_json_is_the_machine_contract(self):
        rc, out = run_cli(["rules", "--json"])
        self.assertEqual(0, rc)
        data = json.loads(out)
        self.assertEqual({r["id"] for r in data["rules"]}, set(L.RULES_BY_ID))
        self.assertTrue(data["not_graded"],
                        "the contract must name what it refuses to grade")

    def test_check_exits_1_on_an_error_and_0_when_clean(self):
        with tempfile.TemporaryDirectory() as d:
            clean = Path(d) / "clean.html"
            clean.write_text(clean_dashboard(), encoding="utf-8")
            self.assertEqual(0, run_cli(["check", str(clean), "--json"])[0])
            broken = Path(d) / "broken.html"
            broken.write_text(MUTATIONS["DB403"](clean_dashboard()), encoding="utf-8")
            self.assertEqual(1, run_cli(["check", str(broken), "--json"])[0])

    def test_a_warn_only_document_does_not_fail_the_default_gate(self):
        """DB402 fires on almost every existing dashboard; it must not block."""
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "warn.html"
            p.write_text(MUTATIONS["DB402"](clean_dashboard()), encoding="utf-8")
            self.assertEqual(0, run_cli(["check", str(p), "--json"])[0])
            self.assertEqual(
                1, run_cli(["check", str(p), "--json", "--fail-on", "warn"])[0])

    def test_unknown_rule_in_disable_is_a_usage_error(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.html"
            p.write_text(clean_dashboard(), encoding="utf-8")
            self.assertEqual(2, run_cli(["check", str(p), "--disable", "DB999"])[0])

    def test_missing_file_is_a_usage_error(self):
        self.assertEqual(2, run_cli(["check", "/nonexistent/nope.html"])[0])

    def test_disable_suppresses_exactly_one_rule(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "b.html"
            p.write_text(MUTATIONS["DB403"](clean_dashboard()), encoding="utf-8")
            self.assertEqual(1, run_cli(["check", str(p), "--json"])[0])
            self.assertEqual(0, run_cli(["check", str(p), "--json",
                                         "--disable", "DB403"])[0])


class ProseMatchesCode(unittest.TestCase):
    """The skill says rules are 'graded by scripts/dashboard_lint.py'. Check it."""

    SKILL = (Path(__file__).resolve().parent.parent
             / "skills" / "dashboard-design" / "SKILL.md")

    def test_every_graded_rule_is_stated_in_the_skill(self):
        prose = self.SKILL.read_text(encoding="utf-8")
        missing = [rid for rid in L.RULES_BY_ID if rid not in prose]
        self.assertEqual([], missing,
                         f"graded but undocumented: {missing} — a reader following "
                         f"the skill would never know these are enforced")

    def test_the_skill_names_what_it_refuses_to_grade(self):
        prose = self.SKILL.read_text(encoding="utf-8")
        self.assertIn("What is graded, and what is not", prose)
        for ungraded in ("DB101", "DB504", "DB506"):
            self.assertIn(ungraded, prose)
            self.assertNotIn(ungraded, L.RULES_BY_ID,
                             f"{ungraded} is documented as ungraded but is graded")


class Corpus(unittest.TestCase):
    def test_measure_reports_a_rate_for_every_rule(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "a.html").write_text(clean_dashboard(), encoding="utf-8")
            (Path(d) / "b.html").write_text(MUTATIONS["DB403"](clean_dashboard()),
                                            encoding="utf-8")
            data = L.measure([Path(d) / "a.html", Path(d) / "b.html"])
        self.assertEqual(2, data["corpus_size"])
        rates = {r["id"]: r["firing_rate"] for r in data["rules"]}
        self.assertEqual(set(rates), set(L.RULES_BY_ID),
                         "a rule missing from the measurement cannot be calibrated")
        self.assertEqual(0.5, rates["DB403"])
        self.assertEqual(0.0, rates["DB507"])

    def test_an_unreadable_file_is_data_not_a_crash(self):
        data = L.measure([Path("/nonexistent/nope.html")])
        self.assertEqual(1, len(data["parse_errors"]))
        self.assertEqual(0, data["corpus_size"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
