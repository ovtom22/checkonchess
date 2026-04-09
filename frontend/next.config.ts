import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.checkonchess.com' },
      { protocol: 'https', hostname: 'api.checkonchess.com' },
    ],
  },
}

export default nextConfig
