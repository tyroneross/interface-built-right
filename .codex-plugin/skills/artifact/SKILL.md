---
name: artifact
description: Use when building, checking, or porting a single self-contained HTML page — an artifact, a one-file report, a standalone .html deliverable, or a page that must open outside Claude.
---

# IBR Artifact

A single file carrying its own styles, scripts, fonts, and images. No build step,
no CDN, no server. The rules are a stdlib Python CLI, so Codex reaches exactly the
same verdict Claude does — nothing here needs the Claude runtime.

Scripts are at `<plugin-root>/scripts/`. Python 3, standard library only, no
network.

## Loop

```bash
python3 scripts/artifact_build.py new --title "Tide Ledger" \
    --profile standalone --favicon 🌊 -o page.html --check
#   ... design over the scaffold ...
python3 scripts/artifact_lint.py check page.html --min-severity warn
```

`new` emits a page that already satisfies the theme contract and lints clean.
Start there; do not start from a blank file and rediscover the contract.

## Commands

| Command | Purpose |
|---|---|
| `artifact_lint.py check <path> [--json] [--fail-on error\|warn\|info\|never] [--disable IDS]` | run the 39-rule contract |
| `artifact_lint.py rules --json` | the machine-readable contract — IDs, severities, rationale, fix |
| `artifact_build.py new --title T [--profile standalone\|claude-artifact]` | scaffold a correct page |
| `artifact_build.py wrap <frag> -o <doc> [--favicon 🌊] [--theme-toggle]` | fragment → openable document |
| `artifact_build.py unwrap <doc> -o <frag>` | document → publish fragment |
| `artifact_build.py embed-font <file> [--family N]` | font file → self-contained `@font-face` (fixes `AX003`) |
| `artifact_build.py info <path> --json` | profile, title, injected nodes, external URLs |

Exit codes: `0` clean · `1` findings at or above `--fail-on` (default `error`) ·
`2` usage error.

## Profiles

| Profile | Shape |
|---|---|
| `claude-artifact` | fragment — **no** doctype/html/head/body (the publish harness supplies them) |
| `standalone` | full document — doctype, `lang`, charset, viewport, title |
| `markdown` | `.md`; filename is the identity; mermaid renders natively |

`--profile auto` (the default) infers from extension and wrapper presence.

## What the rules cover

`AX*` portability and self-containment · `AD1xx` the three-state theme contract ·
`AD2xx` page identity · `AD3xx` layout and robustness · `AD4xx` AI-cliché
detection · `AS5xx` inline SVG diagrams.

Run `rules --json` rather than restating any of them. Only mechanically
unambiguous rules are `error`; everything heuristic ships `warn`/`info`, never
blocks, and has **unmeasured** precision — treat it as a prompt to look.

## The three states that break pages

An artifact renders on a ground the viewer paints. There are three states, not
two: explicit light (`data-theme="light"`), explicit dark (`data-theme="dark"`),
and **system — nothing stamped**, which is the default and the one most viewers
are in. Define the complete palette on bare `:root`, redefine only the tokens
under `@media (prefers-color-scheme: dark)` guarded as
`:root:not([data-theme="light"])`, redefine them again under
`:root[data-theme="dark"]`, and always paint `body { background }` from a token.
`AD102` and `AD105` are errors because getting this wrong renders one theme's text
on the other theme's ground.

## Diagrams

Inline SVG only for `standalone` — mermaid has no renderer off-viewer (`AX009`).
Use `viewBox` for sizing, `currentColor` for strokes and text, `<marker>` or
`<polygon>` for arrowheads, `role="img"` plus `aria-label` for the claim, and a
`<figure>`/`<figcaption>` around it. Label every arrow with the verb it performs.
Diagrams generated *from source* belong to the `diagram-intelligence` plugin, not
to hand-authoring.

## Portability limits

`window.claude.*` exists only inside the Claude artifact viewer; unguarded calls
throw everywhere else (`AX007`, escalated to `error` in `standalone`). Feature-detect
and design a static fallback. Downloads started by the page are blocked in the
artifact sandbox (`AX006`). Font CDNs and every other cross-host request are blocked
by CSP (`AX001`–`AX003`) — inline the asset or use a system stack.
