// src/lib/groupTraining.ts
// Pomocnicze funkcje dla grup zorganizowanych (prowadzonych przez trenera)
import type { SupabaseClient } from '@supabase/supabase-js'

// Lokalna data YYYY-MM-DD (nie UTC — treningi wieczorne nie mogą przeskakiwać na inny dzień)
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Zakres doby (lokalnej) jako ISO — do filtrowania po created_at
export function dayRangeIso(dateStr: string): { startIso: string; endIso: string } {
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function formatDatePl(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Gotowość i feedback z tego samego dnia automatycznie podpinają się pod trening
export async function linkLogsToTraining(
  supabase: SupabaseClient,
  athleteIds: number[],
  trainingId: number,
  dateStr: string,
): Promise<void> {
  if (athleteIds.length === 0) return
  const { startIso, endIso } = dayRangeIso(dateStr)
  await supabase
    .from('wellness_logs')
    .update({ group_training_id: trainingId })
    .in('athlete_id', athleteIds)
    .is('group_training_id', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
  await supabase
    .from('post_session_feedback')
    .update({ group_training_id: trainingId })
    .in('athlete_id', athleteIds)
    .is('group_training_id', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
}

// Znajdź trening grupy z danego dnia (jeśli istnieje)
export async function findTrainingForDate(
  supabase: SupabaseClient,
  groupId: number,
  dateStr: string,
): Promise<{ id: number } | null> {
  const { data } = await supabase
    .from('group_trainings')
    .select('id')
    .eq('group_id', groupId)
    .eq('training_date', dateStr)
    .maybeSingle()
  return data
}
