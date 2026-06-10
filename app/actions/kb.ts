'use server'

import { z } from 'zod'
import { refresh } from 'next/cache'
import { getTicketById } from '@/lib/db/queries/tickets'
import { createArticle } from '@/lib/db/queries/kb'
import { embedText, EMBEDDING_MODEL } from '@/lib/ai/embed'

const PromoteSchema = z.object({ ticketId: z.coerce.number() })

/**
 * Promote a resolved ticket's answer into the knowledge base: embed the Q+A and
 * store it as a published, searchable article. Re-promoting refreshes it.
 */
export async function promoteToKBAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const parsed = PromoteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid input' }

  const ticket = getTicketById(parsed.data.ticketId)
  if (!ticket) return { error: 'Ticket not found' }
  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    return { error: 'Only resolved tickets can be promoted' }
  }

  const answer = ticket.resolution_notes || ticket.ai_draft
  if (!answer) return { error: 'Ticket has no answer to promote' }
  const question = ticket.ai_summary ?? ticket.content.slice(0, 200)

  try {
    const embedding = await embedText(`${question}\n\n${answer}`)
    createArticle({ question, answer, embedding, model: EMBEDDING_MODEL, sourceTicketId: ticket.id })
  } catch (err) {
    return { error: String(err) }
  }

  refresh()
  return null
}
