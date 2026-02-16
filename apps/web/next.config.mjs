/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@tfc/shared', 'react-markdown', 'remark-gfm', 'rehype-slug'],
  reactStrictMode: true,
  output: 'standalone',
  // Exclude Prisma from bundling - let it use native Node.js require at runtime
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'explorer-api.walletconnect.com',
        pathname: '/v3/logo/**',
      },
    ],
  },
  // Redirect tfc.gg → www.tfc.gg
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'tfc.gg' }],
        destination: 'https://www.tfc.gg/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
