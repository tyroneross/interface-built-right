import { gestaltRules } from './gestalt.js';
import { signalNoiseRules } from './signal-noise.js';
import { fittsRules } from './fitts.js';
import { hickRules } from './hick.js';
import { contentChromeRules } from './content-chrome.js';
import { cognitiveLoadRules } from './cognitive-load.js';
import type { Rule } from '../../rules/engine.js';

/** All Calm Precision rules */
export const allCalmPrecisionRules: Rule[] = [
  ...gestaltRules,
  ...signalNoiseRules,
  ...fittsRules,
  ...hickRules,
  ...contentChromeRules,
  ...cognitiveLoadRules,
];

/** Core principles — cognitive science fundamentals, default to error */
export const corePrincipleIds = ['gestalt', 'signal-noise', 'content-chrome', 'cognitive-load'];

/** Stylistic principles — have valid exceptions, default to warn */
export const stylisticPrincipleIds = ['fitts', 'hick'];

/** Map principle ID to rule IDs */
export const principleToRules: Record<string, string[]> = {
  'gestalt': gestaltRules.map(r => r.id),
  'signal-noise': signalNoiseRules.map(r => r.id),
  'fitts': fittsRules.map(r => r.id),
  'hick': hickRules.map(r => r.id),
  'content-chrome': contentChromeRules.map(r => r.id),
  'cognitive-load': cognitiveLoadRules.map(r => r.id),
};
