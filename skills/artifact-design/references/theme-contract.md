# The three-state theme contract

An artifact does not render on your page. It renders on a ground the *viewer*
paints, in a theme the viewer chose. Get this wrong and the page ships one theme's
text on the other theme's ground — unreadable, and invisible to anyone testing in
only their own theme.

## There are three states, not two

| Viewer setting | Root element | What separates light from dark |
|---|---|---|
| explicit light | `<html data-theme="light">` | the attribute |
| explicit dark | `<html data-theme="dark">` | the attribute |
| **system (the default)** | `<html>` — **nothing stamped** | only `prefers-color-scheme` |

Most viewers are in the third state. A stylesheet that only handles
`[data-theme]` renders nothing at all for them.

## The pattern

```css
/* 1. bare :root — the COMPLETE light palette. Every token gets its first
      definition here. This is the state the un-stamped document reads. */
:root {
  --paper: #fbf9f5;
  --ink:   #1c1a17;
  --muted: #6b655c;
  --accent:#7a4a2b;
  --rule:  #e2ddd3;
}

/* 2. dark by OS preference — redefine ONLY the tokens, and guard the selector so
      an explicit light choice still beats a dark OS. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #14120f;
    --ink:   #ece7de;
    --muted: #9a9287;
    --accent:#d99a63;
    --rule:  #2c2822;
  }
}

/* 3. explicit dark — so the toggle also wins over a light OS. */
:root[data-theme="dark"] {
  --paper: #14120f;
  --ink:   #ece7de;
  --muted: #9a9287;
  --accent:#d99a63;
  --rule:  #2c2822;
}

/* 4. components read tokens only — never a literal, never inside a theme block. */
body { background: var(--paper); color: var(--ink); }
.card { border: 1px solid var(--rule); color: var(--ink); }
```

## The four failure modes, and the rule that catches each

**A token defined only inside a conditional block** (`AD102`, error). It is
undefined in the system state, so `var(--glow)` falls back to nothing and the
element inherits whatever was there. Every token's *first* definition belongs on
bare `:root`.

**An unguarded dark media query** (`AD103`, warn). Without
`:not([data-theme="light"])`, a reader who explicitly picked light on a dark OS
still gets the dark palette — the toggle appears broken.

**No `:root[data-theme="dark"]` block** (`AD104`, warn). The mirror failure: the
toggle cannot reach dark on a light OS.

**A transparent `body`** (`AD105`, error). Background does not inherit, and the
viewer paints its own ground behind the page. A body with no explicit background
borrows the host's ground — which may be the opposite of the theme your text was
written for. Always paint it from a token.

## Defined in every state is not the same as legible in every state

The four rules above check that a token *exists* wherever it is used. `AD108`
checks that the pair it forms is *readable*. These fail independently: a palette
can satisfy the entire three-state contract and still put 2.6:1 text on the ground.

```css
:root { --paper: #ffffff; --accent: #7a4a2b; }   /* 6.3:1 — fine */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --paper: #101010; }   /* --accent unchanged */
}
a { color: var(--accent); }                       /* 2.6:1 in dark — unreadable */
```

Nothing above catches this: `--accent` is defined on bare `:root`, the media query
is guarded, the `[data-theme="dark"]` block exists, `body` has a background. Every
theme rule passes. The link is still illegible for half your readers.

An accent tuned against a light ground almost never survives the swap. Give the
failing theme its own value:

```css
:root[data-theme="dark"] { --accent: #d99a63; }   /* 7.6:1 on #101010 */
```

`AD108` resolves each token map independently — bare `:root` for light, plus the
dark overrides for dark — computes the WCAG 2.x ratio, and reports the state that
fails. It skips anything it cannot resolve exactly (`oklch`, `currentColor`,
gradients) rather than guessing, and it honours the WCAG 1.4.3 exemptions for
disabled controls, placeholders, and visually-hidden text. It is a `warn`, not an
`error`, because large text and non-text UI clear at 3:1 and the linter cannot see
font size reliably.

## Styling components inside a theme block

Don't (`AD107`, warn):

```css
@media (prefers-color-scheme: dark) {
  .card { background: #222; border-color: #444; }   /* no definition in system state */
}
```

Do — redefine the token, let the component follow:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --surface: #222; --rule: #444; }
}
.card { background: var(--surface); border-color: var(--rule); }
```

## Committing to a single theme

A design that deliberately inhabits one visual world — a neon arcade screen, a
letterpress invitation — may skip the media query and the stamps entirely. It must
still paint `background` and every colour explicitly so the page holds on either
host ground. Make it a choice, not an omission; `AD105` still applies.

## Outside Claude, nothing stamps `data-theme`

There is no viewer to set the attribute on a standalone file, so state 1 and 2 are
unreachable unless the page provides its own control. `artifact_build.py wrap
--theme-toggle` injects a minimal toggle plus a pre-paint bootstrap that restores
the stored choice before first paint (so a stored dark never flashes light). It is
opt-in, tagged `data-artifact-build="theme-toggle"`, and removed cleanly by
`unwrap`.

## Verify

```bash
python3 scripts/artifact_lint.py check page.html --min-severity warn
```

Checking the CSS by eye does not work here — the un-stamped state is exactly the
one you are least likely to be sitting in while you review.
