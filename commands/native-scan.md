---
name: ibr:native-scan
description: Scan a running iOS or watchOS simulator for design and accessibility issues
---

Scan a running iOS or watchOS simulator for design and accessibility issues.

Run `npx ibr native:scan [device]` via Bash to scan the currently running simulator (the `native_scan` MCP tool does the same thing, but MCP is dormant/opt-in by default — use the CLI). This extracts the accessibility element tree, validates touch targets (44pt minimum), checks accessibility labels, and enforces watchOS-specific constraints.

If no simulator is booted, first check available simulators with `npx ibr native:devices`, then ask the user which one to boot.

After scanning, report:
1. The verdict (PASS/ISSUES/FAIL)
2. Total elements found and how many are interactive
3. Any issues (touch target violations, missing labels, watchOS density)
4. Screenshot path if captured

If issues are found, suggest specific fixes for each violation.
