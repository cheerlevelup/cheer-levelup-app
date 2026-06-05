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
    .select('id, name, is_archived')
    .order('created_at', { ascending: false })

  // Wellness z ostatnich 30 dni (7 do tabeli + 30 do statystyk)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: wellnessLogs } = await supabase
    .from('wellness_logs')
    .select('athlete_id, date, created_at, sleep_hours, sleep_quality, energy, stress, readiness, muscle_sorness, mood, body_weight_kg, hydration_glasses, pain_data, activity_data, cycle_phase')
    .in('athlete_id', athleteIds)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })

  // Feedback po sesjach (RPE, nastrój)
  const { data: feedbacks } = await supabase
    .from('post_session_feedback')
    .select('athlete_id, session_rpe, created_at, workout_session_id')
    .in('athlete_id', athleteIds)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  // Dieta z ostatnich 30 dni
  const { data: dietLogs } = await supabase
    .from('diet_logs')
    .select('athlete_id, date, meal_count, had_breakfast, hunger_level, water_ml, coffee_count')
    .in('athlete_id', athleteIds)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })

  const wellnessWeek = (wellnessLogs || []).filter((l: any) => l.date >= sevenDaysAgo.toISOString().split('T')[0])

  return (
    <CoachGroupDetailClient
      group={group}
      athletes={athletes}
      assignments={allAssignments}
      days={days}
      sessions={sessions || []}
      plans={plans || []}
      wellnessLogs={wellnessLogs || []}
      wellnessWeek={wellnessWeek}
      feedbacks={feedbacks || []}
      dietLogs={dietLogs || []}
    />
  )
}
