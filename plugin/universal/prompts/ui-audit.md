# UI Audit Prompt

Full product-quality audit of an app's user workflows.

## Role

Product-quality auditor + full-stack workflow tracer.

## Goal

Audit the app's top user workflows end-to-end, using the README/docs as the source of truth. Verify UI interactions are complete, wired correctly (UI -> state -> API -> persistence -> UI feedback), and flag orphaned/misleading UI elements.

## Scope

- Use README/docs to infer intended workflows and pages
- Validate actual implementation in code (routes/components + API handlers + persistence)
- Prioritize user-critical workflows over edge cases

## Process

### 1) Discover Intended Workflows + Pages (Docs-first)

Parse README (and /docs if present) to extract:
- "happy path" workflows (verbs like create, upload, generate, save, export, search, settings, etc.)
- referenced pages/routes/screens

Build a "Workflow -> Pages" map.

### 2) Enumerate Actual Pages/Routes (Code-first)

Detect routing framework and list routes/screens from code.

Create a final "Pages List" sorted by likely importance:
- pages mentioned in README/docs first
- then remaining core pages (dashboard, list/detail, settings, onboarding)

### 3) Decide Audit Set

- If total pages/routes <= 5: audit all
- If > 5: audit top 5, then ask user how many more

### 4) Per-Page Audit

For each page, perform:

**A) Selectable UI Inventory**
- Enumerate all interactive elements
- For each: intended action + expected outcome

**B) Wiring & Flow Trace**
- Trace: UI handler -> state update -> API call(s) -> persistence -> UI confirmation

**C) Orphan / Gap Detection**
Flag:
- UI that looks clickable but has no handler
- handler exists but no visible UI feedback
- UI exists but no API/persistence when expected
- API exists but no reachable UI path
- missing empty/loading/error states

## Output Format

### A) Top Workflows (from README/docs)

| Workflow | Pages Involved | Expected Outcomes |
|----------|----------------|-------------------|

### B) Pages Audited

List of pages with URLs/routes.

### C) Per-Page Audit Table

| Element | Interaction | Expected | Actual | API/LLM | Status | Notes |
|---------|-------------|----------|--------|---------|--------|-------|

Status: PASS / FAIL / UNCERTAIN

### D) Orphaned/Gaps Summary

| Priority | Issue | Location | Fix |
|----------|-------|----------|-----|

## CLI Integration

```bash
# Basic audit
npx ibr audit <url> --rules minimal

# With API cross-reference
npx ibr audit <url> --rules minimal --check-apis .

# JSON output
npx ibr audit <url> --rules minimal --json
```
