#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""dashboard_lint — deterministic checks for a rendered dashboard file.

Stdlib only. No network. No browser. Runs identically from Claude Code, Codex,
Cursor, a local model, a git hook, or CI.

    python3 dashboard_lint.py check dashboard.html
    python3 dashboard_lint.py check dashboard.html --json --fail-on error
    python3 dashboard_lint.py rules --json
    python3 dashboard_lint.py corpus mockups --glob '**/*.html'

Why this exists
---------------
`skills/dashboard-design/SKILL.md` §6 documents this command and
`dashboard_build.py build … --check`. Until now neither existed, so `--check` was
not a weak gate — it was a missing one, and a skill that says "graded by
`scripts/dashboard_lint.py`" while shipping no grader teaches a rule it never
enforces. This encodes the decidable subset of the `DB…` rules under the same IDs
the prose cites, so prose and code cannot drift.

What it will and will not grade
-------------------------------
Only what a rendered file can actually *prove* from a static parse. Eight rules
ship. The judgement rules stay out on purpose rather than being guessed at:
DB101 (one archetype), DB102 (priorities above the fold), DB103/DB104
(disclosure, round-trip nav), DB2xx (MECE record separation), DB504 (content
ratio), DB506 (real controls) all need a reader or a browser, and a linter that
pretends to grade them is worse than one that admits it cannot.

DB507 is one-directional and says so: it fires on a *provable* overflow source
(an explicit width wider than the 320px floor). It cannot prove the absence of
overflow, because flex and grid decide that at layout time. A clean DB507 means
"no fixed width forces a scrollbar", never "this page fits".

Severity policy
---------------
Same contract as `artifact_lint.py`, and for the same reason: a gate that cries
wolf gets switched off, and is then worse than no gate. Only mechanically
unambiguous rules carry `error`. Every rule that reasons from a vocabulary or an
inferred intent is flagged `heuristic: true` and ships `warn`, so it can never
hard-block a build. No rule is promoted to `error` without a firing-rate
measurement over real dashboards — the tool is the `corpus` subcommand and the
standing record is `docs/research/2026-08-18-dashboard-lint-calibration.md`.
`scripts/test_dashboard_lint.py` enforces both invariants.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artifact_lint as AL  # noqa: E402  — one HTML/CSS/colour parser, not two

__version__ = "1.0.0"

MAX_BYTES = AL.MAX_BYTES

SEVERITIES = AL.SEVERITIES
SEVERITY_RANK = AL.SEVERITY_RANK

# WCAG 2.5.8 target size (minimum) is 24x24 CSS px; 2.5.5 (enhanced) is 44x44.
# DB503 reads the enhanced floor as the mobile floor, matching the skill.
POINTER_FLOOR_PX = 24
TOUCH_FLOOR_PX = 44

# DB507. A dashboard has to survive the narrowest phone in common use.
NARROW_VIEWPORT_PX = 320


# ---------------------------------------------------------------------------
# Rule registry — the machine-readable contract other agents consume.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    severity: str
    rationale: str
    fix: str
    heuristic: bool = False


def _r(rid, title, severity, rationale, fix, heuristic=False):
    return Rule(rid, title, severity, rationale, fix, heuristic)


