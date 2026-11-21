'use client'
// src/app/coach/groups/[id]/tests/GroupTestsClient.tsx
// Wyniki testów sprawnościowych zawodniczek grupy — tabela z głównej zakładki
// „Testy” (filtry roczników/testów/dat, sortowanie, flagi, braki) bez filtra grup.
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav } from '@/components/coach/ui'
import GroupHero from '@/components/coach/GroupHero'
import { WynikiTab } from '@/app/coach/tests/TestsClient'

type Group = { id: number; name: string; group_type?: string }

interface Props {
  group: Group
  athletes: any[]
  catalog: any[]
  results: any[]
}

export default function GroupTestsClient({ group, athletes, catalog, results }: Props) {
  return (
    <>
      <SetPageMeta title="Testy" backHref={`/coach/groups/${group.id}`} backLabel={group.name} />
      <div className="coach-content">
        <GroupHero group={group} athletesCount={athletes.length} />

        <TabsNav items={[
          { key: 'treningi', label: 'Treningi', href: `/coach/groups/${group.id}` },
          { key: 'plan', label: 'Plan', href: `/coach/groups/${group.id}/plan` },
          { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${group.id}/stats` },
          { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${group.id}/athletes` },
          { key: 'testy', label: 'Testy', href: `/coach/groups/${group.id}/tests` },
        ]} />

        <WynikiTab
          groups={[{ id: group.id, name: group.name }]}
          athletes={athletes}
          catalog={catalog}
          results={results}
          singleGroup
        />
      </div>
    </>
  )
}
