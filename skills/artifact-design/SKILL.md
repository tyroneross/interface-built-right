---
name: artifact-design
description: Use when building a single self-contained HTML page — an artifact, a one-file report, a shareable page, a standalone .html deliverable — or when asked to check, lint, wrap, or port an artifact so it opens outside Claude. Covers treatment calibration, the three-state theme contract, palette and type direction, page naming, and the deterministic checks any agent can run.
version: 0.1.0
user-invocable: false
---

# Artifact Design — the portable lane

A single file that carries its own styles, scripts, fonts, and images. No build
step, no CDN, no server. It opens from `file://`, drops on any static host, and
publishes through Claude's Artifact tool without modification.

This lane is host-neutral on purpose: the rules live in a stdlib Python CLI, so
Codex, Cursor, a local model, a git hook, and CI all reach the same verdict.

## Which lane you are in

| Profile | Shape | Where it runs |
|---|---|---|
| `claude-artifact` | fragment — **no** `<!doctype>`/`<html>`/`<head>`/`<body>` | Claude's Artifact tool supplies the skeleton |
| `standalone` | full document with doctype, `lang`, charset, viewport, title | `file://`, static hosts, email attachments, anywhere |
| `markdown` | `.md` — keeps its filename as its identity | Markdown-native destinations only |

Pick `markdown` because the destination calls for it, never to save effort.

Inside Claude Code, the built-in `artifact-design` skill still owns the
Artifact-publish transport (favicon parameter, `description`, capabilities). Load
both when you are publishing through the tool. This skill owns the portable lane,
the design method, and every deterministic check.

## The loop

```bash
R="${CLAUDE_PLUGIN_ROOT:-$PWD}"          # any host: use the plugin/repo root

python3 "$R/scripts/artifact_build.py" new --title "Tide Ledger" \
    --favicon 🌊 --theme-toggle -o page.html    # 1. start from a correct skeleton
#    ... design plan, then build ...             # 2-3. the judgment layer, below
python3 "$R/scripts/artifact_lint.py" check page.html            # 4. verify
python3 "$R/scripts/artifact_build.py" unwrap page.html -o frag.html  # 5. to publish
```

`new` emits a page that already satisfies the theme contract and lints clean, so
you start from a correct page rather than a description of one. Design *over* it;
do not start from a blank file and rediscover the contract.

## What is checked, and what is not

The full rule contract — 39 rules, each with rationale, fix, and profile scope —
is machine-readable and is the single source of truth:

```bash
python3 "$R/scripts/artifact_lint.py" rules --json     # for agents
python3 "$R/scripts/artifact_lint.py" rules            # for humans
```

Do not restate those rules here or in a plan; cite the ID. `AX*` is portability,
`AD1xx` theme, `AD2xx` page identity, `AD3xx` layout, `AD4xx` AI-cliché detection,
`AS5xx` inline SVG.

**Severity is load-bearing.** Only mechanically unambiguous rules are `error`.
Everything heuristic ships `warn`/`info` and never blocks. Rule precision is
**unmeasured** — treat a heuristic finding as a prompt to look, not a verdict.

Everything below is the judgment layer. A linter cannot grade any of it.

## Read the request first

Calibrate the treatment, not whether to design. A memo deserves the same craft as
a landing page; what changes is how that craft is delivered.

- **Utilitarian** — a plan, a memo, a status page, an internal tool. Real
  typographic hierarchy, considered spacing, a chosen palette. No hero. Flourishes
  stay tasteful and few. Most requests are this.
- **Editorial** — a landing page, a game, something the reader keeps or shares.
  Opinionated calls, one real aesthetic risk where it serves the work.

When unsure, a well-composed page is never wrong; an over-designed one sometimes is.

## Honor what is already there

Precedence, always: **the user's own words → the project's existing system → your
choices.** Before designing, look for `CLAUDE.md`, a tokens or theme file, existing
component styles, `.ibr/ui-guidance/`, or an active design system. When one exists,
apply it — everything here fills gaps and never overrides.

