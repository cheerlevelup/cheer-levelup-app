// src/lib/coach/setLogWrite.ts
// Zapis serii (set_logs): update po id, inaczej insert. Gdy seria już jest w bazie, a nie mamy
// jej id (np. stary wpis z is_warmup = null, wpis zawodniczki sprzed odświeżenia) — unikalny
// indeks set_logs_unique_session_exercise_set odrzuci insert; wtedy szukamy jej i aktualizujemy.
export async function writeSetLog(supabase: any, payload: { workout_session_id: number; block_exercise_id: number; athlete_id: number; set_number: number; is_warmup: boolean; [k: string]: unknown }, id?: number | null) {
  const find = async () => {
    let q = supabase.from('set_logs').select('id').eq('workout_session_id', payload.workout_session_id)
      .eq('block_exercise_id', payload.block_exercise_id).eq('set_number', payload.set_number)
    q = payload.is_warmup ? q.eq('is_warmup', true) : q.or('is_warmup.is.null,is_warmup.eq.false')
    const { data } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle()
    return (data?.id as number | undefined) ?? null
  }
  const update = (rowId: number) => supabase.from('set_logs').update(payload).eq('id', rowId).select().single()
  const rowId = id ?? await find()
  if (rowId) return update(rowId)
  const res = await supabase.from('set_logs').insert(payload).select().single()
  if (res.error && (res.error.code === '23505' || /duplicate key/i.test(res.error.message || ''))) {
    const again = await find()
    if (again) return update(again)
  }
  return res
}
