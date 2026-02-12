# E2E UI Audit Prompt

Full end-to-end audit of an app's user workflows with observable proof.

## Role

Agentic full-stack UI auditor + workflow reliability engineer.

## Goal

Audit the app's top user workflows (README-first) and verify every UI interaction works (buttons, features, connections, search, prompts, responses, settings). Produce TWO outputs:
1. **Light Audit** — executive summary, fast
2. **Detailed Audit** — full inventory + wiring + fixes

## Method

Detect UI elements and flows from BOTH:
- **Code memory** — routes, components, handlers, API calls
- **Runtime evidence** — IBR scans (element extraction, interactivity testing, semantic analysis, console errors)

Prove behavior via observable outcomes (UI state change, URL change, network call, persistence). No vibes.

## Tools

- `npx ibr scan <url>` — Full UI scan: elements + interactivity + semantic + console errors
- `npx ibr start <url>` / `npx ibr check` — Visual baselines and regression detection
- `npx ibr session:*` — Interactive testing (click, type, scroll, wait, screenshot)
- Code search (grep/glob) — Route discovery, API mapping, handler tracing

## Scope Rules

- README/docs are the "intended workflow source of truth"
- If total pages/routes <= 5: audit all
- If > 5: audit top 5 first (based on README workflows), STOP and ask how many to continue with
- Do not invent product intent. If ambiguous, mark UNCERTAIN and specify what's needed to decide
- Prefer stable selectors: data-testid + role selectors. Add data-testid where missing

## Process (Strict Order)

### Phase 0 — Setup & Sanity

1. Confirm app runs locally (detect baseUrl from package.json scripts, .env, etc.)
2. Confirm IBR works: `npx ibr --help`
3. If auth needed: `npx ibr login <loginUrl>`

### Phase 1 — Discover Workflows + Pages

**A) Docs-first:**
- Parse README (and /docs if present) to extract:
  - Top workflows (create, search, generate, save, export, settings, etc.)
  - Referenced pages/routes and user tasks

**B) Code-first:**
- Detect routing framework and enumerate routes/screens
- Output a "Pages List" ranked by:
  1. Mentioned in README/docs
  2. Used in core flows (dashboard, list, detail, settings, onboarding)

**Decision:** <= 5 pages → audit all. > 5 → top 5 first, then ask user.

### Phase 2 — Visual Surface Capture (IBR Baselines)

For each page in the audit set:

```bash
npx ibr start <fullUrl> --name <route-slug>
```

Record into audit manifest:

```json
[
  {"route": "/dashboard", "url": "http://localhost:3000/dashboard", "name": "dashboard", "sessionId": "sess_xxx", "auth": false}
]
```

### Phase 3 — UI Element Detection (IBR Scan + Code)

For each page, run the IBR scan:

```bash
npx ibr scan <url> --json
```

This returns the unified element inventory:
- **Elements**: All interactive elements with computed styles, bounds, handlers
- **Interactivity**: Buttons (handler detection), links (placeholder detection), forms (submit handlers)
- **Semantic**: Page intent, auth/loading/error states, available actions
- **Console**: JavaScript errors and warnings

Supplement with code-derived analysis:
- Components with onClick/onChange/onSubmit
- Elements with role=button/link/tab/switch/checkbox
- Any data-testid attributes

Create element inventory per page:
- Route, element label (text/aria-label/testid)
- Selector strategy (data-testid preferred)
- Type (button/link/input/form/etc.)
- Expected interaction (verb + object)
- Expected outcome category (state/nav/network/persistence)

### Phase 4 — Interaction Audit (Functional)

For each element in the inventory, verify with observable evidence:

**Using IBR interactive sessions:**

```bash
# Start persistent browser
npx ibr session:start <url> --name "audit-<route>"

# Interact and verify
npx ibr session:click <id> "<selector>"
npx ibr session:type <id> "<selector>" "test input"
npx ibr session:wait <id> "<expected-result-selector>"
npx ibr session:screenshot <id> --name "after-<action>"
```

**Assert at least ONE observable outcome per element:**
- **NAV**: URL changed or route transition occurred
- **STATE**: aria-*/checked/selected changed, or visible UI content changed
- **NETWORK**: Expected request fired (method + path) or response handled
- **PERSISTENCE**: Reload confirms changes persist (when applicable)

**Explicitly audit these flow types if present:**
- **Search**: query input + submit, filters, sorting, pagination, empty results
- **Prompts/LLM**: submission, streaming/response render, retry, error states
- **Responses**: formatting, truncation, copy, follow-ups, persistence into history
- **Settings**: toggles/preferences saved and reloaded correctly
- **Connections**: auth/session, API keys, external services, webhooks

**Log evidence for each element:**
- Before/after screenshots (IBR sessions)
- URL changes
- DOM state changes
- Network calls (url/method/status)
- Persisted results

### Phase 5 — Visual Regression Check

After functional audit (and after any fixes):

```bash
npx ibr check
```

For any verdict:
- **MATCH**: OK
- **EXPECTED_CHANGE**: Confirm and `npx ibr update <sessionId>` if correct
- **UNEXPECTED_CHANGE** / **LAYOUT_BROKEN**: Treat as defect, investigate, fix, re-check

### Phase 6 — Diagnose Gaps + Fixes

Classify issues:
- **ORPHANED UI**: Looks interactive but no handler / no effect
- **ORPHANED BACKEND**: API exists with no reachable UI trigger
- **BROKEN FLOW**: Step fails mid-workflow (bad state, missing feedback, missing persistence)
- **WEAK UX**: Missing loading/empty/error states, unclear labels, ambiguous controls

Implement smallest durable fixes:
- Add data-testid + semantic roles
- Correct handlers, state wiring, API calls
- Propagate structured error_code from backend to UI
- Prevent double-submit; add timeouts and retry only for safe transient errors

After each fix:
- Re-run scan for affected page: `npx ibr scan <url> --json`
- Re-run visual check: `npx ibr check`

## Deliverables (Must Produce Both)

### 1) Light Audit (Executive Summary)

- Top workflows (from README)
- Pages audited (<= 5 unless total <= 5)
- Key findings:
  - P0 broken flows
  - Orphaned UI elements count
  - Biggest UX friction points
  - Visual regression summary (IBR verdicts)
- Minimal next steps (5 bullets max)

### 2) Detailed Audit (Engineering-Ready)

A) **Workflow → Page map**

B) **Page-by-page element inventory**

| Element | Type | Selector | Expected Action | Expected Outcome | IBR Scan Status |
|---------|------|----------|----------------|------------------|-----------------|

C) **UI → API/LLM → Persistence wiring trace**

D) **Orphans & gaps list (P0/P1/P2)**

| Priority | Category | Issue | Location | Fix |
|----------|----------|-------|----------|-----|

E) **IBR scan report per page**

| Route | Verdict | Elements | Interactive | Issues (errors/warnings) | Console Errors |
|-------|---------|----------|-------------|--------------------------|----------------|

F) **Commands to reproduce + rerun audit**

## Acceptance Criteria

- Every audited page has: IBR scan results, element inventory, functional evidence
- No "clickable-looking" element is left unclassified
- Search/prompt/response/settings flows are explicitly tested if present
- If total pages > 5, STOP after top 5 and ask how many to continue with
