import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateApiKey, hashApiKey, isValidApiKeyFormat } from '../../lib/mcp/keys'
import { rpcError, rpcResult, JsonRpcErrorCode } from '../../lib/mcp/protocol'
import { MCP_TOOLS, callMcpTool } from '../../lib/mcp/tools'

// Tests for the MCP server: agent-facing JSON-RPC API surface (org-scoped
// Bearer API keys + tools/list + tools/call). Real unit tests for the pure
// crypto/protocol helpers; structural/source assertions for the DB-heavy
// query layer and route, matching the convention in email-v2-infra.test.ts.

const ROOT = process.cwd()

function readSrc(relPath: string): string {
  const absPath = path.join(ROOT, relPath)
  expect(fs.existsSync(absPath), `File not found: ${relPath}`).toBe(true)
  return fs.readFileSync(absPath, 'utf-8')
}

describe('lib/mcp/keys: API key generation and hashing', () => {
  it('generates keys with the al_live_ prefix and 64 hex chars of entropy', () => {
    const { key, prefix } = generateApiKey()
    expect(key).toMatch(/^al_live_[0-9a-f]{64}$/)
    expect(prefix).toBe(key.slice(0, 16))
  })

  it('never returns the plaintext key twice — each call mints a fresh secret', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.key).not.toBe(b.key)
    expect(a.hash).not.toBe(b.hash)
  })

  it('hash is deterministic SHA-256 and does not leak the plaintext', () => {
    const { key, hash } = generateApiKey()
    expect(hashApiKey(key)).toBe(hash)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain(key.slice(8))
  })

  it('isValidApiKeyFormat accepts a well-formed key and rejects malformed ones', () => {
    const { key } = generateApiKey()
    expect(isValidApiKeyFormat(key)).toBe(true)
    expect(isValidApiKeyFormat('al_live_tooshort')).toBe(false)
    expect(isValidApiKeyFormat('sk_live_' + 'a'.repeat(64))).toBe(false)
    expect(isValidApiKeyFormat('')).toBe(false)
  })
})

describe('lib/mcp/protocol: JSON-RPC envelope helpers', () => {
  it('rpcResult wraps a payload in a jsonrpc 2.0 success envelope', () => {
    expect(rpcResult(1, { ok: true })).toEqual({ jsonrpc: '2.0', id: 1, result: { ok: true } })
  })

  it('rpcError wraps a code/message in a jsonrpc 2.0 error envelope', () => {
    expect(rpcError(1, JsonRpcErrorCode.UNAUTHORIZED, 'nope')).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32001, message: 'nope', data: undefined },
    })
  })

  it('defines distinct standard JSON-RPC error codes plus an MCP-specific UNAUTHORIZED code', () => {
    const codes = Object.values(JsonRpcErrorCode)
    expect(new Set(codes).size).toBe(codes.length)
    expect(JsonRpcErrorCode.UNAUTHORIZED).toBe(-32001)
    expect(JsonRpcErrorCode.METHOD_NOT_FOUND).toBe(-32601)
  })
})

