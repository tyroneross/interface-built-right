// Core types
export type {
  Viewport,
  ComparisonResult,
  Analysis,
  Session,
  ComparisonReport,
  ViewMode,
  FilterType,
  CreateSessionRequest,
  CreateSessionResponse,
  BatchCheckRequest,
  BatchCheckResponse,
  FeedbackRequest,
  FeedbackResponse,
  GetFeedbackResponse,
  ApiError,
} from './types';

// API client
export {
  apiClient,
  getSessions,
  getSession,
  createSession,
  deleteSession,
  checkSession,
  acceptSession,
  batchCheck,
  submitFeedback,
  getFeedback,
} from './api';

// Hooks
export {
  useSessions,
  useSession,
  useSessionActions,
  type UseSessionsResult,
  type UseSessionResult,
  type UseSessionActionsResult,
} from './hooks';

// Utilities
export {
  DEFAULT_VIEWPORTS,
  formatRelativeTime,
  formatDate,
  filterSessions,
  getVerdictColor,
  getStatusColor,
  formatDiffPercent,
  generateSessionName,
  isValidUrl,
  sortSessionsByDate,
  groupSessionsByStatus,
} from './utils';
