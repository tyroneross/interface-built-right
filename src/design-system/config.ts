import { z } from 'zod';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Custom principle check schema
const CustomCheckSchema = z.object({
  property: z.string(),
  operator: z.enum(['equals', 'in-set', 'not-in-set', 'gte', 'lte', 'contains']),
  values: z.array(z.union([z.string(), z.number()])),
});

// Custom principle schema
const CustomPrincipleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  severity: z.enum(['error', 'warn', 'off']),
  checks: z.array(CustomCheckSchema),
});

// Calm Precision config
const CalmPrecisionConfigSchema = z.object({
  core: z.array(z.string()).default(['gestalt', 'signal-noise', 'content-chrome', 'cognitive-load']),
  stylistic: z.array(z.string()).default(['fitts', 'hick']),
  severity: z.record(z.string(), z.enum(['error', 'warn', 'off'])).default({}),
});

// Extended typography tokens
const TypographyTokensSchema = z.object({
  fontFamilies: z.record(z.string(), z.string()).optional(),
  fontSizes: z.record(z.string(), z.number()).optional(),
  fontWeights: z.record(z.string(), z.number()).optional(),
  lineHeights: z.record(z.string(), z.number()).optional(),
});

// Full design system config
export const DesignSystemConfigSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  principles: z.object({
    calmPrecision: CalmPrecisionConfigSchema.default({}),
    custom: z.array(CustomPrincipleSchema).default([]),
  }).default({}),
  tokens: z.object({
    colors: z.record(z.string(), z.string()).optional(),
    typography: TypographyTokensSchema.optional(),
    spacing: z.array(z.number()).optional(),
    borderRadius: z.record(z.string(), z.number()).optional(),
    shadows: z.record(z.string(), z.string()).optional(),
    transitions: z.record(z.string(), z.string()).optional(),
    touchTargets: z.object({ min: z.number() }).optional(),
  }).default({}),
});

export type DesignSystemConfig = z.infer<typeof DesignSystemConfigSchema>;
export type CustomPrinciple = z.infer<typeof CustomPrincipleSchema>;
export type CustomCheck = z.infer<typeof CustomCheckSchema>;

/**
 * Load design system config from .ibr/design-system.json
 * Returns undefined if no config exists (backward compatible)
 */
export async function loadDesignSystemConfig(projectDir: string): Promise<DesignSystemConfig | undefined> {
  const configPath = join(projectDir, '.ibr', 'design-system.json');

  if (!existsSync(configPath)) {
    return undefined;
  }

  const content = await readFile(configPath, 'utf-8');
  const raw = JSON.parse(content);
  return DesignSystemConfigSchema.parse(raw);
}

/**
 * Get default severity for a Calm Precision principle
 */
export function getDefaultSeverity(principleId: string, config: DesignSystemConfig): 'error' | 'warn' | 'off' {
  // Check explicit override
  const explicit = config.principles.calmPrecision.severity[principleId];
  if (explicit) return explicit;

  // Core principles default to error
  if (config.principles.calmPrecision.core.includes(principleId)) return 'error';

  // Stylistic default to warn
  if (config.principles.calmPrecision.stylistic.includes(principleId)) return 'warn';

  // Unknown principles default to warn
  return 'warn';
}
