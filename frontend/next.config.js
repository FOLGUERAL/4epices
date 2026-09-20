/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      // L'ancienne adresse de la page de swipe : redirection permanente pour ne casser aucun lien
      { source: '/menu-semaine', destination: '/decouvrir', permanent: true },
    ];
  },
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

