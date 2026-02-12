---
name: ibr:ui-audit
description: Run a comprehensive end-to-end UI audit on an app's workflows
arguments:
  - name: url
    description: Base URL of the app (or leave blank for localhost detection)
    required: false
---

# /ibr:ui-audit

Full end-to-end audit of an app's user workflows. Verifies every UI interaction works (buttons, features, search, prompts, settings), using IBR scans for runtime evidence and code analysis for wiring traces.

## Instructions

You are a **full-stack UI auditor + workflow reliability engineer**.

### GOAL

Audit the app's top user workflows end-to-end. Use the README/docs as the source of truth for intended behavior. Verify every UI interaction is wired correctly (UI → state → API → persistence → UI feedback). Produce a **light audit** (executive summary) and **detailed audit** (engineering-ready inventory).

### TOOLS

- `npx ibr scan <url> --json` — Full UI scan: elements + interactivity + semantic + console
- `npx ibr start <url>` / `npx ibr check` — Visual baselines and regression
- `npx ibr session:start <url>` + `session:click/type/wait/screenshot` — Interactive testing
- Code search — Route discovery, API mapping, handler tracing

### PROCESS (STRICT ORDER)

#### Phase 0 — Setup & Sanity

1. Confirm app runs locally (detect baseUrl)
2. Confirm IBR: `npx ibr --help`
3. If auth needed: `npx ibr login <loginUrl>`

#### Phase 1 — Discover Workflows + Pages

**Docs-first:** Parse README for workflows and referenced pages.
**Code-first:** Enumerate routes from the routing framework.

- If pages <= 5: audit all
- If > 5: audit top 5 (README-ranked), then ask user how many more

#### Phase 2 — Visual Baselines

For each page: `npx ibr start <url> --name <route-slug>`

#### Phase 3 — IBR Scan (Element Detection)

For each page: `npx ibr scan <url> --json`

This returns:
- All interactive elements with bounds, handlers, computed styles
- Button/link/form handler detection (orphan detection)
- Page intent classification and auth/loading/error states
- Console errors captured during page load

Supplement with code-derived analysis (component grep for onClick/onSubmit/onChange).

#### Phase 4 — Interaction Audit

For each interactive element, verify with observable evidence using IBR interactive sessions:

```bash
npx ibr session:start <url> --name "audit-<route>"
npx ibr session:click <id> "<selector>"
npx ibr session:type <id> "<selector>" "test"
npx ibr session:wait <id> "<result-selector>"
npx ibr session:screenshot <id>
```

Assert at least ONE outcome per element:
- **NAV**: URL change
- **STATE**: DOM/aria state change
- **NETWORK**: API call fired
- **PERSISTENCE**: Survives reload

Explicitly audit: search, prompts/LLM, responses, settings, connections.

#### Phase 5 — Visual Regression

Run `npx ibr check` after all interaction tests. Handle verdicts appropriately.

#### Phase 6 — Diagnose + Fix

Classify: ORPHANED UI, ORPHANED BACKEND, BROKEN FLOW, WEAK UX.
Implement smallest fixes. Re-scan affected pages.

### OUTPUT (REQUIRED — BOTH)

#### Light Audit

- Top workflows from README
- Pages audited
- P0 broken flows, orphaned UI count, biggest UX friction, IBR verdicts
- 5 next steps

#### Detailed Audit

A) Workflow → Page map
B) Per-page element inventory with IBR scan status
C) UI → API → Persistence wiring trace
D) Orphans & gaps (P0/P1/P2) with file paths + smallest fix
E) IBR scan report (verdict, elements, issues, console errors per route)
F) Commands to reproduce

### RULES

- Evidence required: cite file paths and IBR scan data for findings
- Do not invent intent. If ambiguous, mark UNCERTAIN
- Keep fixes minimal and workflow-focused
- Prefer data-testid + role selectors. Add data-testid where missing

### ACCEPTANCE CRITERIA

- Every audited page has: IBR scan, element inventory, functional evidence
- No clickable-looking element unclassified
- Search/prompt/response/settings flows tested if present
- If > 5 pages, ask user how many to continue with after first 5

## START NOW

1. Detect routing framework and list routes.
2. Parse README for workflows and referenced pages.
3. Decide audit set (<= 5 unless total <= 5).
4. Run `npx ibr scan` on the first page to validate the pipeline.
