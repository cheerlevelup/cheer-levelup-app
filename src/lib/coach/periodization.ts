// src/lib/coach/periodization.ts
// Periodyzacja: Program → Makrocykl → Mezocykl → Mikrocykl → Jednostka treningowa.
// Program ma własny plan (workout_plans); mikrocykl = workout_weeks, jednostka = workout_days.
// Kopiowanie jednostek/tygodni/programów robi głęboką kopię bloków i ćwiczeń (z wariantami
// i indywidualnymi parametrami zawodniczek) — tak jak „kopiuj / wklej” w edytorze planu.
// Kopie NIGDY nie przenoszą sesji ani wyników zawodniczek.
import { insertExercisesWithVariants, copyExerciseOverrides } from '@/lib/exerciseVariants'

export type Program = {
  id: number
  group_id: number | null
  plan_id: number | null
  name: string
  description: string | null
  goal: string | null
  start_date: string | null
  end_date: string | null
  archived: boolean
  is_template: boolean
  created_at?: string
}
export type Macrocycle = { id: number; program_id: number; name: string; goal: string | null; start_date: string | null; end_date: string | null; notes: string | null; sort_order: number }
export type Mesocycle = { id: number; program_id: number; macrocycle_id: number | null; name: string; goal: string | null; weeks_count: number; start_date: string | null; end_date: string | null; notes: string | null; sort_order: number }
export type Microcycle = { id: number; plan_id: number; week_number: number; name?: string | null; start_date: string | null; end_date: string | null; goal: string | null; mesocycle_id: number | null }
export type Unit = { id: number; week_id: number; day_name: string | null; day_order: number; training_date: string | null; goal: string | null; absent_athlete_ids: number[] | null; exercise_count?: number }

export const MESO_GOALS = [
  'Przygotowanie ogólne',
  'Hipertrofia',
  'Siła maksymalna',
  'Moc',
  'Szybkość / plyometria',
  'Wytrzymałość siłowa',
  'Mobilność / technika',
  'Startowy (utrzymanie)',
  'Roztrenowanie / regeneracja',
]

// ---------- daty (YYYY-MM-DD, bez stref czasowych) ----------
export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parse(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
function fmt(d: Date) { return d.toISOString().slice(0, 10) }
export function addDays(s: string, n: number) { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d) }
export function diffDays(a: string, b: string) { return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000) }
export function mondayOf(s: string) { const d = parse(s); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return fmt(d) }
export function shiftDate(s: string | null | undefined, n: number) { return s ? addDays(s, n) : null }
const PL_MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
export function fmtShort(s: string | null | undefined) {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  return `${d} ${PL_MONTHS[m - 1]} ${y}`
}
export function fmtRange(a: string | null | undefined, b: string | null | undefined) {
  if (!a && !b) return 'bez dat'
  return `${fmtShort(a)} – ${fmtShort(b)}`
}
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb']
export function weekdayShort(s: string) { return WD[parse(s).getUTCDay()] }

export type ProgramPhase = 'archived' | 'template' | 'planned' | 'active' | 'finished'
export function programPhase(p: Program): ProgramPhase {
  if (p.is_template) return 'template'
  if (p.archived) return 'archived'
  const t = todayStr()
  if (p.start_date && p.start_date > t) return 'planned'
  if (p.end_date && p.end_date < t) return 'finished'
  return 'active'
}
export const PHASE_LABEL: Record<ProgramPhase, string> = { archived: 'archiwum', template: 'szablon', planned: 'zaplanowany', active: 'aktywny', finished: 'zakończony' }

const strip = (row: any, keys: string[]) => {
  const out = { ...row }
  for (const k of ['id', 'created_at', 'updated_at', ...keys]) delete out[k]
  return out
}

