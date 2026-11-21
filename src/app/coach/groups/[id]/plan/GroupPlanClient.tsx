'use client'
// src/app/coach/groups/[id]/plan/GroupPlanClient.tsx
// Placeholder — plan treningowy dla grup zorganizowanych, treść wkrótce.
import { FileText } from 'lucide-react'
import { groupTabs } from '@/components/coach/groupTabs'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, Card } from '@/components/coach/ui'
import GroupHero from '@/components/coach/GroupHero'

type Group = { id: number; name: string; group_type?: string }

interface Props {
  group: Group
  athletesCount: number
}

export default function GroupPlanClient({ group, athletesCount }: Props) {
  return (
    <>
      <SetPageMeta title="Plan" backHref={`/coach/groups/${group.id}`} backLabel={group.name} />
      <div className="coach-content">
        <GroupHero group={group} athletesCount={athletesCount} />

        <TabsNav items={groupTabs(group.id)} />
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
