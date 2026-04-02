---
name: ibr:build-baseline
description: Create baselines for all pages and identify key UI elements across the app
arguments:
  - name: url
    description: Base URL of the app (or leave blank for localhost detection)
    required: false
---

# /ibr:build-baseline

Create a complete set of baselines for every page in the app and catalog the key UI elements found on each. This gives you a snapshot of the entire interface that future changes can be compared against.

## Instructions

You are a **baseline builder**. Your job is to capture every page and document what's on it so future comparisons have context.

### GOAL

1. Discover all routes in the app
2. Capture a named baseline for each page
3. Run a scan on each page to identify key UI elements
4. Produce a baseline manifest: what was captured, what elements exist, what the page does

### PROCESS

#### Step 1 — Detect Routes

```bash
cat package.json | grep -E '"next"|"react-router"|"vue-router"|"@angular/router"|"svelte-kit"|"astro"'
```

Enumerate all routes using the framework's file structure or router config. Build a route list.

#### Step 2 — Check Dev Server

Verify the app is running:

```bash
curl -s -o /dev/null -w "%{http_code}" <baseUrl>
```

If not running, ask the user to start it.

#### Step 3 — Capture Baselines

For each route, capture a named baseline:

```bash
npx ibr start <baseUrl><route> --name "<route-slug>"
```

Use meaningful names derived from the route:
- `/` → `home`
- `/dashboard` → `dashboard`
- `/settings/profile` → `settings-profile`
- `/auth/login` → `auth-login`

For pages with dynamic segments (e.g., `/users/[id]`), ask the user for a sample ID or skip with a note.

If a page requires auth, note it. If auth is configured (`npx ibr login` was run), capture it. Otherwise skip and list as "requires auth."

#### Step 4 — Identify Key Elements

For each page, run a scan to catalog interactive elements:

```bash
npx ibr scan <baseUrl><route> --json
```

Extract and record:
- **Navigation elements** — links, tabs, breadcrumbs
- **Actions** — buttons with their labels and purposes
- **Forms** — inputs, selects, textareas with their labels
- **Content areas** — main content, sidebars, headers, footers
- **Dynamic regions** — areas that change based on state (loading, empty, error)

#### Step 5 — Classify Each Page

For each page, document:
- **Page intent** — what the page is for (auth, listing, detail, form, dashboard, settings)
- **Primary action** — the main thing a user does here
- **Key components** — the 3-5 most important UI elements
- **State variations** — does this page look different when empty, loading, or in error?

### OUTPUT

#### Baseline Manifest

```
Baselines captured: 8/10 (2 require auth)
Total elements cataloged: 142
Total interactive elements: 67
```

#### Per-Page Baseline

| Route | Session Name | Elements | Page Intent | Primary Action |
|-------|-------------|----------|-------------|----------------|
| `/` | home | 15 | landing | Sign up / Learn more |
| `/dashboard` | dashboard | 34 | dashboard | View metrics |
| `/settings` | settings | 22 | form | Update preferences |

#### Element Catalog

For each page, list the key elements:

**`/dashboard` (dashboard)**
- Header: app logo, user avatar dropdown, notification bell
- Sidebar: nav links (Dashboard, Projects, Settings, Help)
- Main: metrics cards (4), recent activity list, quick actions bar
- Actions: "New Project" button, "Export" button, search input
- Forms: date range picker

**`/settings` (settings)**
- Tabs: Profile, Security, Notifications, Billing
- Form fields: name, email, avatar upload, timezone select
- Actions: "Save Changes" button (primary), "Cancel" link

#### Pages Skipped

| Route | Reason | Action Needed |
|-------|--------|---------------|
| `/admin` | Requires auth (admin role) | Run `npx ibr login` with admin account |
| `/users/[id]` | Dynamic route, no sample ID | Provide a user ID to capture |

### NEXT STEPS

After baselines are built:
- Make UI changes with confidence — run `/ibr:compare` to see what moved
- Run `/ibr:full-interface-scan` for deeper component testing
- Use `npx ibr list` to see all captured sessions

### RULES

- Capture EVERY discoverable route — don't stop at 5
- Use descriptive session names derived from the route path
- Don't interact with the page — just capture what loads on initial render
- If `--wait-for` is needed for dynamic content, use the page's main content selector
- Report what you found, don't fix anything
- If the page returns 404 or errors, capture it anyway and note the error
