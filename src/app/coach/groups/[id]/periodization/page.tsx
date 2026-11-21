export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/periodization/page.tsx
// Zakładka „Periodyzacja": programy treningowe drużyny (makro → mezo → mikrocykle → jednostki)
// zbudowane na istniejących planach (workout_plans / weeks / days), z realizacją
// liczoną z sesji zawodniczek (workout_sessions, set_logs, post_session_feedback).
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import PeriodizationClient from './PeriodizationClient'
import { programPhase, type Program } from '@/lib/coach/periodization'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ p?: string }>
}

export default async function GroupPeriodizationPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params
  const sp = await searchParams
  const groupId = parseInt(id)

  const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single()
  if (!group) redirect('/coach/groups')

  const { data: rawAthletes } = await supabase.from('athletes').select('id, full_name, archived').eq('group_id', groupId).order('full_name', { ascending: true })
  const athletes = ((rawAthletes || []) as any[]).filter(a => !a.archived).map(a => ({ id: a.id as number, full_name: a.full_name as string }))

  const base = { group, athletes }

  const { data: programsRaw, error: progErr } = await supabase
    .from('periodization_programs')
    .select('*')
    .or(`group_id.eq.${groupId},is_template.eq.true`)
    .order('start_date', { ascending: false, nullsFirst: false })
  if (progErr) {
    return <PeriodizationClient {...base} migrationMissing programs={[]} selected={null} />
  }
  const programs = (programsRaw || []) as Program[]
  const own = programs.filter(p => !p.is_template)

  const wanted = sp.p ? parseInt(sp.p) : null
  const selected = programs.find(p => p.id === wanted)
    ?? own.find(p => programPhase(p) === 'active')
    ?? own.find(p => programPhase(p) === 'planned')
    ?? own.find(p => !p.archived)
    ?? null

  // szablony jednostek (biblioteka)
  const { data: unitPlan } = await supabase.from('workout_plans').select('id').eq('template_kind', 'unit').limit(1).maybeSingle()
  let unitTemplates: { id: number; day_name: string | null; goal: string | null }[] = []
  if (unitPlan) {
    const { data: tw } = await supabase.from('workout_weeks').select('id').eq('plan_id', (unitPlan as any).id)
    const twIds = ((tw || []) as any[]).map(w => w.id)
    if (twIds.length) {
      const { data: td } = await supabase.from('workout_days').select('id, day_name, goal').in('week_id', twIds).order('day_name')
      unitTemplates = (td || []) as any[]
    }
  }

  // wydarzenia drużyny z kalendarza sezonu (zawody, obozy, przerwy...)
  const { data: eventsRaw } = await supabase
    .from('calendar_events')
    .select('id, title, event_type, start_date, end_date, group_ids, all_groups')
    .neq('event_type', 'training')
    .order('start_date', { ascending: true })
  const events = ((eventsRaw || []) as any[]).filter(e => e.all_groups || (e.group_ids || []).map(Number).includes(groupId))

  if (!selected) {
    return <PeriodizationClient {...base} programs={programs} selected={null} unitTemplates={unitTemplates} events={events} />
  }

  const [{ data: macros }, { data: mesos }] = await Promise.all([
    supabase.from('periodization_macrocycles').select('*').eq('program_id', selected.id).order('sort_order'),
    supabase.from('periodization_mesocycles').select('*').eq('program_id', selected.id).order('sort_order'),
  ])

  let weeks: any[] = []
  let units: any[] = []
  let assignments: any[] = []
  let sessions: any[] = []
  if (selected.plan_id) {
    const [{ data: w }, { data: asg }] = await Promise.all([
      supabase.from('workout_weeks').select('*').eq('plan_id', selected.plan_id).order('week_number'),
      supabase.from('athlete_workout_assignments').select('id, athlete_id, is_active, assignment_type, created_at').eq('plan_id', selected.plan_id),
    ])
    weeks = w || []
    assignments = asg || []
    const weekIds = weeks.map(x => x.id)
    if (weekIds.length) {
      const { data: d } = await supabase.from('workout_days').select('*').in('week_id', weekIds).order('day_order')
      units = d || []
    }
    const dayIds = units.map(u => u.id)
    if (dayIds.length) {
      // liczba ćwiczeń w jednostce
      const { data: blocks } = await supabase.from('workout_day_blocks').select('day_id, workout_block_exercises(count)').in('day_id', dayIds)
      const exCount = new Map<number, number>()
      for (const b of (blocks || []) as any[]) exCount.set(b.day_id, (exCount.get(b.day_id) || 0) + (b.workout_block_exercises?.[0]?.count || 0))
      units = units.map(u => ({ ...u, exercise_count: exCount.get(u.id) || 0 }))

      const { data: s } = await supabase
        .from('workout_sessions')
        .select('id, athlete_id, workout_day_id, completed, created_at, date_completed')
        .in('workout_day_id', dayIds)
        .order('created_at', { ascending: false })
      // jedna sesja na zawodniczkę i jednostkę: ukończona wygrywa, inaczej najnowsza
      const best = new Map<string, any>()
      for (const x of (s || []) as any[]) {
        const k = `${x.workout_day_id}_${x.athlete_id}`
        const cur = best.get(k)
        if (!cur || (!cur.completed && x.completed)) best.set(k, x)
      }
      sessions = [...best.values()]
      const sIds = sessions.map(x => x.id)
      if (sIds.length) {
        const [{ data: fb }, { data: logs }] = await Promise.all([
          supabase.from('post_session_feedback').select('workout_session_id, session_id, session_rpe').or(`workout_session_id.in.(${sIds.join(',')}),session_id.in.(${sIds.join(',')})`),
          supabase.from('set_logs').select('workout_session_id, weight, reps_completed, skipped, is_warmup').in('workout_session_id', sIds),
        ])
        const rpe = new Map<number, number>()
        for (const f of (fb || []) as any[]) {
          const sid = f.workout_session_id ?? f.session_id
          if (sid != null && f.session_rpe != null) rpe.set(sid, Number(f.session_rpe))
        }
        const logged = new Map<number, number>()
        const skipped = new Map<number, number>()
        for (const l of (logs || []) as any[]) {
          if (l.is_warmup) continue
          if (l.skipped) skipped.set(l.workout_session_id, (skipped.get(l.workout_session_id) || 0) + 1)
          else if (l.weight != null || l.reps_completed != null) logged.set(l.workout_session_id, (logged.get(l.workout_session_id) || 0) + 1)
        }
        sessions = sessions.map(x => ({ ...x, rpe: rpe.get(x.id) ?? null, logged_sets: logged.get(x.id) || 0, skipped_sets: skipped.get(x.id) || 0 }))
      }
    }
  }

  return (
    <PeriodizationClient
      {...base}
      programs={programs}
      selected={selected}
      macros={macros || []}
      mesos={mesos || []}
      weeks={weeks}
      units={units}
      assignments={assignments}
      sessions={sessions}
      unitTemplates={unitTemplates}
      events={events}
    />
  )
}
