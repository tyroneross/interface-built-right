# IBR 2.0: Lightweight Semantic Layer on Playwright

## Vision

Make IBR a **thin, smart layer** on top of Playwright that adds semantic intelligence without reimplementing Playwright's internals.

**Key Insight**: Don't replace Playwright - **enhance it**. Playwright already handles browsers, parallelism, cross-browser. IBR adds what's missing: semantic understanding and simpler API.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    IBR 2.0 (Thin Layer)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │    Simpler API      │    │    Semantic Output      │    │
│  │                     │    │                         │    │
│  │  • ibr.start()      │    │  • Page intent          │    │
│  │  • ibr.click()      │    │  • Auth state           │    │
│  │  • ibr.verify()     │    │  • Loading state        │    │
│  │  • ibr.flow.login() │    │  • Verdicts             │    │
│  │  • ibr.audit()      │    │  • Recovery hints       │    │
│  └─────────────────────┘    └─────────────────────────┘    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                  Playwright (Unchanged)                      │
│                                                             │
│  • Browser control        • Network interception            │
│  • Parallel workers       • Cross-browser                   │
│  • Test runner            • Device emulation                │
│  • Page interactions      • Screenshots                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## What We Build vs What We Reuse

### We BUILD (IBR's Unique Value)

| Component | Purpose | Compute Cost |
|-----------|---------|--------------|
| **Semantic Layer** | AI agents need understanding, not raw data | Low (JS analysis) |
| **Simpler API** | Hide Playwright complexity | Zero (thin wrapper) |
| **Built-in Flows** | Common patterns shouldn't need code | Low (templates) |
| **MCP Server** | Universal AI IDE integration | Low (stdio server) |
| **Smart Output** | Verdicts > pixel counts | Low (classification) |

### We REUSE (Playwright's Existing Capabilities)

| Feature | Why Reuse | How |
|---------|-----------|-----|
| Engine/browser control | Already excellent, battle-tested | Direct Playwright calls |
| Test runner | Already solved | `@playwright/test` or Vitest |
| Parallel execution | Complex, Playwright does it well | Playwright's workers |
| Cross-browser | Already works | Playwright's browser configs |
| Network interception | Already excellent | `page.route()` |
| Device emulation | Already complete | Playwright's device presets |

---

## Target File Structure

```
interface-built-right/
├── src/
│   ├── index.ts                    # Main API entry (MODIFY)
│   ├── browser-server.ts           # Session management (MODIFY)
│   ├── capture.ts                  # Screenshot capture (existing)
│   ├── compare.ts                  # Visual comparison (existing)
│   ├── extract.ts                  # Element extraction (existing)
│   │
│   ├── semantic/                   # NEW - Semantic intelligence
│   │   ├── index.ts                # Exports
│   │   ├── page-intent.ts          # Page type classification
│   │   ├── state-detector.ts       # Auth/loading/error detection
│   │   └── output.ts               # Semantic output formatter
│   │
│   ├── flows/                      # NEW - Built-in flow templates
│   │   ├── index.ts                # Flow registry
│   │   ├── login.ts                # Login flow
│   │   ├── logout.ts               # Logout flow
│   │   ├── search.ts               # Search flow
│   │   └── form.ts                 # Form submission flow
│   │
│   └── mcp-server/                 # NEW - MCP server
│       ├── index.ts                # Server entry point
│       ├── tools.ts                # Tool implementations
│       └── handlers.ts             # Request handlers
│
├── plugin/
│   └── universal/
│       └── tools.yaml              # Tool definitions (MODIFY)
│
└── docs/
    └── IBR-2.0-ARCHITECTURE.md     # This document
```

---

## Semantic Layer Design

### Page Intent Classification

```typescript
// src/semantic/page-intent.ts

type PageIntent =
  | 'auth'        // Login, register, forgot-password
  | 'form'        // Contact, settings, profile edit
  | 'listing'     // Search results, product grid, table
  | 'detail'      // Product page, article, profile view
  | 'dashboard'   // Admin panel, user home
  | 'error'       // 404, 500, access denied
  | 'unknown';

interface PageIntentResult {
  intent: PageIntent;
  confidence: number;        // 0-1
  signals: string[];         // What led to this classification
}

// Classification based on DOM signals
async function classifyPageIntent(page: Page): Promise<PageIntentResult> {
  // Check for auth signals
  const hasLoginForm = await page.$('form input[type="password"]');
  const hasEmailField = await page.$('input[type="email"], input[name*="email"]');

  // Check for listing signals
  const hasList = await page.$$('[class*="list"], [class*="grid"], table tbody tr');

  // Check for error signals
  const hasErrorCode = await page.$text(/404|500|error|denied/i);

  // ... more heuristics
}
```

### State Detection

