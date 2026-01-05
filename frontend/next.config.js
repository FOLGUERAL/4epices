/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1337',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'api.4epices.fr',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '*.pinterest.com',
      },
    ],
  },
};

module.exports = nextConfig;

