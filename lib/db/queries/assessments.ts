import { eq } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { aiAssessments } from '../schema'
import type { AIAssessment } from '@/types'

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function saveAssessment(input: {
  ticketId: number
  confidence: number
  answeredFully: boolean
  autoDeflected: boolean
  reasoning: string
  model: string
}): void {
  dz()
    .insert(aiAssessments)
    .values({
      ticketId: input.ticketId,
      confidence: input.confidence,
      answeredFully: input.answeredFully ? 1 : 0,
      autoDeflected: input.autoDeflected ? 1 : 0,
      reasoning: input.reasoning,
      model: input.model,
    })
    .onConflictDoUpdate({
      target: aiAssessments.ticketId,
      set: {
        confidence: input.confidence,
        answeredFully: input.answeredFully ? 1 : 0,
        autoDeflected: input.autoDeflected ? 1 : 0,
        reasoning: input.reasoning,
        model: input.model,
      },
    })
    .run()
}

export function getAssessment(ticketId: number): AIAssessment | null {
  return (raw().prepare('SELECT * FROM ai_assessments WHERE ticket_id = ?').get(ticketId) as AIAssessment) ?? null
}
