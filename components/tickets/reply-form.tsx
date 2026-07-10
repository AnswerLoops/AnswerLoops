'use client'

import { useActionState, useEffect, useRef } from 'react'
import { postReplyAction } from '@/app/actions/tickets'
import { Button } from '@/components/ui/button'

const PLATFORM_LABELS: Record<string, { button: string; hint: string; success: string }> = {
  github:   { button: 'Send reply to GitHub',   hint: 'Posts as a comment on the GitHub issue',          success: 'Reply posted to GitHub!' },
  slack:    { button: 'Send reply to Slack',     hint: 'Posts in the Slack thread',                      success: 'Reply sent to Slack!' },
  telegram: { button: 'Send reply to Telegram',  hint: 'Posts in the Telegram chat',                     success: 'Reply sent to Telegram!' },
  email:    { button: 'Send reply by email',     hint: 'Replies to the sender\'s email address',         success: 'Reply sent by email!' },
  discord:  { button: 'Send reply to Discord',   hint: 'Posts as "[Response from your name]" in the Discord thread', success: 'Reply sent to Discord!' },
}

export function ReplyForm({ ticketId, sourcePlatform = 'discord' }: { ticketId: number; sourcePlatform?: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, isPending] = useActionState(postReplyAction, null)
  const labels = PLATFORM_LABELS[sourcePlatform] ?? PLATFORM_LABELS.discord

  useEffect(() => {
    if (state === null && !isPending) {
      // initial or post-success
    }
  }, [state, isPending])

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Your name</label>
        <input name="staffName" type="text" placeholder="e.g. Sarah" required
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Reply</label>
        <textarea name="content" rows={4} required placeholder="Type your response to the community member…"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm resize-none" />
      </div>
      {state && 'error' in state && state.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      {state && !('error' in state) && (
        <p className="text-xs text-green-600">{labels.success}</p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Sending…' : labels.button}
        </Button>
        <p className="text-xs text-gray-400">{labels.hint}</p>
      </div>
    </form>
  )
}
