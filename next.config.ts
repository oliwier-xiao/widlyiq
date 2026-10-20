import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Native module: keep it out of the bundle and load it from node_modules at runtime.
  serverExternalPackages: ['better-sqlite3'],
  poweredByHeader: false,
}

export default nextConfig
