export const dynamic = 'force-dynamic'

// src/app/coach/athletes/page.tsx
// "Zawodniczki" — jedna wspólna, przeszukiwalna lista wszystkich zawodniczek
// ze wszystkich grup (Faza B2).
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import AthletesListClient from './AthletesListClient'

export default async function CoachAthletesPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { data: rawAthletes } = await supabase
    .from('athletes')
    .select('*, group:groups(id, name, group_type)')
    .order('full_name', { ascending: true })

  const athletes = (rawAthletes || []).filter((a: any) => !a.archived)

  const { data: allGroups } = await supabase
    .from('groups')
    .select('*')
    .order('sort_order', { ascending: true })

  const athleteIds = athletes.map((a: any) => a.id)
  let injuredIds: number[] = []
  if (athleteIds.length > 0) {
    const { data: injuries } = await supabase
      .from('injuries')
      .select('athlete_id, status')
      .in('athlete_id', athleteIds)
      .in('status', ['active', 'in_treatment'])
    injuredIds = [...new Set((injuries || []).map((i: any) => i.athlete_id))]
  }

  return (
    <AthletesListClient
      athletes={athletes}
      allGroups={allGroups || []}
      injuredIds={injuredIds}
    />
  )
}
