import { generateText, tool, stepCountIs } from 'ai'
import { chatModel } from '@/lib/ai/models'
import { z } from 'zod'
import { searchCode, readFile, listFiles } from '@/lib/github/tools'
import { getConfiguredRepos } from '@/lib/github/app'
import { updateTicketAIDraft } from '@/lib/db/queries/tickets'
import { createNotification } from '@/lib/db/queries/notifications'
import { saveAssessment } from '@/lib/db/queries/assessments'
import { mapAnswerMessage } from '@/lib/db/queries/feedback'
import { assessAnswer, shouldAutoDeflect, ASSESS_MODEL } from '@/lib/ai/assess'
import { sendToChannel } from '@/lib/discord/send'
import { sendToSlackChannel } from '@/lib/slack/send'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import type { PriorAnswer } from '@/types'

type Platform = 'discord' | 'slack'

async function postReply(channelId: string, content: string, orgId: number, platform: Platform): Promise<string | null> {
  return platform === 'slack'
    ? sendToSlackChannel(channelId, content, orgId)
    : sendToChannel(channelId, content, orgId)
}

export async function runAIAgent(
  ticketId: number,
  question: string,
  channelId: string,
  priorAnswers: PriorAnswer[] = [],
  orgId = DEFAULT_ORG_ID,
  platform: Platform = 'discord'
): Promise<void> {
  const repos = await getConfiguredRepos()

  if (repos.length === 0) {
    console.log('[agent] No GitHub repos configured — skipping AI agent answer')
    return
  }

  const repoList = repos.join(', ')

  // Prior resolved answers for similar questions — prefer reusing these.
  const priorContext = priorAnswers.length
    ? `\n\nThe team has already answered similar questions before. Prefer reusing and adapting these resolved answers when they fit; only search the source code if they don't fully cover the question:\n${priorAnswers
        .map((p, i) => `${i + 1}. Q: ${p.summary}\n   A: ${p.answer}`)
        .join('\n')}`
    : ''

  try {
    const { text } = await generateText({
      model: await chatModel('gpt-4o', orgId),
      stopWhen: stepCountIs(5),
      system: `You are a technical support agent for an open source software project.
You have tools to search and read the project source code on GitHub.
Configured repositories: ${repoList}

Guidelines:
- If a prior resolved answer below already covers the question, reuse and adapt it instead of searching
- Otherwise search the source code before answering
- Cite specific files and relevant code when applicable
- Be concise, accurate, and helpful
- If you cannot find relevant code, say so honestly
- Format your answer in markdown for Discord${priorContext}`,
      prompt: question,
      tools: {
        searchCode: tool({
          description: 'Search for code, functions, or patterns in the configured repositories',
          inputSchema: z.object({
            query: z.string().describe('Search query — use function names, error messages, or keywords'),
            repo: z.string().describe(`Repository in owner/repo format. Available: ${repoList}`),
          }),
          execute: async (args) => searchCode(args.query, args.repo),
        }),
        readFile: tool({
          description: 'Read the full contents of a specific file from a repository',
          inputSchema: z.object({
            path: z.string().describe('File path relative to repo root, e.g. src/auth/index.ts'),
            repo: z.string().describe(`Repository in owner/repo format. Available: ${repoList}`),
            ref: z.string().optional().describe('Branch name or commit SHA (default: main)'),
          }),
          execute: async (args) => readFile(args.path, args.repo, args.ref),
        }),
        listFiles: tool({
          description: 'List files and directories at a path in a repository',
          inputSchema: z.object({
            path: z.string().describe('Directory path, e.g. src/components or empty string for root'),
            repo: z.string().describe(`Repository in owner/repo format. Available: ${repoList}`),
          }),
          execute: async (args) => listFiles(args.path, args.repo),
        }),
      },
    })

    // Store the draft on the ticket
    await updateTicketAIDraft(ticketId, text)

    // Second pass: grade the answer to decide whether it can be auto-deflected.
    let assessment
    try {
      assessment = await assessAnswer(question, text, orgId)
    } catch (err) {
      console.error('[agent] assessment failed for ticket', ticketId, '— defaulting to human review', err)
      assessment = { confidence: 0, answered_fully: false, reasoning: 'Assessment failed; routed to human review.' }
    }

    const autoDeflect = shouldAutoDeflect(assessment)
    const pct = Math.round(assessment.confidence * 100)

    await saveAssessment({
      ticketId,
      confidence: assessment.confidence,
      answeredFully: assessment.answered_fully,
      autoDeflected: autoDeflect,
      reasoning: assessment.reasoning,
      model: ASSESS_MODEL,
    })

    let postedMessageId: string | null = null
    if (autoDeflect) {
      // High confidence: answer the community directly (deflection).
      await createNotification('ai_draft_ready', `Auto-answered (${pct}%) — ticket #${ticketId}`, ticketId)
      const message = `${text}\n\n*Was this helpful? React 👍 / 👎. If it didn't fully answer your question, a team member will follow up.*`
      postedMessageId = await postReply(channelId, message, orgId, platform)
    } else {
      // Low confidence: post as a draft and flag for human review.
      await createNotification('ai_draft_ready', `Needs review (${pct}%) — ticket #${ticketId}`, ticketId)
      const message = `**[AI Draft Answer]**\n${text}\n\n*A team member will follow up shortly.*`
      postedMessageId = await postReply(channelId, message, orgId, platform)
    }

    // Map the posted answer message → ticket so 👍/👎 reactions can be attributed.
    if (postedMessageId) await mapAnswerMessage(postedMessageId, ticketId)
  } catch (err) {
    console.error('[agent] AI agent failed for ticket', ticketId, err)
  }
}
