import { generateText, tool, stepCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { searchCode, readFile, listFiles } from '@/lib/github/tools'
import { getConfiguredRepos } from '@/lib/github/app'
import { updateTicketAIDraft } from '@/lib/db/queries/tickets'
import { createNotification } from '@/lib/db/queries/notifications'
import { sendToChannel } from '@/lib/discord/send'
import type { PriorAnswer } from '@/types'

export async function runAIAgent(
  ticketId: number,
  question: string,
  channelId: string,
  priorAnswers: PriorAnswer[] = []
): Promise<void> {
  const repos = getConfiguredRepos()

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
      model: openai('gpt-4o'),
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
    updateTicketAIDraft(ticketId, text)

    // Create in-app notification
    createNotification('ai_draft_ready', `AI draft answer ready for ticket #${ticketId}`, ticketId)

    // Post to Discord
    const discordMessage = `**[AI Draft Answer]**\n${text}\n\n*A team member will follow up shortly.*`
    await sendToChannel(channelId, discordMessage)
  } catch (err) {
    console.error('[agent] AI agent failed for ticket', ticketId, err)
  }
}
