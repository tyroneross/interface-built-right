# IBR - Interface Built Right Plugin

Visual regression testing plugin for Claude Code.

## Commands

| Command | Description |
|---------|-------------|
| `/ibr:ui` | Launch the web UI dashboard at localhost:4242 |
| `/ibr:snapshot` | Capture a baseline screenshot of a URL |
| `/ibr:compare` | Compare current state against baseline |

## Installation

Add to your project's `.claude/settings.json`:

```json
{
  "plugins": [
    "path/to/interface-built-right/plugin"
  ]
}
```

Or install via npm:

```bash
npm install github:tyroneross/interface-built-right
```

Then reference:

```json
{
  "plugins": [
    "node_modules/interface-built-right/plugin"
  ]
}
```

## Usage

1. **Capture baseline**: `/ibr:snapshot` → Enter URL when prompted
2. **Make UI changes**: Edit your components
3. **Compare**: `/ibr:compare` → See visual diff
4. **View in UI**: `/ibr:ui` → Open dashboard at localhost:4242

## Requirements

- Node.js 18+
- Playwright (installed automatically)
