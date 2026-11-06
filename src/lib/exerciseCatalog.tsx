'use client'
// src/lib/exerciseCatalog.tsx
// Katalog ćwiczeń (zakładka „Katalog ćwiczeń") — podpowiedzi nazw przy wpisywaniu
// ćwiczenia oraz automatyczny link do filmiku, gdy nazwa zgadza się z katalogiem.
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export type CatalogExercise = { id: number; name: string; link_url: string | null }

export const EXERCISE_CATALOG_LIST_ID = 'exercise-catalog-names'

/** Klucz porównania nazw: bez wielkości liter i nadmiarowych spacji. */
export function catalogKey(name: string | null | undefined) {
  return (name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl')
}

export function useExerciseCatalog() {
  const [items, setItems] = useState<CatalogExercise[]>([])
  useEffect(() => {
    let alive = true
    createClient()
      .from('exercise_catalog')
      .select('id, name, link_url')
      .order('name', { ascending: true })
      .then(({ data }) => { if (alive && data) setItems(data as CatalogExercise[]) })
    return () => { alive = false }
  }, [])
  const byKey = useMemo(() => {
    const m = new Map<string, CatalogExercise>()
    for (const it of items) m.set(catalogKey(it.name), it)
    return m
  }, [items])
  /** Link z katalogu dla danej nazwy (null, gdy nazwy nie ma w katalogu lub brak linku). */
  const linkFor = (name: string | null | undefined) => byKey.get(catalogKey(name))?.link_url || null
  return { items, linkFor }
}

/**
 * Link po zmianie nazwy ćwiczenia: nazwa z katalogu → link z katalogu;
 * nazwa spoza katalogu → zostaje dotychczasowy link, chyba że pochodził
 * z katalogu dla poprzedniej nazwy (wtedy go czyścimy, bo to inny filmik).
 * Zwraca undefined, gdy linku nie trzeba zmieniać.
 */
export function linkAfterRename(
  linkFor: (name: string | null | undefined) => string | null,
  prevName: string | null | undefined,
  newName: string | null | undefined,
  currentLink: string | null | undefined,
): string | null | undefined {
  // Nazwa się nie zmieniła — nie ruszamy linku (np. ręcznie wpisanego innego filmiku)
  if (catalogKey(prevName) === catalogKey(newName)) return undefined
  const fromCatalog = linkFor(newName)
  if (fromCatalog) return fromCatalog === currentLink ? undefined : fromCatalog
  const prevCatalog = linkFor(prevName)
  if (prevCatalog && currentLink === prevCatalog) return null
  return undefined
}

/** Lista podpowiedzi dla <input list={EXERCISE_CATALOG_LIST_ID}>. */
export function ExerciseCatalogDatalist({ items }: { items: CatalogExercise[] }) {
  return (
    <datalist id={EXERCISE_CATALOG_LIST_ID}>
      {items.map(it => <option key={it.id} value={it.name} />)}
    </datalist>
  )
}
