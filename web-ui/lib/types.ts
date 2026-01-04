export interface Viewport {
  name: 'desktop' | 'mobile' | 'tablet' | 'reference';
  width: number;
  height: number;
}

// Session type discriminator
export type SessionType = 'capture' | 'reference' | 'interactive';

// Interactive session action record
export interface ActionRecord {
  type: 'navigate' | 'click' | 'type' | 'fill' | 'hover' | 'evaluate' | 'screenshot' | 'wait';
  timestamp: string;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
  duration?: number;
}

// Interactive session metadata
export interface InteractiveMetadata {
  sandbox: boolean;
  actions: ActionRecord[];
  lastActionAt?: string;
  active: boolean;  // Browser still running
}

// Reference metadata for uploaded/extracted designs
export interface ReferenceMetadata {
  framework?: string;
  componentLibrary?: string;
  targetPath?: string;
  notes?: string;
  originalFileName?: string;
  originalUrl?: string;
  uploadedAt?: string;
  extractedAt?: string;
  fileSize?: number;
  dimensions: {
    width: number;
    height: number;
  };
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
  url?: string; // Optional for reference sessions (image upload)
  type?: SessionType; // 'capture' (default), 'reference', or 'interactive'
  viewport: Viewport;
  status: 'baseline' | 'compared' | 'pending' | 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
  comparison?: ComparisonResult;
  analysis?: Analysis;
  referenceMetadata?: ReferenceMetadata; // For reference sessions
  interactiveMetadata?: InteractiveMetadata; // For interactive sessions
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
export type FilterType = 'all' | 'changed' | 'broken' | 'live';

// API Request/Response Types
export interface CreateSessionRequest {
  url?: string;  // Optional - can create session without capturing
  name: string;  // Required - session name
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
