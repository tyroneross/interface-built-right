#!/usr/bin/env python3
"""Tests for artifact_lint.

Stdlib only. Run: python3 test_artifact_lint.py

Every rule is asserted in BOTH directions — it fires on a minimal defect fixture
AND stays silent on the clean fixture. A rule that only has a positive test can
pass while firing on everything; that is the noisy-gate failure mode, and a noisy
gate is worse than no gate.
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

SCRIPT = HERE / "artifact_lint.py"


# A fragment that satisfies the whole contract. Every negative assertion in this
# suite is measured against it, so if a rule starts firing here the suite fails.
CLEAN = """\
<title>Tide Ledger</title>
<style>
  :root {
    --paper: #fbf9f5; --ink: #1c1a17; --muted: #6b655c;
    --accent: #7a4a2b; --rule: #e2ddd3;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #14120f; --ink: #ece7de; --muted: #9a9287;
      --accent: #d99a63; --rule: #2c2822;
    }
  }
  :root[data-theme="dark"] {
    --paper: #14120f; --ink: #ece7de; --muted: #9a9287;
    --accent: #d99a63; --rule: #2c2822;
  }
  body { background: var(--paper); color: var(--ink); font-family: Palatino, serif; }
  .prose { max-width: 62ch; display: grid; gap: 1rem; }
  .scroller { overflow-x: auto; }
  table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
  a { color: var(--accent); }
  a:focus-visible { outline: 2px solid var(--accent); }
  svg { max-width: 100%; height: auto; }
</style>
<div class="prose">
  <h1>Tide Ledger</h1>
  <p>Readings from the harbour gauge.</p>
  <div class="scroller">
    <table><tr><th>Hour</th><th>Height</th></tr><tr><td>06:00</td><td>1.42</td></tr></table>
  </div>
  <figure>
    <svg viewBox="0 0 220 90" role="img" aria-label="The gauge writes to the ledger.">
      <defs><marker id="tip" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <polygon points="0,0 8,4 0,8" fill="currentColor"/></marker></defs>
      <rect x="4" y="26" width="80" height="38" fill="none" stroke="currentColor"/>
      <text x="44" y="50" text-anchor="middle" font-size="12" fill="currentColor">gauge</text>
      <line x1="86" y1="45" x2="126" y2="45" stroke="currentColor" marker-end="url(#tip)"/>
      <text x="106" y="38" text-anchor="middle" font-size="11" fill="currentColor">writes</text>
      <rect x="128" y="26" width="80" height="38" fill="none" stroke="currentColor"/>
      <text x="168" y="50" text-anchor="middle" font-size="12" fill="currentColor">ledger</text>
    </svg>
    <figcaption>The reconciler reads the ledger; it never touches the gauge.</figcaption>
  </figure>
</div>
"""


def lint_source(source: str, profile: str = "claude-artifact", suffix: str = ".html"):
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / f"a{suffix}"
        p.write_text(source, encoding="utf-8")
        return AL.lint(p, profile)


def rules_fired(source: str, profile: str = "claude-artifact", suffix: str = ".html") -> set[str]:
    return {f.rule for f in lint_source(source, profile, suffix)}


def swap(old: str, new: str, base: str = CLEAN) -> str:
    assert old in base, f"fixture drift: {old!r} not in the clean fixture"
    return base.replace(old, new, 1)


class CleanFixtureTests(unittest.TestCase):
    """The negative half of every rule's contract."""

    def test_clean_fragment_has_zero_findings(self):
        findings = lint_source(CLEAN)
        self.assertEqual(
            [], [f"{f.rule}:{f.message}" for f in findings],
            "the clean fixture must produce no findings at any severity",
        )

    def test_clean_wrapped_document_has_zero_findings(self):
        doc = (
            '<!doctype html>\n<html lang="en">\n<head>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            + CLEAN.split("\n", 1)[0] + "\n"
            + CLEAN.split("\n", 1)[1].split("<div class=\"prose\">")[0]
            + "</head>\n<body>\n"
            + '<div class="prose">' + CLEAN.split('<div class="prose">', 1)[1]
            + "</body>\n</html>\n"
        )
        findings = lint_source(doc, "standalone")
        self.assertEqual([], [f"{f.rule}:{f.message}" for f in findings])


