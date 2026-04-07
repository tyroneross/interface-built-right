# Form Pattern

## Structure

```html
<form novalidate>
  <!-- Field group with single container border -->
  <fieldset class="field-group">
    <legend class="field-group-label">Account Details</legend>

    <div class="field">
      <label for="email" class="field-label">Email address</label>
      <input
        id="email"
        type="email"
        name="email"
        autocomplete="email"
        aria-describedby="email-error"
        class="field-input"
        required
      />
      <span id="email-error" role="alert" class="field-error" hidden>
        Enter a valid email address
      </span>
    </div>

    <div class="field">
      <label for="name" class="field-label">Full name</label>
      <input id="name" type="text" name="name" autocomplete="name" class="field-input" required />
    </div>
  </fieldset>

  <!-- Advanced fields behind expand (Hick) -->
  <details class="advanced-section">
    <summary class="advanced-trigger">Advanced options</summary>
    <div class="advanced-body">
      <!-- optional / infrequent fields -->
    </div>
  </details>

  <div class="form-actions">
    <button type="submit" class="btn-primary btn-full-width">Create account</button>
    <button type="button" class="btn-secondary">Cancel</button>
  </div>
</form>
```

## Calm Precision Rules

**Gestalt — one border around related field groups.**
Use `<fieldset>` with a single border to group semantically related fields (e.g., "Billing address"). Never put a border on individual `<div class="field">` wrappers. Spacing alone separates fields within a group.

**Fitts — submit is the largest, most prominent target.**
The submit/primary action button should be the biggest interactive element in the form. Full-width (`btn-full-width`) for conversion-critical forms. Never reduce it to the same visual weight as a Cancel link.

**Hick — advanced fields behind `<details>` expand.**
Fields that fewer than 30% of users need should be hidden behind a "Advanced options" expand. Show only the critical path by default. Each additional visible field adds cognitive load before the user can act.

**Cognitive load — inline validation, not summary errors.**
Show errors adjacent to the field that caused them, immediately after blur or submit attempt. Never group all errors at the top of the form — this forces the user to map errors to fields mentally.

## Spacing

- Between fields within a group: `spacing[4]` (16px)
- Between field groups / fieldsets: `spacing[6]` (32px)
- Label to input gap: `spacing[1]` (4px) — label sits directly above input
- Input to error message gap: `spacing[1]` (4px)
- Form actions top margin: `spacing[6]` (32px)
- Between action buttons: `spacing[2]` (8px)

## Typography Hierarchy

| Element | Size token | Weight token | Color token |
|---------|-----------|--------------|-------------|
| Field label | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | `colors.text-primary` |
| Input text | `fontSizes.base` (16px) | `fontWeights.normal` (400) | `colors.text-primary` |
| Helper text | `fontSizes.xs` (12px) | `fontWeights.normal` (400) | `colors.text-muted` |
| Error message | `fontSizes.xs` (12px) | `fontWeights.medium` (500) | `colors.error` |
| Fieldset legend | `fontSizes.sm` (14px) | `fontWeights.semibold` (600) | `colors.text-primary` |
| Advanced trigger | `fontSizes.sm` (14px) | `fontWeights.medium` (500) | `colors.primary` |

## Accessibility

- Every input has a `<label>` with matching `for`/`id` — no placeholder-as-label
- Error messages use `role="alert"` and are linked via `aria-describedby`
- Required fields marked with `required` attribute — not asterisk-only
- `autocomplete` attributes set for all common fields (email, name, address, etc.)
- `novalidate` on `<form>` disables browser-native validation UI — custom validation takes over
- Tab order follows visual top-to-bottom, left-to-right layout
- Disabled submit button while submitting — add `aria-busy="true"` to form during async submit
- Minimum input height 44px on mobile (Fitts / `touchTargets.min`)

## Anti-Patterns

**Borders on individual field wrappers.**
Gestalt violation. Per-field borders break the visual grouping. The fieldset border is the boundary. Internal spacing is sufficient to separate fields.

**Placeholder text as the only label.**
Accessibility violation. Placeholders disappear on input, leaving users with no label reference. Always use a persistent `<label>` above the input.

**All errors summarized at the top of the form.**
Cognitive load violation. Summary errors require mental mapping from message to field. Inline errors placed adjacent to the field eliminate this step.

**Cancel and Submit at identical visual weight.**
Fitts violation. Equal weight implies equal importance. Cancel should be secondary — smaller, lower contrast, or styled as a text link.

**20 visible fields on initial load.**
Hick violation. Grouping and progressive disclosure via `<details>` reduces perceived form complexity. Users abandon long forms before starting them.

**Submit button disabled before user interaction.**
Cognitive load issue. Pre-disabled buttons with no explanation leave users unsure why they cannot proceed. Show the button enabled, then validate on attempt.

## IBR Validation

After building, run `ibr scan` and verify:

- No border on individual `.field` wrappers — only `fieldset` containers (Gestalt)
- Submit button is the visually largest action element (Fitts)
- All inputs have associated `<label>` elements (accessibility)
- Error messages linked via `aria-describedby` (accessibility)
- Advanced / infrequent fields are inside `<details>` or equivalent collapse (Hick)
- Input height >= 44px on mobile viewport (Fitts)
- Error text uses `colors.error` token — no background color on error state (signal-to-noise)
