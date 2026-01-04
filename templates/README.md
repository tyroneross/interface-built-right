# IBR Templates

Templates to make Claude Code automatically use IBR for UI verification.

## Quick Start

Copy one of these templates to your project's `.claude/CLAUDE.md`:

```bash
# Strong enforcement (recommended for UI-heavy projects)
cp templates/CLAUDE.md.strong .claude/CLAUDE.md

# Moderate (balanced)
cp templates/CLAUDE.md.moderate .claude/CLAUDE.md

# Minimal (awareness only)
cp templates/CLAUDE.md.minimal .claude/CLAUDE.md
```

## Template Comparison

| Template | Enforcement | Best For |
|----------|-------------|----------|
| **Strong** | Mandatory verification, trigger words, completion gate | UI-heavy apps, teams requiring verification |
| **Moderate** | Recommended workflow, quick reference | General projects with some UI work |
| **Minimal** | Commands only, no enforcement | Projects where IBR is optional |

## Hooks

For stronger enforcement, install the IBR hooks:

```bash
# Copy hooks to your project
cp -r plugin/hooks/* .claude/hooks/
```

### Available Hooks

| Hook | Event | Effect |
|------|-------|--------|
| `verify-ui-changes.md` | PreToolUse (Edit) | Reminds to run IBR after UI file edits |
| `require-ibr-verification.md` | Stop | Blocks completion until IBR is run for UI work |
| `prefer-ibr.md` | PreToolUse | Prefers IBR over Playwright for screenshots |

## Effectiveness

| Configuration | Expected IBR Usage |
|---------------|-------------------|
| Minimal template only | ~40% |
| Moderate template | ~60% |
| Strong template | ~75% |
| Strong + hooks | ~90%+ |

## Customization

Edit the templates to:
- Add project-specific trigger words
- Adjust which file patterns require verification
- Change severity levels (warning vs blocking)
