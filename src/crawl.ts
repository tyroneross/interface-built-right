import { chromium, Browser } from 'playwright';
import { URL } from 'url';

export interface CrawlOptions {
  /** Starting URL */
  url: string;
  /** Maximum number of pages to discover (default: 5) */
  maxPages?: number;
  /** Only crawl pages under this path prefix */
  pathPrefix?: string;
  /** Timeout per page in ms (default: 10000) */
  timeout?: number;
  /** Include external links (default: false) */
  includeExternal?: boolean;
}

export interface DiscoveredPage {
  url: string;
  path: string;
  title: string;
  linkText?: string;
  depth: number;
}

export interface CrawlResult {
  baseUrl: string;
  pages: DiscoveredPage[];
  totalLinks: number;
  crawlTime: number;
}

/**
 * Discover pages on a website by crawling from the starting URL
 * Returns up to maxPages unique pages within the same origin
 */
export async function discoverPages(options: CrawlOptions): Promise<CrawlResult> {
  const {
    url,
    maxPages = 5,
    pathPrefix,
    timeout = 10000,
    includeExternal = false,
  } = options;

  const startTime = Date.now();
  const startUrl = new URL(url);
  const origin = startUrl.origin;

  const discovered: Map<string, DiscoveredPage> = new Map();
  const visited: Set<string> = new Set();
  const queue: { url: string; depth: number; linkText?: string }[] = [
    { url: url, depth: 0 }
  ];

  let browser: Browser | null = null;
  let totalLinks = 0;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    while (queue.length > 0 && discovered.size < maxPages) {
      const current = queue.shift();
      if (!current) break;

      const currentUrl = normalizeUrl(current.url);
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        // Navigate to page
        await page.goto(current.url, {
          waitUntil: 'domcontentloaded',
          timeout,
        });

        // Get page title
        const title = await page.title();

        // Add to discovered pages
        const parsedUrl = new URL(current.url);
        discovered.set(currentUrl, {
          url: current.url,
          path: parsedUrl.pathname,
          title: title || parsedUrl.pathname,
          linkText: current.linkText,
          depth: current.depth,
        });

        // Only continue crawling if we haven't reached max
        if (discovered.size >= maxPages) break;

        // Find all links on the page
        const links = await page.evaluate((): { href: string; text: string }[] => {
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          return anchors.map((a: Element) => ({
            href: (a as HTMLAnchorElement).getAttribute('href') || '',
            text: a.textContent?.trim() || '',
          }));
        });

        totalLinks += links.length;

        // Process links
        for (const link of links) {
          if (discovered.size >= maxPages) break;

          try {
            const absoluteUrl = new URL(link.href, current.url);
            const normalizedUrl = normalizeUrl(absoluteUrl.href);

            // Skip if already visited or queued
            if (visited.has(normalizedUrl)) continue;

            // Check if same origin
            if (!includeExternal && absoluteUrl.origin !== origin) continue;

            // Check path prefix if specified
            if (pathPrefix && !absoluteUrl.pathname.startsWith(pathPrefix)) continue;

            // Skip common non-page URLs
            if (shouldSkipUrl(absoluteUrl)) continue;

            // Add to queue
            queue.push({
              url: absoluteUrl.href,
              depth: current.depth + 1,
              linkText: link.text,
            });
          } catch {
            // Invalid URL, skip
          }
        }
      } catch (error) {
        // Page failed to load, continue with next
        console.error(`Failed to load ${current.url}:`, error instanceof Error ? error.message : error);
      }
    }

    await browser.close();
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }

  const crawlTime = Date.now() - startTime;

  return {
    baseUrl: origin,
    pages: Array.from(discovered.values()).sort((a, b) => {
      // Sort by depth first, then by path
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.path.localeCompare(b.path);
    }),
    totalLinks,
    crawlTime,
  };
}

/**
 * Normalize URL for comparison (remove trailing slash, hash, query params)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove hash and query, normalize trailing slash
    let normalized = `${parsed.origin}${parsed.pathname}`;
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Check if URL should be skipped (non-page resources)
 */
function shouldSkipUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  const skipExtensions = [
    '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
    '.css', '.js', '.json', '.xml', '.ico', '.woff', '.woff2',
    '.mp3', '.mp4', '.webm', '.zip', '.tar', '.gz',
  ];

  if (skipExtensions.some(ext => path.endsWith(ext))) return true;

  // Skip common non-content paths
  const skipPaths = [
    '/api/', '/static/', '/assets/', '/_next/', '/fonts/',
    '/images/', '/img/', '/cdn/', '/admin/', '/auth/',
  ];

  if (skipPaths.some(p => path.includes(p))) return true;

  // Skip hash-only links
  if (url.hash && url.pathname === '/') return true;

  return false;
}

/**
 * Quick scan to get navigation links from a page
 * Useful for finding main pages without full crawl
 */
export async function getNavigationLinks(url: string): Promise<DiscoveredPage[]> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const origin = new URL(url).origin;

    // Find links in navigation elements
    const navLinks = await page.evaluate((): { href: string; text: string }[] => {
      const selectors = [
        'nav a[href]',
        'header a[href]',
        '[role="navigation"] a[href]',
        '.nav a[href]',
        '.navbar a[href]',
        '.sidebar a[href]',
        '.menu a[href]',
      ];

      const links: { href: string; text: string }[] = [];
      const seen = new Set<string>();

      for (const selector of selectors) {
        const anchors = Array.from(document.querySelectorAll(selector));
        for (const a of anchors) {
          const href = (a as HTMLAnchorElement).getAttribute('href');
          const text = a.textContent?.trim();
          if (href && text && !seen.has(href)) {
            seen.add(href);
            links.push({ href, text });
          }
        }
      }

      return links;
    });

    await browser.close();

    // Convert to DiscoveredPage format
    const pages: DiscoveredPage[] = [];

    for (const link of navLinks) {
      try {
        const absoluteUrl = new URL(link.href, url);

        // Only include same-origin links
        if (absoluteUrl.origin !== origin) continue;

        // Skip resources
        if (shouldSkipUrl(absoluteUrl)) continue;

        pages.push({
          url: absoluteUrl.href,
          path: absoluteUrl.pathname,
          title: link.text,
          linkText: link.text,
          depth: 1,
        });
      } catch {
        // Invalid URL
      }
    }

    // Remove duplicates by path
    const uniquePages = new Map<string, DiscoveredPage>();
    for (const page of pages) {
      if (!uniquePages.has(page.path)) {
        uniquePages.set(page.path, page);
      }
    }

    return Array.from(uniquePages.values());
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}
