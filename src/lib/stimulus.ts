// src/lib/stimulus.ts
// System analizy bodźca treningowego v1.0
// ------------------------------------------------------------------
// Czyste funkcje (bez React / bez bazy) szacujące, JAKI BODZIEC został
// ZAPROGRAMOWANY przez trenera — na podstawie liczby powtórzeń, tempa i TUT.
// To analiza KONSTRUKCJI programu, a nie rzeczywistej odpowiedzi organizmu:
// nie liczymy %1RM, intensywności, prędkości ani zmęczenia.
//
// Trzy poziomy klasyfikacji:
//   1. kierunek adaptacji  → z liczby powtórzeń (profil rozmyty, płynne przejścia)
//   2. charakter bodźca    → z TUT serii (mechanical / mixed / metabolic)
//   3. intencja ruchu      → znacznik „X” w tempie = komponent eksplozywny

// ── Kategorie (kierunek adaptacji) ────────────────────────────────
export type StimulusCategory =
  | 'sila'        // Siła względna            1–5 powt.
  | 'hiper_funk'  // Hipertrofia funkcjonalna 6–8 powt.
  | 'hiper_og'    // Hipertrofia ogólna       9–12 powt.
  | 'wytrz_sil'   // Wytrzymałość siłowa      13–20 powt.
  | 'wytrz_og'    // Wytrzymałość ogólna      20+ powt.

export const CATEGORY_ORDER: StimulusCategory[] = [
  'sila', 'hiper_funk', 'hiper_og', 'wytrz_sil', 'wytrz_og',
]

export const CATEGORY_LABEL: Record<StimulusCategory, string> = {
  sila: 'Siła względna',
  hiper_funk: 'Hipertrofia funkcjonalna',
  hiper_og: 'Hipertrofia ogólna',
  wytrz_sil: 'Wytrzymałość siłowa',
  wytrz_og: 'Wytrzymałość ogólna',
}

export const CATEGORY_SHORT: Record<StimulusCategory, string> = {
  sila: 'Siła wzgl.',
  hiper_funk: 'Hiper. funk.',
  hiper_og: 'Hiper. og.',
  wytrz_sil: 'Wytrz. sił.',
  wytrz_og: 'Wytrz. og.',
}

// Kolory w jednej gamie: siła (czerwień) → wytrzymałość (błękit),
// zgodnie z „kontinuum siły” (od mocy do wytrzymałości).
export const CATEGORY_COLOR: Record<StimulusCategory, string> = {
  sila: '#C81E1E',
  hiper_funk: '#F97316',
  hiper_og: '#F5C842',
  wytrz_sil: '#22C55E',
  wytrz_og: '#3B82F6',
}

export type StimulusCharacter = 'mechanical' | 'mixed' | 'metabolic'

export const CHARACTER_LABEL: Record<StimulusCharacter, string> = {
  mechanical: 'Mechanical',
  mixed: 'Mixed',
  metabolic: 'Metabolic',
}

export type Confidence = 'wysoka' | 'srednia' | 'niska'

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  wysoka: 'wysoka', srednia: 'średnia', niska: 'niska',
}

export type StimulusProfile = Record<StimulusCategory, number>

// ── Tempo ─────────────────────────────────────────────────────────
// Zapis: ECCENTRIC / BOTTOM PAUSE / CONCENTRIC / TOP PAUSE, np. „4010”.
// „X” = wykonaj fazę maksymalnie dynamicznie — to intencja ruchu, nie czas.
// Dla TUT liczymy X jak ~1 s, ale ustawiamy znacznik eksplozywności.
export interface TempoInfo {
  perRepSeconds: number  // czas jednego powtórzenia (s)
  explosive: boolean     // tempo zawiera „X”
  valid: boolean         // udało się odczytać tempo
}

const X_AS_SECONDS = 1

