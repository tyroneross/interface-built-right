---
name: visual-view
description: Open the visual comparison UI in the browser to review before/after/diff images. Use this when you want to show the user the visual changes.
arguments:
  - name: sessionId
    description: Optional session ID to view (defaults to most recent session)
    required: false
  - name: port
    description: Port number for the web UI
    required: false
    default: "4200"
---

# Visual View

Open the visual comparison UI in the browser for manual review.

## Usage

```
/visual-view [sessionId] [--port 4200]
```

## Examples

```
/visual-view
/visual-view sess_abc123
/visual-view --port 3200
```

## What This Does

1. Starts the comparison viewer web UI (if not already running)
2. Opens the browser to the session's comparison page
3. User can view:
   - Side-by-side comparison (baseline vs current)
   - Overlay mode with slider
   - Diff image highlighting changes
4. User can provide feedback via the FeedbackPanel

## When to Use

Use `/visual-view` when:
- User wants to see the visual changes themselves
- The comparison report shows `UNEXPECTED_CHANGE` or `LAYOUT_BROKEN`
- You want the user to verify changes before proceeding
- User explicitly asks to see the screenshots

## Current Status

Note: The web UI is under development. Until it's ready, you can point users directly to the screenshot files:

- Baseline: `.ibr/sessions/{sessionId}/baseline.png`
- Current: `.ibr/sessions/{sessionId}/current.png`
- Diff: `.ibr/sessions/{sessionId}/diff.png`

## Implementation

```bash
npx ibr serve --port ${ARGUMENTS.port || '4200'}
```

After starting the server, open:
```
http://localhost:${ARGUMENTS.port || '4200'}/sessions/${ARGUMENTS.sessionId || 'latest'}
```

Or if the web UI isn't ready yet, tell the user where to find the images:
```bash
npx ibr list  # Shows all sessions with their IDs
```

Then direct them to view the PNG files in their file explorer or image viewer.
