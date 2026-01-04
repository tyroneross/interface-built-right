---
description: Complete UI/UX workflow audit - verify interactions are wired, APIs exist, and UI matches specs
---

# /ibr:ui-audit

Full product-quality audit of an app's user workflows. Verifies UI interactions are complete, wired correctly (UI -> state -> API -> persistence -> UI feedback), and flags orphaned/misleading UI elements.

## Instructions

You are a **Product-quality auditor + full-stack workflow tracer**.

### GOAL

Audit the app's top user workflows end-to-end, using the README/docs as the source of truth. Verify UI interactions are complete, wired correctly (UI -> state -> API -> persistence -> UI feedback), and flag orphaned/misleading UI elements. If the app has few pages, audit all. If it has many, start with the first 5 pages and ask how many to include next.

### SCOPE

- Use README/docs to infer intended workflows and pages.
- Validate the actual implementation in code (routes/components + API handlers + persistence).
- Prioritize user-critical workflows over edge cases.

### PROCESS (STRICT)

#### 1) Discover Intended Workflows + Pages (Docs-first)

Parse README (and /docs if present) to extract:
- "happy path" workflows (verbs like create, upload, generate, save, export, search, settings, etc.)
- referenced pages/routes/screens

Build a "Workflow -> Pages" map.

#### 2) Enumerate Actual Pages/Routes (Code-first)

Detect routing framework and list routes/screens from code.

Create a final "Pages List" sorted by likely importance:
- pages mentioned in README/docs first
- then remaining core pages (dashboard, list/detail, settings, onboarding)

#### 3) Decide Audit Set

- If total pages/routes <= 5: audit all.
- If > 5:
  - audit the top 5 pages first (based on README + core flows)
  - then STOP and ask the user: "I found N pages. How many should I audit next (e.g., 10 / all / only core flows)?"
  - Do not proceed beyond 5 without the user's number.

#### 4) For Each Page in the Audit Set, perform:

**A) Selectable UI Inventory**

Enumerate all interactive elements:
- buttons, links, tabs, dropdowns, toggles, inputs, cards/rows that look clickable, menus, pagination

For each element: intended action (verb + object) + expected outcome.

**B) Wiring & Flow Trace**

Trace from UI handler -> state update -> API call(s) -> persistence -> UI confirmation.

If AI/LLM involved, include the trigger and expected outputs.

**C) Orphan / Gap Detection**

Flag:
- UI that looks clickable but has no handler
- handler exists but no visible UI feedback
- UI exists but no API/persistence when expected
- API exists but no reachable UI path
- missing empty/loading/error states that block usability

### OUTPUT (REQUIRED)

#### A) Top Workflows (from README/docs)

| Workflow | Pages Involved | Expected Outcomes |
|----------|----------------|-------------------|

#### B) Pages Audited (max 5 unless total <= 5)

List pages with URLs/routes.

#### C) Per-Page Audit Table

| Element | Interaction | Expected | Actual | API/LLM | Status | Notes |
|---------|-------------|----------|--------|---------|--------|-------|

Status values: PASS / FAIL / UNCERTAIN

#### D) Orphaned/Gaps Summary (prioritized P0/P1/P2)

| Priority | Issue | Location | Fix |
|----------|-------|----------|-----|

### RULES

- Evidence required: cite file paths/symbols for key findings.
- Do not invent intent - if unclear, mark UNCERTAIN and specify what's needed to decide.
- Keep fixes minimal and workflow-focused.

### ACCEPTANCE CRITERIA

- Top workflows from README are mapped to real pages/components
- First audit set (<=5 pages) has full interaction inventory + wiring trace
- Orphans and gaps are clearly identified with minimal fixes
- If >5 pages, you ask the user how many to audit next before continuing

## CLI Integration

For pages that are running, you can use IBR's audit command to scan for issues:

```bash
# Basic audit with minimal rules
npx ibr audit <url> --rules minimal

# Audit with API cross-reference (finds orphan endpoints)
npx ibr audit <url> --rules minimal --check-apis .

# Output as JSON for programmatic use
npx ibr audit <url> --rules minimal --json
```

## START NOW

1. Parse README for workflows and referenced pages.
2. Enumerate routes from code (detect routing framework).
3. Determine whether total pages <= 5; if not, select top 5 and begin the audit.
