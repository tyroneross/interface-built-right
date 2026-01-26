import { chromium, type Page, type Browser } from 'playwright';
import { VIEWPORTS, type Viewport } from './schemas.js';

/**
 * Layout issue detected during responsive testing
 */
export interface LayoutIssue {
  element: string;
  issue: 'overflow' | 'hidden' | 'truncated' | 'overlap' | 'too-small' | 'off-screen';
  description: string;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Touch target analysis
 */
export interface TouchTargetIssue {
  element: string;
  selector: string;
  size: { width: number; height: number };
  minimumSize: number;
  isTooSmall: boolean;
}

/**
 * Text readability issue
 */
export interface TextIssue {
  element: string;
  issue: 'too-small' | 'low-contrast';
  fontSize?: number;
  contrastRatio?: number;
}

/**
 * Single viewport test result
 */
export interface ViewportResult {
  viewport: Viewport;
  viewportName: string;
  layoutIssues: LayoutIssue[];
  touchTargets: TouchTargetIssue[];
  textIssues: TextIssue[];
  screenshot?: string;
}

/**
 * Full responsive test result
 */
export interface ResponsiveResult {
  url: string;
  results: ViewportResult[];
  summary: {
    totalIssues: number;
    viewportsWithIssues: number;
    criticalIssues: number;
  };
}

/**
 * Responsive test options
 */
export interface ResponsiveTestOptions {
  /** Viewports to test. Defaults to desktop, tablet, mobile */
  viewports?: Array<'desktop' | 'tablet' | 'mobile' | Viewport>;
  /** Capture screenshots for each viewport */
  captureScreenshots?: boolean;
  /** Output directory for screenshots */
  outputDir?: string;
  /** Minimum touch target size (default: 44px per WCAG) */
  minTouchTarget?: number;
  /** Minimum font size (default: 12px) */
  minFontSize?: number;
  /** Timeout for page load */
  timeout?: number;
}

/**
 * Test responsive behavior across multiple viewports
 */
export async function testResponsive(
  url: string,
  options: ResponsiveTestOptions = {}
): Promise<ResponsiveResult> {
  const {
    viewports = ['desktop', 'tablet', 'mobile'],
    captureScreenshots = false,
    outputDir = './.ibr/responsive',
    minTouchTarget = 44,
    minFontSize = 12,
    timeout = 30000,
  } = options;

  const results: ViewportResult[] = [];
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });

    for (const viewportSpec of viewports) {
      // Resolve viewport
      let viewport: Viewport;
      let viewportName: string;

      if (typeof viewportSpec === 'string') {
        viewport = VIEWPORTS[viewportSpec];
        viewportName = viewportSpec;
      } else {
        viewport = viewportSpec;
        viewportName = `${viewportSpec.width}x${viewportSpec.height}`;
      }

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
      });

      const page = await context.newPage();

      try {
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout,
        });

        // Wait for animations
        await page.waitForTimeout(500);

        // Run viewport-specific tests
        const result = await analyzeViewport(page, viewport, viewportName, {
          minTouchTarget,
          minFontSize,
        });

        // Capture screenshot if requested
        if (captureScreenshots) {
          const { mkdir } = await import('fs/promises');
          await mkdir(outputDir, { recursive: true });
          const screenshotPath = `${outputDir}/${viewportName}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          result.screenshot = screenshotPath;
        }

        results.push(result);
      } finally {
        await context.close();
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Calculate summary
  const totalIssues = results.reduce(
    (sum, r) => sum + r.layoutIssues.length + r.touchTargets.filter(t => t.isTooSmall).length + r.textIssues.length,
    0
  );
  const viewportsWithIssues = results.filter(
    r => r.layoutIssues.length > 0 || r.touchTargets.some(t => t.isTooSmall) || r.textIssues.length > 0
  ).length;
  const criticalIssues = results.reduce(
    (sum, r) => sum + r.layoutIssues.filter(i => i.issue === 'overflow' || i.issue === 'hidden').length,
    0
  );

  return {
    url,
    results,
    summary: {
      totalIssues,
      viewportsWithIssues,
      criticalIssues,
    },
  };
}

/**
 * Analyze a single viewport for responsive issues
 */
async function analyzeViewport(
  page: Page,
  viewport: Viewport,
  viewportName: string,
  options: { minTouchTarget: number; minFontSize: number }
): Promise<ViewportResult> {
  const isMobile = viewport.width < 768;

  const analysisResult = await page.evaluate(({ viewportWidth, minTouchTarget, minFontSize, isMobile }) => {
    const layoutIssues: LayoutIssue[] = [];
    const touchTargets: TouchTargetIssue[] = [];
    const textIssues: TextIssue[] = [];

    // Helper to get unique selector
    function getSelector(el: Element): string {
      if ((el as HTMLElement).id) return `#${(el as HTMLElement).id}`;
      const classes = Array.from(el.classList).slice(0, 2).join('.');
      const tag = el.tagName.toLowerCase();
      if (classes) return `${tag}.${classes}`;
      return tag;
    }

    // Check for horizontal overflow
    const bodyWidth = document.body.scrollWidth;
    if (bodyWidth > viewportWidth) {
      layoutIssues.push({
        element: 'body',
        issue: 'overflow',
        description: `Page has horizontal overflow (${bodyWidth}px > ${viewportWidth}px viewport)`,
        bounds: { x: 0, y: 0, width: bodyWidth, height: document.body.scrollHeight },
      });
    }

    // Check all elements for layout issues
    const allElements = Array.from(document.querySelectorAll('*'));
    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      // Skip invisible elements
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
        continue;
      }

      // Check for elements extending beyond viewport
      if (rect.right > viewportWidth + 10) { // 10px tolerance
        layoutIssues.push({
          element: getSelector(el),
          issue: 'overflow',
          description: `Element extends ${Math.round(rect.right - viewportWidth)}px beyond viewport`,
          bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }

      // Check for truncated text (text-overflow: ellipsis with overflow)
      if (style.textOverflow === 'ellipsis' && style.overflow === 'hidden') {
        const scrollWidth = (el as HTMLElement).scrollWidth;
        const clientWidth = (el as HTMLElement).clientWidth;
        if (scrollWidth > clientWidth) {
          layoutIssues.push({
            element: getSelector(el),
            issue: 'truncated',
            description: 'Text is truncated with ellipsis',
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          });
        }
      }
    }

    // Check touch targets (only on mobile-sized viewports)
    if (isMobile) {
      const interactiveElements = Array.from(document.querySelectorAll(
        'a, button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ));

      for (const el of interactiveElements) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        if (style.display === 'none' || style.visibility === 'hidden') {
          continue;
        }

        const width = rect.width;
        const height = rect.height;
        const isTooSmall = width < minTouchTarget || height < minTouchTarget;

        touchTargets.push({
          element: el.textContent?.trim().slice(0, 30) || getSelector(el),
          selector: getSelector(el),
          size: { width: Math.round(width), height: Math.round(height) },
          minimumSize: minTouchTarget,
          isTooSmall,
        });
      }
    }

    // Check text sizes
    const textElements = Array.from(document.querySelectorAll('p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6'));
    for (const el of textElements) {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);

      if (fontSize < minFontSize && el.textContent?.trim()) {
        textIssues.push({
          element: getSelector(el),
          issue: 'too-small',
          fontSize: Math.round(fontSize),
        });
      }
    }

    return { layoutIssues, touchTargets, textIssues };
  }, {
    viewportWidth: viewport.width,
    minTouchTarget: options.minTouchTarget,
    minFontSize: options.minFontSize,
    isMobile,
  });

  return {
    viewport,
    viewportName,
    ...analysisResult,
  };
}