class PortabilityTests(unittest.TestCase):
    def test_ax001_external_image(self):
        bad = swap("<h1>Tide Ledger</h1>", '<img src="https://example.com/a.png">')
        self.assertIn("AX001", rules_fired(bad))

    def test_ax001_ignores_data_uri_and_anchor(self):
        ok = swap("<h1>Tide Ledger</h1>",
                  '<img src="data:image/gif;base64,R0lGOD"><a href="https://example.com">out</a>')
        self.assertNotIn("AX001", rules_fired(ok))

    def test_ax002_cdn_script(self):
        bad = swap("<h1>Tide Ledger</h1>", '<script src="https://cdn.example.com/x.js"></script>')
        self.assertIn("AX002", rules_fired(bad))

    def test_ax003_font_cdn_link(self):
        bad = swap("<title>Tide Ledger</title>",
                   '<title>Tide Ledger</title>\n<link rel="stylesheet" '
                   'href="https://fonts.googleapis.com/css2?family=Inter">')
        self.assertIn("AX003", rules_fired(bad))

    def test_ax003_font_face_external_src(self):
        bad = swap("body { background:", "@font-face { font-family: X; "
                                         "src: url(https://cdn.example.com/x.woff2); }\n  body { background:")
        self.assertIn("AX003", rules_fired(bad))

    def test_ax003_allows_data_uri_font(self):
        ok = swap("body { background:", "@font-face { font-family: X; "
                                        "src: url(data:font/woff2;base64,AAAA); }\n  body { background:")
        self.assertNotIn("AX003", rules_fired(ok))

    def test_ax004_fragment_with_wrapper(self):
        self.assertIn("AX004", rules_fired("<!doctype html><html><body>" + CLEAN + "</body></html>"))

    def test_ax004_standalone_missing_head_meta(self):
        fired = rules_fired("<!doctype html><html><body>" + CLEAN + "</body></html>", "standalone")
        self.assertIn("AX004", fired)

    def test_ax005_oversize(self):
        big = CLEAN + "<!--" + ("x" * (AL.MAX_BYTES + 10)) + "-->"
        self.assertIn("AX005", rules_fired(big))

    def test_ax006_download_link(self):
        bad = swap("<h1>Tide Ledger</h1>", '<a href="#a" download>save</a>')
        self.assertIn("AX006", rules_fired(bad))

    def test_ax007_unguarded_capability(self):
        bad = swap("<h1>Tide Ledger</h1>", "<script>window.claude.callTool('x')</script>")
        self.assertIn("AX007", rules_fired(bad))

    def test_ax007_guarded_capability_is_silent(self):
        ok = swap("<h1>Tide Ledger</h1>",
                  "<script>if (window.claude) { window.claude.callTool('x'); }</script>")
        self.assertNotIn("AX007", rules_fired(ok))

    def test_ax007_escalates_to_error_in_standalone(self):
        bad = swap("<h1>Tide Ledger</h1>", "<script>window.claude.callTool('x')</script>")
        findings = [f for f in lint_source(bad, "standalone") if f.rule == "AX007"]
        self.assertTrue(findings and findings[0].severity == "error")

    def test_ax008_unclosed_element(self):
        bad = swap("<h1>Tide Ledger</h1>", "<div><h1>Tide Ledger</h1>")
        self.assertIn("AX008", rules_fired(bad))

    def test_ax008_tolerates_optional_end_tags(self):
        ok = swap("<p>Readings from the harbour gauge.</p>",
                  "<p>One<p>Two<ul><li>a<li>b</ul>")
        self.assertNotIn("AX008", rules_fired(ok))

    def test_ax009_mermaid_in_standalone(self):
        bad = swap("<h1>Tide Ledger</h1>", '<pre class="mermaid">graph TD; A-->B;</pre>')
        self.assertIn("AX009", rules_fired(bad, "standalone"))


