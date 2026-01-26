/**
 * IBR Semantic Layer
 *
 * Provides AI-friendly page understanding:
 * - Page intent classification (auth, form, listing, dashboard, etc.)
 * - State detection (authenticated, loading, errors)
 * - Semantic output with verdicts and recovery hints
 */

export {
  classifyPageIntent,
  getIntentDescription,
  type PageIntent,
  type PageIntentResult,
} from './page-intent.js';

export {
  detectAuthState,
  detectLoadingState,
  detectErrorState,
  detectPageState,
  waitForPageReady,
  type AuthState,
  type LoadingState,
  type ErrorState,
  type ErrorInfo,
  type PageState,
} from './state-detector.js';

export {
  getSemanticOutput,
  formatSemanticText,
  formatSemanticJson,
  type SemanticVerdict,
  type SemanticIssue,
  type AvailableAction,
  type RecoveryHint,
  type SemanticResult,
} from './output.js';

export {
  LANDMARK_SELECTORS,
  detectLandmarks,
  getExpectedLandmarksForIntent,
  compareLandmarks,
  getExpectedLandmarksFromContext,
  formatLandmarkComparison,
  type LandmarkType,
} from './landmarks.js';
