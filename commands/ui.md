---
description: Launch the IBR design validation dashboard to view scan results, comparisons, and element data
---

# /ibr:ui

Launch the Interface Built Right web UI to view and compare visual snapshots.

## Instructions

Start the web UI server:

```bash
npx ibr serve
```

Then inform the user the dashboard is available at: **http://localhost:4200**

Note: If port 4200 is in use, IBR will automatically find the next available port and display it in the console output.

### Availability

The dashboard ships only with the IBR source repo (the `web-ui/` directory is
not currently included in the published npm tarball — see `package.json#files`).

- If `npx ibr serve` reports "Web UI not bundled in this install", the user
  is on a published npm install without web-ui access. Recommend either:
  - Cloning `tyroneross/interface-built-right` and running `npm run ui`, or
  - Using `mcp__plugin_ibr_ibr__screenshot` for visual checks (ad-hoc), or
  - Inspecting the artifact files directly in `.ibr/sessions/<id>/`.
- If the local install is symlinked to the source repo (e.g. via
  `npm link`), `npx ibr serve` resolves the bundled web-ui correctly from
  any cwd.

To open a specific session directly:
```bash
npx ibr serve --open <session-id>
```

## Features

- Session library panel with all captured snapshots
- Side-by-side comparison view
- Overlay mode with slider
- Diff highlighting showing changed pixels
- Analysis verdicts (MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN)
- Feedback panel for iteration instructions
