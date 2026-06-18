import { after } from 'next/server'
import { triageMessage } from '@/lib/ai/triage'
import { createTicket, getTicketByDiscordMessageId } from '@/lib/db/queries/tickets'
import { createNotification } from '@/lib/db/queries/notifications'
import { calculateDeadlines, checkSlaBreaches } from '@/lib/sla/engine'
import { sendPushToAll } from '@/lib/push/notify'
import { sendNewTicketEmail, sendSlaBreachEmails } from '@/lib/email/send'
import { runAIAgent } from '@/lib/ai/agent'
import { embedText, EMBEDDING_MODEL } from '@/lib/ai/embed'
import { findRelated, isDuplicate } from '@/lib/ai/related'
import { saveEmbedding, getCandidateVectors, replaceLinks, getPriorAnswers } from '@/lib/db/queries/embeddings'
import { getKBContext } from '@/lib/db/queries/kb'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import type { Priority } from '@/types'

export type Platform = 'discord' | 'slack'

export interface MessagePayload {
  messageId: string
  content: string
  authorId: string
  authorName: string
  channelId: string
  threadId?: string
  platform?: Platform
}

export interface PipelineResult {
  ticket_id: number
  duplicate?: boolean
}

function severityToPriority(score: number): Priority {
  if (score >= 0.9) return 'critical'
  if (score >= 0.6) return 'high'
  if (score >= 0.3) return 'medium'
  return 'low'
}

export async function processCommunityMessage(
  payload: MessagePayload,
  orgId = DEFAULT_ORG_ID
): Promise<PipelineResult> {
  const { messageId, content, authorId, authorName, channelId, threadId, platform = 'discord' } = payload

  const existing = await getTicketByDiscordMessageId(messageId)
  if (existing) {
    return { ticket_id: existing.id, duplicate: true }
  }

  const triage = await triageMessage(content, orgId)
  const priority = severityToPriority(triage.severity_score)
  const { sla_response_deadline, sla_resolve_deadline } = await calculateDeadlines(priority)

  const ticket = await createTicket({
    discord_message_id: messageId,
    discord_channel_id: channelId,
    discord_thread_id: threadId,
    discord_author_id: authorId,
    discord_author_name: authorName,
    content,
    category: triage.category,
    severity_score: triage.severity_score,
    ai_summary: triage.summary,
    ai_suggested_priority: triage.suggested_priority,
    priority,
    sla_response_deadline: sla_response_deadline ?? undefined,
    sla_resolve_deadline: sla_resolve_deadline ?? undefined,
  }, orgId)

  await createNotification(
    'new_question',
    `New ${triage.category.replace('_', ' ')} from ${authorName}: ${triage.summary}`,
    ticket.id,
    orgId
  )

  after(async () => {
    await sendPushToAll({
      title: 'New Community Question',
      body: `${authorName}: ${triage.summary}`,
      url: `/tickets/${ticket.id}`,
    })

    await sendNewTicketEmail(ticket, orgId)

    const breached = await checkSlaBreaches()
    await sendSlaBreachEmails(breached, orgId)

    let priorAnswers: { summary: string; answer: string }[] = []
    try {
      const vector = await embedText(`${triage.summary}\n\n${content}`, orgId)
      await saveEmbedding(ticket.id, vector, EMBEDDING_MODEL)

      const candidates = await getCandidateVectors(ticket.id)
      const related = findRelated(vector, candidates)
      await replaceLinks(ticket.id, related)

      const duplicates = related.filter((m) => isDuplicate(m.score))
      if (duplicates.length > 0) {
        await createNotification(
          'new_question',
          `Possible duplicate (asked ${duplicates.length + 1}×): ${triage.summary}`,
          ticket.id,
          orgId
        )
      }

      priorAnswers = [
        ...await getKBContext(vector, 3, orgId),
        ...await getPriorAnswers(related.map((m) => m.related_id), orgId),
      ]
    } catch (err) {
      console.error('[ingest] semantic enrichment failed for ticket', ticket.id, err)
    }

    await runAIAgent(ticket.id, content, threadId ?? channelId, priorAnswers, orgId, platform)
  })

  return { ticket_id: ticket.id }
}