/**
 * Format responsive test result for console output
 */
export function formatResponsiveResult(result: ResponsiveResult): string {
  const lines: string[] = [];

  lines.push('Responsive Test Results');
  lines.push('=======================');
  lines.push('');
  lines.push(`URL: ${result.url}`);
  lines.push(`Viewports tested: ${result.results.length}`);
  lines.push('');

  // Summary
  const icon = result.summary.criticalIssues > 0 ? '\x1b[31m✗\x1b[0m' :
               result.summary.totalIssues > 0 ? '\x1b[33m!\x1b[0m' : '\x1b[32m✓\x1b[0m';
  lines.push(`${icon} Total issues: ${result.summary.totalIssues}`);
  lines.push(`   Critical: ${result.summary.criticalIssues}`);
  lines.push(`   Viewports with issues: ${result.summary.viewportsWithIssues}/${result.results.length}`);
  lines.push('');

  // Per-viewport results
  for (const vr of result.results) {
    const issueCount = vr.layoutIssues.length +
                       vr.touchTargets.filter(t => t.isTooSmall).length +
                       vr.textIssues.length;

    const vpIcon = issueCount === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[33m!\x1b[0m';
    lines.push(`${vpIcon} ${vr.viewportName} (${vr.viewport.width}x${vr.viewport.height})`);

    if (issueCount === 0) {
      lines.push('   No issues detected');
    } else {
      // Layout issues
      if (vr.layoutIssues.length > 0) {
        lines.push('   Layout issues:');
        for (const issue of vr.layoutIssues.slice(0, 5)) {
          lines.push(`     ! ${issue.issue}: ${issue.description}`);
        }
        if (vr.layoutIssues.length > 5) {
          lines.push(`     ... and ${vr.layoutIssues.length - 5} more`);
        }
      }

      // Touch targets
      const smallTargets = vr.touchTargets.filter(t => t.isTooSmall);
      if (smallTargets.length > 0) {
        lines.push('   Small touch targets:');
        for (const target of smallTargets.slice(0, 5)) {
          lines.push(`     ! "${target.element}" is ${target.size.width}x${target.size.height}px (min: ${target.minimumSize}px)`);
        }
        if (smallTargets.length > 5) {
          lines.push(`     ... and ${smallTargets.length - 5} more`);
        }
      }

      // Text issues
      if (vr.textIssues.length > 0) {
        lines.push('   Text issues:');
        for (const issue of vr.textIssues.slice(0, 5)) {
          lines.push(`     ! ${issue.element}: ${issue.issue} (${issue.fontSize}px)`);
        }
        if (vr.textIssues.length > 5) {
          lines.push(`     ... and ${vr.textIssues.length - 5} more`);
        }
      }
    }

    if (vr.screenshot) {
      lines.push(`   Screenshot: ${vr.screenshot}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
