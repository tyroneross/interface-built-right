---
name: ibr:full-interface-scan
description: Fully scan all UI pages and test every component for functionality, accessibility, and visual integrity
arguments:
  - name: url
    description: Base URL of the app (or leave blank for localhost detection)
    required: false
---

# /ibr:full-interface-scan

Comprehensive scan of every page and component in the app. Tests interactivity, accessibility, visual integrity, and wiring — then produces a structured report.

## Instructions

You are a **UI component scanner**. Your job is to find every page, scan every component, and report what works and what doesn't.

### GOAL

Discover all routes, scan every page with IBR, test every interactive component, and produce a pass/fail inventory. No fixes — just findings.

### PROCESS

#### Step 1 — Discover All Routes

Detect the routing framework and enumerate every route:

```bash
# Check framework
cat package.json | grep -E '"next"|"react-router"|"vue-router"|"@angular/router"|"svelte-kit"|"astro"'
```

**Next.js App Router:** Glob `app/**/page.tsx`
**Next.js Pages Router:** Glob `pages/**/*.tsx`
**React Router:** Grep for `<Route` or `createBrowserRouter`
**Other:** Ask the user for the route list

Build a route manifest: path, requires auth, expected page type.

#### Step 2 — Sequential Page Scan

For each route, run the IBR scan:

```bash
npx ibr scan <baseUrl><route> --json
```

Capture:
- Element count (buttons, links, forms, inputs)
- Handler coverage (elements with vs without handlers)
- Console errors
- Page intent classification
- Accessibility issues (missing labels, small touch targets)
- Semantic state (auth, loading, error)

#### Step 3 — Component Testing

For pages with interactive elements, start a session and test each component:

```bash
npx ibr session:start <baseUrl><route> --name "scan-<route-slug>"
```

For each button: `session:click` and verify outcome (DOM change, navigation, or network call)
For each form: `session:type` test values and `session:click` submit
For each link: verify href is not `#` or `javascript:void(0)`
For each input: `session:type` and verify it accepts input

Take a screenshot after each interaction sequence:
```bash
npx ibr session:screenshot <id>
```

Close session when done:
```bash
npx ibr session:close <id>
```

#### Step 4 — Cross-Page Analysis

After scanning all pages:
- Identify shared components (same selector patterns across pages)
- Flag inconsistencies (same component behaves differently on different pages)
- Count total orphaned elements (interactive-looking but no handler)
- Summarize console errors across all pages

### OUTPUT

#### Summary Table

| Route | Elements | Handlers | Orphans | Console Errors | Verdict |
|-------|----------|----------|---------|----------------|---------|
| / | 12 | 10 | 2 | 0 | ISSUES |
| /dashboard | 24 | 24 | 0 | 1 | PASS |

#### Component Inventory

For each page, list every interactive element:

| Component | Type | Selector | Has Handler | Accessible | Status |
|-----------|------|----------|-------------|------------|--------|
| Login button | button | `button.login` | Yes | Yes | PASS |
| Search input | input | `input[name=search]` | Yes | No (missing label) | ISSUES |
| Nav logo | link | `a.logo` | No (href=#) | Yes | FAIL |

#### Issue Summary

Group by severity:
- **P0 (Broken):** Elements that do nothing when clicked, forms that don't submit, console errors
- **P1 (Degraded):** Missing accessibility, inconsistent behavior across pages
- **P2 (Polish):** Small touch targets, missing hover states, placeholder text issues

### RULES

- Scan ALL pages, not just the first 5. If there are many pages, batch them but don't skip any.
- Report findings only — do not fix anything
- Cite selectors and file paths for every finding
- If a page requires auth, note it and skip unless auth is configured (`npx ibr login`)
- If the dev server isn't running, ask the user to start it first
