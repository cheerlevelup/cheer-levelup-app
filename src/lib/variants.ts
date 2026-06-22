// src/lib/variants.ts
// Wspólna normalizacja wariantów ćwiczeń grupy zorganizowanej.
// USZKODZONE dane: po migracji text[]→jsonb część wariantów ma w polu `name`
// zserializowany obiekt (np. '{"name":"negatywne podciąganie","sets":1,...}').
// coerceVariant rozpakowuje to rekurencyjnie, żeby wszędzie pokazać czystą nazwę
// i nie rozbijać jednego wariantu na kilka „różnych".

export type CleanVariant = { name: string; sets: number | null; reps: string; tempo: string; bodyweight: boolean }

export function coerceVariant(x: unknown): CleanVariant | null {
  if (typeof x === 'string') {
    const s = x.trim()
    if (s.startsWith('{')) { try { return coerceVariant(JSON.parse(s)) } catch { /* nie JSON */ } }
    return s ? { name: s, sets: null, reps: '', tempo: '', bodyweight: false } : null
  }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>
    if (typeof o.name === 'string' && o.name.trim().startsWith('{')) {
      try { const inner = coerceVariant(JSON.parse(o.name)); if (inner) return inner } catch { /* zostaw */ }
    }
    const name = String(o.name ?? '').trim()
    return name
      ? { name, sets: (o.sets as number) ?? null, reps: String(o.reps ?? ''), tempo: String(o.tempo ?? ''), bodyweight: !!o.bodyweight }
      : null
  }
  return null
}

// Czysta nazwa wariantu z dowolnego zapisu (string / obiekt / uszkodzony JSON).
export function cleanVariantName(x: unknown): string {
  return coerceVariant(x)?.name ?? ''
}

// Czysta nazwa do WYŚWIETLENIA — NFC, bez znaków zerowej szerokości / miękkiego
// łącznika, ze scalonymi spacjami (twarda spacja też). Zachowuje wielkość liter
// i polskie znaki.
export function normExerciseName(name: string | null | undefined): string {
  return String(name ?? '')
    .normalize('NFC')
    .replace(/[​-‍⁠﻿­]/g, '') // zero-width space/joiner, word-joiner, BOM, soft hyphen
    .replace(/\s+/g, ' ')
    .trim()
}

// Klucz do GRUPOWANIA ćwiczeń/wariantów — dodatkowo bez rozróżniania wielkości
// liter, by „Podciaganie" i „podciaganie" (oraz różnice niewidocznych znaków)
// były jednym ćwiczeniem. Do wyświetlania używaj normExerciseName.
export function groupKey(name: string | null | undefined): string {
  return normExerciseName(name).toLocaleLowerCase('pl-PL')
}
