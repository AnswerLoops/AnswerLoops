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

// Mintlify's native custom-domain setup (Cloudflare CNAME + ACME TXT challenge for
// docs.answerloops.com) has been stuck mid-verification — the ACME challenge value
// never gets generated on Mintlify's side. Proxying under our own domain sidesteps
// that entirely: no CNAME, no ACME challenge, our own TLS cert handles it, and
// visitors never see the mintlify.app URL. Revisit once/if the native custom domain
// starts working — this rewrite can stay either way, but a working custom domain on
// Mintlify's own subdomain would make this redundant, not broken.
const MINTLIFY_ORIGIN = 'https://answerloops.mintlify.app'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return [
      // Mintlify's own server redirects its bare root to /introduction — but that
      // Location header comes back unprefixed (just "/introduction"), and a rewrite
      // proxy can't rewrite an upstream redirect's Location header. Handling the
      // root redirect ourselves means /docs never actually hits Mintlify's root.
      { source: '/docs', destination: '/docs/introduction', permanent: false },
    ]
  },
  async rewrites() {
    return [
      { source: '/docs/:path*', destination: `${MINTLIFY_ORIGIN}/:path*` },
    ]
  },
}

export default nextConfig;
