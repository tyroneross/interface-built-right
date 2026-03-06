import { execFile } from 'child_process';
import { promisify } from 'util';
import type { SimulatorDevice } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Parse runtime string to platform
 * e.g., "com.apple.CoreSimulator.SimRuntime.iOS-18-0" → "ios"
 *       "com.apple.CoreSimulator.SimRuntime.watchOS-11-0" → "watchos"
 */
function parseRuntime(runtime: string): 'ios' | 'watchos' {
  if (/watchOS/i.test(runtime)) return 'watchos';
  return 'ios';
}

/**
 * List all available simulator devices
 */
export async function listDevices(): Promise<SimulatorDevice[]> {
  const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices', '--json']);
  const data = JSON.parse(stdout);
  const devices: SimulatorDevice[] = [];

  for (const [runtime, deviceList] of Object.entries(data.devices)) {
    if (!Array.isArray(deviceList)) continue;
    for (const dev of deviceList as Array<Record<string, unknown>>) {
      devices.push({
        udid: dev.udid as string,
        name: dev.name as string,
        state: dev.state as SimulatorDevice['state'],
        runtime,
        platform: parseRuntime(runtime),
        isAvailable: dev.isAvailable as boolean,
      });
    }
  }

  return devices;
}

/**
 * Find a device by name fragment or exact UDID
 * Prioritizes booted devices, then available ones
 */
export async function findDevice(nameOrUdid: string): Promise<SimulatorDevice | null> {
  const devices = await listDevices();
  const search = nameOrUdid.toLowerCase();

  // Exact UDID match
  const byUdid = devices.find(d => d.udid.toLowerCase() === search);
  if (byUdid) return byUdid;

  // Name fragment match — prioritize booted, then available
  const matches = devices
    .filter(d => d.name.toLowerCase().includes(search) && d.isAvailable)
    .sort((a, b) => {
      // Booted first
      if (a.state === 'Booted' && b.state !== 'Booted') return -1;
      if (b.state === 'Booted' && a.state !== 'Booted') return 1;
      return 0;
    });

  return matches[0] || null;
}

/**
 * Get all currently booted simulator devices
 */
export async function getBootedDevices(): Promise<SimulatorDevice[]> {
  const devices = await listDevices();
  return devices.filter(d => d.state === 'Booted');
}

/**
 * Boot a simulator device if not already running
 */
export async function bootDevice(udid: string): Promise<void> {
  const devices = await listDevices();
  const device = devices.find(d => d.udid === udid);

  if (!device) {
    throw new Error(`Device not found: ${udid}`);
  }

  if (device.state === 'Booted') {
    return; // Already running
  }

  await execFileAsync('xcrun', ['simctl', 'boot', udid]);

  // Wait briefly for boot to register
  await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * Format device info for display
 */
export function formatDevice(device: SimulatorDevice): string {
  const runtimeVersion = device.runtime
    .replace(/^.*SimRuntime\./, '')
    .replace(/-/g, '.');
  const stateIcon = device.state === 'Booted' ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m';
  return `${stateIcon} ${device.name} (${runtimeVersion}) [${device.udid.slice(0, 8)}...]`;
}
