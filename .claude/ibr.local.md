---
mode: prefer
---

# IBR Settings

Mode: **prefer** (soft preference)

Claude will prefer IBR for capture tasks but Playwright remains available for all tasks.

## Commands

- `/prefer-ibr` — Soft preference (current mode)
- `/only-use-ibr` — Block Playwright capture tools, enforce IBR

## What Each Mode Does

### Prefer Mode (current)
- IBR recommended for screenshots, extraction, comparison
- Playwright fully available for any task
- No blocking, just guidance

### Only Mode
- Blocks: `browser_take_screenshot`, `browser_snapshot`
- Allows: All Playwright interaction tools (click, type, navigate, etc.)
- Enforces IBR for capture, allows Playwright for interaction

## Capability Reference

| Task | Tool |
|------|------|
| Screenshot | IBR: `npx ibr start <url>` |
| HTML extraction | IBR: web UI → Upload Reference → From URL |
| Comparison | IBR: `npx ibr check` |
| Click/Type/Forms | Playwright (IBR can't) |
| Multi-step flows | Playwright (IBR can't) |
| JS execution | Playwright (IBR can't) |
