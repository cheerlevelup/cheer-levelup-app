'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import { PageMetaProvider } from './PageMetaContext'
import { isKioskPath } from './nav-config'

export default function CoachShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Kioski (tablet na sali: gotowość/feedback) działają pełnoekranowo, bez nawigacji trenera.
  if (isKioskPath(pathname)) {
    return <>{children}</>
  }

  return (
    <PageMetaProvider>
      <div className="coach-shell">
        <Sidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
        <div
          className={`coach-overlay ${mobileOpen ? 'coach-open' : ''}`}
          onClick={() => setMobileOpen(false)}
        />
        <div className="coach-main">
          <TopBar onMenuClick={() => setMobileOpen((o) => !o)} />
          <main className="coach-content-scroll">{children}</main>
        </div>
        <BottomNav />
      </div>
    </PageMetaProvider>
  )
}
