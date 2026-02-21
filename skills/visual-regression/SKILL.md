---
name: visual-regression
description: Visual regression testing for UI changes. Use when making frontend changes, editing .tsx/.jsx/.vue/.svelte/.css files, redesigning components, or verifying UI work. Captures baseline screenshots before changes and compares pixel-by-pixel after to detect regressions.
metadata:
  author: tyroneross
  version: "0.4.9"
  argument-hint: <url>
---

# Visual Regression Testing with IBR

When working on UI files (.tsx, .jsx, .vue, .svelte, .css, .scss), use IBR to capture baselines before changes and compare after.

## Prerequisites

```bash
npm install @tyroneross/interface-built-right
```

## Workflow

**The key rule: baseline BEFORE changes, check AFTER changes.**

### 1. Before making UI changes — capture baseline

```bash
npx ibr start <url> --name "feature-name"
```

This launches a headless browser, navigates to the URL, waits for network idle, and saves a full-page screenshot as the baseline.

### 2. Make your code changes

Edit components, styling, layout — whatever the task requires.

### 3. After changes — compare against baseline

```bash
npx ibr check
```

### 4. Interpret the verdict

| Verdict | Meaning | Action |
|---------|---------|--------|
| `MATCH` | No visual changes | Done |
| `EXPECTED_CHANGE` | Changes look intentional | Review and continue |
| `UNEXPECTED_CHANGE` | Something changed that shouldn't have | Investigate |
| `LAYOUT_BROKEN` | Major structural issues | Fix before continuing |

### 5. Self-iterate on issues

If `UNEXPECTED_CHANGE` or `LAYOUT_BROKEN`:
- Analyze the diff report
- Make corrections
- Run `npx ibr check` again
- Repeat until `MATCH` or `EXPECTED_CHANGE`

### 6. Accept changes when correct

```bash
npx ibr update
```

## Commands

| Task | Command |
|------|---------|
| Capture baseline | `npx ibr start <url> --name "name"` |
| Compare changes | `npx ibr check` |
| Accept as new baseline | `npx ibr update` |
| List sessions | `npx ibr list` |
| Show pending | `npx ibr status` |
| Web dashboard | `npx ibr serve` |
| Clean old sessions | `npx ibr clean --older-than 7d` |

## Options

```bash
# Capture specific viewport
npx ibr start <url> --viewport mobile

# Wait for dynamic content
npx ibr start <url> --wait-for ".dashboard-loaded"

# Capture specific element
npx ibr start <url> --selector ".header"

# Full-page vs viewport only
npx ibr start <url> --no-full-page
```

Available viewports: `desktop`, `laptop`, `tablet`, `mobile`, `iphone-14`, `iphone-14-pro-max`

## Authenticated Pages

```bash
npx ibr login http://localhost:3000/login   # opens browser, log in manually
npx ibr start http://localhost:3000/dashboard  # captures with your auth
npx ibr logout                                 # clear saved auth
```

## When to Use

- Modifying UI components
- Changing CSS/styling
- Updating layouts or page structure
- Before PR review on frontend changes

## When NOT to Use

- Backend-only changes
- Config/documentation updates
- Type-only changes
