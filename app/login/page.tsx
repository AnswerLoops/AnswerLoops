import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth/session'
import { LoginForm } from '@/components/login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          {/* Logo / wordmark */}
          <div className="mb-8 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 mb-3">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Community Platform</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to your workspace</p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-gray-400">
            By continuing, you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  )
}