// ---------- kopiowanie ----------
// Bloki + ćwiczenia jednego treningu do innego (już istniejącego) treningu
async function copyDayContent(supabase: any, srcDayId: number, targetDayId: number) {
  const { data: blocks, error } = await supabase.from('workout_day_blocks').select('*').eq('day_id', srcDayId).order('block_order')
  if (error) throw error
  for (const b of (blocks || []) as any[]) {
    const { data: nb, error: bErr } = await supabase.from('workout_day_blocks').insert({ ...strip(b, ['day_id']), day_id: targetDayId }).select().single()
    if (bErr || !nb) throw bErr || new Error('Nie udało się skopiować bloku')
    const { data: exs, error: eErr } = await supabase.from('workout_block_exercises').select('*').eq('block_id', b.id).order('exercise_order')
    if (eErr) throw eErr
    if (!exs?.length) continue
    const { error: insErr, idMap } = await insertExercisesWithVariants(
      supabase, exs, (ex: any) => ({ ...strip(ex, ['block_id', 'variant_of', 'variant_athlete_ids', 'exercise']), block_id: nb.id }), 'id',
    )
    if (insErr) throw insErr
    await copyExerciseOverrides(supabase, idMap)
  }
}

// Kopia jednostki treningowej do mikrocyklu (domyślnie na koniec tygodnia)
export async function copyUnit(supabase: any, srcDayId: number, targetWeekId: number, patch: { day_name?: string | null; training_date?: string | null; day_order?: number } = {}) {
  const { data: src, error } = await supabase.from('workout_days').select('*').eq('id', srcDayId).single()
  if (error || !src) throw error || new Error('Brak treningu')
  let order = patch.day_order
  if (order == null) {
    const { data: sib } = await supabase.from('workout_days').select('day_order').eq('week_id', targetWeekId)
    order = Math.max(0, ...((sib || []) as any[]).map(d => d.day_order || 0)) + 1
  }
  const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  const row = { ...strip(src, ['week_id', 'absent_athlete_ids']), week_id: targetWeekId, ...cleanPatch, day_order: order }
  const { data: nd, error: dErr } = await supabase.from('workout_days').insert(row).select().single()
  if (dErr || !nd) throw dErr || new Error('Nie udało się skopiować treningu')
  await copyDayContent(supabase, srcDayId, nd.id)
  return nd
}

// Kopia mikrocyklu (tygodnia) z treningami; daty przesunięte o shiftDays
export async function copyMicrocycle(supabase: any, srcWeekId: number, target: { plan_id: number; mesocycle_id: number | null; week_number: number; shiftDays: number }) {
  const { data: src, error } = await supabase.from('workout_weeks').select('*').eq('id', srcWeekId).single()
  if (error || !src) throw error || new Error('Brak tygodnia')
  const { data: nw, error: wErr } = await supabase.from('workout_weeks').insert({
    ...strip(src, ['plan_id', 'mesocycle_id', 'week_number', 'start_date', 'end_date']),
    plan_id: target.plan_id,
    mesocycle_id: target.mesocycle_id,
    week_number: target.week_number,
    name: `Tydzień ${target.week_number}`,
    start_date: shiftDate(src.start_date, target.shiftDays),
    end_date: shiftDate(src.end_date, target.shiftDays),
  }).select().single()
  if (wErr || !nw) throw wErr || new Error('Nie udało się skopiować tygodnia')
  const { data: days } = await supabase.from('workout_days').select('id, day_order, day_name, training_date').eq('week_id', srcWeekId).order('day_order')
  for (const d of (days || []) as any[]) {
    await copyUnit(supabase, d.id, nw.id, { day_order: d.day_order, day_name: d.day_name, training_date: shiftDate(d.training_date, target.shiftDays) })
  }
  return nw
}

