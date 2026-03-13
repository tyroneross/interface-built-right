/**
 * Design Token Validation Demo
 *
 * This script demonstrates how to use IBR's token validation
 * to check UI elements against a design system specification.
 */

import { loadTokenSpec, validateAgainstTokens, type DesignTokenSpec } from '../src/tokens.js';

// Example 1: Define a token spec inline
const exampleSpec: DesignTokenSpec = {
  name: 'Demo Design System',
  tokens: {
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      success: '#10b981',
      error: '#ef4444',
      textPrimary: '#1f2937',
      textSecondary: '#6b7280',
      bgPrimary: '#ffffff',
      bgSecondary: '#f9fafb',
    },
    fontSizes: {
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
    },
    touchTargets: {
      min: 44,
    },
    cornerRadius: {
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
    },
  },
};

// Example 2: Mock UI elements (in production, these come from scan() or scanNative())
const mockElements = [
  // Valid button - meets all requirements
  {
    selector: 'button.primary',
    tagName: 'button',
    bounds: { x: 0, y: 0, width: 120, height: 48 },
    interactive: { hasOnClick: true, hasHref: false },
    computedStyles: {
      'font-size': '16px',
      color: '#ffffff',
      'background-color': '#3b82f6',
      'border-radius': '8px',
    },
    a11y: { ariaLabel: 'Submit form' },
  },

  // Invalid button - too small (touch target violation)
  {
    selector: 'button.small',
    tagName: 'button',
    bounds: { x: 0, y: 0, width: 32, height: 32 },
    interactive: { hasOnClick: true, hasHref: false },
    computedStyles: {
      'font-size': '14px',
      color: '#ffffff',
      'background-color': '#3b82f6',
    },
    a11y: {},
  },

  // Invalid paragraph - wrong font size
  {
    selector: 'p.description',
    tagName: 'p',
    bounds: { x: 0, y: 0, width: 400, height: 60 },
    interactive: { hasOnClick: false, hasHref: false },
    computedStyles: {
      'font-size': '15px', // Not in token spec
      color: '#1f2937',
    },
    a11y: {},
  },

  // Invalid div - non-token color
  {
    selector: 'div.card',
    tagName: 'div',
    bounds: { x: 0, y: 0, width: 300, height: 200 },
    interactive: { hasOnClick: false, hasHref: false },
    computedStyles: {
      'font-size': '16px',
      color: '#333333', // Not in token spec
      'background-color': '#f5f5f5', // Not in token spec
      'border-radius': '6px', // Not in token spec
    },
    a11y: {},
  },

  // Valid link - meets requirements
  {
    selector: 'a.nav-link',
    tagName: 'a',
    bounds: { x: 0, y: 0, width: 100, height: 44 },
    interactive: { hasOnClick: false, hasHref: true },
    computedStyles: {
      'font-size': '14px',
      color: '#3b82f6',
    },
    a11y: { ariaLabel: 'Navigate to home' },
  },
];

// Example 3: Run validation
console.log('='.repeat(60));
console.log('Design Token Validation Demo');
console.log('='.repeat(60));
console.log();

console.log(`Spec: ${exampleSpec.name}`);
console.log(`Elements to validate: ${mockElements.length}`);
console.log();

const violations = validateAgainstTokens(mockElements, exampleSpec);

console.log(`Violations found: ${violations.length}`);
console.log();

if (violations.length === 0) {
  console.log('✅ All elements comply with design tokens!');
} else {
  // Group by severity
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (errors.length > 0) {
    console.log(`❌ Errors (${errors.length}):`);
    for (const v of errors) {
      console.log(`  - ${v.message}`);
      console.log(`    Property: ${v.property}`);
      console.log(`    Expected: ${v.expected}, Actual: ${v.actual}`);
      console.log();
    }
  }

  if (warnings.length > 0) {
    console.log(`⚠️  Warnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  - ${w.message}`);
      console.log(`    Property: ${w.property}`);
      console.log();
    }
  }
}

console.log('='.repeat(60));
console.log();

// Example 4: Loading from file
console.log('Example: Loading token spec from file');
console.log('-'.repeat(60));

try {
  const fileSpec = loadTokenSpec('.ibr/tokens.example.json');
  console.log(`✅ Loaded spec: ${fileSpec.name}`);
  console.log(`   Categories defined:`);
  if (fileSpec.tokens.colors) console.log(`   - Colors: ${Object.keys(fileSpec.tokens.colors).length} tokens`);
  if (fileSpec.tokens.fontSizes) console.log(`   - Font sizes: ${Object.keys(fileSpec.tokens.fontSizes).length} tokens`);
  if (fileSpec.tokens.spacing) console.log(`   - Spacing: ${Object.keys(fileSpec.tokens.spacing).length} tokens`);
  if (fileSpec.tokens.touchTargets) console.log(`   - Touch targets: min ${fileSpec.tokens.touchTargets.min}px`);
  if (fileSpec.tokens.cornerRadius) console.log(`   - Corner radius: ${Object.keys(fileSpec.tokens.cornerRadius).length} tokens`);
} catch (err) {
  console.log(`ℹ️  Could not load .ibr/tokens.example.json: ${err instanceof Error ? err.message : 'Unknown error'}`);
  console.log(`   (This is expected if running from a different directory)`);
}

console.log();

// Example 5: Real-world usage pattern
console.log('Example: Real-world usage pattern');
console.log('-'.repeat(60));
console.log(`
// In your validation workflow:
import { scan, loadTokenSpec, validateAgainstTokens } from 'interface-built-right';

// 1. Load your design token spec
const spec = loadTokenSpec('.ibr/tokens.json');

// 2. Scan your UI (web or native)
const result = await scan('http://localhost:3000');

// 3. Validate elements against tokens
const violations = validateAgainstTokens(result.elements.all, spec);

// 4. Process violations
for (const violation of violations) {
  if (violation.severity === 'error') {
    console.error(\`[ERROR] \${violation.message}\`);
  } else {
    console.warn(\`[WARNING] \${violation.message}\`);
  }
}

// 5. Exit with error code if violations found (for CI)
if (violations.some(v => v.severity === 'error')) {
  process.exit(1);
}
`);

console.log('='.repeat(60));
console.log('Demo complete!');
console.log();
