'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isNavItemActive } from './nav-config'

// Wszystkie 5 pozycji (w mockupie zabrakło "Plany" w mobilnym bottom-nav — to poprawka).
export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="coach-bottom-nav">
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href} className={`coach-bn-item ${active ? 'coach-active' : ''}`}>
            <Icon size={19} strokeWidth={1.8} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
