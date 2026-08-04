---
name: obsidian-plugin-ui
description: Use when working on an Obsidian plugin's UI — a view class, an ItemView, a modal or sheet, styles.css, or anything under .obsidian/plugins. Covers the scan_obsidian workflow, base-CSS fidelity, Obsidian's element rules that override plugin CSS, and multi-width verification.
version: 0.1.0
user-invocable: false
---

# Obsidian Plugin UI

An Obsidian plugin view is not a web page. It renders inside Obsidian's own stylesheet, which defines ~800 custom properties and a set of bare element rules that silently reshape plugin markup. Verifying a plugin view means verifying it **in that cascade**, at more than one width.

## Use `scan_obsidian`, never `scan_static`

`scan_static` is a regex parser. It resolves no `var()`, no `calc()`, no layout, no `::before`, no cascade — every question worth asking about an Obsidian view is one it structurally cannot answer.

```bash
npx ibr scan-obsidian /path/to/plugin --view-class DailyPlannerView \
  --viewport iphone-14 --view-state fixture.json --json
```

MCP: `scan_obsidian` with `plugin_path` + `view_class`. `view_state` is the fixture (properties assigned onto the view before render); `post_mount` opens transient surfaces (`view.openSheet(document.body)`) so modals and pickers can be scanned too.

## Base-CSS fidelity is on by default

`scan_obsidian` locates the local Obsidian install, extracts the real `app.css` out of `obsidian.asar`, and injects it **before** the plugin stylesheet — the same order the real app uses, so plugin rules of equal specificity still win.

Check `harness.appCss` in the result:

```json
"appCss": { "loaded": true, "source": "/Applications/Obsidian.app/.../obsidian.asar", "bytes": 540610 }
```

**When it is off,** the scan grades `PARTIAL` (never `PASS`) and carries a warning. Do not read past that warning. A scan without base CSS renders a *different page* than the app does:

- every `var(--text-normal, #fallback)` resolves to its **fallback**, so the palette is wrong;
- Obsidian's element rules are absent, so a whole class of layout defect is invisible.

Fix it rather than working around it: install Obsidian, set `IBR_OBSIDIAN_APP_CSS` to an extracted `app.css` or an `obsidian.asar`, or pass `obsidian_css_path`. Pass `obsidian_css: false` only when you have decided a low-fidelity render is acceptable and you want the verdict to stand.

## Obsidian pins `<button>` to 30px

This is the trap that costs the most time, so read it before styling any row:

```css
/* Obsidian's app.css */
body   { --input-height: 30px; }
button { display: inline-flex; align-items: center; justify-content: center;
         height: var(--input-height); white-space: nowrap; padding: ... }
```

**Never use a `<button>` as a multi-line layout container without resetting that rule.** Making the whole row the click target is the right affordance, and it is exactly what breaks: the button's content is pinned to 30px, the rest paints *outside* the element, and it lands on the row below — text over text, with the divider cutting through it. The plugin's own CSS looks correct in isolation; nothing in it declares a height.

Measured on a real plugin at 820px: `btn.height=30, btn.scrollHeight=78` — 48px of content outside the box, 29px of it spilling into the next row.

Either reset the base rule:

```css
.task-row-button {
  height: auto;
  min-height: 0;
  display: grid;        /* inline-flex centres a single line; grid stacks */
  white-space: normal;  /* app.css sets nowrap */
  text-align: left;     /* app.css centres */
}
```

...or use a non-`<button>` element with a click handler, `role="button"`, and `tabindex="0"`.

The same pin applies to `<input>`, `<select>`, and `<textarea>`.

## Layout overflow findings

`scan_obsidian` reports `layoutOverflow[]` and folds each into `issues[]`:

| Kind | Meaning | Severity |
|------|---------|----------|
| `self-overflow` | `scrollHeight > clientHeight` on an `overflow: visible` box — content is bigger than its box and will not be clipped | warning |
| `container-escape` | an element's rect extends past its parent's border box | warning |
| `sibling-overlap` | two text-bearing elements occupy the same pixels | **error** |

Each finding carries a `culprit` naming the declaration responsible. `culprit.origin: "obsidian-base"` means Obsidian's own rule did it — the finding will name `--input-height` and give the literal reset. Tune with `layoutOverflow: { selfOverflowPx, containerEscapePx, overlapPx }`, disable with `layout_overflow: false`.

## Always verify at two or more widths

This defect class **only manifests when content wraps**, so a single-width scan proves very little. A row that fits on one line at 820px wraps at 390px, and only then does the pinned height overflow.

```bash
npx ibr scan-obsidian ./plugin --view-class TaskView --viewport iphone-14   # 390
npx ibr scan-obsidian ./plugin --view-class TaskView --viewport desktop     # 1440
```

Scan mobile **and** desktop, with a fixture whose text is long enough to wrap at the narrow width. `Platform.isMobile` is inferred from viewport width (≤480 → true) and forks the plugin's own code path, so pass `--mobile` / `--desktop` explicitly when you want to test one branch at a width that would infer the other.

## Do not rely on `var(--x, fallback)` for anything load-bearing

A fallback is what a low-fidelity harness renders, so a load-bearing fallback hides the difference between "styled correctly" and "not styled at all" — you will see a plausible result either way and learn nothing.

```css
/* Fragile: renders acceptably even when --accent is undefined,
   so a broken theme integration looks fine. */
.chip { background: var(--accent, #5a6cb0); }

/* Better: the variable is the contract. Absence is visible. */
.chip { background: var(--interactive-accent); }
```

Use fallbacks for genuinely optional polish, not for the values that decide whether the view is readable.

## Writing a fixture

`view_state` is assigned onto the view instance before `render()` / `onOpen()`. Give it **realistic worst-case content**, not placeholder text:

- long titles that wrap at 390px,
- an empty-state case (zero items),
- the longest label the real data can produce,
- rows in every status the view renders differently.

Short strings pass every check and prove nothing about wrapping.

## Mount failures are fatal by category

A view that throws during mount leaves an empty page, and an empty page has no collisions, no contrast failures, and no undersized targets — it grades as a serene `PASS`. `scan_obsidian` guards this: any harness or stub error is promoted to `error` and the verdict forced to `FAIL`. If you see `unstubbed API used: obsidian.X`, add the export to `src/obsidian/stub.ts` or supply it through `plugin_state`.

## When NOT to use

- Non-Obsidian web UI — use `scan` (see `design-validation`).
- Questions about what the *running* Obsidian renders right now, including host-cascade conflicts on an installed plugin — use `live_measure` against Obsidian's CDP port. `scan_obsidian` mounts the plugin in a synthetic page and cannot see the host workspace's own rules.
- Native macOS/iOS apps — see `native-testing`.
