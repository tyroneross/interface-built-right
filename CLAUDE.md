# IBR — Interface Built Right

UI validation for Claude Code. Scans live pages via CDP (Chrome DevTools Protocol) and returns structured data — computed CSS, handler wiring, accessibility, page structure. No Playwright dependency.

**Engine:** Custom CDP browser engine (`src/engine/`) with LLM-native features:
- **4-tier element resolution**: cache → queryAXTree → Jaro-Winkler → vision fallback
- **DOM chunking**: filter to interactive elements, chunk for context windows
- **Adaptive modality**: AX tree quality scoring, screenshot when needed
- **observe/extract**: preview actions, pull structured data from AX tree

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
├── engine/          # CDP browser engine (connection, domains, driver, LLM features)
│   ├── cdp/         # 14 CDP domain implementations
│   ├── driver.ts    # EngineDriver — high-level API
│   ├── compat.ts    # CompatPage — Playwright-compatible adapter
│   ├── observe.ts   # Preview available actions
│   ├── extract.ts   # Structured data extraction
│   ├── cache.ts     # Resolution auto-caching
│   └── modality.ts  # Understanding Score (adaptive modality)
├── scan.ts          # Page scanning and analysis
├── capture.ts       # Screenshot capture with masking
├── extract.ts       # DOM element extraction
├── compare.ts       # Visual comparison (pixelmatch)
├── browser-server.ts # Persistent browser sessions
├── live-session.ts  # Interactive session management
├── semantic/        # Page intent, landmarks, state detection
├── flows/           # Login, search, form automation
├── native/          # iOS/watchOS/macOS native scanning
├── mcp/             # MCP server and tools
└── bin/             # CLI entry point
```

## Debugging Memory

This project uses @tyroneross/claude-code-debugger for debugging memory.

**Commands:**
- `/debugger "symptom"` - Search past bugs for similar issues
- `/debugger` - Show recent bugs, pick one to debug
- `/debugger-status` - Show memory statistics
- `/debugger-scan` - Scan recent sessions for debugging work
