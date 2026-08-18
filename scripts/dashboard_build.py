#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""dashboard_build — scaffold a dashboard spec and render it to a graded page.

Stdlib only. No network.

    python3 dashboard_build.py new --archetype queue --title "Release queue" -o spec.json
    python3 dashboard_build.py build spec.json -o dashboard.html --check
    python3 dashboard_build.py build spec.json -o dashboard.html --check --fail-on warn

Why the scaffold is worth having
--------------------------------
The rules in `dashboard_lint.py` are cheap to state and easy to trip. A dashboard
that starts from this scaffold already satisfies all eight: it carries a visible
as-of time (DB402), requests nothing remote (DB403), reads its data through the
binding ladder that survives file:// (DB401a/DB401b), states every condition in a
word as well as a colour (DB501), clears 4.5:1 in both theme states (DB502), sizes
every control to the 44px floor (DB503), and fixes no width (DB507).
`scripts/test_dashboard_build.py` asserts that, so the claim cannot rot.

Grading is never silent
-----------------------
`--check` runs the linter on what was just written. When the grade cannot be run —
no output file to grade, no linter beside this script, or a linter that raised —
this exits non-zero and says so in as many words. A requested grade that did not
happen is not a pass, and an exit code of 0 would report it as one. Without
`--check`, the build still prints `not graded` and names the command that would
grade it, so a clean exit never doubles as a clean bill of health.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

__version__ = "1.0.0"

SPEC_SCHEMA = "ibr.dashboard.spec/v1"

# The eight archetypes in skills/dashboard-design/SKILL.md §1. One per dashboard
# (DB101) — a page that is two archetypes at once is two dashboards.
ARCHETYPES = ("queue", "control", "scorecard", "status", "brief",
              "gallery", "tracker", "ambient")

# DB501. Each state ships the word, never the colour alone. The token is what
# paints it; the label is what says it.
STATES: dict[str, dict[str, str]] = {
    "blocked":  {"label": "Blocked",  "token": "--state-bad"},
    "at-risk":  {"label": "At risk",  "token": "--state-warn"},
    "open":     {"label": "Open",     "token": "--state-info"},
    "done":     {"label": "Done",     "token": "--state-good"},
    "waiting":  {"label": "Waiting",  "token": "--state-muted"},
}

# Same token vocabulary as artifact_build.py's scaffold, so the two agree. The
# grounds are cool neutrals rather than that scaffold's warm cream, which
# artifact_lint's AD401 names as the current AI-design default. Every foreground
# here measures above 6.4:1 on both grounds in both theme states — headroom over
# the 4.5:1 floor, so a later tweak does not silently cross it.
PALETTE = {
    "paper": "#fcfcfd", "surface": "#f4f4f6", "ink": "#1a1a1f",
    "muted": "#585862", "accent": "#8a3d10", "rule": "#e0e0e5",
    "good": "#166534", "warn": "#7a4c05", "bad": "#a01b16", "info": "#1d4f78",
    "d_paper": "#121216", "d_surface": "#1b1b21", "d_ink": "#e8e8ee",
    "d_muted": "#a3a3af", "d_accent": "#f0a06a", "d_rule": "#2e2e36",
    "d_good": "#79c795", "d_warn": "#e5b45f", "d_bad": "#f79189", "d_info": "#8ec5ec",
}

