---
description: Enable soft IBR preference. Claude will prefer IBR for capture tasks but Playwright MCP remains available for all tasks.
---

# /prefer-ibr

Enable soft IBR preference mode (default behavior).

## What This Does

Sets IBR as the **preferred** tool for UI capture, but does NOT block Playwright.

```bash
mkdir -p .claude
cat > .claude/ibr.local.md << 'EOF'
---
mode: prefer
---

# IBR Settings

Mode: **prefer** (soft preference)

Claude will prefer IBR for capture tasks:
- Screenshots → `npx ibr start <url>`
- HTML extraction → IBR web UI
- Visual comparison → `npx ibr check`

Playwright MCP remains fully available for:
- Any task IBR can't perform
- Interactive testing (clicking, typing, forms)
- Multi-step user flows
- When explicitly requested

To enforce IBR-only for capture: `/only-use-ibr`
EOF
```

## Report

```
IBR Preference Mode: PREFER (soft)

Claude will prefer IBR for capture tasks but Playwright remains available.

IBR handles:
  ✓ Screenshots     → npx ibr start <url>
  ✓ HTML extraction → IBR web UI / extract API
  ✓ Comparison      → npx ibr check

Playwright handles:
  ✓ Clicking, typing, form filling
  ✓ Multi-step flows
  ✓ JavaScript interaction
  ✓ Any task IBR can't do

To enforce IBR-only capture: /only-use-ibr
```

## IBR vs Playwright Capabilities

| Task | IBR | Playwright | Use |
|------|-----|------------|-----|
| Screenshot URL | Yes | Yes | **IBR** (managed sessions) |
| Extract HTML/CSS | Yes | Yes | **IBR** (richer data) |
| Visual comparison | Yes | No | **IBR** |
| Click elements | No | Yes | **Playwright** |
| Fill forms | No | Yes | **Playwright** |
| Type text | No | Yes | **Playwright** |
| Navigate flows | No | Yes | **Playwright** |
| Handle dialogs | No | Yes | **Playwright** |
| Execute JS | No | Yes | **Playwright** |
