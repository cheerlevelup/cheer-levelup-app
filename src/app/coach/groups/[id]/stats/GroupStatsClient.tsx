'use client'
// src/app/coach/groups/[id]/stats/GroupStatsClient.tsx
// Statystyki grupy zorganizowanej:
//  • Statystyki — jeden wykres na metrykę, wszystkie zawodniczki osobno (linie),
//    wybór ćwiczenia i metryki osi Y; oś X = kolejne daty treningów.
//  • Obecność — tabela daty × zawodniczki + statystyki opuszczonych treningów.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { loadPdf, pl, drawHeaderBar, drawFooter, svgToPng, svgMarkupToPng, TABLE_STYLES } from '@/lib/groupPdf'
import { coerceVariant, cleanVariantName, normExerciseName, groupKey } from '@/lib/variants'
import { coachTheme } from '@/lib/coach-theme'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, Card, Button, SegmentedControl, Field, StatsTable } from '@/components/coach/ui'
import GroupSummaryClient from '../summary/GroupSummaryClient'

// Paleta dla zawodniczek (linie wykresu / obecność). Powtarza się przy >16 osobach.
// To paleta kategoryzująca dane (per-zawodniczka), nie kolor marki — zostaje bez zmian.
const PALETTE = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED', '#DB2777',
  '#0891B2', '#65A30D', '#EA580C', '#4F46E5', '#0D9488', '#BE123C',
  '#9333EA', '#CA8A04', '#0284C7', '#15803D',
]

type Group = { id: number; name: string; group_type?: string }
type Athlete = { id: number; full_name: string }
type SelfSession = { athlete_id: number; workout_day_id: number; completed?: boolean; created_at: string; date_completed?: string | null }
type SelfFeedback = { athlete_id: number; session_rpe?: number | null; created_at: string }
type SelfPlanDay = { id: number }
type Training = { id: number; group_id: number; training_date: string; absent_athlete_ids?: number[] | null }
type SetRow = { reps?: string; tempo?: string; weight?: string; skipped?: boolean }
type VariantDef = string | { name?: string; sets?: number | null; reps?: string | null; tempo?: string | null; bodyweight?: boolean | null }
type Exercise = { id: number; training_id: number; name: string; reps?: string | null; tempo?: string | null; sets_planned?: number | null; bodyweight?: boolean | null; variants?: VariantDef[] | null }
type Entry = { training_id: number; exercise_id: number; athlete_id: number; sets: SetRow[]; variant?: string | null; bodyweight?: boolean | null; exercise_override?: string | null }

// „Ścieżka" wykresu = konkretne ćwiczenie albo jego wariant (osobno).
// null variant = wykonanie podstawowe (bez wybranego wariantu).
type Track = { key: string; exName: string; variant: string | null; label: string; freq: number }
const trackKey = (exName: string, variant: string | null) => `${exName} ${variant ?? ''}`

interface Props {
  group: Group
  athletes: Athlete[]
  trainings: Training[]
  exercises: Exercise[]
  entries: Entry[]
  bodyWeights: Record<number, number>
  selfSessions?: SelfSession[]
  selfFeedbacks?: SelfFeedback[]
  selfActivePlanDays?: SelfPlanDay[]
}

function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function filterByDays<T extends { [key: string]: any }>(rows: T[], days: number, dateField = 'created_at'): T[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return rows.filter(r => new Date(r[dateField]) >= cutoff)
}

