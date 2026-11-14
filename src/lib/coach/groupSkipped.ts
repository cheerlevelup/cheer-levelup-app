// Ćwiczenia / serie „niewykonane” zaznaczane przez trenera w edytorze planu grupy.
// Ten sam zapis co w „Wpisuj wyniki” i u zawodniczki: set_logs.skipped (migracja 202611120004)
// w sesji zawodniczki (workout_sessions) dla danego treningu. Plik tylko kliencki —
// bez importów serwerowych (next/headers).
import { createClient } from '@/utils/supabase/client'

type Session = { id: number; athlete_id: number; workout_day_id: number; completed: boolean; created_at?: string }
export type SkipLog = { id: number; workout_session_id: number; block_exercise_id: number; set_number: number; weight: number | null; reps_completed: number | null; skipped?: boolean | null }
type Override = { athlete_id: number; block_exercise_id: number; sets_override?: number | null; skip?: boolean | null }

export type SkipState = {
  // sesja zawodniczki na dany trening: klucz `${dayId}_${athleteId}`
  sessions: Record<string, Session>
  // najnowsza seria robocza: klucz `${sessionId}_${exId}_${setNum}`
  logs: Record<string, SkipLog>
  absent: Record<number, number[]>
  overrides: Record<string, Override>
  assignmentByAthlete: Record<number, number>
}

export const emptySkipState: SkipState = { sessions: {}, logs: {}, absent: {}, overrides: {}, assignmentByAthlete: {} }
export const sessKey = (dayId: number, athleteId: number) => `${dayId}_${athleteId}`
export const skipLogKey = (sessionId: number, exId: number, setNum: number) => `${sessionId}_${exId}_${setNum}`
export const ovKey = (athleteId: number, exId: number) => `${athleteId}_${exId}`

export async function loadSkipState(planId: number, dayIds: number[], exIds: number[], athleteIds: number[]): Promise<SkipState> {
  if (!dayIds.length || !athleteIds.length) return emptySkipState
  const supabase = createClient()
  const [{ data: sessions }, { data: days }, { data: overrides }, { data: assignments }] = await Promise.all([
    supabase.from('workout_sessions').select('id, athlete_id, workout_day_id, completed, created_at').in('workout_day_id', dayIds).in('athlete_id', athleteIds).order('created_at', { ascending: false }),
    supabase.from('workout_days').select('id, absent_athlete_ids').in('id', dayIds),
    exIds.length
      ? supabase.from('athlete_exercise_overrides').select('athlete_id, block_exercise_id, sets_override, skip').in('block_exercise_id', exIds).in('athlete_id', athleteIds)
      : Promise.resolve({ data: [] as Override[] }),
    supabase.from('athlete_workout_assignments').select('id, athlete_id, is_active').eq('plan_id', planId).in('athlete_id', athleteIds).order('created_at', { ascending: false }),
  ])
  // Jedna sesja na zawodniczkę i trening — jak w „Wpisuj wyniki”: niezakończona, inaczej ostatnia
  const sess: Record<string, Session> = {}
  for (const s of (sessions || []) as Session[]) {
    const k = sessKey(s.workout_day_id, s.athlete_id)
    const cur = sess[k]
    if (!cur || (cur.completed && !s.completed)) sess[k] = s
  }
  const sessionIds = Object.values(sess).map(s => s.id)
  const logs: Record<string, SkipLog> = {}
  if (sessionIds.length && exIds.length) {
    const { data } = await supabase.from('set_logs').select('*').in('workout_session_id', sessionIds).in('block_exercise_id', exIds).eq('is_warmup', false).order('created_at', { ascending: false })
    for (const l of (data || []) as SkipLog[]) {
      const k = skipLogKey(l.workout_session_id, l.block_exercise_id, l.set_number)
      if (!logs[k]) logs[k] = l // najnowszy wygrywa
    }
  }
  const absent: Record<number, number[]> = {}
  for (const d of (days || []) as { id: number; absent_athlete_ids?: number[] | null }[]) absent[d.id] = d.absent_athlete_ids || []
  const ov: Record<string, Override> = {}
  for (const o of (overrides || []) as Override[]) ov[ovKey(o.athlete_id, o.block_exercise_id)] = o
  const assignmentByAthlete: Record<number, number> = {}
  for (const a of (assignments || []) as { id: number; athlete_id: number; is_active: boolean }[]) {
    if (a.is_active || assignmentByAthlete[a.athlete_id] == null) assignmentByAthlete[a.athlete_id] = a.id
  }
  return { sessions: sess, logs, absent, overrides: ov, assignmentByAthlete }
}

