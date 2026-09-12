import { LayoutGrid, Users, Layers, Calendar, FileText, LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/coach', label: 'Pulpit', icon: LayoutGrid },
  { href: '/coach/athletes', label: 'Zawodniczki', icon: Users },
  { href: '/coach/groups', label: 'Grupy', icon: Layers },
  { href: '/coach/trainings', label: 'Treningi', icon: Calendar },
  { href: '/coach/plans', label: 'Plany', icon: FileText },
]

// Ścieżki, które renderują się bez sidebar/topbar (tryb kiosku na tablecie).
export function isKioskPath(pathname: string) {
  return pathname.includes('/readiness') || pathname.includes('/feedback')
}

export function isNavItemActive(pathname: string, href: string) {
  if (href === '/coach') return pathname === '/coach'
  return pathname === href || pathname.startsWith(href + '/')
}
