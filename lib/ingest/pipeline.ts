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
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/retry'
import type { Priority } from '@/types'

export type Platform = 'discord' | 'slack'

export interface MessagePayload {
  messageId: string
  content: string
  authorId: string
  authorName: string
  guildId?: string
  channelId: string
  threadId?: string
  platform?: Platform
}

export interface PipelineResult {
  ticket_id: number
  duplicate?: boolean
}

const MOD = 'ingest/pipeline'

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
  const { messageId, content, authorId, authorName, guildId, channelId, threadId, platform = 'discord' } = payload

  const existing = await getTicketByDiscordMessageId(messageId)
  if (existing) {
    logger.debug('duplicate message — skipping', { module: MOD, ticketId: existing.id, messageId })
    return { ticket_id: existing.id, duplicate: true }
  }

  const t0 = Date.now()
  const triage = await withRetry(() => triageMessage(content, orgId), 'triage', { module: MOD })
  const priority = severityToPriority(triage.severity_score)
  logger.info('triage complete', {
    module: MOD,
    orgId,
    category: triage.category,
    priority,
    severity: triage.severity_score,
    durationMs: Date.now() - t0,
  })

  const { sla_response_deadline, sla_resolve_deadline } = await calculateDeadlines(priority)

  const ticket = await createTicket({
    discord_message_id: messageId,
    discord_guild_id: guildId,
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

  logger.info('ticket created', { module: MOD, ticketId: ticket.id, orgId, platform })

  await createNotification(
    'new_question',
    `New ${triage.category.replace('_', ' ')} from ${authorName}: ${triage.summary}`,
    ticket.id,
    orgId
  )

  after(async () => {
    try {
      // Notifications — non-blocking failures
      try {
        await sendPushToAll({
          title: 'New Community Question',
          body: `${authorName}: ${triage.summary}`,
          url: `/tickets/${ticket.id}`,
        })
      } catch (err) {
        logger.warn('push notification failed', { module: MOD, ticketId: ticket.id, error: err })
      }

      try {
        await sendNewTicketEmail(ticket, orgId)
      } catch (err) {
        logger.warn('new ticket email failed', { module: MOD, ticketId: ticket.id, error: err })
      }

      try {
        const breached = await checkSlaBreaches()
        await sendSlaBreachEmails(breached, orgId)
      } catch (err) {
        logger.warn('SLA breach check/email failed', { module: MOD, ticketId: ticket.id, error: err })
      }

      // Semantic enrichment
      let priorAnswers: { summary: string; answer: string }[] = []
      try {
        const t1 = Date.now()
        const vector = await withRetry(
          () => embedText(`${triage.summary}\n\n${content}`, orgId),
          'embed',
          { module: MOD, ticketId: ticket.id }
        )
        await saveEmbedding(ticket.id, vector, EMBEDDING_MODEL)
        logger.info('embedding saved', { module: MOD, ticketId: ticket.id, durationMs: Date.now() - t1 })

        const candidates = await getCandidateVectors(ticket.id)
        const related = findRelated(vector, candidates)
        await replaceLinks(ticket.id, related)
        logger.debug('related links updated', { module: MOD, ticketId: ticket.id, relatedCount: related.length })

        const duplicates = related.filter((m) => isDuplicate(m.score))
        if (duplicates.length > 0) {
          logger.info('possible duplicate detected', { module: MOD, ticketId: ticket.id, duplicateCount: duplicates.length })
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
        logger.debug('prior answers loaded', { module: MOD, ticketId: ticket.id, count: priorAnswers.length })
      } catch (err) {
        logger.error('semantic enrichment failed', { module: MOD, ticketId: ticket.id, error: err })
      }

      // AI agent
      await withRetry(
        () => runAIAgent(ticket.id, content, threadId ?? channelId, priorAnswers, orgId, platform),
        'AI agent',
        { module: MOD, ticketId: ticket.id }
      )
    } catch (err) {
      logger.error('after() job failed unexpectedly', { module: MOD, ticketId: ticket.id, error: err })
    }
  })

  return { ticket_id: ticket.id }
}