PAGE_CSS = """\
*, *::before, *::after {{ box-sizing: border-box; }}
body, h1, h2, h3, p, ul, ol, figure {{ margin: 0; }}
ul, ol {{ padding: 0; list-style: none; }}
:root {{
  --paper: {paper};
  --surface: {surface};
  --ink: {ink};
  --muted: {muted};
  --accent: {accent};
  --rule: {rule};
  --state-good: {good};
  --state-warn: {warn};
  --state-bad: {bad};
  --state-info: {info};
  --state-muted: {muted};
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --paper: {d_paper};
    --surface: {d_surface};
    --ink: {d_ink};
    --muted: {d_muted};
    --accent: {d_accent};
    --rule: {d_rule};
    --state-good: {d_good};
    --state-warn: {d_warn};
    --state-bad: {d_bad};
    --state-info: {d_info};
    --state-muted: {d_muted};
  }}
}}
:root[data-theme="dark"] {{
  --paper: {d_paper};
  --surface: {d_surface};
  --ink: {d_ink};
  --muted: {d_muted};
  --accent: {d_accent};
  --rule: {d_rule};
  --state-good: {d_good};
  --state-warn: {d_warn};
  --state-bad: {d_bad};
  --state-info: {d_info};
  --state-muted: {d_muted};
}}
body {{
  background: var(--paper);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif;
  line-height: 1.5;
  padding: clamp(1rem, 4vw, 2.5rem);
}}
.dash {{ display: grid; gap: 1.5rem; max-width: 72rem; margin-inline: auto; }}
.dash-head {{ display: grid; gap: .35rem; }}
h1 {{ font-size: clamp(1.25rem, 1rem + 1.4vw, 1.75rem); line-height: 1.25; }}
.as-of {{ color: var(--muted); font-size: .8125rem; }}
.source {{ color: var(--muted); font-size: .75rem; }}
.section {{ display: grid; gap: .5rem; }}
h2 {{ font-size: .8125rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }}
.items {{
  display: grid; gap: 1px;
  background: var(--rule); border: 1px solid var(--rule); border-radius: .375rem;
  overflow: hidden;
}}
.item {{
  display: flex; flex-wrap: wrap; gap: .25rem .75rem; align-items: baseline;
  min-height: 44px; padding: .625rem .875rem; background: var(--surface);
}}
.item-label {{ flex: 1 1 12rem; font-weight: 600; }}
.item-note {{ flex: 1 1 100%; color: var(--muted); font-size: .8125rem; }}
.state {{ font-size: .8125rem; font-weight: 600; white-space: nowrap; }}
.state-blocked {{ color: var(--state-bad); }}
.state-at-risk {{ color: var(--state-warn); }}
.state-open {{ color: var(--state-info); }}
.state-done {{ color: var(--state-good); }}
.state-waiting {{ color: var(--state-muted); }}
.empty {{ padding: .875rem; background: var(--surface); color: var(--muted); }}
a {{ color: var(--accent); }}
button, .btn {{
  min-height: 44px; min-width: 44px; padding: .5rem .875rem;
  font: inherit; color: var(--ink); background: var(--surface);
  border: 1px solid var(--rule); border-radius: .375rem; cursor: pointer;
}}
:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
@media (prefers-reduced-motion: reduce) {{
  *, *::before, *::after {{ animation-duration: .01ms !important; transition-duration: .01ms !important; }}
}}
"""

# DB401. fetch() first so a served page gets a live read, <script src> second so a
# double-clicked file still fills in. Same file, both contexts, no daemon.
BINDING_JS = """\
(function () {{
  var SRC = {src_json};
  function render(data) {{
    if (!data) {{ return; }}
    document.documentElement.setAttribute('data-bound', 'true');
    window.DASHBOARD_DATA = data;
    document.dispatchEvent(new CustomEvent('dashboard:data', {{ detail: data }}));
  }}
  function viaScript() {{
    var s = document.createElement('script');
    s.src = SRC.replace(/\\.json$/, '.js') + '?t=' + Date.now();
    s.onload = function () {{ render(window.DASHBOARD_DATA); }};
    document.head.appendChild(s);
  }}
  try {{
    fetch(SRC).then(function (r) {{ return r.json(); }}).then(render).catch(viaScript);
  }} catch (e) {{
    viaScript();
  }}
}})();
"""


# ---------------------------------------------------------------------------
# Spec
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def new_spec(archetype: str, title: str) -> dict[str, Any]:
    return {
        "schema": SPEC_SCHEMA,
        "archetype": archetype,
        "title": title,
        "as_of": _now_iso(),
        "source": "",
        "data": "",
        "sections": [
            {
                "heading": "Needs you now",
                "items": [
                    {"label": "Replace this row with real work",
                     "state": "blocked",
                     "note": "DB102: the first screen answers what needs me now, "
                             "not here is everything."},
                ],
            },
        ],
    }


