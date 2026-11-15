// src/lib/coach/planAssignments.ts
// Przypisania planów: grupowe (plan narzucony całej grupie) i indywidualne
// (plan widoczny tylko jednej zawodniczce). Kolumna assignment_type pochodzi z
// migracji 202611150001 — bez niej wszystko działa jak dotąd (każde przypisanie
// traktowane jako grupowe).

export type AssignmentType = 'group' | 'individual'

export const isIndividual = (a: { assignment_type?: string | null } | null | undefined) =>
  a?.assignment_type === 'individual'

const missingColumn = (err: any, col: string) => !!err && new RegExp(col).test(err.message || '')

// Dezaktywuje dotychczasowe plany GRUPOWE zawodniczek (indywidualne zostają aktywne)
export async function deactivateGroupAssignments(supabase: any, athleteIds: number[]) {
  if (!athleteIds.length) return
  const { error } = await supabase.from('athlete_workout_assignments')
    .update({ is_active: false })
    .in('athlete_id', athleteIds)
    .eq('is_active', true)
    .neq('assignment_type', 'individual')
  if (missingColumn(error, 'assignment_type')) {
    await supabase.from('athlete_workout_assignments')
      .update({ is_active: false })
      .in('athlete_id', athleteIds)
      .eq('is_active', true)
  } else if (error) throw error
}

// Wstawia przypisania; bez migracji ponawia bez kolumny assignment_type
export async function insertAssignments(
  supabase: any,
  rows: { athlete_id: number; plan_id: number; order_mode?: string }[],
  type: AssignmentType,
) {
  if (!rows.length) return []
  const base = rows.map(r => ({
    is_active: true,
    order_mode: 'sequential',
    start_date: new Date().toISOString().split('T')[0],
    ...r,
  }))
  let { data, error } = await supabase.from('athlete_workout_assignments')
    .insert(base.map(r => ({ ...r, assignment_type: type }))).select('*, plan:workout_plans(*)')
  if (missingColumn(error, 'assignment_type')) {
    if (type === 'individual') throw new Error('Aby dodawać plany indywidualne, uruchom w Supabase migrację 202611150001_individual_plans.sql.')
    ;({ data, error } = await supabase.from('athlete_workout_assignments').insert(base).select('*, plan:workout_plans(*)'))
  }
  if (error) throw error
  return data || []
}

// Usuwa plan zawodniczce (również grupowy). Sesje i wpisy zostają — tylko odpinamy przypisanie.
export async function removeAssignment(supabase: any, assignmentId: number) {
  const { error: sErr } = await supabase.from('workout_sessions').update({ assignment_id: null }).eq('assignment_id', assignmentId)
  if (sErr) console.warn('Nie udało się odpiąć sesji od przypisania:', sErr.message)
  const { error } = await supabase.from('athlete_workout_assignments').delete().eq('id', assignmentId)
  if (error) throw error
}

// Nowy pusty plan (tygodnie × treningi). owner: grupa, zawodniczka albo ogólny.
export async function createPlanSkeleton(
  supabase: any,
  { name, weeksCount, perWeek, groupId, athleteId }: { name: string; weeksCount: number; perWeek: number; groupId?: number; athleteId?: number },
) {
  const row: any = { name }
  if (groupId) row.group_id = groupId
  if (athleteId) row.athlete_id = athleteId
  const { data: plan, error } = await supabase.from('workout_plans').insert(row).select().single()
  if (error || !plan) {
    if (missingColumn(error, 'athlete_id')) throw new Error('Aby tworzyć plany indywidualne, uruchom w Supabase migrację 202611150001_individual_plans.sql.')
    throw new Error(error?.message || 'Błąd tworzenia planu')
  }
  const { data: weeks, error: wErr } = await supabase.from('workout_weeks')
    .insert(Array.from({ length: weeksCount }, (_, i) => ({ plan_id: plan.id, week_number: i + 1, name: `Tydzień ${i + 1}` })))
    .select()
  if (wErr) throw wErr
  const dayRows = (weeks || [])
    .sort((a: any, b: any) => a.week_number - b.week_number)
    .flatMap((w: any) => Array.from({ length: perWeek }, (_, di) => ({
      week_id: w.id, day_name: `Trening ${(w.week_number - 1) * perWeek + di + 1}`, day_order: di + 1,
    })))
  if (dayRows.length) {
    const { error: dErr } = await supabase.from('workout_days').insert(dayRows)
    if (dErr) throw dErr
  }
  return plan
}
