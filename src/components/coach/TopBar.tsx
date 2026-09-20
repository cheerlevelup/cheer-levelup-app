'use client'
import Link from 'next/link'
import { Menu, ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { usePageMeta } from './PageMetaContext'

interface TopBarProps {
  onMenuClick: () => void
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export default function TopBar({ onMenuClick, sidebarCollapsed, onToggleSidebar }: TopBarProps) {
  const { meta } = usePageMeta()

  return (
    <header className="coach-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="coach-btn coach-btn-ghost coach-menu-btn" style={{ padding: 8 }} onClick={onMenuClick}>
          <Menu size={18} />
        </button>
        {meta?.sidebarCollapsible && onToggleSidebar && (
          <button
            className="coach-btn coach-btn-ghost coach-sidebar-collapse-btn"
            style={{ padding: 8 }}
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? 'Pokaż menu' : 'Zwiń menu — więcej miejsca na siatkę'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
        {meta?.backHref && (
          <div className="coach-page-head">
            <Link href={meta.backHref} className="coach-back-btn">
              <ArrowLeft size={12} />
              <span>{meta.backLabel || 'Wstecz'}</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