describe('lib/mcp/tools: tool registry', () => {
  it('registers exactly the 5 roadmap tools with name/description/inputSchema', () => {
    const names = MCP_TOOLS.map((t) => t.name).sort()
    expect(names).toEqual(['create_ticket', 'generate_answer', 'get_faq', 'get_tickets', 'search_kb'])
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(10)
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('search_kb and create_ticket and generate_answer mark their primary field required', () => {
    const byName = Object.fromEntries(MCP_TOOLS.map((t) => [t.name, t]))
    expect(byName.search_kb.inputSchema.required).toContain('query')
    expect(byName.create_ticket.inputSchema.required).toContain('content')
    expect(byName.generate_answer.inputSchema.required).toContain('question')
  })

  it('callMcpTool returns an isError result for an unknown tool name instead of throwing', async () => {
    const result = await callMcpTool('not_a_real_tool', {}, 1)
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Unknown tool')
  })

  it('search_kb rejects a missing/empty query without hitting the DB', async () => {
    const result = await callMcpTool('search_kb', {}, 1)
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('query is required')
  })

  it('search_kb rejects a query over 2000 chars without hitting the embedding API (cost-abuse guard)', async () => {
    const result = await callMcpTool('search_kb', { query: 'x'.repeat(2001) }, 1)
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('2000 characters')
  })

  it('create_ticket rejects missing content and content over 4000 chars without hitting the DB', async () => {
    const empty = await callMcpTool('create_ticket', {}, 1)
    expect(empty.isError).toBe(true)
    expect(empty.content[0].text).toContain('content is required')

    const tooLong = await callMcpTool('create_ticket', { content: 'x'.repeat(4001) }, 1)
    expect(tooLong.isError).toBe(true)
    expect(tooLong.content[0].text).toContain('4000 characters')
  })

  it('generate_answer rejects a missing question without hitting the DB', async () => {
    const result = await callMcpTool('generate_answer', {}, 1)
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('question is required')
  })

  it('generate_answer rejects a question over 2000 chars without hitting the LLM (cost-abuse guard)', async () => {
    const result = await callMcpTool('generate_answer', { question: 'x'.repeat(2001) }, 1)
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('2000 characters')
  })
})

describe('lib/mcp/tools: source-level wiring', () => {
  const src = () => readSrc('lib/mcp/tools.ts')

  it('create_ticket routes through the same AI triage pipeline as every other channel, tagged as platform mcp', () => {
    const s = src()
    expect(s).toContain('processCommunityMessage(')
    expect(s).toContain("platform: 'mcp'")
  })

  it('generate_answer is gated by the deflection limit before running any LLM call', () => {
    const s = src()
    const gateIdx = s.indexOf('checkDeflectionLimit(orgId)')
    const generateIdx = s.indexOf('generateText({')
    expect(gateIdx).toBeGreaterThan(-1)
    expect(generateIdx).toBeGreaterThan(gateIdx)
  })

  it('caps all list-returning tools at MAX_RESULTS to avoid a full-dataset exfil in one call', () => {
    const s = src()
    expect(s).toContain('const MAX_RESULTS = 20')
    expect(s).toContain('Math.min(Number(args.limit) || 5, MAX_RESULTS)')
    expect(s).toContain('Math.min(Number(args.limit) || 10, MAX_RESULTS)')
  })

  it('get_tickets passes limit down to the query layer instead of pulling the full org table into memory', () => {
    const s = src()
    const fnStart = s.indexOf('async function getTicketsTool')
    const fnBody = s.slice(fnStart, fnStart + 700)
    expect(fnBody).toMatch(/getTickets\(\s*\{[\s\S]*?\},\s*orgId,\s*limit\s*\)/)
    expect(fnBody).not.toContain('.slice(0, limit)')
  })

  it('callMcpTool catches thrown errors from any tool instead of letting them 500 the route', () => {
    const s = src()
    const dispatchStart = s.indexOf('export async function callMcpTool')
    const dispatchBody = s.slice(dispatchStart)
    expect(dispatchBody).toContain('try {')
    expect(dispatchBody).toContain('catch (err)')
    expect(dispatchBody).toContain("errorResult('Internal error running tool')")
  })
})

describe('lib/db/queries/api-keys: org-scoped key lifecycle', () => {
  const src = () => readSrc('lib/db/queries/api-keys.ts')

  it('exports the full key lifecycle: create, list, revoke, resolve', async () => {
    const q = await import('../../lib/db/queries/api-keys')
    for (const fn of ['createApiKey', 'listApiKeys', 'revokeApiKey', 'resolveApiKey']) {
      expect(typeof (q as Record<string, unknown>)[fn], fn).toBe('function')
    }
  })

  it('createApiKey never persists the plaintext, only the hash', () => {
    const s = src()
    const fnStart = s.indexOf('export async function createApiKey')
    const fnBody = s.slice(fnStart, fnStart + 400)
    expect(fnBody).toContain('keyHash: hash')
    expect(fnBody).not.toMatch(/keyHash:\s*key[,\s]/)
  })

  it('revokeApiKey scopes the update by orgId in addition to keyId (IDOR guard)', () => {
    const s = src()
    const fnStart = s.indexOf('export async function revokeApiKey')
    const fnBody = s.slice(fnStart, fnStart + 400)
    expect(fnBody).toContain('and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId))')
  })

  it('resolveApiKey rejects revoked keys (isNull filter) and expired keys (explicit date check)', () => {
    const s = src()
    const fnStart = s.indexOf('export async function resolveApiKey')
    const fnBody = s.slice(fnStart, fnStart + 800)
    expect(fnBody).toContain('isNull(apiKeys.revokedAt)')
    expect(fnBody).toMatch(/if \(row\.expiresAt && row\.expiresAt < new Date\(\)\.toISOString\(\)\) return null/)
  })

  it('resolveApiKey looks up by hash, never by plaintext key', () => {
    const s = src()
    const fnStart = s.indexOf('export async function resolveApiKey')
    const fnBody = s.slice(fnStart, fnStart + 400)
    expect(fnBody).toContain('hashApiKey(plaintextKey)')
    expect(fnBody).toContain('eq(apiKeys.keyHash, hash)')
  })

  it('resolveApiKey records last-used on every successful resolution', () => {
    const s = src()
    const fnStart = s.indexOf('export async function resolveApiKey')
    const fnBody = s.slice(fnStart, fnStart + 800)
    expect(fnBody).toContain('lastUsedAt: new Date().toISOString()')
  })
})

describe('schema: api_keys table', () => {
  it('defines the api_keys table with hash/prefix/revocation/expiry columns', async () => {
    const { apiKeys } = await import('../../lib/db/schema')
    const cols = apiKeys as unknown as Record<string, unknown>
    for (const col of ['orgId', 'keyHash', 'keyPrefix', 'name', 'lastUsedAt', 'expiresAt', 'revokedAt']) {
      expect(cols, col).toHaveProperty(col)
    }
  })

  it('migration file creates api_keys with a unique key_hash and an org index', () => {
    const sql = readSrc('drizzle/0015_api_keys.sql')
    expect(sql).toMatch(/key_hash TEXT NOT NULL UNIQUE/)
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys \(org_id\)/)
    expect(sql).toMatch(/REFERENCES orgs\(id\)/)
  })
})

describe('lib/db/queries/tickets: getTickets supports a DB-level limit', () => {
  it('accepts an optional limit param and applies it with $dynamic().limit(), not a client-side slice', () => {
    const src = readSrc('lib/db/queries/tickets.ts')
    const fnStart = src.indexOf('export async function getTickets')
    const fnBody = src.slice(fnStart, fnStart + 600)
    expect(fnBody).toContain('limit?: number')
    expect(fnBody).toContain('.$dynamic()')
    expect(fnBody).toMatch(/if \(limit\) query = query\.limit\(limit\)/)
  })
})

describe('app/api/mcp/route: JSON-RPC dispatcher', () => {
  const src = () => readSrc('app/api/mcp/route.ts')

  it('allows initialize and notifications/initialized without auth, gates everything else on a Bearer key', () => {
    const s = src()
    const initIdx = s.indexOf("body.method === 'initialize'")
    const notifIdx = s.indexOf("body.method === 'notifications/initialized'")
    const authIdx = s.indexOf('if (!bearerKey)')
    expect(initIdx).toBeGreaterThan(-1)
    expect(notifIdx).toBeGreaterThan(initIdx)
    expect(authIdx).toBeGreaterThan(notifIdx)
  })

  it('resolves the Bearer key via resolveApiKey and 401s on an invalid/revoked key', () => {
    const s = src()
    expect(s).toContain('resolveApiKey(bearerKey)')
    expect(s).toContain("JsonRpcErrorCode.UNAUTHORIZED, 'Invalid or revoked API key'")
  })

  it('applies a per-org rate limit before dispatching tools/list or tools/call', () => {
    const s = src()
    const limitIdx = s.indexOf('rateLimit(`mcp:${orgId}`')
    const toolsListIdx = s.indexOf("body.method === 'tools/list'")
    expect(limitIdx).toBeGreaterThan(-1)
    expect(limitIdx).toBeLessThan(toolsListIdx)
  })

  it('rejects tools/call for a tool name not present in MCP_TOOLS before invoking it', () => {
    const s = src()
    expect(s).toContain('MCP_TOOLS.some((t) => t.name === toolName)')
    expect(s).toContain('JsonRpcErrorCode.METHOD_NOT_FOUND')
  })

  it('rejects malformed JSON and non-2.0 envelopes with the correct JSON-RPC error codes', () => {
    const s = src()
    expect(s).toContain('JsonRpcErrorCode.PARSE_ERROR')
    expect(s).toContain("body.jsonrpc !== '2.0'")
    expect(s).toContain('JsonRpcErrorCode.INVALID_REQUEST')
  })
})

describe('auth.ts: /api/mcp is a public path (self-authenticates via Bearer key)', () => {
  it('lists /api/mcp in PUBLIC_PATHS so the session middleware does not 401 it before the route runs', () => {
    const s = readSrc('auth.ts')
    const match = s.match(/const PUBLIC_PATHS = \[([^\]]+)\]/)
    expect(match).toBeTruthy()
    expect(match![1]).toContain("'/api/mcp'")
  })
})