export function parseTempo(tempo?: string | null): TempoInfo {
  const t = (tempo || '').trim()
  if (!t) return { perRepSeconds: 0, explosive: false, valid: false }

  // Kanoniczny zapis 3–4 znaki, każdy = cyfra lub X (np. „3010”, „30X0”, „201”).
  if (/^[\dxX]{3,4}$/.test(t)) {
    let sec = 0
    let explosive = false
    for (const ch of t) {
      if (ch === 'x' || ch === 'X') { explosive = true; sec += X_AS_SECONDS }
      else sec += parseInt(ch, 10)
    }
    return { perRepSeconds: sec, explosive, valid: sec > 0 }
  }

  // Zapis opisowy („5'' ecc”, „3-0-1”) — sumujemy liczby, X gdziekolwiek = eksplozja.
  const explosive = /x/i.test(t)
  const nums = t.match(/\d+/g)
  const sec = (nums ? nums.reduce((a, n) => a + parseInt(n, 10), 0) : 0) + (explosive ? X_AS_SECONDS : 0)
  return { perRepSeconds: sec, explosive, valid: sec > 0 }
}

// ── Powtórzenia ───────────────────────────────────────────────────
// Reprezentatywna liczba powtórzeń W JEDNEJ SERII:
//   „8”      → 8
//   „8-10”   → 9   (środek zakresu)
//   „1+1”    → 2   (suma — np. complex)
//   „AMRAP” / „max” → null (isMax = true), nie da się sklasyfikować z góry.
export interface RepsInfo {
  reps: number | null
  isMax: boolean
}

const MAX_REPS_RE = /(amrap|maks|max|upad|do upadku|fail)/i

