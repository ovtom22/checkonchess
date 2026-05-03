import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.checkonchess.com' },
      { protocol: 'https', hostname: 'api.checkonchess.com' },
    ],
  },
}

export default nextConfig
