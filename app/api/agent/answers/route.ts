import { NextRequest, NextResponse } from 'next/server'
import { generateAnswerCore } from '@/lib/agent/core'
import { authenticateAgentRequest, readAgentJsonBody, agentError } from '@/lib/agent/http'

/**
 * POST /api/agent/answers
 * REST counterpart to the MCP generate_answer tool. Gated by the org's
 * monthly deflection limit before any LLM call runs.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateAgentRequest(req)
  if ('response' in auth) return auth.response

  const bodyResult = await readAgentJsonBody(req)
  if (!bodyResult.ok) return bodyResult.response

  const result = await generateAnswerCore(auth.orgId, bodyResult.body)
  // The deflection-limit-reached case is a quota error, not a validation
  // error — 429 (Too Many Requests) fits the "come back later or upgrade"
  // semantics better than a flat 400, and lets a client's retry logic treat
  // it the same way it already treats rate limiting.
  if (!result.ok) {
    const status = result.error.startsWith('Monthly deflection limit reached') ? 429 : 400
    return agentError(status, result.error)
  }
  return NextResponse.json(result.data)
}
