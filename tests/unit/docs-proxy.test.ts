import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Mintlify's native custom-domain setup (Cloudflare CNAME + ACME TXT
// challenge for docs.answerloops.com) got stuck mid-verification — the ACME
// challenge value never generated on Mintlify's side. Reverse-proxying
// /docs/* to the working answerloops.mintlify.app origin sidesteps the DNS
// problem entirely: no CNAME, no ACME challenge, our own TLS handles it.
//
// Two real bugs found and fixed while wiring this up, both covered here:
// 1. Mintlify's own server redirects its bare root to "/introduction" (an
//    unprefixed Location header) — a rewrite proxy can't rewrite an
//    upstream redirect's Location header, so naively rewriting bare /docs
//    would send visitors to our own unprefixed /introduction, which doesn't
//    exist and 307s to /login. Fixed with our own redirect: /docs ->
//    /docs/introduction, so Mintlify's root redirect is never hit through
//    the proxy.
// 2. /docs was missing from auth.ts's PUBLIC_PATHS (same class of bug as
//    /vs and /pricing before it) — session-auth middleware 307'd every
//    request to /login before the rewrite ever ran.

const ROOT = process.cwd()

function read(relPath: string): string {
  const absPath = path.join(ROOT, relPath)
  expect(fs.existsSync(absPath), `File not found: ${relPath}`).toBe(true)
  return fs.readFileSync(absPath, 'utf-8')
}

describe('next.config.ts — /docs reverse proxy to Mintlify', () => {
  const src = read('next.config.ts')

  it('rewrites /docs/:path* to the Mintlify origin', () => {
    expect(src).toMatch(/source: '\/docs\/:path\*', destination: `\$\{MINTLIFY_ORIGIN\}\/:path\*`/)
  })

  it('redirects bare /docs to /docs/introduction on our own side, not through the proxy', () => {
    const redirectsIdx = src.indexOf('async redirects()')
    const rewritesIdx = src.indexOf('async rewrites()')
    expect(redirectsIdx).toBeGreaterThan(-1)
    expect(rewritesIdx).toBeGreaterThan(redirectsIdx)
    expect(src).toContain("source: '/docs', destination: '/docs/introduction'")
  })

  it('does not rewrite bare /docs directly to the Mintlify origin root (that hits their broken redirect)', () => {
    const rewritesBlock = src.slice(src.indexOf('async rewrites()'))
    expect(rewritesBlock).not.toMatch(/source: '\/docs', destination: MINTLIFY_ORIGIN[,}]/)
  })
})