class SpecError(ValueError):
    pass


def validate_spec(spec: Any) -> dict[str, Any]:
    if not isinstance(spec, dict):
        raise SpecError("spec must be a JSON object")
    schema = spec.get("schema")
    if schema and schema != SPEC_SCHEMA:
        raise SpecError(f"unknown spec schema {schema!r}; expected {SPEC_SCHEMA!r}")
    archetype = spec.get("archetype")
    if archetype not in ARCHETYPES:
        raise SpecError(f"archetype must be one of {', '.join(ARCHETYPES)}; "
                        f"got {archetype!r}")
    if not str(spec.get("title", "")).strip():
        raise SpecError("spec needs a title")
    sections = spec.get("sections")
    if not isinstance(sections, list):
        raise SpecError("spec needs a 'sections' list")
    for i, section in enumerate(sections):
        if not isinstance(section, dict):
            raise SpecError(f"sections[{i}] must be an object")
        for j, item in enumerate(section.get("items", []) or []):
            if not isinstance(item, dict):
                raise SpecError(f"sections[{i}].items[{j}] must be an object")
            state = item.get("state")
            if state is not None and state not in STATES:
                raise SpecError(
                    f"sections[{i}].items[{j}] has state {state!r}; "
                    f"known states: {', '.join(STATES)}")
    return spec


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

def _esc(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _render_item(item: dict[str, Any]) -> str:
    label = _esc(item.get("label", "")).strip() or "Untitled"
    state = item.get("state")
    parts = [f'      <li class="item">',
             f'        <span class="item-label">{label}</span>']
    if state:
        meta = STATES[state]
        # DB501: the word is the state. The colour agrees with it; it never
        # carries it alone.
        parts.append(f'        <span class="state state-{_esc(state)}">'
                     f'{_esc(meta["label"])}</span>')
    note = str(item.get("note", "")).strip()
    if note:
        parts.append(f'        <p class="item-note">{_esc(note)}</p>')
    parts.append("      </li>")
    return "\n".join(parts)


def _render_section(section: dict[str, Any]) -> str:
    heading = _esc(section.get("heading", "")).strip()
    items = [i for i in (section.get("items") or []) if isinstance(i, dict)]
    out = ['    <section class="section">']
    if heading:
        out.append(f"      <h2>{heading}</h2>")
    if items:
        out.append('    <ul class="items">')
        out.extend(_render_item(i) for i in items)
        out.append("    </ul>")
    else:
        # An empty state that says what would appear here beats a blank box.
        out.append('    <p class="empty">Nothing in this section yet.</p>')
    out.append("    </section>")
    return "\n".join(out)


def render(spec: dict[str, Any]) -> str:
    validate_spec(spec)
    title = str(spec["title"]).strip()
    as_of = str(spec.get("as_of") or _now_iso()).strip()
    # DB402: the label is visible text, not a comment and not a tooltip.
    stamp = as_of.replace("T", " ").replace("Z", " UTC")
    source = str(spec.get("source") or "").strip()
    data_src = str(spec.get("data") or "").strip()

    head = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        f"  <title>{_esc(title)}</title>",
        "  <style>",
        PAGE_CSS.format(**PALETTE).rstrip(),
        "  </style>",
        "</head>",
    ]

    body = [
        "<body>",
        '  <div class="dash">',
        '    <header class="dash-head">',
        f"      <h1>{_esc(title)}</h1>",
        f'      <p class="as-of">Snapshot as of '
        f'<time datetime="{_esc(as_of)}">{_esc(stamp)}</time></p>',
    ]
    if source:
        # DB305: name the record the view was derived from.
        body.append(f'      <p class="source">Derived from {_esc(source)}</p>')
    body.append("    </header>")
    body.extend(_render_section(s) for s in spec.get("sections", []))
    body.append("  </div>")
    if data_src:
        body.append("  <script>")
        body.append(BINDING_JS.format(src_json=json.dumps(data_src)).rstrip())
        body.append("  </script>")
    body.append("</body>")
    body.append("</html>")

    return "\n".join(head + body) + "\n"


