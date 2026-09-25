import type { Rule } from '../../rules/types.js';
import type { EnhancedElement, Violation } from '../../schemas.js';
import { parseColor } from '../../rules/color-parse.js';

/*
 * A STATUS BADGE IS A SHAPE, NOT A WORD SOMEWHERE ON A TINTED SURFACE.
 *
 * The first version fired on any element whose text contained a status word
 * anywhere (failed, active, completed...) and whose background alpha was at
 * least 0.15. A `<details>` card reading "3 runs failed last week" on a pale
 * surface qualified, at error severity; so did a table row, a tinted section,
 * or a "Retry failed jobs" button. Calm Precision puts content on quiet tinted
 * surfaces all the time — the rule it enforces is narrower: STATUS is shown as
 * coloured text, not as a filled badge. Pages following that rule were failing
 * it.
 *
 * A finding now requires all four properties of a badge:
 *   1. SMALL — at most BADGE_MAX_HEIGHT x BADGE_MAX_WIDTH px. Cards, rows and
 *      sections are larger than any badge.
 *   2. STATUS IS ITS OWN SHORT TEXT — at most 24 characters and 3 words, with
 *      the status word leading ("Failed", "Active 3", "● Pending"). "Retry
 *      failed" is an action label that mentions a status, not a status.
 *   3. (No shape gate.) Corners do not matter: a 4px-radius badge in a flex
 *      row computes display:block and is still a background badge.
 *   4. SATURATED FILL — HSL saturation >= 0.25 at alpha >= 0.15. Neutral grey
 *      and near-white surfaces are not status colour; `bg-red-100` (#fee2e2)
 *      is, and is the canonical violation.
 *
 * SEVERITY STAYS `error`. With all four gates the evidence is specific: a
 * small, rounded, colour-filled chip whose whole label is a status word is the
 * exact pattern the principle names. The calm-precision preset also sets
 * every core principle to `error` regardless of this field, so lowering it
 * here would change nothing a scan prints.
 */

const STATUS_WORD = /^(success|successful|error|warning|pending|active|inactive|status|failed|completed|approved|rejected)$/i;

export const BADGE_MAX_HEIGHT = 32;
export const BADGE_MAX_WIDTH = 200;
const BADGE_MAX_CHARS = 24;
const BADGE_MAX_WORDS = 3;
const MIN_FILL_ALPHA = 0.15;
const MIN_FILL_SATURATION = 0.25;

/** HSL saturation and lightness of an sRGB colour, both 0..1. */
function hsl(rgb: [number, number, number]): { s: number; l: number } {
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { s: 0, l };
  const s = (max - min) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/** The status word when the element's own short text IS a status label. */
export function statusLabel(text: string | undefined): string | null {
  const t = (text || '').trim();
  if (!t || t.length > BADGE_MAX_CHARS) return null;
  const tokens = t.split(/\s+/);
  if (tokens.length > BADGE_MAX_WORDS) return null;
  // Alphabetic words only; counts, bullets and separators ride along freely.
  const words = tokens.map((w) => w.replace(/[^a-z]/gi, '')).filter(Boolean);
  if (words.length === 0 || words.length > 2) return null;
  return STATUS_WORD.test(words[0]!) ? words[0]!.toLowerCase() : null;
}

/** A saturated, visibly-opaque background fill — or null. */
export function saturatedFill(bg: string | undefined): { s: number; l: number; alpha: number } | null {
  if (!bg) return null;
  const parsed = parseColor(bg);
  if (parsed.kind !== 'rgb') return null;
  if (parsed.alpha < MIN_FILL_ALPHA) return null;
  const { s, l } = hsl(parsed.rgb);
  // Near-black and near-white have unstable, meaningless saturation.
  if (l <= 0.05 || l >= 0.98) return null;
  if (s < MIN_FILL_SATURATION) return null;
  return { s, l, alpha: parsed.alpha };
}

export const signalNoiseRules: Rule[] = [
  {
    id: 'calm-precision/signal-noise-status',
    name: 'Signal-to-Noise: Status Indication',
    description: 'Status should use text color only, not background badges',
    defaultSeverity: 'error',
    check: (element: EnhancedElement, _context): Violation | null => {
      const style = element.computedStyles;
      if (!style) return null;

      const status = statusLabel(element.text);
      if (!status) return null;

      const { width, height } = element.bounds ?? { width: 0, height: 0 };
      if (width <= 0 || height <= 0) return null;
      if (height > BADGE_MAX_HEIGHT || width > BADGE_MAX_WIDTH) return null;

      // No shape gate: Calm Precision bans background status badges whatever
      // their corners, and a flex-row badge with a 4px radius computes as
      // display:block. Size + own status label + saturated fill already
      // exclude card and row surfaces.

      const bg = style.backgroundColor || style['background-color'];
      const fill = saturatedFill(bg);
      if (!fill) return null;

      return {
        ruleId: 'calm-precision/signal-noise-status',
        ruleName: 'Signal-to-Noise: Status Indication',
        severity: 'error',
        message: `Status badge "${(element.text || '').trim()}" (${width}x${height}px) is a filled badge (${bg}). Show status as coloured text, not a background badge.`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Remove background color. Use text color (green for success, red for error, amber for warning) with font-medium instead of a background badge.',
      };
    },
  },
];
