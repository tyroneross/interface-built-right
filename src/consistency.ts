import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import type { PageLike } from './engine/page-like.js';

// ─── Theme Analysis ──────────────────────────────────────────────────────────

export interface ThemeAnalysis {
  pageBackground: { color: string; luminance: number };
  contentCards: Array<{ selector: string; color: string; luminance: number }>;
  themeMismatch: boolean;
  mismatchDetails?: string;
}

/**
 * Parse a CSS color string to { r, g, b } in 0-255 range.
 * Handles: rgb(r,g,b), rgba(r,g,b,a), #rrggbb, #rgb, named colors (white, black).
 */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color || color === 'transparent') return null;

  // rgb / rgba
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return { r: Number(rgbMatch[1]), g: Number(rgbMatch[2]), b: Number(rgbMatch[3]) };
  }

  // hex #rrggbb or #rgb
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // Named colors
  const named: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
  };
  return named[color.toLowerCase()] ?? null;
}

/**
 * Calculate WCAG relative luminance from an RGB value (0-255 per channel).
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B, linearized from sRGB.
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Detect light-on-dark or dark-on-light theme mismatch between the page background
 * and primary content containers (cards, forms, modals, panels, dialogs).
 */
export async function analyzeThemeConsistency(page: PageLike): Promise<ThemeAnalysis> {
  const data = await page.evaluate(() => {
    // Page background
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
    const pageBg = (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent')
      ? bodyBg
      : htmlBg;

    // Content container selectors
    const containerSelectors = [
      '[class*="card"]',
      '[class*="form"]',
      '[class*="dialog"]',
      '[class*="modal"]',
      '[class*="panel"]',
      'main > *',
      'form',
    ];

    const cards: Array<{ selector: string; color: string }> = [];
    const seen = new Set<Element>();

    for (const sel of containerSelectors) {
      let elements: Element[];
      try {
        elements = Array.from(document.querySelectorAll(sel));
      } catch {
        continue;
      }
      for (const el of elements) {
        if (seen.has(el)) continue;
        seen.add(el);
        const bg = window.getComputedStyle(el as HTMLElement).backgroundColor;
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
        // Only count elements with meaningful size (> 50x50px)
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) continue;
        cards.push({ selector: sel, color: bg });
        if (cards.length >= 10) break;
      }
      if (cards.length >= 10) break;
    }

    return { pageBg, cards };
  });

  // Compute page background luminance
  const pageParsed = parseColor(data.pageBg);
  const pageLuminance = pageParsed
    ? relativeLuminance(pageParsed.r, pageParsed.g, pageParsed.b)
    : 0.5; // unknown — assume mid

  const pageBackground = { color: data.pageBg, luminance: pageLuminance };

  // Compute content card luminances
  const contentCards = data.cards.map((c: { selector: string; color: string }) => {
    const parsed = parseColor(c.color);
    const luminance = parsed ? relativeLuminance(parsed.r, parsed.g, parsed.b) : 0.5;
    return { selector: c.selector, color: c.color, luminance };
  });

  // Detect mismatch
  let themeMismatch = false;
  let mismatchDetails: string | undefined;

  const darkPage = pageLuminance < 0.2;
  const lightPage = pageLuminance > 0.7;

  for (const card of contentCards) {
    if (darkPage && card.luminance > 0.7) {
      themeMismatch = true;
      mismatchDetails =
        `Page background is dark (luminance ${pageLuminance.toFixed(3)}) but a content container ` +
        `matched by "${card.selector}" has a light background (luminance ${card.luminance.toFixed(3)})`;
      break;
    }
    if (lightPage && card.luminance < 0.2) {
      themeMismatch = true;
      mismatchDetails =
        `Page background is light (luminance ${pageLuminance.toFixed(3)}) but a content container ` +
        `matched by "${card.selector}" has a dark background (luminance ${card.luminance.toFixed(3)})`;
      break;
    }
  }

  return { pageBackground, contentCards, themeMismatch, mismatchDetails };
}

/**
 * UI metrics extracted from a page for consistency checking
 */
export interface PageMetrics {
  url: string;
  path: string;
  title: string;

  // Layout metrics
  layout: {
    headerHeight: number | null;
    navWidth: number | null;
    contentPadding: { top: number; right: number; bottom: number; left: number } | null;
    footerHeight: number | null;
  };

  // Typography metrics
  typography: {
    bodyFontFamily: string | null;
    bodyFontSize: string | null;
    headingFontFamily: string | null;
    h1FontSize: string | null;
    h2FontSize: string | null;
    lineHeight: string | null;
  };

  // Color metrics
  colors: {
    backgroundColor: string | null;
    textColor: string | null;
    linkColor: string | null;
    primaryButtonBg: string | null;
    primaryButtonText: string | null;
  };

  // Spacing metrics (common elements)
  spacing: {
    buttonPadding: string | null;
    cardPadding: string | null;
    sectionGap: string | null;
  };
}

/**
 * Inconsistency found between pages
 */
