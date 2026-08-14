#!/usr/bin/env python3
"""artifact_lint — deterministic checks for single-file, self-contained HTML artifacts.

Stdlib only. No network. No build step. Runs identically from Claude Code, Codex,
Cursor, a local model, a git hook, or CI.

    python3 artifact_lint.py check page.html
    python3 artifact_lint.py check page.html --profile standalone --json
    python3 artifact_lint.py rules --json

Why this exists
---------------
Claude Code's built-in `artifact-design` and `artifact-diagramming` skills are
compiled into the CLI binary: they have no on-disk surface, so no other agent can
read them, and they enforce nothing. They teach roughly forty mechanically-decidable
rules and check zero of them. This script encodes the decidable subset with stable
rule IDs so that (a) any agent can verify an artifact, not just describe one, and
(b) the prose in SKILL.md can cite IDs instead of restating rules and drifting.

Severity policy
---------------
Only mechanically unambiguous rules are `error`. Every heuristic ships `warn` or
`info` and can never hard-block by default. Rule precision is UNMEASURED at v1 —
treat `warn`/`info` as advisory until it has been measured on a real corpus.

Profiles
--------
claude-artifact  fragment published through Claude's Artifact tool; the harness
                 supplies <!doctype>/<html>/<head>/<body>, so the file must NOT.
standalone       an openable .html document (file://, any static host).
markdown         a .md publish; identity + portability subset only.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable, Sequence

__version__ = "1.0.0"

MAX_BYTES = 16 * 1024 * 1024

PROFILES = ("claude-artifact", "standalone", "markdown")

SEVERITIES = ("error", "warn", "info")
SEVERITY_RANK = {"error": 3, "warn": 2, "info": 1}

VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}

# Elements whose end tag is genuinely optional in HTML parsing. Excluded from the
# unclosed-element check so AX008 does not fire on legal markup.
OPTIONAL_END_TAG = {
    "p", "li", "dt", "dd", "option", "optgroup", "thead", "tbody", "tfoot",
    "tr", "td", "th", "rt", "rp", "colgroup", "caption",
}

INTERACTIVE_TAGS = {"button", "select", "textarea", "summary", "details"}

GENERIC_TITLES = {
    "dashboard", "report", "overview", "summary", "untitled", "document",
    "page", "analysis", "results", "notes", "plan", "guide", "index",
    "home", "readme", "output", "data", "chart", "app", "demo", "draft",
}

SVG_SHAPES = {"rect", "circle", "ellipse", "line", "polyline", "polygon", "path"}

COLOR_PROPS = {
    "color", "background", "background-color", "background-image",
    "border", "border-color", "border-top-color", "border-right-color",
    "border-bottom-color", "border-left-color", "outline", "outline-color",
    "fill", "stroke", "box-shadow", "text-shadow", "caret-color",
    "accent-color", "text-decoration-color", "column-rule-color",
}

HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b")
FUNC_COLOR_RE = re.compile(r"\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\s*\(")
CSS_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
EXTERNAL_URL_RE = re.compile(r"""(?i)\b(?:https?:)?//[^\s"')]+""")
CSS_URL_RE = re.compile(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)""", re.IGNORECASE)
AT_IMPORT_RE = re.compile(r"""@import\s+(?:url\(\s*)?['"]?([^'");\s]+)""", re.IGNORECASE)
CUSTOM_PROP_RE = re.compile(r"^--[\w-]+$")
EMOJI_RE = re.compile(
    "["
    "\U0001F000-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "\U00002B00-\U00002BFF"
    "\U0000FE00-\U0000FE0F"
    "]"
)
MERMAID_FENCE_RE = re.compile(r"^\s*```mermaid\b", re.MULTILINE)
CLAUDE_RUNTIME_RE = re.compile(r"\bwindow\s*\.\s*claude\b")
CLAUDE_GUARD_RE = re.compile(
    r"""(?x)
    typeof\s+window\s*\.\s*claude
    | window\s*\.\s*claude\s*\?\.
    | window\s*\.\s*claude\s*(?:&&|\|\||\?)
    | ['"]claude['"]\s+in\s+window
    | if\s*\(\s*window\s*\.\s*claude
    | window\s*\.\s*claude\s*!==?\s*undefined
    """
)

# Substrings that mark a URL as same-document / already-inlined, never external.
INTERNAL_URL_PREFIXES = ("data:", "blob:", "#", "javascript:", "about:", "mailto:", "tel:")


# ---------------------------------------------------------------------------
# Rule registry — the machine-readable contract other agents consume.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    severity: str
    profiles: tuple[str, ...]
    rationale: str
    fix: str
    heuristic: bool = False


def _r(rid, title, severity, profiles, rationale, fix, heuristic=False):
    return Rule(rid, title, severity, tuple(profiles), rationale, fix, heuristic)


ALL = PROFILES
HTML_ONLY = ("claude-artifact", "standalone")

RULES: tuple[Rule, ...] = (
    # --- AX: portability / self-containment -------------------------------
    _r("AX001", "external-resource-reference", "error", ALL,
       "A strict CSP blocks every request to another host, so an external URL "
       "resolves to nothing and the artifact silently renders wrong.",
       "Inline the asset, or embed it as a data: URI."),
    _r("AX002", "cdn-script", "error", HTML_ONLY,
       "A <script src> pointing off-host is blocked by the CSP; the page's "
       "behaviour disappears with no error the reader can see.",
       "Inline the script body, or drop the dependency."),
    _r("AX003", "webfont-cdn", "error", HTML_ONLY,
       "Font CDNs are blocked, so the page falls back to a system face and the "
       "typography you designed never ships.",
       "Inline the face with @font-face and a data: URI, or use a system stack."),
    _r("AX004", "document-wrapper-mismatch", "error", HTML_ONLY,
       "The Artifact harness supplies the document skeleton, so a fragment must "
       "not carry one; a standalone .html file must.",
       "Convert profiles with artifact_build.py wrap / unwrap."),
    _r("AX005", "oversize", "error", ALL,
       "The rendered page must be 16MB or smaller, and data: URIs count toward it.",
       "Compress or drop embedded assets."),
    _r("AX006", "download-affordance", "warn", HTML_ONLY,
       "The artifact viewer's sandbox blocks any download the page starts itself, "
       "so a download link is inert for every viewer but the author.",
       "Render the content in the page, or use a runtime capability."),
    _r("AX007", "capability-call-without-guard", "warn", HTML_ONLY,
       "window.claude.* exists only inside the Claude artifact viewer; unguarded "
       "calls throw everywhere else.",
       "Feature-detect before calling, and design a static fallback."),
    _r("AX008", "unclosed-element", "error", HTML_ONLY,
       "An unclosed element makes the browser's recovery parser guess at your "
       "structure; visual bugs hide in the gap between source and output.",
       "Close every non-void element."),
    _r("AX009", "mermaid-not-portable", "warn", ("standalone", "markdown"),
       "Claude's artifact viewer renders mermaid natively; a standalone file has "
       "no renderer, so the block ships as raw text.",
       "Hand-author the diagram as inline SVG (see the artifact-diagramming skill)."),

    # --- AD1xx: theme contract --------------------------------------------
    _r("AD101", "missing-root-palette", "warn", HTML_ONLY,
       "Without tokens on a bare :root there is nothing for the dark and "
       "data-theme blocks to redefine.",
       "Define the complete light palette as custom properties on :root."),
    _r("AD102", "color-only-in-conditional", "error", HTML_ONLY,
       "A token defined ONLY inside a media or [data-theme] block never applies "
       "in the un-stamped 'system' state — the classic unreadable-artifact bug.",
       "Define every token on bare :root first, then redefine it conditionally."),
    _r("AD103", "unguarded-dark-media", "warn", HTML_ONLY,
       "An unguarded dark media query beats an explicit light choice, so a "
       "reader who picked light on a dark OS still gets the dark palette.",
       'Guard the block as :root:not([data-theme="light"]).'),
    _r("AD104", "missing-data-theme-dark", "warn", HTML_ONLY,
       "Without a :root[data-theme=\"dark\"] block the explicit dark toggle "
       "does not win over a light OS.",
       'Redefine the tokens again under :root[data-theme="dark"].'),
    _r("AD105", "body-background-unset", "error", HTML_ONLY,
       "The viewer paints its own ground behind the page, so a transparent body "
       "silently borrows the host's theme and can render one theme's text on "
       "the other theme's ground.",
       "Set an explicit background on body (or html) from a token."),
    _r("AD106", "literal-color-outside-tokens", "info", HTML_ONLY,
       "Colors written as literals in component rules escape the token system "
       "and stop tracking the theme.",
       "Move the value into a :root token and reference it with var().", True),
    _r("AD107", "component-styled-in-theme-block", "warn", HTML_ONLY,
       "Styling a component directly inside a theme block means that component "
       "has no definition in the un-stamped state.",
       "Redefine tokens in theme blocks; style components through the tokens."),

    # --- AD2xx: page identity ---------------------------------------------
    _r("AD201", "missing-title", "error", HTML_ONLY,
       "The <title> is the artifact's name in the browser tab and the gallery; "
       "without it the page falls back to a filename.",
       "Add a <title> in the first 8KB of the file."),
    _r("AD202", "title-explainer", "warn", HTML_ONLY,
       "A title that carries its own explainer after a dash or colon reads as "
       "generated filler; the explanation belongs in the publish description.",
       "Keep the name, drop the appended clause."),
    _r("AD203", "title-too-long", "warn", HTML_ONLY,
       "A title is a name, typically two to four words — not a summary.",
       "Trim to the specific noun phrase."),
    _r("AD204", "title-generic", "info", HTML_ONLY,
       "A generic category label could sit on any page in the gallery, so it "
       "fails to identify this one.",
       "Name the subject, not the page type.", True),

    # --- AD3xx: layout / robustness ---------------------------------------
    _r("AD301", "wide-content-unscrollable", "warn", HTML_ONLY,
       "Wide content must scroll inside its own container or the page body "
       "scrolls sideways on narrow viewports.",
       "Wrap it in a container with overflow-x: auto.", True),
    _r("AD302", "no-reduced-motion", "warn", HTML_ONLY,
       "Motion without a prefers-reduced-motion escape hatch is a documented "
       "accessibility failure for readers with vestibular disorders.",
       "Add an @media (prefers-reduced-motion: reduce) block."),
    _r("AD303", "no-focus-visible", "warn", HTML_ONLY,
       "Keyboard users need a visible focus state; the default outline is often "
       "removed by a reset and never replaced.",
       "Style :focus-visible on interactive elements."),
    _r("AD304", "measure-unbounded", "info", HTML_ONLY,
       "Running text past roughly 65 characters per line loses the reader "
       "between lines.",
       "Constrain the prose container with max-width.", True),
    _r("AD305", "tabular-nums-missing", "info", HTML_ONLY,
       "Proportional digits make columns of numbers fail to line up.",
       "Add font-variant-numeric: tabular-nums.", True),

    # --- AD4xx: AI-cliché detector (advisory only) -------------------------
    _r("AD401", "ai-cliche-palette", "info", HTML_ONLY,
       "Warm cream grounds, lone acid-green pops on near-black, and purple-to-blue "
       "gradient heroes are the current AI-design default cluster.",
       "Keep it if the user asked for it; otherwise spend the freedom elsewhere.", True),
    _r("AD402", "ai-cliche-typeface", "info", HTML_ONLY,
       "Inter and Space Grotesk are the 'safe' AI-generated faces; using one as "
       "the only face reads as unconsidered.",
       "Pair a characterful display face with a complementary body face.", True),
    _r("AD403", "ai-cliche-emoji-headings", "info", HTML_ONLY,
       "Emoji as section markers is a recognised generated-design tell.",
       "Let type hierarchy carry the structure.", True),
    _r("AD404", "uniform-radius", "info", HTML_ONLY,
       "A single border-radius everywhere is the rounded-lg default.",
       "Vary radius by element role, or commit to sharp corners.", True),

    # --- AS5xx: inline SVG / diagram --------------------------------------
    _r("AS501", "svg-missing-viewbox", "warn", HTML_ONLY,
       "Without a viewBox the drawing cannot scale with CSS.",
       'Set viewBox="0 0 W H" and let CSS scale it.'),
    _r("AS502", "svg-fixed-size", "info", HTML_ONLY,
       "Pixel width/height with no responsive rule overflows narrow viewports.",
       "Add max-width: 100%; height: auto.", True),
    _r("AS503", "svg-script-or-style", "error", HTML_ONLY,
       "<script>, <style>, and <foreignObject> inside an SVG break the "
       "self-contained fragment contract.",
       "Move styling to the page stylesheet; drop the script."),
    _r("AS504", "svg-external-href", "error", HTML_ONLY,
       "An href pointing outside the fragment is blocked by the CSP.",
       "Reference ids in the same fragment, or inline the asset."),
    _r("AS505", "svg-missing-a11y", "warn", HTML_ONLY,
       "A diagram with no accessible name is invisible to readers who cannot "
       "see it.",
       'Add role="img" and an aria-label carrying the figure\'s claim.'),
    _r("AS506", "figure-missing-caption", "info", HTML_ONLY,
       "One figure, one claim — the caption is where the claim is stated.",
       "Wrap the svg in <figure> with a <figcaption>.", True),
    _r("AS507", "svg-text-too-small", "warn", HTML_ONLY,
       "Diagram text below roughly 11px at the drawn scale is unreadable.",
       "Raise the font-size, or enlarge the viewBox and the text with it.", True),
    _r("AS508", "svg-hardcoded-color", "info", HTML_ONLY,
       "currentColor inherits the page foreground in both themes; literal hues "
       "only work on one ground. One meaningful accent is the budget.",
       "Use currentColor for structure; reserve one literal for meaning.", True),
    _r("AS509", "possible-unlabeled-arrows", "info", HTML_ONLY,
       "An unlabeled arrow says 'related somehow'; a labeled one carries "
       "information.",
       "Label each edge with the verb it performs.", True),
    _r("AS510", "svg-raster-arrowhead", "warn", HTML_ONLY,
       "An <image> inside the SVG is an external or embedded raster where a "
       "native shape belongs.",
       "Use a <marker> or a small <polygon>."),
)

RULES_BY_ID = {r.id: r for r in RULES}


# ---------------------------------------------------------------------------
# Findings
# ---------------------------------------------------------------------------

@dataclass
class Finding:
    rule: str
    severity: str
    file: str
    line: int
    message: str
    evidence: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        meta = RULES_BY_ID.get(self.rule)
        if meta:
            d["title"] = meta.title
            d["fix"] = meta.fix
            d["heuristic"] = meta.heuristic
        return d


# ---------------------------------------------------------------------------
# HTML collection
# ---------------------------------------------------------------------------

@dataclass
class Element:
    tag: str
    attrs: dict[str, str]
    line: int
    parent: int | None
    children: list[int] = field(default_factory=list)
    text: str = ""


class Collector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.elements: list[Element] = []
        self.stack: list[int] = []
        self.unclosed: list[Element] = []
        self.stray_end: list[tuple[str, int]] = []
        self.style_blocks: list[tuple[str, int]] = []
        self.script_blocks: list[tuple[str, int]] = []
        self.has_doctype = False
        self._capture: str | None = None
        self._capture_line = 0
        self._capture_buf: list[str] = []

    # -- helpers
    def _line(self) -> int:
        return self.getpos()[0]

    def _push(self, tag: str, attrs) -> int:
        idx = len(self.elements)
        parent = self.stack[-1] if self.stack else None
        el = Element(tag, {k: (v if v is not None else "") for k, v in attrs}, self._line(), parent)
        self.elements.append(el)
        if parent is not None:
            self.elements[parent].children.append(idx)
        return idx

    # -- parser hooks
    def handle_decl(self, decl: str) -> None:
        if decl.lower().startswith("doctype"):
            self.has_doctype = True

    def handle_starttag(self, tag, attrs):
        idx = self._push(tag, attrs)
        if tag in ("style", "script"):
            self._capture = tag
            self._capture_line = self._line()
            self._capture_buf = []
        if tag not in VOID_ELEMENTS:
            self.stack.append(idx)

    def handle_startendtag(self, tag, attrs):
        self._push(tag, attrs)

    def handle_endtag(self, tag):
        if self._capture and tag == self._capture:
            body = "".join(self._capture_buf)
            if self._capture == "style":
                self.style_blocks.append((body, self._capture_line))
            else:
                self.script_blocks.append((body, self._capture_line))
            self._capture = None
            self._capture_buf = []
        if tag in VOID_ELEMENTS:
            return
        for depth in range(len(self.stack) - 1, -1, -1):
            if self.elements[self.stack[depth]].tag == tag:
                for orphan in self.stack[depth + 1:]:
                    el = self.elements[orphan]
                    if el.tag not in OPTIONAL_END_TAG:
                        self.unclosed.append(el)
                del self.stack[depth:]
                return
        self.stray_end.append((tag, self._line()))

    def handle_data(self, data):
        if self._capture:
            self._capture_buf.append(data)
            return
        if self.stack:
            self.elements[self.stack[-1]].text += data

    def close(self):  # type: ignore[override]
        super().close()
        for idx in self.stack:
            el = self.elements[idx]
            if el.tag not in OPTIONAL_END_TAG:
                self.unclosed.append(el)
        self.stack = []


def descendants(elements: Sequence[Element], root: int) -> Iterable[int]:
    stack = list(elements[root].children)
    while stack:
        i = stack.pop()
        yield i
        stack.extend(elements[i].children)


def ancestors(elements: Sequence[Element], idx: int) -> Iterable[int]:
    cur = elements[idx].parent
    while cur is not None:
        yield cur
        cur = elements[cur].parent


def full_text(elements: Sequence[Element], idx: int) -> str:
    out = [elements[idx].text]
    for d in descendants(elements, idx):
        out.append(elements[d].text)
    return " ".join(t for t in out if t).strip()


# ---------------------------------------------------------------------------
# CSS parsing
# ---------------------------------------------------------------------------

NESTING_AT_RULES = ("media", "supports", "container", "layer", "scope", "document", "keyframes")


@dataclass
class CssBlock:
    selector: str
    context: tuple[str, ...]
    body: str
    line: int

    @property
    def selectors(self) -> list[str]:
        return [s.strip() for s in self.selector.split(",") if s.strip()]

    @property
    def declarations(self) -> list[tuple[str, str]]:
        return parse_declarations(self.body)

    @property
    def conditional(self) -> bool:
        """True when this block only applies under a theme condition."""
        if any("prefers-color-scheme" in c for c in self.context):
            return True
        return any("[data-theme" in s for s in self.selectors)

    @property
    def dark_conditional(self) -> bool:
        return (
            any("prefers-color-scheme" in c and "dark" in c for c in self.context)
            or any('[data-theme="dark"]' in s or "[data-theme='dark']" in s for s in self.selectors)
        )


def parse_declarations(body: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    depth = 0
    buf: list[str] = []
    for ch in body:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if ch == ";" and depth == 0:
            out.extend(_split_decl("".join(buf)))
            buf = []
        else:
            buf.append(ch)
    out.extend(_split_decl("".join(buf)))
    return out


def _split_decl(raw: str) -> list[tuple[str, str]]:
    raw = raw.strip()
    if not raw:
        return []
    depth = 0
    for i, ch in enumerate(raw):
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        elif ch == ":" and depth == 0:
            return [(raw[:i].strip().lower(), raw[i + 1:].strip())]
    return []


def parse_css(css: str, line_offset: int = 0) -> list[CssBlock]:
    css = CSS_COMMENT_RE.sub(lambda m: "\n" * m.group(0).count("\n"), css)
    blocks: list[CssBlock] = []
    context: list[str] = []
    buf: list[str] = []
    i, n = 0, len(css)
    while i < n:
        ch = css[i]
        if ch == "{":
            prelude = "".join(buf).strip()
            buf = []
            line = line_offset + css.count("\n", 0, i)
            if prelude.startswith("@") and _at_rule_nests(prelude):
                context.append(prelude)
                i += 1
                continue
            depth, start, j = 1, i + 1, i + 1
            while j < n and depth:
                if css[j] == "{":
                    depth += 1
                elif css[j] == "}":
                    depth -= 1
                j += 1
            blocks.append(CssBlock(prelude, tuple(context), css[start:j - 1], line + 1))
            i = j
            continue
        if ch == "}":
            if context:
                context.pop()
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    return blocks


def _at_rule_nests(prelude: str) -> bool:
    name = prelude[1:].split(None, 1)[0].lower() if len(prelude) > 1 else ""
    return name in NESTING_AT_RULES


# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------

def hex_to_rgb(h: str) -> tuple[int, int, int] | None:
    h = h.lstrip("#")
    if len(h) in (3, 4):
        h = "".join(c * 2 for c in h[:3])
    if len(h) in (6, 8):
        try:
            return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        except ValueError:
            return None
    return None


def rgb_to_hue(rgb: tuple[int, int, int]) -> float:
    r, g, b = (v / 255 for v in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    d = mx - mn
    if d == 0:
        return 0.0
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return h * 60


def is_external(url: str) -> bool:
    u = url.strip().strip("'\"")
    if not u:
        return False
    low = u.lower()
    if low.startswith(INTERNAL_URL_PREFIXES):
        return False
    return bool(re.match(r"(?i)^(?:https?:)?//", low)) or bool(
        re.match(r"(?i)^[a-z][a-z0-9+.-]*://", low)
    )


# ---------------------------------------------------------------------------
# Document model
# ---------------------------------------------------------------------------

@dataclass
class Document:
    path: str
    source: str
    profile: str
    size: int
    elements: list[Element] = field(default_factory=list)
    unclosed: list[Element] = field(default_factory=list)
    stray_end: list[tuple[str, int]] = field(default_factory=list)
    style_blocks: list[tuple[str, int]] = field(default_factory=list)
    script_blocks: list[tuple[str, int]] = field(default_factory=list)
    css_blocks: list[CssBlock] = field(default_factory=list)
    has_doctype: bool = False
    parse_error: str | None = None

    @property
    def css_text(self) -> str:
        return "\n".join(b for b, _ in self.style_blocks)

    @property
    def js_text(self) -> str:
        return "\n".join(b for b, _ in self.script_blocks)

    def by_tag(self, *tags: str) -> list[int]:
        want = set(tags)
        return [i for i, e in enumerate(self.elements) if e.tag in want]


def detect_profile(path: Path, source: str) -> str:
    if path.suffix.lower() in (".md", ".markdown"):
        return "markdown"
    head = source[:4096].lower()
    if "<!doctype" in head or re.search(r"<html[\s>]", head):
        return "standalone"
    return "claude-artifact"


def build_document(path: Path, source: str, profile: str) -> Document:
    doc = Document(str(path), source, profile, len(source.encode("utf-8")))
    if profile == "markdown":
        return doc
    parser = Collector()
    try:
        parser.feed(source)
        parser.close()
    except Exception as exc:  # pragma: no cover - defensive
        doc.parse_error = f"{type(exc).__name__}: {exc}"
    doc.elements = parser.elements
    doc.unclosed = parser.unclosed
    doc.stray_end = parser.stray_end
    doc.style_blocks = parser.style_blocks
    doc.script_blocks = parser.script_blocks
    doc.has_doctype = parser.has_doctype
    for css, line in doc.style_blocks:
        doc.css_blocks.extend(parse_css(css, line))
    return doc


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

def _f(doc: Document, rid: str, line: int, message: str, evidence: str = "") -> Finding:
    return Finding(rid, RULES_BY_ID[rid].severity, doc.path, line, message, evidence[:200])


def line_of(source: str, index: int) -> int:
    return source.count("\n", 0, index) + 1


def check_portability(doc: Document) -> list[Finding]:
    out: list[Finding] = []
    if doc.size > MAX_BYTES:
        out.append(_f(doc, "AX005", 1,
                      f"file is {doc.size / 1024 / 1024:.1f}MB, over the 16MB ceiling"))

    if doc.profile == "markdown":
        for m in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", doc.source):
            if is_external(m.group(1)):
                out.append(_f(doc, "AX001", line_of(doc.source, m.start()),
                              "markdown image points at an external host", m.group(1)))
        if MERMAID_FENCE_RE.search(doc.source):
            pass  # mermaid is native in the markdown artifact lane
        return out

    url_attrs = ("src", "href", "poster", "data", "srcset", "xlink:href")
    for el in doc.elements:
        for attr in url_attrs:
            val = el.attrs.get(attr)
            if not val:
                continue
            first = val.split(",")[0].split()[0] if attr == "srcset" else val
            if not is_external(first):
                continue
            if el.tag == "a":
                continue  # an outbound link is legitimate; only fetched subresources break
            if el.tag == "script":
                out.append(_f(doc, "AX002", el.line, "external script source", first))
            elif el.tag == "link" and "stylesheet" in el.attrs.get("rel", "").lower():
                rule = "AX003" if re.search(r"(?i)font", first) else "AX001"
                out.append(_f(doc, rule, el.line, "external stylesheet", first))
            else:
                out.append(_f(doc, "AX001", el.line,
                              f"<{el.tag} {attr}> points at an external host", first))
        if el.tag == "a" and "download" in el.attrs:
            out.append(_f(doc, "AX006", el.line,
                          "download link is inert inside the artifact sandbox",
                          el.attrs.get("href", "")[:80]))

    for css, base in doc.style_blocks:
        for m in CSS_URL_RE.finditer(css):
            if is_external(m.group(2)):
                rid = "AX003" if _in_font_face(css, m.start()) else "AX001"
                out.append(_f(doc, rid, base + css.count("\n", 0, m.start()),
                              "CSS url() points at an external host", m.group(2)))
        for m in AT_IMPORT_RE.finditer(css):
            if is_external(m.group(1)):
                out.append(_f(doc, "AX001", base + css.count("\n", 0, m.start()),
                              "@import fetches an external stylesheet", m.group(1)))

    js = doc.js_text
    if CLAUDE_RUNTIME_RE.search(js) and not CLAUDE_GUARD_RE.search(js):
        sev_line, m = 1, None
        for body, base in doc.script_blocks:
            hit = CLAUDE_RUNTIME_RE.search(body)
            if hit and not CLAUDE_GUARD_RE.search(body):
                sev_line = base + body.count("\n", 0, hit.start())
                m = hit
                break
        finding = _f(doc, "AX007", sev_line,
                     "window.claude.* called with no feature guard",
                     m.group(0) if m else "")
        if doc.profile == "standalone":
            finding.severity = "error"
            finding.message += " (the runtime does not exist outside the Claude viewer)"
        out.append(finding)

    has_wrapper = doc.has_doctype or bool(doc.by_tag("html", "head", "body"))
    if doc.profile == "claude-artifact" and has_wrapper:
        out.append(_f(doc, "AX004", 1,
                      "fragment carries a document skeleton; the Artifact harness "
                      "supplies <!doctype>/<html>/<head>/<body>"))
    if doc.profile == "standalone":
        missing = []
        if not doc.has_doctype:
            missing.append("<!doctype html>")
        html_els = doc.by_tag("html")
        if not html_els:
            missing.append("<html>")
        elif not doc.elements[html_els[0]].attrs.get("lang"):
            missing.append("lang attribute on <html>")
        metas = [doc.elements[i].attrs for i in doc.by_tag("meta")]
        if not any("charset" in a for a in metas):
            missing.append("<meta charset>")
        if not any(a.get("name", "").lower() == "viewport" for a in metas):
            missing.append("<meta name=viewport>")
        if missing:
            out.append(_f(doc, "AX004", 1,
                          "standalone document is missing: " + ", ".join(missing)))
        for el in doc.elements:
            if el.tag == "pre" and "mermaid" in el.attrs.get("class", ""):
                out.append(_f(doc, "AX009", el.line,
                              "mermaid block has no renderer in a standalone file"))

    if doc.unclosed:
        for el in doc.unclosed[:10]:
            out.append(_f(doc, "AX008", el.line, f"<{el.tag}> is never closed"))
    for tag, line in doc.stray_end[:10]:
        out.append(_f(doc, "AX008", line, f"</{tag}> has no matching start tag"))
    return out


def _in_font_face(css: str, pos: int) -> bool:
    head = css[:pos]
    idx = head.rfind("@font-face")
    return idx != -1 and head.count("}", idx) == 0


def check_theme(doc: Document) -> list[Finding]:
    if doc.profile == "markdown" or not doc.css_blocks:
        return []
    out: list[Finding] = []
    blocks = doc.css_blocks

    root_blocks = [b for b in blocks if any(s.strip().startswith(":root") or s.strip() == "html"
                                            for s in b.selectors)]
    base_tokens: set[str] = set()
    cond_tokens: dict[str, int] = {}
    for b in blocks:
        for prop, _ in b.declarations:
            if not CUSTOM_PROP_RE.match(prop):
                continue
            if b.conditional:
                cond_tokens.setdefault(prop, b.line)
            else:
                base_tokens.add(prop)

    if not any(not b.conditional and b.declarations and
               any(CUSTOM_PROP_RE.match(p) for p, _ in b.declarations)
               for b in root_blocks):
        if root_blocks or cond_tokens:
            out.append(_f(doc, "AD101", root_blocks[0].line if root_blocks else 1,
                          "no custom properties defined on a bare :root"))

    for token, line in sorted(cond_tokens.items()):
        if token not in base_tokens:
            out.append(_f(doc, "AD102", line,
                          f"{token} is defined only inside a theme block, so it is "
                          f"undefined in the un-stamped 'system' state", token))

    dark_media = [b for b in blocks
                  if any("prefers-color-scheme" in c and "dark" in c for c in b.context)]
    if dark_media:
        guarded = any('not([data-theme="light"])' in s.replace(" ", "") or
                      "not([data-theme='light'])" in s.replace(" ", "")
                      for b in dark_media for s in b.selectors)
        if not guarded:
            out.append(_f(doc, "AD103", dark_media[0].line,
                          "dark media block is not guarded with "
                          ':root:not([data-theme="light"])'))
    has_dark_stamp = any('[data-theme="dark"]' in s or "[data-theme='dark']" in s
                         for b in blocks for s in b.selectors)
    if dark_media and not has_dark_stamp:
        out.append(_f(doc, "AD104", dark_media[0].line,
                      'no :root[data-theme="dark"] block, so the explicit dark '
                      "toggle cannot win over a light OS"))

    body_bg: str | None = None
    body_line = 1
    for b in blocks:
        if not any(re.search(r"(^|[\s,>])(body|html)$", s) or s in ("body", "html", "html, body")
                   for s in b.selectors):
            continue
        for prop, val in b.declarations:
            if prop in ("background", "background-color"):
                body_bg = val
                body_line = b.line
    if body_bg is None:
        out.append(_f(doc, "AD105", 1,
                      "body has no explicit background, so the page borrows the "
                      "host's ground and can invert against its own text"))
    elif body_bg.strip().lower() in ("transparent", "none", "initial", "unset"):
        out.append(_f(doc, "AD105", body_line,
                      f"body background is '{body_bg.strip()}' — effectively unset", body_bg))

    for b in blocks:
        if not b.conditional:
            continue
        for s in b.selectors:
            if s.strip().startswith(":root") or s.strip() in ("html", "body", "*"):
                continue
            for prop, val in b.declarations:
                if prop in COLOR_PROPS and (HEX_RE.search(val) or FUNC_COLOR_RE.search(val)):
                    out.append(_f(doc, "AD107", b.line,
                                  f"'{s}' sets {prop} inside a theme block; style "
                                  "components through tokens instead", f"{s} {{ {prop}: {val} }}"))
                    break
            break

    literal_hits = 0
    first_literal = 1
    for b in blocks:
        is_token_home = any(s.strip().startswith(":root") for s in b.selectors)
        for prop, val in b.declarations:
            if is_token_home or CUSTOM_PROP_RE.match(prop):
                continue
            if prop in COLOR_PROPS and HEX_RE.search(val):
                literal_hits += 1
                if literal_hits == 1:
                    first_literal = b.line
    if literal_hits >= 3:
        out.append(_f(doc, "AD106", first_literal,
                      f"{literal_hits} literal colors in component rules escape the "
                      "token system"))
    return out


def check_identity(doc: Document) -> list[Finding]:
    if doc.profile == "markdown":
        return []
    out: list[Finding] = []
    titles = doc.by_tag("title")
    if not titles:
        out.append(_f(doc, "AD201", 1, "no <title> element"))
        return out
    idx = titles[0]
    text = full_text(doc.elements, idx).strip()
    line = doc.elements[idx].line
    if not text:
        out.append(_f(doc, "AD201", line, "<title> is empty"))
        return out
    if doc.source.encode("utf-8").find(b"<title") > 8192:
        out.append(_f(doc, "AD201", line,
                      "<title> sits past the first 8KB, where the scanner stops looking"))
    m = re.search(r"\s[-–—]\s|:\s", text)
    if m:
        out.append(_f(doc, "AD202", line,
                      "title pairs a name with an appended explainer; keep the name",
                      text))
    words = text.split()
    if len(words) > 8:
        out.append(_f(doc, "AD203", line, f"title is {len(words)} words; a name is 2–4", text))
    if text.strip().lower() in GENERIC_TITLES:
        out.append(_f(doc, "AD204", line,
                      f"'{text}' is a category label, not a name that identifies this "
                      "page in a gallery", text))
    return out


def check_layout(doc: Document) -> list[Finding]:
    if doc.profile == "markdown":
        return []
    out: list[Finding] = []
    css = doc.css_text
    css_l = css.lower()

    overflow_classes: set[str] = set()
    overflow_tags: set[str] = set()
    for b in doc.css_blocks:
        decls = {p: v for p, v in b.declarations}
        ov = decls.get("overflow-x") or decls.get("overflow", "")
        if not re.search(r"\b(auto|scroll|hidden)\b", ov):
            continue
        for s in b.selectors:
            for cls in re.findall(r"\.([\w-]+)", s):
                overflow_classes.add(cls)
            bare = re.match(r"^([a-zA-Z][\w-]*)$", s.strip())
            if bare:
                overflow_tags.add(bare.group(1).lower())

    for i in doc.by_tag("table", "pre"):
        el = doc.elements[i]
        if el.tag in overflow_tags:
            continue
        if re.search(r"overflow", el.attrs.get("style", ""), re.IGNORECASE):
            continue
        covered = False
        for a in ancestors(doc.elements, i):
            anc = doc.elements[a]
            if set(anc.attrs.get("class", "").split()) & overflow_classes:
                covered = True
                break
            if re.search(r"overflow", anc.attrs.get("style", ""), re.IGNORECASE):
                covered = True
                break
        if not covered:
            out.append(_f(doc, "AD301", el.line,
                          f"<{el.tag}> has no overflow-x container, so wide content "
                          "scrolls the page body sideways"))

    animated = bool(re.search(r"@keyframes|animation\s*:|transition\s*:", css_l))
    if animated and "prefers-reduced-motion" not in css_l:
        out.append(_f(doc, "AD302", 1, "motion is used with no prefers-reduced-motion escape"))

    interactive = [i for i in range(len(doc.elements))
                   if doc.elements[i].tag in INTERACTIVE_TAGS
                   or (doc.elements[i].tag == "a" and doc.elements[i].attrs.get("href"))
                   or doc.elements[i].tag == "input"
                   or "tabindex" in doc.elements[i].attrs]
    if interactive and ":focus" not in css_l:
        out.append(_f(doc, "AD303", doc.elements[interactive[0]].line,
                      f"{len(interactive)} interactive elements and no :focus-visible style"))

    paragraphs = doc.by_tag("p")
    if len(paragraphs) >= 5 and not _has_text_measure(doc):
        out.append(_f(doc, "AD304", doc.elements[paragraphs[0]].line,
                      f"{len(paragraphs)} paragraphs with no measure on any text "
                      "container; running text runs the full viewport width"))

    if doc.by_tag("table") and "font-variant-numeric" not in css_l:
        numeric_cells = 0
        for t in doc.by_tag("table"):
            for d in descendants(doc.elements, t):
                if doc.elements[d].tag in ("td", "th"):
                    if re.fullmatch(r"[\s$€£%+\-0-9.,()]+", doc.elements[d].text.strip() or "x"):
                        numeric_cells += 1
        if numeric_cells >= 3:
            out.append(_f(doc, "AD305", doc.elements[doc.by_tag("table")[0]].line,
                          f"{numeric_cells} numeric cells with no tabular-nums"))
    return out


MEDIA_SELECTOR_RE = re.compile(r"(?i)\b(svg|img|picture|video|canvas|iframe|figure)\b")


def _has_text_measure(doc: Document) -> bool:
    """True when some non-media container constrains line length.

    `svg { max-width: 100% }` is a responsive-media rule, not a measure — counting
    it would silence the rule on almost every page that draws anything.
    """
    for b in doc.css_blocks:
        if all(MEDIA_SELECTOR_RE.search(s) for s in b.selectors):
            continue
        for prop, val in b.declarations:
            if prop not in ("max-width", "max-inline-size", "width"):
                continue
            v = val.strip().lower()
            if v in ("100%", "auto", "none", "100vw"):
                continue
            if re.search(r"\d\s*(ch|rem|em|px|vw|%)|min\(|clamp\(", v):
                return True
    return False


def check_cliches(doc: Document) -> list[Finding]:
    if doc.profile == "markdown" or not doc.css_blocks:
        return []
    out: list[Finding] = []
    css = doc.css_text
    css_l = css.lower()

    backgrounds: list[tuple[int, int, int]] = []
    accents: list[tuple[int, int, int]] = []
    for b in doc.css_blocks:
        for prop, val in b.declarations:
            for hx in HEX_RE.findall(val):
                rgb = hex_to_rgb(hx)
                if not rgb:
                    continue
                if prop in ("background", "background-color") or "bg" in prop:
                    backgrounds.append(rgb)
                else:
                    accents.append(rgb)
                if CUSTOM_PROP_RE.match(prop) and re.search(r"bg|surface|ground|paper", prop):
                    backgrounds.append(rgb)

    cream = [c for c in backgrounds if c[0] >= 240 and c[1] >= 236 and c[2] >= 225
             and c[0] - c[2] >= 8]
    if cream:
        out.append(_f(doc, "AD401", 1,
                      "warm cream ground (#%02X%02X%02X) is the current AI-design default"
                      % cream[0]))
    near_black = any(max(c) <= 34 for c in backgrounds)
    acid = [c for c in accents
            if c[1] >= 200 and c[1] - c[0] >= 60 and c[1] - c[2] >= 60]
    if near_black and acid:
        out.append(_f(doc, "AD401", 1,
                      "lone acid-green pop on near-black is the current AI-design default"))
    for m in re.finditer(r"linear-gradient\(([^)]*)\)", css_l):
        hues = [rgb_to_hue(rgb) for hx in HEX_RE.findall(m.group(1))
                if (rgb := hex_to_rgb(hx))]
        if any(250 <= h <= 300 for h in hues) and any(200 <= h <= 250 for h in hues):
            out.append(_f(doc, "AD401", 1, "purple-to-blue gradient is the current "
                                           "AI-design default", m.group(0)[:80]))
            break

    families: set[str] = set()
    for b in doc.css_blocks:
        for prop, val in b.declarations:
            if "font-family" in prop or (CUSTOM_PROP_RE.match(prop) and "font" in prop):
                for part in val.split(","):
                    name = part.strip().strip("'\"").lower()
                    if name and not name.startswith("var(") and name not in (
                        "sans-serif", "serif", "monospace", "system-ui", "ui-sans-serif",
                        "ui-serif", "ui-monospace", "-apple-system", "blinkmacsystemfont",
                        "segoe ui", "roboto", "helvetica", "arial", "helvetica neue",
                        "cursive", "fantasy", "emoji", "math", "inherit", "initial",
                    ):
                        families.add(name)
    if families and families <= {"inter", "space grotesk"}:
        out.append(_f(doc, "AD402", 1,
                      f"{'/'.join(sorted(families))} is the only declared face"))

    for i in doc.by_tag("h1", "h2", "h3"):
        text = full_text(doc.elements, i).strip()
        if text and EMOJI_RE.match(text[0]):
            out.append(_f(doc, "AD403", doc.elements[i].line,
                          "heading opens with an emoji marker", text[:60]))
            break

    radii = [v.strip() for b in doc.css_blocks for p, v in b.declarations
             if p == "border-radius" and "var(" not in v]
    if len(radii) >= 4 and len(set(radii)) == 1:
        out.append(_f(doc, "AD404", 1,
                      f"border-radius is {radii[0]} on all {len(radii)} rules that set it"))
    return out


def _svg_is_responsive(doc: Document, svg: Element) -> bool:
    """True when a max-width rule actually reaches THIS svg.

    Checking `"max-width" in css_text` would let an unrelated `.prose { max-width }`
    silence the rule on every drawing in the document.
    """
    if "max-width" in svg.attrs.get("style", "").lower():
        return True
    classes = set(svg.attrs.get("class", "").split())
    el_id = svg.attrs.get("id", "")
    for b in doc.css_blocks:
        if not any(p in ("max-width", "max-inline-size") for p, _ in b.declarations):
            continue
        for s in b.selectors:
            if re.search(r"(^|[\s,>+~])svg([\s.:\[#]|$)", s):
                return True
            if el_id and f"#{el_id}" in s:
                return True
            if classes & set(re.findall(r"\.([\w-]+)", s)):
                return True
    return False


def check_svg(doc: Document) -> list[Finding]:
    if doc.profile == "markdown":
        return []
    out: list[Finding] = []
    for si in doc.by_tag("svg"):
        svg = doc.elements[si]
        kids = list(descendants(doc.elements, si))
        texts = [k for k in kids if doc.elements[k].tag == "text"]
        shapes = [k for k in kids if doc.elements[k].tag in SVG_SHAPES]
        diagram = bool(texts)

        for k in kids:
            tag = doc.elements[k].tag
            if tag in ("script", "style", "foreignobject"):
                out.append(_f(doc, "AS503", doc.elements[k].line,
                              f"<{tag}> inside an <svg> breaks the self-contained fragment"))
            if tag == "image":
                out.append(_f(doc, "AS510", doc.elements[k].line,
                              "<image> inside an <svg> where a native shape belongs"))
            for attr in ("href", "xlink:href", "src"):
                val = doc.elements[k].attrs.get(attr, "")
                if val and is_external(val):
                    out.append(_f(doc, "AS504", doc.elements[k].line,
                                  f"<{tag} {attr}> reaches outside the fragment", val))

        if not diagram:
            continue

        vb = svg.attrs.get("viewbox")
        if not vb:
            out.append(_f(doc, "AS501", svg.line, "diagram <svg> has no viewBox, so it "
                                                  "cannot scale with CSS"))
        w, h = svg.attrs.get("width", ""), svg.attrs.get("height", "")
        if (w or h) and not vb and not _svg_is_responsive(doc, svg):
            out.append(_f(doc, "AS502", svg.line,
                          f"fixed size ({w or '?'}×{h or '?'}) with no responsive rule"))

        if svg.attrs.get("role", "").lower() != "img" or not svg.attrs.get("aria-label"):
            out.append(_f(doc, "AS505", svg.line,
                          'diagram has no role="img" + aria-label carrying its claim'))

        in_figure = False
        for a in ancestors(doc.elements, si):
            if doc.elements[a].tag == "figure":
                in_figure = any(doc.elements[c].tag == "figcaption"
                                for c in descendants(doc.elements, a))
                break
        if not in_figure:
            out.append(_f(doc, "AS506", svg.line,
                          "diagram is not wrapped in <figure> with a <figcaption>"))

        vb_w = 0.0
        if vb:
            parts = re.split(r"[\s,]+", vb.strip())
            if len(parts) == 4:
                try:
                    vb_w = float(parts[2])
                except ValueError:
                    vb_w = 0.0
        if vb_w == 0.0 or vb_w <= 1200:
            for t in texts:
                fs = doc.elements[t].attrs.get("font-size", "")
                if not fs:
                    m = re.search(r"font-size\s*:\s*([\d.]+)", doc.elements[t].attrs.get("style", ""))
                    fs = m.group(1) if m else ""
                num = re.match(r"([\d.]+)", fs.strip())
                if num and float(num.group(1)) < 11:
                    out.append(_f(doc, "AS507", doc.elements[t].line,
                                  f"diagram text at {num.group(1)}px is below the ~11px floor"))
                    break

        literals: set[str] = set()
        for k in kids + [si]:
            for attr in ("fill", "stroke", "color", "stop-color"):
                val = doc.elements[k].attrs.get(attr, "").strip().lower()
                if val and val not in ("none", "transparent", "currentcolor", "inherit") \
                        and not val.startswith("url("):
                    literals.add(val)
        if len(literals) > 1:
            out.append(_f(doc, "AS508", svg.line,
                          f"{len(literals)} literal colors; currentColor plus one "
                          "meaningful accent is the budget",
                          ", ".join(sorted(literals)[:5])))

        unlabeled = _unlabeled_edges(doc, kids, texts)
        if unlabeled:
            out.append(_f(doc, "AS509", unlabeled[0],
                          f"{len(unlabeled)} straight edge(s) carry an arrowhead with no "
                          "label near the midpoint"))
    return out


def _num(raw: str) -> float | None:
    m = re.match(r"\s*(-?[\d.]+)", raw or "")
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _unlabeled_edges(doc: Document, kids: list[int], texts: list[int]) -> list[int]:
    """Return the source lines of <line> edges whose midpoint has no nearby <text>.

    Only straight <line> edges are judged, because their midpoint is computable
    from attributes alone. Edges drawn as <path> are skipped rather than guessed
    at — a heuristic that fires on drawings it cannot measure is worse than one
    that stays quiet.
    """
    labels: list[tuple[float, float]] = []
    for t in texts:
        tx, ty = _num(doc.elements[t].attrs.get("x", "")), _num(doc.elements[t].attrs.get("y", ""))
        if tx is not None and ty is not None:
            labels.append((tx, ty))

    unlabeled: list[int] = []
    for k in kids:
        el = doc.elements[k]
        if el.tag != "line" or "marker-end" not in el.attrs:
            continue
        coords = [_num(el.attrs.get(a, "")) for a in ("x1", "y1", "x2", "y2")]
        if any(c is None for c in coords):
            continue
        x1, y1, x2, y2 = coords  # type: ignore[misc]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        radius = max(28.0, length * 0.4)
        if not any(((lx - mx) ** 2 + (ly - my) ** 2) ** 0.5 <= radius for lx, ly in labels):
            unlabeled.append(el.line)
    return unlabeled


CHECKS = (check_portability, check_theme, check_identity, check_layout,
          check_cliches, check_svg)


def lint(path: Path, profile: str = "auto", disabled: Sequence[str] = ()) -> list[Finding]:
    source = path.read_text(encoding="utf-8", errors="replace")
    resolved = detect_profile(path, source) if profile == "auto" else profile
    doc = build_document(path, source, resolved)
    findings: list[Finding] = []
    if doc.parse_error:
        findings.append(Finding("AX008", "error", doc.path, 1,
                                f"could not parse the document: {doc.parse_error}"))
    for check in CHECKS:
        findings.extend(check(doc))
    off = set(disabled)
    findings = [f for f in findings
                if f.rule not in off and resolved in RULES_BY_ID[f.rule].profiles]
    findings.sort(key=lambda f: (-SEVERITY_RANK[f.severity], f.line, f.rule))
    return findings


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

COLOR = {"error": "\033[31m", "warn": "\033[33m", "info": "\033[36m", "off": "\033[0m"}


def _tint(text: str, severity: str, enabled: bool) -> str:
    if not enabled:
        return text
    return f"{COLOR[severity]}{text}{COLOR['off']}"


def cmd_check(args: argparse.Namespace) -> int:
    paths: list[Path] = []
    for raw in args.paths:
        p = Path(raw)
        if p.is_dir():
            for pattern in ("*.html", "*.htm", "*.md"):
                paths.extend(sorted(p.rglob(pattern)))
        else:
            paths.append(p)
    missing = [p for p in paths if not p.is_file()]
    if missing:
        print(f"artifact_lint: no such file: {missing[0]}", file=sys.stderr)
        return 2
    if not paths:
        print("artifact_lint: nothing to check", file=sys.stderr)
        return 2

    disabled = [r.strip() for r in (args.disable or "").split(",") if r.strip()]
    unknown = [r for r in disabled if r not in RULES_BY_ID]
    if unknown:
        print(f"artifact_lint: unknown rule id: {', '.join(unknown)}", file=sys.stderr)
        return 2

    results: list[dict] = []
    all_findings: list[Finding] = []
    for p in paths:
        source = p.read_text(encoding="utf-8", errors="replace")
        resolved = detect_profile(p, source) if args.profile == "auto" else args.profile
        findings = lint(p, args.profile, disabled)
        findings = [f for f in findings if SEVERITY_RANK[f.severity] >= SEVERITY_RANK[args.min_severity]]
        all_findings.extend(findings)
        results.append({
            "file": str(p),
            "profile": resolved,
            "bytes": len(source.encode("utf-8")),
            "findings": [f.to_dict() for f in findings],
        })

    counts = {s: sum(1 for f in all_findings if f.severity == s) for s in SEVERITIES}
    threshold = SEVERITY_RANK.get(args.fail_on, 99) if args.fail_on != "never" else 99
    failed = any(SEVERITY_RANK[f.severity] >= threshold for f in all_findings)

    if args.json:
        print(json.dumps({
            "tool": "artifact_lint",
            "version": __version__,
            "counts": counts,
            "fail_on": args.fail_on,
            "ok": not failed,
            "results": results,
        }, indent=2))
        return 1 if failed else 0

    tty = sys.stdout.isatty() and not os.environ.get("NO_COLOR")
    for result in results:
        header = f"{result['file']}  [{result['profile']}]"
        print(header)
        if not result["findings"]:
            print("  no findings")
        for d in result["findings"]:
            tag = _tint(f"{d['severity']:<5}", d["severity"], tty)
            note = " (heuristic)" if d.get("heuristic") else ""
            print(f"  {tag} {d['rule']}  line {d['line']}  {d['message']}{note}")
            if d.get("evidence"):
                print(f"        ↳ {d['evidence']}")
            if d["severity"] == "error":
                print(f"        fix: {d['fix']}")
        print()
    print(f"{counts['error']} error, {counts['warn']} warn, {counts['info']} info "
          f"across {len(results)} file(s)")
    return 1 if failed else 0


def cmd_rules(args: argparse.Namespace) -> int:
    rules = [r for r in RULES if not args.profile or args.profile in r.profiles]
    if args.json:
        print(json.dumps({
            "tool": "artifact_lint",
            "version": __version__,
            "severity_policy": (
                "Only mechanically unambiguous rules are 'error'. Heuristic rules ship "
                "'warn'/'info' and never hard-block by default. Precision is UNMEASURED at v1."
            ),
            "profiles": list(PROFILES),
            "rules": [
                {**asdict(r), "profiles": list(r.profiles)} for r in rules
            ],
        }, indent=2))
        return 0
    for r in rules:
        flag = " ~heuristic" if r.heuristic else ""
        print(f"{r.id}  {r.severity:<5} {r.title}{flag}")
        print(f"       why: {r.rationale}")
        print(f"       fix: {r.fix}")
        print(f"       profiles: {', '.join(r.profiles)}")
        print()
    print(f"{len(rules)} rules")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="artifact_lint",
        description="Deterministic checks for single-file, self-contained HTML artifacts.",
    )
    p.add_argument("--version", action="version", version=f"artifact_lint {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    c = sub.add_parser("check", help="check one or more artifact files")
    c.add_argument("paths", nargs="+", help="files or directories")
    c.add_argument("--profile", choices=("auto",) + PROFILES, default="auto")
    c.add_argument("--json", action="store_true", help="machine-readable output")
    c.add_argument("--min-severity", choices=SEVERITIES, default="info",
                   help="hide findings below this severity")
    c.add_argument("--fail-on", choices=SEVERITIES + ("never",), default="error",
                   help="exit 1 when a finding at or above this severity exists")
    c.add_argument("--disable", default="", help="comma-separated rule ids to skip")
    c.set_defaults(func=cmd_check)

    r = sub.add_parser("rules", help="print the rule contract")
    r.add_argument("--json", action="store_true")
    r.add_argument("--profile", choices=PROFILES, default=None)
    r.set_defaults(func=cmd_rules)
    return p


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
