---
name: ibr:verify-changes
description: Verify all recorded design changes against the live page
arguments:
  - name: url
    description: URL to verify against (or leave blank for localhost detection)
    required: false
---

# IBR Verify Design Changes

Verify all design changes recorded with `ibr:record-change` against the live page.

For each recorded change, IBR launches a headless browser, finds the target element (by accessible name or CSS selector), reads computed CSS properties, and compares them against the recorded expectations.

## When to Use

- After implementing recorded design changes — confirm CSS matches what was specified
- In CI/CD as a regression check — exit 1 if any recorded change no longer holds
- After a refactor — make sure visual properties haven't shifted unexpectedly

## How to Run

```bash
# Verify all changes against live page
npx ibr verify-changes http://localhost:3000

# Verify and output as JSON (for programmatic use)
npx ibr verify-changes http://localhost:3000 --json

# Verify with mobile viewport
npx ibr verify-changes http://localhost:3000 --viewport mobile
```

## Reading the Results

Each recorded change is reported as PASS or FAIL:

```
[PASS] Dark card with rounded corners
  Element: .card
  Verified 3/3 properties
    [ok] borderRadius: "8px" equals "8px" (confidence: 100%)
    [ok] backgroundColor: "rgb(30, 30, 30)" contains "rgb(30" (confidence: 90%)
    [ok] color: "rgb(255, 255, 255)" contains "255" (confidence: 80%)

[FAIL] Hero title 48px bold
  Element: .hero-title
  Verified 1/2 properties, 1 failed
    [ok] fontWeight: "700" equals "700" (confidence: 100%)
    [fail] fontSize: "32px" !== "48px" (confidence: 100%)
```

## Options

| Option | Description |
|--------|-------------|
| `--json` | Output all results as JSON |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All recorded changes verified |
| `1` | One or more changes failed verification |

## Workflow: Record + Verify

```bash
# 1. Make a UI change
# ... edit your component ...

# 2. Record the change with explicit checks
npx ibr record-change http://localhost:3000 \
  --element ".card" \
  --description "Dark card added" \
  --checks '[{"property":"backgroundColor","operator":"contains","value":"rgb(30","confidence":0.9}]'

# 3. Verify the change is live
npx ibr verify-changes http://localhost:3000

# 4. Later, after a refactor — re-verify
npx ibr verify-changes http://localhost:3000
```

## Programmatic API

```typescript
import { loadChanges, verifyAllChanges, formatVerifyResult } from 'interface-built-right/design-verifier';
import { EngineDriver } from 'interface-built-right/engine';

const driver = new EngineDriver();
await driver.launch({ headless: true });
await driver.navigate('http://localhost:3000');

const changes = await loadChanges('.ibr');
const results = await verifyAllChanges(changes, driver);

for (const result of results) {
  console.log(formatVerifyResult(result));
}

await driver.close();
```

## Storage

Recorded changes live at `.ibr/design-changes.json`. Add `.ibr/` to `.gitignore` unless you want to track changes in version control.
