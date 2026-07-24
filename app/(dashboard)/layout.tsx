import Link from 'next/link'
import { LogoMark } from '@/components/logo'
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
      <div className="border-b border-white/8 px-4 py-5">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/10 shadow-[inset_0_1px_rgba(255,255,255,0.06)]">
            <LogoMark size={25} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-[-0.02em] text-white">answer<span className="text-blue-400">Loops</span></div>
            <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-white/35">Agent operations</div>
          </div>
        </Link>
      </div>
      <SidebarNav />
    </>
  )

  return (
    <div className="dashboard-shell flex h-screen bg-[#f3f6fb]">
      <AutoRefresh intervalMs={5000} />
      {/* Sidebar — desktop only */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/8 bg-[#070b15] shadow-[12px_0_40px_rgba(15,23,42,0.08)] md:flex">
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topnav */}
        <header className="flex h-16 shrink-0 items-center border-b border-slate-200/80 bg-white/85 px-3 shadow-[0_1px_rgba(15,23,42,0.02)] backdrop-blur-xl md:px-7">
          <MobileDrawer triggerLabel="Open navigation" triggerClassName="md:hidden">
            <div className="flex h-full flex-col bg-[#070b15]">{sidebarContent}</div>
          </MobileDrawer>
          <div className="ml-3 hidden items-center gap-3 md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Workspace</p>
              <p className="text-xs font-semibold text-slate-700">Support command center</p>
            </div>
          </div>
          {/* ml-auto (not justify-between) — the drawer trigger is display:none
              at md+, which removes it from flex layout entirely; with only one
              flex child left, justify-between degenerates to flex-start and
              this cluster would collapse to the header's left edge. */}
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/" className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-blue-200 hover:text-blue-700">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Website
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <NotificationBell unreadCount={unreadCount} />
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="dashboard-content relative flex-1 overflow-y-auto">
          <div className="dashboard-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto w-full max-w-[1500px] p-4 sm:p-6 md:p-8 lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
