export interface Viewport {
  name: 'desktop' | 'mobile' | 'tablet';
  width: number;
  height: number;
}

export interface ComparisonResult {
  match: boolean;
  diffPercent: number;
  diffPixels: number;
  totalPixels: number;
  threshold: number;
}

export interface Analysis {
  verdict: 'MATCH' | 'EXPECTED_CHANGE' | 'UNEXPECTED_CHANGE' | 'LAYOUT_BROKEN';
  summary: string;
  recommendation: string | null;
}

export interface Session {
  id: string;
  name: string;
  url: string;
  viewport: Viewport;
  status: 'baseline' | 'compared' | 'pending';
  createdAt: string;
  updatedAt: string;
  comparison?: ComparisonResult;
  analysis?: Analysis;
}

export interface ComparisonReport {
  sessionId: string;
  comparison: ComparisonResult;
  analysis: Analysis;
  files: {
    baseline: string;
    current: string;
    diff: string;
  };
}

export type ViewMode = 'split' | 'overlay' | 'diff';
export type FilterType = 'all' | 'changed' | 'broken';

// API Request/Response Types
export interface CreateSessionRequest {
  url: string;
  name?: string;
  viewport?: Viewport;
}

export interface CreateSessionResponse {
  success: boolean;
  session: Session;
}

export interface BatchCheckRequest {
  sessionIds: string[];
}

export interface BatchCheckResponse {
  success: boolean;
  results: {
    sessionId: string;
    status: 'success' | 'error';
    error?: string;
  }[];
}

export interface FeedbackRequest {
  sessionId: string;
  feedback: string;
}

export interface FeedbackResponse {
  success: boolean;
  message: string;
}

export interface GetFeedbackResponse {
  feedback: {
    id: string;
    sessionId: string;
    feedback: string;
    createdAt: string;
  }[];
}

export interface ApiError {
  error: string;
  details?: string;
}
