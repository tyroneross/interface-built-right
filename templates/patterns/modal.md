# Modal Pattern

## Structure

```html
<!-- Backdrop -->
<div
  class="modal-backdrop"
  role="presentation"
  aria-hidden="true"
  data-action="close-modal"
></div>

<!-- Dialog -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  class="modal"
  tabindex="-1"
>
  <header class="modal-header">
    <h2 id="modal-title" class="modal-title">Confirm deletion</h2>
    <button class="modal-close" aria-label="Close dialog">
      <span aria-hidden="true">×</span>
    </button>
  </header>

  <div id="modal-description" class="modal-body">
    <p>This action cannot be undone. The project and all its data will be permanently removed.</p>
  </div>

  <footer class="modal-footer">
    <button type="button" class="btn-danger">Delete project</button>
    <button type="button" class="btn-secondary" data-action="close-modal">Cancel</button>
  </footer>
</div>
```

The dialog element is centered in the viewport. Backdrop covers 100vw × 100vh at a semi-transparent overlay. Focus is trapped inside the dialog while open.

## Calm Precision Rules

**Fitts — single primary action is the most prominent target.**
The modal exists to complete one decision. That decision's action button must be the most visually prominent element in `modal-footer`. Max 2–3 actions total. If you have 4+ actions in a modal footer, the modal is doing too much — split it.

**Hick — max 2–3 actions, no overflow menus.**
Unlike cards (where overflow menus are acceptable), modals demand resolution. The user opened this context to make a decision. Present 2 choices: proceed (primary) and cancel (secondary). A third option is the limit. More than 3 choices in a modal means the design needs rethinking, not a longer footer.

**Content over chrome — modal body is the signal.**
The modal header and footer are chrome. Keep them minimal. The `modal-body` should contain the information needed to make the decision. No decorative illustrations, no filler copy, no marketing language inside modals.

**Gestalt — modal is a single grouped unit.**
One container, one border/shadow, one semantic purpose. Do not nest cards inside a modal body unless the content genuinely requires sub-grouping (e.g., a modal containing a form with fieldsets).

## Spacing

- Modal max-width: 480px (standard), 640px (form modal), 320px (confirmation)
- Modal inner padding: `spacing[6]` (32px) horizontal, `spacing[5]` (24px) vertical
- Header bottom border margin: `spacing[4]` (16px)
- Footer top border margin: `spacing[4]` (16px)
- Between footer actions: `spacing[2]` (8px)
- Backdrop opacity: 50% black (`rgba(0,0,0,0.5)`)

## Typography Hierarchy

| Element | Size token | Weight token | Color token |
|---------|-----------|--------------|-------------|
| Modal title | `fontSizes.xl` (20px) | `fontWeights.semibold` (600) | `colors.text-primary` |
| Body text | `fontSizes.base` (16px) | `fontWeights.normal` (400) | `colors.text-secondary` |
| Close button label | visually hidden | — | — |
| Destructive action | `fontSizes.base` (16px) | `fontWeights.medium` (500) | white on `colors.error` bg |
| Secondary action | `fontSizes.base` (16px) | `fontWeights.normal` (400) | `colors.text-secondary` |

## Accessibility

- `role="dialog"` + `aria-modal="true"` on the container
- `aria-labelledby` points to the modal title id
- `aria-describedby` points to the modal body id
- Focus must move into the modal when it opens — use `focus()` on `tabindex="-1"` dialog or first focusable element
- Focus trap: Tab cycles through focusable elements inside the modal only; Shift+Tab reverses
- Escape key closes the modal and returns focus to the trigger element
- Backdrop click closes the modal (non-destructive close only — do not close destructive-confirmation modals on backdrop click)
- `aria-hidden="true"` on backdrop so screen readers ignore it
- When modal closes, focus returns to the element that triggered it

## Anti-Patterns

**4+ actions in the modal footer.**
Hick violation. Multiple equally-weighted choices in a confined context freeze decision-making. If the modal requires 4 options, redesign as a full page or drawer.

**Backdrop click to close a destructive-confirmation modal.**
Interaction safety issue. A user who accidentally clicks outside a "Delete project" modal should not trigger a close that could be mistaken for a cancel. Require explicit Cancel button click for destructive actions.

**No focus trap.**
Accessibility violation. Tab escaping the modal means keyboard and screen reader users exit the modal context without closing it, leaving an invisible overlay active.

**Modal title and body text at the same font size and weight.**
Hierarchy collapse. The title must be distinguishable from body text at a glance. Use size and weight delta.

**Decorative header or illustration consuming > 30% of modal height.**
Content-chrome violation. A large banner image or icon in the modal header reduces the space available for the actual decision content.

**Scroll-chained modal (modal scrolls with the page).**
Implementation error. The modal should be `position: fixed` and scroll independently from the page background, which must be locked (`overflow: hidden` on `<body>`) while the modal is open.

## IBR Validation

After building, run `ibr scan` and verify:

- `role="dialog"` and `aria-modal="true"` present (accessibility)
- `aria-labelledby` and `aria-describedby` set (accessibility)
- Focus moves into modal on open (accessibility)
- Escape key closes modal (accessibility)
- Focus returns to trigger element on close (accessibility)
- Visible footer action count <= 3 (Hick)
- Primary action has largest visual weight in footer (Fitts)
- `<body>` scroll locked while modal is open (implementation)
- Backdrop has `aria-hidden="true"` (accessibility)
