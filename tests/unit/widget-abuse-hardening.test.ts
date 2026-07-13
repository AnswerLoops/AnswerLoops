import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Widget chat is a public, unauthenticated endpoint that calls a paid AI
// model. Previously it had no input-length cap (a single request could carry
// unbounded text/messages straight into the model call) and a hand-rolled
// per-IP-only limiter keyed on the spoofable x-forwarded-for header, so one
// widget token could be hammered from rotating IPs with no per-org ceiling.
//
// Fix: reuse the shared lib/ratelimit.ts limiter (used elsewhere for ingest
// and KB upload) instead of a duplicate one-off, add a per-token limit that
// caps total cost exposure per org regardless of IP, and cap both per-message
// length and message-array size before the request reaches the model.
//
// Source-file structural assertions — same convention as
// tenant-isolation.test.ts; e2e/widget.spec.ts exercises the actual HTTP
// behavior (400s, 429, streamed response).

const ROOT = process.cwd()

function read(relPath: string): string {
  const absPath = path.join(ROOT, relPath)
  expect(fs.existsSync(absPath), `File not found: ${relPath}`).toBe(true)
  return fs.readFileSync(absPath, 'utf-8')
}

describe('widget chat route reuses the shared rate limiter', () => {
  it('imports rateLimit from lib/ratelimit instead of a hand-rolled Map', () => {
    const src = read('app/api/widget/chat/route.ts')
    expect(src).toContain("import { rateLimit } from '@/lib/ratelimit'")
    expect(src).not.toContain('rateLimitMap')
    expect(src).not.toContain('function checkRateLimit')
  })

  it('rate-limits both by widget token and by token+IP', () => {
    const src = read('app/api/widget/chat/route.ts')
    expect(src).toMatch(/rateLimit\(`widget-token:\$\{widgetToken\}`, TOKEN_MAX, TOKEN_WINDOW_MS\)/)
    expect(src).toMatch(/rateLimit\(`widget-ip:\$\{widgetToken\}:\$\{ip\}`, IP_TOKEN_MAX, IP_TOKEN_WINDOW_MS\)/)
  })

  it('rejects with 429 when either limiter trips', () => {
    const src = read('app/api/widget/chat/route.ts')
    const matches = src.match(/status: 429/g) ?? []
    expect(matches.length).toBe(2)
  })
})

describe('widget chat route caps input size before calling the model', () => {
  it('defines a per-message character cap and a max message count', () => {
    const src = read('app/api/widget/chat/route.ts')
    expect(src).toContain('const MAX_MESSAGE_CHARS = 4_000')
    expect(src).toContain('const MAX_MESSAGES = 50')
  })

  it('rejects oversized message arrays and oversized message text before convertToModelMessages', () => {
    const src = read('app/api/widget/chat/route.ts')
    const capIdx = src.indexOf('messages.length > MAX_MESSAGES')
    const oversizedIdx = src.indexOf('oversized')
    const convertIdx = src.indexOf('convertToModelMessages(uiMessages)')
    expect(capIdx).toBeGreaterThan(-1)
    expect(oversizedIdx).toBeGreaterThan(-1)
    expect(convertIdx).toBeGreaterThan(capIdx)
    expect(convertIdx).toBeGreaterThan(oversizedIdx)
  })
})
