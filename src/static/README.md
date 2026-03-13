# Static HTML/CSS Analysis

Phase 8: Regex-based HTML/CSS scanning without browser execution.

## Overview

The static scanner parses HTML and CSS files using regular expressions to extract UI elements and perform basic audits. Useful for:

- Email templates
- SSR output snapshots
- Design system component documentation
- Static site generators
- Basic structure validation

## Limitations

This is a **regex-based parser**, not a full browser engine. Limitations:

1. **CSS Selector Matching**: Only supports simple selectors (tag, .class, #id, tag.class, tag#id)
   - No descendant selectors (`.parent .child`)
   - No attribute selectors (`[disabled]`, `[href="#"]`)
   - No pseudo-classes (`:hover`, `:disabled`)
   - No pseudo-elements (`::before`, `::after`)

2. **Layout**: Cannot compute actual layout
   - Bounds are estimated from inline styles and CSS
   - No box model calculation
   - No flexbox/grid positioning

3. **JavaScript**: No handler execution or detection
   - Only detects `onclick` attributes
   - Cannot detect event listeners added via JS
   - Cannot detect framework-specific handlers (React onClick, Vue @click)

4. **Cascade**: Simple rule application
   - Later rules win (basic specificity)
   - No inheritance
   - No computed values (e.g., `calc()`, `var()`)

## What It Checks

- Touch target sizes (44px minimum for interactive elements)
- Missing accessibility labels (aria-label or text content)
- Placeholder links (`href="#"` without handler)
- Disabled elements without visual feedback
- Interactive elements with `aria-hidden="true"`

## Usage

### Programmatic

```typescript
import { scanStatic } from '@tyroneross/interface-built-right/static';

const result = scanStatic({
  htmlPath: './dist/email-template.html',
  cssPath: './dist/email-styles.css', // optional
});

console.log(result.verdict); // 'PASS' | 'ISSUES' | 'FAIL'
console.log(result.summary);
console.log(result.issues);
```

### MCP Tool

```
scan_static
  html_path: "./dist/email-template.html"
  css_path: "./dist/email-styles.css"
```

Returns:
- Verdict (PASS/ISSUES/FAIL)
- Element count and audit summary
- Issues with severity and fix suggestions

## Audit Rules

| Check | Severity | Fix |
|-------|----------|-----|
| Touch target < 44px | warning | `min-width: 44px; min-height: 44px;` |
| Interactive without label | error | Add `aria-label` or text content |
| Placeholder link | warning | Add handler or real href |
| Disabled without visual | info | `opacity: 0.5; cursor: not-allowed;` |
| Interactive + aria-hidden | error | Remove `aria-hidden` or interactivity |

## Example Output

```
Static Scan: ./email-template.html
CSS: ./email-styles.css
Verdict: PASS
Scanned 29 elements, 2 interactive, no issues found.

Elements: 29 total, 2 interactive
With handlers: 2, Without: 0
```

## When to Use

✅ Use for:
- Email templates (inline styles)
- Static HTML snapshots
- Design system documentation
- Basic structure validation
- Content audits

❌ Use `scan` (browser-based) for:
- Live web apps
- Complex CSS (custom properties, calc, etc.)
- JavaScript-heavy UIs
- Framework-specific handlers
- Accurate computed styles
- Real layout measurements
