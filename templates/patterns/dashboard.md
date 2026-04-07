# Dashboard Pattern

## Structure

```html
<main class="dashboard">
  <!-- Key metrics row — always visible, high information density -->
  <section class="metrics-row" aria-label="Key metrics">
    <div class="metric-card" role="article" aria-labelledby="metric-revenue">
      <span id="metric-revenue" class="metric-label">Revenue</span>
      <span class="metric-value">$48,200</span>
      <span class="metric-delta metric-delta--positive">+12% vs last month</span>
    </div>
    <!-- repeat for 3–5 key metrics -->
  </section>

  <!-- Primary content area — >= 70% of viewport width -->
  <div class="dashboard-layout">
    <section class="content-primary" aria-label="Main content">
      <!-- Charts, activity feed, or primary data -->
    </section>

    <!-- Sidebar widgets — secondary context only -->
    <aside class="content-secondary" aria-label="Summary panels">
      <!-- 1–2 supporting widgets -->
    </aside>
  </div>
</main>
```

Dashboard sections use `<section>` with `aria-label` to establish landmark regions. Metrics row is always rendered above the fold.

## Calm Precision Rules

**Content-chrome ratio — content >= 70% of the layout.**
Chrome (headers, borders, padding, nav, toolbars) must not exceed 30% of visible area. Each widget card contributes chrome. If 8 small cards are visible simultaneously, their combined borders/headers consume more space than their data. Audit: sum all non-data pixels in a screenshot.

**Cognitive load — max 5–7 widgets visible without scroll.**
Above-the-fold density caps at 7 distinct information units. More than 7 items on a dashboard forces the user to scan rather than read. Secondary widgets go below fold or behind tabs.

**Fitts — key metrics are the largest readable elements.**
Metric values (`metric-value`) should use the largest type on the page — `fontSizes.3xl` (30px) or `fontSizes.4xl` (36px) — because they are the primary reason the dashboard exists. Navigation and chrome elements must not compete in visual weight.

**Signal-to-noise — status via text color only.**
Delta indicators (`+12%`, `−3%`) use `colors.success` or `colors.error` on the text. No background badges, no colored status bars, no traffic-light icons without text labels. Exception: a single sparkline chart is a signal (data), not noise.

**Gestalt — cards group related data, not individual metrics.**
Each card has one border wrapping related data. A card showing "Revenue + Units + Margin" is one grouped unit. Never add individual borders inside a card to separate each number — use spacing and typography hierarchy.

## Spacing

- Metrics row gap between cards: `spacing[4]` (16px)
- Dashboard layout column gap: `spacing[6]` (32px)
- Widget card inner padding: `spacing[4]` (16px) or `spacing[5]` (24px)
- Section vertical rhythm (between rows): `spacing[6]` (32px)
- Metric label to value gap: `spacing[1]` (4px)
- Value to delta gap: `spacing[1]` (4px)

## Typography Hierarchy

| Element | Size token | Weight token | Color token |
|---------|-----------|--------------|-------------|
| Metric value | `fontSizes.3xl` (30px) | `fontWeights.bold` (700) | `colors.text-primary` |
| Metric label | `fontSizes.xs` (12px) | `fontWeights.medium` (500) | `colors.text-muted` |
| Delta / trend | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | status color token |
| Widget title | `fontSizes.base` (16px) | `fontWeights.semibold` (600) | `colors.text-primary` |
| Widget body text | `fontSizes.sm` (14px) | `fontWeights.normal` (400) | `colors.text-secondary` |
| Section label | `fontSizes.xs` (12px) | `fontWeights.semibold` (600) | `colors.text-muted` |

## Accessibility

- Dashboard `<main>` must have a page `<h1>` (can be visually hidden if the page title is in the nav)
- Metric cards use `role="article"` with `aria-labelledby` pointing to the metric label
- Status indicators (delta values) must not rely on color alone — text value (`+12%`) is required
- Charts require an accessible text alternative: `aria-label` on the chart container describing the data, or an adjacent `<table>` for screen readers
- Live-updating data regions use `aria-live="polite"` so updates are announced without interrupting
- Keyboard: all interactive widgets (filters, date range pickers, expandable panels) must be reachable by Tab

## Anti-Patterns

**More than 7 widgets above the fold.**
Cognitive load violation. Dashboards feel "busy" when users cannot determine where to look first. Prioritize ruthlessly — demote secondary data below fold.

**Colored background badges for status.**
Signal-to-noise violation. A red badge on a metric adds visual weight that competes with the metric value itself. Color the text or delta; leave the background neutral.

**Individual borders inside a metric card.**
Gestalt violation. If a card shows three numbers, spacing hierarchy separates them. Internal borders fragment a coherent unit.

**Metric values at `fontSizes.lg` (18px).**
Fitts / hierarchy violation. The entire point of the dashboard is to read key numbers at a glance. Small metric values force users to lean in. Use `fontSizes.3xl` or larger.

**Navigation and widget headers at the same visual weight as metric values.**
Hierarchy collapse. Chrome must be visually subordinate to content. If the page title competes with metric values in font size and weight, content-chrome ratio is violated.

**Refreshing all data on every poll interval with no loading indicator.**
Cognitive load issue. Silent data swaps disorient users. Use `aria-live` regions and subtle loading states.

## IBR Validation

After building, run `ibr scan` and verify:

- Content area >= 70% of total layout width (content-chrome ratio)
- Visible widget count above fold <= 7 (cognitive load)
- Metric value font-size >= `fontSizes.3xl` (30px) (Fitts / hierarchy)
- Delta/status elements use text color only — no background color (signal-to-noise)
- No individual borders inside widget cards — only card-level border (Gestalt)
- Metric cards have `aria-labelledby` pointing to label element (accessibility)
- Charts have accessible text alternative (accessibility)
