export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachGroupDetailClient from './CoachGroupDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoachGroupDetailPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params
  const groupId = parseInt(id)

  // Pobierz grupę
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (!group) redirect('/coach/groups')

  // Zawodniczki w grupie
  const { data: athletes } = await supabase
    .from('athletes')
    .select('*')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  if (!athletes || athletes.length === 0) {
    return <CoachGroupDetailClient group={group} athletes={[]} assignments={[]} days={[]} sessions={[]} />
  }

  const athleteIds = athletes.map((a: any) => a.id)

  // Przypisania planów do grupy lub zawodniczek
  const { data: groupAssignments } = await supabase
    .from('athlete_workout_assignments')
    .select('*, plan:workout_plans(*)')
    .eq('group_id', groupId)
    .eq('is_active', true)

  const { data: athleteAssignments } = await supabase
    .from('athlete_workout_assignments')
    .select('*, plan:workout_plans(*)')
    .in('athlete_id', athleteIds)
    .eq('is_active', true)

  const allAssignments = [...(groupAssignments || []), ...(athleteAssignments || [])]

  // Pobierz dni treningowe dla wszystkich planów
  let days: any[] = []
  const planIds = [...new Set(allAssignments.map((a: any) => a.plan_id))]

  if (planIds.length > 0) {
    const { data: weeks } = await supabase
      .from('workout_weeks')
      .select('id, week_number, plan_id')
      .in('plan_id', planIds)

    const weekIds = (weeks || []).map((w: any) => w.id)

    if (weekIds.length > 0) {
      const { data: daysData } = await supabase
        .from('workout_days')
        .select('*, week:workout_weeks(week_number, plan_id)')
        .in('week_id', weekIds)
        .order('week_id', { ascending: true })
        .order('day_order', { ascending: true })

      days = daysData || []
    }
  }

  // Ukończone sesje dla zawodniczek
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('*')
    .in('athlete_id', athleteIds)
    .order('date_completed', { ascending: false })

  // Wszystkie plany (do przypisywania)
  const { data: plans } = await supabase
    .from('workout_plans')
    .select('id, name')
    .order('created_at', { ascending: false })

  return (
    <CoachGroupDetailClient
      group={group}
      athletes={athletes}
      assignments={allAssignments}
      days={days}
      sessions={sessions || []}
      plans={plans || []}
    />
  )
}