RULES: tuple[Rule, ...] = (
    _r("DB402", "no-freshness-label", "warn",
       "A snapshot that carries no date looks live. The reader cannot tell whether "
       "they are acting on today's state or last quarter's.",
       "Add a visible as-of line or <time datetime=…> near the title: "
       "'Snapshot 2026-08-18' or 'Updated 14:02 UTC'.",
       heuristic=True),
    _r("DB403", "external-request", "error",
       "A remote script, font, stylesheet, image, or beacon makes the page depend on "
       "someone else's network and uptime, and leaks the reader to a third party. An "
       "agent handing a dashboard to someone else cannot assume their network.",
       "Inline the asset. Embed images as data: URIs and fonts as base64 in a "
       "@font-face src. Delete analytics."),
    _r("DB401a", "server-dependent-data", "warn",
       "A bare fetch() of a local file fails from file:// with 'TypeError: Failed to "
       "fetch'. The page opens, the data does not, and the reader sees an error "
       "instead of their work — the single most common way a local dashboard rots.",
       "Emit data.js beside data.json and fall back to a <script src='./data.js'> tag "
       "that sets window.DASHBOARD_DATA when the fetch rejects.",
       heuristic=True),
    _r("DB401b", "absolute-data-path", "error",
       "A root-absolute data path binds the page to one host and one running service. "
       "From file:// it resolves against the filesystem root and always misses.",
       "Reference data relatively — './data.js', not '/api/items'."),
    _r("DB501", "state-carried-by-colour-alone", "warn",
       "A bare coloured dot or bar states nothing to a reader who cannot separate the "
       "hues, and nothing at all to a screen reader.",
       "Give the marker text, or an aria-label, or put the state word beside it.",
       heuristic=True),
    _r("DB502", "contrast-below-aa", "warn",
       "Measured, not eyeballed: this pair resolves under the 4.5:1 WCAG AA floor for "
       "body text in at least one theme state.",
       "Darken the foreground or lighten the ground until the measured ratio clears "
       "4.5:1. Re-run to confirm rather than judging by eye."),
    _r("DB503", "target-below-floor", "error",
       f"A control under {POINTER_FLOOR_PX}px on a pointer device (or "
       f"{TOUCH_FLOOR_PX}px on touch) is a miss waiting to happen, and the miss lands "
       "on whatever is behind it.",
       f"Raise min-height/min-width to {POINTER_FLOOR_PX}px, and to "
       f"{TOUCH_FLOOR_PX}px inside coarse-pointer and narrow-viewport media queries."),
    _r("DB507", "fixed-width-overflow", "error",
       f"An explicit width wider than {NARROW_VIEWPORT_PX}px forces a horizontal "
       "scrollbar on the narrowest phone in common use, and a dashboard read sideways "
       "is not read.",
       "Use max-width instead of width, or move the fixed value behind a "
       "min-width media query."),
)

RULES_BY_ID = {r.id: r for r in RULES}


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


def _f(doc: AL.Document, rid: str, line: int, message: str, evidence: str = "") -> Finding:
    return Finding(rid, RULES_BY_ID[rid].severity, doc.path, line, message, evidence[:200])


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

HIDDEN_CLASS_RE = re.compile(r"(?i)\b(sr-only|visually-hidden|screen-reader|a11y-hidden)\b")

# Attributes whose value the browser fetches. `a[href]` is deliberately absent: a
# hyperlink is a destination the reader chooses, not a request the page makes.
FETCHING_ATTRS = ("src", "srcset", "poster", "data", "xlink:href")

# <link rel> values that fetch. `canonical`, `alternate`, and `author` do not.
FETCHING_LINK_RELS = {
    "stylesheet", "icon", "shortcut icon", "apple-touch-icon", "manifest",
    "preload", "prefetch", "prerender", "preconnect", "dns-prefetch",
    "modulepreload", "mask-icon",
}

STR_ARG = r"""(['"])([^'"`\n]+)\1"""
FETCH_CALL_RE = re.compile(r"(?i)\bfetch\s*\(\s*" + STR_ARG)
IMPORT_CALL_RE = re.compile(r"(?i)\b(?:import|importScripts)\s*\(\s*" + STR_ARG)
XHR_OPEN_RE = re.compile(r"""(?i)\.open\s*\(\s*['"][a-z]+['"]\s*,\s*""" + STR_ARG)
REMOTE_CTOR_RE = re.compile(
    r"(?i)\bnew\s+(?:Worker|SharedWorker|EventSource|WebSocket)\s*\(\s*" + STR_ARG)

DATA_CALL_RES = (FETCH_CALL_RE, IMPORT_CALL_RE, XHR_OPEN_RE, REMOTE_CTOR_RE)


def _classes(el: AL.Element) -> set[str]:
    return {c for c in re.split(r"\s+", el.attrs.get("class", "")) if c}


def _is_hidden(doc: AL.Document, idx: int) -> bool:
    """True when this element or an ancestor is hidden from sighted readers."""
    for i in (idx, *AL.ancestors(doc.elements, idx)):
        el = doc.elements[i]
        if "hidden" in el.attrs or el.attrs.get("aria-hidden") == "true":
            return True
        if HIDDEN_CLASS_RE.search(el.attrs.get("class", "")):
            return True
        if re.search(r"(?i)display\s*:\s*none|visibility\s*:\s*hidden",
                     el.attrs.get("style", "")):
            return True
    return False


def _visible_text(doc: AL.Document) -> str:
    parts: list[str] = []
    for idx, el in enumerate(doc.elements):
        if el.tag in ("script", "style", "template", "head", "title", "meta"):
            continue
        if not el.text.strip():
            continue
        if _is_hidden(doc, idx):
            continue
        parts.append(el.text)
    return " ".join(parts)


