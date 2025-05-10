
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    allowedDevOrigins: [
      "3000-firebase-studio-1746739921276.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev",
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
