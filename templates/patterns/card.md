# Card Pattern

## Structure

```html
<article class="card">
  <header class="card-header">
    <h3 class="card-title">Title</h3>
    <span class="card-status">Status text</span>
  </header>
  <div class="card-body">
    <p class="card-description">Supporting description</p>
    <!-- content -->
  </div>
  <footer class="card-footer">
    <button class="action-primary">Primary Action</button>
    <button class="action-secondary">Secondary</button>
  </footer>
</article>
```

The card is a single semantic unit: `<article>` for standalone content, `<div>` for UI groupings. Header, body, and footer are distinct zones — not interleaved.

## Calm Precision Rules

**Gestalt — single border, no internal borders.**
One border wraps the card. Dividers (1px `border-subtle`) separate header/footer from body if needed. Never add individual borders to list items inside a card body — use spacing alone.

**Fitts — primary action is the largest interactive target.**
The primary action button should be the most prominent element in `card-footer`. Avoid equally-sized rows of buttons; the primary must win visually and in tap target size (min `touchTargets.min` = 44px on mobile).

**Hick — max 3 visible actions.**
More than 3 choices per card degrades decision speed. If additional actions exist, place them behind a "More" overflow menu. The overflow icon itself counts as one action slot.

**Signal-to-noise — status via text color only.**
Use `colors.success`, `colors.error`, `colors.warning` on the status text element. Do not add background badges, colored pills, or icon-only status indicators without an adjacent label. Color reinforces text; it does not replace it.

## Spacing

- Card outer padding: `spacing[4]` (16px) on desktop, `spacing[3]` (12px) on mobile
- Header bottom margin: `spacing[2]` (8px) if body follows immediately
- Footer top margin / divider gap: `spacing[4]` (16px)
- Between actions in footer: `spacing[2]` (8px)

## Typography Hierarchy

| Zone | Size token | Weight token | Color token |
|------|-----------|--------------|-------------|
| Card title | `fontSizes.lg` (18px) | `fontWeights.semibold` (600) | `colors.text-primary` |
| Description | `fontSizes.sm` (14px) | `fontWeights.normal` (400) | `colors.text-secondary` |
| Metadata / timestamps | `fontSizes.xs` (12px) | `fontWeights.normal` (400) | `colors.text-muted` |
| Status text | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | status color token |

## Accessibility

- `<article>` requires a label — use `aria-labelledby` pointing to the `card-title` id
- Interactive cards (entire card clickable): use a single `<a>` or `<button>` wrapping title, not the full card. Avoid nesting interactive elements
- Status spans must not rely on color alone — pair with a text label or `aria-label`
- Minimum contrast 4.5:1 for all text against card background

## Anti-Patterns

**Individual item borders inside card body.**
Gestalt violation. If the card contains a list, use row dividers (`border-bottom: 1px solid border-subtle`) or spacing — not a border on each item.

**Three equally-prominent action buttons.**
Fitts violation. Equal weight signals equal importance, which increases cognitive load. Establish a clear primary/secondary hierarchy.

**Colored background badges for status.**
Signal-to-noise violation. `background: red` on a badge competes with content. Use `color: colors.error` on the text label instead.

**Card title at `fontSizes.base` (16px) or smaller.**
Hierarchy collapse. The title must be visually distinct from description text.

**More than 3 actions visible without overflow.**
Hick violation. Adds unnecessary choice burden per card unit.

## IBR Validation

After building, run `ibr scan` and verify:

- No border on individual items within card body (Gestalt)
- Primary action button has largest touch target in card footer (Fitts)
- Status elements use text color only — no background color properties (signal-to-noise)
- Visible action count per card <= 3 (Hick)
- Card title font-size >= `fontSizes.lg` (18px) (hierarchy)
- Card has `aria-labelledby` or equivalent accessible name (accessibility)
