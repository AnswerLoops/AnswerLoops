import type { NextRequest } from 'next/server'

/**
 * Reads a request body while counting actual bytes, aborting as soon as the
 * cap is crossed. `req.text()` would buffer the entire body before any length
 * check could run — and a string `.length` check counts UTF-16 code units, not
 * bytes — so neither enforces the cap against a client that omits or lies
 * about content-length. Returns null when the cap is exceeded.
 *
 * Shared by every public, pre-auth POST endpoint (MCP, Agent API) so the
 * same memory-DoS guard can't drift between them.
 */
export async function readBodyCapped(req: NextRequest, maxBytes: number): Promise<string | null> {
  const reader = req.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}