export interface Inconsistency {
  type: 'layout' | 'typography' | 'color' | 'spacing';
  property: string;
  severity: 'info' | 'warning' | 'error';
  description: string;
  pages: Array<{
    path: string;
    value: string | number | null;
  }>;
  suggestion?: string;
}

/**
 * Consistency check result
 */
export interface ConsistencyResult {
  pages: PageMetrics[];
  inconsistencies: Inconsistency[];
  score: number; // 0-100, higher is more consistent
  summary: string;
}

/**
 * Consistency check options
 */
export interface ConsistencyOptions {
  /** URLs to check */
  urls: string[];
  /** Enable verbose output */
  verbose?: boolean;
  /** Timeout per page (ms) */
  timeout?: number;
  /** Ignore certain property types */
  ignore?: Array<'layout' | 'typography' | 'color' | 'spacing'>;
}

/**
 * Extract UI metrics from a page
 */
async function extractMetrics(page: PageLike, url: string): Promise<PageMetrics> {
  const parsedUrl = new URL(url);

  const metrics = await page.evaluate(() => {
    const getComputedStyleProp = (selector: string, prop: string): string | null => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue(prop) || null;
    };

    const getElementHeight = (selector: string): number | null => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return el.getBoundingClientRect().height;
    };

    const getElementWidth = (selector: string): number | null => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return el.getBoundingClientRect().width;
    };

    // Try multiple selectors for common elements
    const headerSelectors = ['header', '[role="banner"]', '.header', '#header', 'nav'];
    const navSelectors = ['nav', '[role="navigation"]', '.sidebar', '.nav', '#sidebar'];
    const mainSelectors = ['main', '[role="main"]', '.content', '#content', '.main'];
    const footerSelectors = ['footer', '[role="contentinfo"]', '.footer', '#footer'];
    const buttonSelectors = ['button', '.btn', '[role="button"]', 'a.button'];
    const cardSelectors = ['.card', '[class*="card"]', '.panel', '.box'];

    const findFirst = (selectors: string[], fn: (s: string) => string | number | null) => {
      for (const sel of selectors) {
        const result = fn(sel);
        if (result !== null) return result;
      }
      return null;
    };

    // Get padding from main content
    const getContentPadding = (): { top: number; right: number; bottom: number; left: number } | null => {
      for (const sel of mainSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const style = window.getComputedStyle(el);
          return {
            top: parseFloat(style.paddingTop) || 0,
            right: parseFloat(style.paddingRight) || 0,
            bottom: parseFloat(style.paddingBottom) || 0,
            left: parseFloat(style.paddingLeft) || 0,
          };
        }
      }
      return null;
    };

    return {
      title: document.title,
      layout: {
        headerHeight: findFirst(headerSelectors, getElementHeight) as number | null,
        navWidth: findFirst(navSelectors, getElementWidth) as number | null,
        contentPadding: getContentPadding(),
        footerHeight: findFirst(footerSelectors, getElementHeight) as number | null,
      },
      typography: {
        bodyFontFamily: getComputedStyleProp('body', 'font-family'),
        bodyFontSize: getComputedStyleProp('body', 'font-size'),
        headingFontFamily: getComputedStyleProp('h1, h2, h3', 'font-family'),
        h1FontSize: getComputedStyleProp('h1', 'font-size'),
        h2FontSize: getComputedStyleProp('h2', 'font-size'),
        lineHeight: getComputedStyleProp('body', 'line-height'),
      },
      colors: {
        backgroundColor: getComputedStyleProp('body', 'background-color'),
        textColor: getComputedStyleProp('body', 'color'),
        linkColor: getComputedStyleProp('a', 'color'),
        primaryButtonBg: findFirst(buttonSelectors, s => getComputedStyleProp(s, 'background-color')) as string | null,
        primaryButtonText: findFirst(buttonSelectors, s => getComputedStyleProp(s, 'color')) as string | null,
      },
      spacing: {
        buttonPadding: findFirst(buttonSelectors, s => getComputedStyleProp(s, 'padding')) as string | null,
        cardPadding: findFirst(cardSelectors, s => getComputedStyleProp(s, 'padding')) as string | null,
        sectionGap: getComputedStyleProp('main > *', 'margin-bottom'),
      },
    };
  });

  return {
    url,
    path: parsedUrl.pathname,
    ...metrics,
  };
}

/**
 * Compare metrics across pages and find inconsistencies
 */
