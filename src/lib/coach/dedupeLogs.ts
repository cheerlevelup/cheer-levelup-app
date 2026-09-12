// src/lib/coach/dedupeLogs.ts
// Usuwa duplikaty set_logs (te same serie zapisane więcej niż raz), zostawiając
// najnowszy/najwyższy-id wpis per (sesja, ćwiczenie, numer serii, warmup/main).
export type MinimalSetLog = {
  id?: number
  created_at?: string | null
  workout_session_id?: number | null
  block_exercise_id?: number | null
  set_number: number
  is_warmup?: boolean | null
}

export function dedupeLogs<T extends MinimalSetLog>(logs: T[]) {
  const byKey = new Map<string, T>()
  for (const log of logs || []) {
    if (!log.block_exercise_id) continue
    const key = `${log.workout_session_id || 0}:${log.block_exercise_id}:${log.set_number}:${log.is_warmup ? 'w' : 'm'}`
    const existing = byKey.get(key)
    const logTime = new Date(log.created_at || 0).getTime()
    const existingTime = new Date(existing?.created_at || 0).getTime()
    if (!existing || logTime >= existingTime || (log.id || 0) > (existing.id || 0)) byKey.set(key, log)
  }
  return Array.from(byKey.values())
}
