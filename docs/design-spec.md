# Design specifications

IBR can turn a saved Figma file API response into a draft design specification, then compare a bound specification with a rendered web page. The specification separates three kinds of authority:

| Mode | Meaning | Checker behavior |
|---|---|---|
| `exact` | The measured value must match. Numeric rules may name an explicit tolerance in CSS pixels. | A different value fails. |
| `bounded` | The builder may choose within a numeric range or a string set. | A value outside the allowance fails. |
| `free` | The builder owns this choice. Guidance may explain the intent. | The choice is reported as free and is not graded. |

An omitted property has no rule. A `free` property makes the design decision explicit to the coding agent. `freeRegions` names whole areas where the agent may design without a measured constraint. Give a free region `bounds` when using `all-scanned` coverage, so the checker can exempt semantic elements inside it.

## Import and bind a Figma frame

Use a saved JSON response from Figma's [GET file endpoint](https://developers.figma.com/docs/rest-api/file-endpoints/). The importer reads visible descendants, including painted containers, with `absoluteBoundingBox`, full `TEXT` content, text styles, solid fills, image references, and prototype destination IDs where present. Figma documents these fields in its [node types](https://developers.figma.com/docs/rest-api/file-node-types/). The draft records how many visible descendants it considered, imported, and skipped; skipped nodes keep the check `PARTIAL`.

```bash
ibr spec:from-figma figma-file.json --frame '12:34' --route /report --out design-spec.json
```

If the file has prototype destinations, pass `--routes routes.json`, where the JSON object maps Figma destination IDs to application paths, for example `{ "56:78": "/details" }`. The importer then writes an exact `href` rule for mapped destinations and leaves unmapped destinations `free` with a mapping note.

The draft preserves source node IDs, full text, and frame-relative geometry. It sets circle circumference (`π × diameter`) only when the native size confirms a circle; Figma returns that size when the file request includes `geometry=paths`. Square render bounds alone can also come from a rotated ellipse, so the importer leaves circumference `free` when native size is absent. It does **not** guess that a Figma layer name is an accessible name, a heading level, or an application route. Add a `match` to each node you want to verify against the rendered page. Map prototype destination IDs to routes by editing `href` rules or the view's `navigation` list. A node without a binding makes the result `PARTIAL`.

For images, Figma's image fills identify image content but do not supply a web asset URL or alt text in this import. Bind the rendered image by its accessible name, and add an `src` rule if the asset path matters. Gradients are imported as `free` guidance because the source paint and the browser's computed CSS are different representations; author an exact rule after choosing the CSS expression if byte-for-byte CSS matters.

## Author the three levels

The following excerpt keeps heading typography fixed, gives geometry a two-pixel interval, and leaves page color and gradient decisions to the builder:

```json
{
  "version": 1,
  "title": "Report",
  "source": { "kind": "authored" },
  "sharedStyle": {
    "heading": {
      "fontFamily": { "mode": "exact", "value": "Inter" },
      "fontWeight": { "mode": "exact", "value": "700" },
      "color": { "mode": "free", "guidance": "Choose for each page while preserving contrast" }
    }
  },
  "views": [{
    "id": "report-desktop",
    "route": "/report",
    "viewport": { "width": 1200, "height": 800 },
    "coverage": "all-scanned",
    "visibleText": { "mode": "exact", "value": "Report\nNext" },
    "navigation": [{ "label": "Next", "destination": { "mode": "exact", "value": "/next" } }],
    "freeRegions": [{ "name": "Background illustration and page gradient", "bounds": { "x": 700, "y": 0, "width": 500, "height": 800 } }],
    "elements": [{
      "id": "title",
      "match": { "role": "heading", "name": "Report", "level": 1 },
      "text": { "mode": "exact", "value": "Report" },
      "geometry": { "x": { "mode": "bounded", "min": 20, "max": 22 } },
      "style": { "backgroundImage": { "mode": "free" } }
    }]
  }]
}
```

`sharedStyle.heading` applies to each heading listed in `elements`; an element's `style` overrides it. `coverage: "all-scanned"` also flags scanned headings, paragraphs, images, links, and buttons that were not named by the spec. `coverage: "listed"` checks only listed elements and navigation. Neither mode claims coverage of decorative DOM, canvas, SVG internals, or content hidden in the current state.

Bindings use semantic role and accessible name. Named HTML landmarks and `<section role="region" aria-label="…">` can bind Figma container frames as `role: "region"`. Decorative containers without a semantic name remain unbound; do not add accessibility labels solely for a visual test. If the page repeats the same role and name, set a one-based `occurrence` on the element `match` or navigation entry. An unnumbered duplicate remains `PARTIAL` instead of choosing one silently.

## Build and verify

1. Give the coding agent the specification. It should implement every `exact` rule, choose inside every `bounded` rule, and design each `free` property or region using the written guidance. The agent must keep the full text and navigation map in its implementation plan.
2. Check a live page at the view's viewport:

   ```bash
   ibr spec:check design-spec.json report-desktop --url http://localhost:3000/report --json
   ```

3. For a saved scan, use `ibr scan http://localhost:3000/report --content --full-text --json > scan.json`, then run `ibr spec:check design-spec.json report-desktop --scan scan.json --json`. The API equivalent is `scan(url, { content: true, fullText: true, viewport })`. Use the same viewport as the spec.
4. A result is `PASS` only when all checked rules pass and no required measurement is missing. `FAIL` means a rule or required semantic element failed. `PARTIAL` means the checker could not establish a required value or binding. Exit codes are 0, 1, and 2 respectively.

The spec checker compares structure, text, navigation destinations, CSS values, and geometry. It does not generate a complete application from a Figma file. IBR's design implementation guidance directs the coding agent to build the app from the contract and run this check after rendering. Native iOS/macOS views and responsive constraints across viewports need separate specifications and validation passes.