def _script_findings(doc: AL.Document) -> Iterable[tuple[str, int, str]]:
    """Every (url, line, call) a script block fetches at runtime."""
    for body, start in doc.script_blocks:
        for rx in DATA_CALL_RES:
            for m in rx.finditer(body):
                url = m.group(2).strip()
                line = start + body.count("\n", 0, m.start())
                yield url, line, m.group(0)[:60]


def _px(value: str) -> float | None:
    """A length in px, or None when it is not an unambiguous px literal.

    Silence beats a guess: em, %, rem, calc(), and var() all depend on context
    this linter cannot see, and a wrong measurement is worse than no measurement.
    """
    v = re.sub(r"\s*!\s*important\s*$", "", value.strip().lower()).strip()
    m = re.fullmatch(r"(-?\d+(?:\.\d+)?)px", v)
    return float(m.group(1)) if m else None


def _media_min_width(context: Sequence[str]) -> float:
    """The widest viewport floor this block sits behind, 0 when unconditional."""
    floor = 0.0
    for prelude in context:
        for m in re.finditer(r"(?i)min-width\s*:\s*(\d+(?:\.\d+)?)px", prelude):
            floor = max(floor, float(m.group(1)))
    return floor


def _is_touch_context(context: Sequence[str]) -> bool:
    for prelude in context:
        low = prelude.lower()
        if "pointer" in low and "coarse" in low:
            return True
        for m in re.finditer(r"max-width\s*:\s*(\d+(?:\.\d+)?)px", low):
            if float(m.group(1)) <= 768:
                return True
    return False


# ---------------------------------------------------------------------------
# DB403 — no request to any external host
# ---------------------------------------------------------------------------

def check_external_requests(doc: AL.Document) -> list[Finding]:
    out: list[Finding] = []
    seen: set[tuple[str, int]] = set()

    def add(url: str, line: int, what: str) -> None:
        key = (url, line)
        if key in seen:
            return
        seen.add(key)
        out.append(_f(doc, "DB403", line,
                      f"{what} requests an external host", url))

    for el in doc.elements:
        if el.tag == "link":
            rels = {r.strip().lower() for r in el.attrs.get("rel", "").split()}
            rel_str = el.attrs.get("rel", "").strip().lower()
            if not (rels & FETCHING_LINK_RELS or rel_str in FETCHING_LINK_RELS):
                continue
            href = el.attrs.get("href", "")
            if AL.is_external(href):
                add(href, el.line, f"<link rel=\"{rel_str or 'stylesheet'}\">")
            continue
        for attr in FETCHING_ATTRS:
            raw = el.attrs.get(attr)
            if not raw:
                continue
            # srcset is a comma-separated candidate list.
            for candidate in (raw.split(",") if attr == "srcset" else [raw]):
                url = candidate.strip().split()[0] if candidate.strip() else ""
                if AL.is_external(url):
                    add(url, el.line, f"<{el.tag} {attr}>")

    for css, line in doc.style_blocks:
        stripped = AL.CSS_COMMENT_RE.sub("", css)
        for m in AL.CSS_URL_RE.finditer(stripped):
            if AL.is_external(m.group(2)):
                add(m.group(2), line + stripped.count("\n", 0, m.start()), "CSS url()")
        for m in AL.AT_IMPORT_RE.finditer(stripped):
            if AL.is_external(m.group(1)):
                add(m.group(1), line + stripped.count("\n", 0, m.start()), "@import")

    for url, line, call in _script_findings(doc):
        if AL.is_external(url):
            add(url, line, f"`{call}`")
    return out


# ---------------------------------------------------------------------------
# DB401a / DB401b — the page loads its data with no server running
# ---------------------------------------------------------------------------

# The global-read arm requires an underscored SCREAMING name (DASHBOARD_DATA), not
# any uppercase property: `window.URL` and `window.JSON` are built-ins, and taking
# them for a data global would silently switch DB401a off on a page that has no
# fallback at all.
SCRIPT_FALLBACK_RE = re.compile(
    r"""(?x)
      createElement\s*\(\s*['"](?i:script)['"]
    | document\s*\.\s*write\s*\(
    | \b(?:window|self|globalThis)\s*\.\s*[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b
    """
)


