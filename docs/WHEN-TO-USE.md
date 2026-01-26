# When to Use IBR vs Playwright

This guide helps you choose the right tool for your testing needs.

## Quick Decision Matrix

| Use Case | Use IBR | Use Playwright |
|----------|:-------:|:--------------:|
| Visual regression baselines | ✅ | |
| AI-assisted UI verification | ✅ | |
| Semantic page understanding | ✅ | |
| Login/form automation flows | ✅ | |
| Claude Code integration | ✅ | |
| Unit component tests | | ✅ |
| E2E user journey tests | | ✅ |
| Performance testing | | ✅ |
| Cross-browser matrix | | ✅ |
| Parallel test execution | | ✅ |
| CI/CD test suites | | ✅ |

**Rule of thumb**: IBR for **visual + semantic**, Playwright for **behavior + coverage**.

## When to Use IBR

### 1. Visual Regression Testing

Capture baseline screenshots and detect unintended visual changes.

```typescript
import { compare } from '@tyroneross/interface-built-right';

// Simple one-line comparison
const result = await compare({
  url: 'http://localhost:3000/dashboard',
  baselinePath: './baselines/dashboard.png',
});

if (result.verdict !== 'MATCH') {
  console.log('Visual changes detected:', result.summary);
}
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

### 3. Built-in Flow Automation

Common patterns without writing custom selectors.

```typescript
const session = await ibr.start('http://localhost:3000/login');

// One-line login - finds fields semantically
const result = await session.flow.login({
  email: 'test@example.com',
  password: 'secret123',
});

if (result.success) {
  console.log('Logged in successfully');
}
```

### 4. Claude Code Plugin Integration

Visual verification directly in your AI coding workflow.

```
/ibr:snapshot http://localhost:3000/settings
# Make UI changes...
/ibr:compare
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

```typescript
// playwright.config.ts
export default {
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
};
```

### 3. Parallel Test Execution

Scale testing with Playwright's worker system.

```bash
npx playwright test --workers=4
```

### 4. Network Interception & Mocking

Complex API mocking scenarios.

```typescript
await page.route('**/api/users', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 1, name: 'Mock User' }]),
  });
});
```

### 5. Performance Testing

Measure Core Web Vitals and performance metrics.

```typescript
const metrics = await page.evaluate(() => performance.getEntriesByType('navigation'));
```

## Using Both Together

IBR and Playwright complement each other. Use IBR for visual baselines and semantic understanding, Playwright for behavioral tests.

### Recommended Workflow

```
1. Development Phase
   └── Use IBR for quick visual verification
       /ibr:snapshot → make changes → /ibr:compare

2. Pre-Commit
   └── Run IBR visual regression on changed routes
       npx ibr check

3. CI/CD Pipeline
   └── Run Playwright E2E test suite
       npx playwright test
   └── Run IBR visual regression
       npx ibr check --all

4. Code Review
   └── Review IBR diff images for visual changes
   └── Review Playwright test results for behavior
```

### Integration Example

```typescript
// Visual test using IBR
import { compare } from '@tyroneross/interface-built-right';

describe('Dashboard Visual', () => {
  it('matches baseline', async () => {
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
| **Primary Use** | Visual verification | Behavioral testing |
| **Output** | Screenshots, diffs, verdicts | Test results, traces |
| **AI Integration** | Built-in semantic layer | Manual integration |
| **Learning Curve** | Low (simple API) | Medium (full framework) |
| **Best For** | Rapid visual feedback | Comprehensive test coverage |

Choose IBR when you need:
- Quick visual regression checks
- AI-friendly page understanding
- Claude Code integration
- Built-in automation flows

Choose Playwright when you need:
- Full E2E test suites
- Cross-browser testing
- Parallel execution
- Complex assertions
