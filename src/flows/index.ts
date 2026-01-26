/**
 * IBR Built-in Flows
 *
 * Common automation patterns as single commands:
 * - login: Authenticate with email/password
 * - search: Search and verify results
 * - form: Fill and submit forms
 */

export {
  loginFlow,
  type FlowLoginOptions,
  type LoginResult,
} from './login.js';

export {
  searchFlow,
  aiSearchFlow,
  type FlowSearchOptions,
  type SearchResult,
} from './search.js';

export {
  formFlow,
  type FlowFormOptions,
  type FormField,
  type FormResult,
} from './form.js';

export {
  findFieldByLabel,
  findButton,
  waitForNavigation,
  type FlowResult,
  type FlowStep,
  type FlowOptions,
  type AISearchOptions,
  type AISearchResult,
  type StepScreenshot,
  type ExtractedResult,
  type SearchTiming,
} from './types.js';

export {
  generateValidationContext,
  generateValidationPrompt,
  generateQuickSummary,
  analyzeForObviousIssues,
  formatValidationResult,
  generateDevModePrompt,
  type ValidationContext,
  type ValidationResult,
  type ValidationIssue,
} from './search-validation.js';

// Flow registry for dynamic access
import { loginFlow } from './login.js';
import { searchFlow, aiSearchFlow } from './search.js';
import { formFlow } from './form.js';

export const flows = {
  login: loginFlow,
  search: searchFlow,
  aiSearch: aiSearchFlow,
  form: formFlow,
} as const;

export type FlowName = keyof typeof flows;
