// src/app/coach/plans/page.tsx
// Zakładka Plany: grupy → plany grupy i zawodniczki → plany zawodniczki
// (grupowe + indywidualne), oraz biblioteka planów ogólnych.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachPlansClient from './CoachPlansClient'

export const dynamic = 'force-dynamic'

export default async function CoachPlansPage({ searchParams }: { searchParams: Promise<{ g?: string; a?: string; view?: string }> }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const sp = await searchParams

  const [{ data: plans }, { data: groups }, { data: athletes }, { data: assignments }] = await Promise.all([
    supabase.from('workout_plans').select('*').order('created_at', { ascending: false }),
    supabase.from('groups').select('*').order('sort_order', { ascending: true }),
    supabase.from('athletes').select('id, full_name, group_id, archived').order('full_name', { ascending: true }),
    supabase.from('athlete_workout_assignments').select('*').not('athlete_id', 'is', null).order('created_at', { ascending: false }),
  ])

  return (
    <CoachPlansClient
      plans={(plans || []).filter((p: any) => !p.template_kind)}
      groups={groups || []}
      athletes={(athletes || []).filter((a: any) => !a.archived)}
      assignments={assignments || []}
      initialGroupId={sp.g ? (sp.g === 'none' ? 'none' : parseInt(sp.g)) : null}
      initialAthleteId={sp.a ? parseInt(sp.a) : null}
      initialView={sp.view === 'library' ? 'library' : 'groups'}
    />
  )
}
