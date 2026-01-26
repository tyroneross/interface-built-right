import type { Page } from 'playwright';

/**
 * Web Vitals metrics
 * @see https://web.dev/vitals/
 */
export interface WebVitals {
  /** Largest Contentful Paint (ms) - loading performance */
  LCP: number | null;
  /** First Input Delay (ms) - interactivity (requires user interaction) */
  FID: number | null;
  /** Cumulative Layout Shift (score) - visual stability */
  CLS: number | null;
  /** Time to First Byte (ms) - server response time */
  TTFB: number | null;
  /** First Contentful Paint (ms) - initial render */
  FCP: number | null;
  /** Time to Interactive (ms) - when page becomes fully interactive */
  TTI: number | null;
}

/**
 * Performance thresholds for each metric
 * Based on Core Web Vitals guidelines
 */
export const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  FCP: { good: 1800, poor: 3000 },
  TTI: { good: 3800, poor: 7300 },
};

/**
 * Performance rating
 */
export type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

/**
 * Rated metric with value and rating
 */
export interface RatedMetric {
  value: number | null;
  rating: PerformanceRating | null;
}

/**
 * Full performance result with ratings
 */
export interface PerformanceResult {
  metrics: WebVitals;
  ratings: Record<keyof WebVitals, RatedMetric>;
  summary: {
    overallRating: PerformanceRating;
    passedVitals: number;
    totalVitals: number;
    issues: string[];
    recommendations: string[];
  };
}

/**
 * Rate a metric value against thresholds
 */
function rateMetric(
  value: number | null,
  thresholds: { good: number; poor: number }
): PerformanceRating | null {
  if (value === null) return null;
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Measure Core Web Vitals from a page
 *
 * Note: FID requires actual user interaction, so it will be null
 * for automated tests. Use TTI as an alternative measure.
 */
export async function measureWebVitals(page: Page): Promise<WebVitals> {
  const metrics = await page.evaluate(() => {
    return new Promise<WebVitals>((resolve) => {
      const result: WebVitals = {
        LCP: null,
        FID: null,
        CLS: null,
        TTFB: null,
        FCP: null,
        TTI: null,
      };

      // Get navigation timing for TTFB
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navEntry) {
        result.TTFB = navEntry.responseStart - navEntry.requestStart;
      }

      // Get paint timing for FCP
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
      if (fcpEntry) {
        result.FCP = fcpEntry.startTime;
      }

      // Use PerformanceObserver for LCP and CLS
      let lcpValue: number | null = null;
      let clsValue = 0;

      // LCP observer
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          lcpValue = lastEntry.startTime;
        }
      });

      // CLS observer
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // @ts-ignore - hadRecentInput is a valid property for layout-shift entries
          if (!entry.hadRecentInput) {
            // @ts-ignore - value is a valid property for layout-shift entries
            clsValue += entry.value;
          }
        }
      });

      try {
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // LCP not supported
      }

      try {
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch {
        // CLS not supported
      }

      // Wait for metrics to stabilize, then return
      setTimeout(() => {
        lcpObserver.disconnect();
        clsObserver.disconnect();

        result.LCP = lcpValue;
        result.CLS = clsValue;

        // Estimate TTI from navigation timing
        if (navEntry) {
          // TTI approximation: domInteractive + longest task estimate
          result.TTI = navEntry.domInteractive;
        }

        resolve(result);
      }, 3000); // Wait 3s for metrics
    });
  });

  return metrics;
}

/**
 * Measure performance and return rated results
 */
