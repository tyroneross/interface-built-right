import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  EnhancedElement,
  RulesConfig,
  RuleSetting,
  Violation,
  RuleAuditResult,
} from '../schemas.js';

/**
 * Rule context passed to each rule check
 */
export interface RuleContext {
  isMobile: boolean;
  viewportWidth: number;
  viewportHeight: number;
  url: string;
  allElements: EnhancedElement[];
}

/**
 * Rule definition
 */
export interface Rule {
  id: string;
  name: string;
  description: string;
  defaultSeverity: 'warn' | 'error';
  check: (element: EnhancedElement, context: RuleContext, options?: Record<string, unknown>) => Violation | null;
}

/**
 * Rule preset - collection of rules with default settings
 */
export interface RulePreset {
  name: string;
  description: string;
  rules: Rule[];
  defaults: Record<string, RuleSetting>;
}

// Registered presets
const presets: Map<string, RulePreset> = new Map();

/**
 * Register a rule preset
 */
export function registerPreset(preset: RulePreset): void {
  presets.set(preset.name, preset);
}

/**
 * Get a registered preset by name
 */
export function getPreset(name: string): RulePreset | undefined {
  return presets.get(name);
}

/**
 * List all registered presets
 */
export function listPresets(): string[] {
  return Array.from(presets.keys());
}

/**
 * Load rules configuration from .ibr/rules.json
 *
 * By default, NO rules are enforced - rules must be explicitly configured by user.
 * Users can:
 * - Create .ibr/rules.json to define rules
 * - Pass --rules flag to CLI to use optional presets
 * - Define custom rules in the config
 */
export async function loadRulesConfig(projectDir: string): Promise<RulesConfig> {
  const configPath = join(projectDir, '.ibr', 'rules.json');

  if (!existsSync(configPath)) {
    // Return empty config - no rules by default
    // Users must explicitly configure rules
    return { extends: [], rules: {} };
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content) as RulesConfig;
  } catch (error) {
    console.warn(`Failed to parse rules.json: ${error}`);
    // Return empty config on error - don't force any rules
    return { extends: [], rules: {} };
  }
}

/**
 * Merge rule settings from presets and user config
 */
function mergeRuleSettings(
  presetNames: string[],
  userRules: Record<string, RuleSetting> = {}
): { rules: Rule[]; settings: Map<string, { severity: 'warn' | 'error' | 'off'; options?: Record<string, unknown> }> } {
  const allRules: Rule[] = [];
  const settings = new Map<string, { severity: 'warn' | 'error' | 'off'; options?: Record<string, unknown> }>();
  const seenRuleIds = new Set<string>();

  // Load rules from presets
  for (const presetName of presetNames) {
    const preset = presets.get(presetName);
    if (!preset) {
      console.warn(`Unknown preset: ${presetName}`);
      continue;
    }

    for (const rule of preset.rules) {
      if (!seenRuleIds.has(rule.id)) {
        allRules.push(rule);
        seenRuleIds.add(rule.id);

        // Apply preset defaults
        const defaultSetting = preset.defaults[rule.id] ?? rule.defaultSeverity;
        if (typeof defaultSetting === 'string') {
          settings.set(rule.id, { severity: defaultSetting as 'warn' | 'error' | 'off' });
        } else {
          settings.set(rule.id, { severity: defaultSetting[0] as 'warn' | 'error' | 'off', options: defaultSetting[1] as Record<string, unknown> });
        }
      }
    }
  }

  // Apply user overrides
  for (const [ruleId, setting] of Object.entries(userRules)) {
    if (typeof setting === 'string') {
      settings.set(ruleId, { severity: setting as 'warn' | 'error' | 'off' });
    } else {
      settings.set(ruleId, { severity: setting[0] as 'warn' | 'error' | 'off', options: setting[1] as Record<string, unknown> });
    }
  }

  return { rules: allRules, settings };
}

/**
 * Run rules against elements
 */
export function runRules(
  elements: EnhancedElement[],
  context: RuleContext,
  config: RulesConfig
): Violation[] {
  // No rules by default - user must configure in .ibr/rules.json or pass --rules flag
  const { rules, settings } = mergeRuleSettings(config.extends ?? [], config.rules);
  const violations: Violation[] = [];

  for (const element of elements) {
    for (const rule of rules) {
      const setting = settings.get(rule.id);

      // Skip if rule is off
      if (!setting || setting.severity === 'off') {
        continue;
      }

      const violation = rule.check(element, context, setting.options);

      if (violation) {
        // Override severity from settings
        violations.push({
          ...violation,
          severity: setting.severity as 'warn' | 'error',
        });
      }
    }
  }

  return violations;
}

/**
 * Create full audit result
 */
export function createAuditResult(
  url: string,
  elements: EnhancedElement[],
  violations: Violation[]
): RuleAuditResult {
  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.filter(v => v.severity === 'warn').length;

  return {
    url,
    timestamp: new Date().toISOString(),
    elementsScanned: elements.length,
    violations,
    summary: {
      errors,
      warnings,
      passed: elements.length - errors - warnings,
    },
  };
}

/**
 * Format audit result for CLI output
 */
export function formatAuditResult(result: RuleAuditResult): string {
  const lines: string[] = [];

  lines.push(`IBR Audit: ${result.url}`);
  lines.push(`Scanned: ${result.elementsScanned} elements`);
  lines.push('');

  if (result.violations.length === 0) {
    lines.push('No violations found.');
  } else {
    lines.push(`Found ${result.summary.errors} errors, ${result.summary.warnings} warnings:`);
    lines.push('');

    for (const v of result.violations) {
      const icon = v.severity === 'error' ? '✗' : '!';
      lines.push(`  ${icon} [${v.ruleId}] ${v.message}`);
      if (v.element) {
        lines.push(`    Element: ${v.element.slice(0, 60)}${v.element.length > 60 ? '...' : ''}`);
      }
      if (v.fix) {
        lines.push(`    Fix: ${v.fix}`);
      }
    }
  }

  lines.push('');
  lines.push(`Summary: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.passed} passed`);

  return lines.join('\n');
}

// Auto-register presets on import
import('./presets/minimal.js').then(m => m.register()).catch(() => {});