For the wider house style, load `ibr:design-guidance` (Calm Precision) and, for
anything with numbers in it, `ibr:data-visualization`.

## Design plan before code

Write it down first, in three lines, then derive every decision from it:

- **Color** — 4–6 named hex values. Pick the neutral; a pure mid-grey reads as
  unconsidered, a grey biased slightly toward the accent reads as chosen.
- **Type** — two or more roles: a characterful display face used with restraint, a
  complementary body face, a utility face for captions or data if needed. The CSP
  blocks font CDNs (`AX003`), so inline a face as an `@font-face` data URI or
  commit to a system stack. Never link one and hope.
- **Layout** — the concept in one or two sentences.

Ground all three in the subject's own world — its materials, instruments,
vernacular. That is where distinctive choices come from. Build with real content
throughout; never lorem.

## Fundamentals a linter cannot grade

**Name the page like a product.** The `<title>` is the artifact's name in the tab
and the gallery, sitting beside dozens of others. A short noun phrase, usually two
to four words, specific enough to pick out of a list. When a candidate pairs a name
with a generic word, **keep the name** — trimming to the generic half produces
exactly the title that could sit on any page. The explanation belongs in the
publish `description`, not the title. (`AD202`/`AD203`/`AD204` catch the mechanical
half of this; the "is this a name?" judgment is yours.)

**Structure is information.** Numbered markers, eyebrows, dividers, and labels must
encode something true. `01 / 02 / 03` is right only when the content actually is a
sequence. Question every structural device before it ships.

**Copy is design material.** Write from the reader's side of the screen — name
things by what people recognize, not how the system is built. Active voice. A
control says exactly what happens ("Publish" → "Published"). Errors say what broke
and how to fix it.

**Spend boldness in one place** and keep everything around it quiet. If the accent
fights the ground, shift it analogous or drop saturation rather than replacing it.

**Avoid the current AI defaults.** Warm cream with a serif display and terracotta
accent; near-black with a lone acid-green pop; purple-to-blue gradient hero; Inter
or Space Grotesk as the only face; emoji section markers; everything centred;
uniform `rounded-lg`; accent rail on rounded cards. `AD401`–`AD404` flag the
detectable ones as `info`. Where the user pins a direction, follow it exactly —
their words win, including when they ask for one of these looks.

## When it is a UI, not a document

A dashboard is scanned and operated, not read top to bottom, so craft shifts from
typography to information design: summary before detail; state encoded in form as
well as number (a pill, a chip, a severity stripe); semantic colour (good / warning
/ critical) kept separate from the accent; interactive things that look interactive.
Load `ibr:data-visualization` before drawing any chart.

## Diagrams

Load `ibr:artifact-diagramming` before drawing one. Mermaid renders natively in
Claude's viewer but has no renderer in a standalone file (`AX009`), so inline SVG
is the portable answer.

## Runtime capabilities do not port

`window.claude.*` exists only inside the Claude artifact viewer. Off-viewer it is
undefined and an unguarded call throws (`AX007` — an error in the `standalone`
profile). Feature-detect, and design a static fallback that still delivers the page's
job:

```js
if (window.claude?.callTool) { /* live path */ } else { /* static fallback */ }
```

## Running from another agent

Nothing here needs Claude. From Codex, Cursor, a local model, a hook, or CI:

```bash
python3 scripts/artifact_lint.py  check dist/*.html --json --fail-on error
python3 scripts/artifact_lint.py  rules --json
python3 scripts/artifact_build.py info page.html --json
```

Exit codes: `0` clean · `1` findings at or above `--fail-on` (default `error`) ·
`2` usage error. `--disable AX006,AD204` skips rules; `--fail-on never` reports
without failing.

## References

- `references/theme-contract.md` — the three viewer states and the CSS pattern that
  survives all of them, with the failure mode each line prevents.
- `references/profiles.md` — what each profile guarantees, and what `wrap`/`unwrap`
  inject and remove.
