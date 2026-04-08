# Design System Checks in All Scan Paths

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run `runDesignSystemCheck()` in all 5 scan paths so design system violations appear everywhere scans happen, not just the main `scan()` function.

**Architecture:** Extract the "run design system check + inject issues" logic into a reusable helper (`applyDesignSystemCheck`) that takes extracted elements, a viewport, a URL, and an outputDir. Each scan path calls it after `aggregateIssues()`. Native scan gets an optional `outputDir` parameter.

**Tech Stack:** TypeScript, existing IBR scan/design-system modules.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/scan.ts` | Modify | Extract design system block into `applyDesignSystemCheck()` helper, export it. Main `scan()` calls it. |
| `src/live-session.ts` | Modify | Call `applyDesignSystemCheck()` in `scanPage()` (line 298) and `runScanAnalysis()` (line 446). Has `this.outputDir`. |
| `src/browser-server.ts` | Modify | Call `applyDesignSystemCheck()` in `scanPage()` (line 895) and capture scan (line 990). Has `outputDir` via constructor. |
| `src/native/scan.ts` | Modify | Call `applyDesignSystemCheck()` in `scanMacOS()` (line 238). Add optional `outputDir` to `MacOSScanOptions`. |
| `src/native/types.ts` | Modify | Add `outputDir?: string` to `MacOSScanOptions` and `NativeScanOptions`. |
| `src/scan.test.ts` (or new) | Create | Test `applyDesignSystemCheck()` in isolation. |

---

### Task 1: Extract `applyDesignSystemCheck()` helper from scan.ts

**Files:**
- Modify: `src/scan.ts:272-315` (current inline design system block)
- Test: `src/design-system/apply.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/design-system/apply.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { EnhancedElement, Viewport } from '../schemas.js';

// Will import after implementation
// import { applyDesignSystemCheck } from '../scan.js';

function mockElement(overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: 'li.item',
    tagName: 'li',
    text: 'Item',
    bounds: { x: 0, y: 0, width: 200, height: 50 },
    computedStyles: { border: '1px solid black' },
    interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
    a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    ...overrides,
  } as EnhancedElement;
}

