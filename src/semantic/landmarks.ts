/**
 * Landmark Element Detection
 *
 * Detects common landmark elements on a page. Used for:
 * 1. Storing detected elements in baseline
 * 2. Comparing current elements against baseline
 * 3. Inferring expected elements from page intent when no baseline exists
 */

import type { Page } from 'playwright';
import type { LandmarkElement } from '../schemas.js';
import type { PageIntent } from './page-intent.js';

/**
 * Standard landmark selectors
 */
export const LANDMARK_SELECTORS = {
  logo: 'img[src*="logo"], img[alt*="logo" i], [class*="logo"], [id*="logo"], svg[class*="logo"]',
  header: 'header, [role="banner"], [class*="header"]:not([class*="subheader"])',
  navigation: 'nav, [role="navigation"], [class*="nav"]:not([class*="subnav"])',
  main: 'main, [role="main"], [class*="main-content"], #main',
  footer: 'footer, [role="contentinfo"], [class*="footer"]',
  sidebar: 'aside, [role="complementary"], [class*="sidebar"]',
  search: 'input[type="search"], [role="search"], [class*="search-input"], input[name*="search"]',
  heading: 'h1',
  userMenu: '[class*="user-menu"], [class*="avatar"], [class*="profile"], [class*="account"]',
  loginForm: 'form:has(input[type="password"])',
  heroSection: '[class*="hero"], [class*="banner"], [class*="jumbotron"]',
  ctaButton: '[class*="cta"], a[class*="primary"], button[class*="primary"]',
} as const;

export type LandmarkType = keyof typeof LANDMARK_SELECTORS;

/**
 * Detect all landmark elements on a page
 */
export async function detectLandmarks(page: Page): Promise<LandmarkElement[]> {
  const landmarks: LandmarkElement[] = [];

  for (const [name, selector] of Object.entries(LANDMARK_SELECTORS)) {
    try {
      const element = await page.$(selector);
      if (element) {
        const box = await element.boundingBox();
        landmarks.push({
          name,
          selector,
          found: true,
          bounds: box ? {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          } : undefined,
        });
      } else {
        landmarks.push({
          name,
          selector,
          found: false,
        });
      }
    } catch {
      landmarks.push({
        name,
        selector,
        found: false,
      });
    }
  }

  return landmarks;
}

/**
 * Get expected landmarks based on page intent
 * Used when no baseline exists
 */
export function getExpectedLandmarksForIntent(intent: PageIntent): LandmarkType[] {
  const common: LandmarkType[] = ['header', 'navigation', 'main', 'footer', 'logo'];

  const intentSpecific: Record<PageIntent, LandmarkType[]> = {
    auth: ['loginForm', 'logo'],
    form: ['heading'],
    listing: ['search', 'heading'],
    detail: ['heading'],
    dashboard: ['sidebar', 'userMenu', 'heading'],
    error: ['heading'],
    landing: ['heroSection', 'ctaButton', 'heading'],
    empty: ['heading'],
    unknown: [],
  };

  // Combine common + intent-specific, dedupe
  const expected = [...new Set([...common, ...(intentSpecific[intent] || [])])];
  return expected;
}

/**
 * Compare current landmarks against baseline
 * Returns missing and new elements
 */
export function compareLandmarks(
  baseline: LandmarkElement[],
  current: LandmarkElement[]
): {
  missing: LandmarkElement[];  // Were in baseline, not in current
  added: LandmarkElement[];    // In current, not in baseline
  unchanged: LandmarkElement[];
} {
  const baselineFound = baseline.filter(l => l.found);
  const currentFound = current.filter(l => l.found);

  const baselineNames = new Set(baselineFound.map(l => l.name));
  const currentNames = new Set(currentFound.map(l => l.name));

  const missing = baselineFound.filter(l => !currentNames.has(l.name));
  const added = currentFound.filter(l => !baselineNames.has(l.name));
  const unchanged = currentFound.filter(l => baselineNames.has(l.name));

  return { missing, added, unchanged };
}

/**
 * Get expected landmarks based on user context (CLAUDE.md design framework)
 */
export function getExpectedLandmarksFromContext(
  framework: { principles: string[] } | null
): LandmarkType[] {
  if (!framework) return [];

  const expected: LandmarkType[] = [];

  // Parse principles for landmark requirements
  const principlesText = framework.principles.join(' ').toLowerCase();

  if (principlesText.includes('logo') || principlesText.includes('brand')) {
    expected.push('logo');
  }
  if (principlesText.includes('navigation') || principlesText.includes('nav')) {
    expected.push('navigation');
  }
  if (principlesText.includes('header') || principlesText.includes('banner')) {
    expected.push('header');
  }
  if (principlesText.includes('footer')) {
    expected.push('footer');
  }
  if (principlesText.includes('sidebar')) {
    expected.push('sidebar');
  }
  if (principlesText.includes('search')) {
    expected.push('search');
  }
  if (principlesText.includes('cta') || principlesText.includes('call-to-action')) {
    expected.push('ctaButton');
  }
  if (principlesText.includes('hero')) {
    expected.push('heroSection');
  }

  return expected;
}

/**
 * Format landmark comparison for display
 */
export function formatLandmarkComparison(
  comparison: ReturnType<typeof compareLandmarks>
): string {
  const lines: string[] = [];

  if (comparison.missing.length > 0) {
    lines.push('Missing (were in baseline):');
    for (const el of comparison.missing) {
      lines.push(`  ! ${el.name}`);
    }
  }

  if (comparison.added.length > 0) {
    lines.push('New (not in baseline):');
    for (const el of comparison.added) {
      lines.push(`  + ${el.name}`);
    }
  }

  if (comparison.unchanged.length > 0) {
    lines.push('Unchanged:');
    for (const el of comparison.unchanged) {
      lines.push(`  ✓ ${el.name}`);
    }
  }

  return lines.join('\n');
}
