// Native iOS/watchOS simulator support

export type {
  SimulatorDevice,
  NativeCaptureOptions,
  NativeCaptureResult,
  NativeScanOptions,
  NativeScanResult,
  NativeElement,
  // macOS native app types
  MacOSAXElement,
  MacOSWindowInfo,
  MacOSScanOptions,
  MacOSScanResult,
} from './types.js';

export { NATIVE_VIEWPORTS, getDeviceViewport } from './viewports.js';
export { listDevices, findDevice, getBootedDevices, bootDevice, formatDevice } from './simulator.js';
export { captureNativeScreenshot } from './capture.js';
export { extractNativeElements, mapToEnhancedElements, isExtractorAvailable, ensureExtractor } from './extract.js';
export { auditNativeElements } from './rules.js';
export { scanNative, formatNativeScanResult, scanMacOS, formatMacOSScanResult } from './scan.js';

// macOS native app scanning
export { findProcess, extractMacOSElements, mapMacOSToEnhancedElements, captureMacOSScreenshot } from './macos.js';
export { buildNativeInteractivity } from './interactivity.js';
export { buildNativeSemantic } from './semantic.js';
export { annotateScreenshot } from './annotate.js';
export { generateFixGuide } from './fix-guide.js';
export type { FixGuide, FixableIssue } from './fix-guide.js';