// Statystyki treningowe dla grup samodzielnych — bez datowanych treningów grupowych,
// postęp liczony z przypisanego planu (workout_sessions) i feedbacku po sesji.
function SelfGroupTrainingStats({ athletes, sessions, feedbacks, activePlanDays, onAthleteClick }: {
  athletes: Athlete[]
  sessions: SelfSession[]
  feedbacks: SelfFeedback[]
  activePlanDays: SelfPlanDay[]
  onAthleteClick: (id: number) => void
}) {
  const [period, setPeriod] = useState(30)

  const sessionIndex: Record<string, SelfSession> = {}
  for (const s of sessions) {
    const key = `${s.athlete_id}_${s.workout_day_id}`
    if (!sessionIndex[key] || new Date(s.created_at) > new Date(sessionIndex[key].created_at)) sessionIndex[key] = s
  }

  function getProgress(athleteId: number) {
    if (activePlanDays.length === 0) return null
    const done = activePlanDays.filter(d => sessionIndex[`${athleteId}_${d.id}`]?.completed).length
    return { done, total: activePlanDays.length }
  }

  return (
    <StatsTable
      title="Statystyki treningowe"
      period={period}
      onPeriodChange={setPeriod}
      cols={[
        { key: 'Zawodniczka', left: true },
        { key: 'Treningi', emoji: '🏋️' },
        { key: 'Ukończone', emoji: '✅' },
        { key: '% planu', emoji: '📊' },
        { key: 'Śr. RPE', emoji: '🔥' },
        { key: 'Min RPE', emoji: '↓' },
        { key: 'Max RPE', emoji: '↑' },
      ]}
      rows={athletes.map(athlete => {
        const athFb = filterByDays(feedbacks.filter(f => f.athlete_id === athlete.id), period)
        const rpeVals = athFb.map(f => f.session_rpe).filter((v): v is number => v != null)
        const rpeAvg = avg(rpeVals)
        const completed = filterByDays(sessions.filter(s => s.athlete_id === athlete.id && s.completed), period, 'date_completed').length
        const progress = getProgress(athlete.id)
        const pct = progress ? Math.round((progress.done / progress.total) * 100) : null
        const rpeColor = rpeAvg === null ? undefined : rpeAvg >= 8 ? '#EF4444' : rpeAvg >= 6 ? 'var(--gold)' : 'var(--green)'
        return {
          id: athlete.id, name: athlete.full_name,
          cells: [
            { v: athFb.length || null },
            { v: completed || null },
            { v: pct !== null ? `${pct}%` : null, color: pct === null ? undefined : pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : '#EF4444' },
            { v: rpeAvg !== null ? rpeAvg.toFixed(1) : null, color: rpeColor },
            { v: rpeVals.length ? Math.min(...rpeVals) : null },
            { v: rpeVals.length ? Math.max(...rpeVals) : null },
          ],
        }
      })}
      onAthleteClick={onAthleteClick}
    />
  )
}

type Metric = 'weight_max' | 'reps_sum' | 'volume'
const METRICS: { id: Metric; label: string; unit: string; desc: string }[] = [
  { id: 'weight_max', label: 'Ciężar (kg)', unit: 'kg', desc: 'najcięższa seria danego dnia' },
  { id: 'reps_sum', label: 'Powtórzenia', unit: 'powt.', desc: 'suma powtórzeń danego dnia' },
  { id: 'volume', label: 'Objętość (kg)', unit: 'kg', desc: 'tonaż: Σ powtórzeń × ciężar' },
]

// Suma liczb w tekście („8”→8, „8-10”→18? nie — bierzemy pierwszą), tu: suma grup cyfr.
function sumNumbers(s?: string | null): number {
  const m = String(s ?? '').match(/\d+(?:[.,]\d+)?/g)
  return m ? m.reduce((a, x) => a + parseFloat(x.replace(',', '.')), 0) : 0
}
function firstNumber(s?: string | null): number {
  const m = String(s ?? '').match(/\d+(?:[.,]\d+)?/)
  return m ? parseFloat(m[0].replace(',', '.')) : 0
}

// Powtórzenia z rozpiski obowiązującej daną ścieżkę: wariant > nagłówek ćwiczenia.
function prescRepsFor(ex: Exercise, variant: string | null): number {
  if (variant) {
    const vk = groupKey(variant)
    for (const raw of ex.variants || []) {
      const cv = coerceVariant(raw)
      if (cv && groupKey(cv.name) === vk && cv.reps.trim()) return sumNumbers(cv.reps)
    }
  }
  return sumNumbers(ex.reps)
}

// Powtórzenia z rozpiski jako TEKST (zachowuje zapis typu „2+2", „8-10") — do
// wyświetlania w tabeli szczegółów (nie sumujemy).
function prescRepsStrFor(ex: Exercise, variant: string | null): string {
  if (variant) {
    const vk = groupKey(variant)
    for (const raw of ex.variants || []) {
      const cv = coerceVariant(raw)
      if (cv && groupKey(cv.name) === vk && cv.reps.trim()) return cv.reps.trim()
    }
  }
  return (ex.reps || '').trim()
}

// Tempo z rozpiski obowiązującej daną ścieżkę: wariant > nagłówek.
function prescTempoFor(ex: Exercise, variant: string | null): string {
  if (variant) {
    const vk = groupKey(variant)
    for (const raw of ex.variants || []) {
      const cv = coerceVariant(raw)
      if (cv && groupKey(cv.name) === vk && cv.tempo.trim()) return cv.tempo
    }
  }
  return (ex.tempo || '').trim()
}

