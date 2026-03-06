import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { NativeCaptureOptions, NativeCaptureResult } from './types.js';
import { getDeviceViewport } from './viewports.js';

const execFileAsync = promisify(execFile);

/**
 * Capture a screenshot from a running simulator
 *
 * Uses `xcrun simctl io <udid> screenshot` to capture the current screen.
 * For watchOS devices, applies --mask=black by default to handle round displays.
 */
export async function captureNativeScreenshot(
  options: NativeCaptureOptions
): Promise<NativeCaptureResult> {
  const { device, outputPath, mask } = options;
  const start = Date.now();

  try {
    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    // Build command args
    const args = ['simctl', 'io', device.udid, 'screenshot', '--type=png'];

    // Apply mask for watchOS (round display) or if explicitly requested
    const effectiveMask = mask ?? (device.platform === 'watchos' ? 'black' : undefined);
    if (effectiveMask) {
      args.push(`--mask=${effectiveMask}`);
    }

    args.push(outputPath);

    await execFileAsync('xcrun', args, { timeout: 15000 });

    const viewport = getDeviceViewport(device);

    return {
      success: true,
      outputPath,
      device,
      viewport,
      timing: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      device,
      viewport: getDeviceViewport(device),
      timing: Date.now() - start,
      error: err instanceof Error ? err.message : 'Screenshot capture failed',
    };
  }
}
