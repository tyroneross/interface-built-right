import type { Page, Request, Response } from 'playwright';

/**
 * API request timing info
 */
export interface ApiRequestTiming {
  url: string;
  method: string;
  duration: number;
  status: number;
  size: number;
  resourceType: string;
  timing: {
    dnsLookup?: number;
    tcpConnect?: number;
    tlsHandshake?: number;
    requestSent?: number;
    waiting?: number;
    contentDownload?: number;
  };
}

/**
 * API timing measurement result
 */
export interface ApiTimingResult {
  requests: ApiRequestTiming[];
  summary: {
    totalRequests: number;
    totalTime: number;
    totalSize: number;
    averageTime: number;
    slowestRequest: { url: string; duration: number } | null;
    fastestRequest: { url: string; duration: number } | null;
    failedRequests: number;
    byStatus: Record<number, number>;
  };
}

/**
 * Options for API timing measurement
 */
export interface ApiTimingOptions {
  /** Filter to only track URLs matching this pattern */
  filter?: RegExp;
  /** Include static resources (images, fonts, etc.) */
  includeStatic?: boolean;
  /** Timeout to wait for requests to complete (ms) */
  timeout?: number;
  /** Minimum duration to report (ms) - filters out fast requests */
  minDuration?: number;
}

/**
 * Measure API/network request timing on a page
 *
 * Call this before navigating to the page, then call stopMeasuring after navigation
 */
