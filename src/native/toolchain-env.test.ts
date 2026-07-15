import { describe, it, expect } from 'vitest';
import { hardenPath, ensureToolchainPath } from './toolchain-env.js';

// `/usr/bin` and `/bin` exist on every macOS + Linux test host, so their
// addition by hardenPath is deterministic here. `/opt/homebrew/bin` may or may
// not exist, so we never assert on it.

describe('hardenPath', () => {
  it('appends /usr/bin when a stripped PATH omits it', () => {
    // The exact launchd-minimal failure: PATH has homebrew but not /usr/bin.
    const result = hardenPath('/opt/homebrew/bin').split(':');
    expect(result).toContain('/usr/bin');
    // User-provided entry keeps front precedence; canonical dir is appended.
    expect(result.indexOf('/opt/homebrew/bin')).toBeLessThan(
      result.indexOf('/usr/bin')
    );
  });

  it('does not duplicate a canonical dir already present', () => {
    const result = hardenPath('/usr/bin:/bin').split(':');
    expect(result.filter((d) => d === '/usr/bin')).toHaveLength(1);
    expect(result.filter((d) => d === '/bin')).toHaveLength(1);
  });

  it('preserves existing entries and their order', () => {
    const result = hardenPath('/custom/tool:/usr/bin').split(':');
    expect(result[0]).toBe('/custom/tool');
    expect(result[1]).toBe('/usr/bin');
  });

  it('handles undefined and empty PATH by seeding the toolchain dirs', () => {
    for (const input of [undefined, '']) {
      const result = hardenPath(input).split(':').filter(Boolean);
      expect(result).toContain('/usr/bin');
      expect(result).toContain('/bin');
    }
  });

  it('is idempotent', () => {
    const once = hardenPath('/opt/homebrew/bin');
    const twice = hardenPath(once);
    expect(twice).toBe(once);
  });
});

describe('ensureToolchainPath', () => {
  it('repairs a passed env object without throwing (no-op off darwin)', () => {
    const env: NodeJS.ProcessEnv = { PATH: '/opt/homebrew/bin' };
    ensureToolchainPath(env);
    if (process.platform === 'darwin') {
      expect(env.PATH?.split(':')).toContain('/usr/bin');
    } else {
      expect(env.PATH).toBe('/opt/homebrew/bin');
    }
  });
});
