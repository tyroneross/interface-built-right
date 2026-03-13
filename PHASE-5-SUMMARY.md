# Phase 5: Design Token Validation - Implementation Summary

## Overview

Phase 5 adds design token validation to IBR, enabling automated checking of UI elements against a design system specification. This ensures consistency across your interface by validating touch targets, typography, colors, spacing, and corner radius values.

## Implementation Status

Status: Complete and tested

## New Files Created

### 1. `/src/tokens.ts` (6,526 bytes)

Core implementation of token validation logic.

**Exports:**
- `loadTokenSpec(specPath: string): DesignTokenSpec` - Load and validate token spec from JSON file
- `validateAgainstTokens(elements: any[], spec: DesignTokenSpec): TokenViolation[]` - Validate UI elements against token spec
- `normalizeColor(color: string): string` - Normalize color values for comparison (hex/rgb/rgba)

**Interfaces:**
- `DesignTokenSpec` - Token specification format
- `TokenViolation` - Violation report structure

**Validation Rules:**
- Touch targets: Error if interactive elements < min size
- Font sizes: Warning if not using token values
- Colors: Warning if text/background colors not in palette
- Corner radius: Warning if border-radius not using token values
- Spacing: Skipped (complex sibling gap analysis)

### 2. `/src/tokens.test.ts` (6,789 bytes)

Comprehensive test suite with 13 passing tests.

**Test Coverage:**
- Color normalization (hex, rgb, rgba)
- Token spec loading (valid, missing, invalid JSON, empty spec)
- Touch target validation
- Font size validation
- Color validation
- Corner radius validation
- No violations scenario

### 3. `/docs/token-validation.md`

User-facing documentation covering:
- Token spec format
- Usage via MCP tool and programmatic API
- Validation rules detail
- CI integration examples
- Tips and best practices

### 4. `.ibr/tokens.example.json`

Example token specification with:
- 11 colors (primary, secondary, success, error, warning, text variations, backgrounds, border)
- 6 spacing values (xs to 2xl)
- 7 font sizes (xs to 3xl)
- Touch target minimum (44px)
- 5 corner radius values (none to full)

## Modified Files

### 1. `/src/mcp/tools.ts`

**Changes:**
- Added import: `import { loadTokenSpec, validateAgainstTokens } from '../tokens.js'`
- Added `validate_tokens` tool definition to TOOLS array
- Added `handleValidateTokens()` handler function

**Tool Definition:**
```typescript
{
  name: "validate_tokens",
  description: "Validate UI elements against a design token specification...",
  inputSchema: {
    properties: {
      url: string,           // Web URL to scan
      device: string,        // Native device to scan
      spec_path: string,     // Token spec path (default: .ibr/tokens.json)
    }
  }
}
```

**Handler Logic:**
1. Load token spec from file
2. Scan URL or device to get elements
3. Validate elements against spec
4. Format violations grouped by severity (errors/warnings)
5. Return concise text report

### 2. `/src/index.ts`

**Changes:**
- Added exports for token validation:
  ```typescript
  export { loadTokenSpec, validateAgainstTokens, normalizeColor } from './tokens.js';
  export type { DesignTokenSpec, TokenViolation } from './tokens.js';
  ```

## Integration Points

### MCP Server
- Tool name: `validate_tokens`
- Inputs: url OR device, optional spec_path
- Output: Text report with violation counts and details
- Integration: Works with existing scan() and scanNative() infrastructure

### Programmatic API
```typescript
import { loadTokenSpec, validateAgainstTokens, scan } from 'interface-built-right';

const spec = loadTokenSpec('.ibr/tokens.json');
const result = await scan('http://localhost:3000');
const violations = validateAgainstTokens(result.elements.all, spec);
```

### CLI (Future)
```bash
ibr scan http://localhost:3000 --validate-tokens
ibr scan http://localhost:3000 --validate-tokens --token-spec design-tokens.json
```

## Build Verification

Status: Passing

- TypeScript compilation: No errors
- Test suite: 13/13 passing
- Build output: Successfully bundled
  - CJS: dist/index.js (267.36 KB)
  - ESM: dist/index.mjs (259.56 KB)
  - Types: dist/index.d.ts (104.55 KB)
- Exports verified in dist/index.d.ts

## Token Spec Format

```json
{
  "name": "Design System Name",
  "tokens": {
    "colors": { "tokenName": "#hex" },
    "spacing": { "tokenName": 16 },
    "fontSizes": { "tokenName": 16 },
    "touchTargets": { "min": 44 },
    "cornerRadius": { "tokenName": 8 }
  }
}
```

All token categories are optional. At least one must be defined.

## Validation Behavior

### Touch Targets (Error Severity)
- Applies to: Interactive elements (hasOnClick or hasHref)
- Measurement: Math.min(width, height)
- Violation: actual < spec.tokens.touchTargets.min

### Font Sizes (Warning Severity)
- Applies to: All elements with computedStyles['font-size']
- Parse: Extract px value
- Violation: Value not in Object.values(spec.tokens.fontSizes)

### Colors (Warning Severity)
- Applies to: All elements with color or background-color
- Normalize: Convert rgb/rgba to lowercase hex
- Skip: Transparent/rgba(0,0,0,0) backgrounds
- Violation: Normalized color not in token palette

### Corner Radius (Warning Severity)
- Applies to: Elements with border-radius > 0
- Parse: Extract px value
- Violation: Value not in Object.values(spec.tokens.cornerRadius)

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

## Future Enhancements

1. **Spacing Validation**: Implement sibling gap analysis
2. **Line Height Tokens**: Add line-height validation
3. **Shadow Tokens**: Add box-shadow validation
4. **Animation Tokens**: Add transition/animation duration validation
5. **CLI Integration**: Add --validate-tokens flag to CLI
6. **Auto-fix Suggestions**: Recommend closest token value for violations
7. **Custom Severity**: Allow spec to define severity per category
8. **Ignore Patterns**: Add ability to ignore specific selectors

## Files Summary

| File | Size | Purpose |
|------|------|---------|
| src/tokens.ts | 6.5 KB | Core implementation |
| src/tokens.test.ts | 6.8 KB | Test suite (13 tests) |
| src/mcp/tools.ts | +100 lines | MCP tool integration |
| src/index.ts | +3 lines | API exports |
| docs/token-validation.md | ~200 lines | Documentation |
| .ibr/tokens.example.json | ~50 lines | Example spec |

## Testing

All 13 tests passing:
- normalizeColor: 4 tests
- loadTokenSpec: 4 tests
- validateAgainstTokens: 5 tests

Coverage:
- Color normalization (hex, rgb, rgba)
- Spec loading and validation
- Touch target validation
- Font size validation
- Color validation
- Corner radius validation
- Edge cases (empty violations, transparent colors, etc.)

## Dependencies

No new dependencies added. Uses existing:
- fs (readFileSync, existsSync)
- Existing IBR scan infrastructure
- Playwright-based element extraction

## Backward Compatibility

Status: Fully backward compatible

- New optional tool - does not affect existing tools
- New exports in index.ts - does not break existing API
- Token spec file is optional - no required config changes

## Next Steps

1. User testing with real design systems
2. Gather feedback on violation severity levels
3. Consider CLI integration
4. Expand to additional token categories based on user needs
5. Add auto-fix suggestions for common violations
