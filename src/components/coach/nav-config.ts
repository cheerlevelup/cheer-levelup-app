import { LayoutGrid, Users, Layers, Calendar, FileText, Ruler, LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/coach', label: 'Pulpit', icon: LayoutGrid },
  { href: '/coach/groups', label: 'Grupy', icon: Layers },
  { href: '/coach/athletes', label: 'Zawodniczki', icon: Users },
  { href: '/coach/plans', label: 'Plany', icon: FileText },
  { href: '/coach/trainings', label: 'Treningi', icon: Calendar },
  { href: '/coach/tests', label: 'Testy', icon: Ruler },
]

// Ścieżki, które renderują się bez sidebar/topbar (tryb kiosku na tablecie).
export function isKioskPath(pathname: string) {
  return pathname.includes('/readiness') || pathname.includes('/feedback')
}

export function isNavItemActive(pathname: string, href: string) {
  if (href === '/coach') return pathname === '/coach'
  return pathname === href || pathname.startsWith(href + '/')
}
