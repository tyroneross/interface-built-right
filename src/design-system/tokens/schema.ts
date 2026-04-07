import { z } from 'zod';

/**
 * Extended design token specification schema
 * Superset of the old DesignTokenSpec — adds typography sub-fields, spacing as array, shadows, transitions
 */
export const ExtendedTokenSpecSchema = z.object({
  colors: z.record(z.string(), z.string()).optional(),
  typography: z.object({
    fontFamilies: z.record(z.string(), z.string()).optional(),
    fontSizes: z.record(z.string(), z.number()).optional(),
    fontWeights: z.record(z.string(), z.number()).optional(),
    lineHeights: z.record(z.string(), z.number()).optional(),
  }).optional(),
  spacing: z.array(z.number()).optional(),
  borderRadius: z.record(z.string(), z.number()).optional(),
  shadows: z.record(z.string(), z.string()).optional(),
  transitions: z.record(z.string(), z.string()).optional(),
  touchTargets: z.object({ min: z.number() }).optional(),
});

export type ExtendedTokenSpec = z.infer<typeof ExtendedTokenSpecSchema>;

/**
 * Convert extended token spec to old DesignTokenSpec format for backward compatibility
 */
export function toDesignTokenSpec(extended: ExtendedTokenSpec, name: string) {
  return {
    name,
    tokens: {
      colors: extended.colors,
      spacing: extended.spacing ?
        Object.fromEntries(extended.spacing.map((v, i) => [`${i}`, v])) :
        undefined,
      fontSizes: extended.typography?.fontSizes,
      touchTargets: extended.touchTargets,
      cornerRadius: extended.borderRadius,
    },
  };
}