// Krótki opis komórki: „serie × powt. · ciężar · tempo" (puste pola pomijane).
// Powt./tempo pustych serii dziedziczą z rozpiski; ciężar tylko gdy wpisany.
// Liczy TYLKO gdy wpis pasuje do wybranej ścieżki (wariant/podstawa) — tak jak wykres.
function cellDetail(entry: Entry | undefined, ex: Exercise, variant: string | null, prescRepsStr: string, prescTempo: string): string {
  if (!entry || entry.exercise_override) return '—'
  const ev = cleanVariantName(entry.variant)
  if ((ev ? groupKey(ev) : null) !== (variant ? groupKey(variant) : null)) return '—'
  const sets = (entry.sets || []).filter(s => !s.skipped)
  if (sets.length === 0) return '—'
  // powt. jako TEKST (np. „2+2", „8-10") — nie sumujemy; puste serie z rozpiski
  const fallback = /(amrap|maks|max|upad)/i.test(prescRepsStr) ? '' : prescRepsStr
  const repsStrs = sets.map(s => (s.reps || '').trim() || fallback)
  const weights = sets.map(s => firstNumber(s.weight)).filter(w => w > 0)
  const tempos = Array.from(new Set(sets.map(s => (s.tempo || '').trim()).filter(Boolean)))
  const tempo = tempos.length ? tempos.join('/') : prescTempo

  let repsPart = `${sets.length} ser.`
  if (repsStrs.some(Boolean)) {
    const shown = repsStrs.map(r => r || '?')
    const uniq = Array.from(new Set(shown))
    // „n×powt." tylko dla ćwiczeń z ciężarem i jednolitych serii; bez ciężaru
    // (np. pull-up) zawsze wypisujemy każdą serię przez „/" (np. 5/5/3).
    const collapse = weights.length > 0 && uniq.length === 1
    repsPart = collapse ? `${sets.length}×${uniq[0]}` : shown.join('/')
  }
  const parts = [repsPart]
  if (weights.length) {
    const uw = Array.from(new Set(weights))
    parts.push(`${uw.map(w => Math.round(w * 10) / 10).join('/')} kg`)
  }
  if (tempo) parts.push(tempo)
  return parts.join(' · ')
}

// Wartość metryki dla jednej zawodniczki w jednym treningu (null = brak danych).
function metricValue(entry: Entry | undefined, ex: Exercise | undefined, metric: Metric, prescReps: number): number | null {
  if (!entry || !ex) return null
  if (entry.exercise_override) return null // robiła inne ćwiczenie — nie porównujemy
  const sets = (entry.sets || []).filter(s => !s.skipped)
  if (sets.length === 0) return null
  if (metric === 'weight_max') {
    const ws = sets.map(s => firstNumber(s.weight)).filter(w => w > 0)
    return ws.length ? Math.max(...ws) : null
  }
  if (metric === 'reps_sum') {
    let total = 0, any = false
    for (const s of sets) {
      const r = sumNumbers(s.reps) || prescReps
      if (r > 0) { total += r; any = true }
    }
    return any ? total : null
  }
  // volume = Σ powt. × ciężar
  let vol = 0, any = false
  for (const s of sets) {
    const r = sumNumbers(s.reps) || prescReps
    const w = firstNumber(s.weight)
    if (r > 0 && w > 0) { vol += r * w; any = true }
  }
  return any ? vol : null
}

const colorOf = (i: number) => PALETTE[i % PALETTE.length]

