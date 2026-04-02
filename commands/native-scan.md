Scan a running iOS or watchOS simulator for design and accessibility issues.

Use the IBR `native_scan` MCP tool to scan the currently running simulator. This extracts the accessibility element tree, validates touch targets (44pt minimum), checks accessibility labels, and enforces watchOS-specific constraints.

If no simulator is booted, first check available simulators with `native_devices`, then ask the user which one to boot.

After scanning, report:
1. The verdict (PASS/ISSUES/FAIL)
2. Total elements found and how many are interactive
3. Any issues (touch target violations, missing labels, watchOS density)
4. Screenshot path if captured

If issues are found, suggest specific fixes for each violation.