class ThemeTests(unittest.TestCase):
    def test_ad102_token_only_in_dark_block(self):
        bad = swap("--accent: #d99a63; --rule: #2c2822;\n    }\n  }",
                   "--accent: #d99a63; --rule: #2c2822; --glow: #fff;\n    }\n  }")
        fired = [f for f in lint_source(bad) if f.rule == "AD102"]
        self.assertTrue(fired)
        self.assertIn("--glow", fired[0].evidence)

    def test_ad103_unguarded_dark_media(self):
        bad = swap(':root:not([data-theme="light"]) {', ":root {")
        self.assertIn("AD103", rules_fired(bad))

    def test_ad104_missing_data_theme_stamp(self):
        bad = swap(':root[data-theme="dark"] {', ".unused-block {")
        self.assertIn("AD104", rules_fired(bad))

    def test_ad105_body_background_unset(self):
        bad = swap("body { background: var(--paper); color: var(--ink);",
                   "body { color: var(--ink);")
        self.assertIn("AD105", rules_fired(bad))

    def test_ad105_body_background_transparent(self):
        bad = swap("body { background: var(--paper);", "body { background: transparent;")
        self.assertIn("AD105", rules_fired(bad))

    def test_ad106_literal_colors_outnumber_token_refs(self):
        literals = "".join(f".x{i}{{color:#1{i}2233}}" for i in range(10))
        bad = swap(".prose { max-width: 62ch;", literals + "\n  .prose { max-width: 62ch;")
        self.assertIn("AD106", rules_fired(bad))

    def test_ad106_silent_when_colors_live_in_tokens(self):
        self.assertNotIn("AD106", rules_fired(CLEAN))

    def test_ad106_silent_when_token_refs_dominate(self):
        """A few literals beside a used token system is normal, not a finding.

        A flat 'three or more literals' threshold fired on 49.4% of a 476-page
        corpus and gave the author nothing to act on.
        """
        few = ".a{color:#111}.b{background:#222}.c{border-color:#333}"
        ok = swap(".prose { max-width: 62ch;", few + "\n  .prose { max-width: 62ch;")
        self.assertNotIn("AD106", rules_fired(ok))

    def test_ad107_component_styled_in_theme_block(self):
        bad = swap(':root[data-theme="dark"] {\n    --paper: #14120f;',
                   ':root[data-theme="dark"] {\n    --paper: #14120f;\n  }\n  '
                   '[data-theme="dark"] .prose { color: #fff;')
        self.assertIn("AD107", rules_fired(bad))

    def test_ad101_no_root_tokens(self):
        bad = CLEAN.replace(":root {\n    --paper", ".theme {\n    --paper", 1)
        self.assertIn("AD101", rules_fired(bad))


class IdentityTests(unittest.TestCase):
    def test_ad201_missing_title(self):
        self.assertIn("AD201", rules_fired(swap("<title>Tide Ledger</title>", "")))

    def test_ad201_empty_title(self):
        self.assertIn("AD201", rules_fired(swap("<title>Tide Ledger</title>", "<title></title>")))

    def test_ad202_title_explainer(self):
        bad = swap("<title>Tide Ledger</title>",
                   "<title>Tide Ledger — readings from the harbour gauge</title>")
        self.assertIn("AD202", rules_fired(bad))

    def test_ad202_fires_on_short_tail_with_function_words(self):
        bad = swap("<title>Tide Ledger</title>", "<title>Tide Ledger: for the harbour</title>")
        self.assertIn("AD202", rules_fired(bad))

    def test_ad202_allows_a_qualified_name(self):
        """`Product — Variant` is two names, not a name plus a caption.

        Matching on the separator alone fired on 80.7% of a 476-page corpus of
        hand-authored mockups, nearly all of them this shape.
        """
        for title in ("Agent Astronomer — Aurora Deep",
                      "Tide Ledger · Harbour",
                      "Atomize: Timeline",
                      # every one of these was a false positive on the real corpus
                      "Tests - Draft A",
                      "ProductPilot — Your Documents",
                      "IBR — Native Testing View (Wireframe)",
                      "Atomize AI — Full App (Concept D)",
                      "SpeakSavvy Icon — Option 7: SS Gradient Blend",
                      "FloDoro - Timeline Journal (Liquid Gradient)"):
            ok = swap("<title>Tide Ledger</title>", f"<title>{title}</title>")
            self.assertNotIn("AD202", rules_fired(ok), title)

    def test_ad202_still_catches_real_captions(self):
        for title in ("ProductPilot — From idea to implementation docs in minutes",
                      "Tide Ledger — readings from the harbour gauge",
                      "Atomize: how the pipeline routes a story"):
            bad = swap("<title>Tide Ledger</title>", f"<title>{title}</title>")
            self.assertIn("AD202", rules_fired(bad), title)

    def test_ad203_title_too_long(self):
        bad = swap("<title>Tide Ledger</title>",
                   "<title>Tide Ledger for the harbour gauge across nine seasons</title>")
        self.assertIn("AD203", rules_fired(bad))

    def test_ad204_generic_title(self):
        self.assertIn("AD204", rules_fired(swap("<title>Tide Ledger</title>",
                                                "<title>Dashboard</title>")))


