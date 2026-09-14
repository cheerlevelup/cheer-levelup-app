'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { NAV_ITEMS, isNavItemActive } from './nav-config'
import CoachProfileModal from './CoachProfileModal'

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <aside className={`coach-sidebar ${open ? 'coach-open' : ''}`} id="sidebar">
      <div className="coach-brand">
        <img src="/level up.jpg" alt="Cheer LevelUP" className="coach-brand-mark" />
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
        <button className="coach-coach-card" onClick={() => setProfileOpen(true)}>
          <div className="coach-coach-avatar">UP</div>
          <div className="coach-coach-meta">
            <div className="coach-coach-name">Urszula Papka</div>
            <div className="coach-coach-role">Trener przygotowania motorycznego</div>
          </div>
        </button>
        <button className="coach-sidebar-logout" onClick={handleLogout}>
          <LogOut size={14} />
          Wyloguj
        </button>
      </div>

      {profileOpen && <CoachProfileModal onClose={() => setProfileOpen(false)} />}
    </aside>
  )
}
