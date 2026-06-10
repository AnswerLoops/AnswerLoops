import { auth } from '@/auth'

/** Returns true when the current request has a valid Auth.js session. */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth()
  return !!session?.user
}
