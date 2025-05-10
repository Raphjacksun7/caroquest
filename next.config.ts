
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    allowedDevOrigins: [
      "*",
      "localhost:3000"
    ]
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
