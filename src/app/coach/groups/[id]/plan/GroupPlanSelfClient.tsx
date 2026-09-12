'use client'
// src/app/coach/groups/[id]/plan/GroupPlanSelfClient.tsx
// Zakładka "Plan" grupy samodzielnej — obciążenia z aktywnego planu (ćwiczenia ×
// zawodniczki), z modyfikacjami trenera i faktycznymi danymi z treningu.
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, Card } from '@/components/coach/ui'
import PlanExerciseTable, { ActualEntry, PainEntry } from '@/components/coach/PlanExerciseTable'
import { dedupeLogs } from '@/lib/coach/dedupeLogs'

type Group = { id: number; name: string }
type PlanDay = { id: number; day_name?: string | null }
type Plan = { id: number; name: string } | null

interface Props {
  group: Group
  athletes: any[]
  currentPlan: Plan
  activePlanDays: PlanDay[]
}

type PlanExData = {
  blocks: any[]
  overrides: Record<number, Record<number, any>>
  actual: Record<number, Record<number, ActualEntry>>
  painByAthleteDay?: Record<number, Set<number>>
  painByAthleteEx?: Record<number, Record<string, PainEntry>>
}

export default function GroupPlanSelfClient({ group, athletes, currentPlan, activePlanDays }: Props) {
  const [planExData, setPlanExData] = useState<PlanExData | null>(null)
  const [planExLoading, setPlanExLoading] = useState(false)

  async function loadPlanExercises() {
    if (planExData || planExLoading || !currentPlan) return
    setPlanExLoading(true)
    const sb = createClient()
    const planDayIds = activePlanDays.map(d => d.id)
    const athleteIds2 = athletes.map((a: any) => a.id)

    // Bloki + ćwiczenia z planu
    const { data: blocks } = await sb
      .from('workout_day_blocks')
      .select('id, day_id, block_name, block_order, rounds, workout_block_exercises(id, exercise_id, exercise_code, exercise_order, sets, reps, weight_kg, tempo, rir, coach_comment, exercise:exercises(name))')
      .in('day_id', planDayIds)
      .order('block_order')

    const allExIds = (blocks || []).flatMap((b: any) => (b.workout_block_exercises || []).map((e: any) => e.id))

    // Indywidualne modyfikacje (override planu przez trenera)
    const { data: ovrs } = allExIds.length > 0
      ? await sb.from('athlete_exercise_overrides')
          .select('athlete_id, block_exercise_id, weight_override, sets_override, reps_override, tempo_override, skip')
          .in('block_exercise_id', allExIds)
          .in('athlete_id', athleteIds2)
      : { data: [] }

    const ovrMap: Record<number, Record<number, any>> = {}
    for (const o of (ovrs || [])) {
      if (!ovrMap[o.block_exercise_id]) ovrMap[o.block_exercise_id] = {}
      ovrMap[o.block_exercise_id][o.athlete_id] = o
    }

    // Faktyczne dane treningowe z set_logs (sesje dla tych dni i zawodniczek)
    const { data: sessionsForPlan } = await sb
      .from('workout_sessions')
      .select('id, athlete_id, workout_day_id')
      .in('workout_day_id', planDayIds)
      .in('athlete_id', athleteIds2)
      .eq('completed', true)

    const sessionIds = (sessionsForPlan || []).map((s: any) => s.id)

    const sessionAthleteMap: Record<number, number> = {}
    for (const s of (sessionsForPlan || [])) sessionAthleteMap[s.id] = s.athlete_id

    const actualMap: Record<number, Record<number, ActualEntry>> = {}

    if (sessionIds.length > 0 && allExIds.length > 0) {
      const { data: logs } = await sb
        .from('set_logs')
        .select('id, created_at, workout_session_id, block_exercise_id, set_number, weight, reps_completed, completed, is_warmup, athlete_note')
        .in('workout_session_id', sessionIds)
        .in('block_exercise_id', allExIds)
        .eq('is_warmup', false)
        .order('set_number', { ascending: true })

      for (const l of dedupeLogs(logs || [])) {
        const athleteId = sessionAthleteMap[l.workout_session_id]
        if (!athleteId) continue
        if (!actualMap[l.block_exercise_id]) actualMap[l.block_exercise_id] = {}
        if (!actualMap[l.block_exercise_id][athleteId]) actualMap[l.block_exercise_id][athleteId] = { sets: [] }
        actualMap[l.block_exercise_id][athleteId].sets.push({
          num: l.set_number,
          weight: l.weight ?? null,
          reps: l.reps_completed ?? null,
          note: l.athlete_note ?? null,
        })
      }
    }

    const painByAthleteDay: Record<number, Set<number>> = {}
    const painByAthleteEx: Record<number, Record<string, PainEntry>> = {}

    if (sessionIds.length > 0) {
      const { data: painLogs } = await sb
        .from('pain_logs')
        .select('workout_session_id, vas_score, pain_comment, pain_location')
        .in('workout_session_id', sessionIds)

      const sessionDayMap: Record<number, number> = {}
      for (const s of (sessionsForPlan || [])) sessionDayMap[s.id] = s.workout_day_id

      for (const p of (painLogs || [])) {
        if (!p.vas_score && !p.pain_comment) continue
        const athleteId = sessionAthleteMap[p.workout_session_id]
        const dayId = sessionDayMap[p.workout_session_id]
        if (!athleteId) continue
        if (dayId) {
          if (!painByAthleteDay[athleteId]) painByAthleteDay[athleteId] = new Set()
          painByAthleteDay[athleteId].add(dayId)
        }
        if (p.pain_location) {
          const key = p.pain_location.toLowerCase().replace(/-/g, ' ').trim()
          if (!painByAthleteEx[athleteId]) painByAthleteEx[athleteId] = {}
          painByAthleteEx[athleteId][key] = { vas: p.vas_score ?? 0, comment: p.pain_comment ?? null }
        }
      }
    }

    setPlanExData({ blocks: blocks || [], overrides: ovrMap, actual: actualMap, painByAthleteDay, painByAthleteEx })
    setPlanExLoading(false)
  }

  useEffect(() => {
    if (currentPlan && activePlanDays.length > 0) loadPlanExercises()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan?.id])

  const fmt = (s: string) => s.replace(/-/g, ' ')

  return (
    <>
      <SetPageMeta title="Plan" backHref={`/coach/groups/${group.id}`} backLabel={group.name} />
      <TabsNav items={[
        { key: 'treningi', label: 'Treningi', href: `/coach/groups/${group.id}` },
        { key: 'plan', label: 'Plan', href: `/coach/groups/${group.id}/plan` },
        { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${group.id}/stats` },
        { key: 'obecnosc', label: 'Obecność', href: `/coach/groups/${group.id}/attendance` },
        { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${group.id}/athletes` },
        { key: 'testy', label: 'Testy', href: `/coach/groups/${group.id}/tests` },
      ]} />
      <div className="coach-content">
        {athletes.length === 0 ? (
          <Card><div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-light)' }}>Brak zawodniczek w tej grupie.</div></Card>
        ) : !currentPlan || activePlanDays.length === 0 ? (
          <Card><div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-light)' }}>Brak przypisanego planu.</div></Card>
        ) : (
          <Card>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Obciążenia z planu</div>
                <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>{currentPlan.name} — ćwiczenia × zawodniczki</div>
              </div>
              {planExLoading && (
                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', color: 'var(--muted-light)' }}>Ładuję...</span>
              )}
            </div>
            {planExData && (() => {
              type ExRow = { exId: number; name: string; block: string; day: string; dayId: number; sets: number; reps: string; tempo: string; weight: number | null }
              const rows: ExRow[] = []
              for (const day of activePlanDays) {
                const dayBlocks = planExData.blocks.filter((b: any) => b.day_id === day.id).sort((a: any, z: any) => a.block_order - z.block_order)
                for (const block of dayBlocks) {
                  const exs = (block.workout_block_exercises || []).sort((a: any, z: any) => a.exercise_order - z.exercise_order)
                  for (const ex of exs) {
                    rows.push({
                      exId: ex.id,
                      name: ex.exercise?.name ? fmt(ex.exercise.name) : (ex.exercise_code || 'Ćwiczenie'),
                      block: block.block_name,
                      day: day.day_name || `T${activePlanDays.indexOf(day) + 1}`,
                      dayId: day.id,
                      sets: ex.sets ?? 0,
                      reps: ex.reps ?? '',
                      tempo: ex.tempo ?? '',
                      weight: ex.weight_kg ?? null,
                    })
                  }
                }
              }

              if (rows.length === 0) return (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', color: 'var(--muted-light)' }}>Brak ćwiczeń w planie.</div>
              )

              const uniqueDays = activePlanDays.map((d, i) => ({ id: d.id, label: d.day_name || `T${i + 1}` }))
              return <PlanExerciseTable rows={rows} athletes={athletes} overrides={planExData.overrides} actual={planExData.actual || {}} uniqueDays={uniqueDays} painByAthleteDay={planExData.painByAthleteDay} painByAthleteEx={planExData.painByAthleteEx} />
            })()}
          </Card>
        )}
      </div>
    </>
  )
}
