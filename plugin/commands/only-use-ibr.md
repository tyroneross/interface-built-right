---
description: Enforce IBR-only for capture tasks. Blocks Playwright screenshot/snapshot tools. Playwright interaction tools remain available.
---

# /only-use-ibr

Enforce IBR-only mode for capture tasks.

## What This Does

Blocks Playwright **capture** tools and requires IBR instead.
Playwright **interaction** tools remain fully available.

### If argument is "on", "enable", or no argument:

```bash
mkdir -p .claude
cat > .claude/ibr.local.md << 'EOF'
---
mode: only
---

# IBR Settings

Mode: **only** (enforced)

Playwright capture tools are BLOCKED:
- browser_take_screenshot → Use `npx ibr start <url>`
- browser_snapshot → Use IBR web UI extraction

Playwright interaction tools REMAIN AVAILABLE:
- browser_navigate (for interaction flows)
- browser_click
- browser_type
- browser_fill_form
- browser_select_option
- browser_hover
- browser_press_key
- browser_handle_dialog
- browser_evaluate

To return to soft preference: `/prefer-ibr`
EOF
```

Report:
```
IBR Mode: ONLY (enforced)

BLOCKED (use IBR instead):
  ✗ browser_take_screenshot → npx ibr start <url>
  ✗ browser_snapshot → IBR web UI extraction

STILL AVAILABLE (IBR can't do these):
  ✓ browser_navigate (for flows)
  ✓ browser_click
  ✓ browser_type
  ✓ browser_fill_form
  ✓ browser_select_option
  ✓ browser_hover
  ✓ browser_press_key
  ✓ browser_handle_dialog
  ✓ browser_evaluate

To return to soft preference: /prefer-ibr
```

### If argument is "off" or "disable":

Switch back to prefer mode:

```bash
mkdir -p .claude
cat > .claude/ibr.local.md << 'EOF'
---
mode: prefer
---

# IBR Settings

Mode: **prefer** (soft preference)

Claude will prefer IBR for capture tasks but Playwright remains available.

To enforce IBR-only: `/only-use-ibr`
EOF
```

Report: "Switched to **prefer** mode. Playwright capture tools are now available."

## Why This Exists

Enforces consistent use of IBR for capture, ensuring:
- All screenshots go to `.ibr/sessions/`
- Metadata is captured with every screenshot
- Comparison workflow is available
- Reference images are properly managed

While still allowing Playwright for tasks IBR cannot perform (clicking, typing, forms, etc.).
