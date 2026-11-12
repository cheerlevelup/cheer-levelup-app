// src/lib/training.ts
import { createClient } from '@/utils/supabase/server'
import { pickVariantsForAthlete, sortWithVariants } from '@/lib/exerciseVariants'
import type {
  Athlete,
  WorkoutSession,
  WorkoutDayBlock,
  AthleteWorkoutAssignment,
  TrainingView,
  WorkoutDay,
} from '@/types/workout'

export async function getAthleteByUserId(userId: string): Promise<Athlete | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athletes')
    .select('*, group:groups(*)')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data as Athlete
}

export async function getUserRole(email: string): Promise<'coach' | 'athlete'> {
  if (email === 'cheerlevelup@gmail.com') return 'coach'
  return 'athlete'
}

// Trening planu na liście zawodniczki (ekran główny — wybór dowolnego treningu)
export type PlanTrainingItem = {
  id: number
  day_name: string
  week_number: number
  day_order: number
  completed: boolean   // ma ukończoną sesję
  inProgress: boolean  // ma rozpoczętą, niezakończoną sesję
  completedSessionId: number | null  // ostatnia ukończona sesja — do edycji wpisów (bez powtórki treningu)
}

// Aktywny plan zawodniczki (indywidualny, potem grupowy) z treningami i statusem sesji
async function loadAthletePlan(athleteId: number, groupId?: number) {
  const supabase = await createClient()

  // Szukaj najpierw przypisania indywidualnego, potem grupowego
  const { data: individualAssignments } = await supabase
    .from('athlete_workout_assignments')
    .select('*, plan:workout_plans(*)')
    .eq('is_active', true)
    .eq('athlete_id', athleteId)

  let assignment: AthleteWorkoutAssignment | null = (individualAssignments || [])[0] as AthleteWorkoutAssignment || null

  if (!assignment && groupId) {
    const { data: groupAssignments } = await supabase
      .from('athlete_workout_assignments')
      .select('*, plan:workout_plans(*)')
      .eq('is_active', true)
      .eq('group_id', groupId)
    assignment = (groupAssignments || [])[0] as AthleteWorkoutAssignment || null
  }

  if (!assignment) return null

  // Pobierz tygodnie dla tego planu
  const { data: weeks } = await supabase
    .from('workout_weeks')
    .select('id')
    .eq('plan_id', assignment.plan_id)

  const weekIds = (weeks || []).map((w: any) => w.id)
  if (weekIds.length === 0) return null

  // Pobierz dni
  const { data: rawDays, error: dErr } = await supabase
    .from('workout_days')
    .select('*, week:workout_weeks(*, plan:workout_plans(*))')
    .in('week_id', weekIds)
    .order('week_id', { ascending: true })
    .order('day_order', { ascending: true })

  if (dErr || !rawDays || rawDays.length === 0) return null
  // kolejność: tydzień (numer), potem trening w tygodniu
  const days = [...rawDays].sort((x: any, y: any) => (x.week?.week_number ?? 0) - (y.week?.week_number ?? 0) || x.day_order - y.day_order)

  // Sesje zawodniczki dla dni planu — ukończone i rozpoczęte
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, workout_day_id, completed, date_completed, created_at')
    .eq('athlete_id', athleteId)
    .in('workout_day_id', days.map((d: any) => d.id))
    .order('created_at', { ascending: false })

  const completedDayIds = new Set((sessions || []).filter((s: any) => s.completed).map((s: any) => s.workout_day_id))
  const inProgressDayIds = new Set((sessions || []).filter((s: any) => !s.completed).map((s: any) => s.workout_day_id))
  // najnowsza ukończona sesja każdego dnia (sesje posortowane od najnowszej)
  const completedSessionByDay = new Map<number, number>()
  for (const s of (sessions || []) as any[]) if (s.completed && !completedSessionByDay.has(s.workout_day_id)) completedSessionByDay.set(s.workout_day_id, s.id)
  return { assignment, days, completedDayIds, inProgressDayIds, completedSessionByDay }
}

export async function getNextTrainingForAthlete(
  athleteId: number,
  groupId?: number
): Promise<{
  assignment: AthleteWorkoutAssignment
  day: WorkoutDay
  completedCount: number
  totalCount: number
} | null> {
  const plan = await loadAthletePlan(athleteId, groupId)
  if (!plan) return null
  const { assignment, days, completedDayIds } = plan
  const nextDay = days.find((d: any) => !completedDayIds.has(d.id))
  if (!nextDay) return null

  return {
    assignment,
    day: nextDay as WorkoutDay,
    completedCount: completedDayIds.size,
    totalCount: days.length,
  }
}

// Wszystkie treningi aktywnego planu ze statusem — zawodniczka może rozpocząć dowolny
export async function getPlanTrainingsForAthlete(
  athleteId: number,
  groupId?: number
): Promise<{ assignmentId: number; planName: string; trainings: PlanTrainingItem[] } | null> {
  const plan = await loadAthletePlan(athleteId, groupId)
  if (!plan) return null
  const { assignment, days, completedDayIds, inProgressDayIds, completedSessionByDay } = plan
  return {
    assignmentId: assignment.id,
    planName: (assignment as any).plan?.name || 'Plan treningowy',
    trainings: days.map((d: any) => ({
      id: d.id,
      day_name: d.day_name || 'Trening',
      week_number: d.week?.week_number ?? 1,
      day_order: d.day_order,
      completed: completedDayIds.has(d.id),
      inProgress: inProgressDayIds.has(d.id),
      completedSessionId: completedSessionByDay.get(d.id) ?? null,
    })),
  }
}

