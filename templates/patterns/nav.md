# Nav Pattern

## Structure

**Sidebar nav:**
```html
<nav aria-label="Main navigation">
  <ul role="list">
    <li>
      <a href="/dashboard" aria-current="page" class="nav-item nav-item--active">
        Dashboard
      </a>
    </li>
    <li>
      <a href="/projects" class="nav-item">Projects</a>
    </li>
    <li>
      <!-- Expandable group -->
      <button class="nav-group-trigger" aria-expanded="false" aria-controls="settings-group">
        Settings
      </button>
      <ul id="settings-group" hidden role="list">
        <li><a href="/settings/profile" class="nav-item nav-item--nested">Profile</a></li>
        <li><a href="/settings/billing" class="nav-item nav-item--nested">Billing</a></li>
      </ul>
    </li>
  </ul>
</nav>
```

**Top nav:**
```html
<nav aria-label="Main navigation">
  <ul role="list" class="nav-tabs">
    <li>
      <a href="/overview" aria-current="page" class="nav-tab nav-tab--active">Overview</a>
    </li>
    <li>
      <a href="/activity" class="nav-tab">Activity</a>
    </li>
  </ul>
</nav>
```

## Calm Precision Rules

**Signal-to-noise — selected state is text treatment, never a background pill.**
Active item: `colors.text-primary` (`text-gray-900`) + `fontWeights.medium` (500) + 2px bottom border (top nav) or 2px left border (sidebar). Background pills add visual noise without adding information — they signal selection via color when text weight and border already do the job more precisely.

**Hick — progressive disclosure for deep hierarchies.**
Top-level items only visible by default. Sub-navigation expands on demand via `aria-expanded` toggle. Never render a full tree of 15+ items on load. Each visible level should contain 5–7 items maximum.

**Fitts — 44px touch targets on mobile.**
Nav items must meet `touchTargets.min` (44px) tap height on mobile viewports. Sidebar items get `min-height: 44px` with padding filling the target. Compact 24px desktop height is acceptable where pointer precision is assumed.

**Gestalt — nav is a group, items are not.**
The `<nav>` element provides the semantic grouping. Individual items share that container — they do not get individual borders. A subtle left border on the active item (sidebar) is a selection indicator, not a per-item border.

## Spacing

- Sidebar item padding: `spacing[2]` (8px) vertical, `spacing[3]` (12px) horizontal
- Sidebar nested item indent: `spacing[5]` (24px) left padding (adds to parent)
- Top nav tab padding: `spacing[2]` (8px) vertical, `spacing[3]` (12px) horizontal
- Gap between nav sections / groups: `spacing[5]` (24px)
- Active indicator border width: 2px

## Typography Hierarchy

| State | Size token | Weight token | Color token |
|-------|-----------|--------------|-------------|
| Active item | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | `colors.text-primary` |
| Inactive item | `fontSizes.sm` (14px) | `fontWeights.normal` (400) | `colors.text-secondary` |
| Group label / section header | `fontSizes.xs` (12px) | `fontWeights.semibold` (600) | `colors.text-muted` |
| Nested item | `fontSizes.sm` (14px) | `fontWeights.normal` (400) | `colors.text-secondary` |

## Accessibility

- `<nav>` requires `aria-label` — use "Main navigation", "Secondary navigation", etc.
- Active item uses `aria-current="page"` (not a CSS class alone)
- Expandable groups use `aria-expanded` on the trigger and `aria-controls` pointing to the list id
- Hidden sub-lists use the `hidden` attribute (not `display: none` via class) so it toggles correctly with JS
- Keyboard: Tab moves between items; Enter/Space activates; Escape collapses open group
- Focus visible: 2px outline using `colors.primary` at all focus states

## Anti-Patterns

**Background pill for selected state.**
Signal-to-noise violation. A filled pill on the active item creates a shape that competes with content. The border + text weight combination conveys selection with less noise.

**All sub-nav items rendered on load.**
Hick violation. Rendering 20 nav items simultaneously maximizes perceived complexity. Collapse sub-trees and expand on interaction.

**Nav items below 44px touch height on mobile.**
Fitts violation. Small tap targets cause mis-taps and frustration, especially in sidebar navigation.

**Individual borders on nav items.**
Gestalt violation. Per-item borders visually fragment a unified list into separate objects. Use spacing and a single group container instead.

**Icon-only nav without text labels on desktop.**
Signal-to-noise violation. Icons alone require learned mapping. Always pair with visible text on desktop (tooltip alone is insufficient).

## IBR Validation

After building, run `ibr scan` and verify:

- Active nav item has no background color change — only text color + border indicator (signal-to-noise)
- Active item uses `aria-current="page"` attribute (accessibility)
- Mobile nav item touch targets >= 44px height (Fitts)
- Expandable groups have `aria-expanded` on trigger element (accessibility)
- No individual border on each nav item — only group container or single active indicator (Gestalt)
- Visible top-level items count <= 7 (Hick / cognitive load)
