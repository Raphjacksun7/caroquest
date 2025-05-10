
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    allowedDevOrigins: ["*"], // Allow all origins for dev server HMR, etc.
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

module.exports = nextConfig;
