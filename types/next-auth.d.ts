import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    /** Active org for this session. Defaults to 1 (Default Workspace). */
    orgId: number
    user: {
      id: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    orgId?: number
    userId?: string
  }
}
