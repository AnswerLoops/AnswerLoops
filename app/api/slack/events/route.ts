import { verifySlackRequest } from '@/lib/slack/verify'
import { getIntegrationByTeamId } from '@/lib/db/queries/integrations'
import { processCommunityMessage } from '@/lib/ingest/pipeline'
import { saveFeedback } from '@/lib/db/queries/feedback'
import { getTicketIdByAnswerMessage } from '@/lib/db/queries/feedback'
import { getTicketIdByCsatMessage, saveCsatRating } from '@/lib/db/queries/csat'
import { MOCK_EXTERNALS } from '@/lib/mock-mode'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

// 👍/👎 Slack reaction names that map to feedback votes
const VOTE_REACTIONS: Record<string, 'up' | 'down'> = {
  '+1': 'up',
  thumbsup: 'up',
  '-1': 'down',
  thumbsdown: 'down',
}

// 1️⃣-5️⃣ Slack reaction names → CSAT rating
const CSAT_REACTIONS: Record<string, number> = {
  one: 1, 'one!': 1,
  two: 2, 'two!': 2,
  three: 3, 'three!': 3,
  four: 4, 'four!': 4,
  five: 5, 'five!': 5,
}

function voteFromReaction(name: string): 'up' | 'down' | null {
  return VOTE_REACTIONS[name] ?? null
}

export async function POST(request: Request) {
  // Read the raw body once for both signature verification and JSON parsing
  const rawBody = await request.text()

  // URL verification challenge sent by Slack when first configuring the endpoint.
  // Must respond before any signature check is possible.
  let event: unknown
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = event as Record<string, unknown>

  // Respond to Slack's initial URL verification challenge
  if (body.type === 'url_verification') {
    return Response.json({ challenge: body.challenge })
  }

  // All other events require a valid Slack signing secret
  const teamId = (body.team_id as string | undefined) ?? null

  // Resolve org + integration by team_id
  let orgId = DEFAULT_ORG_ID
  let webhookSecret: string | null = null

  if (teamId) {
    const integration = await getIntegrationByTeamId(teamId)
    if (integration) {
      orgId = integration.org_id
      webhookSecret = integration.webhook_secret
    }
  }

  // Verify signature (skip in mock mode so e2e tests can hit this endpoint)
  if (!MOCK_EXTERNALS) {
    if (!webhookSecret) {
      return new Response('Forbidden: no integration found for team', { status: 403 })
    }
    const valid = verifySlackRequest(
      webhookSecret,
      rawBody,
      request.headers.get('x-slack-request-timestamp'),
      request.headers.get('x-slack-signature')
    )
    if (!valid) {
      return new Response('Forbidden: invalid signature', { status: 403 })
    }
  }

  if (body.type !== 'event_callback') {
    return Response.json({ ok: true })
  }

  const ev = body.event as Record<string, unknown>
  const eventType = ev?.type as string | undefined

  // --- New message → create ticket ---
  if (eventType === 'message') {
    // Ignore bot messages, message edits, deletions, and sub-type events
    if (ev.bot_id || ev.subtype) {
      return Response.json({ ok: true })
    }

    const text = (ev.text as string | undefined)?.trim()
    if (!text || text.length < 10) {
      return Response.json({ ok: true })
    }

    const channelId = ev.channel as string
    const userId = ev.user as string
    const ts = ev.ts as string       // Slack message timestamp (unique message ID)
    const threadTs = ev.thread_ts as string | undefined

    const result = await processCommunityMessage({
      messageId: ts,
      content: text,
      authorId: userId,
      authorName: userId,  // Slack doesn't include username in basic events; user ID is the identifier
      channelId,
      threadId: threadTs,
      platform: 'slack',
    }, orgId)

    return Response.json({ ok: true, ...result })
  }

  // --- Reaction → feedback vote OR CSAT rating ---
  if (eventType === 'reaction_added') {
    const reaction = ev.reaction as string | undefined
    if (!reaction) return Response.json({ ok: true })

    const item = ev.item as Record<string, unknown> | undefined
    if (!item || item.type !== 'message') return Response.json({ ok: true })

    const messageTs = item.ts as string

    // Check if this is a CSAT prompt reaction (1️⃣-5️⃣)
    const csatRating = CSAT_REACTIONS[reaction]
    if (csatRating != null) {
      const csatTicketId = await getTicketIdByCsatMessage(messageTs)
      if (csatTicketId) {
        await saveCsatRating({ ticketId: csatTicketId, orgId, rating: csatRating, platform: 'slack' })
        return Response.json({ ok: true, csat: csatRating, ticket_id: csatTicketId })
      }
    }

    // Otherwise treat as 👍/👎 feedback on answer message
    const vote = voteFromReaction(reaction)
    if (!vote) return Response.json({ ok: true })

    const ticketId = await getTicketIdByAnswerMessage(messageTs)
    if (!ticketId) return Response.json({ ok: true })

    await saveFeedback({
      ticketId,
      source: 'discord',
      vote,
      actor: ev.user as string,
    })

    return Response.json({ ok: true, ticket_id: ticketId })
  }

  return Response.json({ ok: true })
}