# ---------------------------------------------------------------------------
# Grading — loud when it does not happen
# ---------------------------------------------------------------------------

NOT_GRADED = "dashboard_build: NOT GRADED"


def _ungraded(reason: str, hint: str) -> int:
    """A grade that was asked for and did not run is never reported as a pass."""
    print(f"{NOT_GRADED} — {reason}", file=sys.stderr)
    print(f"  {hint}", file=sys.stderr)
    return 2


def grade(out: str | None, fail_on: str = "error") -> int:
    if not out:
        return _ungraded(
            "--check needs -o/--output; output went to stdout and there is no file "
            "to grade",
            "rerun as: dashboard_build.py build <spec> -o dashboard.html --check")
    target = Path(out)
    if not target.is_file():
        return _ungraded(f"{out} was not written, so nothing was graded",
                         "check the output path and rerun")
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import dashboard_lint  # noqa: PLC0415
    except ImportError as exc:
        return _ungraded(f"dashboard_lint.py is not importable beside this script ({exc})",
                         "put dashboard_lint.py in the same directory and rerun")
    try:
        findings = dashboard_lint.lint(target)
    except Exception as exc:  # the linter failing is a failure, not a pass
        return _ungraded(f"dashboard_lint raised {type(exc).__name__}: {exc}",
                         "this is a linter bug; report it rather than trusting the build")

    for f in findings:
        print(f"  {f.severity:<5} {f.rule}  line {f.line}  {f.message}", file=sys.stderr)
    counts = {s: sum(1 for f in findings if f.severity == s)
              for s in ("error", "warn", "info")}
    print(f"dashboard_lint: {counts['error']} error, {counts['warn']} warn, "
          f"{counts['info']} info", file=sys.stderr)

    rank = {"info": 1, "warn": 2, "error": 3}
    threshold = rank.get(fail_on, 99) if fail_on != "never" else 99
    return 1 if any(rank[f.severity] >= threshold for f in findings) else 0


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


def cmd_new(args: argparse.Namespace) -> int:
    spec = new_spec(args.archetype, args.title)
    _emit(json.dumps(spec, indent=2) + "\n", args.output, args.quiet)
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    raw = Path(args.input).read_text(encoding="utf-8")
    try:
        spec = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"dashboard_build: {args.input} is not valid JSON: {exc}", file=sys.stderr)
        return 2
    try:
        page = render(spec)
    except SpecError as exc:
        print(f"dashboard_build: {exc}", file=sys.stderr)
        return 2
    _emit(page, args.output, args.quiet)

    if not args.check:
        # Exit 0 is honest here — no grade was asked for. Silence would not be, so
        # --quiet suppresses the write confirmation and never this. A quiet build
        # that says nothing and exits 0 is indistinguishable from a graded pass,
        # which is the whole failure --check exists to prevent.
        print(f"{NOT_GRADED} — --check was not passed", file=sys.stderr)
        print(f"  grade it: python3 dashboard_lint.py check "
              f"{args.output or '<file>'}", file=sys.stderr)
        return 0
    return grade(args.output, args.fail_on)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="dashboard_build",
        description="Scaffold a dashboard spec and render it to a graded page.")
    p.add_argument("--version", action="version", version=f"dashboard_build {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    n = sub.add_parser("new", help="scaffold a spec that renders to a clean dashboard")
    n.add_argument("--archetype", choices=ARCHETYPES, required=True)
    n.add_argument("--title", required=True)
    n.add_argument("-o", "--output")
    n.add_argument("--quiet", action="store_true")
    n.set_defaults(func=cmd_new)

    b = sub.add_parser("build", help="render a spec to a dashboard page")
    b.add_argument("input", help="spec JSON path")
    b.add_argument("-o", "--output")
    b.add_argument("--quiet", action="store_true")
    b.add_argument("--check", action="store_true",
                   help="grade the result with dashboard_lint; a grade that cannot "
                        "run exits 2 rather than reporting a pass")
    b.add_argument("--fail-on", choices=("error", "warn", "info", "never"),
                   default="error", help="exit 1 at or above this severity")
    b.set_defaults(func=cmd_build)
    return p


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
