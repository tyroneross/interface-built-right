/**
 * Smart Prompt - Ask targeted questions when context is missing
 *
 * Instead of guessing or applying generic standards, IBR asks
 * the user for specific missing information when needed.
 */

import type { UserContext } from './context-loader.js';

export interface MissingContext {
  designFramework?: boolean;
  targetUrl?: boolean;
  sessionId?: boolean;
  expectedOutcome?: boolean;
  comparisonBaseline?: boolean;
}

export interface PromptResult {
  hasMissingContext: boolean;
  prompts: string[];
  suggestions: string[];
}

/**
 * Analyze what context is missing and generate prompts
 */
export function analyzeContext(
  userContext: UserContext,
  action: 'audit' | 'compare' | 'capture' | 'general',
  providedArgs: {
    url?: string;
    sessionId?: string;
    expectedChange?: string;
  } = {}
): PromptResult {
  const missing: MissingContext = {};
  const prompts: string[] = [];
  const suggestions: string[] = [];

  // Check for design framework
  if (action === 'audit' && !userContext.framework) {
    missing.designFramework = true;
    prompts.push('What design framework should I validate against?');
    suggestions.push('Add your design framework to CLAUDE.md (e.g., Calm Precision, Material Design)');
    suggestions.push('Or specify standards with: --rules minimal');
  }

  // Check for URL
  if ((action === 'audit' || action === 'capture') && !providedArgs.url) {
    missing.targetUrl = true;
    prompts.push('What URL should I capture/audit?');
    suggestions.push('Provide the URL: npx ibr audit http://localhost:3000/page');
  }

  // Check for session
  if (action === 'compare' && !providedArgs.sessionId) {
    missing.sessionId = true;
    prompts.push('Which session should I compare?');
    suggestions.push('List sessions with: npx ibr list');
    suggestions.push('Or use the most recent: npx ibr check');
  }

  // Check for expected outcome
  if (action === 'compare' && !providedArgs.expectedChange) {
    // This is informational, not blocking
    suggestions.push('Tip: Describe expected changes for better analysis');
  }

  return {
    hasMissingContext: prompts.length > 0,
    prompts,
    suggestions,
  };
}

/**
 * Format prompts for CLI output
 */
export function formatPrompts(result: PromptResult): string {
  if (!result.hasMissingContext) {
    return '';
  }

  const lines: string[] = [];

  lines.push('Missing context:');
  lines.push('');

  for (const prompt of result.prompts) {
    lines.push(`  ? ${prompt}`);
  }

  if (result.suggestions.length > 0) {
    lines.push('');
    lines.push('Suggestions:');
    for (const suggestion of result.suggestions) {
      lines.push(`  → ${suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get framework setup instructions
 */
export function getFrameworkSetupHelp(): string {
  return `
To enable design validation, add your framework to CLAUDE.md:

Option 1: User-level (applies to all projects)
  File: ~/.claude/CLAUDE.md

Option 2: Project-level (applies to this project only)
  File: .claude/CLAUDE.md or ./CLAUDE.md

Example CLAUDE.md content:

  # MY DESIGN FRAMEWORK

  ## CORE PRINCIPLES

  ### 1. Principle Name
  Description of the principle.
  **Foundation:** Gestalt, Fitts' Law, etc.

  - Implementation rule 1
  - Implementation rule 2

IBR will parse your framework and generate validation rules automatically.
`;
}

/**
 * Analyze vague instruction and suggest clarifications
 */
export function analyzeVagueInstruction(instruction: string): string[] {
  const suggestions: string[] = [];
  const lower = instruction.toLowerCase();

  // Very short or vague instructions
  if (instruction.length < 10) {
    suggestions.push('Could you provide more details about what you want to do?');
    return suggestions;
  }

  // "Fix this" without context
  if (lower.includes('fix') && !lower.includes('http') && !lower.includes('localhost')) {
    suggestions.push('What specifically needs fixing?');
    suggestions.push('Which page or component has the issue?');
  }

  // "Check" without URL
  if (lower.includes('check') && !lower.includes('http') && !lower.includes('session')) {
    suggestions.push('Which URL should I check?');
    suggestions.push('Or did you mean to compare an existing session? Use: npx ibr check');
  }

  // "Audit" without specifics
  if (lower.includes('audit') && !lower.includes('http')) {
    suggestions.push('What URL should I audit?');
    suggestions.push('What design framework should I validate against?');
  }

  // "Make it better" type instructions
  if (lower.includes('better') || lower.includes('improve') || lower.includes('good')) {
    suggestions.push('What specific aspects should be improved?');
    suggestions.push('What design guidelines should I follow?');
  }

  return suggestions;
}
