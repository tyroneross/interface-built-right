---
description: Enable soft IBR preference. Claude will prefer IBR for UI validation, capture, and semantic interactions while Playwright MCP remains available for unsupported browser automation.
---

# /prefer-ibr

Enable soft IBR preference mode (default behavior).

## What This Does

Sets IBR as the **preferred** tool for UI validation, capture, and semantic interactions, but does NOT block Playwright.

```bash
mkdir -p .claude
cat > .claude/ibr.local.md << 'EOF'
---
mode: prefer
---

# IBR Settings

Mode: **prefer** (soft preference)

Claude will prefer IBR for UI validation, capture, and semantic interactions:
- Design validation → `npx ibr scan <url> --json`
- Screenshots → `npx ibr start <url>` (or `session:screenshot -s <css>` for one element)
- HTML/DOM extraction → `npx ibr session:html <sessionId>` / `npx ibr extract <url>`
- Regression comparison → `npx ibr check`
- One-shot semantic interaction → `npx ibr interact <url> --action click --target "Submit"`
- Multi-step stateful flow → `npx ibr session:start --detach`, then `session:type`/`session:click`/`session:select`/`session:press`, then `session:close`
- Execute JS in the page → `npx ibr session:eval <sessionId> "<script>"`
- Interaction assertions → `npx ibr test-interact <url> --action "click:button:Submit" --expect "visible:Success"`

Playwright MCP remains available for:
- Native browser dialogs (alert/confirm/prompt)
- Open-ended, arbitrary multi-step scripts (IBR has no general script runner — `run-script` is Python-only/sandboxed)
- Large multi-URL/multi-viewport test matrices (IBR needs a shell loop per URL/viewport)
- Browser back navigation and reduced-motion emulation (no IBR equivalent yet)
- When explicitly requested

To enforce IBR-only for capture: `/only-use-ibr`
EOF
```

## Report

```
IBR Preference Mode: PREFER (soft)

Claude will prefer IBR for UI validation, capture, and semantic interactions but Playwright remains available.

IBR handles:
  ✓ Design validation      → npx ibr scan <url> --json
  ✓ Screenshots            → npx ibr start <url> / session:screenshot -s <css>
  ✓ HTML/DOM extraction    → npx ibr session:html <sessionId> / extract <url>
  ✓ Comparison             → npx ibr check
  ✓ One-shot click/type    → npx ibr interact <url> --action ...
  ✓ Multi-step stateful flow → npx ibr session:start --detach + session:type/click/select/press
  ✓ Execute JS in the page → npx ibr session:eval <sessionId> "<script>"
  ✓ Assertions             → npx ibr test-interact <url> --action ... --expect ...

Playwright handles:
  ✓ Native browser dialogs (alert/confirm/prompt)
  ✓ Open-ended arbitrary multi-step scripts (no IBR script runner)
  ✓ Large multi-URL/multi-viewport test matrices
  ✓ Browser back navigation / reduced-motion emulation
  ✓ Any task explicitly requested in Playwright

To enforce IBR-only capture: /only-use-ibr
```

## IBR vs Playwright Capabilities

Verified against `npx ibr --help` and each command's own `--help` (2026-09-24).

| Task | IBR command | Playwright | Use |
|------|-------------|------------|-----|
| Validate CSS/layout/a11y (contrast, touch targets, calm-precision) | `scan <url>` / `session:scan <sessionId>` | No structured equivalent | **IBR** — structured sensor data + verdict |
| Screenshot a page | `start <url>` / `session:screenshot <sessionId>` | Yes | **IBR** — managed sessions + baselines |
| Screenshot one element | `session:screenshot -s <css>` | Yes (manual) | **IBR** |
| Extract HTML/DOM | `session:html <sessionId>` / `extract <url>` | Yes | **IBR** — richer, semantic output |
| Regression / baseline diff | `check` / `native:check` | No built-in diffing | **IBR** |
| Dead-button / handler detection | `scan` | No | **IBR** |
| One-shot click/type/fill (fresh page each call) | `interact <url> --action click --target "Submit"` | Yes | **IBR** for semantic (accessible-name/role) targets |
| Multi-step stateful flow (fill → click → assert, state persists) | `session:start --detach` then `session:type`/`session:click`/`session:select`/`session:press`, then `session:close` | Yes | **IBR** — session persists across commands |
| Click by CSS selector in a live session | `session:click <sessionId> <css>` | Yes | Either — `session:click` is CSS-selector only; use `interact --target` for a one-shot role/text-based click |
| Scroll page or a container | `session:scroll <sessionId> <dir> [amount]` | Yes | **IBR** |
| Choose a `<select>` option | `session:select <sessionId> <selector> <option>` | Yes | **IBR** |
| Wait for a selector or a duration | `session:wait <sessionId> <selectorOrMs>` | Yes | **IBR** |
| Detect / dismiss a modal | `session:modal [--dismiss]` | Yes | **IBR** |
| Execute JS in the page | `session:eval <sessionId> "<script>"` | Yes | **IBR** — `session:eval` covers this |
| Read element text | `session:text <sessionId> <selector>` | Yes | **IBR** |
| Interaction assertions (click X, expect Y) | `test-interact <url> -a "click:button:Submit" -e "visible:Success"` | Yes (manual) | **IBR** |
| Declarative, repeatable test file | `generate-test` then `test` (`.ibr-test.json`) | Yes (custom script) | **IBR** |
| Compare rendering across Chrome/Safari | `compare-browsers <url>` | Manual, two separate runs | **IBR** |
| Native browser dialogs (alert/confirm/prompt) | Not supported | Yes | **Playwright** |
| Run an arbitrary, open-ended multi-step script | No general script runner. `run-script` exists but only executes sandboxed Python, not a JS/browser test runner | Yes | **Playwright** for custom scripting outside IBR's command set |
| Multi-URL or multi-viewport test matrix in one call | Not built in — loop `ibr scan -v desktop`, `-v mobile`, etc. per URL yourself in shell | Yes (native test matrices) | **Playwright** for large matrices; IBR is fine for a small shell loop |
| Browser back navigation | No `goBack`/history command | Yes | **Playwright** |
| `prefers-reduced-motion` emulation | No flag | Yes | **Playwright** |
