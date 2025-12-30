import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable static image imports
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
