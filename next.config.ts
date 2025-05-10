
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Using "*" to allow all origins for development.
    // For production, this should be restricted to specific domains.
    allowedDevOrigins: ["*"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
