import Link from 'next/link'
import { getUnreadCount } from '@/lib/db/queries/notifications'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { AutoRefresh } from '@/components/auto-refresh'

export const dynamic = 'force-dynamic'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tickets', label: 'Tickets' },
  { href: '/faq', label: 'FAQ' },
  { href: '/settings', label: 'Settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const unreadCount = getUnreadCount()

  return (
    <div className="flex h-screen bg-gray-50">
      <AutoRefresh intervalMs={5000} />
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <span className="text-sm font-bold text-indigo-600 tracking-tight">Community Platform</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topnav */}
        <header className="h-12 shrink-0 border-b border-gray-200 bg-white flex items-center justify-end px-6 gap-4">
          <NotificationBell unreadCount={unreadCount} />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
