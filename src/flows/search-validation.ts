/**
 * Search Validation
 *
 * Generates structured output for Claude Code to analyze search results.
 * Provides context for AI-powered relevance checking.
 */

import type { AISearchResult, ExtractedResult, SearchTiming } from './types.js';

/**
 * Context for AI validation of search results
 */
export interface ValidationContext {
  /** The search query executed */
  query: string;
  /** What the user expected to find */
  userIntent: string;
  /** Extracted results for analysis */
  results: ExtractedResult[];
  /** Paths to screenshots for visual inspection */
  screenshotPaths: string[];
  /** Timing metrics */
  timing: SearchTiming;
  /** Timestamp of the search */
  timestamp: string;
  /** Whether any results were found */
  hasResults: boolean;
  /** Total result count */
  resultCount: number;
}

/**
 * Result from AI validation
 */
export interface ValidationResult {
  /** Whether results are relevant to user intent */
  relevant: boolean;
  /** Confidence in the assessment (0-1) */
  confidence: number;
  /** Explanation of the assessment */
  reasoning: string;
  /** Suggestions for improvement or next steps */
  suggestions?: string[];
  /** Specific issues found */
  issues?: ValidationIssue[];
}

/**
 * Specific issue found during validation
 */
export interface ValidationIssue {
  /** Type of issue */
  type: 'irrelevant' | 'partial' | 'empty' | 'error' | 'slow';
  /** Which result index (if applicable) */
  resultIndex?: number;
  /** Description of the issue */
  description: string;
  /** Severity: low, medium, high */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Generate validation context from AI search result
 */
export function generateValidationContext(result: AISearchResult): ValidationContext {
  return {
    query: result.query,
    userIntent: result.userIntent || `Find results related to: ${result.query}`,
    results: result.extractedResults,
    screenshotPaths: result.screenshots.map(s => s.path),
    timing: result.timing,
    timestamp: new Date().toISOString(),
    hasResults: result.hasResults,
    resultCount: result.resultCount,
  };
}

/**
 * Generate a structured prompt for Claude Code to analyze search results
 *
 * This prompt provides all necessary context for AI-powered validation:
 * - The query and user intent
 * - Extracted result content
 * - Screenshots for visual inspection
 * - Timing metrics
 */
export function generateValidationPrompt(context: ValidationContext): string {
  const lines: string[] = [];

  lines.push('# Search Result Validation Request');
  lines.push('');
  lines.push('Please analyze the following search results and determine if they are relevant to the user\'s intent.');
  lines.push('');

  // Query and Intent
  lines.push('## Search Details');
  lines.push(`- **Query:** "${context.query}"`);
  lines.push(`- **User Intent:** ${context.userIntent}`);
  lines.push(`- **Results Found:** ${context.resultCount}`);
  lines.push(`- **Total Time:** ${context.timing.total}ms`);
  lines.push('');

  // Screenshots
  if (context.screenshotPaths.length > 0) {
    lines.push('## Screenshots');
    lines.push('The following screenshots capture the search interaction:');
    for (const path of context.screenshotPaths) {
      lines.push(`- ${path}`);
    }
    lines.push('');
    lines.push('*Please view these screenshots using the Read tool to see the visual state.*');
    lines.push('');
  }

  // Extracted Results
  if (context.results.length > 0) {
    lines.push('## Extracted Results');
    lines.push('');
    for (const result of context.results.slice(0, 10)) { // Limit to first 10
      lines.push(`### Result ${result.index + 1}`);
      if (result.title) {
        lines.push(`**Title:** ${result.title}`);
      }
      if (result.snippet) {
        lines.push(`**Snippet:** ${result.snippet}`);
      }
      lines.push(`**Full Text:** ${result.fullText.slice(0, 200)}${result.fullText.length > 200 ? '...' : ''}`);
      lines.push(`**Visible:** ${result.visible ? 'Yes' : 'No'}`);
      lines.push('');
    }

    if (context.results.length > 10) {
      lines.push(`*...and ${context.results.length - 10} more results*`);
      lines.push('');
    }
  } else {
    lines.push('## No Results');
    lines.push('The search returned no results. This may indicate:');
    lines.push('- The search query is too specific');
    lines.push('- No matching content exists');
    lines.push('- A bug in the search functionality');
    lines.push('');
  }

  // Validation Questions
  lines.push('## Validation Questions');
  lines.push('');
  lines.push('1. **Relevance:** Do the results match the user\'s intent?');
  lines.push('2. **Quality:** Are the results useful and informative?');
  lines.push('3. **Issues:** Are there any obvious problems (e.g., unrelated content)?');
  lines.push('4. **Suggestions:** What could improve the search experience?');
  lines.push('');

  // Response Format
  lines.push('## Expected Response');
  lines.push('');
  lines.push('Please respond with:');
  lines.push('- `relevant`: true/false - whether results match user intent');
  lines.push('- `confidence`: 0-1 - how confident you are in the assessment');
  lines.push('- `reasoning`: brief explanation of your assessment');
  lines.push('- `suggestions`: (optional) array of improvement suggestions');
  lines.push('- `issues`: (optional) array of specific issues found');

  return lines.join('\n');
}

/**
 * Generate a concise summary for quick validation
 */
export function generateQuickSummary(context: ValidationContext): string {
  const lines: string[] = [];

  lines.push(`Search: "${context.query}"`);
  lines.push(`Intent: ${context.userIntent}`);
  lines.push(`Results: ${context.resultCount} found in ${context.timing.total}ms`);

  if (context.results.length > 0) {
    lines.push('');
    lines.push('Top results:');
    for (const result of context.results.slice(0, 3)) {
      const title = result.title || result.fullText.slice(0, 50);
      lines.push(`  ${result.index + 1}. ${title}`);
    }
  }

  return lines.join('\n');
}

/**
 * Analyze results for obvious issues (pre-AI check)
 *
 * Performs quick heuristic checks before involving AI:
 * - Empty results
 * - Very slow response
 * - Results with no text content
 */
export function analyzeForObviousIssues(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for empty results
  if (!context.hasResults) {
    issues.push({
      type: 'empty',
      description: 'Search returned no results',
      severity: 'high',
    });
  }

  // Check for slow response (>5 seconds is concerning)
  if (context.timing.total > 5000) {
    issues.push({
      type: 'slow',
      description: `Search took ${context.timing.total}ms (>5s)`,
      severity: context.timing.total > 10000 ? 'high' : 'medium',
    });
  }

  // Check for results with no meaningful content
  for (const result of context.results) {
    if (!result.fullText || result.fullText.trim().length < 10) {
      issues.push({
        type: 'error',
        resultIndex: result.index,
        description: `Result ${result.index + 1} has no meaningful content`,
        severity: 'medium',
      });
    }
  }

  // Check for query terms in results (basic relevance)
  const queryTerms = context.query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  for (const result of context.results) {
    const textLower = result.fullText.toLowerCase();
    const matchCount = queryTerms.filter(term => textLower.includes(term)).length;
    const matchRatio = matchCount / queryTerms.length;

    if (matchRatio < 0.2 && queryTerms.length > 1) {
      issues.push({
        type: 'irrelevant',
        resultIndex: result.index,
        description: `Result ${result.index + 1} may not match query (low keyword overlap)`,
        severity: 'low',
      });
    }
  }

  return issues;
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  const status = result.relevant ? 'PASS' : 'FAIL';
  const confidence = Math.round(result.confidence * 100);

  lines.push(`## Validation: ${status} (${confidence}% confidence)`);
  lines.push('');
  lines.push(`**Assessment:** ${result.reasoning}`);

  if (result.issues && result.issues.length > 0) {
    lines.push('');
    lines.push('**Issues Found:**');
    for (const issue of result.issues) {
      const severity = issue.severity.toUpperCase();
      lines.push(`- [${severity}] ${issue.description}`);
    }
  }

  if (result.suggestions && result.suggestions.length > 0) {
    lines.push('');
    lines.push('**Suggestions:**');
    for (const suggestion of result.suggestions) {
      lines.push(`- ${suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a dev-mode prompt for user feedback
 *
 * Used when results seem questionable and user input is needed.
 */
export function generateDevModePrompt(
  context: ValidationContext,
  issues: ValidationIssue[]
): string {
  const lines: string[] = [];

  lines.push('## Search Results Review');
  lines.push('');
  lines.push(`Query: "${context.query}"`);
  lines.push(`Intent: ${context.userIntent}`);
  lines.push('');

  if (issues.length > 0) {
    lines.push('**Potential issues detected:**');
    for (const issue of issues) {
      lines.push(`- ${issue.description}`);
    }
    lines.push('');
  }

  // Show sample results
  if (context.results.length > 0) {
    lines.push('**Sample results:**');
    for (const result of context.results.slice(0, 3)) {
      const title = result.title || result.fullText.slice(0, 40);
      lines.push(`  ${result.index + 1}. ${title}`);
    }
    lines.push('');
  }

  lines.push('**What would you like to do?**');
  lines.push('1. Accept results as expected');
  lines.push('2. Refine the search query');
  lines.push('3. Report as bug');
  lines.push('4. Skip this test');

  return lines.join('\n');
}