describe('applyDesignSystemCheck', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'ibr-ds-apply-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns undefined and empty issues when no config exists', async () => {
    const { applyDesignSystemCheck } = await import('../scan.js');
    const elements = [mockElement()];
    const issues: any[] = [];
    const viewport: Viewport = { name: 'desktop', width: 1920, height: 1080 };

    const result = await applyDesignSystemCheck(elements, issues, viewport, 'http://localhost:3000', testDir);
    expect(result).toBeUndefined();
    expect(issues.length).toBe(0);
  });

  it('adds principle violations to issues when config exists', async () => {
    const { applyDesignSystemCheck } = await import('../scan.js');
    await mkdir(join(testDir, '.ibr'), { recursive: true });
    await writeFile(join(testDir, '.ibr', 'design-system.json'), JSON.stringify({
      version: 1,
      name: 'Test',
      principles: { calmPrecision: { core: ['gestalt'], stylistic: [], severity: { gestalt: 'error' } } },
      tokens: {},
    }));

    const elements = [mockElement({ tagName: 'li', computedStyles: { border: '1px solid black' } })];
    const issues: any[] = [];
    const viewport: Viewport = { name: 'desktop', width: 1920, height: 1080 };

    const result = await applyDesignSystemCheck(elements, issues, viewport, 'http://localhost:3000', testDir);
    expect(result).toBeDefined();
    expect(result!.configName).toBe('Test');
    expect(issues.some((i: any) => i.category === 'design-system')).toBe(true);
  });

  it('returns designSystem result with complianceScore', async () => {
    const { applyDesignSystemCheck } = await import('../scan.js');
    await mkdir(join(testDir, '.ibr'), { recursive: true });
    await writeFile(join(testDir, '.ibr', 'design-system.json'), JSON.stringify({
      version: 1,
      name: 'Test',
      tokens: { colors: { primary: '#3b82f6' } },
    }));

    const elements = [mockElement({ computedStyles: { color: '#ff0000' } })];
    const issues: any[] = [];
    const viewport: Viewport = { name: 'desktop', width: 1920, height: 1080 };

    const result = await applyDesignSystemCheck(elements, issues, viewport, 'http://localhost:3000', testDir);
    expect(result).toBeDefined();
    expect(typeof result!.complianceScore).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/design-system/apply.test.ts`
Expected: FAIL — `applyDesignSystemCheck` not exported from scan.ts

- [ ] **Step 3: Extract helper in scan.ts**

In `src/scan.ts`, extract lines 272-315 into a new exported async function. Replace the inline block with a call to it.

```typescript
import type { DesignSystemResult } from './schemas.js';

/**
 * Run design system checks and inject violations into the issues array.
 * Returns the DesignSystemResult or undefined if no config.
 * Mutates the issues array by pushing design-system category issues.
 *
 * Reusable across all scan paths (main scan, live session, browser server, native).
 */
export async function applyDesignSystemCheck(
  elements: EnhancedElement[],
  issues: ScanIssue[],
  viewport: Viewport,
  url: string,
  outputDir: string
): Promise<DesignSystemResult | undefined> {
  const designSystem = await runDesignSystemCheck(
    elements,
    {
      isMobile: viewport.width < 768,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      url,
      allElements: elements,
    },
    outputDir
  ).catch(() => undefined);

  if (designSystem) {
    for (const v of designSystem.principleViolations) {
      issues.push({
        category: 'design-system' as const,
        severity: v.severity === 'error' ? 'error' as const : 'warning' as const,
        element: v.element,
        description: v.message,
        fix: v.fix,
      });
    }
    for (const v of designSystem.tokenViolations) {
      issues.push({
        category: 'design-system' as const,
        severity: v.severity === 'error' ? 'error' as const : 'warning' as const,
        element: v.element,
        description: v.message,
      });
    }
    for (const v of designSystem.customViolations) {
      issues.push({
        category: 'design-system' as const,
        severity: v.severity === 'error' ? 'error' as const : 'warning' as const,
        element: v.element,
        description: v.message,
        fix: v.fix,
      });
    }
  }

  return designSystem;
}
```

Then in `scan()`, replace the inline block (lines 272-315) with:

```typescript
const designSystem = await applyDesignSystemCheck(
  elements.all, issues, resolvedViewport, url,
  options.outputDir || process.cwd()
);
```

Move the `designSystem` call to AFTER `aggregateIssues()` since it mutates the issues array.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/design-system/apply.test.ts`
Expected: PASS

- [ ] **Step 5: Run full suite to verify no regression**

Run: `npx vitest run`
Expected: All 421+ tests pass

- [ ] **Step 6: Commit**

```bash
git add src/scan.ts src/design-system/apply.test.ts
git commit -m "refactor: extract applyDesignSystemCheck() for reuse across scan paths"
```

---

### Task 2: Integrate into LiveSession (live-session.ts)

**Files:**
- Modify: `src/live-session.ts:282-324` (scanPage) and `src/live-session.ts:435-469` (runScanAnalysis)

- [ ] **Step 1: Add import**

At top of `src/live-session.ts`, add:

```typescript
import { applyDesignSystemCheck } from './scan.js';
```

(Already imports `aggregateIssues`, `determineVerdict`, `generateSummary` from scan.js — add to same import.)

- [ ] **Step 2: Add design system check to scanPage()**

After line 298 (`const issues = aggregateIssues(...)`), add:

```typescript
const designSystem = await applyDesignSystemCheck(
  elements.all, issues, this.state.viewport, this.url, this.outputDir
);
```

Add `designSystem` to the result object (line 309):

```typescript
const result: ScanResult = {
  // ... existing fields ...
  designSystem,  // ADD THIS
  verdict,
  issues,
  summary,
};
```

- [ ] **Step 3: Add design system check to runScanAnalysis()**

After line 446 (`const issues = aggregateIssues(...)`), add the same pattern:

```typescript
const designSystem = await applyDesignSystemCheck(
  elements.all, issues, this.state.viewport, this.url, this.outputDir
);
```

Add `designSystem` to the return object (line 457):

```typescript
return {
  // ... existing fields ...
  designSystem,  // ADD THIS
  verdict,
  issues,
  summary,
};
```

- [ ] **Step 4: Recompute verdict AFTER design system issues are added**

In both methods, move `determineVerdict(issues)` to AFTER `applyDesignSystemCheck()`:

```typescript
const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
const designSystem = await applyDesignSystemCheck(
  elements.all, issues, this.state.viewport, this.url, this.outputDir
);
const verdict = determineVerdict(issues);  // MUST come after design system issues are added
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/live-session.ts
git commit -m "feat: run design system checks in LiveSession scan paths"
```

---

### Task 3: Integrate into BrowserServer (browser-server.ts)

**Files:**
- Modify: `src/browser-server.ts:882-930` (scanPage) and `src/browser-server.ts:975-1020` (capture scan)

- [ ] **Step 1: Add import**

At top of `src/browser-server.ts`, add `applyDesignSystemCheck` to the import from `./scan.js`.

- [ ] **Step 2: Find outputDir in BrowserServer**

The `BrowserServer` class stores its state. Check for `this.outputDir` or `this.state.outputDir`. The constructor receives `outputDir` — confirm it's stored as an instance property. If not, it's available via the `getPaths(outputDir)` pattern.

Read `src/browser-server.ts` lines 160-180 to find the class constructor and confirm `outputDir` is accessible.

- [ ] **Step 3: Add design system check to scanPage()**

After line 895 (`const issues = aggregateIssues(...)`), add:

```typescript
const designSystem = await applyDesignSystemCheck(
  elements.all, issues, this.state.viewport, this.url, this.outputDir
);
```

Move `determineVerdict(issues)` to after this call. Add `designSystem` to result.

- [ ] **Step 4: Add design system check to capture scan**

After line 990 (`const issues = aggregateIssues(...)`), same pattern. Move verdict after. Add to result.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/browser-server.ts
git commit -m "feat: run design system checks in BrowserServer scan paths"
```

---

### Task 4: Integrate into native scan (native/scan.ts)

**Files:**
- Modify: `src/native/scan.ts:238`
- Modify: `src/native/types.ts` — add `outputDir?: string` to scan options

- [ ] **Step 1: Add outputDir to native scan options**

In `src/native/types.ts`, find `MacOSScanOptions` and `NativeScanOptions` interfaces. Add:

```typescript
/** IBR output directory — needed for design system config lookup */
outputDir?: string;
```

- [ ] **Step 2: Add import to native/scan.ts**

```typescript
import { applyDesignSystemCheck } from '../scan.js';
```

- [ ] **Step 3: Add design system check to scanMacOS()**

After line 238 (`const issues = aggregateIssues(audit, interactivity, semantic, []);`), add:

```typescript
const designSystem = options.outputDir ? await applyDesignSystemCheck(
  elements, issues, viewport, url, options.outputDir
) : undefined;
```

Where `options` is the function parameter. Move `determineVerdict(issues)` to after this call.

Add `designSystem` to the return object.

- [ ] **Step 4: Add design system check to native simulator scan**

Find the iOS/watchOS scan function in the same file. Apply the same pattern — check for `options.outputDir`, call `applyDesignSystemCheck()` if present.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add src/native/scan.ts src/native/types.ts
git commit -m "feat: run design system checks in native scan paths"
```

---

### Task 5: Export from index.ts + build + verify

**Files:**
- Modify: `src/index.ts` — export `applyDesignSystemCheck`
- Build + test

- [ ] **Step 1: Add export**

In `src/index.ts`, find the scan exports section and add:

```typescript
export { scan, formatScanResult, applyDesignSystemCheck } from './scan.js';
```

- [ ] **Step 2: Build**

Run: `./node_modules/.bin/tsup`
Expected: All 5 build outputs succeed

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (421 + new apply.test.ts tests)

- [ ] **Step 4: Install globally and verify**

```bash
npm install -g .
ibr --version  # should show 0.8.0
```

- [ ] **Step 5: Commit and push**

```bash
git add src/index.ts dist/
git commit -m "feat: design system checks in all scan paths — complete"
git push origin main
```
