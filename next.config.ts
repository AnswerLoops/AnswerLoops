import type { NextConfig } from "next";

const securityHeaders = [
  // Block clickjacking — page cannot be embedded in any iframe
  { key: 'X-Frame-Options', value: 'DENY' },
  // Belt-and-suspenders CSP frame protection (overrides X-Frame-Options in modern browsers)
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Prevent MIME-type sniffing — browser must honour declared Content-Type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't send full referrer to third-party origins
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features this app never uses
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Force HTTPS for 2 years once visited over HTTPS (prod only — ignored over HTTP)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig;
