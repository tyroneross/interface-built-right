import type { EnhancedElement } from '../schemas.js';
import type { SemanticResult } from '../semantic/output.js';

// Re-export for consumers
export type { EnhancedElement };

export interface SensorContext {
  elements: EnhancedElement[];
  interactivity?: {
    summary: { withHandlers: number; withoutHandlers: number };
    buttons: unknown[];
    links: unknown[];
    forms: unknown[];
  };
  semantic?: SemanticResult;
  url: string;
  viewport: { width: number; height: number };
}

export interface VisualPatternGroup {
  patternKey: string;         // e.g. "button-primary-rounded-md"
  count: number;
  elements: Array<{ selector: string; text: string }>;
  styleFingerprint: Record<string, string>;
}

export interface VisualPatternReport {
  category: 'button' | 'input' | 'link' | 'heading' | 'card';
  totalElements: number;
  distinctPatterns: number;
  groups: VisualPatternGroup[];
  /** True when >80% of elements share one pattern — high visual consistency */
  dominant?: VisualPatternGroup;
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
  roots: NavigationNode[];   // top-level items in this nav
  depth: number;             // max depth reached within this nav
}

export interface NavigationMap {
  /** Hierarchical nav regions (one per <nav> element found) */
  navs: NavigationRegion[];
  /** Legacy flat roots — kept for backward compatibility, populated from all navs */
  roots: NavigationNode[];
  depth: number;
  totalLinks: number;
  byDepth: number[];        // count at each depth across all navs
}

export interface ComponentCensus {
  byTag: Record<string, number>;
  byRole: Record<string, number>;
  withHandlers: number;
  withoutHandlers: number;
  /** Elements that look clickable (cursor:pointer) but have no handler */
  orphanInteractive: Array<{ selector: string; text: string; reason: string }>;
  /** Component name → instance count (derived from data-component, data-testid, or className PascalCase) */
  byComponent: Record<string, number>;
  /** Top 20 components by count, each with up to 5 example selectors */
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
  failing: ContrastReportEntry[];  // Only failures listed
  minRatio?: ContrastReportEntry;
  byTone?: {
    lightOnDark: number;
    darkOnLight: number;
  };
}

export interface SensorReport {
  visualPatterns: VisualPatternReport[];
  navigation?: NavigationMap;
  componentCensus: ComponentCensus;
  interactionMap: InteractionMap;
  contrast: ContrastReport;
  semanticState?: {
    pageIntent?: string;
    states: string[];
    availableActions: string[];
  };
  /** Summary one-liners the model can scan in 5 seconds */
  oneLiners: string[];
}
