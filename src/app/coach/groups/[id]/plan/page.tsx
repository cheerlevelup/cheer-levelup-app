export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/plan/page.tsx
// Zakładka "Plan": dla grup zorganizowanych — na razie pusty placeholder; dla grup
// samodzielnych — obciążenia z aktywnego planu (ćwiczenia × zawodniczki).
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GroupPlanClient from './GroupPlanClient'
import GroupPlanSelfClient from './GroupPlanSelfClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupPlanPage({ params }: Props) {
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
    .select('*')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  const athletes = (rawAthletes || []).filter((a: any) => !a.archived)

  if ((group as any).group_type === 'managed') {
    return <GroupPlanClient group={group} athletesCount={athletes.length} />
  }

  const athleteIds = athletes.map((a: any) => a.id)

  const { data: groupAssignments } = await supabase
    .from('athlete_workout_assignments')
    .select('*, plan:workout_plans(*)')
    .eq('group_id', groupId)
    .eq('is_active', true)
  const { data: athleteAssignments } = athleteIds.length > 0
    ? await supabase
        .from('athlete_workout_assignments')
        .select('*, plan:workout_plans(*)')
        .in('athlete_id', athleteIds)
        .eq('is_active', true)
    : { data: [] }
  const allAssignments = [...(groupAssignments || []), ...(athleteAssignments || [])]
  const currentPlan = allAssignments[0]?.plan ?? null

  let activePlanDays: any[] = []
  if (currentPlan) {
    const { data: weeks } = await supabase
      .from('workout_weeks')
      .select('id, week_number, plan_id')
      .eq('plan_id', currentPlan.id)
    const weekIds = (weeks || []).map((w: any) => w.id)
    if (weekIds.length > 0) {
      const { data: daysData } = await supabase
        .from('workout_days')
        .select('*, week:workout_weeks(week_number, plan_id)')
        .in('week_id', weekIds)
        .order('week_id', { ascending: true })
        .order('day_order', { ascending: true })
      activePlanDays = daysData || []
    }
  }

  // Plany tej grupy (tworzone w zakładce Plan) + aktywny plan, nawet jeśli jest ogólny.
  // Brak migracji 202610050001 (kolumna group_id) — lista pokazuje tylko aktywny plan.
  const { data: ownPlans } = await supabase
    .from('workout_plans')
    .select('id, name, is_archived, created_at, group_id')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  const planList: any[] = [...(ownPlans || [])]
  if (currentPlan && !planList.some(p => p.id === currentPlan.id)) planList.unshift(currentPlan)

  // Treningi (dni) każdego planu — do linków „Uzupełnij"
  const listPlanIds = planList.map(p => p.id)
  const { data: listWeeks } = listPlanIds.length > 0
    ? await supabase.from('workout_weeks').select('id, plan_id, week_number').in('plan_id', listPlanIds)
    : { data: [] }
  const listWeekIds = (listWeeks || []).map((w: any) => w.id)
  const { data: listDays } = listWeekIds.length > 0
    ? await supabase.from('workout_days').select('*').in('week_id', listWeekIds)
    : { data: [] }
  const weekById = new Map((listWeeks || []).map((w: any) => [w.id, w]))

  // Ile zawodniczek ma dany trening zakończony
  const listDayIds = (listDays || []).map((d: any) => d.id)
  const { data: doneSessions } = listDayIds.length > 0 && athleteIds.length > 0
    ? await supabase.from('workout_sessions').select('athlete_id, workout_day_id')
        .in('workout_day_id', listDayIds).in('athlete_id', athleteIds).eq('completed', true)
    : { data: [] }
  const doneByDay = new Map<number, Set<number>>()
  for (const s of (doneSessions || []) as any[]) {
    if (!doneByDay.has(s.workout_day_id)) doneByDay.set(s.workout_day_id, new Set())
    doneByDay.get(s.workout_day_id)!.add(s.athlete_id)
  }

  const groupPlans = planList.map(p => ({
    id: p.id,
    name: p.name,
    is_archived: !!p.is_archived,
    owned: p.group_id === groupId,
    days: (listDays || [])
      .filter((d: any) => (weekById.get(d.week_id) as any)?.plan_id === p.id)
      .map((d: any) => ({ id: d.id, day_name: d.day_name, day_order: d.day_order, week_number: (weekById.get(d.week_id) as any)?.week_number ?? 1, done: doneByDay.get(d.id)?.size ?? 0, absent: (d.absent_athlete_ids || []).filter((id: number) => athleteIds.includes(id)).length }))
      .sort((a: any, b: any) => a.week_number - b.week_number || a.day_order - b.day_order),
  }))

  return (
    <GroupPlanSelfClient
      group={group}
      athletes={athletes}
      currentPlan={currentPlan}
      activePlanDays={activePlanDays}
      groupPlans={groupPlans}
    />
  )
}
