# Table Pattern

## Structure

```html
<div class="table-container" role="region" aria-label="Projects" tabindex="0">
  <table>
    <caption class="sr-only">Projects list, sortable by column</caption>
    <thead>
      <tr>
        <th scope="col" aria-sort="none">
          <button class="sort-trigger">
            Name
            <span class="sort-icon" aria-hidden="true"></span>
          </button>
        </th>
        <th scope="col" aria-sort="descending">
          <button class="sort-trigger sort-trigger--active">
            Created
            <span class="sort-icon sort-icon--desc" aria-hidden="true"></span>
          </button>
        </th>
        <th scope="col">Status</th>
        <th scope="col" class="col-actions">
          <span class="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr class="table-row">
        <td class="cell-primary">Alpha project</td>
        <td class="cell-secondary">Jan 12, 2026</td>
        <td class="cell-status">
          <span class="status-text status-text--active">Active</span>
        </td>
        <td class="cell-actions">
          <button class="btn-icon" aria-label="Edit Alpha project">Edit</button>
          <button class="btn-icon" aria-label="Delete Alpha project">Delete</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

The table wrapper has `role="region"` with a label and `tabindex="0"` to make it keyboard-scrollable when content overflows horizontally.

## Calm Precision Rules

**Gestalt — group by row, not by cell.**
Rows are the semantic unit. Horizontal row dividers (1px `border-bottom` on `<tr>`) visually group each row's cells into a coherent record. Never add `border` to individual `<td>` elements — this creates a grid of isolated boxes rather than a readable list of records.

**Signal-to-noise — row hover is subtle, not a state change.**
Row hover background: `colors.bg-secondary` (`#f9fafb`) — a barely perceptible shift that confirms interactivity without creating visual noise. Avoid colored hover backgrounds (`blue`, `green`) on rows; reserve color changes for selection state only.

**Fitts — action column is compact; actions are secondary.**
The actions column (Edit, Delete, etc.) contains secondary operations. Buttons should be compact (24px desktop height acceptable). The primary interaction in a table is often clicking into the row or a linked title — that is the large target. Do not inflate action buttons to equal the row height.

**Signal-to-noise — status as text color only.**
Status cells use `colors.success`, `colors.error`, or `colors.warning` applied to the text label. No background-color badges in table cells. Badges add per-cell chrome that accumulates across dozens of rows into significant noise.

**Cognitive load — sortable column headers have clear active state.**
The sorted column header must be visually distinct: `fontWeights.semibold` + sort direction icon. Unsorted columns have `fontWeights.normal`. If sort state is ambiguous, users re-sort accidentally.

## Spacing

- Table cell padding: `spacing[2]` (8px) vertical, `spacing[3]` (12px) horizontal
- Row divider: 1px `colors.border-subtle`
- Header bottom border: 2px `colors.border-default`
- Action column min-width: accommodate icon buttons with `spacing[2]` (8px) gap between them
- Table outer border: none — use container background contrast instead

## Typography Hierarchy

| Element | Size token | Weight token | Color token |
|---------|-----------|--------------|-------------|
| Column header (default) | `fontSizes.xs` (12px) | `fontWeights.medium` (500) | `colors.text-muted` |
| Column header (sorted) | `fontSizes.xs` (12px) | `fontWeights.semibold` (600) | `colors.text-primary` |
| Primary cell (row title) | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | `colors.text-primary` |
| Secondary cell (metadata) | `fontSizes.sm` (14px) | `fontWeights.normal` (400) | `colors.text-secondary` |
| Status text | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | status color token |
| Action button label | `fontSizes.xs` (12px) | `fontWeights.normal` (400) | `colors.text-secondary` |

## Accessibility

- `<table>` must have a `<caption>` — visually hidden (`.sr-only`) is acceptable if a visible heading labels the table
- All `<th>` elements use `scope="col"` or `scope="row"`
- Sortable columns use `aria-sort` on `<th>`: values are `"ascending"`, `"descending"`, or `"none"`
- Sort triggers are `<button>` elements inside `<th>` — not the `<th>` itself (prevents interactive element inside interactive element)
- Action buttons use `aria-label` that includes the row context (`aria-label="Delete Alpha project"`)
- Horizontally scrollable tables: wrap in `role="region"` + `aria-label` + `tabindex="0"` container
- Use `<caption>` or `aria-labelledby` to associate the table with a visible heading

## Anti-Patterns

**Borders on individual `<td>` cells.**
Gestalt violation. Full cell borders create a grid that reads as a spreadsheet. Row dividers are sufficient to group records.

**Colored background badges in status cells.**
Signal-to-noise violation. Status badges accumulate across every row. At 50 rows, a column of colored pills overwhelms the data columns.

**Large action buttons matching row height.**
Fitts violation (inverse). Action buttons being large signals they are primary actions. In a table, the row content — the linked title, the record — is primary. Actions are secondary and should be compact until hovered.

**No `aria-sort` updates on sort.**
Accessibility violation. Screen readers announce sort state via `aria-sort`. Not updating it after a sort means assistive technology users cannot determine the current sort order.

**Fixed table layout with no horizontal scroll container.**
Implementation error. On narrow viewports, fixed-width tables overflow the body without indication. The `role="region"` wrapper with `overflow-x: auto` handles this gracefully.

**Pagination with page numbers beyond ±2 of the current page visible.**
Cognitive load issue. Showing pages 1–20 in a pagination strip adds noise. Show: First, Prev, [current-1], [current], [current+1], Next, Last.

## IBR Validation

After building, run `ibr scan` and verify:

- No `border` on individual `<td>` elements — only row `border-bottom` dividers (Gestalt)
- Status cells use text color only — no background-color on status spans (signal-to-noise)
- Sorted column header has `aria-sort` attribute with current direction (accessibility)
- Action button `aria-label` values include row-identifying context (accessibility)
- `<th>` elements have `scope` attribute (accessibility)
- Table has `<caption>` or `aria-labelledby` (accessibility)
- Horizontal overflow handled by scrollable region container (implementation)