// Kopia całego programu (z planem) — dla drużyny albo jako szablon (group_id = null).
// newStart: nowa data rozpoczęcia — wszystkie daty przesuwają się o tę samą liczbę dni.
export async function copyProgram(supabase: any, srcProgramId: number, opts: { groupId: number | null; name: string; newStart: string | null; asTemplate: boolean }) {
  const { data: src, error } = await supabase.from('periodization_programs').select('*').eq('id', srcProgramId).single()
  if (error || !src) throw error || new Error('Brak programu')
  const shift = opts.newStart && src.start_date ? diffDays(src.start_date, opts.newStart) : 0

  // plan programu
  let newPlanId: number | null = null
  if (src.plan_id) {
    const { data: plan } = await supabase.from('workout_plans').select('*').eq('id', src.plan_id).single()
    if (plan) {
      const row: any = { ...strip(plan, ['group_id', 'athlete_id', 'is_archived', 'template_kind']), name: opts.name }
      if (opts.groupId) row.group_id = opts.groupId
      if (opts.asTemplate) { row.is_archived = true; row.template_kind = 'program' }
      const { data: np, error: pErr } = await supabase.from('workout_plans').insert(row).select().single()
      if (pErr || !np) throw pErr || new Error('Nie udało się skopiować planu')
      newPlanId = np.id
    }
  }

  const { data: np, error: npErr } = await supabase.from('periodization_programs').insert({
    group_id: opts.groupId, plan_id: newPlanId, name: opts.name, description: src.description, goal: src.goal,
    start_date: shiftDate(src.start_date, shift), end_date: shiftDate(src.end_date, shift),
    archived: false, is_template: opts.asTemplate,
  }).select().single()
  if (npErr || !np) throw npErr || new Error('Nie udało się utworzyć programu')

  const [{ data: macros }, { data: mesos }] = await Promise.all([
    supabase.from('periodization_macrocycles').select('*').eq('program_id', srcProgramId),
    supabase.from('periodization_mesocycles').select('*').eq('program_id', srcProgramId),
  ])
  const macroMap = new Map<number, number>()
  for (const m of (macros || []) as any[]) {
    const { data: nm } = await supabase.from('periodization_macrocycles').insert({
      ...strip(m, ['program_id']), program_id: np.id, start_date: shiftDate(m.start_date, shift), end_date: shiftDate(m.end_date, shift),
    }).select().single()
    if (nm) macroMap.set(m.id, nm.id)
  }
  const mesoMap = new Map<number, number>()
  for (const m of (mesos || []) as any[]) {
    const { data: nm } = await supabase.from('periodization_mesocycles').insert({
      ...strip(m, ['program_id', 'macrocycle_id']), program_id: np.id, macrocycle_id: m.macrocycle_id ? macroMap.get(m.macrocycle_id) ?? null : null,
      start_date: shiftDate(m.start_date, shift), end_date: shiftDate(m.end_date, shift),
    }).select().single()
    if (nm) mesoMap.set(m.id, nm.id)
  }
  if (src.plan_id && newPlanId) {
    const { data: weeks } = await supabase.from('workout_weeks').select('id, week_number, mesocycle_id').eq('plan_id', src.plan_id).order('week_number')
    for (const w of (weeks || []) as any[]) {
      await copyMicrocycle(supabase, w.id, { plan_id: newPlanId, mesocycle_id: w.mesocycle_id ? mesoMap.get(w.mesocycle_id) ?? null : null, week_number: w.week_number, shiftDays: shift })
    }
  }
  return np as Program
}

// Biblioteka szablonów jednostek — jeden ukryty plan z jednym tygodniem
export async function unitTemplateWeek(supabase: any): Promise<number> {
  let { data: plan } = await supabase.from('workout_plans').select('id').eq('template_kind', 'unit').limit(1).maybeSingle()
  if (!plan) {
    const res = await supabase.from('workout_plans').insert({ name: 'Szablony jednostek (Periodyzacja)', is_archived: true, template_kind: 'unit' }).select('id').single()
    if (res.error) throw res.error
    plan = res.data
  }
  let { data: week } = await supabase.from('workout_weeks').select('id').eq('plan_id', plan.id).limit(1).maybeSingle()
  if (!week) {
    const res = await supabase.from('workout_weeks').insert({ plan_id: plan.id, week_number: 1, name: 'Szablony' }).select('id').single()
    if (res.error) throw res.error
    week = res.data
  }
  return week.id
}

// ---------- realizacja ----------
export type UnitStatus = 'done' | 'partial' | 'skipped' | 'planned' | 'excluded'
export const STATUS_INFO: Record<UnitStatus, { label: string; color: string; bg: string }> = {
  done: { label: 'Ukończony', color: '#15803d', bg: '#e3f6ea' },
  partial: { label: 'Częściowo', color: '#b4761a', bg: '#fdf1de' },
  skipped: { label: 'Pominięty', color: '#c23b3b', bg: '#fde8e8' },
  planned: { label: 'Zaplanowany', color: '#5b6b8c', bg: '#e8ecf3' },
  excluded: { label: 'Wyłączona', color: '#9aa1b5', bg: '#f3f4f7' },
}

export type SessionInfo = { id: number; athlete_id: number; workout_day_id: number; completed: boolean; created_at?: string | null; date_completed?: string | null; rpe?: number | null; skipped_sets?: number; logged_sets?: number }

