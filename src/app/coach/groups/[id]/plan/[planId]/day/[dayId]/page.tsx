// src/app/coach/groups/[id]/plan/[planId]/day/[dayId]/page.tsx
// Trening z planu grupy samodzielnej uzupełniany przez trenera za zawodniczki —
// te same tabele co w aplikacji zawodniczki (workout_sessions, set_logs, pain_logs).
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DayFillClient from './DayFillClient'

interface Props {
  params: Promise<{ id: string; planId: string; dayId: string }>
}

export default async function GroupPlanDayPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id, planId: planIdRaw, dayId: dayIdRaw } = await params
  const groupId = parseInt(id), planId = parseInt(planIdRaw), dayId = parseInt(dayIdRaw)

  const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single()
  if (!group) redirect('/coach/groups')

  const { data: plan } = await supabase.from('workout_plans').select('id, name').eq('id', planId).single()
  if (!plan) redirect(`/coach/groups/${groupId}/plan`)

  const { data: day } = await supabase
    .from('workout_days')
    .select('*, week:workout_weeks(id, week_number, plan_id), workout_day_blocks(*, workout_block_exercises(*, exercise:exercises(id, name)))')
    .eq('id', dayId)
    .single()
  if (!day || (day.week as any)?.plan_id !== planId) redirect(`/coach/groups/${groupId}/plan`)

  const { data: rawAthletes } = await supabase
    .from('athletes').select('id, full_name, archived').eq('group_id', groupId).order('full_name', { ascending: true })
  const athletes = (rawAthletes || []).filter((a: any) => !a.archived).map((a: any) => ({ id: a.id, full_name: a.full_name }))
  const athleteIds = athletes.map(a => a.id)

  const blocks = ((day.workout_day_blocks || []) as any[])
    .sort((a, b) => a.block_order - b.block_order)
    .map(b => ({ ...b, workout_block_exercises: ((b.workout_block_exercises || []) as any[]).sort((x, y) => x.exercise_order - y.exercise_order) }))
  const exIds = blocks.flatMap(b => b.workout_block_exercises.map((e: any) => e.id))

  const blockIds = blocks.map(b => b.id)
  const [{ data: overrides }, { data: extras }, { data: sessions }, { data: assignments }] = await Promise.all([
    exIds.length && athleteIds.length
      ? supabase.from('athlete_exercise_overrides').select('*').in('block_exercise_id', exIds).in('athlete_id', athleteIds)
      : Promise.resolve({ data: [] as any[] }),
    // Dodatkowe ćwiczenia trenera dla pojedynczych zawodniczek (poza planem)
    blockIds.length && athleteIds.length
      ? supabase.from('athlete_extra_exercises').select('*, exercise:exercises(id, name)').in('block_id', blockIds).in('athlete_id', athleteIds).order('exercise_order', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    athleteIds.length
      ? supabase.from('workout_sessions').select('*').eq('workout_day_id', dayId).in('athlete_id', athleteIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    athleteIds.length
      ? supabase.from('athlete_workout_assignments').select('id, athlete_id, plan_id, is_active').eq('plan_id', planId).in('athlete_id', athleteIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Jedna sesja na zawodniczkę: niezakończona (tę zawodniczka widzi w aplikacji),
  // a jeśli takiej nie ma — ostatnia zakończona.
  const sessionByAthlete: Record<number, any> = {}
  for (const s of (sessions || []) as any[]) {
    const cur = sessionByAthlete[s.athlete_id]
    if (!cur || (cur.completed && !s.completed)) sessionByAthlete[s.athlete_id] = s
  }
  const sessionIds = Object.values(sessionByAthlete).map((s: any) => s.id)

  // Serie robocze i rozgrzewkowe — ćwiczenia z planu i dodatkowe (u zawodniczki
  // seria dodatkowego ćwiczenia ma block_exercise_id = id z athlete_extra_exercises)
  const logExIds = [...exIds, ...((extras || []) as any[]).map(e => e.id)]
  const [{ data: setLogs }, { data: painLogs }] = await Promise.all([
    sessionIds.length && logExIds.length
      ? supabase.from('set_logs').select('*').in('workout_session_id', sessionIds).in('block_exercise_id', logExIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    sessionIds.length
      ? supabase.from('pain_logs').select('*').in('workout_session_id', sessionIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Przypisanie planu per zawodniczka (aktywne najpierw) — do assignment_id nowej sesji
  const assignmentByAthlete: Record<number, number> = {}
  for (const a of (assignments || []) as any[]) {
    if (a.is_active || assignmentByAthlete[a.athlete_id] == null) assignmentByAthlete[a.athlete_id] = a.id
  }

  // Pozostałe treningi planu — szybkie przełączanie
  const { data: weeks } = await supabase.from('workout_weeks').select('id, week_number').eq('plan_id', planId)
  const weekNum = new Map((weeks || []).map((w: any) => [w.id, w.week_number]))
  const { data: planDays } = (weeks || []).length
    ? await supabase.from('workout_days').select('id, week_id, day_name, day_order').in('week_id', (weeks || []).map((w: any) => w.id))
    : { data: [] as any[] }
  const dayNav = ((planDays || []) as any[])
    .map(d => ({ id: d.id, day_name: d.day_name, week_number: weekNum.get(d.week_id) ?? 1, day_order: d.day_order }))
    .sort((a, b) => a.week_number - b.week_number || a.day_order - b.day_order)

  return (
    <DayFillClient
      group={{ id: group.id, name: group.name }}
      plan={plan}
      day={{ id: day.id, day_name: day.day_name }}
      dayNav={dayNav}
      blocks={blocks}
      athletes={athletes}
      overrides={overrides || []}
      extras={extras || []}
      sessions={Object.values(sessionByAthlete)}
      setLogs={setLogs || []}
      painLogs={painLogs || []}
      assignmentByAthlete={assignmentByAthlete}
    />
  )
}