```typescript
// src/semantic/state-detector.ts

interface PageState {
  authenticated: boolean | null;  // null = can't determine
  loading: boolean;
  hasErrors: boolean;
  errors: string[];
}

async function detectPageState(page: Page): Promise<PageState> {
  // Auth detection signals
  const authSignals = {
    logoutButton: await page.$('button:has-text("logout"), a:has-text("sign out")'),
    userMenu: await page.$('[class*="user"], [class*="avatar"], [class*="profile"]'),
    loginLink: await page.$('a:has-text("login"), a:has-text("sign in")'),
  };

  // Loading detection
  const loadingSignals = {
    spinner: await page.$('[class*="spinner"], [class*="loading"]'),
    skeleton: await page.$('[class*="skeleton"]'),
    progressBar: await page.$('progress, [role="progressbar"]'),
  };

  // Error detection
  const errorSignals = {
    errorMessage: await page.$('[class*="error"], [role="alert"]'),
    errorText: await page.$text(/error|failed|invalid/i),
  };

  return {
    authenticated: authSignals.logoutButton || authSignals.userMenu
      ? true
      : authSignals.loginLink ? false : null,
    loading: !!(loadingSignals.spinner || loadingSignals.skeleton),
    hasErrors: !!(errorSignals.errorMessage || errorSignals.errorText),
    errors: [], // Extract actual error messages
  };
}
```

### Semantic Output Format

```typescript
// src/semantic/output.ts

interface SemanticResult {
  // Primary verdict for decision loops
  verdict: 'PASS' | 'ISSUES' | 'FAIL';
  confidence: number;

  // Page understanding
  pageIntent: PageIntent;
  state: PageState;

  // Available actions on this page
  availableActions: string[];

  // Issues found (if any)
  issues: SemanticIssue[];

  // Recovery suggestions (if failed)
  recovery?: {
    suggestion: string;
    alternatives?: string[];
  };
}

interface SemanticIssue {
  severity: 'critical' | 'major' | 'minor';
  type: string;
  element: string;      // Human-readable description
  problem: string;
  fix: string;
}
```

---

## Built-in Flows Design

### Login Flow

```typescript
// src/flows/login.ts

interface LoginOptions {
  email: string;
  password: string;
  successIndicator?: string;  // Semantic: 'dashboard', 'home', or selector
  timeout?: number;
}

interface FlowResult {
  success: boolean;
  steps: FlowStep[];
  finalState: PageState;
  error?: string;
}

async function loginFlow(page: Page, opts: LoginOptions): Promise<FlowResult> {
  const steps: FlowStep[] = [];

  // Step 1: Find email field semantically
  const emailField = await findFieldByLabel(page, ['email', 'username', 'login']);
  if (!emailField) {
    return { success: false, error: 'Could not find email field', steps, finalState: {} };
  }

  await emailField.fill(opts.email);
  steps.push({ action: 'fill email', success: true });

  // Step 2: Find password field
  const passField = await page.$('input[type="password"]');
  await passField?.fill(opts.password);
  steps.push({ action: 'fill password', success: true });

  // Step 3: Submit
  await page.click('button[type="submit"], input[type="submit"]');
  steps.push({ action: 'submit form', success: true });

  // Step 4: Verify success
  await page.waitForNavigation({ timeout: opts.timeout || 10000 });

  const intent = await classifyPageIntent(page);
  const state = await detectPageState(page);

  const success = opts.successIndicator
    ? intent === opts.successIndicator || state.authenticated
    : state.authenticated === true;

  return { success, steps, finalState: state };
}
```

### Flow Registry

```typescript
// src/flows/index.ts

export const flows = {
  login: loginFlow,
  logout: logoutFlow,
  search: searchFlow,
  submit: formSubmitFlow,
};

// Usage: ibr.flow.login({ email, password })
```

---

## Simpler API Design

### Current vs New API

```typescript
// ❌ Playwright (verbose)
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('http://localhost:3000');
await page.fill('#email', 'test@test.com');
await page.fill('#password', 'secret');
await page.click('button[type="submit"]');
await page.waitForNavigation();
const isLoggedIn = await page.$('.user-menu');

// ✅ IBR (simple)
const session = await ibr.start('http://localhost:3000');
const result = await session.flow.login({
  email: 'test@test.com',
  password: 'secret'
});
// result = { success: true, finalState: { authenticated: true } }
```

### API Surface

```typescript
// src/index.ts

class InterfaceBuiltRight {
  // Simplified session management
  async start(url: string, options?: StartOptions): Promise<IBRSession>;

  // Semantic verification
  async verify(url: string, expected: ExpectedState): Promise<VerifyResult>;

  // UI audit
  async audit(url: string, options?: AuditOptions): Promise<AuditResult>;

  // Built-in flows
  flow: {
    login: (opts: LoginOptions) => Promise<FlowResult>;
    logout: (opts?: LogoutOptions) => Promise<FlowResult>;
    search: (opts: SearchOptions) => Promise<FlowResult>;
    submit: (opts: FormOptions) => Promise<FlowResult>;
  };
}

interface IBRSession {
  page: Page;  // Raw Playwright page for advanced use

  // Simplified actions
  click(target: string): Promise<void>;
  type(target: string, text: string): Promise<void>;

  // Semantic helpers
  understand(): Promise<SemanticResult>;
  verify(expected: ExpectedState): Promise<VerifyResult>;

  // Network helpers (thin wrapper on page.route)
  mock(pattern: string, response: MockResponse): Promise<void>;

  // Cleanup
  close(): Promise<void>;
}
```

