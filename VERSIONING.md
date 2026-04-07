# IBR — Versioning & Source of Truth

## Current

- **Version:** 0.8.0
- **Source of truth:** Local dev (`~/Desktop/git-folder/interface-built-right`)
- **Also available at:**
  - GitHub: https://github.com/tyroneross/interface-built-right
  - npm: `@tyroneross/interface-built-right`
- **Claude Code cache mirror:** `~/.claude/plugins/cache/interface-built-right/ibr/0.8.0/`

## Key changes in 0.8.0

- **Design system extension:** Full front-end design workflow — Calm Precision principle enforcement, configurable design tokens, component patterns
- 6 Calm Precision rules (gestalt, signal-noise, fitts, hick, content-chrome, cognitive-load) with core/stylistic severity split
- Extended token validation (fontWeights, lineHeights, spacing arrays) via validator registry
- `design_system` MCP tool (init/status/validate) + `.ibr/design-system.json` config
- 3 new skills (design-guidance, design-system, component-patterns) + 2 modified (design-implementation, design-validation)
- 7 component pattern templates (card, nav, form, dashboard, modal, table, list)
- Refactored `aggregateIssues()` → IssueCollector, `tokens.ts` → validator registry
- Global memory: `promoteToGlobal()` / `seedFromGlobal()` for cross-project preference flow
- All 421 tests pass (39 new); typecheck clean

See commit `80653a6` for full diff.

## Where to look for the latest version

| Source | Location | Notes |
|---|---|---|
| **Authoritative** | `~/Desktop/git-folder/interface-built-right/.claude-plugin/plugin.json` | Local dev — canonical, always newest |
| GitHub | github.com/tyroneross/interface-built-right | Public mirror, tracks local |
| npm | `@tyroneross/interface-built-right` | Published releases (may lag) |
| Cache mirror | `~/.claude/plugins/cache/interface-built-right/ibr/<version>/` | What Claude Code actually loads at runtime — cross-check against registry |

When "latest" is ambiguous, trust **local dev** first, then cross-check the registry at `~/.claude/plugins/installed_plugins.json`.

## Release discipline (enforce before committing a version bump)

1. Bump `version` in `.claude-plugin/plugin.json`
2. Update the version stamp in `CLAUDE.md` (line 1 HTML comment)
3. Update this file's `Current` section + add an entry to `Version history` below
4. Delete older cache entries: `rm -rf ~/.claude/plugins/cache/interface-built-right/ibr/<old-version>/`
5. Back up, then update `~/.claude/plugins/installed_plugins.json` → `installPath` + `version` for every entry of this plugin
6. Run `/reload-plugins` in Claude Code
7. Commit `plugin.json`, `CLAUDE.md`, `VERSIONING.md` together in a single commit

**Never leave two cached versions side-by-side** — Claude Code's resolver is not guaranteed to pick the newest. This bit us on 2026-04-04 when cached `0.4.9` kept loading despite `0.7.0` being the intended version; the loader picked whichever was alphabetically/mtime-first, not the one the registry recorded.

## Version history

- **0.8.0** (2026-04-07): Design system extension — Calm Precision enforcement, tokens, patterns, global memory. Commit `80653a6`.
- **0.7.0** (2026-04-04): Context optimization, auto-verify hooks, patience mode, new skills. Commit `07e0a82`.
- **0.4.9** (prior): Pre-optimization baseline. Cached directory deleted 2026-04-04 during drift cleanup.
