import { generateText } from 'ai'
import { chatModel } from '@/lib/ai/models'
import { embedText } from '@/lib/ai/embed'
import { searchArticles } from '@/lib/db/queries/kb'
import { getLatestFAQ } from '@/lib/db/queries/faq'
import { getTickets } from '@/lib/db/queries/tickets'
import { processCommunityMessage } from '@/lib/ingest/pipeline'
import { assessAnswer, shouldAutoDeflect } from '@/lib/ai/assess'
import { checkDeflectionLimit } from '@/lib/billing/usage'
import { recordApiGeneration } from '@/lib/db/queries/api-generations'
import { getKBContext } from '@/lib/db/queries/kb'
import { logger } from '@/lib/logger'
import type { McpToolDefinition, McpToolResult } from './protocol'
import type { TicketStatus, Priority, TicketCategory } from '@/types'

const MOD = 'mcp/tools'

// Response payloads are capped — an agent calling these tools pays per token
// on its own end, and an unbounded ticket/KB dump is a cost footgun for them
// (and a way to accidentally exfiltrate an org's entire dataset in one call).
const MAX_RESULTS = 20

// Caps free-text inputs that feed an embedding or LLM call directly — the
// rate limiter caps request *count*, not per-request size, so an uncapped
// query/question is a way to run up real token cost in a single call.
const MAX_QUERY_LEN = 2000

function textResult(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

/**
 * Clamps a caller-supplied limit to [1, MAX_RESULTS]. Anything non-numeric,
 * fractional-weird, zero, or negative falls back to the default — a negative
 * value would otherwise flow into SQL LIMIT and throw.
 */
function clampLimit(value: unknown, defaultLimit: number): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 1) return defaultLimit
  return Math.min(n, MAX_RESULTS)
}

/**
 * Returns the value if it's one of the allowed enum members, undefined if the
 * caller omitted it, and null if they sent something invalid. The DB layer
 * parameterizes everything so an arbitrary string is not injectable, but
 * silently filtering on a nonsense value returns misleading empty results —
 * reject it instead.
 */
function parseEnumArg<T extends string>(value: unknown, allowed: readonly T[]): T | undefined | null {
  if (value === undefined) return undefined
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

// ── search_kb ────────────────────────────────────────────────────────────

const searchKbDef: McpToolDefinition = {
  name: 'search_kb',
  description: "Semantically search the organization's knowledge base (published Q&A articles promoted from resolved support tickets). Use this before answering a question yourself — it's grounded in what this specific community/product has already answered.",
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The question or topic to search for' },
      limit: { type: 'number', description: 'Max results to return (default 5, max 20)' },
    },
    required: ['query'],
  },
}

async function searchKb(orgId: number, args: Record<string, unknown>): Promise<McpToolResult> {
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  if (!query) return errorResult('query is required')
  if (query.length > MAX_QUERY_LEN) return errorResult(`query must be ${MAX_QUERY_LEN} characters or fewer`)
  const limit = clampLimit(args.limit, 5)

  const vector = await embedText(query, orgId)
  const results = await searchArticles(vector, limit, orgId)
  return textResult(
    results.map((r) => ({ question: r.question, answer: r.answer, score: Number(r.score.toFixed(3)) }))
  )
}

// ── get_faq ──────────────────────────────────────────────────────────────

const getFaqDef: McpToolDefinition = {
  name: 'get_faq',
  description: "Get the organization's most recently generated FAQ digest — a markdown summary of the top questions resolved this week, grouped by category.",
  inputSchema: { type: 'object', properties: {} },
}

async function getFaq(orgId: number): Promise<McpToolResult> {
  const faq = await getLatestFAQ(orgId)
  if (!faq) return textResult({ message: 'No FAQ has been generated for this organization yet.' })
  return textResult({
    week_start: faq.week_start,
    week_end: faq.week_end,
    ticket_count: faq.ticket_count,
    content: faq.content,
  })
}

