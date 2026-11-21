// src/components/coach/groupTabs.ts
// Zakładki profilu drużyny — jedna lista dla wszystkich podstron grupy.
import type { TabItem } from './ui'

export function groupTabs(groupId: number): TabItem[] {
  return [
    { key: 'treningi', label: 'Treningi', href: `/coach/groups/${groupId}` },
    { key: 'plan', label: 'Plan', href: `/coach/groups/${groupId}/plan` },
    { key: 'periodyzacja', label: 'Periodyzacja', href: `/coach/groups/${groupId}/periodization` },
    { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${groupId}/stats` },
    { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${groupId}/athletes` },
    { key: 'testy', label: 'Testy', href: `/coach/groups/${groupId}/tests` },
  ]
}
