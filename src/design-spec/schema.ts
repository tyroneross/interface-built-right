import { z } from 'zod';

const finite = z.number().finite();

/** A property is either fixed, constrained to an allowed interval/set, or deliberately unconstrained. */
export const NumberRuleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('exact'), value: finite, tolerance: finite.nonnegative().default(0) }),
  z.object({ mode: z.literal('bounded'), min: finite, max: finite }).refine(v => v.min <= v.max, 'min must be <= max'),
  z.object({ mode: z.literal('free'), guidance: z.string().optional() }),
]);

export const TextRuleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('exact'), value: z.string() }),
  z.object({ mode: z.literal('bounded'), oneOf: z.array(z.string()).min(1) }),
  z.object({ mode: z.literal('free'), guidance: z.string().optional() }),
]);

export const StyleRulesSchema = z.object({
  fontFamily: TextRuleSchema.optional(),
  fontSize: NumberRuleSchema.optional(),
  fontWeight: TextRuleSchema.optional(),
  color: TextRuleSchema.optional(),
  backgroundColor: TextRuleSchema.optional(),
  backgroundImage: TextRuleSchema.optional(),
  borderRadius: NumberRuleSchema.optional(),
}).strict();

export const DesignElementSchema = z.object({
  id: z.string().min(1),
  sourceNode: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    fillTypes: z.array(z.string()).optional(),
    imageRefs: z.array(z.string()).optional(),
    prototypeDestinationId: z.string().optional(),
  }).strict().optional(),
  /** Semantic identity. Duplicate matches are a coverage failure, never a guessed first match. */
  match: z.object({
    role: z.enum(['heading', 'paragraph', 'link', 'button', 'image', 'caption', 'quote', 'region']),
    name: z.string().min(1),
    level: z.number().int().min(1).max(6).optional(),
    /** One-based DOM order among elements with this semantic role and name. */
    occurrence: z.number().int().positive().optional(),
  }).strict().optional(),
  text: TextRuleSchema.optional(),
  href: TextRuleSchema.optional(),
  src: TextRuleSchema.optional(),
  geometry: z.object({
    x: NumberRuleSchema.optional(),
    y: NumberRuleSchema.optional(),
    width: NumberRuleSchema.optional(),
    height: NumberRuleSchema.optional(),
    /** Only measurable for a square with a circular CSS border radius. CSS pixels. */
    circumference: NumberRuleSchema.optional(),
  }).strict().optional(),
  style: StyleRulesSchema.optional(),
}).strict();

export const DesignSpecSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1),
  source: z.object({
    kind: z.enum(['authored', 'figma']),
    ref: z.string().optional(),
    coverage: z.object({
      considered: z.number().int().nonnegative(),
      imported: z.number().int().nonnegative(),
      skipped: z.array(z.object({ id: z.string(), reason: z.string() }).strict()),
    }).strict().optional(),
  }).strict(),
  /** Shared rules apply to every element of a role. Element rules override them. */
  sharedStyle: z.object({ heading: StyleRulesSchema.optional() }).strict().optional(),
  views: z.array(z.object({
    id: z.string().min(1),
    route: z.string().startsWith('/'),
    viewport: z.object({ width: finite.positive(), height: finite.positive() }).strict(),
    /** listed checks named elements; all-scanned also rejects unlisted semantic elements. */
    coverage: z.enum(['listed', 'all-scanned']).default('listed'),
    /** Full rendered body copy, including labels and text outside semantic blocks. */
    visibleText: TextRuleSchema.optional(),
    navigation: z.array(z.object({
      label: z.string().min(1),
      occurrence: z.number().int().positive().optional(),
      destination: TextRuleSchema,
    }).strict()).default([]),
    elements: z.array(DesignElementSchema),
    /** Whole areas intentionally left to the builder; bounds exempt their contents from all-scanned coverage. */
    freeRegions: z.array(z.object({
      name: z.string().min(1),
      bounds: z.object({ x: finite, y: finite, width: finite.positive(), height: finite.positive() }).strict().optional(),
    }).strict()).default([]),
  }).strict()).min(1),
}).strict().superRefine((spec, ctx) => {
  const views = new Set<string>();
  for (const [viewIndex, view] of spec.views.entries()) {
    if (views.has(view.id)) ctx.addIssue({ code: 'custom', path: ['views', viewIndex, 'id'], message: 'duplicate view id' });
    views.add(view.id);
    const elements = new Set<string>();
    for (const [elementIndex, element] of view.elements.entries()) {
      if (elements.has(element.id)) ctx.addIssue({ code: 'custom', path: ['views', viewIndex, 'elements', elementIndex, 'id'], message: 'duplicate element id' });
      elements.add(element.id);
    }
  }
});

export type DesignSpec = z.infer<typeof DesignSpecSchema>;
export type DesignElement = z.infer<typeof DesignElementSchema>;
export type NumberRule = z.infer<typeof NumberRuleSchema>;
export type TextRule = z.infer<typeof TextRuleSchema>;
export type StyleRules = z.infer<typeof StyleRulesSchema>;
