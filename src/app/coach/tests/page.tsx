export const dynamic = 'force-dynamic'

// src/app/coach/tests/page.tsx
// "Testy" — katalog testów sprawnościowych (definiowany przez trenera), wyniki
// wszystkich zawodniczek z filtrami i trendem, oraz szybki edytor do masowego
// wpisywania wyników. Ostatnia pozycja w menu.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import TestsClient from './TestsClient'

export default async function CoachTestsPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .order('sort_order', { ascending: true })

  const { data: rawAthletes } = await supabase
    .from('athletes')
    .select('id, full_name, birth_year, group_id, archived')
    .order('full_name', { ascending: true })

  const athletes = (rawAthletes || []).filter((a: any) => !a.archived && a.group_id)

  const { data: catalog } = await supabase
    .from('test_catalog')
    .select('*')
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })

  const athleteIds = athletes.map((a: any) => a.id)
  let results: any[] = []
  if (athleteIds.length > 0) {
    const { data: resultsData } = await supabase
      .from('benchmark_tests')
      .select('id, athlete_id, test_catalog_id, value, test_date')
      .in('athlete_id', athleteIds)
    results = resultsData || []
  }

  return (
    <TestsClient
      groups={groups || []}
      athletes={athletes}
      catalog={catalog || []}
      results={results}
    />
  )
}
