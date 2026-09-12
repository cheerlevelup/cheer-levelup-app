export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/stats/page.tsx
// Statystyki grupy zorganizowanej: wykresy postępu (per ćwiczenie) + obecność.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GroupStatsClient from './GroupStatsClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupStatsPage({ params }: Props) {
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
    .select('id, full_name, archived')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  const athletes = (rawAthletes || []).filter((a: any) => !a.archived)
  const athleteIdsForSelf = athletes.map((a: any) => a.id)

  const isManaged = (group as any).group_type === 'managed'

  // Grupy samodzielne nie mają datowanych treningów grupowych (group_trainings) —
  // "Statystyki treningowe" liczymy z przypisanego planu (workout_sessions/feedback).
  let selfSessions: any[] = []
  let selfFeedbacks: any[] = []
  let selfActivePlanDays: any[] = []
  if (!isManaged && athleteIdsForSelf.length > 0) {
    const { data: groupAssignments } = await supabase
      .from('athlete_workout_assignments')
      .select('plan_id')
      .eq('group_id', groupId)
      .eq('is_active', true)
    const { data: athleteAssignments } = await supabase
      .from('athlete_workout_assignments')
      .select('plan_id')
      .in('athlete_id', athleteIdsForSelf)
      .eq('is_active', true)
    const allAssignments = [...(groupAssignments || []), ...(athleteAssignments || [])]
    const currentPlanId = allAssignments[0]?.plan_id ?? null

    if (currentPlanId) {
      const { data: weeks } = await supabase
        .from('workout_weeks')
        .select('id, plan_id')
        .eq('plan_id', currentPlanId)
      const weekIds = (weeks || []).map((w: any) => w.id)
      if (weekIds.length > 0) {
        const { data: daysData } = await supabase
          .from('workout_days')
          .select('id')
          .in('week_id', weekIds)
        selfActivePlanDays = daysData || []
      }
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('athlete_id, workout_day_id, completed, created_at, date_completed')
      .in('athlete_id', athleteIdsForSelf)
    selfSessions = sessions || []

    const { data: feedbacks } = await supabase
      .from('post_session_feedback')
      .select('athlete_id, session_rpe, created_at')
      .in('athlete_id', athleteIdsForSelf)
      .gte('created_at', thirtyDaysAgo.toISOString())
    selfFeedbacks = feedbacks || []
  }

  const { data: trainings } = await supabase
    .from('group_trainings')
    .select('id, group_id, training_date, absent_athlete_ids')
    .eq('group_id', groupId)
    .order('training_date', { ascending: true })

  const trainingIds = (trainings || []).map(t => t.id)

  // Ćwiczenia i wpisy ze WSZYSTKICH treningów grupy — potrzebne do wykresów w czasie.
  let exercises: any[] = []
  let entries: any[] = []
  if (trainingIds.length) {
    const [{ data: ex }, { data: en }] = await Promise.all([
      supabase
        .from('group_training_exercises')
        .select('id, training_id, name, reps, tempo, sets_planned, bodyweight, variants')
        .in('training_id', trainingIds),
      supabase
        .from('group_training_entries')
        .select('training_id, exercise_id, athlete_id, sets, variant, bodyweight, exercise_override')
        .in('training_id', trainingIds),
    ])
    exercises = ex || []
    entries = en || []
  }

  // Najnowsza masa ciała każdej zawodniczki (do relative load w Podsumowaniu)
  const athleteIds = (athletes || []).map(a => a.id)
  const bodyWeights: Record<number, number> = {}
  if (athleteIds.length) {
    const { data: bw } = await supabase
      .from('wellness_logs')
      .select('athlete_id, body_weight_kg, created_at')
      .in('athlete_id', athleteIds)
      .not('body_weight_kg', 'is', null)
      .order('created_at', { ascending: false })
    for (const r of bw || []) {
      if (bodyWeights[r.athlete_id] == null && r.body_weight_kg != null) bodyWeights[r.athlete_id] = r.body_weight_kg
    }
  }

  return (
    <GroupStatsClient
      group={group}
      athletes={athletes || []}
      trainings={trainings || []}
      exercises={exercises}
      entries={entries}
      bodyWeights={bodyWeights}
      selfSessions={selfSessions}
      selfFeedbacks={selfFeedbacks}
      selfActivePlanDays={selfActivePlanDays}
    />
  )
}
