import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  telemetry: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