export async function measurePerformance(page: Page): Promise<PerformanceResult> {
  const metrics = await measureWebVitals(page);

  // Rate each metric
  const ratings: Record<keyof WebVitals, RatedMetric> = {
    LCP: { value: metrics.LCP, rating: rateMetric(metrics.LCP, PERFORMANCE_THRESHOLDS.LCP) },
    FID: { value: metrics.FID, rating: rateMetric(metrics.FID, PERFORMANCE_THRESHOLDS.FID) },
    CLS: { value: metrics.CLS, rating: rateMetric(metrics.CLS, PERFORMANCE_THRESHOLDS.CLS) },
    TTFB: { value: metrics.TTFB, rating: rateMetric(metrics.TTFB, PERFORMANCE_THRESHOLDS.TTFB) },
    FCP: { value: metrics.FCP, rating: rateMetric(metrics.FCP, PERFORMANCE_THRESHOLDS.FCP) },
    TTI: { value: metrics.TTI, rating: rateMetric(metrics.TTI, PERFORMANCE_THRESHOLDS.TTI) },
  };

  // Generate summary
  const issues: string[] = [];
  const recommendations: string[] = [];
  let passedVitals = 0;
  let totalVitals = 0;

  // Core Web Vitals: LCP, CLS (FID requires interaction)
  const coreVitals: (keyof WebVitals)[] = ['LCP', 'CLS', 'TTFB', 'FCP'];

  for (const vital of coreVitals) {
    const rated = ratings[vital];
    if (rated.value !== null) {
      totalVitals++;
      if (rated.rating === 'good') {
        passedVitals++;
      } else if (rated.rating === 'poor') {
        issues.push(`${vital} is poor (${formatMetric(vital, rated.value)})`);
        recommendations.push(getRecommendation(vital));
      } else if (rated.rating === 'needs-improvement') {
        issues.push(`${vital} needs improvement (${formatMetric(vital, rated.value)})`);
      }
    }
  }

  // Calculate overall rating
  const poorCount = Object.values(ratings).filter(r => r.rating === 'poor').length;
  const needsImprovementCount = Object.values(ratings).filter(r => r.rating === 'needs-improvement').length;

  let overallRating: PerformanceRating = 'good';
  if (poorCount > 0) {
    overallRating = 'poor';
  } else if (needsImprovementCount > 0) {
    overallRating = 'needs-improvement';
  }

  return {
    metrics,
    ratings,
    summary: {
      overallRating,
      passedVitals,
      totalVitals,
      issues,
      recommendations,
    },
  };
}

/**
 * Format a metric value for display
 */
function formatMetric(name: keyof WebVitals, value: number): string {
  if (name === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}

/**
 * Get improvement recommendation for a metric
 */
function getRecommendation(metric: keyof WebVitals): string {
  const recommendations: Record<keyof WebVitals, string> = {
    LCP: 'Optimize largest image/text block: use lazy loading, preload critical assets, optimize server response',
    FID: 'Reduce JavaScript execution time: split code, defer non-critical JS, use web workers',
    CLS: 'Reserve space for dynamic content: set explicit dimensions for images/ads/embeds',
    TTFB: 'Improve server response: use CDN, optimize database queries, enable caching',
    FCP: 'Eliminate render-blocking resources: inline critical CSS, defer non-critical JS',
    TTI: 'Reduce main thread work: minimize/defer JavaScript, reduce DOM size',
  };
  return recommendations[metric];
}

/**
 * Format performance result for console output
 */
export function formatPerformanceResult(result: PerformanceResult): string {
  const lines: string[] = [];

  lines.push('Performance Metrics');
  lines.push('===================');
  lines.push('');

  // Overall rating
  const ratingIcon = result.summary.overallRating === 'good' ? '✓' :
                     result.summary.overallRating === 'needs-improvement' ? '~' : '✗';
  const ratingColor = result.summary.overallRating === 'good' ? '\x1b[32m' :
                      result.summary.overallRating === 'needs-improvement' ? '\x1b[33m' : '\x1b[31m';
  lines.push(`Overall: ${ratingColor}${ratingIcon} ${result.summary.overallRating.toUpperCase()}\x1b[0m`);
  lines.push(`Passed: ${result.summary.passedVitals}/${result.summary.totalVitals} core vitals`);
  lines.push('');

  // Individual metrics
  lines.push('Core Web Vitals:');
  const vitals: (keyof WebVitals)[] = ['LCP', 'FCP', 'TTFB', 'CLS'];
  for (const vital of vitals) {
    const rated = result.ratings[vital];
    if (rated.value !== null) {
      const icon = rated.rating === 'good' ? '✓' :
                   rated.rating === 'needs-improvement' ? '~' : '✗';
      const color = rated.rating === 'good' ? '\x1b[32m' :
                    rated.rating === 'needs-improvement' ? '\x1b[33m' : '\x1b[31m';
      lines.push(`  ${color}${icon}\x1b[0m ${vital}: ${formatMetric(vital, rated.value)}`);
    }
  }

  // Issues
  if (result.summary.issues.length > 0) {
    lines.push('');
    lines.push('Issues:');
    for (const issue of result.summary.issues) {
      lines.push(`  ! ${issue}`);
    }
  }

  // Recommendations
  if (result.summary.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const rec of result.summary.recommendations) {
      lines.push(`  -> ${rec}`);
    }
  }

  return lines.join('\n');
}
