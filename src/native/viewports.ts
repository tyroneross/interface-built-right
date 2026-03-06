import type { Viewport } from '../schemas.js';
import type { SimulatorDevice } from './types.js';

/**
 * Native device viewport dimensions in points
 * These match the logical (non-Retina) dimensions used by simulators
 */
export const NATIVE_VIEWPORTS: Record<string, Viewport> = {
  // iPhone 16 series
  'iphone-16': { name: 'iphone-16', width: 393, height: 852 },
  'iphone-16-plus': { name: 'iphone-16-plus', width: 430, height: 932 },
  'iphone-16-pro': { name: 'iphone-16-pro', width: 402, height: 874 },
  'iphone-16-pro-max': { name: 'iphone-16-pro-max', width: 440, height: 956 },

  // Apple Watch Series 10
  'watch-series-10-42mm': { name: 'watch-series-10-42mm', width: 176, height: 215 },
  'watch-series-10-46mm': { name: 'watch-series-10-46mm', width: 198, height: 242 },

  // Apple Watch Ultra 2
  'watch-ultra-2-49mm': { name: 'watch-ultra-2-49mm', width: 205, height: 251 },
} as const;

/**
 * Map of device name patterns to viewport keys
 */
const DEVICE_NAME_PATTERNS: Array<[RegExp, string]> = [
  [/iPhone 16 Pro Max/i, 'iphone-16-pro-max'],
  [/iPhone 16 Pro/i, 'iphone-16-pro'],
  [/iPhone 16 Plus/i, 'iphone-16-plus'],
  [/iPhone 16/i, 'iphone-16'],
  [/Apple Watch.*Ultra.*49/i, 'watch-ultra-2-49mm'],
  [/Apple Watch.*46/i, 'watch-series-10-46mm'],
  [/Apple Watch.*42/i, 'watch-series-10-42mm'],
  // Fallbacks for generic watch/phone
  [/Apple Watch Ultra/i, 'watch-ultra-2-49mm'],
  [/Apple Watch/i, 'watch-series-10-42mm'],
  [/iPhone/i, 'iphone-16-pro'],
];

/**
 * Get the viewport dimensions for a simulator device
 * Falls back to reasonable defaults based on platform
 */
export function getDeviceViewport(device: SimulatorDevice): Viewport {
  // Try to match by device name
  for (const [pattern, key] of DEVICE_NAME_PATTERNS) {
    if (pattern.test(device.name)) {
      return NATIVE_VIEWPORTS[key];
    }
  }

  // Fallback by platform
  if (device.platform === 'watchos') {
    return NATIVE_VIEWPORTS['watch-series-10-42mm'];
  }

  return NATIVE_VIEWPORTS['iphone-16-pro'];
}
