/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/dashboard/',
        destination: '/dashboard/inicio',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
