import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

interface TicketSummary {
  id: number
  content: string
  category: string | null
  ai_summary: string | null
  resolution_notes: string | null
}

function groupByCategory(tickets: TicketSummary[]) {
  const groups: Record<string, TicketSummary[]> = {}
  for (const t of tickets) {
    const key = t.category ?? 'general_question'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return groups
}

function formatForPrompt(tickets: TicketSummary[]): string {
  const groups = groupByCategory(tickets)
  return Object.entries(groups)
    .map(([category, items]) => {
      const label = category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      const lines = items.map((t, i) =>
        `  ${i + 1}. Q: ${t.ai_summary ?? t.content.slice(0, 120)}\n     Resolution: ${t.resolution_notes ?? 'resolved by team'}`
      )
      return `## ${label}\n${lines.join('\n')}`
    })
    .join('\n\n')
}

export async function generateFAQ(tickets: TicketSummary[]): Promise<string> {
  if (tickets.length === 0) {
    return '# FAQ\n\nNo resolved tickets this week.'
  }

  const context = formatForPrompt(tickets)

  const { text } = await generateText({
    model: openai('gpt-4o'),
    maxOutputTokens: 3000,
    prompt: `You are a technical writer creating a community FAQ from resolved support tickets.

Below are resolved tickets from this week, grouped by category. Write a clean, structured FAQ with:
- A markdown header for each category
- Clear, concise Q&A pairs
- Actionable answers that help future users self-serve
- No ticket numbers or internal references

Resolved tickets this week:
${context}`,
  })

  return text
}
