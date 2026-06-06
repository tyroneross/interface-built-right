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

// ──────────────────────────────────────────────────────────────────────
// Scan-output shapes (mirror src/sensors/types.ts + src/schemas.ts)
//
// These are READ-ONLY views — the web-ui never produces this data, only
// renders what the IBR CLI/library writes. Keep field names in lockstep
// with the producer; do not invent fields. Optional fields stay optional
// (sensors degrade gracefully when a probe is unsupported).
// ──────────────────────────────────────────────────────────────────────

export interface VisualPatternGroup {
  patternKey: string;
  count: number;
  elements: Array<{ selector: string; text: string }>;
  styleFingerprint: Record<string, string>;
}

export interface VisualPatternReport {
  category: 'button' | 'input' | 'link' | 'heading' | 'card';
  totalElements: number;
  distinctPatterns: number;
  groups: VisualPatternGroup[];
  dominant?: VisualPatternGroup;
}

export interface ComponentCensus {
  byTag: Record<string, number>;
  byRole: Record<string, number>;
  withHandlers: number;
  withoutHandlers: number;
  orphanInteractive: Array<{ selector: string; text: string; reason: string }>;
  byComponent: Record<string, number>;
  topComponents: Array<{ name: string; count: number; selectors: string[] }>;
}

export interface InteractionMap {
  total: number;
  withHandlers: number;
  withoutHandlers: number;
  missingHandlers: Array<{ selector: string; text: string; tagName: string; role?: string }>;
  disabled: number;
  formCount: number;
}

export interface ContrastReportEntry {
  selector: string;
  text: string;
  ratio: number;
  pass: 'AA' | 'AAA' | 'FAIL';
  fontSize: number;
  largeText: boolean;
}

export interface ContrastReport {
  totalChecked: number;
  pass: number;
  fail: number;
  passAAA: number;
  failing: ContrastReportEntry[];
  minRatio?: ContrastReportEntry;
  byTone?: {
    lightOnDark: number;
    darkOnLight: number;
  };
}

export interface NavigationNode {
  label: string;
  href?: string;
  selector: string;
  depth: number;
  children: NavigationNode[];
}

export interface NavigationRegion {
  rootSelector: string;
  roots: NavigationNode[];
  depth: number;
}

export interface NavigationMap {
  navs: NavigationRegion[];
  roots: NavigationNode[];
  depth: number;
  totalLinks: number;
  byDepth: number[];
}

export interface TypographyReport {
  rows: Array<{
    selector: string;
    family: string;
    size_px: number;
    weight: number;
    line_height: number | 'normal';
    count: number;
    font_loading_pending?: boolean;
    size_spec?: string;
  }>;
  font_loading_pending: boolean;
  data_unavailable?: boolean;
}

export interface BreakpointEntry {
  type:
    | 'min-width'
    | 'max-width'
    | 'range'
    | 'container-min-width'
    | 'container-max-width'
    | 'container-range'
    | 'print'
    | 'other';
  value_px?: number;
  min?: number;
  max?: number;
  rule_count: number;
  container_name?: string;
  raw_condition: string;
}

export interface MotionReport {
  transitions: Array<{
    selector: string;
    property: string;
    duration_ms: number;
    easing: string;
    delay_ms: number;
  }>;
  keyframes: Array<{ name: string; step_count: number; used_by_selectors: string[] }>;
  reduced_motion_overrides: Array<{ selector: string; overrides: string[] }>;
}

export interface HierarchyReport {
  h1: {
    count: number;
    first_text?: string;
    all_texts: string[];
    finding?: 'no_h1_on_page' | 'multiple_h1s_on_page';
  };
  h2: { count: number; first_text?: string; all_texts: string[] };
  h3: { count: number; first_text?: string; all_texts: string[] };
  h4: { count: number; first_text?: string; all_texts: string[] };
  h5: { count: number; first_text?: string; all_texts: string[] };
  h6: { count: number; first_text?: string; all_texts: string[] };
  landmarks: {
    nav: number;
    main: number;
    aside: number;
    header: number;
    footer: number;
    section: number;
    form: number;
  };
  aria_headings: Array<{ selector: string; level: number; text: string }>;
  level_skips: Array<{ from: string; to: string; at_position: number }>;
}

export interface InteractionStatesReport {
  states: Array<{
    selector: string;
    state: 'hover' | 'focus' | 'focus-visible' | 'focus-within' | 'active' | 'disabled';
    properties: Record<string, string>;
    conditional_hover?: boolean;
  }>;
  findings: Array<{ selector: string; missing: 'focus_indicator' }>;
}

export interface SensorReport {
  visualPatterns: VisualPatternReport[];
  navigation?: NavigationMap;
  componentCensus: ComponentCensus;
  interactionMap: InteractionMap;
  contrast: ContrastReport;
  typography?: TypographyReport;
  breakpoints?: BreakpointEntry[];
  motion?: MotionReport;
  hierarchy?: HierarchyReport;
  interactionStates?: InteractionStatesReport;
  semanticState?: {
    pageIntent?: string;
    states: string[];
    availableActions: string[];
  };
  oneLiners: string[];
}

// Design system (mirrors src/schemas.ts DesignSystemResultSchema)
export interface DesignSystemViolation {
  principleId: string;
  principleName: string;
  severity: 'error' | 'warn';
  message: string;
  element?: string;
  bounds?: { x: number; y: number; w: number; h: number };
  fix?: string;
}

export interface DesignSystemTokenViolation {
  element: string;
  property: string;
  expected: string | number;
  actual: string | number;
  severity: 'error' | 'warning';
  message: string;
}

export interface DesignSystemResult {
  configName: string;
  principleViolations: DesignSystemViolation[];
  tokenViolations: DesignSystemTokenViolation[];
  customViolations: DesignSystemViolation[];
  complianceScore: number;
}

export interface ScanResponse {
  success: boolean;
  url: string;
  result: {
    verdict?: 'PASS' | 'ISSUES' | 'FAIL' | 'PARTIAL';
    partialReason?: string;
    elements?: {
      all: unknown[];
      audit: {
        totalElements: number;
        interactiveCount: number;
        withHandlers: number;
        withoutHandlers: number;
      };
    };
    interactivity?: { buttons: unknown[]; links: unknown[]; forms: unknown[] };
    semantic?: { pageIntent: { intent: string }; state: Record<string, unknown> };
    console?: { errors: unknown[]; warnings: unknown[] };
    issues?: { severity: string; description: string; category: string }[];
    sensors?: SensorReport;
    designSystem?: DesignSystemResult;
    raw?: string;
    stderr?: string;
  };
}

export interface BaselineResponse {
  success: boolean;
  url: string;
  name: string;
  baseline: string;
  elements: ScanResponse['result'] | null;
}

export interface ApiError {
  error: string;
  details?: string;
}
