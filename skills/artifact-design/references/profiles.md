# Profiles: what each one guarantees

One source, three shapes. `artifact_build.py` moves between them without rewriting
authored content.

## `claude-artifact` — the publish fragment

What Claude's `Artifact` tool consumes. The harness wraps the file in
`<!doctype html>…<head>…</head><body>` at publish time and adds a minimal CSS
reset, so the file must **not** carry a skeleton of its own (`AX004`).

Write the page content directly: `<title>`, `<style>`, then the body markup.

The publish call carries three things the file cannot: `favicon` (one or two
emoji, required), a one-sentence `description` that becomes the gallery subtitle,
and `capabilities`. Keep `favicon` **stable** across redeploys — viewers find the
tab by its icon.

## `standalone` — an openable document

A real HTML file. Double-click it, attach it to an email, drop it in an S3 bucket.
`AX004` requires all four of:

| Requirement | Why |
|---|---|
| `<!doctype html>` | quirks mode otherwise; layout silently differs |
| `lang` on `<html>` | screen-reader pronunciation, hyphenation |
| `<meta charset>` | mojibake on any non-ASCII character |
| `<meta name="viewport">` | mobile renders at desktop width and zooms out |

`wrap` supplies all four plus the title, and optionally a favicon and a theme
toggle. Mermaid does not survive this profile — there is no renderer (`AX009`);
convert diagrams to inline SVG.

## `markdown` — the `.md` publish

Keeps its **filename** as its identity: no `<title>`, so the naming judgment moves
to the filename. Mermaid fences render natively. Only the portability and identity
subset of rules applies.

Choose it because the destination is Markdown-native, never because it is faster.

## What `wrap` injects, and what `unwrap` removes

Everything generated carries `data-artifact-build="<kind>"`, and `unwrap` removes
exactly those nodes — authored content is never rewritten. Round-trip fidelity is
asserted in `scripts/test_artifact_build.py`.

| Kind | Node | Flag |
|---|---|---|
| `reset` | `<style>` — the minimal reset the Artifact harness also applies | on by default; `--no-reset` |
| `favicon` | `<link rel="icon">` with the emoji as an inline SVG data URI | `--favicon 🌊` |
| `theme-toggle` | `<style>` + pre-paint `<script>` + a `<button>` | `--theme-toggle` |

```bash
python3 scripts/artifact_build.py wrap   frag.html -o page.html --favicon 🌊 --check
python3 scripts/artifact_build.py unwrap page.html -o frag.html --check
python3 scripts/artifact_build.py info   page.html --json
```

`--check` runs `artifact_lint.py` against the result in the target profile and
exits non-zero on any error, so a conversion cannot quietly produce a broken page.

## Neither host gives you page padding

The reset zeroes `body` margin and no host adds padding back, so a fragment that
relies on ambient page chrome renders flush to the viewport edge in *both*
profiles — verified by rendering a wrapped page from `file://`. No rule catches
this; it looks fine in a narrow preview and wrong at full width.

Own the page frame in the fragment itself:

```css
body { padding: clamp(1.5rem, 5vw, 4rem); }
.prose { max-width: 65ch; margin-inline: auto; }
```

`max-width` alone is not enough — without `margin-inline: auto` the column pins to
the left edge on a wide screen. The `new` scaffold sets both.

## Choosing

Publishing through Claude's Artifact tool → author as `claude-artifact`, `wrap`
only when someone also needs a file. Shipping a file to someone who does not use
Claude → author `standalone`, `unwrap` when you also want to publish. Same source
either way; never maintain two.
