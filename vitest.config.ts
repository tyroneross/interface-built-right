import { defineConfig, configDefaults } from 'vitest/config';

// Browser-integration tests launch a real Chrome via the CDP engine. Chrome is
// unreliable on the bare ubuntu runner (it passes intermittently, then fails
// with "debugger did not respond within 5s"), so the unit job sets
// IBR_UNIT_ONLY=1 to exclude them. The macos-14 integration job runs the full
// suite, where Chrome launches reliably. macOS-native tests self-gate with
// `it.runIf(process.platform === 'darwin')` and need no exclude here.
const BROWSER_INTEGRATION = [
  'src/engine/compat.test.ts',
  'src/engine/engine.integration.test.ts',
];

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      ...(process.env.IBR_UNIT_ONLY ? BROWSER_INTEGRATION : []),
    ],
    fileParallelism: false,
  },
});