// ── get_tickets ──────────────────────────────────────────────────────────

const getTicketsDef: McpToolDefinition = {
  name: 'get_tickets',
  description: 'List support tickets for the organization, optionally filtered by status, priority, or category. Returns the most recent tickets first.',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
      priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
      category: { type: 'string', enum: ['bug', 'feature_request', 'documentation', 'how_to', 'general_question'] },
      limit: { type: 'number', description: 'Max results to return (default 10, max 20)' },
    },
  },
}

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
const CATEGORIES = ['bug', 'feature_request', 'documentation', 'how_to', 'general_question'] as const

async function getTicketsTool(orgId: number, args: Record<string, unknown>): Promise<McpToolResult> {
  const limit = clampLimit(args.limit, 10)
  const status = parseEnumArg<TicketStatus>(args.status, TICKET_STATUSES)
  const priority = parseEnumArg<Priority>(args.priority, PRIORITIES)
  const category = parseEnumArg<TicketCategory>(args.category, CATEGORIES)
  if (status === null) return errorResult(`status must be one of: ${TICKET_STATUSES.join(', ')}`)
  if (priority === null) return errorResult(`priority must be one of: ${PRIORITIES.join(', ')}`)
  if (category === null) return errorResult(`category must be one of: ${CATEGORIES.join(', ')}`)

  const tickets = await getTickets({ status, priority, category }, orgId, limit)
  return textResult(
    tickets.map((t) => ({
      id: t.id,
      content: t.content,
      category: t.category,
      priority: t.priority,
      status: t.status,
      ai_summary: t.ai_summary,
      created_at: t.created_at,
    }))
  )
}

// ── create_ticket ────────────────────────────────────────────────────────

const createTicketDef: McpToolDefinition = {
  name: 'create_ticket',
  description: 'Open a new support ticket on behalf of a user. Runs the same AI triage/answer pipeline as every other channel (Discord, Slack, email) — the ticket may get auto-answered if confidence is high, otherwise it queues for human review. Use this when search_kb and generate_answer don\'t resolve the question and a human needs to see it.',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: "The user's question or issue, verbatim" },
      authorName: { type: 'string', description: 'Name/identifier of the end user this ticket is on behalf of (optional)' },
      idempotencyKey: {
        type: 'string',
        description: 'Optional caller-supplied key (e.g. a UUID). Retrying the same call with the same key returns the original ticket instead of opening a duplicate — use this if your client retries on timeout/network error.',
      },
    },
    required: ['content'],
  },
}

const MAX_IDEMPOTENCY_KEY_LEN = 200

