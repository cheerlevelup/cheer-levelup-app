export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachGroupDetailClient from './CoachGroupDetailClient'
import ManagedGroupClient from './ManagedGroupClient'

interface Props {
  params: Promise<{ id: string }>
}

// Dane do „Rozpocznij trening" (grupy zorganizowane i samodzielne): plany do wyboru
// (aktywny plan grupy, wcześniejsze plany grupy, biblioteka) i rozpoczęte treningi z planów
async function loadStartPlans(supabase: any, groupId: number, athletes: any[]) {
  // Plany do „Rozpocznij trening": aktywny plan grupy, wcześniejsze plany grupy, biblioteka
  const ids = athletes.map((a: any) => a.id)
  const [{ data: groupAssign }, { data: allPlans }] = await Promise.all([
    ids.length
      ? supabase.from('athlete_workout_assignments').select('*').in('athlete_id', ids).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('workout_plans').select('*').order('created_at', { ascending: false }),
  ])
  const grp = ((groupAssign || []) as any[]).filter(a => a.assignment_type !== 'individual')
  const counts = new Map<number, number>()
  for (const a of grp) if (a.is_active) counts.set(a.plan_id, (counts.get(a.plan_id) || 0) + 1)
  const activePlanId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const groupPlanIds = new Set([...grp.map(a => a.plan_id), ...((allPlans || []) as any[]).filter(p => p.group_id === groupId).map(p => p.id)])
  const startPlans = ((allPlans || []) as any[])
    .filter(p => p.id === activePlanId || groupPlanIds.has(p.id) || (!p.group_id && !p.athlete_id && !p.is_archived))
    .map(p => ({ id: p.id as number, name: p.name as string, tag: (p.id === activePlanId ? 'active' : groupPlanIds.has(p.id) ? 'group' : 'library') as 'active' | 'group' | 'library' }))

  // Treningi z planów grupy z ustawioną datą (rozpoczęte) — do kontynuowania / listy
  let planTrainings: { id: number; plan_id: number; plan_name: string; day_name: string | null; training_date: string }[] = []
  if (groupPlanIds.size) {
    const { data: weeks } = await supabase.from('workout_weeks').select('id, plan_id').in('plan_id', [...groupPlanIds])
    const planByWeek = new Map(((weeks || []) as any[]).map(w => [w.id, w.plan_id]))
    const { data: dated } = planByWeek.size
      ? await supabase.from('workout_days').select('id, week_id, day_name, training_date').in('week_id', [...planByWeek.keys()]).not('training_date', 'is', null).order('training_date', { ascending: false }).limit(30)
      : { data: [] as any[] }
    const nameById = new Map(((allPlans || []) as any[]).map(p => [p.id, p.name]))
    planTrainings = ((dated || []) as any[]).map(d => {
      const pid = planByWeek.get(d.week_id)
      return { id: d.id, plan_id: pid, plan_name: nameById.get(pid) || 'Plan', day_name: d.day_name, training_date: d.training_date }
    })
  }

  return { startPlans, planTrainings }
}

export default async function CoachGroupDetailPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params
  const groupId = parseInt(id)

  // Pobierz grupę
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (!group) redirect('/coach/groups')

  // Zawodniczki w grupie (bez zarchiwizowanych — te widoczne są tylko w archiwum)
  const { data: allGroupAthletes } = await supabase
    .from('athletes')
    .select('*')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  const athletes = (allGroupAthletes || []).filter((a: any) => !a.archived)

  // Grupa zorganizowana (np. Ultra) — osobny panel prowadzony przez trenera
  if ((group as any).group_type === 'managed') {
    const { data: trainings } = await supabase
      .from('group_trainings')
      .select('*')
      .eq('group_id', groupId)
      .order('training_date', { ascending: false })

    const { startPlans, planTrainings } = await loadStartPlans(supabase, groupId, athletes)

    return (
      <ManagedGroupClient
        group={group}
        athletes={athletes || []}
        trainings={trainings || []}
        startPlans={startPlans}
        planTrainings={planTrainings}
      />
    )
  }

  if (!athletes || athletes.length === 0) {
    const empty = await loadStartPlans(supabase, groupId, [])
    return <CoachGroupDetailClient group={group} athletes={[]} assignments={[]} days={[]} sessions={[]} startPlans={empty.startPlans} planTrainings={[]} />
  }

  const athleteIds = athletes.map((a: any) => a.id)

  // Aktywne przypisania planów
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

  // plany indywidualne zawodniczek nie są planem grupy
  const allAssignments = [...(groupAssignments || []), ...(athleteAssignments || [])].filter((a: any) => a.assignment_type !== 'individual')

  // Historia wszystkich przypisań (aktywne + archiwalne)
  const { data: allGroupAssignmentsHistory } = await supabase
    .from('athlete_workout_assignments')
    .select('*, plan:workout_plans(*)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  // Wszystkie plany z archiwum
  const { data: archivedPlans } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('is_archived', true)
    .order('created_at', { ascending: false })

  // Pobierz dni treningowe dla wszystkich planów
  let days: any[] = []
  const planIds = [...new Set(allAssignments.map((a: any) => a.plan_id))]

  if (planIds.length > 0) {
    const { data: weeks } = await supabase
      .from('workout_weeks')
      .select('id, week_number, plan_id')
      .in('plan_id', planIds)

    const weekIds = (weeks || []).map((w: any) => w.id)

    if (weekIds.length > 0) {
      const { data: daysData } = await supabase
        .from('workout_days')
        .select('*, week:workout_weeks(week_number, plan_id)')
        .in('week_id', weekIds)
        .order('week_id', { ascending: true })
        .order('day_order', { ascending: true })

      days = daysData || []
    }
  }

  // Ukończone sesje dla zawodniczek
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('*')
    .in('athlete_id', athleteIds)
    .order('date_completed', { ascending: false })

  // Wszystkie plany (do przypisywania)
  const { data: plans } = await supabase
    .from('workout_plans')
    .select('id, name, is_archived')
    .order('created_at', { ascending: false })

  // Wellness z ostatnich 30 dni (do statystyk)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: wellnessLogs } = await supabase
    .from('wellness_logs')
    .select('*')
    .in('athlete_id', athleteIds)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  // Feedback po sesjach (RPE, nastrój)
  const { data: feedbacks } = await supabase
    .from('post_session_feedback')
    .select('*, workout_session:workout_sessions(workout_day_id, date_completed)')
    .in('athlete_id', athleteIds)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  return (
    <CoachGroupDetailClient
      group={group}
      athletes={athletes}
      assignments={allAssignments}
      days={days}
      sessions={sessions || []}
      plans={plans || []}
      wellnessLogs={wellnessLogs || []}
      feedbacks={feedbacks || []}
      assignmentsHistory={allGroupAssignmentsHistory || []}
      archivedPlans={(archivedPlans || []).filter((p: any) => !p.template_kind)}
      {...await loadStartPlans(supabase, groupId, athletes)}
    />
  )
}
