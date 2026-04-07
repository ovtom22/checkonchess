import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_API_URL: 'https://www.checkonchess.com',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.checkonchess.com' },
    ],
  },
}

export default nextConfig
