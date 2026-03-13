# Design Token Validation - Quick Start

Get started with IBR token validation in 3 steps.

## Step 1: Create Token Spec

Create `.ibr/tokens.json`:

```json
{
  "name": "My Design System",
  "tokens": {
    "colors": {
      "primary": "#3b82f6",
      "text": "#1f2937"
    },
    "fontSizes": {
      "base": 16,
      "lg": 18
    },
    "touchTargets": {
      "min": 44
    }
  }
}
```

Start with just the categories you care about. All are optional.

## Step 2: Run Validation

### Via MCP (in Claude Desktop)

```typescript
Use the validate_tokens tool with your app URL
```

Claude will automatically:
1. Scan your UI
2. Load the token spec
3. Report violations

### Via Code

```typescript
import { scan, loadTokenSpec, validateAgainstTokens } from 'interface-built-right';

const spec = loadTokenSpec('.ibr/tokens.json');
const result = await scan('http://localhost:3000');
const violations = validateAgainstTokens(result.elements.all, spec);

console.log(`Found ${violations.length} violations`);
```

## Step 3: Fix Violations

### Example Violation

```
❌ Touch target too small: 32px < 44px (button.submit)
```

**Fix:** Increase button size to at least 44x44px:

```css
button.submit {
  min-width: 48px;
  min-height: 48px;
}
```

### Example Warning

```
⚠️  Non-token font size: 15px (expected one of 16, 18px)
```

**Fix:** Use a token value:

```css
p.description {
  font-size: 16px;  /* Use base token */
}
```

## Token Categories

### Colors
Validates `color` and `background-color` against your palette.

```json
"colors": {
  "primary": "#3b82f6",
  "text": "#1f2937"
}
```

### Font Sizes
Validates all `font-size` values.

```json
"fontSizes": {
  "sm": 14,
  "base": 16,
  "lg": 18
}
```

### Touch Targets
Validates interactive elements meet minimum size.

```json
"touchTargets": {
  "min": 44
}
```

### Corner Radius
Validates `border-radius` values.

```json
"cornerRadius": {
  "sm": 4,
  "md": 8,
  "lg": 12
}
```

## Tips

1. **Start small**: Begin with just `touchTargets`, then add others
2. **Mobile first**: Touch target validation catches critical UX issues
3. **Iterate**: Add token categories as your design system matures
4. **CI/CD**: Run validation in your pipeline to catch violations early

## Example: Full Token Spec

See `.ibr/tokens.example.json` for a complete example with:
- 11 colors
- 7 font sizes
- 6 spacing values
- Touch target min
- 5 corner radius values

## Next Steps

- Read the [full documentation](./token-validation.md)
- Run the [demo script](../examples/token-validation-demo.ts)
- Check out [MCP tools documentation](./mcp-tools.md)

## Common Issues

### "Token spec not found"
Make sure `.ibr/tokens.json` exists in your project root. Or specify a custom path:

```typescript
// MCP
validate_tokens({ url: '...', spec_path: 'path/to/tokens.json' })

// Code
loadTokenSpec('path/to/tokens.json')
```

### "No token categories defined"
Your spec must have at least one category (colors, fontSizes, touchTargets, or cornerRadius):

```json
{
  "name": "My System",
  "tokens": {
    "touchTargets": { "min": 44 }
  }
}
```

### Too many warnings
Start with error-level violations (touch targets) first. Add warning-level categories (colors, font sizes) incrementally as you refine your design system.
