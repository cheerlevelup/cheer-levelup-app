// src/app/coach/athletes/[id]/training/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachAthleteTrainingClient from './CoachAthleteTrainingClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoachAthleteTrainingPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params
  const athleteId = parseInt(id)

  // Pobierz zawodniczkę
  const { data: athlete } = await supabase
    .from('athletes')
    .select('*, group:groups(*)')
    .eq('id', athleteId)
    .single()

  if (!athlete) redirect('/coach')

  // Znajdź aktywne przypisanie planu
  const conditions = [`athlete_id.eq.${athleteId}`]
  if (athlete.group_id) conditions.push(`group_id.eq.${athlete.group_id}`)

  const { data: assignments } = await supabase
    .from('athlete_workout_assignments')
    .select('*, plan:workout_plans(*)')
    .eq('is_active', true)
    .or(conditions.join(','))

  if (!assignments || assignments.length === 0) {
    return (
      <CoachAthleteTrainingClient
        athlete={athlete}
        assignment={null}
        days={[]}
        blocks={[]}
        overrides={[]}
      />
    )
  }

  const assignment = assignments[0]

  // Pobierz tygodnie i dni
  const { data: weeks } = await supabase
    .from('workout_weeks')
    .select('id, week_number')
    .eq('plan_id', assignment.plan_id)
    .order('week_number', { ascending: true })

  const weekIds = (weeks || []).map((w: any) => w.id)

  let days: any[] = []
  let allBlockExercises: any[] = []

  if (weekIds.length > 0) {
    const { data: daysData } = await supabase
      .from('workout_days')
      .select('*, week:workout_weeks(week_number)')
      .in('week_id', weekIds)
      .order('week_id', { ascending: true })
      .order('day_order', { ascending: true })

    days = daysData || []

    const dayIds = days.map((d: any) => d.id)

    if (dayIds.length > 0) {
      // Pobierz bloki z ćwiczeniami
      const { data: blocksData } = await supabase
        .from('workout_day_blocks')
        .select(`
          *,
          workout_block_exercises(
            *,
            exercise:exercises(*)
          )
        `)
        .in('day_id', dayIds)
        .order('block_order', { ascending: true })

      allBlockExercises = blocksData || []
    }
  }

  // Pobierz istniejące overrides dla tej zawodniczki
  const allExerciseIds = allBlockExercises
    .flatMap((b: any) => (b.workout_block_exercises || []).map((e: any) => e.id))

  const { data: overrides } = allExerciseIds.length > 0
    ? await supabase
        .from('athlete_exercise_overrides')
        .select('*')
        .eq('athlete_id', athleteId)
        .in('block_exercise_id', allExerciseIds)
    : { data: [] }

  // Dodatkowe ćwiczenia tej zawodniczki
  const allBlockIds = allBlockExercises.map((b: any) => b.id)
  const { data: extraExercises } = allBlockIds.length > 0
    ? await supabase
        .from('athlete_extra_exercises')
        .select('*, exercise:exercises(*)')
        .eq('athlete_id', athleteId)
        .in('block_id', allBlockIds)
        .order('exercise_order', { ascending: true })
    : { data: [] }

  // Biblioteka ćwiczeń (do wyboru przy podmianie i dodawaniu)
  const { data: exerciseLibrary } = await supabase
    .from('exercises')
    .select('id, name, category')
    .order('name', { ascending: true })

  return (
    <CoachAthleteTrainingClient
      athlete={athlete}
      assignment={assignment}
      days={days}
      blocks={allBlockExercises}
      overrides={overrides || []}
      extraExercises={extraExercises || []}
      exerciseLibrary={exerciseLibrary || []}
    />
  )
}
