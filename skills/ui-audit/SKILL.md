---
name: ui-audit
description: End-to-end UI audit for web applications. Use when asked to "audit my UI", "check accessibility", "scan for UI issues", "find broken buttons", or "review UX". Scans pages for handler issues, accessibility problems, broken interactivity, console errors, and semantic state.
metadata:
  author: tyroneross
  version: "0.4.9"
  argument-hint: <url>
---

# UI Audit with IBR

Scan web pages for UI issues — broken handlers, accessibility gaps, placeholder links, console errors, and semantic state problems.

## Prerequisites

```bash
npm install @tyroneross/interface-built-right
```

## Quick Scan

```bash
npx ibr scan http://localhost:3000
```

Returns a verdict: **PASS**, **ISSUES**, or **FAIL**.

## What Gets Scanned

| Layer | What's Checked |
|-------|---------------|
| **Elements** | All interactive elements with computed styles, bounds, handlers |
| **Interactivity** | Buttons have handlers, links have real hrefs, forms have submit handlers |
| **Accessibility** | Elements have labels, touch targets meet minimums, keyboard accessible |
| **Semantic** | Page intent classified, auth/loading/error states detected |
| **Console** | JavaScript errors and warnings during page load |
| **Structure** | Orphan elements, placeholder links, disabled without visual cues |

## Commands

```bash
# Basic scan
npx ibr scan http://localhost:3000

# JSON output for programmatic use
npx ibr scan http://localhost:3000 --json

# Scan with screenshot
npx ibr scan http://localhost:3000 --screenshot .ibr/scan.png

# Mobile viewport
npx ibr scan http://localhost:3000 --viewport mobile

# Wait for dynamic content
npx ibr scan http://localhost:3000 --wait-for ".dashboard-loaded"
```

## Issue Categories

| Category | Examples |
|----------|---------|
| `interactivity` | Button without handler, form without submit, placeholder link |
| `accessibility` | Missing aria-label, small touch target, no keyboard access |
| `semantic` | Page in error state, loading stuck, unknown intent |
| `console` | JavaScript errors during page load |
| `structure` | Orphan elements, disabled without visual cues |

## Full Audit Workflow

For a comprehensive multi-page audit:

### 1. Discover pages

Detect routes from code (React Router, Next.js pages, etc.) or README.

### 2. Scan each page

```bash
npx ibr scan http://localhost:3000/ --json
npx ibr scan http://localhost:3000/dashboard --json
npx ibr scan http://localhost:3000/settings --json
```

### 3. Test interactions

For pages with forms, search, or dynamic content, use interactive sessions:

```bash
npx ibr session:start http://localhost:3000 --name "audit-dashboard"
npx ibr session:click <id> "button.submit"
npx ibr session:wait <id> ".results"
npx ibr session:screenshot <id>
npx ibr session:close <id>
```

### 4. Classify issues

- **ORPHANED UI**: Looks interactive but no handler or effect
- **ORPHANED BACKEND**: API exists with no reachable UI trigger
- **BROKEN FLOW**: Step fails mid-workflow
- **WEAK UX**: Missing loading/empty/error states, unclear labels

### 5. Fix and re-scan

After fixes, re-run scans to verify issues are resolved.

## Scan Results Structure

```typescript
{
  verdict: 'PASS' | 'ISSUES' | 'FAIL',
  elements: { all: [...], audit: { totalElements, interactiveCount, issues } },
  interactivity: { buttons: [...], links: [...], forms: [...] },
  semantic: { pageIntent, state: { auth, loading, errors }, availableActions },
  console: { errors: [...], warnings: [...] },
  issues: [{ severity, category, description, selector }]
}
```

## When to Use

- Before PR review on frontend changes
- After implementing new UI features
- Periodic health checks on existing pages
- When users report broken interactions
- Accessibility compliance audits
