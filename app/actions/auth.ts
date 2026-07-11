'use server'

import { headers } from 'next/headers'
import { signIn, signOut } from '@/auth'

async function getCallbackUrl(): Promise<string> {
  const hdrs = await headers()
  const referer = hdrs.get('referer') ?? ''
  try {
    const url = new URL(referer)
    const cb = url.searchParams.get('callbackUrl')
    // Only allow same-origin relative paths to prevent open-redirect
    if (cb && cb.startsWith('/') && !cb.startsWith('//')) return cb
  } catch {
    // ignore
  }
  return '/dashboard'
}

export async function loginWithGoogle(): Promise<void> {
  await signIn('google', { redirectTo: await getCallbackUrl() })
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}
