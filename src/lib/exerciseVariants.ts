// src/lib/exerciseVariants.ts
// Warianty ćwiczenia w planie (1a, 1b, 1c...). Wariant = wiersz
// workout_block_exercises z variant_of → id ćwiczenia bazowego (1a) w tym samym
// bloku i listą zawodniczek (variant_athlete_ids). Zawodniczka nieprzypisana do
// żadnego wariantu robi ćwiczenie bazowe — dzięki temu nikt nie zostaje bez
// wariantu i nikt nie robi dwóch.

type VariantFields = {
  id?: number
  exercise_order: number
  variant_of?: number | null
  variant_athlete_ids?: number[] | null
}

// Kolejność w bloku: wg exercise_order, w obrębie slotu baza przed wariantami (wg id)
export function sortWithVariants<T extends VariantFields>(exs: T[]): T[] {
  const byId = new Map(exs.filter(e => e.id != null).map(e => [e.id as number, e]))
  const slotOrder = (e: T) => (e.variant_of != null ? byId.get(e.variant_of)?.exercise_order : undefined) ?? e.exercise_order
  return [...exs].sort((a, b) =>
    slotOrder(a) - slotOrder(b)
    || (a.variant_of ?? a.id ?? 0) - (b.variant_of ?? b.id ?? 0)
    || Number(a.variant_of != null) - Number(b.variant_of != null)
    || (a.id ?? 0) - (b.id ?? 0))
}

// Etykiety „1", „2a", „2b"... dla listy ćwiczeń bloku (posortowanej sortWithVariants)
export function variantLabels<T extends VariantFields>(sorted: T[]): Map<T, string> {
  const labels = new Map<T, string>()
  const hasVariants = new Set(sorted.filter(e => e.variant_of != null).map(e => e.variant_of as number))
  let slot = 0
  let letter = 0
  for (const e of sorted) {
    if (e.variant_of == null) { slot++; letter = 0 }
    const baseId = e.variant_of ?? e.id
    labels.set(e, baseId != null && hasVariants.has(baseId) ? `${slot}${String.fromCharCode(97 + letter++)}` : `${slot}`)
  }
  return labels
}

// Ćwiczenia bloku widziane przez jedną zawodniczkę: w każdym slocie z wariantami
// zostaje tylko jej wariant (na miejscu ćwiczenia bazowego), pozostałe znikają.
export function pickVariantsForAthlete<T extends VariantFields>(exs: T[], athleteId: number): T[] {
  const variants = exs.filter(e => e.variant_of != null)
  if (variants.length === 0) return exs
  const baseIds = new Set(exs.filter(e => e.variant_of == null).map(e => e.id))
  return exs
    .filter(e => e.variant_of == null)
    .map(base => variants.find(v => v.variant_of === base.id && (v.variant_athlete_ids || []).includes(athleteId)) ?? base)
    // wariant, którego baza zniknęła (np. przeniesiona), traktuj jak zwykłe ćwiczenie
    .concat(variants.filter(v => !baseIds.has(v.variant_of as number) && (v.variant_athlete_ids || []).includes(athleteId)))
}

// To samo dla bloków dnia (pole workout_block_exercises)
export function applyVariantsToBlocks<B extends { workout_block_exercises?: any[] | null }>(blocks: B[], athleteId: number): B[] {
  return blocks.map(b => ({ ...b, workout_block_exercises: pickVariantsForAthlete(b.workout_block_exercises || [], athleteId) }))
}

// Sesja z dołączonym workout_day.workout_day_blocks (historia, raport, podsumowanie)
export function applyVariantsToSession<S extends { workout_day?: any }>(session: S, athleteId: number): S {
  const blocks = session?.workout_day?.workout_day_blocks
  if (!Array.isArray(blocks)) return session
  return { ...session, workout_day: { ...session.workout_day, workout_day_blocks: applyVariantsToBlocks(blocks, athleteId) } }
}

// Kopia ćwiczeń bloku (np. „kopiuj blok", duplikat planu) z zachowaniem wariantów:
// najpierw bazy, potem warianty z variant_of przepiętym na nowe id baz.
export async function insertExercisesWithVariants(supabase: any, rows: any[], buildRow: (src: any) => Record<string, any>, select = '*, exercise:exercises(*)') {
  const bases = rows.filter(r => r.variant_of == null)
  const variants = rows.filter(r => r.variant_of != null)
  const inserted: any[] = []
  const idMap = new Map<number, number>()
  for (const src of bases) {
    const { data, error } = await supabase.from('workout_block_exercises').insert(buildRow(src)).select(select).single()
    if (error) return { data: inserted, error }
    inserted.push(data)
    if (src.id != null) idMap.set(src.id, data.id)
  }
  for (const src of variants) {
    const newBase = idMap.get(src.variant_of)
    if (newBase == null) continue
    const { data, error } = await supabase.from('workout_block_exercises')
      .insert({ ...buildRow(src), variant_of: newBase, variant_athlete_ids: src.variant_athlete_ids ?? [] }).select(select).single()
    if (error) return { data: inserted, error }
    inserted.push(data)
  }
  return { data: inserted, error: null }
}