// ── Wykres liniowy (SVG) — wiele serii (zawodniczek) na jednej osi ──────────────
function LineChart({ dates, series, unit, yLabel }: {
  dates: string[]
  series: { id: number; name: string; color: string; points: (number | null)[] }[]
  unit: string
  yLabel: string
}) {
  const W = 760, H = 340
  const padL = 58, padR = 16, padT = 16, padB = 56
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const allVals = series.flatMap(s => s.points.filter((v): v is number => v != null))
  if (dates.length === 0 || allVals.length === 0) {
    return (
      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted-light)' }}>
        Brak danych dla tego ćwiczenia i metryki — wybierz inne albo wpisz wyniki w treningach.
      </div>
    )
  }
  const maxV = Math.max(...allVals)
  const minV = Math.min(0, ...allVals)
  const span = maxV - minV || 1
  // „ładne” linie siatki (5 poziomów)
  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (span * i) / ticks)

  const x = (i: number) => dates.length === 1 ? padL + innerW / 2 : padL + (innerW * i) / (dates.length - 1)
  const y = (v: number) => padT + innerH - ((v - minV) / span) * innerH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: dates.length > 6 ? 520 : undefined }}>
      {/* tytuł osi Y — jaka metryka (powtórzenia / ciężar) */}
      <text x={16} y={padT + innerH / 2} textAnchor="middle" transform={`rotate(-90 16 ${padT + innerH / 2})`}
        fontSize={12} fontWeight={700} fill={coachTheme.navy900}>
        {yLabel}
      </text>
      {/* tytuł osi X */}
      <text x={padL + innerW / 2} y={H - 6} textAnchor="middle" fontSize={9} fill={coachTheme.mutedLight}>
        data treningu
      </text>
      {/* siatka pozioma + etykiety osi Y */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke={coachTheme.border} strokeWidth={1} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill={coachTheme.mutedLight}>
            {Math.round(t * 10) / 10}
          </text>
        </g>
      ))}
      {/* etykiety osi X (daty) */}
      {dates.map((d, i) => {
        const show = dates.length <= 8 || i % Math.ceil(dates.length / 8) === 0 || i === dates.length - 1
        if (!show) return null
        const label = d.slice(5) // MM-DD
        return (
          <text key={i} x={x(i)} y={H - padB + 16} textAnchor="middle" fontSize={9} fill={coachTheme.mutedLight}
            transform={dates.length > 8 ? `rotate(35 ${x(i)} ${H - padB + 16})` : undefined}>
            {label}
          </text>
        )
      })}
      {/* linie zawodniczek */}
      {series.map(s => {
        // łączymy tylko kolejne punkty z danymi (pomijamy luki w wynikach)
        const path = s.points.map((v, i) => v == null ? '' : `${i > 0 && s.points[i - 1] != null ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
        return (
          <g key={s.id}>
            <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((v, i) => v == null ? null : (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color}>
                <title>{s.name} · {dates[i]} · {Math.round(v * 10) / 10} {unit}</title>
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// Ten sam wykres jako string <svg> — do eksportu kilku wykresów naraz (bez DOM).
// Renderowany jako izolowany dokument SVG (data: URI -> canvas), więc kolory muszą
// być literalnymi hex (coachTheme.*), nie zmiennymi CSS (var() tu się nie rozwiąże).
function chartSvgMarkup(dates: string[], series: { color: string; points: (number | null)[] }[], yLabel: string): string | null {
  const W = 760, H = 340, padL = 58, padR = 16, padT = 16, padB = 56
  const innerW = W - padL - padR, innerH = H - padT - padB
  const allVals = series.flatMap(s => s.points.filter((v): v is number => v != null))
  if (dates.length === 0 || allVals.length === 0) return null
  const maxV = Math.max(...allVals), minV = Math.min(0, ...allVals), span = (maxV - minV) || 1
  const x = (i: number) => dates.length === 1 ? padL + innerW / 2 : padL + (innerW * i) / (dates.length - 1)
  const y = (v: number) => padT + innerH - ((v - minV) / span) * innerH
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let p = ''
  p += `<text x="16" y="${padT + innerH / 2}" text-anchor="middle" transform="rotate(-90 16 ${padT + innerH / 2})" font-size="12" font-weight="700" fill="${coachTheme.navy900}">${esc(yLabel)}</text>`
  p += `<text x="${padL + innerW / 2}" y="${H - 6}" text-anchor="middle" font-size="9" fill="${coachTheme.mutedLight}">data treningu</text>`
  const ticks = 4
  for (let i = 0; i <= ticks; i++) {
    const tv = minV + (span * i) / ticks, yy = y(tv)
    p += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${coachTheme.border}" stroke-width="1"/>`
    p += `<text x="${padL - 6}" y="${yy + 3}" text-anchor="end" font-size="9" fill="${coachTheme.mutedLight}">${Math.round(tv * 10) / 10}</text>`
  }
  dates.forEach((d, i) => {
    const show = dates.length <= 8 || i % Math.ceil(dates.length / 8) === 0 || i === dates.length - 1
    if (!show) return
    const xx = x(i), yy = H - padB + 16
    const rot = dates.length > 8 ? ` transform="rotate(35 ${xx} ${yy})"` : ''
    p += `<text x="${xx}" y="${yy}" text-anchor="middle" font-size="9" fill="${coachTheme.mutedLight}"${rot}>${esc(d.slice(5))}</text>`
  })
  for (const s of series) {
    let dp = ''
    s.points.forEach((v, i) => { if (v == null) return; dp += `${i > 0 && s.points[i - 1] != null ? 'L' : 'M'}${x(i)},${y(v)} ` })
    if (dp) p += `<path d="${dp}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
    s.points.forEach((v, i) => { if (v == null) return; p += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}"/>` })
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${p}</svg>`
}

export default function GroupStatsClient({ group, athletes, trainings, exercises, entries, bodyWeights, selfSessions = [], selfFeedbacks = [], selfActivePlanDays = [] }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'stats' | 'summary'>('stats')
  // Podsumowanie (osadzone) oczekuje najnowszego treningu jako trainings[0] —
  // ta strona sortuje rosnąco (do wykresów w czasie), więc dajemy mu osobną, malejącą kopię.
  const trainingsDesc = useMemo(
    () => [...trainings].sort((a, b) => b.training_date.localeCompare(a.training_date)),
    [trainings]
  )

  // Indeksy pomocnicze
  const exById = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises])
  const entryByKey = useMemo(() => {
    const m = new Map<string, Entry>()
    for (const e of entries) m.set(`${e.exercise_id}_${e.athlete_id}`, e)
    return m
  }, [entries])

  // Lista treningów rosnąco po dacie (oś X)
  const sortedTrainings = useMemo(
    () => [...trainings].sort((a, b) => a.training_date.localeCompare(b.training_date)),
    [trainings]
  )

  // Ścieżki = ćwiczenia i ich warianty OSOBNO. Wariant to inny bodziec i często
  // robi go tylko część grupy (np. „negatywne podciąganie" zamiast „podciąganie"),
  // więc liczymy go jako osobną pozycję, nie miesza się z wykonaniem podstawowym.
  const tracks = useMemo<Track[]>(() => {
    // klucz grupy (bez wielkości liter / niewidocznych znaków) -> dane,
    // żeby „Podciaganie" i „podciaganie" były jednym ćwiczeniem (bez duplikatów).
    type Rec = { freq: number; display: string; hasBase: boolean; variants: Map<string, string> }
    const byKey = new Map<string, Rec>()
    const ensure = (key: string, display: string) => {
      let r = byKey.get(key)
      if (!r) { r = { freq: 0, display, hasBase: false, variants: new Map() }; byKey.set(key, r) }
      return r
    }
    const addVariant = (r: Rec, raw: unknown) => {
      const name = cleanVariantName(raw)
      if (name) r.variants.set(groupKey(name), name) // dedupe wariantów też bez wielkości liter
    }
    for (const ex of exercises) {
      const key = groupKey(ex.name)
      if (!key) continue
      const r = ensure(key, normExerciseName(ex.name))
      r.freq++
      for (const v of ex.variants || []) addVariant(r, v)
    }
    // warianty/podstawa faktycznie wybrane przez zawodniczki
    for (const e of entries) {
      const ex = exById.get(e.exercise_id)
      const key = groupKey(ex?.name)
      if (!key) continue
      const r = ensure(key, normExerciseName(ex?.name))
      const name = cleanVariantName(e.variant)
      if (name) addVariant(r, name); else r.hasBase = true
    }
    const out: Track[] = []
    // alfabetycznie po nazwie ćwiczenia (warianty pod swoim ćwiczeniem)
    const recs = Array.from(byKey.entries()).sort((a, b) => a[1].display.localeCompare(b[1].display, 'pl'))
    for (const [key, r] of recs) {
      const hasVariants = r.variants.size > 0
      // podstawa: gdy ktoś robił bez wariantu, albo ćwiczenie w ogóle nie ma wariantów
      if (r.hasBase || !hasVariants) {
        out.push({ key: trackKey(key, null), exName: key, variant: null, label: hasVariants ? `${r.display} · podstawa` : r.display, freq: r.freq })
      }
      for (const v of Array.from(r.variants.values()).sort((a, b) => a.localeCompare(b, 'pl'))) {
        out.push({ key: trackKey(key, v), exName: key, variant: v, label: `${r.display} · ${v}`, freq: r.freq })
      }
    }
    return out
  }, [exercises, entries, exById])

  // Najczęściej stosowane ćwiczenia (po liczbie treningów) — przypięte na górze listy.
  const topTracks = useMemo(() => {
    const freqByEx = new Map<string, number>()
    for (const t of tracks) freqByEx.set(t.exName, t.freq)
    const topEx = new Set(
      Array.from(freqByEx.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .filter(([, f]) => f > 1)        // „często" = w więcej niż 1 treningu
        .map(([n]) => n)
    )
    return tracks
      .filter(t => topEx.has(t.exName))
      .sort((a, b) => b.freq - a.freq || a.label.localeCompare(b.label, 'pl'))
  }, [tracks])

  const [selectedKey, setSelectedKey] = useState<string>('')
  const [metric, setMetric] = useState<Metric>('weight_max')
  const [hidden, setHidden] = useState<Set<number>>(new Set())

  const effTrack = tracks.find(t => t.key === selectedKey) || topTracks[0] || tracks[0]

  // Dla danej ścieżki (ćwiczenie + wariant): dla każdego treningu, w którym ktoś
  // ją wykonał, policz metrykę per zawodniczka — licząc TYLKO pasujący wariant.
  // Funkcja (nie hook), by można było policzyć też inne ścieżki przy eksporcie wielu wykresów.
  const buildSeries = (track: Track | undefined, metricArg: Metric) => {
    const exName = track?.exName ?? ''
    const variant = track?.variant ?? null
    const variantK = variant ? groupKey(variant) : null
    const entryVariantK = (e: Entry) => { const n = cleanVariantName(e.variant); return n ? groupKey(n) : null }
    const dates: string[] = []
    const exIds: number[] = []
    for (const t of sortedTrainings) {
      const ex = exercises.find(e => e.training_id === t.id && groupKey(e.name) === exName)
      if (!ex) continue
      const anyMatch = athletes.some(a => {
        const e = entryByKey.get(`${ex.id}_${a.id}`)
        return e ? entryVariantK(e) === variantK : false
      })
      if (!anyMatch) continue
      dates.push(t.training_date)
      exIds.push(ex.id)
    }
    const series = athletes.map((a, i) => ({
      id: a.id,
      name: a.full_name,
      color: colorOf(i),
      points: exIds.map(exId => {
        const ex = exById.get(exId)
        const entry = entryByKey.get(`${exId}_${a.id}`)
        if (!ex || !entry) return null
        if (entryVariantK(entry) !== variantK) return null
        return metricValue(entry, ex, metricArg, prescRepsFor(ex, variant))
      }),
    }))
    return { dates, exIds, series, variant }
  }

  // Szczegóły (serie × powt. · ciężar · tempo) dla danej ścieżki — używane też w eksporcie.
  const buildDetail = (track: Track | undefined) => {
    const { dates, exIds, variant } = buildSeries(track, metric)
    const rows = athletes
      .map(a => ({
        name: a.full_name,
        cells: exIds.map(exId => {
          const ex = exById.get(exId)
          const entry = entryByKey.get(`${exId}_${a.id}`)
          return ex ? cellDetail(entry, ex, variant, prescRepsStrFor(ex, variant), prescTempoFor(ex, variant)) : '—'
        }),
      }))
      .filter(r => r.cells.some(c => c !== '—'))
    return { dates, rows }
  }

  const chart = useMemo(() => buildSeries(effTrack, metric),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedTrainings, exercises, exById, entryByKey, athletes, effTrack, metric])

  const visibleSeries = chart.series.filter(s => !hidden.has(s.id) && s.points.some(v => v != null))
  const metricMeta = METRICS.find(m => m.id === metric)!

  // Szczegółowa tabela: dla wybranej ścieżki, każda zawodniczka × data —
  // serie × powt., (ciężar), (tempo). Niezależna od wybranej metryki (pełen obraz).
  const detailTable = useMemo(() => {
    const rows = athletes.map(a => ({
      athlete: a,
      cells: chart.exIds.map(exId => {
        const ex = exById.get(exId)
        const entry = entryByKey.get(`${exId}_${a.id}`)
        if (!ex) return '—'
        return cellDetail(entry, ex, chart.variant, prescRepsStrFor(ex, chart.variant), prescTempoFor(ex, chart.variant))
      }),
    }))
    // pokaż tylko zawodniczki, które cokolwiek wykonały w tej ścieżce
    return rows.filter(r => r.cells.some(c => c !== '—'))
  }, [athletes, chart.exIds, chart.variant, exById, entryByKey])

  function toggleAthlete(id: number) {
    setHidden(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── Eksport PDF ──────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)
  const [multiOpen, setMultiOpen] = useState(false)
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set())

  function toggleMulti(key: string) {
    setMultiSel(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  // Eksport kilku wykresów do JEDNEGO PDF — każda zaznaczona ścieżka na osobnej
  // stronie: wykres (renderowany z markupu, nie z ekranu) + tabela szczegółów.
  async function exportMultiPdf() {
    const keys = tracks.filter(t => multiSel.has(t.key))
    if (exporting || keys.length === 0) return
    setExporting(true)
    try {
      const { jsPDF, autoTable } = await loadPdf()
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      let first = true
      for (const track of keys) {
        const { dates, series } = buildSeries(track, metric)
        const withData = series.filter(s => s.points.some(v => v != null))
        if (!first) doc.addPage()
        first = false
        let y = drawHeaderBar(doc, group.name, 'Statystyki', `${track.label} - ${metricMeta.label}`)
        const markup = chartSvgMarkup(dates, withData, metricMeta.label)
        if (markup) {
          const png = await svgMarkupToPng(markup, 760, 340, 2)
          const imgW = Math.min(pageW - 20, 250), imgH = imgW * (340 / 760)
          doc.addImage(png, 'PNG', (pageW - imgW) / 2, y, imgW, imgH)
          y += imgH + 6
        } else {
          doc.setFontSize(10); doc.text('Brak danych dla tej scieżki.', 14, y + 6); y += 8
        }
        const det = buildDetail(track)
        if (det.rows.length) {
          autoTable(doc, {
            startY: y,
            head: [['Zawodniczka', ...det.dates.map(d => d.slice(5))]],
            body: det.rows.map(r => [pl(r.name), ...r.cells.map(c => pl(c))]),
            ...TABLE_STYLES,
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 38 } },
            bodyStyles: { halign: 'center' },
            didDrawPage: () => drawFooter(doc),
          })
        } else {
          drawFooter(doc)
        }
      }
      doc.save(`statystyki_${keys.length}_wykresow.pdf`)
      setMultiOpen(false)
    } finally {
      setExporting(false)
    }
  }

  async function exportStatsPdf() {
    if (exporting) return
    setExporting(true)
    try {
      const { jsPDF, autoTable } = await loadPdf()
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      let y = drawHeaderBar(doc, group.name, 'Statystyki', `${effTrack?.label ?? ''} - ${metricMeta.label}`)
      // wykres ze strony (PNG)
      const svg = document.querySelector('#group-stats-chart svg') as SVGSVGElement | null
      if (svg) {
        try {
          const { dataUrl, w, h } = await svgToPng(svg, 2)
          const imgW = Math.min(pageW - 20, 250)
          const imgH = imgW * (h / w)
          doc.addImage(dataUrl, 'PNG', (pageW - imgW) / 2, y, imgW, imgH)
          y += imgH + 6
        } catch { /* brak wykresu — same liczby */ }
      }
      // tabela szczegółowa: zawodniczka × daty (serie × powt. · ciężar · tempo)
      if (detailTable.length === 0) {
        doc.setFontSize(10); doc.text('Brak danych dla tej scieżki.', 14, y + 6)
      } else {
        autoTable(doc, {
          startY: y,
          head: [['Zawodniczka', ...chart.dates.map(d => d.slice(5))]],
          body: detailTable.map(r => [pl(r.athlete.full_name), ...r.cells.map(c => pl(c))]),
          ...TABLE_STYLES,
          columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 38 } },
          bodyStyles: { halign: 'center' },
          didDrawPage: () => drawFooter(doc),
        })
      }
      doc.save(`statystyki_${pl(effTrack?.label ?? 'grupa').replace(/\s+/g, '_')}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <SetPageMeta title="Statystyki" backHref={`/coach/groups/${group.id}`} backLabel={group.name} />
      <TabsNav items={[
        { key: 'treningi', label: 'Treningi', href: `/coach/groups/${group.id}` },
        { key: 'plan', label: 'Plan', href: `/coach/groups/${group.id}/plan` },
        { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${group.id}/stats` },
        { key: 'obecnosc', label: 'Obecność', href: `/coach/groups/${group.id}/attendance` },
        { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${group.id}/athletes` },
        { key: 'testy', label: 'Testy', href: `/coach/groups/${group.id}/tests` },
      ]} />
      <div className="coach-content">
        {athletes.length === 0 ? (
          <Card><div className="coach-empty-list">Brak zawodniczek w grupie.</div></Card>
        ) : group.group_type !== 'managed' ? (
          <SelfGroupTrainingStats
            athletes={athletes}
            sessions={selfSessions}
            feedbacks={selfFeedbacks}
            activePlanDays={selfActivePlanDays}
            onAthleteClick={id => router.push(`/coach/athletes/${id}`)}
          />
        ) : trainings.length === 0 ? (
          <Card><div className="coach-empty-list">Brak treningów — najpierw przeprowadź lub wgraj trening.</div></Card>
        ) : (
          <>
            <div className="coach-toolbar">
              <SegmentedControl
                options={[{ value: 'stats', label: 'Postępy w ćwiczeniach' }, { value: 'summary', label: 'Podsumowanie' }]}
                value={tab}
                onChange={(v) => setTab(v as 'stats' | 'summary')}
              />
              {tab === 'stats' && (
                <div className="coach-toolbar-right">
                  <div className={`coach-chip ${multiOpen ? 'coach-active' : ''}`} onClick={() => setMultiOpen(o => !o)}>
                    Kilka wykresów{multiSel.size > 0 ? ` (${multiSel.size})` : ''}
                  </div>
                  <button className="coach-btn-pdf" onClick={exportStatsPdf} disabled={exporting}>
                    <Download /> {exporting ? 'Generuję PDF...' : 'Pobierz PDF'}
                  </button>
                </div>
              )}
            </div>

            {tab === 'summary' ? (
              <GroupSummaryClient group={group} athletes={athletes} trainings={trainingsDesc} bodyWeights={bodyWeights} />
            ) : (
              <>
                {multiOpen && (
                  <Card
                    title="Zaznacz wykresy do jednego PDF"
                    headerAction={
                      <Button
                        variant="ghost" size="small"
                        onClick={() => setMultiSel(prev => new Set(prev.size === tracks.length ? [] : tracks.map(t => t.key)))}
                      >
                        {multiSel.size === tracks.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                      </Button>
                    }
                  >
                    <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 230, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                        {tracks.map(t => (
                          <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.3rem 0.4rem', borderRadius: 6, cursor: 'pointer', background: multiSel.has(t.key) ? 'var(--bg)' : 'transparent' }}>
                            <input type="checkbox" checked={multiSel.has(t.key)} onChange={() => toggleMulti(t.key)} style={{ accentColor: 'var(--gold)', width: 15, height: 15 }} />
                            <span style={{ fontSize: '0.82rem', color: 'var(--ink)', fontWeight: multiSel.has(t.key) ? 700 : 500 }}>{t.label}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Button variant="dark" onClick={exportMultiPdf} disabled={exporting || multiSel.size === 0}>
                          <Download size={14} /> {exporting ? 'Generuję PDF...' : `Generuj PDF (${multiSel.size})`}
                        </Button>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted-light)' }}>każdy wykres na osobnej stronie · metryka: {metricMeta.label}</span>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Wybór ćwiczenia + metryki */}
                <Card>
                  <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <Field label="Ćwiczenie / wariant">
                      {tracks.length === 0 ? (
                        <div className="coach-empty-roster">Brak ćwiczeń w treningach.</div>
                      ) : (
                        <select value={effTrack?.key ?? ''} onChange={e => { setSelectedKey(e.target.value); setHidden(new Set()) }}>
                          {topTracks.length > 0 && (
                            <optgroup label="★ Najczęściej stosowane">
                              {topTracks.map(t => <option key={`top-${t.key}`} value={t.key}>{t.label}</option>)}
                            </optgroup>
                          )}
                          <optgroup label="Wszystkie (A–Z)">
                            {tracks.map(t => <option key={`all-${t.key}`} value={t.key}>{t.label}</option>)}
                          </optgroup>
                        </select>
                      )}
                    </Field>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted-light)' }}>
                      warianty (np. negatywne podciąganie) liczone osobno od wykonania podstawowego
                    </div>
                    <Field label="Oś Y — co pokazać">
                      <div className="coach-chip-tabs">
                        {METRICS.map(m => (
                          <div key={m.id} className={`coach-chip ${metric === m.id ? 'coach-active' : ''}`} onClick={() => setMetric(m.id)} title={m.desc}>
                            {m.label}
                          </div>
                        ))}
                      </div>
                    </Field>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted-light)' }}>
                      oś X = kolejne daty treningów · {metricMeta.desc}
                    </div>
                  </div>
                </Card>

                {/* Wykres */}
                <Card
                  title={effTrack?.label || '—'}
                  headerAction={<span className="coach-sub">{metricMeta.label} · {chart.dates.length} {chart.dates.length === 1 ? 'trening' : 'treningi/-ów'}</span>}
                >
                  <div id="group-stats-chart" style={{ overflowX: 'auto', padding: '0 12px 16px' }}>
                    <LineChart dates={chart.dates} series={visibleSeries} unit={metricMeta.unit} yLabel={metricMeta.label} />
                  </div>
                </Card>

                {/* Legenda — klik włącza/wyłącza zawodniczkę */}
                <Card title="Zawodniczki" sub="kliknij, by ukryć/pokazać">
                  <div style={{ padding: '0 18px 18px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {chart.series.map(s => {
                      const off = hidden.has(s.id)
                      const hasData = s.points.some(v => v != null)
                      return (
                        <button key={s.id} onClick={() => toggleAthlete(s.id)} disabled={!hasData}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.32rem 0.6rem', borderRadius: 999,
                            border: `1.5px solid ${off || !hasData ? 'var(--border)' : s.color}`,
                            background: off || !hasData ? 'var(--bg)' : '#fff',
                            color: !hasData ? 'var(--muted-light)' : off ? 'var(--muted)' : 'var(--ink)',
                            fontWeight: 700, fontSize: '0.74rem', opacity: hasData ? 1 : 0.6,
                          }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: hasData && !off ? s.color : 'var(--border)' }} />
                          {s.name}{!hasData ? ' (brak)' : ''}
                        </button>
                      )
                    })}
                  </div>
                </Card>

                {/* Szczegółowa tabela: serie × powt. · ciężar · tempo */}
                <div className="coach-section-label" style={{ padding: '0 0 2px' }}>
                  Szczegóły — {effTrack?.label || ''}
                </div>
                {detailTable.length === 0 || chart.dates.length === 0 ? (
                  <Card><div className="coach-empty-list">Brak wpisanych wyników dla tej ścieżki.</div></Card>
                ) : (
                  <div className="coach-attendance-grid-wrap" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table className="coach-attendance-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Zawodniczka</th>
                          {chart.dates.map((d, i) => (
                            <th key={i}>{d.slice(5)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailTable.map(({ athlete, cells }) => (
                          <tr key={athlete.id}>
                            <td className="coach-att-name">{athlete.full_name}</td>
                            {cells.map((c, i) => (
                              <td key={i} style={{ color: c === '—' ? 'var(--muted-light)' : 'var(--ink)', whiteSpace: 'nowrap' }}>
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ fontSize: '0.68rem', color: 'var(--muted-light)' }}>
                  serie × powt. · ciężar · tempo  —  np. „3×8 · 5/7.5 kg · 3010" = 3 serie po 8 powt., ciężar 5 i 7.5 kg, tempo 3010
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
