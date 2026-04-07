import { registerPreset } from '../engine.js';
import { allCalmPrecisionRules, corePrincipleIds, principleToRules } from '../../design-system/principles/calm-precision.js';
import type { RuleSetting } from '../../schemas.js';

/**
 * Register the calm-precision preset
 */
export function register(): void {
  const defaults: Record<string, RuleSetting> = {};

  for (const rule of allCalmPrecisionRules) {
    // Determine if this rule belongs to a core or stylistic principle
    const isCore = corePrincipleIds.some(pid =>
      principleToRules[pid]?.includes(rule.id)
    );
    defaults[rule.id] = isCore ? 'error' : 'warn';
  }

  registerPreset({
    name: 'calm-precision',
    description: 'Calm Precision design principles — Gestalt, Signal-to-Noise, Fitts, Hick, Content-Chrome, Cognitive Load',
    rules: allCalmPrecisionRules,
    defaults,
  });
}
