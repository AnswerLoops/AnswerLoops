'use server'

import { signIn, signOut } from '@/auth'

export async function loginWithGitHub(): Promise<void> {
  await signIn('github', { redirectTo: '/dashboard' })
}

export async function loginWithGoogle(): Promise<void> {
  await signIn('google', { redirectTo: '/dashboard' })
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}
