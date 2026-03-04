import { defineConfig } from 'tsup';

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
  },
  // MCP server build (CJS for node invocation via MCP client)
  {
    entry: ['src/mcp/server.ts'],
    format: ['cjs'],
    outDir: 'dist/mcp',
    clean: false,
    sourcemap: true,
    external: ['playwright'],
  },
]);
