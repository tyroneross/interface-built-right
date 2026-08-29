import { defineConfig } from 'tsup';

// Every runtime dependency the executables reach for. Kept as one list so the
// CLI and the MCP server cannot drift apart on what they carry.
const RUNTIME_DEPS = ['commander', 'nanoid', 'pixelmatch', 'pngjs', 'zod'];

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
  // CLI build (CJS for shebang compatibility).
  //
  // RUNTIME_DEPS are bundled in rather than left external. Plugin installs
  // clone this repo and execute dist/bin/ibr.js directly — no npm lifecycle
  // runs on the installing machine, so nothing ever materializes
  // node_modules there. With these left external the shipped CLI throws
  // `Cannot find module 'commander'` on first run for anyone who is not
  // already a developer of this repo. The library build keeps them external,
  // because npm consumers resolve dependencies normally.
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
    noExternal: RUNTIME_DEPS,
    esbuildOptions: suppressExpectedImportMetaWarning,
  },
  // MCP server build (CJS for node invocation via MCP client).
  // Self-contained for the same reason as the CLI: optional-mcp/mcp.json
  // launches this file by absolute path inside the plugin directory.
  {
    entry: ['src/mcp/server.ts'],
    format: ['cjs'],
    outDir: 'dist/mcp',
    clean: false,
    sourcemap: true,
    external: ['playwright'],
    noExternal: RUNTIME_DEPS,
    esbuildOptions: suppressExpectedImportMetaWarning,
  },
]);
