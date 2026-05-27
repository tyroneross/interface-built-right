import type { EnhancedElement } from '../schemas.js';
import type { SemanticResult } from '../semantic/output.js';

// Re-export for consumers
export type { EnhancedElement };

/**
 * A single CSS rule extracted from the page's stylesheets at scan time.
 * Used by sensors that need to inspect declared CSS rather than computed style:
 * breakpoints (`@media`), motion (`transition`, `@keyframes`, `prefers-reduced-motion`),
 * interaction-states (`:hover`, `:focus`, `:focus-visible`, `:active`, `:disabled`).
 *
 * `kind` discriminates the rule type. Style rules carry their selector and decls;
 * at-rules (media/keyframes/container/supports) carry their condition and nested rules.
 */
export type ExtractedCSSRule =
  | {
      kind: 'style';
      selector: string;             // raw selectorText
      declarations: Record<string, string>;
      sourceUrl?: string;           // owning stylesheet href
    }
  | {
      kind: 'media';
      conditionText: string;        // raw mediaText
      rules: ExtractedCSSRule[];    // nested rules inside this @media
      sourceUrl?: string;
    }
  | {
      kind: 'keyframes';
      name: string;
      steps: Array<{ keyText: string; declarations: Record<string, string> }>;
      sourceUrl?: string;
    }
  | {
      kind: 'container';
      conditionText: string;
      containerName?: string;
      rules: ExtractedCSSRule[];
      sourceUrl?: string;
    }
  | {
      kind: 'supports';
      conditionText: string;
      rules: ExtractedCSSRule[];
      sourceUrl?: string;
    };

/**
 * Document-level metadata for sensors that need page context beyond elements.
 * Optional and additive — sensors degrade gracefully when absent.
 */
export interface DocumentMeta {
  /** Resolved root font-size in pixels (default 16). Used to resolve rem-based values. */
  rootFontSizePx?: number;
  /** Web-font loading state at scan time (`document.fonts.status`). */
  fontsStatus?: 'loading' | 'loaded' | 'unsupported';
  /** Selector → original/spec values that getComputedStyle resolves away (e.g. `line-height: normal`). */
  rawSpecValues?: Record<string, Record<string, string>>;
}

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
  /** Declared CSS rules from page stylesheets (cross-origin sheets may be missing). */
  cssRules?: ExtractedCSSRule[];
  /** Document-level metadata (root font size, fonts status, raw spec values). */
  documentMeta?: DocumentMeta;
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