def _has_script_fallback(doc: AL.Document) -> bool:
    """True when the page can still read its data with fetch() unavailable.

    Two shapes count, both from the binding ladder in the skill: a local
    <script src> that assigns a global, or JS that injects one at runtime.
    """
    for el in doc.elements:
        if el.tag == "script":
            src = el.attrs.get("src", "")
            if src and not AL.is_external(src):
                return True
    return bool(SCRIPT_FALLBACK_RE.search(doc.js_text))


def check_data_binding(doc: AL.Document) -> list[Finding]:
    out: list[Finding] = []
    relative_calls: list[tuple[str, int, str]] = []

    for url, line, call in _script_findings(doc):
        if AL.is_external(url) or url.lower().startswith(AL.INTERNAL_URL_PREFIXES):
            continue
        if url.startswith("/") and not url.startswith("//"):
            out.append(_f(doc, "DB401b", line,
                          f"`{call}` reads an absolute path; from file:// that "
                          "resolves against the filesystem root and always misses",
                          url))
            continue
        relative_calls.append((url, line, call))

    if relative_calls and not _has_script_fallback(doc):
        url, line, call = relative_calls[0]
        out.append(_f(doc, "DB401a", line,
                      f"`{call}` is the only path to the data and a bare fetch() of a "
                      "local file fails from file://; there is no <script src> fallback",
                      url))
    return out


# ---------------------------------------------------------------------------
# DB501 — every state carried by text, not by colour alone
# ---------------------------------------------------------------------------

STATE_WORD_RE = re.compile(
    r"(?ix)(^|[-_])("
    r"ok|good|pass|passing|success|healthy|green|"
    r"warn|warning|amber|yellow|caution|degraded|stale|"
    r"err|error|fail|failed|failing|danger|bad|red|critical|blocked|"
    r"active|inactive|idle|pending|running|done|open|closed|"
    r"online|offline|up|down|live|status|state|severity|health"
    r")([-_]|$)"
)

COLOUR_CARRYING_PROPS = {
    "color", "background", "background-color", "border", "border-color",
    "border-left", "border-left-color", "border-top", "border-top-color",
    "fill", "stroke", "outline-color", "box-shadow",
}


def _colour_classes(doc: AL.Document) -> dict[str, int]:
    """Class names a stylesheet paints, mapped to the line that paints them."""
    painted: dict[str, int] = {}
    for b in doc.css_blocks:
        if not any(p in COLOUR_CARRYING_PROPS for p, _ in b.declarations):
            continue
        for sel in b.selectors:
            for m in re.finditer(r"\.([A-Za-z_][\w-]*)", sel):
                painted.setdefault(m.group(1), b.line)
    return painted


def check_state_colour(doc: AL.Document) -> list[Finding]:
    painted = _colour_classes(doc)
    if not painted:
        return []
    out: list[Finding] = []
    for idx, el in enumerate(doc.elements):
        if el.tag in ("script", "style", "template", "head"):
            continue
        state_classes = sorted(c for c in _classes(el)
                               if c in painted and STATE_WORD_RE.search(c))
        if not state_classes:
            continue
        if AL.full_text(doc.elements, idx).strip():
            continue
        if any(el.attrs.get(a, "").strip() for a in ("aria-label", "title", "alt")):
            continue
        # A marker sitting beside its own word is the correct pattern — the colour
        # agrees with the label rather than replacing it.
        parent = el.parent
        if parent is not None and AL.full_text(doc.elements, parent).strip():
            continue
        out.append(_f(doc, "DB501", el.line,
                      f"<{el.tag} class=\"{' '.join(state_classes)}\"> states its "
                      "condition with colour and nothing else — no text, no label, "
                      "no labelled parent",
                      f"painted at line {painted[state_classes[0]]}"))
    return out


# ---------------------------------------------------------------------------
# DB502 — 4.5:1 measured, not eyeballed
# ---------------------------------------------------------------------------

def check_contrast(doc: AL.Document) -> list[Finding]:
    """Delegates to artifact_lint's measured AD108 pass and re-tags it DB502.

    One contrast implementation, not two: AD108 already resolves var() chains,
    composites alpha over the page ground, and judges both theme states. A second
    copy here would be a second set of bugs.
    """
    return [Finding("DB502", RULES_BY_ID["DB502"].severity, f.file, f.line,
                    f.message, f.evidence)
            for f in AL.check_contrast(doc)]


# ---------------------------------------------------------------------------
# DB503 — pointer targets >= 24px, touch targets >= 44px
# ---------------------------------------------------------------------------

