import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { loadDesignSystemConfig, getDefaultSeverity } from './config.js';

const TEST_DIR = join(import.meta.dirname || __dirname, '../../.test-ds-config');
const IBR_DIR = join(TEST_DIR, '.ibr');

describe('Design System Config', () => {
  beforeEach(() => {
    mkdirSync(IBR_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns undefined when no config exists', async () => {
    rmSync(IBR_DIR, { recursive: true, force: true });
    const config = await loadDesignSystemConfig(TEST_DIR);
    expect(config).toBeUndefined();
  });

  it('loads valid config', async () => {
    const config = {
      version: 1,
      name: 'Test System',
      principles: {
        calmPrecision: {
          core: ['gestalt', 'signal-noise'],
          stylistic: ['fitts'],
          severity: { gestalt: 'error', fitts: 'warn' },
        },
        custom: [],
      },
      tokens: {
        colors: { primary: '#3b82f6' },
        spacing: [4, 8, 16, 24],
        touchTargets: { min: 44 },
      },
    };
    writeFileSync(join(IBR_DIR, 'design-system.json'), JSON.stringify(config));

    const result = await loadDesignSystemConfig(TEST_DIR);
    expect(result).toBeDefined();
    expect(result!.name).toBe('Test System');
    expect(result!.principles.calmPrecision.core).toEqual(['gestalt', 'signal-noise']);
    expect(result!.tokens.colors).toEqual({ primary: '#3b82f6' });
  });

  it('applies defaults for missing fields', async () => {
    const minimal = { version: 1, name: 'Minimal' };
    writeFileSync(join(IBR_DIR, 'design-system.json'), JSON.stringify(minimal));

    const result = await loadDesignSystemConfig(TEST_DIR);
    expect(result).toBeDefined();
    expect(result!.principles.calmPrecision.core).toEqual(['gestalt', 'signal-noise', 'content-chrome', 'cognitive-load']);
    expect(result!.principles.calmPrecision.stylistic).toEqual(['fitts', 'hick']);
    expect(result!.principles.custom).toEqual([]);
  });

  it('rejects invalid config (wrong version)', async () => {
    writeFileSync(join(IBR_DIR, 'design-system.json'), JSON.stringify({ version: 2, name: 'Bad' }));
    await expect(loadDesignSystemConfig(TEST_DIR)).rejects.toThrow();
  });

  describe('getDefaultSeverity', () => {
    const config = {
      version: 1 as const,
      name: 'Test',
      principles: {
        calmPrecision: {
          core: ['gestalt', 'signal-noise'],
          stylistic: ['fitts'],
          severity: { gestalt: 'error' as const, fitts: 'warn' as const },
        },
        custom: [],
      },
      tokens: {},
    };

    it('returns error for core principles', () => {
      expect(getDefaultSeverity('gestalt', config)).toBe('error');
      expect(getDefaultSeverity('signal-noise', config)).toBe('error');
    });

    it('returns warn for stylistic principles', () => {
      expect(getDefaultSeverity('fitts', config)).toBe('warn');
    });

    it('returns explicit severity override', () => {
      const withOverride = {
        ...config,
        principles: {
          ...config.principles,
          calmPrecision: {
            ...config.principles.calmPrecision,
            severity: { ...config.principles.calmPrecision.severity, gestalt: 'off' as const },
          },
        },
      };
      expect(getDefaultSeverity('gestalt', withOverride)).toBe('off');
    });

    it('returns warn for unknown principles', () => {
      expect(getDefaultSeverity('unknown-principle', config)).toBe('warn');
    });
  });
});