class LayoutTests(unittest.TestCase):
    def test_ad301_table_without_scroller(self):
        bad = swap('<div class="scroller">', "<div>")
        self.assertIn("AD301", rules_fired(bad))

    def test_ad302_motion_without_escape(self):
        bad = swap(".prose { max-width: 62ch;", ".fade { transition: opacity .3s; }\n  "
                                                ".prose { max-width: 62ch;")
        self.assertIn("AD302", rules_fired(bad))

    def test_ad302_silent_when_escape_present(self):
        ok = swap(".prose { max-width: 62ch;",
                  ".fade { transition: opacity .3s; }\n  "
                  "@media (prefers-reduced-motion: reduce) { .fade { transition: none; } }\n  "
                  ".prose { max-width: 62ch;")
        self.assertNotIn("AD302", rules_fired(ok))

    def test_ad303_no_focus_style(self):
        bad = swap("a:focus-visible { outline: 2px solid var(--accent); }", "")
        bad = swap("<h1>Tide Ledger</h1>", "<h1>Tide Ledger</h1><button>Go</button>", bad)
        self.assertIn("AD303", rules_fired(bad))

    def test_ad304_prose_without_measure(self):
        bad = swap(".prose { max-width: 62ch; display: grid; gap: 1rem; }",
                   ".prose { display: grid; gap: 1rem; }")
        bad = swap("<p>Readings from the harbour gauge.</p>",
                   "<p>a</p><p>b</p><p>c</p><p>d</p><p>e</p>", bad)
        self.assertIn("AD304", rules_fired(bad))

    def test_ad305_numeric_table_without_tabular_nums(self):
        bad = swap("font-variant-numeric: tabular-nums;", "")
        bad = swap("<tr><td>06:00</td><td>1.42</td></tr>",
                   "<tr><td>1.4</td><td>2.5</td><td>3.6</td></tr>", bad)
        self.assertIn("AD305", rules_fired(bad))


class ClicheTests(unittest.TestCase):
    def test_ad401_cream_ground(self):
        self.assertIn("AD401", rules_fired(swap("--paper: #fbf9f5;", "--paper: #F4F1EA;")))

    def test_ad401_acid_on_near_black(self):
        bad = swap("--paper: #fbf9f5;", "--paper: #0a0a0a;")
        bad = swap("--accent: #7a4a2b;", "--accent: #22ff88;", bad)
        self.assertIn("AD401", rules_fired(bad))

    def test_ad401_purple_blue_gradient(self):
        bad = swap(".prose { max-width: 62ch;",
                   ".hero { background: linear-gradient(90deg, #7c3aed, #2563eb); }\n  "
                   ".prose { max-width: 62ch;")
        self.assertIn("AD401", rules_fired(bad))

    def test_ad402_inter_only(self):
        self.assertIn("AD402", rules_fired(swap("font-family: Palatino, serif;",
                                                "font-family: Inter, sans-serif;")))

    def test_ad403_emoji_heading(self):
        self.assertIn("AD403", rules_fired(swap("<h1>Tide Ledger</h1>", "<h1>🌊 Tide Ledger</h1>")))

    def test_ad404_uniform_radius(self):
        bad = swap(".prose { max-width: 62ch;",
                   ".a{border-radius:12px}.b{border-radius:12px}"
                   ".c{border-radius:12px}.d{border-radius:12px}\n  .prose { max-width: 62ch;")
        self.assertIn("AD404", rules_fired(bad))


