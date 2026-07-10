import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appDir,
  // Enable static image imports
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
