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

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, full_name')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

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
        .select('id, training_id, name, reps, tempo, sets_planned, bodyweight')
        .in('training_id', trainingIds),
      supabase
        .from('group_training_entries')
        .select('training_id, exercise_id, athlete_id, sets, variant, bodyweight, exercise_override')
        .in('training_id', trainingIds),
    ])
    exercises = ex || []
    entries = en || []
  }

  return (
    <GroupStatsClient
      group={group}
      athletes={athletes || []}
      trainings={trainings || []}
      exercises={exercises}
      entries={entries}
    />
  )
}
