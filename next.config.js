/** @type {import('next').NextConfig} */
const nextConfig = {
  // `output: 'standalone'` was removed — it breaks `next start` (and was the
  // cause of client-side navigation errors). Re-add it only for Docker
  // self-hosting, and run `node .next/standalone/server.js` in that case.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

module.exports = nextConfig