export async function measureApiTiming(
  page: Page,
  options: ApiTimingOptions = {}
): Promise<ApiTimingResult> {
  const {
    filter,
    includeStatic = false,
    timeout = 10000,
    minDuration = 0,
  } = options;

  const requests: Map<Request, { startTime: number }> = new Map();
  const completedRequests: ApiRequestTiming[] = [];

  // Track request start times
  const requestHandler = (request: Request) => {
    const url = request.url();
    const resourceType = request.resourceType();

    // Skip static resources unless requested
    if (!includeStatic && ['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
      return;
    }

    // Apply filter
    if (filter && !filter.test(url)) {
      return;
    }

    requests.set(request, { startTime: Date.now() });
  };

  // Track response completion
  const responseHandler = async (response: Response) => {
    const request = response.request();
    const requestData = requests.get(request);

    if (!requestData) return;

    const duration = Date.now() - requestData.startTime;

    // Skip if below minimum duration
    if (duration < minDuration) {
      requests.delete(request);
      return;
    }

    try {
      // Get response size
      const body = await response.body().catch(() => Buffer.alloc(0));
      const size = body.length;

      // Get timing info if available
      let timing: ReturnType<typeof request.timing> | Record<string, never> = {};
      try {
        timing = response.request().timing();
      } catch {
        // Timing not available
      }

      completedRequests.push({
        url: request.url(),
        method: request.method(),
        duration,
        status: response.status(),
        size,
        resourceType: request.resourceType(),
        timing: {
          dnsLookup: timing.domainLookupEnd !== undefined && timing.domainLookupStart !== undefined
            ? timing.domainLookupEnd - timing.domainLookupStart
            : undefined,
          tcpConnect: timing.connectEnd !== undefined && timing.connectStart !== undefined
            ? timing.connectEnd - timing.connectStart
            : undefined,
          requestSent: timing.requestStart !== undefined && timing.connectEnd !== undefined
            ? timing.requestStart - timing.connectEnd
            : undefined,
          waiting: timing.responseStart !== undefined && timing.requestStart !== undefined
            ? timing.responseStart - timing.requestStart
            : undefined,
          contentDownload: timing.responseEnd !== undefined && timing.responseStart !== undefined
            ? timing.responseEnd - timing.responseStart
            : undefined,
        },
      });
    } catch {
      // Ignore errors in timing collection
    }

    requests.delete(request);
  };

  // Track failed requests
  const requestFailedHandler = (request: Request) => {
    const requestData = requests.get(request);
    if (!requestData) return;

    const duration = Date.now() - requestData.startTime;

    completedRequests.push({
      url: request.url(),
      method: request.method(),
      duration,
      status: 0, // 0 indicates failure
      size: 0,
      resourceType: request.resourceType(),
      timing: {},
    });

    requests.delete(request);
  };

  // Attach listeners
  page.on('request', requestHandler);
  page.on('response', responseHandler);
  page.on('requestfailed', requestFailedHandler);

  // Wait for pending requests to complete
  await new Promise<void>((resolve) => {
    const startWait = Date.now();

    const check = () => {
      // All tracked requests completed or timeout
      if (requests.size === 0 || Date.now() - startWait > timeout) {
        resolve();
        return;
      }
      setTimeout(check, 100);
    };

    // Wait for initial load, then check periodically
    setTimeout(check, 1000);
  });

  // Clean up listeners
  page.off('request', requestHandler);
  page.off('response', responseHandler);
  page.off('requestfailed', requestFailedHandler);

  // Calculate summary
  const totalRequests = completedRequests.length;
  const totalTime = completedRequests.reduce((sum, r) => sum + r.duration, 0);
  const totalSize = completedRequests.reduce((sum, r) => sum + r.size, 0);
  const failedRequests = completedRequests.filter(r => r.status === 0 || r.status >= 400).length;

  // Find slowest/fastest
  let slowestRequest: { url: string; duration: number } | null = null;
  let fastestRequest: { url: string; duration: number } | null = null;

  if (completedRequests.length > 0) {
    const sorted = [...completedRequests].sort((a, b) => b.duration - a.duration);
    slowestRequest = { url: sorted[0].url, duration: sorted[0].duration };
    fastestRequest = { url: sorted[sorted.length - 1].url, duration: sorted[sorted.length - 1].duration };
  }

  // Count by status
  const byStatus: Record<number, number> = {};
  for (const req of completedRequests) {
    byStatus[req.status] = (byStatus[req.status] || 0) + 1;
  }

  return {
    requests: completedRequests.sort((a, b) => b.duration - a.duration),
    summary: {
      totalRequests,
      totalTime,
      totalSize,
      averageTime: totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0,
      slowestRequest,
      fastestRequest,
      failedRequests,
      byStatus,
    },
  };
}

/**
 * Create an API timing tracker that records during page interactions
 */
export function createApiTracker(page: Page, options: ApiTimingOptions = {}) {
  const {
    filter,
    includeStatic = false,
    minDuration = 0,
  } = options;

  const requests: Map<Request, { startTime: number }> = new Map();
  const completedRequests: ApiRequestTiming[] = [];
  let isTracking = false;

  const requestHandler = (request: Request) => {
    if (!isTracking) return;

    const url = request.url();
    const resourceType = request.resourceType();

    if (!includeStatic && ['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
      return;
    }

    if (filter && !filter.test(url)) {
      return;
    }

    requests.set(request, { startTime: Date.now() });
  };

  const responseHandler = async (response: Response) => {
    const request = response.request();
    const requestData = requests.get(request);

    if (!requestData) return;

    const duration = Date.now() - requestData.startTime;

    if (duration < minDuration) {
      requests.delete(request);
      return;
    }

    try {
      const body = await response.body().catch(() => Buffer.alloc(0));

      completedRequests.push({
        url: request.url(),
        method: request.method(),
        duration,
        status: response.status(),
        size: body.length,
        resourceType: request.resourceType(),
        timing: {},
      });
    } catch {
      // Ignore
    }

    requests.delete(request);
  };

  const requestFailedHandler = (request: Request) => {
    const requestData = requests.get(request);
    if (!requestData) return;

    completedRequests.push({
      url: request.url(),
      method: request.method(),
      duration: Date.now() - requestData.startTime,
      status: 0,
      size: 0,
      resourceType: request.resourceType(),
      timing: {},
    });

    requests.delete(request);
  };

  return {
    start() {
      isTracking = true;
      page.on('request', requestHandler);
      page.on('response', responseHandler);
      page.on('requestfailed', requestFailedHandler);
    },

    stop(): ApiTimingResult {
      isTracking = false;
      page.off('request', requestHandler);
      page.off('response', responseHandler);
      page.off('requestfailed', requestFailedHandler);

      const totalRequests = completedRequests.length;
      const totalTime = completedRequests.reduce((sum, r) => sum + r.duration, 0);
      const totalSize = completedRequests.reduce((sum, r) => sum + r.size, 0);
      const failedRequests = completedRequests.filter(r => r.status === 0 || r.status >= 400).length;

      let slowestRequest: { url: string; duration: number } | null = null;
      let fastestRequest: { url: string; duration: number } | null = null;

      if (completedRequests.length > 0) {
        const sorted = [...completedRequests].sort((a, b) => b.duration - a.duration);
        slowestRequest = { url: sorted[0].url, duration: sorted[0].duration };
        fastestRequest = { url: sorted[sorted.length - 1].url, duration: sorted[sorted.length - 1].duration };
      }

      const byStatus: Record<number, number> = {};
      for (const req of completedRequests) {
        byStatus[req.status] = (byStatus[req.status] || 0) + 1;
      }

      return {
        requests: completedRequests.sort((a, b) => b.duration - a.duration),
        summary: {
          totalRequests,
          totalTime,
          totalSize,
          averageTime: totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0,
          slowestRequest,
          fastestRequest,
          failedRequests,
          byStatus,
        },
      };
    },

    getRequests(): ApiRequestTiming[] {
      return [...completedRequests];
    },
  };
}

/**
 * Format API timing result for console output
 */
export function formatApiTimingResult(result: ApiTimingResult): string {
  const lines: string[] = [];

  lines.push('API Timing Analysis');
  lines.push('===================');
  lines.push('');

  // Summary
  lines.push('Summary:');
  lines.push(`  Total requests: ${result.summary.totalRequests}`);
  lines.push(`  Total time: ${result.summary.totalTime}ms`);
  lines.push(`  Total size: ${formatBytes(result.summary.totalSize)}`);
  lines.push(`  Average time: ${result.summary.averageTime}ms`);
  lines.push(`  Failed requests: ${result.summary.failedRequests}`);
  lines.push('');

  // Slowest/fastest
  if (result.summary.slowestRequest) {
    lines.push(`Slowest: ${result.summary.slowestRequest.duration}ms`);
    lines.push(`  ${truncateUrl(result.summary.slowestRequest.url)}`);
  }
  if (result.summary.fastestRequest && result.requests.length > 1) {
    lines.push(`Fastest: ${result.summary.fastestRequest.duration}ms`);
    lines.push(`  ${truncateUrl(result.summary.fastestRequest.url)}`);
  }
  lines.push('');

  // Top 10 slowest requests
  if (result.requests.length > 0) {
    lines.push('Slowest requests:');
    const top10 = result.requests.slice(0, 10);
    for (const req of top10) {
      const statusIcon = req.status === 0 ? '\x1b[31m✗\x1b[0m' :
                         req.status >= 400 ? '\x1b[31m!\x1b[0m' : '\x1b[32m✓\x1b[0m';
      lines.push(`  ${statusIcon} ${req.duration}ms ${req.method} ${truncateUrl(req.url)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Truncate URL for display
 */
function truncateUrl(url: string, maxLength = 60): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    if (path.length > maxLength) {
      return path.substring(0, maxLength - 3) + '...';
    }
    return path;
  } catch {
    if (url.length > maxLength) {
      return url.substring(0, maxLength - 3) + '...';
    }
    return url;
  }
}
