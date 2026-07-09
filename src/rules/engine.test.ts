import { describe, expect, it, vi } from 'vitest';

describe('built-in rule presets', () => {
  it('are available immediately when the engine is imported', async () => {
    vi.resetModules();
    const { getPreset, listPresets } = await import('./engine.js');

    expect(listPresets()).toEqual([
      'minimal',
      'calm-precision',
      'wcag-contrast',
      'touch-targets',
    ]);
    expect(getPreset('minimal')?.rules.length).toBeGreaterThan(0);
  });
});
