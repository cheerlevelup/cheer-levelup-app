// src/lib/planLegend.ts
// Skróty i legenda w panelu ℹ️ zawodniczki podczas treningu. Domyślna lista jest
// zawsze punktem wyjścia; trener może ją zmienić dla konkretnego planu
// (workout_plans.legend, migracja 202611160002 — null = lista domyślna).

export type LegendItem = { short: string; full: string }

export const DEFAULT_LEGEND: LegendItem[] = [
  { short: 'iso', full: 'izometria — zatrzymanie bez ruchu' },
  { short: 'bb', full: 'barbell — sztanga' },
  { short: 'ssb', full: 'safety squat bar — sztanga bezpieczna' },
  { short: 'kb', full: 'kettlebell' },
  { short: 'db', full: 'dumbbell — hantle' },
  { short: 'sl', full: 'single leg — jednonóż' },
  { short: 'BW', full: 'body weight — ciężar ciała (bez dodatkowego obciążenia)' },
  { short: '1RM', full: 'one repetition maximum — maksymalny ciężar na 1 powtórzenie' },
  { short: '50% 1RM', full: 'obciążenie 50% Twojego maksimum' },
  { short: 'rampa', full: 'stopniowe zwiększanie ciężaru w kolejnych seriach (np. 35 / 37,5 / 40 kg)' },
  { short: '30"', full: '30 sekund' },
  { short: '5" ecc', full: 'faza ekscentryczna (opuszczanie) trwa 5 sekund — np. w przysiadzie to faza schodzenia w dół' },
]

export function resolveLegend(legend: unknown): LegendItem[] {
  if (!Array.isArray(legend)) return DEFAULT_LEGEND
  return legend
    .filter((x): x is LegendItem => !!x && typeof x === 'object' && typeof (x as LegendItem).short === 'string')
    .map(x => ({ short: x.short, full: String(x.full ?? '') }))
}

export const sameAsDefault = (items: LegendItem[]) =>
  items.length === DEFAULT_LEGEND.length && items.every((it, i) => it.short === DEFAULT_LEGEND[i].short && it.full === DEFAULT_LEGEND[i].full)
