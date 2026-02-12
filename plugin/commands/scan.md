---
name: ibr:scan
description: Run a comprehensive end-to-end UI scan on a URL
arguments:
  - name: url
    description: URL to scan (or leave blank for localhost detection)
    required: false
---

# IBR End-to-End UI Scan

Run a comprehensive scan that combines all IBR analysis capabilities on a page.

## What This Scans

The scan checks **every layer** of a UI page:

| Layer | What's Checked | How |
|-------|---------------|-----|
| **Elements** | All interactive elements extracted with computed styles, bounds, handlers | `extractInteractiveElements()` |
| **Interactivity** | Buttons have handlers, links have real hrefs, forms have submit handlers | `testInteractivity()` |
| **Accessibility** | Elements have labels, touch targets meet minimums, keyboard accessible | Element audit |
| **Semantic** | Page intent classified, auth/loading/error states detected | `getSemanticOutput()` |
| **Console** | JavaScript errors and warnings captured during page load | Console listener |
| **Structure** | Orphan elements, placeholder links, disabled without visual cues | Rules engine |

## How to Run

```bash
# Scan a URL (comprehensive analysis)
npx ibr scan http://localhost:3000

# Scan with screenshot capture
npx ibr scan http://localhost:3000 --screenshot .ibr/scan.png

# Scan mobile viewport
npx ibr scan http://localhost:3000 --viewport mobile

# Wait for dynamic content before scanning
npx ibr scan http://localhost:3000 --wait-for ".dashboard-loaded"

# JSON output for programmatic use
npx ibr scan http://localhost:3000 --json
```

## Reading the Results

The scan returns a verdict:

- **PASS** — No errors, fewer than 5 warnings
- **ISSUES** — Some errors or many warnings; review needed
- **FAIL** — 3+ errors; something is broken

### Issue Categories

| Category | Examples |
|----------|---------|
| `interactivity` | Button without handler, form without submit, placeholder link |
| `accessibility` | Missing aria-label, small touch target, no keyboard access |
| `semantic` | Page in error state, loading stuck, unknown intent |
| `console` | JavaScript errors during page load |
| `structure` | Orphan elements, disabled without visual cues |

## Workflow: Scan Before and After Changes

```bash
# 1. Scan before making changes (understand current state)
npx ibr scan http://localhost:3000/dashboard --json > before.json

# 2. Make your UI changes
# ... edit components ...

# 3. Scan after changes (verify nothing broke)
npx ibr scan http://localhost:3000/dashboard --json > after.json

# 4. Compare scan results
# The decision tracker records what changed
```

## Workflow: Multi-Page Scan

For scanning multiple pages, run scans in sequence:

```bash
npx ibr scan http://localhost:3000/ --json
npx ibr scan http://localhost:3000/dashboard --json
npx ibr scan http://localhost:3000/settings --json
```

## Programmatic API

```typescript
import { scan, formatScanResult } from 'interface-built-right';

const result = await scan('http://localhost:3000/dashboard', {
  viewport: 'desktop',
  waitFor: '.content-loaded',
  screenshot: { path: '.ibr/scan.png' },
});

// Check result
if (result.verdict === 'FAIL') {
  console.error('UI scan failed:');
  for (const issue of result.issues) {
    console.error(`  [${issue.severity}] ${issue.description}`);
  }
}

// Access specific data
console.log('Page type:', result.semantic.pageIntent.intent);
console.log('Buttons:', result.interactivity.buttons.length);
console.log('Forms:', result.interactivity.forms.length);
console.log('Console errors:', result.console.errors.length);
```

## What Each Analysis Layer Returns

### Elements
- `elements.all[]` — Every interactive element with selector, tagName, bounds, computedStyles, handler detection
- `elements.audit` — Summary: totalElements, interactiveCount, withHandlers, withoutHandlers, issues

### Interactivity
- `interactivity.buttons[]` — Each button: type, text, hasHandler, isDisabled, formId
- `interactivity.links[]` — Each link: href, isPlaceholder, opensNewTab, isExternal
- `interactivity.forms[]` — Each form: fields, hasSubmitHandler, hasValidation, submitButton

### Semantic
- `semantic.pageIntent` — Page type (auth, form, listing, detail, dashboard, error, landing, empty)
- `semantic.state.auth` — Authenticated? username? confidence?
- `semantic.state.loading` — Loading? spinner/skeleton/progress?
- `semantic.state.errors` — Page errors visible?
- `semantic.availableActions[]` — What user can do next (login, search, submit, navigate)
- `semantic.recovery` — If page is broken, suggested recovery action

### Console
- `console.errors[]` — JavaScript errors captured during page load
- `console.warnings[]` — JavaScript warnings
