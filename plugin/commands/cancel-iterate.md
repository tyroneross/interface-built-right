---
description: Cancel an active IBR iterative refinement loop
---

# /ibr:cancel-iterate

Stop an active iterative refinement loop immediately.

## Instructions

1. Check if `.ibr/loop-state.json` exists.

2. If it exists, read it and report the current state:
   - Current iteration number and max
   - Last verdict from history (if any)
   - Whether it was paused

3. Remove the state file:
```bash
rm -f .ibr/loop-state.json
```

4. Confirm: "IBR iterative refinement loop canceled."

5. If no state file exists, report: "No active IBR loop found."
