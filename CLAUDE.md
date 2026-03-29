# IBR — Interface Built Right

Visual testing platform for Claude Code. Scans live pages via CDP (Chrome DevTools Protocol), runs interaction assertions, compares mockups against live UI (SSIM), verifies design descriptions, generates tests from page observation, and supports Chrome + Safari.

**Engine:** Custom CDP browser engine (`src/engine/`) with LLM-native features:
- **4-tier element resolution**: cache → queryAXTree → Jaro-Winkler → vision fallback
- **DOM chunking**: filter to interactive elements, chunk for context windows
- **Adaptive modality**: AX tree quality scoring, screenshot when needed
- **observe/extract**: preview actions, pull structured data from AX tree
- **BrowserDriver interface**: Chrome (CDP) and Safari (WebDriver + macOS AX API)

**Node.js 22+** required (built-in WebSocket for CDP).

## Development

```bash
npm run dev          # watch mode
npm run build        # tsup build
npm run test         # vitest
npm run typecheck    # tsc --noEmit
npm run ui           # web dashboard at :4200
```

## Testing

```bash
npx vitest run src/engine/engine.test.ts              # 52 unit tests
npx vitest run src/engine/compat.test.ts              # 18 compat tests
npx vitest run src/engine/engine.integration.test.ts  # 28 integration tests (needs Chrome)
```

## Key Directories

```
src/
├── engine/              # Browser engines
│   ├── cdp/             # 14 CDP domain implementations (Chrome)
│   ├── safari/          # SafariDriver (WebDriver + macOS AX API)
│   ├── driver.ts        # EngineDriver — Chrome high-level API
│   ├── types.ts         # BrowserDriver interface (Chrome + Safari)
│   ├── compat.ts        # CompatPage — Playwright-compatible adapter
│   ├── shadow-dom.ts    # Shadow DOM piercing via Runtime.evaluate
│   ├── observe.ts       # Preview available actions
│   ├── extract.ts       # Structured data extraction
│   ├── cache.ts         # Resolution auto-caching
│   └── modality.ts      # Understanding Score (adaptive modality)
├── interaction-test.ts  # act→verify→screenshot assertion pipeline
├── ssim.ts              # SSIM algorithm (pure TypeScript, ~200 LOC)
├── mockup-match.ts      # Mockup-to-reality comparison pipeline
├── design-verifier.ts   # Design description capture + verification
├── test-generator.ts    # Auto-generate .ibr-test.json from page observation
├── test-runner.ts       # Declarative test executor
├── script-runner.ts     # Safe Python script execution (~100 LOC harness)
├── iterate.ts           # Fix-and-iterate loop with convergence detection
├── scan.ts              # Page scanning and analysis (+ AX tree coverage)
├── capture.ts           # Screenshot capture with masking
├── compare.ts           # Visual comparison (pixelmatch)
├── live-session.ts      # Interactive session management
├── semantic/            # Page intent, landmarks, state detection
├── flows/               # Login, search, form automation
├── native/              # iOS/watchOS/macOS native scanning
├── mcp/                 # MCP server and tools
└── bin/                 # CLI entry point
```

## Debugging Memory

This project uses @tyroneross/claude-code-debugger for debugging memory.

**Commands:**
- `/debugger "symptom"` - Search past bugs for similar issues
- `/debugger` - Show recent bugs, pick one to debug
- `/debugger-status` - Show memory statistics
- `/debugger-scan` - Scan recent sessions for debugging work
