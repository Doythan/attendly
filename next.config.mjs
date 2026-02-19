/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages deployment
  output: 'export',
  // Disable image optimization (not supported on Cloudflare Pages static export)
  images: { unoptimized: true },
}

export default nextConfig
