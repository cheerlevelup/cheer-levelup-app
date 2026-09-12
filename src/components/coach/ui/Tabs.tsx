'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface TabItem {
  key: string
  label: string
  icon?: React.ReactNode
  href?: string
}

// Pasek zakładek jako linki (np. Treningi/Statystyki/Podsumowanie/Zawodniczki grupy) —
// active state z usePathname, każda zakładka to osobna trasa Next.js.
export function TabsNav({ items }: { items: TabItem[] }) {
  const pathname = usePathname()
  return (
    <div className="coach-comp-tabs">
      {items.map((item) => {
        const active = item.href ? pathname === item.href : false
        return (
          <Link key={item.key} href={item.href || '#'} className={`coach-comp-tab ${active ? 'coach-active' : ''}`}>
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

// Pasek zakładek na lokalnym stanie (np. karta zawodniczki: Profil/Kontuzje/Testy).
export function TabsState({
  items,
  active,
  onChange,
}: {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="coach-comp-tabs">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`coach-comp-tab ${active === item.key ? 'coach-active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
