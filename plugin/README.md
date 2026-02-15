# IBR - Interface Built Right Plugin

Design validation plugin for Claude Code. Verifies UI implementation matches user intent using structured data — computed CSS, handler wiring, accessibility, and page structure.

## Commands

| Command | Description |
|---------|-------------|
| `/ibr:snapshot` | Capture baseline before UI changes |
| `/ibr:compare` | Compare current state against baseline |
| `/ibr:full-interface-scan` | Scan all pages, test every component |
| `/ibr:build-baseline` | Create baselines for all pages with element catalog |
| `/ibr:ui` | Launch the web UI dashboard at localhost:4200 |
| `/ibr:ui-audit` | Full end-to-end workflow audit |

## Usage

1. **Build UI from user description**
2. **Validate**: `npx ibr scan <url> --json` → check structured output against intent
3. **Fix mismatches** and re-scan
4. **Store specs**: `npx ibr memory add "Buttons are blue" --property background-color --value "#3b82f6"`
5. **Regression check**: `/ibr:snapshot` → make changes → `/ibr:compare`

## Requirements

- Node.js 18+
- Playwright (installed automatically)
