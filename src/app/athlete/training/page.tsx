// src/app/athlete/training/page.tsx
// Widok treningu — /athlete/training?day=X&assignment=Y

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  getAthleteByUserId,
  getWorkoutDayWithBlocks,
  getOrCreateWorkoutSession,
  getNextTrainingForAthlete,
} from '@/lib/training'
import TrainingClient from './TrainingClient'

interface Props {
  searchParams: Promise<{ day?: string; assignment?: string }>
}

export default async function TrainingPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const params = await searchParams
  let dayId = params.day ? parseInt(params.day) : null
  let assignmentId = params.assignment ? parseInt(params.assignment) : null

  // Jeśli nie ma day/assignment w URL — znajdź następny trening
  if (!dayId || !assignmentId) {
    const next = await getNextTrainingForAthlete(athlete.id, athlete.group_id || undefined)
    if (!next) redirect('/athlete')
    dayId = next.day.id
    assignmentId = next.assignment.id
    redirect(`/athlete/training?day=${dayId}&assignment=${assignmentId}`)
  }

  // Pobierz lub utwórz sesję
  const session = await getOrCreateWorkoutSession(athlete.id, dayId, assignmentId)
  if (!session) {
    // Błąd tworzenia sesji — wróć do dashboardu
    redirect('/athlete')
  }

  // Pobierz dane treningu
  const trainingView = await getWorkoutDayWithBlocks(dayId, athlete.id)
  if (!trainingView) redirect('/athlete')

  // Pobierz set_logs dla tej sesji (poprzednie ciężary)
  const { data: existingSetLogs } = await supabase
    .from('set_logs')
    .select('*')
    .eq('workout_session_id', session.id)
    .eq('athlete_id', athlete.id)

  // Pobierz wellness dla tej sesji
  const { data: wellness } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('workout_session_id', session.id)
    .maybeSingle()

  // Pobierz konfigurację wellness dla tego planu
  const planId = trainingView.plan?.id
  const { data: wellnessConfig } = planId
    ? await supabase
        .from('plan_wellness_config')
        .select('pre, post')
        .eq('plan_id', planId)
        .maybeSingle()
    : { data: null }

  return (
    <TrainingClient
      athlete={athlete}
      trainingView={{ ...trainingView, session }}
      existingSetLogs={existingSetLogs || []}
      existingWellness={wellness || null}
      wellnessPreFields={wellnessConfig?.pre || null}
    />
  )
}
