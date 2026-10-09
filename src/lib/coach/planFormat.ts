// src/lib/coach/planFormat.ts
// Tekstowe wartości serii ćwiczenia z planu — wspólne dla tabeli edytora planu i eksportu PDF.

export type PlanWorkSet = { reps?: string; weight_kg?: string; tempo?: string; rir?: string; seconds?: string; intensity?: string; rest?: string; ecc?: string; hold?: string }

type FormatExercise = {
  reps?: string | null; tempo?: string | null
  work_sets?: PlanWorkSet[] | null
}

// Wartość, która może się różnić między seriami: jedna wspólna, albo (jeśli
// serie się różnią) wartości kolejnych serii po kolei — "90'' / 120''" znaczy
// seria 1 = 90'', seria 2 = 120'' (zakres "90–120" nie mówił, która jest która).
export function fmtRange(values: (string | undefined)[], suffix = ''): string {
  const all = values.map(v => v?.trim() || '')
  if (all.every(v => !v)) return '—'
  const unique = Array.from(new Set(all))
  if (unique.length === 1) return `${unique[0]}${suffix}`
  return all.map(v => v ? `${v}${suffix}` : '—').join(' / ')
}

// ISO w kolumnie Powt.: jedna linia, gdy serie są równe ("1× 90''"), inaczej
// linia na serię: "S1 90''", "S2 120''" (powtórzenia tylko, gdy któraś seria ma ich więcej niż 1)
export function isoPowtLines(ex: FormatExercise): string[] {
  const sets = ex.work_sets || []
  const reps = sets.map(s => s.reps?.trim() || '')
  const secs = sets.map(s => s.seconds?.trim() || '')
  const one = (r: string, t: string) => `${r ? `${r}× ` : ''}${t ? `${t}''` : '—'}`
  if (new Set(reps).size <= 1 && new Set(secs).size <= 1) return [one(reps[0] || '', secs[0] || '')]
  const showReps = reps.some(r => r && r !== '1')
  return sets.map((_, i) => `S${i + 1} ${one(showReps ? reps[i] : '', secs[i])}`)
}

// Powtórzenia zwykłego ćwiczenia: linia na serię ("S1 8", "S2 6"), gdy serie się różnią
export function repsLines(ex: FormatExercise): string[] | null {
  const reps = (ex.work_sets || []).map(s => s.reps?.trim() || '')
  if (new Set(reps).size <= 1) return null
  return reps.map((r, i) => `S${i + 1} ${r || '—'}`)
}

// Ekscentryczne w kolumnie Tempo: "ECC 5'' · hold 3''" — jedna linia, gdy serie równe,
// inaczej linia na serię ("S1 ECC 5''", "S2 ECC 6'' · hold 2''")
export function eccTempoLines(ex: FormatExercise): string[] {
  const sets = ex.work_sets || []
  const one = (s?: PlanWorkSet) => [s?.ecc ? `ECC ${s.ecc}''` : '', s?.hold ? `hold ${s.hold}''` : ''].filter(Boolean).join(' · ') || '—'
  const all = sets.map(one)
  if (new Set(all).size <= 1) return [all[0] || (ex.tempo || '—')]
  return all.map((l, i) => `S${i + 1} ${l}`)
}
