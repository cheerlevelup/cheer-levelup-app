// src/lib/coach/planEditorData.ts
// Dane edytora planu (PlanEditorClient) — wspólne dla ogólnej listy planów
// (/coach/plans/[id]) i edytora planu w zakładce Plan grupy samodzielnej.

type WeekRow = { id: number; plan_id: number; week_number: number; name?: string | null }
type DayRow = { id: number; week_id: number; day_name: string; day_order: number }

export async function loadPlanEditorData(supabase: any, planId: number) {
  const { data: plan } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('id', planId)
    .single()
  if (!plan) return null

  // Pełna struktura planu
  const { data: weeks } = await supabase
    .from('workout_weeks')
    .select('*')
    .eq('plan_id', planId)
    .order('week_number', { ascending: true })

  const weeksList = (weeks || []) as WeekRow[]
  const weekIds = weeksList.map(week => week.id)
  let days: DayRow[] = []
  let blocks: any[] = []

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
      blocks = blocksData || []
    }
  }

  // Lista ćwiczeń do wyboru
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, category')
    .order('name', { ascending: true })

  // Struktura wszystkich planów — do przenoszenia dni/bloków między planami
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

  return {
    plan,
    weeks: weeksList,
    days,
    blocks,
    exercises: exercises || [],
    allPlans: allPlans || [],
    allWeeks: allWeeksList,
    allDays: allDaysList,
    allBlocks: allBlocks || [],
  }
}