export function unitStatusFor(unit: Unit, athleteId: number, session: SessionInfo | undefined, today: string): UnitStatus {
  if ((unit.absent_athlete_ids || []).includes(athleteId)) return 'excluded'
  if (session) {
    if (session.completed) return (session.skipped_sets || 0) > 0 ? 'partial' : 'done'
    if ((session.logged_sets || 0) > 0) return 'partial'
  }
  if (unit.training_date && unit.training_date < today) return 'skipped'
  return 'planned'
}

// sRPE (RPE × minuty). Czas = od otwarcia do zakończenia sesji; poza zakresem 10–240 min — brak danych
export function sessionLoad(s: SessionInfo): number | null {
  if (s.rpe == null || !s.created_at || !s.date_completed) return null
  const min = (new Date(s.date_completed).getTime() - new Date(s.created_at).getTime()) / 60000
  if (!(min >= 10 && min <= 240)) return null
  return Math.round(s.rpe * min)
}

export type Tally = { planned: number; done: number; partial: number; skipped: number; upcoming: number; rpeSum: number; rpeN: number; load: number; loadN: number }
export const emptyTally = (): Tally => ({ planned: 0, done: 0, partial: 0, skipped: 0, upcoming: 0, rpeSum: 0, rpeN: 0, load: 0, loadN: 0 })
export function addToTally(t: Tally, st: UnitStatus, s?: SessionInfo) {
  if (st === 'excluded') return
  t.planned++
  if (st === 'done') t.done++
  else if (st === 'partial') t.partial++
  else if (st === 'skipped') t.skipped++
  else t.upcoming++
  if (s && s.rpe != null) { t.rpeSum += s.rpe; t.rpeN++ }
  const l = s ? sessionLoad(s) : null
  if (l != null) { t.load += l; t.loadN++ }
}
// % realizacji: ukończone + połowa częściowych, względem treningów, których termin już minął
export function realization(t: Tally) {
  const due = t.done + t.partial + t.skipped
  if (!due) return null
  return Math.round(((t.done + t.partial * 0.5) / due) * 100)
}
// postęp planu: ile z zaplanowanych jest już za nami (zrealizowane lub częściowo)
export function progress(t: Tally) {
  if (!t.planned) return null
  return Math.round(((t.done + t.partial) / t.planned) * 100)
}

// Tygodnie planu ułożone według dat (jak w edytorze planu): numer = kolejność dat,
// tygodnie bez daty na końcu. Domyślne nazwy „Tydzień N” idą za numerem.
export async function renumberPlanWeeks(supabase: any, planId: number) {
  const { data } = await supabase.from('workout_weeks').select('id, week_number, name, start_date').eq('plan_id', planId)
  const list = (data || []) as { id: number; week_number: number; name: string | null; start_date: string | null }[]
  const ordered = [...list].sort((a, b) => {
    if (a.start_date && b.start_date) return a.start_date.localeCompare(b.start_date) || a.week_number - b.week_number
    if (a.start_date) return -1
    if (b.start_date) return 1
    return a.week_number - b.week_number
  })
  const isDefault = (name?: string | null) => !name || /^Tydzie[nń] \d+$/i.test(name.trim())
  const changed = ordered.map((w, i) => ({ w, num: i + 1 })).filter(t => t.w.week_number !== t.num)
  for (const { w, num } of changed) await supabase.from('workout_weeks').update({ week_number: num + 10000 }).eq('id', w.id)
  for (const { w, num } of changed) await supabase.from('workout_weeks').update({ week_number: num, name: isDefault(w.name) ? `Tydzień ${num}` : w.name }).eq('id', w.id)
}

// Mezocykl idzie za swoimi tygodniami: liczba tygodni i daty od pierwszego do ostatniego
export async function syncMesocycle(supabase: any, mesoId: number) {
  const { data } = await supabase.from('workout_weeks').select('start_date, end_date').eq('mesocycle_id', mesoId)
  const weeks = (data || []) as { start_date: string | null; end_date: string | null }[]
  const patch: any = { weeks_count: weeks.length }
  const starts = weeks.map(w => w.start_date).filter(Boolean) as string[]
  if (starts.length) {
    patch.start_date = starts.sort()[0]
    patch.end_date = weeks.map(w => w.end_date || (w.start_date ? addDays(w.start_date, 6) : null)).filter(Boolean).sort().pop()
  }
  await supabase.from('periodization_mesocycles').update(patch).eq('id', mesoId)
}
