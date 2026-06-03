// src/app/coach/plans/[id]/page.tsx
// Edytor planu — obsługuje istniejące plany
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import PlanEditorClient from './PlanEditorClient'

interface Props {
  params: Promise<{ id: string }>
}

type WeekRow = {
  id: number
  plan_id: number
  week_number: number
  name?: string | null
}

type DayRow = {
  id: number
  week_id: number
  day_name: string
  day_order: number
}

type WarmupSetRow = {
  reps?: string
  weight_kg?: string
  note?: string
}

type BlockExerciseRow = {
  id?: number
  block_id: number
  exercise_id?: number | null
  exercise_code?: string | null
  exercise_order: number
  sets: number
  reps?: string | null
  tempo?: string | null
  weight_kg?: number | null
  rir?: number | null
  is_warmup: boolean
  warmup_sets?: WarmupSetRow[] | null
  coach_comment?: string | null
  exercise?: {
    id: number
    name: string
    category?: string | null
  } | null
}

type BlockRow = {
  id: number
  day_id: number
  block_name: string
  block_order: number
  rounds: number
  workout_block_exercises?: BlockExerciseRow[]
}

export default async function PlanEditorPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params
  const planId = parseInt(id)

  const { data: plan } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (!plan) redirect('/coach/plans')

  // Pobierz pełną strukturę planu
  const { data: weeks } = await supabase
    .from('workout_weeks')
    .select('*')
    .eq('plan_id', planId)
    .order('week_number', { ascending: true })

  const weeksList = (weeks || []) as WeekRow[]
  const weekIds = weeksList.map(week => week.id)
  let days: DayRow[] = []
  let blocks: BlockRow[] = []

  if (weekIds.length > 0) {
    const { data: daysData } = await supabase
      .from('workout_days')
      .select('*')
      .in('week_id', weekIds)
      .order('day_order', { ascending: true })
    days = (daysData || []) as DayRow[]

    const dayIds = days.map(day => day.id)
    if (dayIds.length > 0) {
      const { data: blocksData } = await supabase
        .from('workout_day_blocks')
        .select('*, workout_block_exercises(*, exercise:exercises(*))')
        .in('day_id', dayIds)
        .order('block_order', { ascending: true })
      blocks = (blocksData || []) as BlockRow[]
    }
  }

  // Pobierz listę ćwiczeń do wyboru
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, category')
    .order('name', { ascending: true })

  const { data: allPlans } = await supabase
    .from('workout_plans')
    .select('id, name')
    .order('created_at', { ascending: false })

  const { data: allWeeks } = await supabase
    .from('workout_weeks')
    .select('id, plan_id, week_number, name')
    .order('plan_id', { ascending: true })
    .order('week_number', { ascending: true })

  const allWeeksList = (allWeeks || []) as WeekRow[]
  const allWeekIds = allWeeksList.map(week => week.id)
  const { data: allDays } = allWeekIds.length > 0
    ? await supabase
        .from('workout_days')
        .select('id, week_id, day_name, day_order')
        .in('week_id', allWeekIds)
        .order('week_id', { ascending: true })
        .order('day_order', { ascending: true })
    : { data: [] }

  const allDaysList = (allDays || []) as DayRow[]
  const allDayIds = allDaysList.map(day => day.id)
  const { data: allBlocks } = allDayIds.length > 0
    ? await supabase
        .from('workout_day_blocks')
        .select('id, day_id, block_name, block_order, rounds')
        .in('day_id', allDayIds)
        .order('day_id', { ascending: true })
        .order('block_order', { ascending: true })
    : { data: [] }

  return (
    <PlanEditorClient
      plan={plan}
      weeks={weeksList}
      days={days}
      blocks={blocks}
      exercises={exercises || []}
      allPlans={allPlans || []}
      allWeeks={allWeeksList}
      allDays={allDaysList}
      allBlocks={(allBlocks || []) as BlockRow[]}
    />
  )
}
