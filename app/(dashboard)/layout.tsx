import Link from 'next/link'
import { Logo } from '@/components/logo'
import { getUnreadCount } from '@/lib/db/queries/notifications'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { AutoRefresh } from '@/components/auto-refresh'
import { SidebarNav } from '@/components/sidebar-nav'
import { MobileDrawer } from '@/components/ui/mobile-drawer'
import { logout } from '@/app/actions/auth'
import { auth } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const unreadCount = await getUnreadCount(session?.orgId ?? DEFAULT_ORG_ID)

  const sidebarContent = (
    <>
      <div className="px-4 py-4 border-b border-border">
        <Link href="/" className="block">
          <div className="rounded-xl overflow-hidden w-fit">
            <Logo width={116} />
          </div>
        </Link>
      </div>
      <SidebarNav />
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <AutoRefresh intervalMs={5000} />
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-border bg-surface flex-col shadow-[1px_0_0_0_rgba(17,24,39,0.03)]">
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topnav */}
        <header className="h-14 shrink-0 border-b border-border bg-surface/90 backdrop-blur-md flex items-center px-3 md:px-6">
          <MobileDrawer triggerLabel="Open navigation" triggerClassName="md:hidden">
            <div className="flex flex-col h-full bg-surface">{sidebarContent}</div>
          </MobileDrawer>
          {/* ml-auto (not justify-between) — the drawer trigger is display:none
              at md+, which removes it from flex layout entirely; with only one
              flex child left, justify-between degenerates to flex-start and
              this cluster would collapse to the header's left edge. */}
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/" className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-800 transition-colors">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Website
            </Link>
            <div className="h-4 w-px bg-border" />
            <NotificationBell unreadCount={unreadCount} />
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-gray-100 hover:text-ink-900 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 md:p-7">
          {children}
        </main>
      </div>
    </div>
  )
}
