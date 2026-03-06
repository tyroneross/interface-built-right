import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { MacOSAXElement, MacOSWindowInfo } from './types.js';
import type { EnhancedElement } from '../schemas.js';
import { ensureExtractor } from './extract.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

/**
 * Find the PID of a running macOS app by name or bundle ID
 *
 * Strategy:
 * 1. Try lsappinfo for exact bundle ID match
 * 2. Fall back to pgrep for process name match
 */
export async function findProcess(appNameOrBundleId: string): Promise<number> {
  // Try lsappinfo for bundle ID
  try {
    const { stdout } = await execAsync(
      `lsappinfo info -only pid "${appNameOrBundleId}" 2>/dev/null || true`
    );
    const pidMatch = stdout.match(/"pid"\s*=\s*(\d+)/);
    if (pidMatch) {
      return parseInt(pidMatch[1], 10);
    }
  } catch {
    // Not found via lsappinfo
  }

  // Try pgrep for process name
  try {
    const { stdout } = await execAsync(
      `pgrep -f "${appNameOrBundleId}" 2>/dev/null | head -1`
    );
    const pid = parseInt(stdout.trim(), 10);
    if (!isNaN(pid) && pid > 0) {
      return pid;
    }
  } catch {
    // Not found via pgrep
  }

  throw new Error(
    `No running process found for "${appNameOrBundleId}". ` +
    'Ensure the app is running and try again.'
  );
}

/**
 * Extract native AX elements from a running macOS app via the Swift CLI
 *
 * Returns the parsed elements and window metadata.
 */
export async function extractMacOSElements(options: {
  pid?: number;
  app?: string;
}): Promise<{ elements: MacOSAXElement[]; window: MacOSWindowInfo }> {
  const extractorPath = await ensureExtractor();

  const args: string[] = [];
  if (options.pid) {
    args.push('--pid', String(options.pid));
  } else if (options.app) {
    args.push('--app', options.app);
  } else {
    throw new Error('Either pid or app must be provided');
  }

  try {
    const { stdout, stderr } = await execFileAsync(extractorPath, args, {
      timeout: 30000,
    });

    if (stderr && stderr.includes('Error:')) {
      throw new Error(stderr.trim());
    }

    // Parse output: first line is WINDOW header, rest is JSON
    const lines = stdout.split('\n');
    const headerLine = lines[0];
    const jsonStr = lines.slice(1).join('\n');

    // Parse window header: WINDOW:<id>:<WxH>:<title>
    let window: MacOSWindowInfo = { windowId: 0, width: 800, height: 600, title: 'Unknown' };
    if (headerLine.startsWith('WINDOW:')) {
      const parts = headerLine.slice(7).split(':');
      const windowId = parseInt(parts[0], 10);
      const dims = (parts[1] || '800x600').split('x');
      const title = parts.slice(2).join(':'); // Title may contain colons
      window = {
        windowId,
        width: parseInt(dims[0], 10) || 800,
        height: parseInt(dims[1], 10) || 600,
        title,
      };
    }

    const elements: MacOSAXElement[] = JSON.parse(jsonStr);
    return { elements, window };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Accessibility permission')) {
      throw new Error(
        'Accessibility permission required. Grant Terminal/IDE access in ' +
        'System Settings > Privacy & Security > Accessibility'
      );
    }
    if (message.includes('No running app')) {
      throw err;
    }
    throw new Error(`macOS element extraction failed: ${message}`);
  }
}

/**
 * Map macOS AX elements to IBR's EnhancedElement format
 *
 * Flattens the tree depth-first and generates unique selectors
 * from the tree path (e.g., "AXWindow > AXGroup[0] > AXButton[1]").
 */