INTERACTIVE_SELECTOR_RE = re.compile(
    r"""(?ix)
      (^|[\s>+~,(])(button|select|textarea|summary)($|[\s>+~,.:\[)])
    | \[\s*role\s*=\s*['"]?(button|tab|link|checkbox|switch|menuitem|option)
    | (^|[\s>+~,(])a($|[\s>+~,.:\[)])
    | (^|[\s>+~,(])input($|[\s>+~,.:\[)])
    | [.#][\w-]*(btn|button|chip|tab|toggle|pill|control|action|nav-link)[\w-]*
    """
)

# The 16px glyph inside a 40px tab is not the target — the tab is. Measured on the
# repo corpus, `.tab-icon` was the whole of DB503's firing rate and every instance
# was this shape, so a rule that cannot tell a control from its parts is measuring
# decoration and calling it a hit.
CONTROL_PART_RE = re.compile(
    r"""(?ix)
      (^|[\s>+~,(])(svg|img|path|circle|rect|use|i)($|[\s>+~,.:\[)])
    | [.#][\w-]*(icon|glyph|dot|mark|indicator|badge|caret|arrow|chevron|
                 spinner|avatar|thumb|swatch|divider|rule|underline|bar)[\w-]*
    | ::(before|after|marker|placeholder)
    """
)

SIZE_PROPS = ("height", "min-height", "width", "min-width")


def _global_border_box(doc: AL.Document) -> bool:
    for b in doc.css_blocks:
        if not any(s.strip() in ("*", "*, *::before, *::after", "html") or
                   s.strip().startswith("*") for s in b.selectors):
            continue
        for prop, val in b.declarations:
            if prop == "box-sizing" and "border-box" in val:
                return True
    return False


def _padding_px(decls: dict[str, str], axis: str) -> float:
    """Padding added along one axis, in px, when it is unambiguously px."""
    sides = ("top", "bottom") if axis == "height" else ("left", "right")
    total = 0.0
    for side in sides:
        v = decls.get(f"padding-{side}")
        if v is not None:
            px = _px(v)
            if px is None:
                return 0.0
            total += px
            continue
        shorthand = decls.get("padding")
        if shorthand is None:
            continue
        parts = shorthand.split()
        if len(parts) == 1:
            px = _px(parts[0])
        elif len(parts) in (2, 3):
            px = _px(parts[0] if axis == "height" else parts[1])
        elif len(parts) == 4:
            idx = {"top": 0, "right": 1, "bottom": 2, "left": 3}[side]
            px = _px(parts[idx])
        else:
            px = None
        if px is None:
            return 0.0
        total += px
    return total


def check_target_size(doc: AL.Document) -> list[Finding]:
    border_box = _global_border_box(doc)
    out: list[Finding] = []
    for b in doc.css_blocks:
        if not any(INTERACTIVE_SELECTOR_RE.search(s) for s in b.selectors):
            continue
        if any(AL.EXEMPT_SELECTOR_RE.search(s) for s in b.selectors):
            continue
        if any(CONTROL_PART_RE.search(s) for s in b.selectors):
            continue
        decls = {p: v for p, v in b.declarations}
        floor = TOUCH_FLOOR_PX if _is_touch_context(b.context) else POINTER_FLOOR_PX
        kind = "touch" if floor == TOUCH_FLOOR_PX else "pointer"
        for prop in SIZE_PROPS:
            raw = decls.get(prop)
            if raw is None:
                continue
            declared = _px(raw)
            if declared is None:
                continue
            axis = "height" if "height" in prop else "width"
            # A content-box height excludes padding; a border-box one includes it.
            effective = declared if border_box else declared + _padding_px(decls, axis)
            if effective >= floor:
                continue
            out.append(_f(doc, "DB503", b.line,
                          f"'{b.selectors[0]}' sets {prop}: {raw.strip()} — a "
                          f"{effective:g}px {kind} target, under the {floor}px floor",
                          f"{prop}: {raw.strip()}"))
    return out


# ---------------------------------------------------------------------------
# DB402 — a visible freshness or snapshot label
# ---------------------------------------------------------------------------

FRESHNESS_RE = re.compile(
    r"(?i)\b(as[ -]of|as_of|last updated|last refreshed|last run|updated|refreshed|"
    r"generated|snapshot|captured|point[ -]in[ -]time|data through|through)\b"
)
DATEISH_RE = re.compile(
    r"(?i)(\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
    r"|\d{1,2}:\d{2}"
    r"|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}"
    r"|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*"
    r"|\b\d+\s*(seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?)\s+ago\b"
    r"|\bjust now\b)"
)


