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
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <span className="text-sm font-bold text-indigo-600 tracking-tight">Community Platform</span>
          <h1 className="mt-2 text-lg font-semibold text-gray-900">Staff sign in</h1>
          <p className="mt-1 text-sm text-gray-500">Enter the staff password to continue.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
