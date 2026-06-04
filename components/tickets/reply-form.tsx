'use client'

import { useActionState, useEffect, useRef } from 'react'
import { postReplyAction } from '@/app/actions/tickets'
import { Button } from '@/components/ui/button'

export function ReplyForm({ ticketId }: { ticketId: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, isPending] = useActionState(postReplyAction, null)

  // Reset form after successful submit
  useEffect(() => {
    if (state === null && !isPending) {
      // initial or post-success — don't reset on initial render
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
        <p className="text-xs text-green-600">Reply sent to Discord!</p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send reply to Discord'}
        </Button>
        <p className="text-xs text-gray-400">Posts as &quot;[Response from your name]&quot; in the Discord thread</p>
      </div>
    </form>
  )
}