def check_freshness(doc: AL.Document) -> list[Finding]:
    for idx, el in enumerate(doc.elements):
        if el.tag == "time" and not _is_hidden(doc, idx):
            if el.attrs.get("datetime", "").strip() or el.text.strip():
                return []
        if el.attrs.get("data-freshness", "").strip():
            return []
    text = _visible_text(doc)
    if FRESHNESS_RE.search(text) and DATEISH_RE.search(text):
        return []
    body = next((e.line for e in doc.elements if e.tag == "body"), 1)
    return [Finding("DB402", RULES_BY_ID["DB402"].severity, doc.path, body,
                    "no visible freshness label — nothing on this page says when the "
                    "data was true, so a stale snapshot reads as live",
                    "looked for <time>, [data-freshness], or visible 'as of'/"
                    "'updated'/'snapshot' text carrying a date")]


# ---------------------------------------------------------------------------
# DB507 — no horizontal page overflow at 320px
# ---------------------------------------------------------------------------

PAGE_LEVEL_SELECTOR_RE = re.compile(
    r"""(?ix)
      ^(html|body|main)$
    | [.#][\w-]*(page|app|shell|layout|container|wrapper|content|grid|board|
                 dashboard|root|main|body|frame|canvas)[\w-]*
    """
)


def _overflow_findings_from_css(doc: AL.Document) -> list[Finding]:
    out: list[Finding] = []
    for b in doc.css_blocks:
        # A value behind `@media (min-width: 900px)` only applies on a viewport
        # already that wide, so it cannot overflow the 320px floor.
        if _media_min_width(b.context) > NARROW_VIEWPORT_PX:
            continue
        decls = {p: v for p, v in b.declarations}
        for prop in ("min-width", "width"):
            raw = decls.get(prop)
            if raw is None:
                continue
            px = _px(raw)
            if px is None or px <= NARROW_VIEWPORT_PX:
                continue
            page_level = any(PAGE_LEVEL_SELECTOR_RE.search(s.strip())
                             for s in b.selectors)
            # A fixed `width` inside a scrollable card is the author's business; a
            # `min-width` cannot be absorbed by any ancestor, so it always overflows.
            if prop == "width" and not page_level:
                continue
            out.append(_f(doc, "DB507", b.line,
                          f"'{b.selectors[0]}' sets {prop}: {raw.strip()}, wider than "
                          f"the {NARROW_VIEWPORT_PX}px floor — a horizontal scrollbar "
                          "on the narrowest phone",
                          f"{prop}: {raw.strip()}"))
    return out


def check_overflow(doc: AL.Document) -> list[Finding]:
    out = _overflow_findings_from_css(doc)
    for el in doc.elements:
        style = el.attrs.get("style", "")
        if not style:
            continue
        for prop, raw in AL.parse_declarations(style):
            if prop not in ("width", "min-width"):
                continue
            px = _px(raw)
            if px is None or px <= NARROW_VIEWPORT_PX:
                continue
            out.append(_f(doc, "DB507", el.line,
                          f"inline style on <{el.tag}> sets {prop}: {raw.strip()}, "
                          f"wider than the {NARROW_VIEWPORT_PX}px floor",
                          f"style=\"{style.strip()[:80]}\""))
    return out


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

CHECKS = (
    check_freshness,
    check_external_requests,
    check_data_binding,
    check_state_colour,
    check_contrast,
    check_target_size,
    check_overflow,
)


def lint_source(path: Path | str, source: str,
                disabled: Sequence[str] = ()) -> list[Finding]:
    doc = AL.build_document(Path(path), source, "standalone")
    findings: list[Finding] = []
    for check in CHECKS:
        findings.extend(check(doc))
    skip = set(disabled)
    findings = [f for f in findings if f.rule not in skip]
    findings.sort(key=lambda f: (f.line, f.rule))
    return findings


def lint(path: Path | str, disabled: Sequence[str] = ()) -> list[Finding]:
    p = Path(path)
    source = p.read_text(encoding="utf-8", errors="replace")
    return lint_source(p, source, disabled)


def worst_severity(findings: Sequence[Finding]) -> str | None:
    if not findings:
        return None
    return max((f.severity for f in findings), key=lambda s: SEVERITY_RANK[s])


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

COLOR = {"error": "\033[31m", "warn": "\033[33m", "info": "\033[36m", "off": "\033[0m"}


