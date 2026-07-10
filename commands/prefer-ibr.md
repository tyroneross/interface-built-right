---
description: Enable soft IBR preference. Claude will prefer IBR for UI validation, capture, and semantic interactions while Playwright MCP remains available for unsupported browser automation.
---

# /prefer-ibr

Enable soft IBR preference mode (default behavior).

## What This Does

Sets IBR as the **preferred** tool for UI validation, capture, and semantic interactions, but does NOT block Playwright.

```bash
mkdir -p .claude
cat > .claude/ibr.local.md << 'EOF'
---
mode: prefer
---

# IBR Settings

Mode: **prefer** (soft preference)

Claude will prefer IBR for UI validation, capture, and semantic interactions:
- Design validation → `npx ibr scan <url> --json`
- Screenshots → `npx ibr start <url>`
- HTML extraction → IBR web UI
- Regression comparison → `npx ibr check`
- Semantic interaction → `npx ibr interact <url> --action click --target "Submit"`
- Interaction assertions → `npx ibr test-interact <url> --action "click:button:Submit" --expect "visible:Success"`

Playwright MCP remains fully available for:
- Unsupported interaction edges
- Arbitrary JavaScript execution
- Browser automation outside IBR's semantic element model
- When explicitly requested

To enforce IBR-only for capture: `/only-use-ibr`
EOF
```

## Report

```
IBR Preference Mode: PREFER (soft)

Claude will prefer IBR for UI validation, capture, and semantic interactions but Playwright remains available.

IBR handles:
  ✓ Design validation → npx ibr scan <url> --json
  ✓ Screenshots       → npx ibr start <url>
  ✓ HTML extraction   → IBR web UI / extract API
  ✓ Comparison        → npx ibr check
  ✓ Click/type/fill    → npx ibr interact <url> --action ...
  ✓ Assertions         → npx ibr test-interact <url> --action ... --expect ...

Playwright handles:
  ✓ Arbitrary JavaScript execution
  ✓ Unsupported browser/dialog edge cases
  ✓ Automation outside semantic element targeting
  ✓ Any task explicitly requested in Playwright

To enforce IBR-only capture: /only-use-ibr
```

## IBR vs Playwright Capabilities

| Task | IBR | Playwright | Use |
|------|-----|------------|-----|
| Validate CSS/layout | Yes | No | **IBR** (structured scan data) |
| Screenshot URL | Yes | Yes | **IBR** (managed sessions) |
| Extract HTML/CSS | Yes | Yes | **IBR** (richer data) |
| Regression comparison | Yes | No | **IBR** |
| Handler detection | Yes | No | **IBR** |
| Click elements | Yes | Yes | **IBR** for semantic targets |
| Fill forms | Yes | Yes | **IBR** for semantic targets |
| Type text | Yes | Yes | **IBR** for semantic targets |
| Navigate flows | Basic semantic flows | Yes | **IBR** first; Playwright for complex e2e |
| Handle dialogs | No | Yes | **Playwright** |
| Execute JS | No | Yes | **Playwright** |
