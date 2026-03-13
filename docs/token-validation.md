# Design Token Validation

Phase 5 of IBR introduces design token validation to ensure UI elements comply with your design system.

## Overview

The token validator checks UI elements against a token specification and reports violations. It validates:

- **Touch targets**: Minimum size for interactive elements
- **Font sizes**: Typography scale compliance
- **Colors**: Text and background colors from the color palette
- **Corner radius**: Border radius values from the radius scale
- **Spacing**: (Future) Gaps between elements

## Token Spec Format

Create a `.ibr/tokens.json` file with your design tokens:

```json
{
  "name": "My Design System",
  "tokens": {
    "colors": {
      "primary": "#3b82f6",
      "text-primary": "#1f2937",
      "bg-primary": "#ffffff"
    },
    "fontSizes": {
      "sm": 14,
      "base": 16,
      "lg": 18
    },
    "touchTargets": {
      "min": 44
    },
    "cornerRadius": {
      "sm": 4,
      "md": 8,
      "lg": 12
    }
  }
}
```

All token categories are optional. Include only the ones you want to validate.

## Usage

### Via MCP Tool

```typescript
// Validate a web URL
await mcp.call('validate_tokens', {
  url: 'http://localhost:3000',
  spec_path: '.ibr/tokens.json'  // optional, defaults to .ibr/tokens.json
});

// Validate a native simulator
await mcp.call('validate_tokens', {
  device: 'iPhone 16',
  spec_path: '.ibr/tokens.json'
});
```

### Via Programmatic API

```typescript
import { loadTokenSpec, validateAgainstTokens } from 'interface-built-right/tokens';
import { scan } from 'interface-built-right';

// Load token spec
const spec = loadTokenSpec('.ibr/tokens.json');

// Scan UI
const result = await scan('http://localhost:3000');

// Validate
const violations = validateAgainstTokens(result.elements.all, spec);

// Process violations
for (const violation of violations) {
  console.log(`[${violation.severity}] ${violation.message}`);
}
```

## Validation Rules

### Touch Targets

If `touchTargets.min` is defined, all interactive elements (with onClick or href) must meet the minimum size.

- **Severity**: Error
- **Measurement**: `Math.min(width, height)` of element bounds

### Font Sizes

If `fontSizes` are defined, all elements must use one of the token values.

- **Severity**: Warning
- **Source**: `computedStyles['font-size']`

### Colors

If `colors` are defined, text and background colors must match token values.

- **Severity**: Warning
- **Source**: `computedStyles['color']` and `computedStyles['background-color']`
- **Note**: Colors are normalized to lowercase hex for comparison

### Corner Radius

If `cornerRadius` values are defined, all border-radius values must match token values.

- **Severity**: Warning
- **Source**: `computedStyles['border-radius']`

## Example Output

```
Token Validation: My Design System
Source: http://localhost:3000 (web)
Elements checked: 42
Violations found: 5

Errors (2):
- Touch target too small: 32px < 44px (button.submit)
- Touch target too small: 38px < 44px (a.nav-link)

Warnings (3):
- Non-token font size: 15px (expected one of 14, 16, 18px) (p.description)
- Non-token text color: #333333 (button.primary)
- Non-token border radius: 6px (expected one of 4, 8, 12px) (div.card)
```

## CI Integration

Add token validation to your CI pipeline:

```bash
# Run IBR scan and validate tokens
npx ibr scan http://localhost:3000 --validate-tokens

# Use custom token spec
npx ibr scan http://localhost:3000 --validate-tokens --token-spec design-tokens.json
```

## Tips

1. **Start small**: Begin with just `touchTargets` and add other categories incrementally
2. **Mobile-first**: Touch target validation is critical for mobile UX
3. **Color normalization**: Colors are normalized to hex, so `rgb(59, 130, 246)` matches `#3b82f6`
4. **Zero-radius**: A `border-radius: 0` is only flagged if you define a "none" token
5. **Transparent backgrounds**: Transparent/invisible backgrounds are ignored in color validation

## See Also

- [Example token spec](.ibr/tokens.example.json)
- [MCP Tools Documentation](./mcp-tools.md)
- [Programmatic API](./api.md)
