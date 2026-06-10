'use client'

import { loginWithDiscord, loginWithGoogle } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { useTransition } from 'react'

export function LoginForm() {
  const [discordPending, startDiscord] = useTransition()
  const [googlePending, startGoogle] = useTransition()

  return (
    <div className="space-y-3">
      <form
        action={() => {
          startDiscord(() => loginWithDiscord())
        }}
      >
        <Button type="submit" disabled={discordPending} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
          {discordPending ? 'Redirecting…' : 'Continue with Discord'}
        </Button>
      </form>

      <form
        action={() => {
          startGoogle(() => loginWithGoogle())
        }}
      >
        <Button type="submit" disabled={googlePending} variant="secondary" className="w-full">
          {googlePending ? 'Redirecting…' : 'Continue with Google'}
        </Button>
      </form>
    </div>
  )
}