function findInconsistencies(pages: PageMetrics[], ignore: string[] = []): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  // Helper to check if values are consistent
  const checkProperty = (
    type: Inconsistency['type'],
    property: string,
    getValue: (p: PageMetrics) => string | number | null,
    description: string,
    severity: Inconsistency['severity'] = 'warning'
  ) => {
    if (ignore.includes(type)) return;

    const values = pages.map(p => ({
      path: p.path,
      value: getValue(p),
    }));

    // Filter out null values
    const nonNullValues = values.filter(v => v.value !== null);
    if (nonNullValues.length < 2) return;

    // Check if all values are the same
    const uniqueValues = new Set(nonNullValues.map(v => String(v.value)));
    if (uniqueValues.size > 1) {
      inconsistencies.push({
        type,
        property,
        severity,
        description,
        pages: values,
      });
    }
  };

  // Layout checks
  checkProperty('layout', 'headerHeight', p => p.layout.headerHeight, 'Header height differs across pages');
  checkProperty('layout', 'navWidth', p => p.layout.navWidth, 'Navigation width differs across pages');
  checkProperty('layout', 'footerHeight', p => p.layout.footerHeight, 'Footer height differs across pages');

  // Typography checks
  checkProperty('typography', 'bodyFontFamily', p => p.typography.bodyFontFamily, 'Body font family differs across pages', 'error');
  checkProperty('typography', 'bodyFontSize', p => p.typography.bodyFontSize, 'Body font size differs across pages');
  checkProperty('typography', 'headingFontFamily', p => p.typography.headingFontFamily, 'Heading font family differs across pages', 'error');
  checkProperty('typography', 'h1FontSize', p => p.typography.h1FontSize, 'H1 font size differs across pages');
  checkProperty('typography', 'lineHeight', p => p.typography.lineHeight, 'Line height differs across pages');

  // Color checks
  checkProperty('color', 'backgroundColor', p => p.colors.backgroundColor, 'Background color differs across pages');
  checkProperty('color', 'textColor', p => p.colors.textColor, 'Text color differs across pages', 'error');
  checkProperty('color', 'linkColor', p => p.colors.linkColor, 'Link color differs across pages');
  checkProperty('color', 'primaryButtonBg', p => p.colors.primaryButtonBg, 'Primary button background differs across pages');

  // Spacing checks
  checkProperty('spacing', 'buttonPadding', p => p.spacing.buttonPadding, 'Button padding differs across pages');
  checkProperty('spacing', 'cardPadding', p => p.spacing.cardPadding, 'Card padding differs across pages');

  return inconsistencies;
}

/**
 * Calculate consistency score based on inconsistencies
 */
function calculateScore(inconsistencies: Inconsistency[]): number {
  if (inconsistencies.length === 0) return 100;

  const weights = { error: 10, warning: 5, info: 1 };
  const totalPenalty = inconsistencies.reduce((sum, i) => sum + weights[i.severity], 0);

  // Score decreases based on penalty, minimum 0
  return Math.max(0, 100 - totalPenalty);
}

/**
 * Check UI consistency across multiple pages
 */
export async function checkConsistency(options: ConsistencyOptions): Promise<ConsistencyResult> {
  const { urls, timeout = 15000, ignore = [] } = options;

  let driver: EngineDriver | null = null;
  const pages: PageMetrics[] = [];

  try {
    driver = new EngineDriver();
    await driver.launch({
      headless: true,
      viewport: { width: 1920, height: 1080 },
    });
    const page = new CompatPage(driver);

    for (const url of urls) {
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout,
        });

        const metrics = await extractMetrics(page, url);
        pages.push(metrics);
      } catch (error) {
        console.error(`Failed to analyze ${url}:`, error instanceof Error ? error.message : error);
      }
    }

    await driver.close();
  } catch (error) {
    if (driver) await driver.close();
    throw error;
  }

  if (pages.length < 2) {
    return {
      pages,
      inconsistencies: [],
      score: 100,
      summary: 'Need at least 2 pages to check consistency',
    };
  }

  const inconsistencies = findInconsistencies(pages, ignore);
  const score = calculateScore(inconsistencies);

  const errorCount = inconsistencies.filter(i => i.severity === 'error').length;
  const warningCount = inconsistencies.filter(i => i.severity === 'warning').length;

  let summary: string;
  if (score === 100) {
    summary = `All ${pages.length} pages are consistent.`;
  } else if (score >= 80) {
    summary = `Minor inconsistencies found across ${pages.length} pages. ${warningCount} warning(s).`;
  } else if (score >= 50) {
    summary = `Notable inconsistencies found. ${errorCount} error(s), ${warningCount} warning(s).`;
  } else {
    summary = `Significant style inconsistencies detected. ${errorCount} error(s), ${warningCount} warning(s). Review recommended.`;
  }

  return {
    pages,
    inconsistencies,
    score,
    summary,
  };
}

/**
 * Format consistency result for display
 */
export function formatConsistencyReport(result: ConsistencyResult): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  UI CONSISTENCY REPORT');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Score: ${result.score}/100`);
  lines.push(`Pages analyzed: ${result.pages.length}`);
  lines.push(`Summary: ${result.summary}`);
  lines.push('');

  if (result.inconsistencies.length === 0) {
    lines.push('✓ No inconsistencies found');
  } else {
    lines.push('Inconsistencies:');
    lines.push('');

    for (const issue of result.inconsistencies) {
      const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '!' : 'ℹ';
      lines.push(`  ${icon} [${issue.type}] ${issue.description}`);

      for (const page of issue.pages) {
        if (page.value !== null) {
          lines.push(`      ${page.path}: ${page.value}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('───────────────────────────────────────────────────────────');
  lines.push('Pages analyzed:');
  for (const page of result.pages) {
    lines.push(`  • ${page.path} (${page.title})`);
  }

  return lines.join('\n');
}