class SvgTests(unittest.TestCase):
    def test_as501_missing_viewbox(self):
        self.assertIn("AS501", rules_fired(swap('viewBox="0 0 220 90" ', "")))

    def test_as502_fixed_size_without_responsive_rule(self):
        bad = swap("  svg { max-width: 100%; height: auto; }\n", "")
        bad = swap('<svg viewBox="0 0 220 90" role="img"',
                   '<svg width="900" height="400" role="img"', bad)
        self.assertIn("AS502", rules_fired(bad))

    def test_as502_silent_with_responsive_rule(self):
        ok = swap('<svg viewBox="0 0 220 90" role="img"',
                  '<svg width="900" height="400" role="img"')
        self.assertNotIn("AS502", rules_fired(ok))

    def test_as503_script_inside_svg(self):
        bad = swap("<rect x=\"4\" y=\"26\"", "<script>x()</script><rect x=\"4\" y=\"26\"")
        self.assertIn("AS503", rules_fired(bad))

    def test_as503_foreign_object(self):
        bad = swap("<rect x=\"4\" y=\"26\"",
                   "<foreignObject><div>x</div></foreignObject><rect x=\"4\" y=\"26\"")
        self.assertIn("AS503", rules_fired(bad))

    def test_as504_external_href(self):
        bad = swap("<rect x=\"4\" y=\"26\"", '<use href="https://x.test/a.svg#i"/><rect x="4" y="26"')
        self.assertIn("AS504", rules_fired(bad))

    def test_as505_missing_a11y(self):
        bad = swap(' role="img" aria-label="The gauge writes to the ledger."', "")
        self.assertIn("AS505", rules_fired(bad))

    def test_as506_missing_figure(self):
        bad = swap("<figure>", "<div>")
        bad = swap("</figure>", "</div>", bad)
        self.assertIn("AS506", rules_fired(bad))

    def test_as507_text_too_small(self):
        self.assertIn("AS507", rules_fired(swap('font-size="12"', 'font-size="7"')))

    def test_as508_many_literal_colors(self):
        bad = swap('stroke="currentColor"/>\n      <text x="44"',
                   'stroke="#ff0000"/>\n      <text x="44"')
        bad = swap('fill="none" stroke="currentColor"/>\n      <text x="168"',
                   'fill="#00ff00" stroke="#0000ff"/>\n      <text x="168"', bad)
        self.assertIn("AS508", rules_fired(bad))

    def test_as509_unlabeled_arrow(self):
        bad = swap('<text x="106" y="38" text-anchor="middle" font-size="11" '
                   'fill="currentColor">writes</text>', "")
        self.assertIn("AS509", rules_fired(bad))

    def test_as510_raster_in_svg(self):
        bad = swap("<rect x=\"4\" y=\"26\"", '<image href="data:image/png;base64,AA"/><rect x="4" y="26"')
        self.assertIn("AS510", rules_fired(bad))

    def test_charts_are_not_judged_as_diagrams(self):
        """A categorical palette is correct dataviz, not a colour-budget violation.

        AS506 (figure/caption) and AS508 (one accent) are about explanatory
        diagrams. Gating them on `has text` alone fired on every bar chart in a
        476-page corpus and contradicted the data-visualization skill.
        """
        chart = swap("<h1>Tide Ledger</h1>", """<h1>Tide Ledger</h1>
        <svg viewBox="0 0 200 100" role="img" aria-label="Tide height by hour.">
          <rect x="10" y="40" width="20" height="50" fill="#2563eb"/>
          <rect x="40" y="20" width="20" height="70" fill="#059669"/>
          <rect x="70" y="55" width="20" height="35" fill="#d97706"/>
          <rect x="100" y="30" width="20" height="60" fill="#7c3aed"/>
          <text x="20" y="98" font-size="11">06</text>
          <text x="50" y="98" font-size="11">12</text>
        </svg>""")
        fired = rules_fired(chart)
        self.assertNotIn("AS508", fired, "colour budget applied to a chart")
        self.assertNotIn("AS506", fired, "figure/caption required of a chart")

    def test_charts_still_get_the_universal_svg_rules(self):
        """Exempting charts from diagram rules must not exempt them from a11y."""
        chart = swap("<h1>Tide Ledger</h1>", """<h1>Tide Ledger</h1>
        <svg viewBox="0 0 200 100">
          <rect x="10" y="40" width="20" height="50" fill="#2563eb"/>
          <text x="20" y="98" font-size="11">06</text>
        </svg>""")
        self.assertIn("AS505", rules_fired(chart))

    def test_icon_svgs_are_not_judged_as_diagrams(self):
        """An SVG with no text is an icon; diagram rules must stay quiet."""
        icon = swap("<h1>Tide Ledger</h1>",
                    '<h1>Tide Ledger</h1><svg width="16" height="16">'
                    '<circle cx="8" cy="8" r="6" fill="currentColor"/></svg>')
        fired = rules_fired(icon)
        for rid in ("AS501", "AS505", "AS506", "AS507", "AS509"):
            self.assertNotIn(rid, fired, f"{rid} fired on a plain icon")


