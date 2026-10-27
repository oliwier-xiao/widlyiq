import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Native module: keep it out of the bundle and load it from node_modules at runtime.
  serverExternalPackages: ['better-sqlite3'],
  poweredByHeader: false,
  // The dev badge sits over the offer field's lane labels, and the dashboard is often shown from `next dev` on a projector.
  devIndicators: false,
}

export default nextConfig
