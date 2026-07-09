import { describe, expect, it } from 'vitest';
import { isSimDriverAvailable } from './sim-driver.js';

describe('sim-driver source resolution', () => {
  it.runIf(process.platform === 'darwin')('locates the bundled Swift package on macOS', () => {
    expect(isSimDriverAvailable()).toBe(true);
  });
});
