'use client'
import Link from 'next/link'
import { Menu, Search, LogOut, ArrowLeft } from 'lucide-react'
import { usePageMeta } from './PageMetaContext'
import { createClient } from '@/utils/supabase/client'

export default function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { meta } = usePageMeta()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <header className="coach-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="coach-btn coach-btn-ghost coach-menu-btn" style={{ padding: 8 }} onClick={onMenuClick}>
          <Menu size={18} />
        </button>
        <div className="coach-page-head">
          {meta?.backHref && (
            <Link href={meta.backHref} className="coach-back-btn">
              <ArrowLeft size={14} />
              <span>{meta.backLabel || 'Wstecz'}</span>
            </Link>
          )}
          <h1 style={{ margin: 0 }}>{meta?.title || 'Panel trenera'}</h1>
        </div>
      </div>
      <div className="coach-topbar-right">
        <div className="coach-search-box">
          <Search size={15} />
          <input type="text" placeholder="Szukaj zawodniczki, grupy…" />
        </div>
        <button className="coach-btn coach-btn-ghost" onClick={handleLogout}>
          <LogOut size={15} />
          Wyloguj
        </button>
      </div>
    </header>
  )
}
