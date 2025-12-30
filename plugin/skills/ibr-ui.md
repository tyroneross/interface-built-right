---
description: Launch the visual comparison web UI dashboard
arguments:
  - name: sessionId
    description: Optional session ID to view directly
    required: false
---

# /ibr-ui

Launch the Interface Built Right web UI to view and compare visual snapshots.

## Usage

```
/ibr-ui [sessionId]
```

## Examples

```
/ibr-ui
/ibr-ui sess_abc123
```

## What This Does

1. Starts the web UI server at http://localhost:4200
2. Opens the comparison dashboard
3. Shows all captured sessions
4. Provides side-by-side, overlay, and diff views

## Implementation

```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run ui
```

Then open in browser:
- Dashboard: http://localhost:4200
- Specific session: http://localhost:4200/sessions/${sessionId}

## Features

- Session library panel
- Side-by-side comparison
- Overlay mode with slider
- Diff highlighting
- Analysis verdicts
- Feedback panel for iteration