export function mapMacOSToEnhancedElements(
  nativeElements: MacOSAXElement[],
  parentPath = ''
): EnhancedElement[] {
  const enhanced: EnhancedElement[] = [];

  function flatten(elements: MacOSAXElement[], path: string, depth: number): void {
    const roleCounts: Record<string, number> = {};

    for (const el of elements) {
      // Build unique path-based selector
      const roleCount = roleCounts[el.role] || 0;
      roleCounts[el.role] = roleCount + 1;
      const currentPath = path
        ? `${path} > ${el.role}[${roleCount}]`
        : `${el.role}[${roleCount}]`;

      const tagName = mapRoleToTag(el.role);
      const isInteractive = isInteractiveRole(el.role) && el.enabled;
      const hasPress = el.actions.includes('AXPress');
      const text = el.title || el.description || el.value || undefined;

      // Build bounds from position + size
      const bounds = {
        x: el.position?.x ?? 0,
        y: el.position?.y ?? 0,
        width: el.size?.width ?? 0,
        height: el.size?.height ?? 0,
      };

      // Only include elements with some substance
      if (bounds.width > 0 || bounds.height > 0 || text || isInteractive || depth <= 1) {
        enhanced.push({
          selector: el.identifier || currentPath,
          tagName,
          id: el.identifier || undefined,
          text: text ? text.slice(0, 100) : undefined,
          bounds,
          interactive: {
            hasOnClick: hasPress || isInteractive,
            hasHref: el.role === 'AXLink',
            isDisabled: !el.enabled,
            tabIndex: (el.focused || isInteractive) ? 0 : -1,
            cursor: isInteractive ? 'pointer' : 'default',
          },
          a11y: {
            role: mapRoleToAriaRole(el.role),
            ariaLabel: el.title || el.description || null,
            ariaDescribedBy: null,
          },
          sourceHint: el.identifier ? { dataTestId: el.identifier } : undefined,
        });
      }

      // Recurse into children
      if (el.children.length > 0) {
        flatten(el.children, currentPath, depth + 1);
      }
    }
  }

  flatten(nativeElements, parentPath, 0);
  return enhanced;
}

/**
 * Capture a screenshot of a macOS window by its CGWindowID
 *
 * Uses the built-in `screencapture -l <windowID>` command.
 */
export async function captureMacOSScreenshot(
  windowId: number,
  outputPath: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await execFileAsync('screencapture', ['-l', String(windowId), '-x', outputPath], {
    timeout: 10000,
  });
}

// --- Role mapping helpers ---

function mapRoleToTag(role: string): string {
  const roleMap: Record<string, string> = {
    'AXButton': 'button',
    'AXLink': 'a',
    'AXTextField': 'input',
    'AXTextArea': 'textarea',
    'AXSecureTextField': 'input',
    'AXStaticText': 'span',
    'AXImage': 'img',
    'AXGroup': 'div',
    'AXSplitGroup': 'div',
    'AXList': 'ul',
    'AXCell': 'li',
    'AXTable': 'table',
    'AXScrollArea': 'div',
    'AXToolbar': 'nav',
    'AXMenuBar': 'nav',
    'AXMenu': 'nav',
    'AXMenuItem': 'li',
    'AXCheckBox': 'input',
    'AXRadioButton': 'input',
    'AXSlider': 'input',
    'AXSwitch': 'input',
    'AXPopUpButton': 'select',
    'AXComboBox': 'select',
    'AXTabGroup': 'div',
    'AXTab': 'button',
    'AXNavigationBar': 'nav',
    'AXHeader': 'header',
    'AXWindow': 'main',
  };

  return roleMap[role] || role.replace(/^AX/, '').toLowerCase();
}

function mapRoleToAriaRole(role: string): string | null {
  const roleMap: Record<string, string> = {
    'AXButton': 'button',
    'AXLink': 'link',
    'AXTextField': 'textbox',
    'AXTextArea': 'textbox',
    'AXSecureTextField': 'textbox',
    'AXStaticText': 'text',
    'AXImage': 'img',
    'AXGroup': 'group',
    'AXList': 'list',
    'AXCell': 'listitem',
    'AXTable': 'table',
    'AXCheckBox': 'checkbox',
    'AXRadioButton': 'radio',
    'AXSlider': 'slider',
    'AXSwitch': 'switch',
    'AXTab': 'tab',
    'AXTabGroup': 'tablist',
    'AXNavigationBar': 'navigation',
    'AXToolbar': 'toolbar',
    'AXMenuItem': 'menuitem',
    'AXMenu': 'menu',
    'AXScrollArea': 'scrollbar',
    'AXWindow': 'main',
  };

  return roleMap[role] || null;
}

function isInteractiveRole(role: string): boolean {
  const interactiveRoles = new Set([
    'AXButton',
    'AXLink',
    'AXTextField',
    'AXTextArea',
    'AXSecureTextField',
    'AXCheckBox',
    'AXRadioButton',
    'AXSlider',
    'AXSwitch',
    'AXPopUpButton',
    'AXComboBox',
    'AXMenuItem',
    'AXTab',
  ]);

  return interactiveRoles.has(role);
}
