---
name: mockup-gallery-bridge
description: Use when /ibr:build detects .mockup-gallery/ or IBR needs to tie a build to a gallery-selected mockup. Reads ratings/selections, writes implementation completion. Filesystem only.
version: 0.1.0
user-invocable: false
---

# Mockup Gallery Bridge

Read/write contract between IBR and the mockup-gallery plugin's project data.

## Primitives

- `src/mockup-gallery/reader.ts` → `readGallery({ projectDir })`
- `src/mockup-gallery/writer.ts` → `recordImplementation({ projectDir, topic, mockup, commit, passed })`

## When to Activate

- `/ibr:build` preamble detects `.mockup-gallery/` in the project
- User mentions a mockup selection during brainstorm
- `/ibr:match` needs a validation-target reference from gallery selections
- IBR iteration completes cleanly and has a matched gallery mockup

## Read behavior

- Returns `{present, ratings, selected, warnings}`
- Malformed JSON is recovered with a warning, never throws
- If gallery dir missing, returns `present: false` silently

## Write behavior

- `recordImplementation` appends to `implemented.json` with `{topic, mockup, commit, passed, at}`
- Creates file if absent, preserves prior entries
- Only called on clean build completion with a matched gallery mockup

## Integration notes

- Never spawns `npx mockup-gallery`. User runs gallery separately.
- Session-scoped data (`.mockup-gallery/sessions/<current>/`) not read in v0.9.0 — follow-up.
