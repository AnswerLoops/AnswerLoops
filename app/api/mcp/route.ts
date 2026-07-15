import { NextRequest } from 'next/server'
import { resolveApiKey } from '@/lib/db/queries/api-keys'
import { isValidApiKeyFormat } from '@/lib/mcp/keys'
import { MCP_TOOLS, callMcpTool } from '@/lib/mcp/tools'
import { rpcError, rpcResult, JsonRpcErrorCode, type JsonRpcRequest } from '@/lib/mcp/protocol'
import { rateLimit } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

const MOD = 'api/mcp'
const SERVER_INFO = { name: 'answerloops', version: '1.0.0' }
const PROTOCOL_VERSION = '2024-11-05'

// Per-key rate limit — this endpoint runs LLM calls (generate_answer) and DB
// reads on behalf of an external caller with no human in the loop; same
// cost-abuse posture as the public widget chat endpoint.
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 60_000

// Largest legitimate payload is create_ticket's 4000-char content plus JSON
// envelope — 64KB is generous headroom. Enforced before the body is buffered,
// because this path runs before auth: without it, an unauthenticated client
// can make the server buffer arbitrarily large bodies (same posture as the
// email ingest route's MAX_BODY_BYTES).
const MAX_BODY_BYTES = 64 * 1024

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json(rpcError(null, JsonRpcErrorCode.INVALID_REQUEST, 'Request body too large'), { status: 413 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  let body: JsonRpcRequest
  try {
    // content-length can lie (or be absent on chunked transfer) — re-check the
    // actual byte count after reading, before the JSON parse.
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      return Response.json(rpcError(null, JsonRpcErrorCode.INVALID_REQUEST, 'Request body too large'), { status: 413 })
    }
    body = JSON.parse(raw) as JsonRpcRequest
  } catch {
    return Response.json(rpcError(null, JsonRpcErrorCode.PARSE_ERROR, 'Invalid JSON'), { status: 400 })
  }

  const id = body.id ?? null

  if (!body.jsonrpc || body.jsonrpc !== '2.0' || !body.method) {
    return Response.json(rpcError(id, JsonRpcErrorCode.INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request'), { status: 400 })
  }

  // `initialize` is the only method allowed without auth — mirrors how MCP
  // clients probe a server's capabilities before a user has pasted a key in.
  if (body.method === 'initialize') {
    return Response.json(
      rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })
    )
  }

  if (body.method === 'notifications/initialized') {
    // Client notification, no response body expected.
    return new Response(null, { status: 202 })
  }

  if (!bearerKey) {
    return Response.json(rpcError(id, JsonRpcErrorCode.UNAUTHORIZED, 'Missing Authorization: Bearer <key> header'), { status: 401 })
  }

  // Cheap format check before hashing + hitting the DB — a malformed key can
  // never match, so junk/scanner traffic is rejected without a query. Same
  // response as an unknown key, so this leaks nothing about key validity.
  if (!isValidApiKeyFormat(bearerKey)) {
    return Response.json(rpcError(id, JsonRpcErrorCode.UNAUTHORIZED, 'Invalid or revoked API key'), { status: 401 })
  }

  const resolved = await resolveApiKey(bearerKey)
  if (!resolved) {
    return Response.json(rpcError(id, JsonRpcErrorCode.UNAUTHORIZED, 'Invalid or revoked API key'), { status: 401 })
  }
  const { orgId } = resolved

  const limit = rateLimit(`mcp:${orgId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!limit.ok) {
    return Response.json(rpcError(id, JsonRpcErrorCode.INTERNAL_ERROR, 'Rate limit exceeded'), { status: 429 })
  }

  if (body.method === 'tools/list') {
    return Response.json(rpcResult(id, { tools: MCP_TOOLS }))
  }

  if (body.method === 'tools/call') {
    const params = body.params ?? {}
    const toolName = typeof params.name === 'string' ? params.name : ''
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>

    if (!MCP_TOOLS.some((t) => t.name === toolName)) {
      return Response.json(rpcError(id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Unknown tool: ${toolName}`), { status: 400 })
    }

    logger.info('MCP tool call', { module: MOD, orgId, tool: toolName })
    const result = await callMcpTool(toolName, toolArgs, orgId)
    return Response.json(rpcResult(id, result))
  }

  return Response.json(rpcError(id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Unknown method: ${body.method}`), { status: 400 })
}