describe('SourcePlatform / Platform: mcp is a first-class value everywhere source_platform is branched on', () => {
  it("types/index.ts SourcePlatform includes 'mcp'", () => {
    const s = readSrc('types/index.ts')
    expect(s).toMatch(/SourcePlatform\s*=[^;]*'mcp'/)
  })

  it("lib/ingest/pipeline.ts Platform type includes 'mcp'", () => {
    const s = readSrc('lib/ingest/pipeline.ts')
    expect(s).toMatch(/Platform\s*=[^;]*'mcp'/)
  })

  it('postReply no-ops for mcp tickets instead of trying to post to a nonexistent channel', () => {
    const s = readSrc('lib/ai/agent.ts')
    expect(s).toMatch(/if \(platform === 'mcp'\) return null/)
  })

  it('staff reply/draft-edit actions also skip sendToChannel for mcp tickets — discord_channel_id holds a synthetic id, not a real channel', () => {
    // create_ticket stashes its synthetic messageId in discord_channel_id, which
    // reads as "present" to a naive truthiness check — these two call sites in
    // app/actions/tickets.ts must explicitly exclude 'mcp', not just check
    // channelId presence, or every staff reply fires a doomed live Discord call.
    const s = readSrc('app/actions/tickets.ts')
    const matches = [...s.matchAll(/else if \(ticket\.source_platform !== 'mcp'\)/g)]
    expect(matches.length).toBe(2)
  })
})
