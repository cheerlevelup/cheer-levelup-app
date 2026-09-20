'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import { PageMetaProvider, usePageMeta } from './PageMetaContext'
import { isKioskPath } from './nav-config'

// Wewnątrz PageMetaProvider — dopiero tu można odczytać meta.sidebarCollapsible
// ustawione przez stronę (np. trening live), żeby pokazać przełącznik zwijania menu.
function ShellLayout({ children }: { children: React.ReactNode }) {
  const { meta } = usePageMeta()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const canCollapse = !!meta?.sidebarCollapsible

  return (
    <div className={`coach-shell ${collapsed && canCollapse ? 'coach-sidebar-collapsed' : ''}`}>
      <Sidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <div
        className={`coach-overlay ${mobileOpen ? 'coach-open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <div className="coach-main">
        <TopBar
          onMenuClick={() => setMobileOpen((o) => !o)}
          sidebarCollapsed={collapsed}
          onToggleSidebar={() => setCollapsed(v => !v)}
        />
        <main className="coach-content-scroll">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}

export default function CoachShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Kioski (tablet na sali: gotowość/feedback) działają pełnoekranowo, bez nawigacji trenera.
  if (isKioskPath(pathname)) {
    return <>{children}</>
  }

  return (
    <PageMetaProvider>
      <ShellLayout>{children}</ShellLayout>
    </PageMetaProvider>
  )
}
