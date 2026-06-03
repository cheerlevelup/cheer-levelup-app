// src/lib/training.ts
import { createClient } from '@/utils/supabase/server'
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

export async function getNextTrainingForAthlete(
  athleteId: number,
  groupId?: number
): Promise<{
  assignment: AthleteWorkoutAssignment
  day: WorkoutDay
  completedCount: number
  totalCount: number
} | null> {
  const supabase = await createClient()

  const conditions = [`athlete_id.eq.${athleteId}`]
  if (groupId) conditions.push(`group_id.eq.${groupId}`)

  const { data: assignments, error: aErr } = await supabase
    .from('athlete_workout_assignments')
    .select('*, plan:workout_plans(*)')
    .eq('is_active', true)
    .or(conditions.join(','))

  if (aErr || !assignments || assignments.length === 0) return null
  const assignment = assignments[0] as AthleteWorkoutAssignment

  // Pobierz tygodnie dla tego planu
  const { data: weeks } = await supabase
    .from('workout_weeks')
    .select('id')
    .eq('plan_id', assignment.plan_id)

  const weekIds = (weeks || []).map((w: any) => w.id)
  if (weekIds.length === 0) return null

  // Pobierz dni
  const { data: days, error: dErr } = await supabase
    .from('workout_days')
    .select('*, week:workout_weeks(*, plan:workout_plans(*))')
    .in('week_id', weekIds)
    .order('week_id', { ascending: true })
    .order('day_order', { ascending: true })

  if (dErr || !days || days.length === 0) return null

  // Ukończone sesje
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('workout_day_id')
    .eq('athlete_id', athleteId)
    .eq('assignment_id', assignment.id)
    .eq('completed', true)

  const completedDayIds = new Set((sessions || []).map((s: any) => s.workout_day_id))
  const nextDay = days.find((d: any) => !completedDayIds.has(d.id))
  if (!nextDay) return null

  return {
    assignment,
    day: nextDay as WorkoutDay,
    completedCount: completedDayIds.size,
    totalCount: days.length,
  }
}

export async function getOrCreateWorkoutSession(
  athleteId: number,
  dayId: number,
  assignmentId: number
): Promise<WorkoutSession | null> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('workout_day_id', dayId)
    .eq('completed', false)
    .maybeSingle()

  if (existing) return existing as WorkoutSession

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

  const blocks: WorkoutDayBlock[] = (day.workout_day_blocks || [])
    .sort((a: any, b: any) => a.block_order - b.block_order)
    .map((block: any) => ({
      ...block,
      exercises: (block.workout_block_exercises || [])
        .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
        .map((ex: any) => ({
          ...ex,
          override: overrideMap.get(ex.id) || null,
        })),
    }))

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