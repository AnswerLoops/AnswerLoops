import { generateObject } from 'ai'
import { chatModel, DEFAULT_FAST_MODEL } from '@/lib/ai/models'
import { z } from 'zod'

export const ASSESS_MODEL = DEFAULT_FAST_MODEL

// At/above this confidence AND a fully-answered question, the answer is posted
// as a real answer to the community instead of a "team will follow up" draft.
export const AUTO_DEFLECT_THRESHOLD = 0.8

const AssessmentSchema = z.object({
  confidence: z.number().min(0).max(1),
  answered_fully: z.boolean(),
  reasoning: z.string().max(400),
})

export interface AnswerAssessment {
  confidence: number
  answered_fully: boolean
  reasoning: string
}

/**
 * Judge an AI-generated answer against the original question. Used as a second
 * pass — a different prompt grading the first pass's output — to decide whether
 * the answer is safe to auto-deflect or needs a human.
 */
export async function assessAnswer(question: string, answer: string, orgId?: number): Promise<AnswerAssessment> {
  const { object } = await generateObject({
    model: await chatModel(ASSESS_MODEL, orgId),
    schema: AssessmentSchema,
    prompt: `You are a strict reviewer grading a support answer before it is sent to a community member.

Question:
${question}

Proposed answer:
${answer}

Grade the answer:
- confidence: 0.0–1.0 how correct, specific, and trustworthy the answer is. Be conservative: vague, hedging, "I couldn't find", or generic answers score low (< 0.5). Only score above 0.8 when the answer is concrete, directly addresses the question, and is well-grounded (cites code, files, or a known resolution).
- answered_fully: true only if the answer actually resolves the question with no major gaps or open follow-ups.
- reasoning: one or two sentences justifying the score.`,
  })

  return object
}

export function shouldAutoDeflect(a: AnswerAssessment): boolean {
  return a.confidence >= AUTO_DEFLECT_THRESHOLD && a.answered_fully
}