// Ukończony trening nie jest powtarzany: jeśli dzień ma ukończoną sesję i żadnej
// rozpoczętej, zwraca id ukończonej (do edycji wpisów w historii), inaczej null
export async function getCompletedSessionToEdit(athleteId: number, dayId: number): Promise<number | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workout_sessions')
    .select('id, completed')
    .eq('athlete_id', athleteId)
    .eq('workout_day_id', dayId)
    .order('created_at', { ascending: false })
  const rows = (data || []) as { id: number; completed: boolean }[]
  if (rows.some(r => !r.completed)) return null
  return rows.find(r => r.completed)?.id ?? null
}

export async function getOrCreateWorkoutSession(
  athleteId: number,
  dayId: number,
  assignmentId: number
): Promise<WorkoutSession | null> {
  const supabase = await createClient()

  // Szukaj aktywnej (niezakończonej) sesji dla tego dnia — po assignment_id lub dayId
  const { data: rows, error: fetchErr } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('workout_day_id', dayId)
    .eq('completed', false)
    .order('created_at', { ascending: false })

  if (fetchErr) console.error('Error fetching session:', fetchErr)

  const allRows = rows || []

  // Preferuj sesję z tym samym assignment_id, fallback do dowolnej niezakończonej
  const existing = allRows.find(r => r.assignment_id === assignmentId) || allRows[0] || null

  if (existing) {
    // Usuń duplikaty jeśli jest ich więcej niż jedna
    const dupes = allRows.filter(r => r.id !== existing.id)
    if (dupes.length > 0) {
      await supabase.from('workout_sessions').delete().in('id', dupes.map(d => d.id))
    }
    // Upewnij się że assignment_id jest aktualny
    if (existing.assignment_id !== assignmentId) {
      await supabase.from('workout_sessions').update({ assignment_id: assignmentId }).eq('id', existing.id)
    }
    return existing as WorkoutSession
  }

  const { data: created, error } = await supabase
    .from('workout_sessions')
    .insert({
      athlete_id: athleteId,
      workout_day_id: dayId,
      assignment_id: assignmentId,
      completed: false,
      report_sent: false,
    })
    .select()
    .single()

  if (error) { console.error('Error creating session:', error); return null }
  return created as WorkoutSession
}

export async function getWorkoutDayWithBlocks(
  dayId: number,
  athleteId: number
): Promise<TrainingView | null> {
  const supabase = await createClient()

  const { data: day, error: dayErr } = await supabase
    .from('workout_days')
    .select(`
      *,
      week:workout_weeks(
        *,
        plan:workout_plans(*)
      ),
      workout_day_blocks(
        *,
        workout_block_exercises(
          *,
          exercise:exercises(*)
        )
      )
    `)
    .eq('id', dayId)
    .single()

  if (dayErr || !day) return null

  const exerciseIds = (day.workout_day_blocks || [])
    .flatMap((b: any) => (b.workout_block_exercises || []).map((e: any) => e.id))

  const { data: overrides } = exerciseIds.length > 0
    ? await supabase
        .from('athlete_exercise_overrides')
        .select('*')
        .eq('athlete_id', athleteId)
        .in('block_exercise_id', exerciseIds)
    : { data: [] }

  const overrideMap = new Map((overrides || []).map((o: any) => [o.block_exercise_id, o]))

  // Pobierz dodatkowe ćwiczenia trenera dla tej zawodniczki
  const blockIds = (day.workout_day_blocks || []).map((b: any) => b.id)
  const { data: extraExercises } = blockIds.length > 0
    ? await supabase
        .from('athlete_extra_exercises')
        .select('*, exercise:exercises(*)')
        .eq('athlete_id', athleteId)
        .in('block_id', blockIds)
        .order('exercise_order', { ascending: true })
    : { data: [] }

  const extraByBlock = new Map<number, any[]>()
  for (const ex of (extraExercises || [])) {
    if (!extraByBlock.has(ex.block_id)) extraByBlock.set(ex.block_id, [])
    extraByBlock.get(ex.block_id)!.push(ex)
  }

  const blocks: WorkoutDayBlock[] = (day.workout_day_blocks || [])
    .sort((a: any, b: any) => a.block_order - b.block_order)
    .map((block: any) => {
      // warianty (1a/1b...) — zawodniczka widzi tylko swój wariant danego ćwiczenia
      const planExercises = pickVariantsForAthlete(sortWithVariants(block.workout_block_exercises || []), athleteId)
        .map((ex: any) => ({
          ...ex,
          override: overrideMap.get(ex.id) || null,
          is_extra: false,
        }))
        .filter((ex: any) => !ex.override?.skip) // ukryj pominięte

      const extras = (extraByBlock.get(block.id) || []).map((ex: any) => ({
        ...ex,
        is_extra: true,
        override: null,
      }))

      return {
        ...block,
        exercises: [...planExercises, ...extras],
      }
    })

  const { data: session } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('workout_day_id', dayId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    session: session as WorkoutSession | null,
    day: day as WorkoutDay,
    blocks,
    plan: (day.week as any)?.plan,
    week: day.week as any,
  }
}

export async function getAthleteTrainingHistory(
  athleteId: number,
  limit = 10
): Promise<WorkoutSession[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      workout_day:workout_days(
        *,
        week:workout_weeks(
          *,
          plan:workout_plans(*)
        )
      )
    `)
    .eq('athlete_id', athleteId)
    .eq('completed', true)
    .order('date_completed', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data || []) as WorkoutSession[]
}
