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
  // CLI build
  {
    entry: ['src/bin/ibr.ts'],
    format: ['esm'],
    outDir: 'dist/bin',
    clean: false,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: ['playwright'],
  },
]);
