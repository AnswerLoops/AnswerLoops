import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { TriageResult } from '@/types'

const TriageSchema = z.object({
  category: z.enum(['critical_bug', 'bug', 'feature_request', 'general_question']),
  severity_score: z.number().min(0).max(1),
  summary: z.string().max(200),
  suggested_priority: z.enum(['critical', 'high', 'medium', 'low']),
  reasoning: z.string().max(400),
})

export async function triageMessage(content: string): Promise<TriageResult> {
  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: TriageSchema,
    prompt: `You are a support triage assistant for a software product community.
Classify this community question or report and assess its severity.

Severity score guide:
- 0.0–0.2: trivial question or minor inconvenience
- 0.3–0.5: moderate bug or commonly needed feature
- 0.6–0.8: significant bug affecting multiple users or key feature request
- 0.9–1.0: production-down, data loss, or security issue

Message:
${content}`,
  })

  return {
    category: object.category,
    severity_score: object.severity_score,
    summary: object.summary,
    suggested_priority: object.suggested_priority,
    reasoning: object.reasoning,
  }
}
