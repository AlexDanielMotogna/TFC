/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@tfc/shared'],
  reactStrictMode: true,
  output: 'standalone',
  // Exclude Prisma from bundling - let it use native Node.js require at runtime
  serverExternalPackages: ['@prisma/client', 'prisma'],
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
  // Redirect www.tfc.gg → tfc.gg
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.tfc.gg' }],
        destination: 'https://tfc.gg/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
