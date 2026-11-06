export const dynamic = 'force-dynamic'

// src/app/coach/exercises/page.tsx
// „Katalog ćwiczeń" — alfabetyczna lista ćwiczeń z linkami do filmików
// i liczbą użyć w treningach grup oraz planach.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ExerciseCatalogClient from './ExerciseCatalogClient'

function key(name: string | null | undefined) {
  return (name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl')
}

// Supabase zwraca max 1000 wierszy na zapytanie — pobieramy stronami.
async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await query(from, from + page - 1)
    if (error || !data) break
    out.push(...data)
    if (data.length < page) break
  }
  return out
}

export default async function ExerciseCatalogPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { data: catalog, error: catalogError } = await supabase
    .from('exercise_catalog')
    .select('id, name, link_url')
    .order('name', { ascending: true })

  const [trainingRows, planRows] = await Promise.all([
    fetchAll<{ name: string | null }>((a, b) =>
      supabase.from('group_training_exercises').select('name').order('id').range(a, b)),
    fetchAll<{ exercise_code: string | null; exercise: { name: string | null } | null }>((a, b) =>
      supabase.from('workout_block_exercises').select('exercise_code, exercise:exercises(name)').order('id').range(a, b) as any),
  ])

  const trainingUses: Record<string, number> = {}
  for (const r of trainingRows) { const k = key(r.name); if (k) trainingUses[k] = (trainingUses[k] || 0) + 1 }
  const planUses: Record<string, number> = {}
  for (const r of planRows) {
    const k = key(r.exercise?.name || r.exercise_code)
    if (k) planUses[k] = (planUses[k] || 0) + 1
  }

  const items = (catalog || []).map(c => ({
    id: c.id as number,
    name: c.name as string,
    link_url: (c.link_url as string | null) ?? null,
    trainingUses: trainingUses[key(c.name)] || 0,
    planUses: planUses[key(c.name)] || 0,
  }))

  const missingTable = !!catalogError && /exercise_catalog/.test(catalogError.message)

  return <ExerciseCatalogClient initialItems={items} missingTable={missingTable} />
}
