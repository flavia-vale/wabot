import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: '/dashboard/',
        destination: '/dashboard/inicio',
        permanent: false,
      },
    ]
  },
  async headers() {
    const noIndexHeaders = [
      {
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow',
      },
    ]

    return [
      {
        source: '/dashboard/:path*',
        headers: noIndexHeaders,
      },
      {
        source: '/admin/:path*',
        headers: noIndexHeaders,
      },
      {
        source: '/api/:path*',
        headers: noIndexHeaders,
      },
      {
        source: '/login',
        headers: noIndexHeaders,
      },
      {
        source: '/cadastro',
        headers: noIndexHeaders,
      },
      {
        source: '/promo-vip-7dias',
        headers: noIndexHeaders,
      },
    ]
  },
}

export default nextConfig
