# When to Use IBR vs Playwright

This guide helps you choose the right tool for your needs.

## Quick Decision Matrix

| Use Case | IBR Scan | Screenshot | Playwright |
|----------|:--------:|:----------:|:----------:|
| Verify exact CSS values | ✅ | | |
| Handler detection (is button wired?) | ✅ | | |
| Accessibility audit (ARIA, roles) | ✅ | | |
| Console error detection | ✅ | | |
| Regression baselines | ✅ | | |
| Semantic page understanding | ✅ | | |
| Visual coherence ("does it look right?") | | ✅ | |
| Rendering bugs (clipping, z-index) | | ✅ | |
| Canvas/SVG/WebGL content | | ✅ | |
| Unexpected visual artifacts | | ✅ | |
| E2E user journey tests | | | ✅ |
| Performance testing | | | ✅ |
| Cross-browser matrix | | | ✅ |
| CI/CD test suites | | | ✅ |

**Rule of thumb**: IBR scan for **precise property verification**, screenshots for **holistic visual checks**, Playwright for **behavior + coverage**. Best results combine scan + screenshot.

## When to Use IBR

### 1. Design Validation (Primary Use Case)

Verify that your UI implementation matches what the user described. IBR scans return structured data — exact CSS values, handler detection, accessibility attributes — not pixels.

```bash
# User says "make buttons blue with 16px font"
# You build it, then validate:
npx ibr scan http://localhost:3000/page --json

# Check scan output:
# - computedStyles.backgroundColor on buttons → should be blue
# - computedStyles.fontSize on buttons → should be 16px
```

### 2. AI-Assisted Development

Get semantic understanding of pages for AI-driven workflows.

```typescript
const ibr = new InterfaceBuiltRight({ baseUrl: 'http://localhost:3000' });
const session = await ibr.start('/login');

// AI-friendly page understanding
const understanding = await session.understand();
console.log(understanding.pageIntent);  // 'auth'
console.log(understanding.availableActions);  // ['fill email', 'fill password', 'submit']
```

### 3. Regression Verification

After making changes, verify nothing else broke:

```bash
npx ibr start http://localhost:3000/dashboard --name "before-change"
# ... make changes ...
npx ibr check
```

### 4. Built-in Flow Automation

Common patterns without writing custom selectors.

```typescript
const session = await ibr.start('http://localhost:3000/login');

// One-line login - finds fields semantically
const result = await session.flow.login({
  email: 'test@example.com',
  password: 'secret123',
});
```

### 5. Claude Code Plugin Integration

Design validation directly in your AI coding workflow.

```
/ibr:snapshot http://localhost:3000/settings
# Make UI changes...
/ibr:compare
```

Or validate against user intent directly:
```bash
npx ibr scan http://localhost:3000/settings --json
# Read structured data to confirm implementation matches description
```

## When to Use Playwright Directly

### 1. Comprehensive E2E Test Suites

Full user journey testing with assertions.

```typescript
import { test, expect } from '@playwright/test';

test('user can complete checkout', async ({ page }) => {
  await page.goto('/products');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout"]');
  await page.fill('#email', 'user@example.com');
  await page.click('button[type="submit"]');
  await expect(page.locator('.confirmation')).toBeVisible();
});
```

### 2. Cross-Browser Testing

Test across Chromium, Firefox, and WebKit.

### 3. Parallel Test Execution

Scale testing with Playwright's worker system.

### 4. Network Interception & Mocking

Complex API mocking scenarios.

### 5. Performance Testing

Measure Core Web Vitals and performance metrics.

## Using Both Together

IBR and Playwright complement each other. Use IBR for design validation and semantic understanding, Playwright for behavioral tests.

### Recommended Workflow

```
1. Development Phase
   └── Use IBR for design validation
       Build UI → npx ibr scan <url> --json → verify against description

2. Pre-Commit
   └── Run IBR regression check on changed routes
       npx ibr check

3. CI/CD Pipeline
   └── Run Playwright E2E test suite
       npx playwright test
   └── Run IBR regression check
       npx ibr check --all

4. Code Review
   └── Review IBR scan results for design compliance
   └── Review Playwright test results for behavior
```

### Integration Example

```typescript
// Design validation using IBR
import { compare } from '@tyroneross/interface-built-right';

describe('Dashboard Design', () => {
  it('matches design specs', async () => {
    const result = await compare({
      url: 'http://localhost:3000/dashboard',
      baselinePath: './baselines/dashboard.png',
    });
    expect(result.verdict).toBe('MATCH');
  });
});

// Behavioral test using Playwright
import { test, expect } from '@playwright/test';

test('dashboard shows user data', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('[data-testid="user-name"]')).toContainText('John');
  await expect(page.locator('[data-testid="stats"]')).toBeVisible();
});
```

## Summary

| Aspect | IBR | Playwright |
|--------|-----|------------|
| **Primary Use** | Design validation | Behavioral testing |
| **Output** | Structured data, diffs, verdicts | Test results, traces |
| **AI Integration** | Built-in semantic layer | Manual integration |
| **Data Type** | Computed CSS, handlers, a11y, bounds | Pixel screenshots, DOM |
| **Learning Curve** | Low (simple API) | Medium (full framework) |
| **Best For** | Verifying UI matches intent | Comprehensive test coverage |

Choose IBR when you need:
- Validate UI matches what user described
- Structured CSS/layout data (not pixels)
- Handler detection and accessibility audit
- AI-friendly page understanding
- Claude Code integration
- Regression baselines

Choose Playwright when you need:
- Full E2E test suites
- Cross-browser testing
- Parallel execution
- Complex assertions
