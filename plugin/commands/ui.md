---
description: Launch the IBR visual comparison web UI dashboard at localhost:4242
---

# /ibr-ui

Launch the Interface Built Right web UI to view and compare visual snapshots.

## Instructions

Start the web UI server:

```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run ui
```

Then inform the user the dashboard is available at: **http://localhost:4242**

## Features

- Session library panel with all captured snapshots
- Side-by-side comparison view
- Overlay mode with slider
- Diff highlighting
- Analysis verdicts (MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN)
- Feedback panel for iteration instructions
