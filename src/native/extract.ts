import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { NativeElement } from './types.js';
import type { SimulatorDevice } from './types.js';
import type { EnhancedElement } from '../schemas.js';
import { mapRoleToTag, mapRoleToAriaRole, isInteractiveRole } from './role-map.js';

const execFileAsync = promisify(execFile);

const EXTRACTOR_DIR = join(process.cwd(), '.ibr', 'bin');
const EXTRACTOR_PATH = join(EXTRACTOR_DIR, 'ibr-ax-extract');

// Resolve Swift source dir: walk up from compiled output (dist/) or source (src/) to package root
// __dirname works in CJS (which all 3 build targets produce)
const SWIFT_SOURCE_DIR = join(__dirname, '..', '..', 'src', 'native', 'swift', 'ibr-ax-extract');
const SWIFT_MAIN_PATH = join(SWIFT_SOURCE_DIR, 'Sources', 'main.swift');
const SWIFT_PACKAGE_PATH = join(SWIFT_SOURCE_DIR, 'Package.swift');

/**
 * Ensure the Swift AXUIElement extractor is compiled
 * Compiles on first use, then caches at .ibr/bin/ibr-ax-extract
 */
export async function ensureExtractor(): Promise<string> {
  if (existsSync(EXTRACTOR_PATH) && isExtractorCacheFresh()) {
    return EXTRACTOR_PATH;
  }

  await mkdir(EXTRACTOR_DIR, { recursive: true });

  try {
    // Build the Swift package
    await execFileAsync('swift', ['build', '-c', 'release'], {
      cwd: SWIFT_SOURCE_DIR,
      timeout: 120000, // 2 minutes for first compile
    });

    // Copy the built binary
    const buildPath = join(SWIFT_SOURCE_DIR, '.build', 'release', 'ibr-ax-extract');

    if (!existsSync(buildPath)) {
      throw new Error('Swift build succeeded but binary not found at expected path');
    }

    await execFileAsync('cp', [buildPath, EXTRACTOR_PATH]);
    await execFileAsync('chmod', ['+x', EXTRACTOR_PATH]);

    return EXTRACTOR_PATH;
  } catch (err) {
    throw new Error(
      `Failed to compile Swift extractor: ${err instanceof Error ? err.message : 'Unknown error'}. ` +
      'Ensure Xcode Command Line Tools are installed: xcode-select --install'
    );
  }
}

function isExtractorCacheFresh(): boolean {
  try {
    const binaryMtime = statSync(EXTRACTOR_PATH).mtimeMs;
    const sourceMtime = Math.max(
      statSync(SWIFT_MAIN_PATH).mtimeMs,
      statSync(SWIFT_PACKAGE_PATH).mtimeMs
    );
    return binaryMtime >= sourceMtime;
  } catch {
    return false;
  }
}

/**
 * Check if the Swift extractor is available (compiled or can be compiled)
 */
export function isExtractorAvailable(): boolean {
  if (existsSync(EXTRACTOR_PATH)) return true;
  // Check if Swift source exists for compilation
  return existsSync(join(SWIFT_SOURCE_DIR, 'Package.swift'));
}

/**
 * Extract native accessibility elements from a running simulator
 *
 * Uses the compiled Swift CLI to walk the Simulator.app's accessibility tree
 * via AXUIElementCreateApplication.
 */
export async function extractNativeElements(
  device: SimulatorDevice
): Promise<NativeElement[]> {
  const extractorPath = await ensureExtractor();

  try {
    const { stdout } = await execFileAsync(extractorPath, [
      '--device-name', device.name,
    ], {
      timeout: 30000,
    });

    const elements: NativeElement[] = JSON.parse(stdout);
    return elements;
  } catch (err) {
    // Graceful degradation — return empty if extraction fails
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('permission') || message.includes('accessibility')) {
      throw new Error(
        'Accessibility permission required. Grant Terminal/IDE access in ' +
        'System Settings > Privacy & Security > Accessibility'
      );
    }
    throw new Error(`Element extraction failed: ${message}`);
  }
}

/**
 * Map native accessibility elements to IBR's EnhancedElement format
 *
 * This allows reuse of existing analyzeElements() from src/extract.ts.
 */
export function mapToEnhancedElements(nativeElements: NativeElement[]): EnhancedElement[] {
  const enhanced: EnhancedElement[] = [];

  function flatten(elements: NativeElement[], depth = 0): void {
    for (const el of elements) {
      // Map AX role to HTML-equivalent tag
      const tagName = mapRoleToTag(el.role);

      // Determine if the element is interactive
      const isInteractive = isInteractiveRole(el.role) && el.isEnabled;

      enhanced.push({
        selector: el.identifier || `[role="${el.role}"][label="${el.label}"]`,
        tagName,
        text: el.label || undefined,
        bounds: {
          x: el.frame.x,
          y: el.frame.y,
          width: el.frame.width,
          height: el.frame.height,
        },
        interactive: {
          hasOnClick: isInteractive,
          hasHref: false,
          isDisabled: !el.isEnabled,
          tabIndex: isInteractive ? 0 : -1,
          cursor: isInteractive ? 'pointer' : 'default',
        },
        a11y: {
          role: mapRoleToAriaRole(el.role),
          ariaLabel: el.label || null,
          ariaDescribedBy: null,
        },
      });

      // Recurse into children
      if (el.children.length > 0) {
        flatten(el.children, depth + 1);
      }
    }
  }

  flatten(nativeElements);
  return enhanced;
}
