
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  experimental: {
    allowedDevOrigins: [
      "https://3000-firebase-studio-1746739921276.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev",
      "http://localhost:3000", // For local development
      // If you need to allow all subdomains of cloudworkstations.dev, you might use a regex,
      // but for now, adding the specific origin from the error.
      // Example for regex (if supported and needed): /^https:\/\/.*\.cloudworkstations\.dev$/
    ],
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