---

## MCP Server Design

### Tool Definitions

```yaml
# plugin/universal/tools.yaml (additions)

- id: ibr_understand
  name: Understand Page
  description: Get semantic understanding of current page state
  params:
    - name: url
      type: string
      required: true
  returns:
    - intent: string
    - authenticated: boolean
    - loading: boolean
    - errors: array
    - availableActions: array

- id: ibr_verify
  name: Verify Page State
  description: Verify page matches expected state
  params:
    - name: url
      type: string
      required: true
    - name: expected
      type: object
      properties:
        intent: string
        contains: array
        excludes: array
        authenticated: boolean
  returns:
    - verified: boolean
    - confidence: number
    - matches: array
    - mismatches: array

- id: ibr_flow
  name: Run Flow
  description: Execute a built-in flow (login, logout, search, etc.)
  params:
    - name: flow
      type: string
      enum: [login, logout, search, submit]
    - name: params
      type: object
  returns:
    - success: boolean
    - steps: array
    - finalState: object
```

### Server Implementation

```typescript
// src/mcp-server/index.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { InterfaceBuiltRight } from '../index.js';

const server = new Server({
  name: 'ibr',
  version: '2.0.0',
});

const ibr = new InterfaceBuiltRight();

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case 'ibr_understand': {
      const session = await ibr.start(request.params.arguments.url);
      const result = await session.understand();
      await session.close();
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }

    case 'ibr_verify': {
      const result = await ibr.verify(
        request.params.arguments.url,
        request.params.arguments.expected
      );
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }

    case 'ibr_flow': {
      const session = await ibr.start(request.params.arguments.url);
      const result = await session.flow[request.params.arguments.flow](
        request.params.arguments.params
      );
      await session.close();
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Implementation Status

### Semantic Layer + Simpler API (COMPLETED)
- [x] Create `src/semantic/` directory structure
- [x] Implement `classifyPageIntent(page)` - page-intent.ts
- [x] Implement `detectPageState(page)` - state-detector.ts
- [x] Implement `getSemanticOutput(page)` - output.ts
- [x] Add `ibr.start()` wrapper method
- [x] Add `session.understand()` method
- [x] Add `IBRSession` class with simpler API

### Built-in Flows + Mock Helpers (COMPLETED)
- [x] Create `src/flows/` directory structure
- [x] Implement `loginFlow(page, opts)` - login.ts
- [x] Implement `searchFlow(page, opts)` - search.ts
- [x] Implement `formFlow(page, opts)` - form.ts
- [x] Add `session.mock(pattern, response)` wrapper
- [x] Add `session.flow.login/search/form` shortcuts

### MCP Server (SKIPPED)
- Not needed for Claude Code workflow (CLI + hooks sufficient)

### Plugin Commands (COMPLETED)
- [x] Add `/ibr:update` command
- [x] Add `/ibr:setup-hooks` command
- [x] Hooks & sandboxing assessment documented

---

## Success Metrics

### "100x Better" Defined

| Dimension | Playwright | IBR 2.0 |
|-----------|-----------|---------|
| **Lines of code** | 5+ lines for basic operations | 1 line |
| **Output format** | Raw accessibility tree | Semantic JSON |
| **Common flows** | Write custom scripts | `ibr.flow.login()` |
| **AI integration** | Parse raw data | Ready-to-reason output |
| **Learning curve** | Learn Playwright API | Describe what you want |

### What We DON'T Compete On

- Raw browser control speed (use Playwright directly)
- Test runner features (use `@playwright/test`)
- Parallel execution (use Playwright workers)
- Cross-browser matrix (use Playwright's configs)

---

## Resource Usage

| Component | Memory | CPU | Disk |
|-----------|--------|-----|------|
| Semantic analysis | ~10MB | Minimal (JS) | None |
| MCP server | ~20MB | Idle until called | None |
| Built-in flows | ~5MB | Per-flow execution | None |
| **Total overhead** | **~35MB** | **Minimal** | **None** |

Playwright browser instance: ~100-300MB (unchanged from current IBR)

---

## Migration Path

### For Existing IBR Users
```typescript
// Before (IBR 1.x)
const { sessionId } = await ibr.startSession('/login', { name: 'test' });
const report = await ibr.check(sessionId);

// After (IBR 2.0) - same API still works
const { sessionId } = await ibr.startSession('/login', { name: 'test' });
const report = await ibr.check(sessionId);

// Plus new semantic API
const session = await ibr.start('http://localhost:3000/login');
const result = await session.flow.login({ email, password });
```

### For Playwright Users
```typescript
// Before (raw Playwright)
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
// ... 20 more lines

// After (IBR 2.0)
const session = await ibr.start(url);
const result = await session.flow.login({ email, password });
```
