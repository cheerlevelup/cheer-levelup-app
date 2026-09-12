'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isNavItemActive } from './nav-config'

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname()

  return (
    <aside className={`coach-sidebar ${open ? 'coach-open' : ''}`} id="sidebar">
      <div className="coach-brand">
        <div
          className="coach-brand-mark"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--navy-900)' }}
        >
          CL
        </div>
        <div className="coach-brand-text">
          <div className="coach-brand-club">CHEER LEVELUP</div>
          <div className="coach-brand-name">Panel trenera</div>
        </div>
      </div>

      <nav className="coach-nav">
        <div className="coach-nav-group-label">Menu</div>
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`coach-nav-item ${active ? 'coach-active' : ''}`}
              onClick={onNavigate}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="coach-sidebar-foot">
        <div className="coach-coach-card">
          <div className="coach-coach-avatar">UP</div>
          <div className="coach-coach-meta">
            <div className="coach-coach-name">Urszula Papka</div>
            <div className="coach-coach-role">Trener przygotowania motorycznego</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
