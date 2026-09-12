'use client'
// src/app/coach/groups/[id]/plan/GroupPlanClient.tsx
// Placeholder — plan treningowy dla grup zorganizowanych, treść wkrótce.
import { FileText } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, Card } from '@/components/coach/ui'

type Group = { id: number; name: string }

interface Props {
  group: Group
  athletesCount: number
}

export default function GroupPlanClient({ group, athletesCount }: Props) {
  return (
    <>
      <SetPageMeta title="Plan" backHref={`/coach/groups/${group.id}`} backLabel={group.name} />
      <TabsNav items={[
        { key: 'treningi', label: 'Treningi', href: `/coach/groups/${group.id}` },
        { key: 'plan', label: 'Plan', href: `/coach/groups/${group.id}/plan` },
        { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${group.id}/stats` },
        { key: 'obecnosc', label: 'Obecność', href: `/coach/groups/${group.id}/attendance` },
        { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${group.id}/athletes` },
        { key: 'testy', label: 'Testy', href: `/coach/groups/${group.id}/tests` },
      ]} />
      <div className="coach-content">
        <Card>
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--muted)' }}>
            <FileText size={28} style={{ opacity: 0.5, marginBottom: 10 }} />
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '0.95rem', marginBottom: 4 }}>
              Plan będzie tu dostępny wkrótce
            </div>
            <div style={{ fontSize: '0.82rem' }}>
              {group.name} · {athletesCount} zawodniczek
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
