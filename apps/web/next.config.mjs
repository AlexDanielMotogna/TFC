/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@tfc/shared'],
  reactStrictMode: true,
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
};

export default nextConfig;
