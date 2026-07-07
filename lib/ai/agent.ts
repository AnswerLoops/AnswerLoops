import { generateText, tool, stepCountIs } from 'ai'
import { chatModel } from '@/lib/ai/models'
import { z } from 'zod'
import { searchCode, readFile, listFiles } from '@/lib/github/tools'
import { getConfiguredRepos } from '@/lib/github/app'
import { updateTicketAIDraft } from '@/lib/db/queries/tickets'
import { createNotification } from '@/lib/db/queries/notifications'
import { saveAssessment } from '@/lib/db/queries/assessments'
import { mapAnswerMessage } from '@/lib/db/queries/feedback'
import { mapCsatMessage } from '@/lib/db/queries/csat'
import { assessAnswer, shouldAutoDeflect, ASSESS_MODEL } from '@/lib/ai/assess'
import { sendToChannel } from '@/lib/discord/send'
import { sendToSlackChannel } from '@/lib/slack/send'
import { sendToTelegramChat } from '@/lib/telegram/send'
import { sendEmailReply } from '@/lib/email/reply'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { checkDeflectionLimit } from '@/lib/billing/usage'
import { getIntegration } from '@/lib/db/queries/integrations'
import { updateTicketAIDraftStatus } from '@/lib/db/queries/tickets'
import { logger } from '@/lib/logger'
import type { PriorAnswer } from '@/types'

const MOD = 'ai/agent'

type Platform = 'discord' | 'slack' | 'telegram' | 'email' | 'github'

async function postReply(channelId: string, content: string, orgId: number, platform: Platform): Promise<string | null> {
  if (platform === 'slack') return sendToSlackChannel(channelId, content, orgId)
  if (platform === 'telegram') return sendToTelegramChat(channelId, content, orgId)
  if (platform === 'email') return sendEmailReply(channelId, content, orgId)
  return sendToChannel(channelId, content, orgId)
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
    logger.info('no GitHub repos configured — skipping agent', { module: MOD, ticketId })
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
    const t0 = Date.now()
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
- Format your answer in markdown for Discord
- Respond in the same language as the question — if the user wrote in Spanish, reply in Spanish; French, reply in French; etc.${priorContext}`,
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

    logger.info('agent answer generated', { module: MOD, ticketId, durationMs: Date.now() - t0 })
    await updateTicketAIDraft(ticketId, text)

    let assessment
    try {
      assessment = await assessAnswer(question, text, orgId)
    } catch (err) {
      logger.error('assessment failed — defaulting to human review', { module: MOD, ticketId, error: err })
      assessment = { confidence: 0, answered_fully: false, reasoning: 'Assessment failed; routed to human review.' }
    }

    let autoDeflect = shouldAutoDeflect(assessment)
    const pct = Math.round(assessment.confidence * 100)

    if (autoDeflect) {
      const { allowed } = await checkDeflectionLimit(orgId)
      if (!allowed) {
        autoDeflect = false
        logger.warn('deflection limit reached — routing to human review', { module: MOD, ticketId, orgId })
      }
    }

    await saveAssessment({
      ticketId,
      confidence: assessment.confidence,
      answeredFully: assessment.answered_fully,
      autoDeflected: autoDeflect,
      reasoning: assessment.reasoning,
      model: ASSESS_MODEL,
    })

    logger.info('assessment complete', { module: MOD, ticketId, confidence: pct, autoDeflect })

    // Load escalation config for this platform (github has no integrations row — returns null)
    const integration = platform === 'github' ? null : await getIntegration(orgId, platform as Exclude<Platform, 'github'>).catch(() => null)
    const escalationRoleId = integration?.escalation_role_id ?? null

    let postedMessageId: string | null = null
    if (autoDeflect) {
      await createNotification('ai_draft_ready', `Auto-answered (${pct}%) — ticket #${ticketId}`, ticketId)
      const message = `${text}\n\n*React 👍 / 👎 if this helped. A team member will follow up if not.*`
      postedMessageId = await postReply(channelId, message, orgId, platform)

      // Post CSAT prompt as follow-up and store its message ID
      const csatPrompt = `*How would you rate this answer?*\n1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣\n_(React with a number to rate)_`
      const csatMessageId = await postReply(channelId, csatPrompt, orgId, platform)
      if (csatMessageId) await mapCsatMessage(csatMessageId, ticketId)

      logger.info('auto-deflected', { module: MOD, ticketId, confidence: pct, platform })
    } else {
      await createNotification('ai_draft_ready', `Needs human review (${pct}%) — ticket #${ticketId}`, ticketId)
      await updateTicketAIDraftStatus(ticketId, 'needs_human')

      // Build escalation mention if a role/group is configured
      let escalationMention = ''
      if (escalationRoleId) {
        if (platform === 'discord') {
          escalationMention = `\n\n<@&${escalationRoleId}> this question needs human review (AI confidence: ${pct}%)`
        } else if (platform === 'slack') {
          // Slack: S = user group, U = user, else raw
          if (escalationRoleId.startsWith('S')) {
            escalationMention = `\n\n<!subteam^${escalationRoleId}> this question needs human review (AI confidence: ${pct}%)`
          } else if (escalationRoleId.startsWith('U')) {
            escalationMention = `\n\n<@${escalationRoleId}> this question needs human review (AI confidence: ${pct}%)`
          } else {
            escalationMention = `\n\n${escalationRoleId} this question needs human review (AI confidence: ${pct}%)`
          }
        } else if (platform === 'email') {
          // Email: note escalation contact in reply body (can't @mention)
          escalationMention = `\n\nThis question has been flagged for human review (AI confidence: ${pct}%). ${escalationRoleId} will follow up.`
        } else {
          // Telegram: plain text mention
          escalationMention = `\n\n@${escalationRoleId} this question needs human review (AI confidence: ${pct}%)`
        }
      }

      const message = `**[Needs Human Review — ${pct}% confidence]**\n${text}\n\n*A team member will follow up shortly.*${escalationMention}`
      postedMessageId = await postReply(channelId, message, orgId, platform)
      logger.info('routed to human review', { module: MOD, ticketId, confidence: pct, platform, escalated: !!escalationRoleId })
    }

    if (postedMessageId) await mapAnswerMessage(postedMessageId, ticketId)
  } catch (err) {
    logger.error('agent failed', { module: MOD, ticketId, error: err })
  }
}