export function parseReps(reps?: string | null): RepsInfo {
  const r = (reps || '').trim()
  if (!r) return { reps: null, isMax: false }
  if (MAX_REPS_RE.test(r)) return { reps: null, isMax: true }

  const range = r.match(/^\s*(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*$/)
  if (range) {
    const a = parseFloat(range[1].replace(',', '.'))
    const b = parseFloat(range[2].replace(',', '.'))
    return { reps: (a + b) / 2, isMax: false }
  }

  const nums = r.match(/\d+(?:[.,]\d+)?/g)
  if (!nums) return { reps: null, isMax: false }
  const sum = nums.reduce((a, n) => a + parseFloat(n.replace(',', '.')), 0)
  return { reps: sum > 0 ? sum : null, isMax: false }
}

// ── Profil rozmyty z liczby powtórzeń ─────────────────────────────
// Zakresy kategorii (zgodnie z metodyką): SW 1–5, HF 6–8, HO 9–12,
// WS 13–20, WO 20+. Wewnątrz zakresu kategoria jest ~100%, a wyłącznie
// w strefie przejściowej wokół granicy (±TW powt.) profil płynnie miesza
// dwie sąsiednie kategorie. Dzięki temu „5 powt.” to wyraźnie siła, a
// granice (5/6, 8/9, …) nie powodują nagłych przeskoków.
const BOUNDARIES = [5.5, 8.5, 12.5, 20.5] // granice między kolejnymi kategoriami
const TRANSITION = 1.5                      // pół-szerokość strefy mieszania (powt.)

function emptyProfile(): StimulusProfile {
  return { sila: 0, hiper_funk: 0, hiper_og: 0, wytrz_og: 0, wytrz_sil: 0 }
}

export function repsProfile(reps: number): StimulusProfile {
  const p = emptyProfile()
  // Strefa przejściowa wokół granicy → liniowy blend dwóch sąsiednich kategorii.
  for (let i = 0; i < BOUNDARIES.length; i++) {
    const b = BOUNDARIES[i]
    if (Math.abs(reps - b) < TRANSITION) {
      const upper = (reps - b) / (2 * TRANSITION) + 0.5 // udział wyższej kategorii (0..1)
      p[CATEGORY_ORDER[i]] = 1 - upper
      p[CATEGORY_ORDER[i + 1]] = upper
      return p
    }
  }
  // Poza strefami przejściowymi — pełna przynależność do jednej kategorii.
  const idx = BOUNDARIES.filter(b => reps >= b).length
  p[CATEGORY_ORDER[idx]] = 1
  return p
}

// ── Charakter bodźca z TUT serii ──────────────────────────────────
// TUT nie zmienia kategorii (o tym decydują powtórzenia) — doprecyzowuje
// charakter pracy: krótki TUT = napięcie mechaniczne, długi = stres metaboliczny.
export function characterFromTut(tutPerSet: number): StimulusCharacter {
  if (tutPerSet <= 0) return 'mixed'
  if (tutPerSet <= 20) return 'mechanical'
  if (tutPerSet <= 45) return 'mixed'
  return 'metabolic'
}

// ── Tagi opisowe (heurystyka po nazwie) ───────────────────────────
// W tym widoku mamy tylko nazwę ćwiczenia, więc wzorce ruchu i charakterystyka
// to BEST-EFFORT z nazwy — wsparcie analiz, nie twarda klasyfikacja.
const PATTERN_KEYWORDS: Array<[string, RegExp]> = [
  ['squat', /(squat|przysiad|pistol|goblet|bulgar|zerch|hack)/i],
  ['hinge', /(hinge|rdl|deadlift|martwy|nordic|hip thrust|glute|swing|good ?morning|romanian|ham)/i],
  ['push', /(push|pompk|press|wycisk|wyciskanie|dip|ohp|sztos|francuz|barki|btn)/i],
  ['pull', /(pull|podci[aą]g|row|wios[lł]|ci[aą]g|chin|lat|face ?pull|nawijanie|biceps)/i],
  ['lunge', /(lunge|wykrok|zakrok|step ?up|wejscia|wej[sś]cia|split squat)/i],
  ['carry', /(carry|farmer|nosze|spacer|walk)/i],
  ['rotation', /(rotat|twist|windmill|russian|skr[eę]t|pallof|chop|wood)/i],
  ['locomotion', /(bear|crawl|sprint|bieg|skip|prowl|sled)/i],
]

const CHAR_KEYWORDS: Array<[string, RegExp]> = [
  ['unilateral', /(pistol|bulgar|lunge|wykrok|zakrok|jednon|single|split|windmill|step ?up|one ?arm|one ?leg|na jedn)/i],
  ['eccentric', /(eccentric|ekscentr|negativ|negatyw|nordic|tempo|yielding)/i],
  ['isometric', /(hold|iso|isometr|izometr|plank|deska|pause|przytrzym|l-sit|wall sit)/i],
  ['plyometric', /(jump|skok|plyo|plio|box|hop|bound|depth|broad|cmj|reactive)/i],
]

export function tagsFromName(name: string, bodyweight?: boolean): { patterns: string[]; characteristics: string[] } {
  const n = (name || '').trim()
  const patterns = PATTERN_KEYWORDS.filter(([, re]) => re.test(n)).map(([t]) => t)
  const characteristics = CHAR_KEYWORDS.filter(([, re]) => re.test(n)).map(([t]) => t)
  if (bodyweight && !characteristics.includes('bodyweight')) characteristics.push('bodyweight')
  return { patterns, characteristics }
}

// ── Agregacja serii ───────────────────────────────────────────────
// Wspólny rdzeń: bierze listę serii (każda z własnymi powt./tempo) i sumuje
// je w jeden profil, ważąc każdą serię ilością pracy. Używany zarówno dla
// nagłówka grupy (N kopii tej samej serii), jak i dla serii zawodniczki.
export interface SetInput {
  reps?: string | null
  tempo?: string | null
}

interface Aggregate {
  profile: StimulusProfile
  totalTut: number
  totalReps: number
  tutPerSet: number          // średni TUT na serię
  repsPerSet: number | null  // reprezentatywne powt. (ważone pracą)
  explosive: boolean
  isMax: boolean
  setCount: number           // ile serii dało się sklasyfikować
  work: number
}

function aggregateSets(sets: SetInput[]): Aggregate {
  const acc = emptyProfile()
  let totalTut = 0, totalReps = 0, work = 0
  let explosive = false, isMax = false, setCount = 0
  let repsWeighted = 0, repsWeightSum = 0, tutSum = 0
  for (const s of sets) {
    const { reps, isMax: m } = parseReps(s.reps)
    const tempo = parseTempo(s.tempo)
    if (m) isMax = true
    if (tempo.explosive) explosive = true
    if (reps == null) continue
    setCount++
    const tut = reps * tempo.perRepSeconds
    const w = tut > 0 ? tut : reps
    totalTut += tut; tutSum += tut; totalReps += reps; work += w
    const p = repsProfile(reps)
    for (const c of CATEGORY_ORDER) acc[c] += p[c] * w
    repsWeighted += reps * w; repsWeightSum += w
  }
  return {
    profile: normalize(acc),
    totalTut, totalReps,
    tutPerSet: setCount > 0 ? tutSum / setCount : 0,
    repsPerSet: repsWeightSum > 0 ? repsWeighted / repsWeightSum : null,
    explosive, isMax, setCount, work,
  }
}

// ── Analiza pojedynczego ćwiczenia / zadania ──────────────────────
export interface AthleteSetsInput {
  athleteId: number
  variant?: string | null
  sets: SetInput[]
}

// Wariant zadania — własna rozpiska (może nadpisywać nagłówek grupy).
export interface TaskVariant {
  name: string
  sets?: number | null
  reps?: string | null
  tempo?: string | null
  bodyweight?: boolean | null  // wariant na masie własnej (nie zmienia profilu bodźca)
  individual?: boolean | null  // wariant indywidualny — rozpiska per zawodniczka (z wierszy)
}

export interface ExerciseInput {
  name: string
  // tryb grupowy (nagłówek kolumny) — obowiązuje całą grupę
  sets?: number | null     // liczba serii (sets_planned)
  reps?: string | null     // np. „8”, „8-10”, „AMRAP”
  tempo?: string | null    // np. „3010”, „30X0”
  bodyweight?: boolean | null
  // zadanie z wariantami / tryb indywidualny
  individual?: boolean | null
  variants?: TaskVariant[] | null
  athletes?: AthleteSetsInput[]  // dane zawodniczek (tryb indyw. / warianty z rozpiską)
}

// Czy któryś wariant ma własną rozpiskę (serie/powt./tempo)?
export function variantHasPrescription(v: TaskVariant): boolean {
  return v.sets != null || !!(v.reps && v.reps.trim()) || !!(v.tempo && v.tempo.trim())
}

export interface VariantUsage { variant: string; count: number }

export interface ExerciseAnalysis {
  name: string
  mode: 'group' | 'individual'
  // metryki konstrukcji
  sets: number               // liczba serii (grupowo) lub 0 (indywidualnie)
  repsPerSet: number | null
  isMax: boolean
  perRepSeconds: number       // grupowo: czas powt. z nagłówka; indywid.: 0
  tempoValid: boolean
  tutPerSet: number          // TUT jednej serii / średni TUT serii (s)
  totalTut: number           // całkowity TUT (s)
  totalReps: number          // całkowita liczba powtórzeń
  // klasyfikacja
  profile: StimulusProfile
  dominant: StimulusCategory | null
  character: StimulusCharacter
  explosive: boolean
  confidence: Confidence
  // warianty
  variantsDefined: string[]
  variantUsage: VariantUsage[]
  athleteCount: number       // ile zawodniczek dostarczyło dane (tryb indyw.)
  // tagi
  patterns: string[]
  characteristics: string[]
  // waga ćwiczenia w profilu treningu (ilość pracy)
  work: number
}

function dominantOf(p: StimulusProfile): { cat: StimulusCategory | null; share: number } {
  let cat: StimulusCategory | null = null
  let share = 0
  for (const c of CATEGORY_ORDER) {
    if (p[c] > share) { share = p[c]; cat = c }
  }
  return { cat, share }
}

function confidenceFrom(share: number, hasReps: boolean, tempoValid: boolean): Confidence {
  if (!hasReps) return 'niska'
  if (share >= 0.75) return tempoValid ? 'wysoka' : 'srednia'
  if (share >= 0.55) return 'srednia'
  return 'niska'
}

// Zlicza użycie wariantów wśród zawodniczek (każda wybrany wariant = +1).
function countVariants(athletes: AthleteSetsInput[] | undefined, defined: string[]): VariantUsage[] {
  const map = new Map<string, number>()
  for (const a of athletes || []) {
    const v = (a.variant || '').trim()
    if (v) map.set(v, (map.get(v) || 0) + 1)
  }
  // najpierw warianty w kolejności zdefiniowanej, potem ewentualne spoza listy
  const out: VariantUsage[] = []
  for (const v of defined) if (map.has(v)) { out.push({ variant: v, count: map.get(v)! }); map.delete(v) }
  for (const [variant, count] of map) out.push({ variant, count })
  return out.sort((a, b) => b.count - a.count)
}

export function analyzeExercise(ex: ExerciseInput): ExerciseAnalysis {
  const variants = ex.variants || []
  const variantsDefined = variants.map(v => (v.name || '').trim()).filter(Boolean)
  const variantUsage = countVariants(ex.athletes, variantsDefined)
  const { patterns, characteristics } = tagsFromName(ex.name, ex.bodyweight ?? undefined)
  // Liczymy per zawodniczka, gdy tryb indywidualny ALBO któryś wariant ma własną
  // rozpiskę (wtedy zawodniczki mogą wykonywać różne warianty = różny bodziec).
  const perAthlete = !!ex.individual || variants.some(v => variantHasPrescription(v) || !!v.individual)

  const base = {
    name: ex.name,
    variantsDefined, variantUsage,
    patterns, characteristics,
  }

  if (perAthlete) {
    // Tryb indywidualny — agregujemy profile zawodniczek, każdą ważąc jej pracą.
    const acc = emptyProfile()
    let totalTut = 0, totalReps = 0, work = 0, tutSum = 0, setCountAll = 0
    let explosive = false, isMax = false, athleteCount = 0
    let repsWeighted = 0, repsWeightSum = 0
    for (const a of ex.athletes || []) {
      const ag = aggregateSets(a.sets || [])
      if (ag.isMax) isMax = true
      if (ag.explosive) explosive = true
      if (ag.setCount === 0) continue
      athleteCount++
      const w = ag.work || 1
      for (const c of CATEGORY_ORDER) acc[c] += ag.profile[c] * w
      totalTut += ag.totalTut; totalReps += ag.totalReps; work += w
      tutSum += ag.totalTut; setCountAll += ag.setCount
      if (ag.repsPerSet != null) { repsWeighted += ag.repsPerSet * w; repsWeightSum += w }
    }
    const profile = normalize(acc)
    const { cat: dominant, share } = dominantOf(profile)
    const repsPerSet = repsWeightSum > 0 ? repsWeighted / repsWeightSum : null
    const tutPerSet = setCountAll > 0 ? tutSum / setCountAll : 0
    return {
      ...base,
      mode: 'individual',
      sets: 0,
      repsPerSet, isMax,
      perRepSeconds: 0,
      tempoValid: totalTut > 0,
      tutPerSet, totalTut, totalReps,
      profile,
      dominant: athleteCount > 0 ? dominant : null,
      character: characterFromTut(tutPerSet),
      explosive,
      confidence: confidenceFrom(share, athleteCount > 0 && repsPerSet != null, totalTut > 0),
      athleteCount,
      work: work || totalReps,
    }
  }

  // Tryb grupowy — nagłówek obowiązuje całą grupę (N serii o tych samych powt./tempo).
  const sets = Math.max(0, Math.round(ex.sets ?? 0)) || 0
  const n = Math.max(sets, 1)
  const ag = aggregateSets(Array.from({ length: n }, () => ({ reps: ex.reps, tempo: ex.tempo })))
  const tempo = parseTempo(ex.tempo)
  const { cat: dominant, share } = dominantOf(ag.profile)
  return {
    ...base,
    mode: 'group',
    sets,
    repsPerSet: ag.repsPerSet, isMax: ag.isMax,
    perRepSeconds: tempo.perRepSeconds,
    tempoValid: tempo.valid,
    tutPerSet: ag.tutPerSet, totalTut: ag.totalTut, totalReps: ag.totalReps,
    profile: ag.profile, dominant,
    character: characterFromTut(ag.tutPerSet),
    explosive: tempo.explosive,
    confidence: confidenceFrom(share, ag.repsPerSet != null, tempo.valid),
    athleteCount: 0,
    work: ag.work,
  }
}

// ── Profil całego treningu ────────────────────────────────────────
// Profile ćwiczeń sumujemy WAŻONE ilością pracy — ćwiczenie generujące
// więcej pracy (TUT/powt.) ma większy wpływ na profil treningu.
export interface WorkoutAnalysis {
  exercises: ExerciseAnalysis[]
  totalTut: number
  totalReps: number
  profile: StimulusProfile
  dominant: StimulusCategory | null
  patternShare: Record<string, number>          // udział wzorców ruchu (0..1)
  characteristicShare: Record<string, number>    // udział charakterystyk (0..1)
  topExercises: ExerciseAnalysis[]               // największy wpływ na wynik
  classified: number                             // ile ćwiczeń dało się sklasyfikować
}

function normalize(p: StimulusProfile): StimulusProfile {
  const sum = CATEGORY_ORDER.reduce((a, c) => a + p[c], 0)
  if (sum <= 0) return p
  const out = emptyProfile()
  for (const c of CATEGORY_ORDER) out[c] = p[c] / sum
  return out
}

export function analyzeWorkout(inputs: ExerciseInput[]): WorkoutAnalysis {
  const exercises = inputs.map(analyzeExercise)

  const acc = emptyProfile()
  let totalTut = 0
  let totalReps = 0
  let classified = 0
  const patternWork: Record<string, number> = {}
  const charWork: Record<string, number> = {}
  let tagWorkTotal = 0

  for (const ex of exercises) {
    totalTut += ex.totalTut
    totalReps += ex.totalReps
    if (ex.dominant) {
      classified++
      const w = ex.work || 1
      for (const c of CATEGORY_ORDER) acc[c] += ex.profile[c] * w
    }
    const w = ex.work || 1
    if (ex.patterns.length || ex.characteristics.length) tagWorkTotal += w
    for (const p of ex.patterns) patternWork[p] = (patternWork[p] || 0) + w
    for (const c of ex.characteristics) charWork[c] = (charWork[c] || 0) + w
  }

  const profile = normalize(acc)
  const { cat: dominant } = dominantOf(profile)

  const toShare = (rec: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {}
    if (tagWorkTotal <= 0) return out
    for (const k of Object.keys(rec)) out[k] = rec[k] / tagWorkTotal
    return out
  }

  const topExercises = [...exercises]
    .filter(e => e.work > 0)
    .sort((a, b) => b.work - a.work)
    .slice(0, 3)

  return {
    exercises,
    totalTut,
    totalReps,
    profile,
    dominant,
    patternShare: toShare(patternWork),
    characteristicShare: toShare(charWork),
    topExercises,
    classified,
  }
}

// ── Formatowanie ──────────────────────────────────────────────────
export function fmtSeconds(sec: number): string {
  if (sec <= 0) return '—'
  const s = Math.round(sec)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} min`
}

export function pct(x: number): number {
  return Math.round(x * 100)
}
