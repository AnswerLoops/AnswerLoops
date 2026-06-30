import Link from 'next/link'
import { Logo } from '@/components/logo'
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
        <div className="px-4 py-3.5 border-b border-gray-200">
          <Link href="/">
            <Logo width={120} />
          </Link>
        </div>
        <SidebarNav />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topnav */}
        <header className="h-12 shrink-0 border-b border-gray-200 bg-white flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Website
            </Link>
            <div className="h-4 w-px bg-gray-200" />
            <NotificationBell unreadCount={unreadCount} />
            <form action={logout}>
              <button
                type="submit"
                className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