async function ensureSession(state: SkipState, dayId: number, athleteId: number): Promise<{ session: Session | null; error?: string }> {
  const k = sessKey(dayId, athleteId)
  if (state.sessions[k]) return { session: state.sessions[k] }
  const supabase = createClient()
  const { data, error } = await supabase.from('workout_sessions').insert({
    athlete_id: athleteId, workout_day_id: dayId, assignment_id: state.assignmentByAthlete[athleteId] ?? null,
    completed: false, report_sent: false,
  }).select('id, athlete_id, workout_day_id, completed, created_at').single()
  if (data) return { session: data as Session }
  // zawodniczka mogła właśnie otworzyć trening u siebie — weź jej sesję
  const { data: existing } = await supabase.from('workout_sessions').select('id, athlete_id, workout_day_id, completed, created_at')
    .eq('athlete_id', athleteId).eq('workout_day_id', dayId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) return { session: existing as Session }
  return {
    session: null,
    error: /policy|permission|row-level/i.test(error?.message || '')
      ? 'Brak uprawnień do zapisu za zawodniczkę — uruchom migrację 202610050001.'
      : (error?.message || 'Nie udało się utworzyć treningu zawodniczki'),
  }
}

// Zaznacza (skip = true) albo cofa niewykonanie wskazanych serii ćwiczenia u podanych zawodniczek.
// Serie z wpisanym wynikiem (ciężar / powtórzenia) zostają — zawodniczka je zrobiła.
export async function setSkipped(
  state: SkipState, dayId: number, exId: number,
  targets: { athleteId: number; setNums: number[] }[], skip: boolean,
): Promise<{ state: SkipState; error?: string }> {
  const supabase = createClient()
  const sessions = { ...state.sessions }
  const logs = { ...state.logs }
  let error: string | undefined
  await Promise.all(targets.map(async t => {
    // przy cofaniu nie zakładamy nowej sesji — nie ma czego cofać
    const existing = sessions[sessKey(dayId, t.athleteId)]
    if (!skip && !existing) return
    const { session, error: sErr } = existing ? { session: existing, error: undefined } : await ensureSession(state, dayId, t.athleteId)
    if (!session) { error = error || sErr; return }
    sessions[sessKey(dayId, t.athleteId)] = session
    for (const n of t.setNums) {
      const key = skipLogKey(session.id, exId, n)
      const prev = logs[key]
      if (skip ? (prev?.skipped || prev?.weight != null || prev?.reps_completed != null) : !prev?.skipped) continue
      const res = prev
        ? await supabase.from('set_logs').update(skip ? { skipped: true, completed: false } : { skipped: false }).eq('id', prev.id).select().single()
        : await supabase.from('set_logs').insert({
          workout_session_id: session.id, block_exercise_id: exId, athlete_id: t.athleteId, set_number: n, is_warmup: false,
          weight: null, reps_completed: null, completed: false, skipped: true,
        }).select().single()
      if (res.error || !res.data) {
        error = error || (/skipped/.test(res.error?.message || '') ? 'Aby oznaczać ćwiczenia jako niewykonane, uruchom migrację 202611120004.' : (res.error?.message || 'Błąd zapisu'))
        return
      }
      logs[key] = res.data as SkipLog
    }
  }))
  return { state: { ...state, sessions, logs }, error }
}
