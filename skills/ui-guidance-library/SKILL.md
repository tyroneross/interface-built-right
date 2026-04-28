---
name: ui-guidance-library
description: Use when /ibr:build asks the user to pick a template or to show available UI guidance. Indexes central + project-local templates and snapshots a pick to .ibr/ui-guidance/active.md.
version: 0.1.0
user-invocable: false
---

# UI Guidance Library

Indexes central and project-local UI Guidance templates and snapshots a selection to the project's active template.

## Primitives

- `src/ui-guidance/library.ts` → `indexTemplates({ centralDir, projectDir })`
- `src/ui-guidance/snapshot.ts` → `snapshotTemplate({ sourcePath, projectDir })`
- `src/ui-guidance/promote.ts` → `promoteDraft({ slug, projectDir, centralDir, confirm })`

## Defaults

- Central dir: `/Users/tyroneross/Desktop/git-folder/UI Guidance`
- Project dir: `<cwd>/.ibr/ui-guidance`
- Drafts subdir: `<projectDir>/drafts`

## When to Activate

- `/ibr:build` is selecting a UI template
- User asks "what UI templates are available"
- User asks to snapshot or pick a template for the current project
- Before `ibr:design-system` needs tokens derived from a template

## Usage pattern

1. Call `indexTemplates` — list templates with `source: central|project`.
2. User picks by name.
3. Call `snapshotTemplate` with the picked template's path → writes `active.md`.
4. Downstream `ibr:design-system` reads `active.md` for tokens.
