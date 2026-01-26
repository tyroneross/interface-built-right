/**
 * Page Intent Classification
 *
 * Classifies pages by their semantic purpose based on DOM analysis.
 * This helps AI agents understand what kind of page they're looking at
 * without parsing raw accessibility trees.
 */

import type { Page } from 'playwright';

export type PageIntent =
  | 'auth'        // Login, register, forgot-password, reset-password
  | 'form'        // Contact, settings, profile edit, checkout
  | 'listing'     // Search results, product grid, table, feed
  | 'detail'      // Product page, article, profile view, single item
  | 'dashboard'   // Admin panel, user home, analytics
  | 'error'       // 404, 500, access denied, maintenance
  | 'landing'     // Marketing page, homepage with CTA
  | 'empty'       // Empty state, no content
  | 'unknown';

export interface PageIntentResult {
  intent: PageIntent;
  confidence: number;        // 0-1
  signals: string[];         // What led to this classification
  secondaryIntent?: PageIntent; // If page has mixed signals
}

interface IntentSignals {
  auth: number;
  form: number;
  listing: number;
  detail: number;
  dashboard: number;
  error: number;
  landing: number;
  empty: number;
}

/**
 * Classify page intent from DOM analysis
 */
export async function classifyPageIntent(page: Page): Promise<PageIntentResult> {
  const signals: string[] = [];
  const scores: IntentSignals = {
    auth: 0,
    form: 0,
    listing: 0,
    detail: 0,
    dashboard: 0,
    error: 0,
    landing: 0,
    empty: 0,
  };

  // Run all checks in parallel for speed
  const checks = await page.evaluate(() => {
    const doc = document;
    const body = doc.body;
    const text = body?.innerText?.toLowerCase() || '';

    // Helper to count elements
    const count = (selector: string) => doc.querySelectorAll(selector).length;
    const exists = (selector: string) => count(selector) > 0;
    const textContains = (terms: string[]) => terms.some(t => text.includes(t));

    return {
      // Auth signals
      hasPasswordField: exists('input[type="password"]'),
      hasEmailField: exists('input[type="email"], input[name*="email"], input[name*="username"]'),
      hasLoginText: textContains(['sign in', 'log in', 'login', 'sign up', 'register', 'forgot password', 'reset password']),
      hasRememberMe: exists('input[type="checkbox"][name*="remember"], label:has-text("remember")'),
      hasOAuthButtons: exists('[class*="google"], [class*="facebook"], [class*="github"], [class*="oauth"], [class*="social"]'),

      // Form signals
      formCount: count('form'),
      inputCount: count('input:not([type="hidden"]):not([type="search"])'),
      textareaCount: count('textarea'),
      selectCount: count('select'),
      hasSubmitButton: exists('button[type="submit"], input[type="submit"]'),
      hasFormLabels: count('label') > 2,

      // Listing signals
      listItemCount: count('li, [class*="item"], [class*="card"], [class*="row"]'),
      hasGrid: exists('[class*="grid"], [class*="list"], [class*="feed"]'),
      hasTable: exists('table tbody tr'),
      hasPagination: exists('[class*="pagination"], [class*="pager"], nav[aria-label*="page"]'),
      hasFilters: exists('[class*="filter"], [class*="sort"], [class*="facet"]'),
      repeatingSimilarElements: (() => {
        const cards = doc.querySelectorAll('[class*="card"], [class*="item"]');
        if (cards.length < 3) return false;
        const classes = Array.from(cards).map(c => c.className);
        const unique = new Set(classes);
        return unique.size <= 3; // Similar classes = listing
      })(),

      // Detail signals
      hasMainArticle: exists('article, main > [class*="content"], [class*="detail"]'),
      hasLongContent: text.length > 2000,
      hasSingleHeading: count('h1') === 1,
      hasMetadata: exists('[class*="meta"], [class*="author"], [class*="date"], time'),
      hasComments: exists('[class*="comment"], [id*="comment"]'),
      hasSocialShare: exists('[class*="share"], [class*="social"]'),

      // Dashboard signals
      hasCharts: exists('canvas, svg[class*="chart"], [class*="chart"], [class*="graph"]'),
      hasStats: exists('[class*="stat"], [class*="metric"], [class*="kpi"]'),
      hasSidebar: exists('aside, [class*="sidebar"], nav[class*="side"]'),
      hasWidgets: exists('[class*="widget"], [class*="panel"], [class*="tile"]'),
      hasUserMenu: exists('[class*="user"], [class*="avatar"], [class*="profile"]'),
      hasNavTabs: exists('[role="tablist"], [class*="tabs"]'),

      // Error signals
      hasErrorCode: textContains(['404', '500', '403', '401', 'not found', 'error', 'denied', 'forbidden']),
      hasErrorClass: exists('[class*="error"], [class*="404"], [class*="500"]'),
      isMinimalContent: text.length < 200,
      hasBackLink: textContains(['go back', 'go home', 'return']),

      // Landing signals
      hasHero: exists('[class*="hero"], [class*="banner"], [class*="jumbotron"]'),
      hasCTA: exists('[class*="cta"], [class*="call-to-action"], a[class*="primary"]'),
      hasTestimonials: exists('[class*="testimonial"], [class*="review"], [class*="quote"]'),
      hasPricing: exists('[class*="pricing"], [class*="plan"]'),
      hasFeatures: exists('[class*="feature"], [class*="benefit"]'),

      // Empty signals
      hasEmptyState: exists('[class*="empty"], [class*="no-data"], [class*="no-results"]'),
      hasEmptyText: textContains(['no results', 'nothing here', 'no items', 'empty']),

      // General metrics
      totalElements: count('*'),
      interactiveElements: count('a, button, input, select, textarea'),
    };
  });

  // Score auth intent
  if (checks.hasPasswordField) {
    scores.auth += 40;
    signals.push('password field present');
  }
  if (checks.hasEmailField && checks.hasPasswordField) {
    scores.auth += 20;
    signals.push('email + password combination');
  }
  if (checks.hasLoginText) {
    scores.auth += 15;
    signals.push('login-related text');
  }
  if (checks.hasRememberMe) {
    scores.auth += 10;
    signals.push('remember me checkbox');
  }
  if (checks.hasOAuthButtons) {
    scores.auth += 10;
    signals.push('OAuth buttons');
  }

  // Score form intent (but not auth)
  if (checks.formCount > 0 && !checks.hasPasswordField) {
    scores.form += 20;
    signals.push('form without password');
  }
  if (checks.inputCount > 3 && !checks.hasPasswordField) {
    scores.form += 15;
    signals.push('multiple input fields');
  }
  if (checks.textareaCount > 0) {
    scores.form += 15;
    signals.push('textarea present');
  }
  if (checks.hasFormLabels && checks.inputCount > 2) {
    scores.form += 10;
    signals.push('labeled form fields');
  }

  // Score listing intent
  if (checks.listItemCount > 5) {
    scores.listing += 25;
    signals.push(`${checks.listItemCount} list items`);
  }
  if (checks.hasGrid) {
    scores.listing += 15;
    signals.push('grid/list layout');
  }
  if (checks.hasTable) {
    scores.listing += 20;
    signals.push('data table');
  }
  if (checks.hasPagination) {
    scores.listing += 20;
    signals.push('pagination');
  }
  if (checks.hasFilters) {
    scores.listing += 15;
    signals.push('filters/sorting');
  }
  if (checks.repeatingSimilarElements) {
    scores.listing += 15;
    signals.push('repeating card elements');
  }

  // Score detail intent
  if (checks.hasMainArticle) {
    scores.detail += 25;
    signals.push('main article element');
  }
  if (checks.hasLongContent) {
    scores.detail += 20;
    signals.push('long content');
  }
  if (checks.hasSingleHeading && checks.hasMetadata) {
    scores.detail += 20;
    signals.push('single heading with metadata');
  }
  if (checks.hasComments) {
    scores.detail += 15;
    signals.push('comments section');
  }
  if (checks.hasSocialShare) {
    scores.detail += 10;
    signals.push('social share buttons');
  }

  // Score dashboard intent
  if (checks.hasCharts) {
    scores.dashboard += 30;
    signals.push('charts/graphs');
  }
  if (checks.hasStats) {
    scores.dashboard += 25;
    signals.push('stats/metrics');
  }
  if (checks.hasSidebar && checks.hasWidgets) {
    scores.dashboard += 20;
    signals.push('sidebar with widgets');
  }
  if (checks.hasNavTabs) {
    scores.dashboard += 10;
    signals.push('navigation tabs');
  }
  if (checks.hasUserMenu) {
    scores.dashboard += 10;
    signals.push('user menu');
  }

  // Score error intent
  if (checks.hasErrorCode && checks.isMinimalContent) {
    scores.error += 50;
    signals.push('error code with minimal content');
  }
  if (checks.hasErrorClass) {
    scores.error += 30;
    signals.push('error CSS class');
  }
  if (checks.hasBackLink && checks.isMinimalContent) {
    scores.error += 20;
    signals.push('back link on minimal page');
  }

  // Score landing intent
  if (checks.hasHero) {
    scores.landing += 25;
    signals.push('hero section');
  }
  if (checks.hasCTA) {
    scores.landing += 20;
    signals.push('call-to-action');
  }
  if (checks.hasTestimonials) {
    scores.landing += 15;
    signals.push('testimonials');
  }
  if (checks.hasPricing) {
    scores.landing += 20;
    signals.push('pricing section');
  }
  if (checks.hasFeatures) {
    scores.landing += 15;
    signals.push('features section');
  }

  // Score empty intent
  if (checks.hasEmptyState) {
    scores.empty += 40;
    signals.push('empty state element');
  }
  if (checks.hasEmptyText && checks.listItemCount === 0) {
    scores.empty += 30;
    signals.push('empty text with no items');
  }

  // Find highest scoring intent
  const entries = Object.entries(scores) as [PageIntent, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const [topIntent, topScore] = entries[0];
  const [secondIntent, secondScore] = entries[1];

  // Calculate confidence (normalize to 0-1)
  const maxPossible = 100;
  const confidence = Math.min(topScore / maxPossible, 1);

  // Determine if there's a secondary intent worth mentioning
  const hasSecondary = secondScore > 30 && secondScore > topScore * 0.5;

  return {
    intent: topScore > 20 ? topIntent : 'unknown',
    confidence,
    signals: signals.slice(0, 5), // Top 5 signals
    secondaryIntent: hasSecondary ? secondIntent : undefined,
  };
}

/**
 * Get human-readable description of page intent
 */
export function getIntentDescription(intent: PageIntent): string {
  const descriptions: Record<PageIntent, string> = {
    auth: 'Authentication page (login, register, password reset)',
    form: 'Form page (data entry, settings, contact)',
    listing: 'Listing page (search results, product grid, table)',
    detail: 'Detail page (article, product, profile)',
    dashboard: 'Dashboard (admin panel, analytics, user home)',
    error: 'Error page (404, 500, access denied)',
    landing: 'Landing page (marketing, homepage)',
    empty: 'Empty state (no content)',
    unknown: 'Unknown page type',
  };
  return descriptions[intent];
}
