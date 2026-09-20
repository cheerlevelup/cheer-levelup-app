'use client'
import Link from 'next/link'
import { Menu, ArrowLeft } from 'lucide-react'
import { usePageMeta } from './PageMetaContext'

export default function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { meta } = usePageMeta()

  return (
    <header className="coach-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="coach-btn coach-btn-ghost coach-menu-btn" style={{ padding: 8 }} onClick={onMenuClick}>
          <Menu size={18} />
        </button>
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