def _tint(text: str, severity: str, enabled: bool) -> str:
    return f"{COLOR[severity]}{text}{COLOR['off']}" if enabled else text


def _expand(raw_paths: Sequence[str]) -> list[Path]:
    paths: list[Path] = []
    for raw in raw_paths:
        p = Path(raw)
        if p.is_dir():
            for pattern in ("*.html", "*.htm"):
                paths.extend(sorted(p.rglob(pattern)))
        else:
            paths.append(p)
    return paths


def cmd_check(args: argparse.Namespace) -> int:
    paths = _expand(args.paths)
    missing = [p for p in paths if not p.is_file()]
    if missing:
        print(f"dashboard_lint: no such file: {missing[0]}", file=sys.stderr)
        return 2
    if not paths:
        print("dashboard_lint: nothing to check", file=sys.stderr)
        return 2

    disabled = [r.strip() for r in (args.disable or "").split(",") if r.strip()]
    unknown = [r for r in disabled if r not in RULES_BY_ID]
    if unknown:
        print(f"dashboard_lint: unknown rule id: {', '.join(unknown)}", file=sys.stderr)
        return 2

    results: list[dict] = []
    all_findings: list[Finding] = []
    for p in paths:
        source = p.read_text(encoding="utf-8", errors="replace")
        findings = lint_source(p, source, disabled)
        findings = [f for f in findings
                    if SEVERITY_RANK[f.severity] >= SEVERITY_RANK[args.min_severity]]
        all_findings.extend(findings)
        results.append({
            "file": str(p),
            "bytes": len(source.encode("utf-8")),
            "findings": [f.to_dict() for f in findings],
        })

    counts = {s: sum(1 for f in all_findings if f.severity == s) for s in SEVERITIES}
    threshold = SEVERITY_RANK.get(args.fail_on, 99) if args.fail_on != "never" else 99
    failed = any(SEVERITY_RANK[f.severity] >= threshold for f in all_findings)

    if args.json:
        print(json.dumps({
            "tool": "dashboard_lint",
            "version": __version__,
            "counts": counts,
            "fail_on": args.fail_on,
            "ok": not failed,
            "results": results,
        }, indent=2))
        return 1 if failed else 0

    tty = sys.stdout.isatty() and not os.environ.get("NO_COLOR")
    for result in results:
        print(result["file"])
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
    if args.json:
        print(json.dumps({
            "tool": "dashboard_lint",
            "version": __version__,
            "severity_policy": (
                "Only mechanically unambiguous rules are 'error'. Rules that reason "
                "from a vocabulary are heuristic, ship 'warn', and never hard-block. "
                "No rule reaches 'error' without a corpus firing-rate measurement."
            ),
            "not_graded": [
                "DB101 one archetype", "DB102 priorities above the fold",
                "DB103 progressive disclosure", "DB104 round-trip navigation",
                "DB201-DB203 MECE record separation", "DB301-DB306 record contract "
                "(graded by dashboard_record.py, not by the rendered file)",
                "DB504 content ratio", "DB505 reduced motion", "DB506 real controls",
            ],
            "rules": [asdict(r) for r in RULES],
        }, indent=2))
        return 0
    for r in RULES:
        flag = " ~heuristic" if r.heuristic else ""
        print(f"{r.id}  {r.severity:<5} {r.title}{flag}")
        print(f"       why: {r.rationale}")
        print(f"       fix: {r.fix}")
        print()
    print(f"{len(RULES)} rules")
    return 0


def measure(paths: Sequence[Path], sample_limit: int = 12) -> dict:
    """Firing rate per rule over a corpus — the gate on any severity promotion.

    Firing rate is not precision. It is the cheap proxy that says where to look: a
    rule firing on most hand-authored dashboards is probably matching something
    other than what it claims to, and one firing on a handful is worth reading
    instance by instance. `--samples` prints the evidence so a human can judge.
    """
    files_fired: collections.Counter = collections.Counter()
    total: collections.Counter = collections.Counter()
    samples: dict[str, list[dict]] = collections.defaultdict(list)
    errors: list[dict] = []

    for p in paths:
        try:
            findings = lint(p)
        except Exception as exc:  # a corpus file we cannot read is data, not a crash
            errors.append({"file": str(p), "error": f"{type(exc).__name__}: {exc}"})
            continue
        for rule in {f.rule for f in findings}:
            files_fired[rule] += 1
        for f in findings:
            total[f.rule] += 1
            if len(samples[f.rule]) < sample_limit:
                samples[f.rule].append({
                    "file": str(p), "line": f.line,
                    "message": f.message, "evidence": f.evidence,
                })

    n = len(paths) - len(errors)
    rules = []
    for r in RULES:
        ff = files_fired[r.id]
        rules.append({
            "id": r.id, "title": r.title, "severity": r.severity,
            "heuristic": r.heuristic,
            "files_fired": ff,
            "firing_rate": round(ff / n, 4) if n else 0.0,
            "findings": total[r.id],
            "findings_per_firing_file": round(total[r.id] / ff, 2) if ff else 0.0,
        })
    return {
        "tool": "dashboard_lint_corpus", "version": __version__,
        "corpus_size": n, "parse_errors": errors,
        "total_findings": sum(total.values()),
        "rules": rules, "samples": dict(samples),
    }


