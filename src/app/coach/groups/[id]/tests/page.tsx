export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/tests/page.tsx
// Zakładka "Testy" grupy — wyniki testów sprawnościowych zawodniczek tej grupy
// (ta sama tabela co w głównej zakładce „Testy”, zawężona do grupy).
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GroupTestsClient from './GroupTestsClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupTestsPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params
  const groupId = parseInt(id)

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()
  if (!group) redirect('/coach/groups')

  const { data: rawAthletes } = await supabase
    .from('athletes')
    .select('id, full_name, birth_year, group_id, archived')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  const athletes = (rawAthletes || []).filter((a: any) => !a.archived)

  const { data: catalog } = await supabase
    .from('test_catalog')
    .select('*')
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })

  const athleteIds = athletes.map((a: any) => a.id)
  let results: any[] = []
  if (athleteIds.length > 0) {
    // kolumny `variant` / `flagged` / `missing` mogły jeszcze nie zostać dodane migracją
    const selects = [
      'id, athlete_id, test_catalog_id, value, test_date, flagged, variant, missing, comment',
      'id, athlete_id, test_catalog_id, value, test_date, flagged, variant',
      'id, athlete_id, test_catalog_id, value, test_date, flagged',
      'id, athlete_id, test_catalog_id, value, test_date',
    ]
    for (const cols of selects) {
      const { data: resultsData, error: resultsError } = await supabase
        .from('benchmark_tests')
        .select(cols)
        .in('athlete_id', athleteIds)
      if (!resultsError) { results = resultsData || []; break }
    }
  }

  return (
    <GroupTestsClient
      group={group}
      athletes={athletes}
      catalog={catalog || []}
      results={results}
    />
  )
}
