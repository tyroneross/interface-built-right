# IBR agent quickstart

Copy-paste invocations and the real field names. `AGENTS.md` explains what IBR
*is*; this page is what to *type* and what comes back. Everything here was
verified against a live scan — the field names are the ones the code emits, not
the ones you would guess.

## Scan a page, keep the output on disk

```bash
ibr scan http://localhost:3000 --json > scan.json    # stdout is PURE JSON
ibr scan http://localhost:3000 --json | jq '.verdict'
```

Progress goes to **stderr**, so stdout is safe to pipe or parse. A scan of a
real page is large — write it to a file and read fields out of it. Never read a
whole scan into a model's context.

## The shape you actually get back

```jsonc
{
  "viewport": { "name": "desktop", "width": 1920, "height": 1080 },
  "elements": {
    "all": [                                   // <- the element list lives HERE
      {
        "tagName": "button",
        "text": "Submit Order",
        "selector": "...",
        "bounds": { "x": 1717, "y": 48, "width": 139, "height": 46 },
        "computedStyles": { "color": "...", "backgroundColor": "..." },
        "interactive": { "hasOnClick": false, "hasHref": false,
                         "isDisabled": false, "tabIndex": 0, "cursor": "pointer" },
        "a11y": { }
      }
    ]
  },
  "ruleEngine": [], "coverage": { }, "verdict": "...", "issues": []
}
```

Read elements from **`elements.all[]`** — not from a top-level `elements` array.
`bounds` is in **pixels**: `{x, y, width, height}`.

## Interactivity is SIGNALS, not one boolean

There is **no `isInteractive` field.** Asking for one returns `undefined`, which
is falsy, which silently filters out every element and hands you an empty result
with no error. Decide from the signals plus the tag:

```js
const ia = el.interactive ?? {}
const tag = (el.tagName ?? '').toLowerCase()
const interactive =
  ['button','a','input','select','textarea'].includes(tag)
  || ia.hasOnClick === true
  || ia.hasHref === true
  || ia.cursor === 'pointer'
  || (typeof ia.tabIndex === 'number' && ia.tabIndex >= 0)
const usable = interactive && !ia.isDisabled
```

`src/zoom-track.ts` exports `isInteractiveElement()` if you would rather import
it than re-derive it.

## Emit a Spectra zoom track

```bash
ibr zoom-track http://localhost:3000 --out clicks.json
spectra polish recording.mp4 --clicks-json clicks.json
```

Writes `[{tMs, cx, cy, scrollY}]`. `cx`/`cy` are the element centre as a
**fraction of the viewport** at that scroll position — the shape Spectra's
`buildZoomTrack()` already accepts. `scrollY` is an extra field Spectra ignores,
so the whole page is reachable from one scan instead of just the first screenful.
`--out`, not `-o`: the program reserves `-o/--output` globally.

Even spacing is a **placeholder** — a static scan cannot know when anything
happened in a recording. Pass real times when you have them:

```bash
echo '[{"tMs":1200,"label":"Submit Order"}]' > events.json
ibr zoom-track http://localhost:3000 --events events.json --out clicks.json
```

Labels match element text (then selector), case-insensitively. Events matching
nothing are reported, never silently dropped.

### Text, colours, importance

```bash
ibr zoom-track http://localhost:3000 --rich --max 6 --out clicks.json
```

`--rich` adds `text` (verbatim), `role`, `weight` (0..1), and both raw and
resolved colours per target:

```json
{ "tMs": 0, "cx": 0.93, "cy": 0.07, "scrollY": 0,
  "text": "Export", "role": "button", "weight": 1,
  "backgroundColor": "oklch(0.606 0.25 292.717)", "backgroundColorHex": "#8e51ff" }
```

Spectra ignores the extra fields, so one file drives a zoom *and* a caption or a
recolour. An undecodable or transparent colour is left **undefined** — never
defaulted, because an edit applied against an invented colour is worse than one
you know you have to resolve.

`--max` keeps the highest-weight targets and restores time order, so trimming a
busy page keeps the primary action rather than whatever was scanned first.

## What a scan does NOT give you

**Headings have text but no geometry.** `sensors.hierarchy` reports h1–h6 counts
and texts; `sensors.typography` reports size and weight per selector. Neither
carries `bounds`, and `elements.all` comes from `INTERACTIVE_SELECTORS`
(`src/extract.ts`), which excludes headings by design. So you can *read* the
heading outline but cannot zoom to, caption, or recolour a specific heading.

**No SEO metadata.** There is no `<title>`, meta description, canonical, or
og:/twitter: tag anywhere in a scan result. `semantic.title` exists but is
populated from the page's accessible title, not the `<head>`.

Both need a content-element extraction that does not exist yet. Do not infer
either from a scan — it will look empty rather than unsupported.

## Running your own probe

When a scan cannot answer the question, IBR runs a sandboxed script for you:

```bash
ibr run-script probe.py --url http://localhost:3000 --timeout 60000 --memory 512
```

The URL arrives as `IBR_URL`. Resource limits are enforced, so a runaway probe
cannot take the machine with it.

Finding nothing is an **error, not an empty file**: exit 1, no file written, and
a message saying whether the page returned no elements at all or returned
elements of which none were interactive.

## The rule behind all of this

A tool that cannot measure must say so. If a command hands you an empty result
and exit 0, treat it as unproven rather than clean — and if you are writing one,
make the empty case loud enough that nobody has to.
