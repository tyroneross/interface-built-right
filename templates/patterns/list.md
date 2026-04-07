# List Pattern

## Structure

```html
<!-- Bounded list with dividers between items -->
<section aria-label="Recent projects">
  <h2 class="list-heading">Recent projects</h2>

  <ul role="list" class="item-list">
    <li class="list-item">
      <div class="item-content">
        <span class="item-title">Alpha project</span>
        <span class="item-description">Last updated Jan 12, 2026</span>
      </div>
      <div class="item-meta">
        <span class="item-status">Active</span>
      </div>
      <div class="item-action">
        <button class="btn-primary-compact" aria-label="Open Alpha project">Open</button>
      </div>
    </li>
    <!-- divider between items is CSS border-bottom on li, not a separate element -->
    <li class="list-item">
      <!-- ... -->
    </li>
  </ul>

  <!-- Virtual scroll container for > 50 items -->
  <!-- Replace <ul> with virtualized list component; preserve role="list" and item structure -->
</section>
```

For lists longer than 50 items, replace the `<ul>` with a virtualized scroll container. The semantic structure (`role="list"`, `role="listitem"`) must be preserved in virtualized implementations.

## Calm Precision Rules

**Gestalt — one outer border, dividers between items.**
The `<ul>` (or its container) may have an outer border to define the list as a bounded group. Items are separated by `border-bottom: 1px solid colors.border-subtle` on each `<li>`. Never add a full individual border (`border: 1px solid`) wrapping each item — that turns a unified list into a stack of separate cards.

**Fitts — primary action per item is the most prominent target.**
Each list item has one primary action. That button must be the largest, most visually prominent interactive element in the item row. Secondary actions (delete, archive) are accessible via an overflow menu or revealed on hover — they do not compete for visual prominence with the primary action.

**Signal-to-noise — status as text color only.**
Status labels (`Active`, `Archived`, `Error`) use the appropriate color token on the text. No background pills per item. At list scale (10–100 items), colored badges per row create sustained visual noise that obscures the actual data.

**Cognitive load — virtual scroll for lists > 50 items.**
Rendering 100+ DOM nodes degrades scroll performance and forces the user to scan an overwhelming volume of content. Implement virtual/windowed scroll for lists that may exceed 50 items. Pair with filter/search to reduce visible set before rendering.

**Gestalt — consistent item structure across the list.**
Every item in the list must follow the same layout: content zone, meta zone, action zone. Inconsistent item structures (some with images, some without; some with 2 actions, some with 0) break the scanning rhythm. Use placeholder/empty states to maintain structural consistency.

## Spacing

- List item padding: `spacing[3]` (12px) vertical, `spacing[4]` (16px) horizontal
- Item divider: 1px `colors.border-subtle` as `border-bottom` on `<li>`
- Between item content and action: `spacing[4]` (16px) minimum
- List outer padding: 0 (border handles visual edge)
- List heading to list gap: `spacing[3]` (12px)

## Typography Hierarchy

| Element | Size token | Weight token | Color token |
|---------|-----------|--------------|-------------|
| Item title | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | `colors.text-primary` |
| Item description / metadata | `fontSizes.xs` (12px) | `fontWeights.normal` (400) | `colors.text-secondary` |
| Status label | `fontSizes.xs` (12px) | `fontWeights.medium` (500) | status color token |
| Primary action button | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | action color |
| List section heading | `fontSizes.base` (16px) | `fontWeights.semibold` (600) | `colors.text-primary` |

## Accessibility

- Use `<ul>` or `<ol>` with `role="list"` (explicit role preserves semantics in CSS-reset environments where `list-style: none` strips list role in some browsers)
- List items use `<li>` — do not use `<div role="listitem">`
- Action buttons include row context in `aria-label`: `aria-label="Open Alpha project"` not just `aria-label="Open"`
- If the entire list item row is clickable: use a single `<a>` anchor as the primary interactive element. Do not make `<li>` itself focusable
- Status labels: text label is mandatory; color alone is insufficient
- Empty state: list must render an empty state message (`<li class="list-empty">No projects found</li>`) rather than a zero-height list
- Keyboard: Tab moves between items' interactive elements; action buttons are reachable without mouse

## Anti-Patterns

**Individual item borders (full border wrapping each `<li>`).**
Gestalt violation. This turns a list into a stack of cards. Use row dividers only — `border-bottom` on `<li>`, no `border` wrapping the item.

**Background color badges for status in list items.**
Signal-to-noise violation. At list scale, one badge per row creates a column of colored shapes that compete with item titles for attention. Text color communicates status; background color communicates alert/danger at page level.

**Rendering 500 items without virtual scroll.**
Cognitive load and performance violation. The DOM overhead degrades scroll frame rate. More importantly, 500 visible items provide no actionable information — filtering or pagination must precede rendering at that scale.

**Two equally-prominent action buttons per item.**
Fitts violation. Equally-weighted buttons eliminate hierarchy. One primary action (visible, prominent), one secondary action (overflow or hover-reveal).

**Inconsistent item structure across the list.**
Gestalt violation. Items that sometimes show a status badge and sometimes do not, or sometimes have an action button and sometimes do not, break the alignment grid and force per-item scanning instead of column scanning.

**No empty state.**
UX completeness violation. A list that renders nothing when empty provides no feedback. Always render a meaningful empty state that explains why the list is empty and, where appropriate, offers a path to populate it.

## IBR Validation

After building, run `ibr scan` and verify:

- No full `border` wrapping individual `<li>` elements — only `border-bottom` dividers (Gestalt)
- Status elements use text color only — no background-color on status spans (signal-to-noise)
- Action button `aria-label` values include row-identifying context (accessibility)
- `<ul>` has `role="list"` (accessibility)
- Lists with potential > 50 items use virtual scroll implementation (cognitive load / performance)
- Empty state rendered when list has 0 items (UX completeness)
- Primary action per item is visually distinct from secondary actions (Fitts)
