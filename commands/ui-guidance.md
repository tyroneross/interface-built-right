---
description: List, show, or promote IBR UI Guidance templates. Central library at `/Users/tyroneross/Desktop/git-folder/UI Guidance`; project drafts at `.ibr/ui-guidance/drafts/`.
argument-hint: list | show <name> | promote <slug> [--confirm]
---

# /ibr:ui-guidance

Manage UI Guidance templates.

## Subcommands

### list

Calls `ui-guidance-library` skill. Prints template table:

| Name | Source | Summary |
|---|---|---|

Sources: `central` (shared library), `project` (`.ibr/ui-guidance/drafts/`).

### show <name>

Prints the full template content from its resolved path.

### promote <slug>

Calls `src/ui-guidance/promote.ts → promoteDraft`.

- Without `--confirm`: dry-run, prints what would move
- With `--confirm`: copies `.ibr/ui-guidance/drafts/<slug>.md` → `~/Desktop/git-folder/UI Guidance/<slug>.md`

Never auto-promotes.

## Examples

```
/ibr:ui-guidance list
/ibr:ui-guidance show aurora-glass
/ibr:ui-guidance promote my-new-template
/ibr:ui-guidance promote my-new-template --confirm
```
