'use server'

import crypto from 'crypto'
import { redirect } from 'next/navigation'
import { createSession, destroySession } from '@/lib/auth/session'

export type LoginState = { error?: string } | undefined

function passwordMatches(input: string): boolean {
  const expected = process.env.STAFF_PASSWORD
  if (!expected) {
    throw new Error('STAFF_PASSWORD is not set')
  }
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  // Length check first; timingSafeEqual throws on length mismatch.
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get('password')
  if (typeof password !== 'string' || password.length === 0) {
    return { error: 'Password is required.' }
  }

  if (!passwordMatches(password)) {
    return { error: 'Incorrect password.' }
  }

  await createSession()
  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/login')
}