class ContractTests(unittest.TestCase):
    def test_rule_ids_unique(self):
        ids = [r.id for r in AL.RULES]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_rule_has_rationale_and_fix(self):
        for r in AL.RULES:
            self.assertTrue(r.rationale.strip(), r.id)
            self.assertTrue(r.fix.strip(), r.id)
            self.assertIn(r.severity, AL.SEVERITIES, r.id)
            self.assertTrue(set(r.profiles) <= set(AL.PROFILES), r.id)

    def test_heuristic_rules_never_error(self):
        """A heuristic that can hard-block is the noisy-gate failure mode."""
        for r in AL.RULES:
            if r.heuristic:
                self.assertNotEqual("error", r.severity,
                                    f"{r.id} is heuristic but ships as error")

    def test_every_rule_is_reachable(self):
        """Each declared rule must be emitted by at least one test fixture."""
        covered = set()
        for cls in (PortabilityTests, ThemeTests, IdentityTests, LayoutTests,
                    ClicheTests, SvgTests):
            for name in dir(cls):
                if not name.startswith("test_"):
                    continue
                m = name.split("_")
                if len(m) > 1 and len(m[1]) == 5 and m[1][:2].isalpha():
                    covered.add(m[1].upper())
        declared = {r.id for r in AL.RULES}
        self.assertEqual(set(), declared - covered,
                         f"rules with no test: {sorted(declared - covered)}")


class CliTests(unittest.TestCase):
    def _run(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(SCRIPT), *args],
                              capture_output=True, text=True)

    def test_rules_json_is_valid(self):
        r = self._run("rules", "--json")
        self.assertEqual(0, r.returncode, r.stderr)
        data = json.loads(r.stdout)
        self.assertEqual(len(AL.RULES), len(data["rules"]))
        self.assertIn("severity_policy", data)

    def test_check_exit_codes(self):
        with tempfile.TemporaryDirectory() as td:
            good = Path(td) / "good.html"
            good.write_text(CLEAN, encoding="utf-8")
            bad = Path(td) / "bad.html"
            bad.write_text('<script src="https://x.test/a.js"></script>', encoding="utf-8")

            self.assertEqual(0, self._run("check", str(good)).returncode)
            self.assertEqual(1, self._run("check", str(bad)).returncode)
            self.assertEqual(
                0, self._run("check", str(bad), "--disable", "AX002,AD201,AD105").returncode)
            self.assertEqual(0, self._run("check", str(bad), "--fail-on", "never").returncode)

    def test_unknown_rule_id_is_usage_error(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "a.html"
            p.write_text(CLEAN, encoding="utf-8")
            self.assertEqual(2, self._run("check", str(p), "--disable", "ZZ999").returncode)

    def test_missing_file_is_usage_error(self):
        self.assertEqual(2, self._run("check", "/nonexistent/nope.html").returncode)

    def test_check_json_shape(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "a.html"
            p.write_text(CLEAN, encoding="utf-8")
            r = self._run("check", str(p), "--json")
            data = json.loads(r.stdout)
            self.assertTrue(data["ok"])
            self.assertEqual("claude-artifact", data["results"][0]["profile"])

    def test_directory_walk(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "a.html").write_text(CLEAN, encoding="utf-8")
            (Path(td) / "b.html").write_text(CLEAN, encoding="utf-8")
            r = self._run("check", td, "--json")
            self.assertEqual(2, len(json.loads(r.stdout)["results"]))


class ProfileTests(unittest.TestCase):
    def test_profile_auto_detection(self):
        with tempfile.TemporaryDirectory() as td:
            frag = Path(td) / "a.html"
            frag.write_text(CLEAN, encoding="utf-8")
            doc = Path(td) / "b.html"
            doc.write_text("<!doctype html><html></html>", encoding="utf-8")
            md = Path(td) / "c.md"
            md.write_text("# hi", encoding="utf-8")
            self.assertEqual("claude-artifact", AL.detect_profile(frag, CLEAN))
            self.assertEqual("standalone", AL.detect_profile(doc, doc.read_text()))
            self.assertEqual("markdown", AL.detect_profile(md, "# hi"))

    def test_markdown_external_image(self):
        fired = rules_fired("![x](https://example.com/a.png)", "markdown", ".md")
        self.assertIn("AX001", fired)

    def test_markdown_skips_html_rules(self):
        fired = rules_fired("# Title\n\nSome prose.\n", "markdown", ".md")
        self.assertEqual(set(), fired)


if __name__ == "__main__":
    unittest.main(verbosity=2)
