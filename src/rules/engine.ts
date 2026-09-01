import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { calmPrecisionPreset } from './presets/calm-precision.js';
import { minimalPreset } from './presets/minimal.js';
import { touchTargetsPreset } from './presets/touch-targets.js';
import { wcagContrastPreset } from './presets/wcag-contrast.js';
import type { Rule, RuleContext, RulePreset } from './types.js';
import { ruleAppliesTo } from './types.js';
export type { Rule, RuleContext, RulePreset } from './types.js';
import type {
  EnhancedElement,
  RulesConfig,
  RuleSetting,
  Violation,
  RuleAuditResult,
} from '../schemas.js';

// Registered presets
const presets: Map<string, RulePreset> = new Map();

/**
 * Register a rule preset
 */
export function registerPreset(preset: RulePreset): void {
  presets.set(preset.name, preset);
}

for (const preset of [
  minimalPreset,
  calmPrecisionPreset,
  wcagContrastPreset,
  touchTargetsPreset,
]) {
  registerPreset(preset);
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
 * What `ibr scan` grades when nobody has said otherwise.
 *
 * These used to be OFF. `scan()` ran the preset engine only when `--rules` was
 * passed, and `loadRulesConfig` returns an empty config when no
 * `.ibr/rules.json` exists — so a bare `ibr scan <url>` checked no contrast, no
 * touch targets, and no Calm Precision rules, and printed a clean verdict for
 * doing nothing. The MCP tool surface and the Obsidian scan lane had already
 * defaulted these on; the CLI was the outlier.
 *
 * IBR is an advisory instrument for a human triaging real UI, not a gate. A
 * missed defect costs a user who cannot read or tap something; a false positive
 * costs a few seconds of triage. Default to catching things.
 */
export const DEFAULT_RULE_PRESETS: readonly string[] = ['touch-targets', 'wcag-contrast', 'calm-precision'];

/** Passed as `--rules none` to restore the old run-nothing behavior. */
export const RULES_OPT_OUT = 'none';

/** Where the active preset list came from — reported so a scan can explain itself. */
export type RulesSource = 'opt-out' | 'flag' | 'config' | 'default';

export interface ResolvedRulesConfig {
  config: RulesConfig;
  source: RulesSource;
  presets: string[];
}

/**
 * Decide which presets a scan runs.
 *
 * Precedence, highest first:
 *   1. `--rules none`            — explicit opt-out, run nothing.
 *   2. `--rules a,b`             — an explicit request beats everything else.
 *   3. `.ibr/rules.json`         — a project that configured itself keeps its config.
 *   4. DEFAULT_RULE_PRESETS      — otherwise, check the things that matter.
 */
export async function resolveRulesConfig(
  projectDir: string,
  requested?: readonly string[],
): Promise<ResolvedRulesConfig> {
  if (requested && requested.some((r) => r.trim().toLowerCase() === RULES_OPT_OUT)) {
    return { config: { extends: [], rules: {} }, source: 'opt-out', presets: [] };
  }

  if (requested && requested.length > 0) {
    const presets = [...requested];
    return { config: { extends: presets, rules: {} }, source: 'flag', presets };
  }

  if (existsSync(join(projectDir, '.ibr', 'rules.json'))) {
    const config = await loadRulesConfig(projectDir);
    const presets = config.extends ?? [];
    // A config file that exists but configures nothing is not a decision to
    // check nothing — fall through to the defaults rather than silently
    // reverting to the old no-op.
    if (presets.length > 0 || Object.keys(config.rules ?? {}).length > 0) {
      return { config, source: 'config', presets };
    }
  }

  const presets = [...DEFAULT_RULE_PRESETS];
  return { config: { extends: presets, rules: {} }, source: 'default', presets };
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
 * The rules a config actually activates (severity `off` excluded).
 *
 * Exposed so a caller can answer two questions BEFORE paying for work:
 * "is any rule going to look at page content?" (skip the content extraction if
 * not) and "did the contrast rules run at all?" (a coverage count is misleading
 * when they did not).
 */
export function getActiveRules(config: RulesConfig): Rule[] {
  const { rules, settings } = mergeRuleSettings(
    config.extends ?? [],
    config.rules as Record<string, RuleSetting> | undefined,
  );
  return rules.filter((rule) => {
    const setting = settings.get(rule.id);
    return !!setting && setting.severity !== 'off';
  });
}

/** True when at least one active rule grades non-interactive page content. */
export function configHasContentRules(config: RulesConfig): boolean {
  return getActiveRules(config).some((rule) => {
    const applies = rule.appliesTo ?? 'interactive';
    return applies === 'any' || applies === 'text';
  });
}

/** Options for one `runRules` pass. */
export interface RunRulesOptions {
  /**
   * Which element surface `elements` represents. Defaults to `'interactive'`,
   * which is what every pre-existing caller passes.
   *
   * A `'content'` pass runs ONLY rules declaring `appliesTo: 'any' | 'text'`,
   * so headings and paragraphs get contrast-graded without ever reaching the
   * touch-target or handler-integrity rules.
   */
  surface?: 'interactive' | 'content';
}

/**
 * Run rules against elements
 */
export function runRules(
  elements: EnhancedElement[],
  context: RuleContext,
  config: RulesConfig,
  options: RunRulesOptions = {}
): Violation[] {
  // No rules by default - user must configure in .ibr/rules.json or pass --rules flag
  const { rules, settings } = mergeRuleSettings(config.extends ?? [], config.rules as Record<string, RuleSetting> | undefined);
  const surface = options.surface ?? 'interactive';
  const applicable = rules.filter((rule) => ruleAppliesTo(rule, surface));
  const violations: Violation[] = [];

  for (const element of elements) {
    for (const rule of applicable) {
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
      // Elements with NO violation against them. This was
      // `elements.length - errors - warnings`, which counts violations rather
      // than elements: one element tripping three rules subtracted three, and
      // with several presets now active by default the figure could go
      // negative. A count that can be negative was never measuring elements.
      passed: elements.filter(
        (el) => !violations.some((v) => v.element === el.selector),
      ).length,
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

/**
 * Load and register memory preferences as a rule preset
 */
export async function loadMemoryPreset(outputDir: string): Promise<void> {
  try {
    const { loadSummary, createMemoryPreset } = await import('../memory.js');
    const summary = await loadSummary(outputDir);

    if (summary.activePreferences.length > 0) {
      const preset = createMemoryPreset(summary.activePreferences);
      registerPreset(preset);
    }
  } catch {
    // Memory not available - not an error
  }
}