def cmd_corpus(args: argparse.Namespace) -> int:
    paths: list[Path] = []
    if args.from_file:
        paths += [Path(l.strip()) for l in Path(args.from_file).read_text().splitlines()
                  if l.strip()]
    for root in args.roots:
        p = Path(root)
        if p.is_file():
            paths.append(p)
        elif p.is_dir():
            paths += sorted(p.glob(args.glob))
    seen: set[Path] = set()
    unique: list[Path] = []
    for p in paths:
        rp = p.resolve()
        if rp not in seen and rp.is_file():
            seen.add(rp)
            unique.append(p)
    if not unique:
        print("dashboard_lint: corpus is empty", file=sys.stderr)
        return 2

    data = measure(unique, args.sample_limit)
    if args.json:
        print(json.dumps(data, indent=2))
        return 0

    print(f"corpus={data['corpus_size']} files  total_findings={data['total_findings']}")
    if data["parse_errors"]:
        print(f"parse errors: {len(data['parse_errors'])}")
    print()
    print(f"{'rule':8} {'sev':5} {'H':1} {'files':>6} {'rate':>7} {'finds':>6} {'per':>5}  title")
    for r in data["rules"]:
        print(f"{r['id']:8} {r['severity']:5} {'H' if r['heuristic'] else ' ':1} "
              f"{r['files_fired']:6} {r['firing_rate'] * 100:6.1f}% {r['findings']:6} "
              f"{r['findings_per_firing_file']:5.1f}  {r['title']}")
    print("\nFiring rate is a proxy, not precision. Read samples before promoting:")
    print("  high rate on hand-authored dashboards -> likely matching the wrong thing")
    print("  low rate -> read instances one by one and judge each")
    for rid in [s.strip().upper() for s in (args.samples or "").split(",") if s.strip()]:
        print(f"\n=== samples: {rid} ===")
        for s in data["samples"].get(rid, []):
            short = s["file"].split("/")[-1]
            print(f"  {short[:44]:44} L{s['line']:<5} {s['message'][:70]}")
            if s["evidence"]:
                print(f"      ev: {s['evidence'][:88]}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="dashboard_lint",
        description="Deterministic checks for a rendered dashboard file.")
    p.add_argument("--version", action="version", version=f"dashboard_lint {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    c = sub.add_parser("check", help="check one or more dashboard files")
    c.add_argument("paths", nargs="+", help="files or directories")
    c.add_argument("--json", action="store_true", help="machine-readable output")
    c.add_argument("--min-severity", choices=SEVERITIES, default="info",
                   help="hide findings below this severity")
    c.add_argument("--fail-on", choices=SEVERITIES + ("never",), default="error",
                   help="exit 1 when a finding at or above this severity exists")
    c.add_argument("--disable", default="", help="comma-separated rule ids to skip")
    c.set_defaults(func=cmd_check)

    r = sub.add_parser("rules", help="print the rule contract")
    r.add_argument("--json", action="store_true")
    r.set_defaults(func=cmd_rules)

    m = sub.add_parser("corpus", help="measure rule firing rates across a corpus")
    m.add_argument("roots", nargs="*", help="files or directories to scan")
    m.add_argument("--glob", default="**/*.html", help="glob applied to directory roots")
    m.add_argument("--from-file", help="newline-separated list of paths")
    m.add_argument("--samples", default="", help="comma-separated rule ids to show evidence for")
    m.add_argument("--sample-limit", type=int, default=12)
    m.add_argument("--json", action="store_true")
    m.set_defaults(func=cmd_corpus)
    return p


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
