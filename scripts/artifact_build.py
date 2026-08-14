#!/usr/bin/env python3
"""artifact_build — move a self-contained page between artifact profiles.

Stdlib only. No network. No build step.

    python3 artifact_build.py new  --title "Tide Ledger" --favicon 🌊 -o page.html
    python3 artifact_build.py wrap fragment.html -o page.html --title "Tide Ledger"
    python3 artifact_build.py unwrap page.html -o fragment.html
    python3 artifact_build.py info page.html --json

Why this exists
---------------
Claude's Artifact tool takes a *fragment*: the harness supplies
<!doctype>/<html>/<head>/<body>, so the file you write must not. That fragment is
not an openable .html file — double-clicking it gives you a page with no title, no
charset, no viewport, and no favicon.

`wrap` converts a fragment into a real document you can open with file:// or drop on
any static host. `unwrap` converts it back so the same source can still be published
through the Artifact tool. `new` emits a skeleton that already satisfies the
three-state theme contract, so an agent starts from a correct page instead of a
prose description of one.

Round-trip fidelity: everything this script injects is tagged
`data-artifact-build="..."`, and `unwrap` removes exactly those nodes. Authored
content is never rewritten.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Sequence
from urllib.parse import quote

__version__ = "1.0.0"

GENERATED_MARKER = "data-artifact-build"

RESET_CSS = """\
*, *::before, *::after { box-sizing: border-box; }
body, h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd { margin: 0; }
img, picture, svg, video, canvas { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; }
"""

THEME_TOGGLE_CSS = """\
.artifact-theme-toggle {
  position: fixed; top: 1rem; right: 1rem; z-index: 999;
  font: inherit; font-size: .8125rem; line-height: 1;
  padding: .5rem .75rem; cursor: pointer;
  color: inherit; background: transparent;
  border: 1px solid currentColor; border-radius: .25rem; opacity: .55;
}
.artifact-theme-toggle:hover, .artifact-theme-toggle:focus-visible { opacity: 1; }
"""

# Runs before first paint so a stored choice never flashes the other theme.
THEME_BOOT_JS = """\
(function () {
  var KEY = 'artifact-theme';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  if (stored === 'dark' || stored === 'light') {
    document.documentElement.setAttribute('data-theme', stored);
  }
  window.__artifactToggleTheme = function () {
    var root = document.documentElement;
    var now = root.getAttribute('data-theme');
    if (!now) {
      now = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var next = now === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  };
})();
"""

THEME_TOGGLE_HTML = (
    '<button class="artifact-theme-toggle" type="button" '
    f'{GENERATED_MARKER}="theme-toggle" '
    'onclick="window.__artifactToggleTheme()">theme</button>'
)

SCAFFOLD_BODY = """\
<main class="prose">
  <h1>{title}</h1>
  <p>Replace this with real content. Never ship lorem.</p>
</main>
"""

SCAFFOLD_CSS = """\
:root {{
  --paper: {paper};
  --ink: {ink};
  --muted: {muted};
  --accent: {accent};
  --rule: {rule};
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --paper: {d_paper};
    --ink: {d_ink};
    --muted: {d_muted};
    --accent: {d_accent};
    --rule: {d_rule};
  }}
}}
:root[data-theme="dark"] {{
  --paper: {d_paper};
  --ink: {d_ink};
  --muted: {d_muted};
  --accent: {d_accent};
  --rule: {d_rule};
}}
body {{
  background: var(--paper);
  color: var(--ink);
  font-family: {body_font};
  line-height: 1.55;
  padding: clamp(1.5rem, 5vw, 4rem);
}}
.prose {{ display: grid; gap: 1rem; max-width: 65ch; margin-inline: auto; }}
.scroller {{ overflow-x: auto; }}
table {{ border-collapse: collapse; font-variant-numeric: tabular-nums; }}
th, td {{ border-bottom: 1px solid var(--rule); padding: .4rem .8rem; text-align: left; }}
a {{ color: var(--accent); }}
:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
figcaption {{ color: var(--muted); font-size: .875rem; }}
svg {{ max-width: 100%; height: auto; }}
@media (prefers-reduced-motion: reduce) {{
  *, *::before, *::after {{ animation-duration: .01ms !important; transition-duration: .01ms !important; }}
}}
"""

# A deliberately un-clichéd default: the neutral carries a slight hue bias toward
# the accent rather than being a pure mid-grey, and the accent is not one of the
# current AI-design defaults.
SCAFFOLD_PALETTE = {
    "paper": "#fbf9f5", "ink": "#1c1a17", "muted": "#6b655c",
    "accent": "#7a4a2b", "rule": "#e2ddd3",
    "d_paper": "#14120f", "d_ink": "#ece7de", "d_muted": "#9a9287",
    "d_accent": "#d99a63", "d_rule": "#2c2822",
    "body_font": '"Iowan Old Style", Palatino, Georgia, serif',
}


# ---------------------------------------------------------------------------
# Span-aware parsing (so unwrap slices source instead of re-serialising it)
# ---------------------------------------------------------------------------

@dataclass
class Span:
    tag: str
    attrs: dict[str, str]
    start: int           # offset of '<'
    content_start: int   # offset just past the start tag
    content_end: int     # offset of the matching '</tag'
    end: int             # offset just past '</tag>'

    def outer(self, src: str) -> str:
        return src[self.start:self.end]

    def inner(self, src: str) -> str:
        return src[self.content_start:self.content_end]


class SpanParser(HTMLParser):
    """Records source spans for the structural tags unwrap needs."""

    TRACKED = {"html", "head", "body", "title", "style", "script", "link", "meta"}

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.line_offsets = [0]
        for i, ch in enumerate(source):
            if ch == "\n":
                self.line_offsets.append(i + 1)
        self.spans: list[Span] = []
        self._open: list[tuple[str, dict[str, str], int, int]] = []

    def _offset(self) -> int:
        line, col = self.getpos()
        return self.line_offsets[line - 1] + col

    VOID = {"link", "meta"}

    def handle_starttag(self, tag, attrs):
        if tag not in self.TRACKED:
            return
        start = self._offset()
        content_start = start + len(self.get_starttag_text() or "")
        if tag in self.VOID:
            # Void tags never reach handle_endtag. Emit now — parking them on the
            # open stack loses them when the enclosing element closes.
            self.spans.append(Span(tag, {k: (v or "") for k, v in attrs},
                                   start, content_start, content_start, content_start))
            return
        self._open.append((tag, {k: (v or "") for k, v in attrs}, start, content_start))

    def handle_startendtag(self, tag, attrs):
        if tag not in self.TRACKED:
            return
        start = self._offset()
        end = start + len(self.get_starttag_text() or "")
        self.spans.append(Span(tag, {k: (v or "") for k, v in attrs}, start, end, end, end))

    def handle_endtag(self, tag):
        if tag not in self.TRACKED:
            return
        close = self._offset()
        for i in range(len(self._open) - 1, -1, -1):
            if self._open[i][0] == tag:
                name, attrs, start, content_start = self._open.pop(i)
                del self._open[i:]
                end = self.source.find(">", close)
                end = close if end == -1 else end + 1
                self.spans.append(Span(name, attrs, start, content_start, close, end))
                return

    def parse(self) -> list[Span]:
        self.feed(self.source)
        self.close()
        self.spans.sort(key=lambda s: s.start)
        return self.spans


def first_span(spans: Sequence[Span], tag: str) -> Span | None:
    for s in spans:
        if s.tag == tag:
            return s
    return None


# ---------------------------------------------------------------------------
# Favicon
# ---------------------------------------------------------------------------

def favicon_data_uri(emoji: str) -> str:
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<text x="50" y="52" font-size="76" text-anchor="middle" '
        f'dominant-baseline="central">{emoji}</text></svg>'
    )
    return "data:image/svg+xml," + quote(svg, safe="")


# ---------------------------------------------------------------------------
# wrap / unwrap / new
# ---------------------------------------------------------------------------

def extract_title(fragment: str) -> str | None:
    m = re.search(r"<title[^>]*>(.*?)</title>", fragment, re.DOTALL | re.IGNORECASE)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip() or None
    m = re.search(r"<h1[^>]*>(.*?)</h1>", fragment, re.DOTALL | re.IGNORECASE)
    if m:
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(1))).strip() or None
    return None


def strip_title(fragment: str) -> str:
    return re.sub(r"[ \t]*<title[^>]*>.*?</title>[ \t]*\n?", "", fragment,
                  count=1, flags=re.DOTALL | re.IGNORECASE)


def indent(block: str, spaces: int) -> str:
    pad = " " * spaces
    return "\n".join(pad + line if line.strip() else line for line in block.rstrip().split("\n"))


def wrap(fragment: str, title: str | None = None, favicon: str | None = None,
         lang: str = "en", reset: bool = True, theme_toggle: bool = False,
         description: str | None = None) -> str:
    resolved_title = title or extract_title(fragment) or "Untitled Artifact"
    body = strip_title(fragment).strip("\n")

    head: list[str] = [
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        f"  <title>{resolved_title}</title>",
    ]
    if description:
        head.append(f'  <meta name="description" content="{description}">')
    if favicon:
        head.append(
            f'  <link rel="icon" {GENERATED_MARKER}="favicon" '
            f'href="{favicon_data_uri(favicon)}">'
        )
    if reset:
        head.append(f'  <style {GENERATED_MARKER}="reset">\n{indent(RESET_CSS, 4)}\n  </style>')
    if theme_toggle:
        head.append(f'  <style {GENERATED_MARKER}="theme-toggle">\n'
                    f'{indent(THEME_TOGGLE_CSS, 4)}\n  </style>')
        head.append(f'  <script {GENERATED_MARKER}="theme-toggle">\n'
                    f'{indent(THEME_BOOT_JS, 4)}\n  </script>')

    body_parts = [indent(body, 2)]
    if theme_toggle:
        body_parts.insert(0, "  " + THEME_TOGGLE_HTML)

    return (
        "<!doctype html>\n"
        f'<html lang="{lang}">\n'
        "<head>\n" + "\n".join(head) + "\n</head>\n"
        "<body>\n" + "\n".join(body_parts) + "\n</body>\n"
        "</html>\n"
    )


def unwrap(document: str) -> str:
    spans = SpanParser(document).parse()
    body = first_span(spans, "body")
    head = first_span(spans, "head")
    if body is None:
        raise ValueError("no <body> element — this file is already a fragment")

    kept: list[str] = []
    title = first_span(spans, "title")
    if title is not None:
        kept.append(title.outer(document).strip())

    if head is not None:
        for s in spans:
            if s.tag not in ("style", "script"):
                continue
            if not (head.content_start <= s.start < head.content_end):
                continue
            if GENERATED_MARKER in s.attrs:
                continue
            kept.append(s.outer(document).strip())

    inner = body.inner(document)
    # Drop only the nodes this tool injected, matched on the marker attribute.
    inner = re.sub(
        rf"[ \t]*<button[^>]*{re.escape(GENERATED_MARKER)}=\"theme-toggle\"[^>]*>.*?</button>[ \t]*\n?",
        "", inner, flags=re.DOTALL | re.IGNORECASE,
    )
    kept.append(dedent_block(inner).strip("\n"))
    return "\n".join(part for part in kept if part.strip()) + "\n"


def dedent_block(text: str) -> str:
    lines = text.split("\n")
    widths = [len(l) - len(l.lstrip(" ")) for l in lines if l.strip()]
    if not widths:
        return text
    cut = min(widths)
    return "\n".join(l[cut:] if l.strip() else l for l in lines)


def scaffold(title: str, profile: str, favicon: str | None, lang: str,
             theme_toggle: bool) -> str:
    css = SCAFFOLD_CSS.format(**SCAFFOLD_PALETTE)
    fragment = (
        f"<title>{title}</title>\n"
        f"<style>\n{indent(css, 2)}\n</style>\n"
        f"{SCAFFOLD_BODY.format(title=title)}"
    )
    if profile == "claude-artifact":
        return fragment
    return wrap(fragment, title=title, favicon=favicon, lang=lang,
                reset=True, theme_toggle=theme_toggle)


# ---------------------------------------------------------------------------
# Font embedding
# ---------------------------------------------------------------------------

# Magic bytes -> (mime, css format()). Checking these stops a mislabelled or
# wrong file from being embedded as megabytes of base64 that silently never loads.
FONT_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"wOF2", "font/woff2", "woff2"),
    (b"wOFF", "font/woff", "woff"),
    (b"OTTO", "font/otf", "opentype"),
    (b"true", "font/ttf", "truetype"),
    (b"ttcf", "font/collection", "collection"),
    (b"\x00\x01\x00\x00", "font/ttf", "truetype"),
)

# Base64 costs a third on top of the raw bytes, and the whole page shares a 16MB
# ceiling. A single face past this is worth a word before it lands.
FONT_WARN_BYTES = 400 * 1024


def sniff_font(data: bytes) -> tuple[str, str] | None:
    for magic, mime, fmt in FONT_SIGNATURES:
        if data.startswith(magic):
            return mime, fmt
    return None


def font_face_css(path: Path, family: str | None = None, weight: str = "400",
                  style: str = "normal", display: str = "swap") -> tuple[str, dict]:
    data = path.read_bytes()
    sniffed = sniff_font(data)
    if sniffed is None:
        raise ValueError(
            f"{path.name} is not a recognised font file "
            f"(expected woff2/woff/otf/ttf; got {data[:4]!r})")
    mime, fmt = sniffed
    if fmt == "woff2":
        advice = ""
    else:
        advice = (f"  /* {fmt} embeds ~{len(data) // 1024}KB; converting to woff2 "
                  f"typically cuts that by half or more */\n")
    name = family or re.split(r"[-_.]", path.stem)[0]
    b64 = base64.b64encode(data).decode("ascii")
    css = (
        "@font-face {\n"
        f"{advice}"
        f'  font-family: "{name}";\n'
        f"  font-style: {style};\n"
        f"  font-weight: {weight};\n"
        f"  font-display: {display};\n"
        f'  src: url(data:{mime};base64,{b64}) format("{fmt}");\n'
        "}\n"
    )
    meta = {
        "family": name, "format": fmt, "mime": mime,
        "source_bytes": len(data), "encoded_bytes": len(css.encode("utf-8")),
        "oversize": len(data) > FONT_WARN_BYTES,
    }
    return css, meta


# ---------------------------------------------------------------------------
# info
# ---------------------------------------------------------------------------

def describe(path: Path) -> dict:
    src = path.read_text(encoding="utf-8", errors="replace")
    spans = SpanParser(src).parse() if path.suffix.lower() not in (".md", ".markdown") else []
    has_wrapper = bool(re.search(r"(?i)<!doctype|<html[\s>]", src[:4096]))
    if path.suffix.lower() in (".md", ".markdown"):
        profile = "markdown"
    else:
        profile = "standalone" if has_wrapper else "claude-artifact"
    title_span = first_span(spans, "title")
    generated = sorted({s.attrs[GENERATED_MARKER] for s in spans if GENERATED_MARKER in s.attrs})
    external = sorted({
        m.group(0) for m in re.finditer(r"""(?i)(?:https?:)?//[^\s"'<>)]+""", src)
    })
    return {
        "file": str(path),
        "profile": profile,
        "bytes": len(src.encode("utf-8")),
        "title": re.sub(r"\s+", " ", title_span.inner(src)).strip() if title_span else None,
        "styles": sum(1 for s in spans if s.tag == "style"),
        "scripts": sum(1 for s in spans if s.tag == "script"),
        "generated_nodes": generated,
        "external_urls": external[:20],
        "external_url_count": len(external),
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _emit(text: str, out: str | None, quiet: bool) -> None:
    if out:
        Path(out).write_text(text, encoding="utf-8")
        if not quiet:
            print(f"wrote {out} ({len(text.encode('utf-8'))} bytes)", file=sys.stderr)
    else:
        sys.stdout.write(text)


def _post_check(out: str | None, profile: str) -> int:
    if not out:
        print("--check needs -o/--output", file=sys.stderr)
        return 2
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import artifact_lint  # noqa: PLC0415
    except ImportError:
        print("--check needs artifact_lint.py beside this script", file=sys.stderr)
        return 2
    findings = artifact_lint.lint(Path(out), profile)
    errors = [f for f in findings if f.severity == "error"]
    for f in findings:
        print(f"  {f.severity:<5} {f.rule}  line {f.line}  {f.message}", file=sys.stderr)
    print(f"artifact_lint: {len(errors)} error, "
          f"{sum(1 for f in findings if f.severity == 'warn')} warn", file=sys.stderr)
    return 1 if errors else 0


def cmd_wrap(args) -> int:
    src = Path(args.input).read_text(encoding="utf-8", errors="replace")
    if re.search(r"(?i)<!doctype|<html[\s>]", src[:4096]):
        print("artifact_build: input already looks like a full document; "
              "run `unwrap` first if you meant to re-wrap it", file=sys.stderr)
        return 2
    text = wrap(src, args.title, args.favicon, args.lang,
                reset=not args.no_reset, theme_toggle=args.theme_toggle,
                description=args.description)
    _emit(text, args.output, args.quiet)
    return _post_check(args.output, "standalone") if args.check else 0


def cmd_unwrap(args) -> int:
    src = Path(args.input).read_text(encoding="utf-8", errors="replace")
    try:
        text = unwrap(src)
    except ValueError as exc:
        print(f"artifact_build: {exc}", file=sys.stderr)
        return 2
    _emit(text, args.output, args.quiet)
    return _post_check(args.output, "claude-artifact") if args.check else 0


def cmd_new(args) -> int:
    text = scaffold(args.title, args.profile, args.favicon, args.lang, args.theme_toggle)
    _emit(text, args.output, args.quiet)
    return _post_check(args.output, args.profile) if args.check else 0


def cmd_embed_font(args) -> int:
    path = Path(args.input)
    if not path.is_file():
        print(f"artifact_build: no such file: {path}", file=sys.stderr)
        return 2
    try:
        css, meta = font_face_css(path, args.family, args.weight, args.style, args.display)
    except ValueError as exc:
        print(f"artifact_build: {exc}", file=sys.stderr)
        return 2
    _emit(css, args.output, args.quiet)
    if not args.quiet:
        print(f"{meta['family']} ({meta['format']}): {meta['source_bytes'] / 1024:.0f}KB "
              f"source -> {meta['encoded_bytes'] / 1024:.0f}KB embedded", file=sys.stderr)
        if meta["oversize"]:
            print(f"warning: {meta['source_bytes'] / 1024:.0f}KB is large for a single "
                  "face; subset it to the glyphs the page actually uses", file=sys.stderr)
    return 0


def cmd_info(args) -> int:
    path = Path(args.input)
    if not path.is_file():
        print(f"artifact_build: no such file: {path}", file=sys.stderr)
        return 2
    data = describe(path)
    if args.json:
        print(json.dumps(data, indent=2))
        return 0
    print(f"{data['file']}")
    print(f"  profile   {data['profile']}")
    print(f"  title     {data['title'] or '(none)'}")
    print(f"  size      {data['bytes']} bytes")
    print(f"  styles    {data['styles']}   scripts {data['scripts']}")
    print(f"  generated {', '.join(data['generated_nodes']) or '(none)'}")
    print(f"  external  {data['external_url_count']} url(s)")
    for u in data["external_urls"]:
        print(f"            {u}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="artifact_build",
        description="Move a self-contained page between artifact profiles.",
    )
    p.add_argument("--version", action="version", version=f"artifact_build {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    def shared(sp, with_input=True):
        if with_input:
            sp.add_argument("input")
        sp.add_argument("-o", "--output")
        sp.add_argument("--quiet", action="store_true")
        sp.add_argument("--check", action="store_true", help="run artifact_lint on the result")

    w = sub.add_parser("wrap", help="fragment -> standalone document")
    shared(w)
    w.add_argument("--title")
    w.add_argument("--favicon", help="one or two emoji")
    w.add_argument("--description")
    w.add_argument("--lang", default="en")
    w.add_argument("--no-reset", action="store_true", help="skip the minimal CSS reset")
    w.add_argument("--theme-toggle", action="store_true",
                   help="inject a light/dark toggle (nothing stamps data-theme off-viewer)")
    w.set_defaults(func=cmd_wrap)

    u = sub.add_parser("unwrap", help="standalone document -> fragment")
    shared(u)
    u.set_defaults(func=cmd_unwrap)

    n = sub.add_parser("new", help="scaffold a page that already satisfies the theme contract")
    shared(n, with_input=False)
    n.add_argument("--title", required=True)
    n.add_argument("--profile", choices=("claude-artifact", "standalone"), default="standalone")
    n.add_argument("--favicon")
    n.add_argument("--lang", default="en")
    n.add_argument("--theme-toggle", action="store_true")
    n.set_defaults(func=cmd_new)

    e = sub.add_parser("embed-font",
                       help="font file -> a self-contained @font-face block (fixes AX003)")
    e.add_argument("input", help="a .woff2 / .woff / .otf / .ttf file")
    e.add_argument("-o", "--output")
    e.add_argument("--quiet", action="store_true")
    e.add_argument("--family", help="CSS font-family name (default: the filename stem)")
    e.add_argument("--weight", default="400")
    e.add_argument("--style", default="normal")
    e.add_argument("--display", default="swap")
    e.set_defaults(func=cmd_embed_font)

    i = sub.add_parser("info", help="describe a file's profile, title, and external refs")
    i.add_argument("input")
    i.add_argument("--json", action="store_true")
    i.set_defaults(func=cmd_info)
    return p


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
