#!/usr/bin/env python3
"""Tests for artifact_build.

Stdlib only. Run: python3 test_artifact_build.py

The load-bearing property is round-trip fidelity: wrap -> unwrap must return the
author's fragment unchanged. If that breaks, the two profiles stop being two views
of one source and become two documents that drift.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import artifact_build as AB  # noqa: E402
import artifact_lint as AL  # noqa: E402
from test_artifact_lint import CLEAN  # noqa: E402

SCRIPT = HERE / "artifact_build.py"


class WrapTests(unittest.TestCase):
    def test_wrap_produces_a_complete_document(self):
        out = AB.wrap(CLEAN, favicon="🌊")
        self.assertTrue(out.startswith("<!doctype html>"))
        for needle in ('<html lang="en">', '<meta charset="utf-8">',
                       'name="viewport"', "<title>Tide Ledger</title>",
                       '<link rel="icon"', "</body>", "</html>"):
            self.assertIn(needle, out, needle)

    def test_wrap_infers_title_from_fragment(self):
        self.assertIn("<title>Tide Ledger</title>", AB.wrap(CLEAN))

    def test_wrap_falls_back_to_h1_then_placeholder(self):
        self.assertIn("<title>Harbour</title>", AB.wrap("<h1>Harbour</h1>"))
        self.assertIn("<title>Untitled Artifact</title>", AB.wrap("<p>no name</p>"))

    def test_explicit_title_wins(self):
        self.assertIn("<title>Override</title>", AB.wrap(CLEAN, title="Override"))

    def test_title_is_not_duplicated_in_body(self):
        out = AB.wrap(CLEAN)
        self.assertEqual(1, out.count("<title>"))

    def test_favicon_is_a_self_contained_data_uri(self):
        uri = AB.favicon_data_uri("🌊")
        self.assertTrue(uri.startswith("data:image/svg+xml,"))
        decoded = unquote(uri)
        self.assertIn("🌊", decoded)
        # The SVG namespace is a bare identifier, never fetched. Nothing else in
        # the payload may point off-host.
        remainder = decoded.replace("http://www.w3.org/2000/svg", "")
        self.assertNotIn("://", remainder)

    def test_no_reset_omits_the_reset_block(self):
        self.assertNotIn('data-artifact-build="reset"', AB.wrap(CLEAN, reset=False))
        self.assertIn('data-artifact-build="reset"', AB.wrap(CLEAN, reset=True))

    def test_theme_toggle_is_opt_in(self):
        self.assertNotIn("artifact-theme-toggle", AB.wrap(CLEAN))
        out = AB.wrap(CLEAN, theme_toggle=True)
        self.assertIn("artifact-theme-toggle", out)
        self.assertIn("__artifactToggleTheme", out)
        self.assertIn("localStorage", out)

    def test_every_injected_node_carries_the_marker(self):
        """unwrap identifies generated nodes by marker, so injection must stamp them."""
        out = AB.wrap(CLEAN, favicon="🌊", theme_toggle=True)
        for tag in ('<link rel="icon"', "<style", "<script", "<button"):
            idx = 0
            while (idx := out.find(tag, idx)) != -1:
                head = out[idx:out.find(">", idx)]
                if "artifact-theme-toggle" in head or "rel=\"icon\"" in head or \
                        AB.GENERATED_MARKER in head:
                    self.assertIn(AB.GENERATED_MARKER, head, head)
                idx += 1


class RoundTripTests(unittest.TestCase):
    def _round(self, fragment: str, **kw) -> str:
        return AB.unwrap(AB.wrap(fragment, **kw))

    def test_round_trip_is_lossless(self):
        self.assertEqual(CLEAN.strip(), self._round(CLEAN).strip())

    def test_round_trip_with_every_injection_enabled(self):
        out = self._round(CLEAN, favicon="🌊", theme_toggle=True, title="Tide Ledger")
        self.assertEqual(CLEAN.strip(), out.strip())
        self.assertNotIn("artifact-theme-toggle", out)
        self.assertNotIn(AB.GENERATED_MARKER, out)

    def test_round_trip_preserves_author_scripts(self):
        frag = CLEAN + "\n<script>console.log('mine')</script>\n"
        self.assertIn("console.log('mine')", self._round(frag))

    def test_unwrap_rejects_a_fragment(self):
        with self.assertRaises(ValueError):
            AB.unwrap(CLEAN)

    def test_both_profiles_lint_clean(self):
        with tempfile.TemporaryDirectory() as td:
            frag = Path(td) / "f.html"
            frag.write_text(CLEAN, encoding="utf-8")
            doc = Path(td) / "d.html"
            doc.write_text(AB.wrap(CLEAN, favicon="🌊", theme_toggle=True), encoding="utf-8")
            self.assertEqual([], AL.lint(frag, "claude-artifact"))
            self.assertEqual([], AL.lint(doc, "standalone"))


class ScaffoldTests(unittest.TestCase):
    def test_standalone_scaffold_lints_clean(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "s.html"
            p.write_text(AB.scaffold("Tide Ledger", "standalone", "🌊", "en", True),
                         encoding="utf-8")
            self.assertEqual([], [f"{f.rule}:{f.message}" for f in AL.lint(p, "standalone")])

    def test_fragment_scaffold_lints_clean(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "s.html"
            p.write_text(AB.scaffold("Tide Ledger", "claude-artifact", None, "en", False),
                         encoding="utf-8")
            self.assertEqual([], [f"{f.rule}:{f.message}"
                                  for f in AL.lint(p, "claude-artifact")])

    def test_scaffold_satisfies_the_three_state_theme_contract(self):
        css = AB.SCAFFOLD_CSS.format(**AB.SCAFFOLD_PALETTE)
        self.assertIn(":root {", css)
        self.assertIn(':root:not([data-theme="light"])', css)
        self.assertIn(':root[data-theme="dark"]', css)
        self.assertIn("background: var(--paper)", css)

    def test_scaffold_avoids_the_ai_default_palette(self):
        """The scaffold ships to every user; it must not be a cliché by default."""
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "s.html"
            p.write_text(AB.scaffold("Tide Ledger", "standalone", None, "en", False),
                         encoding="utf-8")
            fired = {f.rule for f in AL.lint(p, "standalone")}
            self.assertNotIn("AD401", fired)
            self.assertNotIn("AD402", fired)


class EmbedFontTests(unittest.TestCase):
    """AX003 (font CDN) fired on 9% of the calibration corpus. This is the fix path."""

    def _font(self, td: str, magic: bytes, name: str = "Harbour-Regular.woff2") -> Path:
        p = Path(td) / name
        p.write_bytes(magic + b"\x00" * 512)
        return p

    def test_emits_a_self_contained_font_face(self):
        with tempfile.TemporaryDirectory() as td:
            css, meta = AB.font_face_css(self._font(td, b"wOF2"))
            self.assertIn("@font-face", css)
            self.assertIn('font-family: "Harbour"', css)
            self.assertIn("src: url(data:font/woff2;base64,", css)
            self.assertIn('format("woff2")', css)
            self.assertNotIn("http", css)
            self.assertEqual("woff2", meta["format"])

    def test_family_defaults_to_the_filename_stem_before_a_separator(self):
        with tempfile.TemporaryDirectory() as td:
            css, _ = AB.font_face_css(self._font(td, b"wOF2", "Iowan_Old_Style.ttf"))
            self.assertIn('font-family: "Iowan"', css)

    def test_explicit_family_and_axes_win(self):
        with tempfile.TemporaryDirectory() as td:
            css, _ = AB.font_face_css(self._font(td, b"wOF2"), family="Harbour Display",
                                      weight="700", style="italic", display="block")
            self.assertIn('font-family: "Harbour Display"', css)
            self.assertIn("font-weight: 700", css)
            self.assertIn("font-style: italic", css)
            self.assertIn("font-display: block", css)

    def test_format_is_sniffed_from_magic_bytes_not_the_extension(self):
        """A .woff2 name on a ttf payload would embed a face that never loads."""
        with tempfile.TemporaryDirectory() as td:
            _, meta = AB.font_face_css(self._font(td, b"\x00\x01\x00\x00", "X.woff2"))
            self.assertEqual("truetype", meta["format"])
            self.assertEqual("font/ttf", meta["mime"])

    def test_non_font_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(ValueError):
                AB.font_face_css(self._font(td, b"<htm", "notafont.woff2"))

    def test_non_woff2_gets_a_conversion_note(self):
        with tempfile.TemporaryDirectory() as td:
            css, _ = AB.font_face_css(self._font(td, b"OTTO", "X.otf"))
            self.assertIn("woff2", css.split("src:")[0])

    def test_oversize_is_flagged(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "Big.woff2"
            p.write_bytes(b"wOF2" + b"\x00" * (AB.FONT_WARN_BYTES + 10))
            self.assertTrue(AB.font_face_css(p)[1]["oversize"])

    def test_embedded_font_passes_the_linter(self):
        """The whole point: AX003 must not fire on the output."""
        with tempfile.TemporaryDirectory() as td:
            css, _ = AB.font_face_css(self._font(td, b"wOF2"))
            page = CLEAN.replace("<style>", "<style>\n" + css, 1)
            p = Path(td) / "page.html"
            p.write_text(page, encoding="utf-8")
            fired = {f.rule for f in AL.lint(p, "claude-artifact")}
            self.assertNotIn("AX003", fired)
            self.assertNotIn("AX001", fired)


class InfoTests(unittest.TestCase):
    def test_info_reports_profile_and_generated_nodes(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "d.html"
            p.write_text(AB.wrap(CLEAN, favicon="🌊", theme_toggle=True), encoding="utf-8")
            data = AB.describe(p)
            self.assertEqual("standalone", data["profile"])
            self.assertEqual("Tide Ledger", data["title"])
            self.assertIn("favicon", data["generated_nodes"])
            self.assertIn("theme-toggle", data["generated_nodes"])
            self.assertEqual(0, data["external_url_count"])

    def test_info_flags_external_urls(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "d.html"
            p.write_text('<script src="https://cdn.test/a.js"></script>', encoding="utf-8")
            self.assertEqual(1, AB.describe(p)["external_url_count"])


class CliTests(unittest.TestCase):
    def _run(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(SCRIPT), *args],
                              capture_output=True, text=True)

    def test_new_check_exits_zero(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "n.html"
            r = self._run("new", "--title", "Tide Ledger", "-o", str(out), "--check")
            self.assertEqual(0, r.returncode, r.stderr)
            self.assertTrue(out.is_file())

    def test_wrap_then_unwrap_via_cli(self):
        with tempfile.TemporaryDirectory() as td:
            frag = Path(td) / "f.html"
            frag.write_text(CLEAN, encoding="utf-8")
            doc = Path(td) / "d.html"
            back = Path(td) / "b.html"
            self.assertEqual(0, self._run("wrap", str(frag), "-o", str(doc),
                                          "--favicon", "🌊", "--check").returncode)
            self.assertEqual(0, self._run("unwrap", str(doc), "-o", str(back),
                                          "--check").returncode)
            self.assertEqual(CLEAN.strip(), back.read_text().strip())

    def test_wrap_refuses_an_already_wrapped_document(self):
        with tempfile.TemporaryDirectory() as td:
            doc = Path(td) / "d.html"
            doc.write_text(AB.wrap(CLEAN), encoding="utf-8")
            r = self._run("wrap", str(doc), "-o", str(Path(td) / "x.html"))
            self.assertEqual(2, r.returncode)
            self.assertIn("already looks like a full document", r.stderr)

    def test_unwrap_refuses_a_fragment(self):
        with tempfile.TemporaryDirectory() as td:
            frag = Path(td) / "f.html"
            frag.write_text(CLEAN, encoding="utf-8")
            self.assertEqual(2, self._run("unwrap", str(frag),
                                          "-o", str(Path(td) / "x.html")).returncode)

    def test_embed_font_cli(self):
        with tempfile.TemporaryDirectory() as td:
            font = Path(td) / "Harbour.woff2"
            font.write_bytes(b"wOF2" + b"\x00" * 256)
            out = Path(td) / "face.css"
            r = self._run("embed-font", str(font), "-o", str(out), "--family", "Harbour")
            self.assertEqual(0, r.returncode, r.stderr)
            self.assertIn("@font-face", out.read_text())

    def test_embed_font_rejects_non_font_with_usage_exit(self):
        with tempfile.TemporaryDirectory() as td:
            notfont = Path(td) / "a.woff2"
            notfont.write_text("<html>", encoding="utf-8")
            r = self._run("embed-font", str(notfont))
            self.assertEqual(2, r.returncode)
            self.assertIn("not a recognised font", r.stderr)

    def test_embed_font_missing_file_exits_two(self):
        self.assertEqual(2, self._run("embed-font", "/nonexistent/x.woff2").returncode)

    def test_info_json(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "d.html"
            p.write_text(AB.wrap(CLEAN), encoding="utf-8")
            r = self._run("info", str(p), "--json")
            self.assertEqual(0, r.returncode)
            self.assertEqual("standalone", json.loads(r.stdout)["profile"])

    def test_stdout_when_no_output_given(self):
        with tempfile.TemporaryDirectory() as td:
            frag = Path(td) / "f.html"
            frag.write_text(CLEAN, encoding="utf-8")
            r = self._run("wrap", str(frag))
            self.assertEqual(0, r.returncode)
            self.assertTrue(r.stdout.startswith("<!doctype html>"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
