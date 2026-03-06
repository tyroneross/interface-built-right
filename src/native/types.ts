import type { EnhancedElement, AuditResult, Viewport, ElementIssue } from '../schemas.js';
import type { ScanIssue } from '../scan.js';
import type { InteractivityResult } from '../interactivity.js';
import type { SemanticResult } from '../semantic/index.js';

/**
 * Simulator device from `xcrun simctl list devices --json`
 */
export interface SimulatorDevice {
  udid: string;
  name: string;
  state: 'Booted' | 'Shutdown' | 'Creating' | 'Shutting Down';
  runtime: string;
  platform: 'ios' | 'watchos';
  isAvailable: boolean;
}

/**
 * Options for capturing a native screenshot
 */
export interface NativeCaptureOptions {
  device: SimulatorDevice;
  outputPath: string;
  /** Mask type for non-rectangular displays (watchOS) */
  mask?: 'black' | 'alpha' | 'ignored';
}

/**
 * Result from capturing a native screenshot
 */
export interface NativeCaptureResult {
  success: boolean;
  outputPath?: string;
  device: SimulatorDevice;
  viewport: Viewport;
  timing: number;
  error?: string;
}

/**
 * Options for scanning a native simulator
 */
export interface NativeScanOptions {
  /** Device name fragment, UDID, or undefined for first booted */
  device?: string;
  /** App bundle ID (for future use) */
  bundleId?: string;
  /** Whether to capture a screenshot */
  screenshot?: boolean;
  /** Output directory */
  outputDir?: string;
}

/**
 * Result from scanning a native simulator
 */
export interface NativeScanResult {
  url: string;
  route: string;
  timestamp: string;
  viewport: Viewport;
  platform: 'ios' | 'watchos';
  device: {
    name: string;
    udid: string;
    runtime: string;
  };

  /** Extracted elements mapped to EnhancedElement format */
  elements: {
    all: EnhancedElement[];
    audit: AuditResult;
  };

  /** Native-specific audit issues */
  nativeIssues: ElementIssue[];

  /** Screenshot path if captured */
  screenshotPath?: string;

  /** Overall scan verdict */
  verdict: 'PASS' | 'ISSUES' | 'FAIL';
  issues: ScanIssue[];
  summary: string;
}

/**
 * Native accessibility element from the Swift AXUIElement extractor
 */
export interface NativeElement {
  /** Accessibility identifier (maps to selector) */
  identifier: string;
  /** Accessibility label */
  label: string;
  /** Role (e.g., AXButton, AXStaticText, AXImage) */
  role: string;
  /** Accessibility traits */
  traits: string[];
  /** Frame in points: { x, y, width, height } */
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Whether the element is enabled */
  isEnabled: boolean;
  /** Current value (for inputs, sliders, etc.) */
  value: string | null;
  /** Child elements */
  children: NativeElement[];
}

// ============================================================================
// macOS Native App Scanning
// ============================================================================

/**
 * AX element from the Swift extractor in macOS app mode (full format)
 */
export interface MacOSAXElement {
  role: string;
  subrole: string | null;
  title: string | null;
  description: string | null;
  identifier: string | null;
  value: string | null;
  enabled: boolean;
  focused: boolean;
  actions: string[];
  position: { x: number; y: number } | null;
  size: { width: number; height: number } | null;
  children: MacOSAXElement[];
}

/**
 * Window info parsed from the WINDOW: header line
 */
export interface MacOSWindowInfo {
  windowId: number;
  width: number;
  height: number;
  title: string;
}

/**
 * Options for scanning a running macOS native app
 */
export interface MacOSScanOptions {
  /** App name to find (e.g., "Secrets Vault") */
  app?: string;
  /** Bundle identifier (e.g., "com.secretsvault.app") */
  bundleId?: string;
  /** Direct process ID */
  pid?: number;
  /** Capture screenshot */
  screenshot?: { path: string };
}

/**
 * Result from scanning a macOS native app
 * Same shape as web ScanResult for interoperability
 */
export interface MacOSScanResult {
  url: string;
  route: string;
  timestamp: string;
  viewport: Viewport;

  /** Extracted elements mapped to EnhancedElement format */
  elements: {
    all: EnhancedElement[];
    audit: AuditResult;
  };

  /** Interactivity analysis built from AX data */
  interactivity: InteractivityResult;

  /** Semantic understanding from element composition */
  semantic: SemanticResult;

  /** No console for native apps */
  console: {
    errors: string[];
    warnings: string[];
  };

  /** Overall scan verdict */
  verdict: 'PASS' | 'ISSUES' | 'FAIL';
  issues: ScanIssue[];
  summary: string;
}
