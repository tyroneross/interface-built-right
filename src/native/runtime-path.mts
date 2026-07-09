import { dirname } from 'path';
import { fileURLToPath } from 'url';

// This helper is deliberately `.mts`: TypeScript typechecks it as ESM, while
// tsup can still bundle it into the CJS build. The CJS branch short-circuits
// before evaluating `import.meta`; the ESM branch derives the module location.
export const moduleDir = typeof __dirname === 'string'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));
