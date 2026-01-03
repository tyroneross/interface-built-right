---
description: Launch the IBR visual comparison web UI dashboard to view screenshots and diffs
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
