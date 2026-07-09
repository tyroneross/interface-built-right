import { defineConfig } from 'tsup';

function suppressExpectedImportMetaWarning(options: { logOverride?: Record<string, 'silent'> }): void {
  // runtime-path.mts guards import.meta behind a CJS __dirname branch. esbuild
  // emits a warning while still producing the correct CJS fallback; the package
  // export smoke test verifies both generated formats after every build.
  options.logOverride = {
    ...options.logOverride,
    'empty-import-meta': 'silent',
  };
}

export default defineConfig([
  // Library build
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ['playwright'],
    esbuildOptions: suppressExpectedImportMetaWarning,
  },
  // CLI build (CJS for shebang compatibility)
  {
    entry: ['src/bin/ibr.ts'],
    format: ['cjs'],
    outDir: 'dist/bin',
    clean: false,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: ['playwright'],
    esbuildOptions: suppressExpectedImportMetaWarning,
  },
  // MCP server build (CJS for node invocation via MCP client)
  {
    entry: ['src/mcp/server.ts'],
    format: ['cjs'],
    outDir: 'dist/mcp',
    clean: false,
    sourcemap: true,
    external: ['playwright'],
    esbuildOptions: suppressExpectedImportMetaWarning,
  },
]);
