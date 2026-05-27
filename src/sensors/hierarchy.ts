import type { EnhancedElement } from '../schemas.js';
import type { SensorContext } from './types.js';

/**
 * Hierarchy sensor — enumerates heading levels (h1–h6) and ARIA landmarks
 * from extracted elements, surfaces a11y findings (no-h1, multiple-h1,
 * heading-level-skips), and counts ARIA `role="heading"` separately.
 *
 * Why this sensor exists: prior to this sensor, IBR's scan returned an
 * AX-tree node count but did not categorize by heading level. See
 * linear-app-20260527.md §2 Hierarchy — "It did not enumerate headings
 * as a distinct sensor; hierarchy below is inferred from text-bearing
 * element bounds + ordering."
 */

export type HeadingFinding = 'no_h1_on_page' | 'multiple_h1s_on_page';

export interface HeadingLevelSummary {
  count: number;
  first_text?: string;
  all_texts: string[];
  finding?: HeadingFinding;
}

export interface LandmarkCounts {
  nav: number;
  main: number;
  aside: number;
  header: number;
  footer: number;
  section: number;
  form: number;
}

export interface AriaHeading {
  selector: string;
  level: number;
  text: string;
}

export interface LevelSkip {
  from: string;
  to: string;
  at_position: number;
}

export interface HierarchyReport {
  h1: HeadingLevelSummary;
  h2: HeadingLevelSummary;
  h3: HeadingLevelSummary;
  h4: HeadingLevelSummary;
  h5: HeadingLevelSummary;
  h6: HeadingLevelSummary;
  landmarks: LandmarkCounts;
  aria_headings: AriaHeading[];
  level_skips: LevelSkip[];
}

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
type HeadingTag = (typeof HEADING_TAGS)[number];

function emptyLevel(): HeadingLevelSummary {
  return { count: 0, all_texts: [] };
}

function emptyLandmarks(): LandmarkCounts {
  return { nav: 0, main: 0, aside: 0, header: 0, footer: 0, section: 0, form: 0 };
}

function trimText(s: string | undefined): string {
  return (s ?? '').trim();
}

export function collectHierarchy(ctx: SensorContext): HierarchyReport {
  const levels: Record<HeadingTag, HeadingLevelSummary> = {
    h1: emptyLevel(),
    h2: emptyLevel(),
    h3: emptyLevel(),
    h4: emptyLevel(),
    h5: emptyLevel(),
    h6: emptyLevel(),
  };
  const landmarks = emptyLandmarks();
  const ariaHeadings: AriaHeading[] = [];
  const seenLevelsInOrder: Array<{ level: number; selector: string }> = [];

  for (const el of ctx.elements) {
    const tag = el.tagName.toLowerCase();
    const role = el.a11y?.role ?? '';

    // Native h1-h6
    if ((HEADING_TAGS as readonly string[]).includes(tag)) {
      const summary = levels[tag as HeadingTag];
      summary.count++;
      const text = trimText(el.text);
      if (text) {
        summary.all_texts.push(text);
        if (!summary.first_text) summary.first_text = text;
      }
      seenLevelsInOrder.push({ level: parseInt(tag.slice(1), 10), selector: el.selector });
      continue;
    }

    // ARIA headings (role="heading" + aria-level)
    if (role === 'heading') {
      // EnhancedElement.a11y may include aria-level via attribute extraction;
      // schemas.ts doesn't pin it, so we look it up in a flexible way.
      const ariaLevel = parseAriaLevel(el);
      ariaHeadings.push({
        selector: el.selector,
        level: ariaLevel,
        text: trimText(el.text),
      });
      seenLevelsInOrder.push({ level: ariaLevel, selector: el.selector });
      continue;
    }

    // Landmarks (native tag or ARIA role)
    if (tag === 'nav' || role === 'navigation') landmarks.nav++;
    else if (tag === 'main' || role === 'main') landmarks.main++;
    else if (tag === 'aside' || role === 'complementary') landmarks.aside++;
    else if (tag === 'header' || role === 'banner') landmarks.header++;
    else if (tag === 'footer' || role === 'contentinfo') landmarks.footer++;
    else if (tag === 'section' || role === 'region') landmarks.section++;
    else if (tag === 'form' || role === 'form') landmarks.form++;
  }

  // Findings on h1
  if (levels.h1.count === 0) {
    levels.h1.finding = 'no_h1_on_page';
  } else if (levels.h1.count > 1) {
    levels.h1.finding = 'multiple_h1s_on_page';
  }

  // Detect level skips (h1 → h3 with no h2 in between)
  const level_skips: LevelSkip[] = [];
  let prevLevel = 0;
  for (let i = 0; i < seenLevelsInOrder.length; i++) {
    const cur = seenLevelsInOrder[i]!.level;
    if (prevLevel > 0 && cur > prevLevel + 1) {
      level_skips.push({
        from: `h${prevLevel}`,
        to: `h${cur}`,
        at_position: i,
      });
    }
    prevLevel = cur;
  }

  return {
    h1: levels.h1,
    h2: levels.h2,
    h3: levels.h3,
    h4: levels.h4,
    h5: levels.h5,
    h6: levels.h6,
    landmarks,
    aria_headings: ariaHeadings,
    level_skips,
  };
}

/**
 * Parse aria-level from an element. Looks at the a11y bag and falls back
 * to className/selector hints. Returns 2 by default per ARIA spec
 * (role="heading" without aria-level is treated as level 2).
 */
function parseAriaLevel(el: EnhancedElement): number {
  // Test fixtures may stash aria-level on a11y via cast; production extract.ts
  // can be extended to populate this directly.
  const a11y = el.a11y as unknown as Record<string, unknown>;
  const raw = a11y['ariaLevel'] ?? a11y['aria-level'];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  return 2;
}
