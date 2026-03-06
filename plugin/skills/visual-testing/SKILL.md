---
name: design-validation
description: Design validation and UI verification using IBR. Use when building UI from user descriptions, verifying frontend implementation matches intent, or checking CSS, handlers, and accessibility. Scans live pages and returns structured data.
---

# Design Validation with IBR

When working on UI, use IBR to validate that implementation matches what the user described.

## Primary Workflow: Validate Against Intent

1. **After building UI changes**: Scan to validate
   ```bash
   npx ibr scan <url> --json
   ```

2. **Check scan output against user's description**:
   - User said "blue buttons" → check `computedStyles.backgroundColor` on buttons
   - User said "16px font" → check `computedStyles.fontSize`
   - User said "working search" → check `interactive.hasOnClick: true`
   - User said "accessible" → check `a11y.ariaLabel` present

3. **Fix mismatches and re-scan** until implementation matches intent

## Store Design Specs

When user states persistent preferences:

```bash
npx ibr memory add "Primary buttons are blue" --property background-color --value "#3b82f6"
npx ibr memory add "Body font is Inter" --property font-family --value "Inter"
```

Memory preferences validate automatically on every scan.

## Regression Workflow

When modifying existing UI, capture before and compare after:

```bash
npx ibr start <url> --name "feature-name"   # baseline before
# ... make changes ...
npx ibr check                                # compare after
```

Verdicts: `MATCH`, `EXPECTED_CHANGE`, `UNEXPECTED_CHANGE`, `LAYOUT_BROKEN`

## Interactive Pages

For pages requiring user interaction:

```bash
npx ibr session:start <url> --name "test-name"
npx ibr session:type <id> "input[name=search]" "query"
npx ibr session:click <id> "button[type=submit]"
npx ibr session:wait <id> ".results"
npx ibr session:screenshot <id>
```

## Key Commands

| Task | Command |
|------|---------|
| Validate UI | `npx ibr scan <url> --json` |
| Store design spec | `npx ibr memory add "<spec>"` |
| Capture baseline | `npx ibr start <url> --name "name"` |
| Compare changes | `npx ibr check` |
| List sessions | `npx ibr list` |
| Web dashboard | `npx ibr serve` |

## Native iOS/watchOS Validation

For Swift/SwiftUI projects, use native IBR tools to validate simulator output:

```bash
# List available simulators
npx ibr native:devices

# Scan running simulator
npx ibr native:scan "Apple Watch"

# Baseline + compare
npx ibr native:start "iPhone 16" --name "timer-screen"
# ... make changes ...
npx ibr native:check
```

Native scan checks:
- Touch targets (44pt minimum, always enforced)
- Accessibility labels on interactive elements
- watchOS: max 7 interactive elements per screen
- watchOS: no horizontal overflow beyond viewport

MCP tools: `native_scan`, `native_snapshot`, `native_compare`, `native_devices`

## When to Use

- Building UI from user descriptions
- Verifying CSS, layout, fonts, colors match specs
- Checking interactive elements are wired up
- Validating accessibility requirements
- Regression checking after modifying existing UI
- **Native iOS/watchOS**: validating simulator output after `.swift` changes

## When NOT to Use

- Backend-only changes
- Config/documentation updates
- Type-only changes
