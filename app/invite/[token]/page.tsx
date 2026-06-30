import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getInvitationByToken } from '@/lib/db/queries/invitations'
import { getOrg } from '@/lib/db/queries/orgs'
import { getDb } from '@/lib/db/drizzle'
import { users } from '@/lib/db/schema'
import { acceptInviteAction } from '@/app/actions/invitations'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'This invite link is invalid or has already been used.',
  expired: 'This invite link has expired. Ask the workspace admin to send a new one.',
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { token } = await params
  const { error } = await searchParams
  const session = await auth()

  if (!session?.user) {
    redirect(`/login?callbackUrl=/invite/${token}`)
  }

  if (error) {
    return (
      <InviteShell>
        <ErrorCard message={ERROR_MESSAGES[error] ?? 'Something went wrong with this invite.'} />
      </InviteShell>
    )
  }

  const invite = await getInvitationByToken(token)

  if (!invite || invite.accepted_at) {
    return <InviteShell><ErrorCard message={ERROR_MESSAGES.invalid} /></InviteShell>
  }

  if (invite.expires_at < new Date().toISOString()) {
    return <InviteShell><ErrorCard message={ERROR_MESSAGES.expired} /></InviteShell>
  }

  const org = await getOrg(invite.org_id)
  const inviter = invite.invited_by
    ? (await getDb()
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, invite.invited_by))
        .limit(1))[0] ?? null
    : null

  const boundAction = acceptInviteAction.bind(null, token)

  return (
    <InviteShell>
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xl font-bold mx-auto">
            {org?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <h1 className="text-base font-semibold text-gray-900 mt-3">
            You've been invited to join{' '}
            <span className="text-brand-600">{org?.name ?? 'a workspace'}</span>
          </h1>
          {inviter && (
            <p className="text-sm text-gray-500">
              Invited by {inviter.name ?? inviter.email}
            </p>
          )}
          <p className="text-xs text-gray-400">
            You'll join as <span className="font-medium capitalize">{invite.role}</span>
          </p>
        </div>

        <form action={boundAction}>
          <Button type="submit" className="w-full">
            Accept invitation
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Signed in as <span className="font-medium">{session.user.email}</span>
        </p>
      </div>
    </InviteShell>
  )
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <span className="text-sm font-bold text-brand-600 tracking-tight">AnswerLoops</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-red-50 border border-red-200 p-4">
        <p className="text-sm text-red-700">{message}</p>
      </div>
      <a href="/dashboard" className="block text-center text-sm text-brand-600 hover:underline">
        Go to dashboard
      </a>
    </div>
  )
}