async function createTicketTool(orgId: number, args: Record<string, unknown>): Promise<McpToolResult> {
  const content = typeof args.content === 'string' ? args.content.trim() : ''
  if (!content) return errorResult('content is required')
  if (content.length > 4000) return errorResult('content must be 4000 characters or fewer')
  const authorName = typeof args.authorName === 'string' && args.authorName.trim() ? args.authorName.trim() : 'MCP agent'

  const idempotencyKey = typeof args.idempotencyKey === 'string' ? args.idempotencyKey.trim() : ''
  if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LEN) {
    return errorResult(`idempotencyKey must be ${MAX_IDEMPOTENCY_KEY_LEN} characters or fewer`)
  }
  // The pipeline's dedup gate is keyed on messageId (getTicketByDiscordMessageId).
  // Without a caller-supplied key, every retry mints a fresh random id and the
  // gate can never fire — an agent retrying on timeout opens duplicate tickets
  // and pays for duplicate AI triage. Deriving messageId from the caller's key
  // (namespaced by org, so orgs can't collide with each other's keys) makes
  // retries land on the same ticket instead.
  const messageId = idempotencyKey
    ? `mcp-${orgId}-${idempotencyKey}`
    : `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const result = await processCommunityMessage(
    {
      messageId,
      content,
      authorId: `mcp:${orgId}`,
      authorName,
      channelId: messageId,
      platform: 'mcp',
    },
    orgId
  )
  return textResult({ ticket_id: result.ticket_id, duplicate: result.duplicate ?? false })
}

// ── generate_answer ──────────────────────────────────────────────────────

const generateAnswerDef: McpToolDefinition = {
  name: 'generate_answer',
  description: "Generate a grounded answer to a question using the organization's knowledge base, without opening a ticket. Returns the answer plus a confidence score. Counts against the org's monthly deflection limit — if the limit is reached, returns an error instead of generating for free.",
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to answer' },
    },
    required: ['question'],
  },
}

async function generateAnswer(orgId: number, args: Record<string, unknown>): Promise<McpToolResult> {
  const question = typeof args.question === 'string' ? args.question.trim() : ''
  if (!question) return errorResult('question is required')
  if (question.length > MAX_QUERY_LEN) return errorResult(`question must be ${MAX_QUERY_LEN} characters or fewer`)

  const { allowed, used, limit } = await checkDeflectionLimit(orgId)
  if (!allowed) {
    return errorResult(`Monthly deflection limit reached (${used}/${limit}). Upgrade the plan or wait for the next billing cycle before calling generate_answer again.`)
  }

  const vector = await embedText(question, orgId)
  const priorAnswers = await getKBContext(vector, 3, orgId)
  const context = priorAnswers.length
    ? `\n\nPrior resolved answers for similar questions — prefer reusing these:\n${priorAnswers.map((p, i) => `${i + 1}. Q: ${p.summary}\n   A: ${p.answer}`).join('\n')}`
    : ''

  const { text } = await generateText({
    model: await chatModel('gpt-4o', orgId),
    system: `You are a technical support agent. Answer using the knowledge base context provided. Do not invent product-specific details not present in the context — if the context doesn't cover the question, say so honestly instead of guessing. Be concise.${context}`,
    prompt: question,
  })

  const assessment = await assessAnswer(question, text, orgId).catch((err) => {
    logger.error('generate_answer assessment failed', { module: MOD, orgId, error: err })
    return { confidence: 0, answered_fully: false, reasoning: 'Assessment failed.' }
  })

  const highConfidence = shouldAutoDeflect(assessment)
  // This tool never creates a ticket/ai_assessments row like every other
  // channel does, so without this write, high-confidence generations would
  // never count toward the org's deflection limit — unmetered LLM spend.
  // Only high-confidence calls count, mirroring auto_deflected semantics on
  // tickets; a low-confidence generation still cost the LLM call but wasn't
  // a "deflection" any more than a ticket routed to human review is.
  await recordApiGeneration(orgId, highConfidence).catch((err) => {
    logger.error('recordApiGeneration failed', { module: MOD, orgId, error: err })
  })

  return textResult({
    answer: text,
    confidence: Math.round(assessment.confidence * 100),
    answered_fully: assessment.answered_fully,
    high_confidence: highConfidence,
  })
}

// ── Registry ─────────────────────────────────────────────────────────────

export const MCP_TOOLS: McpToolDefinition[] = [searchKbDef, getFaqDef, getTicketsDef, createTicketDef, generateAnswerDef]

export async function callMcpTool(name: string, args: Record<string, unknown>, orgId: number): Promise<McpToolResult> {
  try {
    switch (name) {
      case 'search_kb': return await searchKb(orgId, args)
      case 'get_faq': return await getFaq(orgId)
      case 'get_tickets': return await getTicketsTool(orgId, args)
      case 'create_ticket': return await createTicketTool(orgId, args)
      case 'generate_answer': return await generateAnswer(orgId, args)
      default: return errorResult(`Unknown tool: ${name}`)
    }
  } catch (err) {
    logger.error('MCP tool call threw', { module: MOD, tool: name, orgId, error: err })
    return errorResult('Internal error running tool')
  }
}
