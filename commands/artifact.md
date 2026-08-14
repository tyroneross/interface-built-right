---
description: Author, check, and port single-file self-contained HTML artifacts. Works inside Claude and as a plain CLI any agent can run.
argument-hint: new <title> | check <path> | wrap <path> | unwrap <path> | info <path> | rules
---

# /ibr:artifact

One file that carries its own styles, scripts, fonts, and images — openable from
`file://`, publishable through Claude's Artifact tool, checkable by any agent.

Scripts live at `${CLAUDE_PLUGIN_ROOT}/scripts/`. On any other host use the repo
root. Both are stdlib-only Python 3 — no install step, no network.

## Subcommands

### new <title>

Scaffold a page that already satisfies the three-state theme contract and lints
clean, so design starts from a correct page rather than a blank file.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/artifact_build.py" new \
    --title "<title>" --profile standalone --favicon 🌊 --theme-toggle \
    -o page.html --check
```

Then load `ibr:artifact-design` and design over it.

### check <path>

Run the 39-rule contract. Accepts files or directories.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/artifact_lint.py" check <path> --min-severity warn
```

Report findings grouped by severity. `error` findings are mechanically
unambiguous — fix them. `warn`/`info` findings marked *heuristic* are prompts to
look, not verdicts; their precision is unmeasured, so judge each one rather than
mass-applying fixes.

### wrap <path> / unwrap <path>

Move between profiles. `wrap` turns a Claude publish fragment into an openable
document; `unwrap` turns it back. Round-trip is lossless — everything injected
carries `data-artifact-build` and is removed on the way out.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/artifact_build.py" wrap   <path> -o page.html --favicon 🌊 --check
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/artifact_build.py" unwrap <path> -o frag.html --check
```

### embed-font <path>

Turn a `.woff2`/`.woff`/`.otf`/`.ttf` into a self-contained `@font-face` block —
the fix for `AX003`, since the CSP blocks every font CDN.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/artifact_build.py" embed-font <path> --family "<name>"
```

Format is sniffed from magic bytes, not the extension. Warns past ~400KB, where a
face is worth subsetting to the glyphs the page actually uses.

### info <path>

Profile, title, style/script counts, injected nodes, and every external URL.

### rules

Print the rule contract. Use `--json` when an agent consumes it; that output is the
single source of truth for rule IDs, severities, and profile scope — never restate
the rules from memory.

## Checking on save (opt-in)

Off by default. Add to the project's `.ibrrc.json` to have `.html` writes checked
automatically — advisory, never blocking, silent on a clean page:

```json
{ "artifactLint": { "enabled": true, "minSeverity": "warn" } }
```

Leave it off where `.html` means templates or SSR output rather than self-contained
pages: `AX004` and `AD105` are correct about an artifact and meaningless about a
Jinja template.

## Routing

| Situation | Load |
|---|---|
| designing the page | `ibr:artifact-design` |
| drawing a diagram in it | `ibr:artifact-diagramming` |
| it has charts or KPIs | `ibr:data-visualization` |
| diagram generated from source, not argued | the `diagram-intelligence` plugin |
| verifying it renders in a real browser | `/ibr:screenshot` or `/ibr:scan` |

## Notes

- Publishing through Claude's `Artifact` tool still needs the built-in
  `artifact-design` skill for transport concerns (favicon parameter, gallery
  description, runtime capabilities). This lane owns the portable half.
- `window.claude.*` does not exist outside the Claude viewer. `AX007` flags
  unguarded calls, and escalates to `error` in the `standalone` profile.
