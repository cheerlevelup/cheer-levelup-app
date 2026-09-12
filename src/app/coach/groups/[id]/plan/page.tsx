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

  if (athletes.length === 0) {
    return <GroupPlanSelfClient group={group} athletes={[]} currentPlan={null} activePlanDays={[]} />
  }

  const athleteIds = athletes.map((a: any) => a.id)

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

  return (
    <GroupPlanSelfClient
      group={group}
      athletes={athletes}
      currentPlan={currentPlan}
      activePlanDays={activePlanDays}
    />
  )
}
