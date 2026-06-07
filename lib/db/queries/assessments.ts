import { getDb } from '../index'
import type { AIAssessment } from '@/types'

export function saveAssessment(input: {
  ticketId: number
  confidence: number
  answeredFully: boolean
  autoDeflected: boolean
  reasoning: string
  model: string
}): void {
  getDb().prepare(`
    INSERT INTO ai_assessments (ticket_id, confidence, answered_fully, auto_deflected, reasoning, model)
    VALUES (@ticket_id, @confidence, @answered_fully, @auto_deflected, @reasoning, @model)
    ON CONFLICT(ticket_id) DO UPDATE SET
      confidence = excluded.confidence,
      answered_fully = excluded.answered_fully,
      auto_deflected = excluded.auto_deflected,
      reasoning = excluded.reasoning,
      model = excluded.model
  `).run({
    ticket_id: input.ticketId,
    confidence: input.confidence,
    answered_fully: input.answeredFully ? 1 : 0,
    auto_deflected: input.autoDeflected ? 1 : 0,
    reasoning: input.reasoning,
    model: input.model,
  })
}

export function getAssessment(ticketId: number): AIAssessment | null {
  return (getDb()
    .prepare('SELECT * FROM ai_assessments WHERE ticket_id = ?')
    .get(ticketId) as AIAssessment) ?? null
}
