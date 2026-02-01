---
name: visual-testing
description: Visual regression testing and UI verification using IBR. Use when making UI changes, verifying frontend work, capturing screenshots, or comparing visual states. Automatically captures baselines before changes and compares after.
---

# Visual Testing with IBR

When working on UI files (.tsx, .jsx, .vue, .svelte, .css, .scss), use IBR for visual verification.

## Workflow

1. **Before UI changes**: Capture baseline
   ```bash
   npx ibr start <url> --name "feature-name"
   ```

2. **After UI changes**: Compare against baseline
   ```bash
   npx ibr check
   ```

3. **Interpret verdicts**:
   - MATCH: No visual changes
   - EXPECTED_CHANGE: Intentional changes detected
   - UNEXPECTED_CHANGE: Something changed unexpectedly — investigate
   - LAYOUT_BROKEN: Major structural issue — fix immediately

## For Interactive Pages

Use session mode for pages requiring user interaction:

```bash
npx ibr session:start <url> --name "test-name"
npx ibr session:type <id> "input[name=search]" "query"
npx ibr session:click <id> "button[type=submit]"
npx ibr session:screenshot <id>
```

## Key Commands

| Task | Command |
|------|---------|
| Capture baseline | `npx ibr start <url> --name "name"` |
| Compare changes | `npx ibr check` |
| List sessions | `npx ibr list` |
| Update baseline | `npx ibr update` |
| Web dashboard | `npx ibr serve` |
| Interactive session | `npx ibr session:start <url>` |

## When to Use

- Modifying UI components
- Changing CSS/styling
- Updating layouts or page structure
- Before PR review on frontend changes

## When NOT to Use

- Backend-only changes
- Config/documentation updates
- Type-only changes
