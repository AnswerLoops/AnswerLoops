import Link from 'next/link'
import { getUnreadCount } from '@/lib/db/queries/notifications'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { AutoRefresh } from '@/components/auto-refresh'
import { SidebarNav } from '@/components/sidebar-nav'
import { logout } from '@/app/actions/auth'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const unreadCount = await getUnreadCount()

  return (
    <div className="flex h-screen bg-gray-50">
      <AutoRefresh intervalMs={5000} />
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <Link href="/" className="text-sm font-bold text-indigo-600 tracking-tight hover:text-indigo-700 transition-colors">
            Source Loop
          </Link>
        </div>
        <SidebarNav />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topnav */}
        <header className="h-12 shrink-0 border-b border-gray-200 bg-white flex items-center justify-end px-6 gap-4">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Website</Link>
          <NotificationBell unreadCount={unreadCount} />
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
