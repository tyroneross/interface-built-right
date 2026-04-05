---
name: auto-verify
description: Use when configuring or troubleshooting IBR's automatic before/after scan workflow — captures a baseline before every UI file edit, re-scans after, and reports verdict. Triggers on "enable auto verify", "turn on auto scan", "configure auto-verify", or questions about the pre/post-change hooks.
---

# IBR Auto-Verify Workflow

IBR's auto-verify workflow automatically captures a baseline before every UI file edit, waits for HMR to apply the change, re-scans, and reports what changed. This runs via Claude Code hooks — no manual commands needed once configured.

## What It Does

For every Write|Edit on a UI file (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`):

1. **Pre-edit** — silently captures a baseline scan + screenshot
2. **Edit happens** — Claude makes the change
3. **Post-edit** — waits for HMR, re-scans, diffs against baseline, outputs a verdict block

Claude reads the verdict and decides whether the edit achieved the intended result, or if it needs a follow-up fix.

## Configuration (Required — Opt In)

Create `.ibr/config.json` in your project root:

```json
{
  "autoVerify": true,
  "projectRoot": "/absolute/path/to/project",
  "devServerUrl": "http://localhost:3000"
}
```

**All three fields are required** for the workflow to fire:

| Field | Purpose |
|-------|---------|
| `autoVerify` | Master switch. `false` (default) = workflow never runs |
| `projectRoot` | Absolute path to the project. Hook only fires if `$PWD` is under this path |
| `devServerUrl` | URL the hook scans. Skip port auto-detection — use this URL directly |

**Default is off** — any project without this file or without `autoVerify: true` has zero overhead and zero hook noise.

## Gate Logic (What Prevents Noise)

The pre-change hook has 5 gates. If any fail, the hook exits silently and no scan runs:

1. **UI file extension** — only `.tsx/.jsx/.vue/.svelte/.css/.scss/.html`
2. **Opt-in flag** — `.ibr/config.json` must exist with `autoVerify: true`
3. **Project boundary** — `$PWD` must be under `config.projectRoot` (prevents scanning project A while editing project B)
4. **Rate limit** — 10s minimum between cycles (batches rapid edits)
5. **Dev server reachable** — `config.devServerUrl` must respond (or parallel port probe finds one)

## Verdict Output

The post-change hook outputs one of three formats to stdout (which Claude reads):

**Clean pass (condensed):**
```
IBR: ✓ PASS (+2 elements)
```
One line. Minimal context cost. Used when scan verdict is PASS and zero issues detected.

**Review block (when scan passes but issues exist):**
```
IBR Post-Change Verification
File: src/app/page.tsx
URL:  http://localhost:3000

Before: PASS (42 elements, 0 issues)
After:  PASS (44 elements, 2 issues)
Elements: +2 added

Issues:
  [warning] button.submit contrast ratio 3.2:1 (need 4.5:1)
  [warning] h2.section-title missing aria-level

Verdict: REVIEW — scan passed but 2 issue(s) found.
```

**Needs-fix block (when scan fails):**
```
IBR Post-Change Verification
File: src/app/page.tsx
URL:  http://localhost:3000

Before: PASS (42 elements, 0 issues)
After:  FAIL (40 elements, 3 issues)
Elements: -2 removed

Issues:
  [error] button.submit has no click handler (hasOnClick: false)
  [error] form missing action attribute
  [warning] div.success-message contrast 3.2:1

Console errors:
  Uncaught TypeError: Cannot read property 'onClick' of undefined

Verdict: NEEDS_FIX — address issues above before proceeding.
```

## How to Enable

```bash
# 1. Create .ibr directory if needed
mkdir -p .ibr

# 2. Write config file (adjust paths and URL)
cat > .ibr/config.json <<EOF
{
  "autoVerify": true,
  "projectRoot": "$(pwd)",
  "devServerUrl": "http://localhost:3000"
}
EOF

# 3. Start your dev server
npm run dev  # or whatever your project uses

# 4. Make a UI edit — the hooks will fire automatically
```

## How to Disable

Set `autoVerify: false` in `.ibr/config.json`, or delete the file entirely.

## Troubleshooting

**No verdict appears after edit:**
- Check `.ibr/config.json` has `autoVerify: true` and correct `projectRoot`
- Check dev server is actually running at `devServerUrl`
- Check `$PWD` is under `projectRoot` (the hook uses absolute path matching)
- Check the edited file has a UI extension

**"Post-change scan failed — dev server may be down":**
- Dev server crashed during or after the edit
- HMR took longer than the 10s wait — increase `MAX_WAIT` in `hooks/ibr-post-change.sh` if needed

**Verdict refers to the wrong URL:**
- Remove `devServerUrl` from config to trigger port auto-detection
- Or explicitly set it to the URL you want scanned

**Hooks firing on unrelated project:**
- The `projectRoot` gate should prevent this. Verify the config file is in the project you actually want scanned, not a parent directory.

## Files Involved

- `hooks/ibr-pre-change.sh` — PreToolUse hook, captures baseline
- `hooks/ibr-post-change.sh` — PostToolUse hook, scans and reports verdict
- `hooks/hooks.json` — registers both hooks
- `.ibr/config.json` — per-project opt-in config (you create this)
- `.ibr/pre-change-state.json` — ephemeral state between pre and post hooks (auto-managed)
- `.ibr/pre-change-scan.json` — baseline scan data (auto-managed)
- `.ibr/post-change-scan.json` — post-edit scan data (auto-managed)
- `.ibr/autoscan-last-run` — rate limit timestamp (auto-managed)

Add `.ibr/` to `.gitignore`.
