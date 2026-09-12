'use client'
// src/app/coach/groups/[id]/summary/GroupSummaryClient.tsx
// Podsumowanie treningu grupy zorganizowanej — wybór po dacie, domyślnie ostatni
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatDatePl, dayRangeIso } from '@/lib/groupTraining'
import { StimulusBadge, StimulusSection } from './StimulusAnalysis'
import { variantHasPrescription, analyzeWorkout, CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_SHORT, fmtSeconds, pct } from '@/lib/stimulus'
import type { ExerciseInput, TaskVariant } from '@/lib/stimulus'
import { loadPdf, pl, drawHeaderBar, drawFooter, TABLE_STYLES } from '@/lib/groupPdf'
import { coerceVariant, cleanVariantName, type CleanVariant } from '@/lib/variants'
import { Card, Button, StatusPill } from '@/components/coach/ui'

// Semantyczne kolory spójne z resztą panelu trenera (StatusPill / coach-theme.css)
const SEM = {
  red: '#c23b3b', redBg: '#fdecec',
  amber: '#c07f1e', amberBg: '#fdf1de',
  green: '#1f9d64', greenBg: '#e3f8ee',
}
const INTER = 'var(--font-inter),sans-serif'

type Group = { id: number; name: string }
type Athlete = { id: number; full_name: string }
type Training = { id: number; group_id: number; training_date: string; absent_athlete_ids?: number[] | null }
type SetRow = { reps?: string; tempo?: string; weight?: string; skipped?: boolean }
type Exercise = { id: number; name: string; exercise_order: number; sets_planned?: number | null; reps?: string | null; tempo?: string | null; bodyweight?: boolean | null; variants?: TaskVariant[] | null; individual?: boolean | null }
type Entry = {
  exercise_id: number
  athlete_id: number
  sets: SetRow[]
  pain?: boolean | null
  pain_vas?: number | null
  pain_comment?: string | null
  comment?: string | null
  exercise_override?: string | null
  bodyweight?: boolean | null
  variant?: string | null
}
type WellnessRow = {
  athlete_id: number
  sleep_hours?: number | null
  sleep_quality?: number | null
  energy?: number | null
  stress?: number | null
  muscle_sorness?: number | null
  readiness?: number | null
  body_weight_kg?: number | null
  concerns?: string | null
  created_at: string
}
type FeedbackRow = {
  athlete_id: number
  session_rpe?: number | null
  feeling_after?: string | null
  what_went_well?: string | null
  pain_after_comment?: string | null
  general_notes?: string | null
  created_at: string
}

interface Props {
  group: Group
  athletes: Athlete[]
  trainings: Training[]
  bodyWeights: Record<number, number>
}

const FEELING_LABELS: Record<string, string> = {
  swietnie: '💪 Świetnie', dobrze: '😊 Dobrze', srednie: '😐 Średnio',
  zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
}

const entryKey = (exerciseId: number, athleteId: number) => `${exerciseId}_${athleteId}`

// Czytelne podsumowanie serii w jednej komórce:
// – ciężar 0 / pusty traktujemy jak masę ciała (bez „× 0 kg”),
// – serie identyczne zwijamy w jedną linię (np. „3 ser. · 5 × 10 kg”),
// – tempo wspólne dla wszystkich serii pokazujemy raz, nie przy każdej.
function SetsSummary({ sets, ex, modified }: { sets: SetRow[]; ex: Exercise; modified: boolean }) {
  const prescTempo = (ex.tempo || '').trim()
  // Jednolity zapis per seria (S1, S2…). Bez modyfikacji powt./tempo bierzemy z aktualnej
  // rozpiski grupy (ignorujemy stare wartości zapisane przy serii). Tempo per-seria pokazujemy
  // tylko przy modyfikacji i gdy różni się od rozpiski — standardowe widać w nagłówku kolumny.
  const ss = (sets || [])
    .map(s => ({
      reps: modified ? ((s.reps || '').trim() || (ex.reps || '').trim()) : (ex.reps || '').trim(),
      tempo: modified ? (s.tempo || '').trim() : '',
      weight: (s.weight || '').trim(),
      skipped: !!s.skipped,
    }))
    .filter(s => s.reps || s.tempo || s.weight || s.skipped)
  if (ss.length === 0) return <span style={{ fontFamily: INTER, fontSize: '0.72rem', color: 'var(--muted-light)' }}>—</span>

  // Ciężar: 0 = masa ciała (BW), puste = nic, reszta z „kg”
  const fmtWeight = (w: string) => (w === '0' ? 'BW' : /[a-zA-Z%]/.test(w) ? w : `${w} kg`)

  return (
    <div>
      {ss.map((s, i) => {
        const tempoMod = !!s.tempo && s.tempo !== prescTempo
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 7, lineHeight: 1.5 }}>
            <span style={{ fontFamily: INTER, fontSize: '0.62rem', color: s.skipped ? SEM.red : 'var(--muted-light)', minWidth: 24, flexShrink: 0 }}>S{i + 1}</span>
            {s.skipped ? (
              <span style={{ fontFamily: INTER, fontSize: '0.72rem', color: SEM.red, textDecoration: 'line-through' }}>nie zrob.</span>
            ) : (
              <span style={{ fontFamily: INTER, fontSize: '0.78rem', color: 'var(--ink)' }}>
                {s.reps || '—'}
                {s.weight !== '' ? <> × <strong style={{ fontWeight: 700 }}>{fmtWeight(s.weight)}</strong></> : null}
                {tempoMod ? <span style={{ color: 'var(--muted)' }}> · {s.tempo}</span> : null}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Suma liczb w tekście serii: „1+1” → 2, „5” → 5
function sumNumbers(s?: string | null) {
  const m = (s || '').match(/\d+(?:[.,]\d+)?/g)
  return m ? m.reduce((a, x) => a + parseFloat(x.replace(',', '.')), 0) : 0
}

// Czas tempa w sekundach na powtórzenie: „3010” → 4, „5010” → 6,
// dla zapisu opisowego („5'' ecc”) sumujemy znalezione liczby → 5
function tempoSeconds(tempo?: string | null) {
  const t = (tempo || '').trim()
  if (!t) return 0
  if (/^\d{3,4}$/.test(t)) return t.split('').reduce((a, d) => a + parseInt(d, 10), 0)
  const m = t.match(/\d+/g)
  return m ? m.reduce((a, x) => a + parseInt(x, 10), 0) : 0
}

const isMaxRepsS = (r?: string | null) => /(amrap|maks|max|upad)/i.test(String(r ?? ''))

// Ćwiczenie „rządzi się innym prawem” — powtórzenia są indywidualne (masa własna kolumny/zawodniczki,
// zamiana na inne ćwiczenie, na maksa). Decyduje o tym, czy używamy powt. per-seria zamiast rozpiski.
function isModifiedEntry(entry: Entry | undefined, ex: Exercise) {
  return !!entry?.exercise_override || !!entry?.bodyweight || !!ex.bodyweight || isMaxRepsS(ex.reps)
}
// Ćwiczenie na powtórzenia (brak ciężaru zewn.) — czerwony liczy najmniej powtórzeń
const isRepsExercise = (ex: Exercise) => isMaxRepsS(ex.reps) || !!ex.bodyweight

// Rozpiska obowiązująca daną zawodniczkę: jeśli wybrała wariant, jego pola
// (serie/powt./tempo/masa własna) nadpisują nagłówek grupy — per pole, z fallbackiem.
// Dzięki temu metryki i kolory w podsumowaniu są liczone dla TEGO, co naprawdę robiła.
// Wariant wybrany przez zawodniczkę (czysty — odporny na uszkodzony zapis JSON).
function variantOf(ex: Exercise, entry: Entry | undefined): CleanVariant | undefined {
  const name = cleanVariantName(entry?.variant)
  if (!name) return undefined
  for (const raw of ex.variants || []) { const cv = coerceVariant(raw); if (cv && cv.name === name) return cv }
  return undefined
}
function effectiveEx(ex: Exercise, entry: Entry | undefined): Exercise {
  const v = variantOf(ex, entry)
  if (!v) return ex
  return {
    ...ex,
    sets_planned: v.sets != null ? v.sets : ex.sets_planned,
    reps: v.reps.trim() ? v.reps : ex.reps,
    tempo: v.tempo.trim() ? v.tempo : ex.tempo,
    bodyweight: v.bodyweight ? true : ex.bodyweight,
  }
}

// Serie, powtórzenia, TUT (Σ powt.×czas tempa) i ciężar zewn. (Σ powt.×ciężar) dla ćwiczenia.
// Bez modyfikacji powt./tempo bierzemy z AKTUALNEJ rozpiski grupy (ignorujemy stare wartości
// zapisane przy serii — np. tempo zmienione później w nagłówku). Przy modyfikacji — indywidualne.
function exerciseMetrics(sets: SetRow[] | undefined, ex: Exercise, modified: boolean) {
  let loadVol = 0, totalReps = 0, tut = 0, setCount = 0, skipped = 0, repsBelow = false
  const prescReps = sumNumbers(ex.reps)
  const prescTempoSec = tempoSeconds(ex.tempo)
  for (const s of sets || []) {
    if (s.skipped) { skipped++; continue }
    const repsStr = (s.reps || '').trim()
    const reps = modified ? (sumNumbers(repsStr) || prescReps) : prescReps
    const tsec = modified ? tempoSeconds((s.tempo || '').trim() || ex.tempo) : prescTempoSec
    const weight = parseFloat((s.weight || '').replace(',', '.')) || 0
    if (repsStr || (s.weight || '').trim()) setCount++
    totalReps += reps
    loadVol += reps * weight
    tut += reps * tsec
    if (modified && prescReps > 0 && repsStr && sumNumbers(repsStr) < prescReps) repsBelow = true
  }
  return { loadVol, totalReps, tut, setCount, skipped, repsBelow }
}

type Metrics = ReturnType<typeof exerciseMetrics>

// Pomarańczowo: niewykonana seria / mniej powtórzeń — ale NIE dla ćwiczeń zmodyfikowanych
function isUnderdone(entry: Entry | undefined, ex: Exercise, m: Metrics) {
  if (isModifiedEntry(entry, ex)) return false
  if (m.setCount === 0 && m.skipped === 0) return false // brak danych — nie flagujemy
  const planned = ex.sets_planned ?? 0
  if (m.skipped > 0) return true
  if (planned > 0 && m.setCount < planned) return true
  return m.repsBelow
}

function fmtTut(sec: number) {
  if (sec <= 0) return '—'
  return `${Math.round(sec)} s`
}

// Komórka „External Load”: serie / powtórzenia / TUT / ciężar zewn. + kolor (czerwony/pomarańczowy)
function ExternalLoadCell({ entry, ex, red, green, orange }: { entry: Entry | undefined; ex: Exercise; red: boolean; green?: boolean; orange: boolean }) {
  const sets = entry?.sets
  const exV = effectiveEx(ex, entry)   // rozpiska wg wybranego wariantu (jeśli jest)
  const hasAny = (sets || []).some(s => s.skipped || s.reps || s.weight) || (!!exV.reps && (sets?.length ?? 0) > 0)
  if (!hasAny) return <span style={{ fontFamily: INTER, fontSize: '0.72rem', color: 'var(--muted-light)' }}>—</span>
  const modified = isModifiedEntry(entry, exV)
  const m = exerciseMetrics(sets, exV, modified)
  // Przy modyfikacji liczba serii jest indywidualna — mianownik z jej własnych serii, nie z planu grupy
  const planned = modified ? (m.setCount + m.skipped) : (exV.sets_planned ?? 0)
  const accent = red ? SEM.red : green ? SEM.green : orange ? SEM.amber : 'var(--muted)'
  const variant = cleanVariantName(entry?.variant)
  // Modyfikacja TEJ zawodniczki (zamiana / masa własna) — „na maksa” to cecha kolumny, nie modyfikacja.
  // Masę własną pomijamy w etykiecie, gdy bierze się z wariantu (pokażemy ją przy wariancie).
  const modLabel = entry?.exercise_override ? entry.exercise_override : entry?.bodyweight ? 'masa własna' : ''
  const Row = (label: string, val: string, dim?: boolean) => (
    <div><span style={{ color: 'var(--muted)' }}>{label}</span> <strong style={{ fontWeight: 700, color: dim ? 'var(--muted-light)' : 'var(--ink)' }}>{val}</strong></div>
  )
  return (
    <div style={{ fontFamily: INTER, fontSize: '0.72rem', color: 'var(--ink)', lineHeight: 1.5 }}>
      {variant && (
        <div title={`Wariant: ${variant}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', fontFamily: INTER, fontSize: '0.62rem', fontWeight: 700, color: '#fff', background: 'var(--navy-900)', borderRadius: 999, padding: '2px 8px 2px 3px', marginBottom: 3 }}>
          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy-900)', fontSize: '0.62rem', fontWeight: 700, lineHeight: 1 }}>⋔</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{variant}</span>
        </div>
      )}
      {modLabel && (
        <div title={`Modyfikacja: ${modLabel}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, color: SEM.amber, background: SEM.amberBg, borderRadius: 999, padding: '1px 7px 1px 2px', marginBottom: 3 }}>
          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy-900)', fontSize: '0.56rem', fontWeight: 700, lineHeight: 1 }}>⇄</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modLabel}</span>
        </div>
      )}
      {(red || green || orange) && (
        <div style={{ fontSize: '0.56rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
          {red ? (isRepsExercise(exV) ? '● najmniej powt.' : '● najniższy load') : green ? '● najwięcej powt.' : '● niepełne'}
        </div>
      )}
      {Row('serie', `${m.setCount}${planned ? `/${planned}` : ''}${m.skipped ? ` (−${m.skipped})` : ''}`)}
      {Row('powt.', `${m.totalReps}`)}
      {Row('TUT', fmtTut(m.tut), m.tut <= 0)}
      {Row('zew.', m.loadVol > 0 ? `${Math.round(m.loadVol * 10) / 10} kg` : '—', m.loadVol <= 0)}
    </div>
  )
}

// Kolumny siatki gotowości (nazwa + 5 metryk + uwagi)
const WELLNESS_COLS = 'minmax(130px, 1.2fr) repeat(5, minmax(60px, 0.8fr)) minmax(150px, 1.8fr)'

// Kolor wartości wg progów — od razu widać słabe wyniki.
// 'good-high': im więcej tym lepiej (gotowość, energia)
// 'good-low':  im mniej tym lepiej (stres, zakwasy)
function scoreTone(v: number, kind: 'good-high' | 'good-low' | 'sleep'): 'green' | 'amber' | 'red' {
  if (kind === 'sleep') return v >= 7.5 ? 'green' : v >= 6 ? 'amber' : 'red'
  if (kind === 'good-high') return v >= 7 ? 'green' : v >= 4 ? 'amber' : 'red'
  return v <= 3 ? 'green' : v <= 6 ? 'amber' : 'red'
}

function Score({ value, kind }: { value?: number | null; kind: 'good-high' | 'good-low' | 'sleep' }) {
  if (value == null) return <span style={{ justifySelf: 'center', fontFamily: INTER, fontSize: '0.72rem', color: 'var(--muted-light)' }}>–</span>
  return (
    <span style={{ justifySelf: 'center' }}>
      <StatusPill label={`${value}${kind === 'sleep' ? 'h' : '/10'}`} tone={scoreTone(value, kind)} />
    </span>
  )
}

export default function GroupSummaryClient({ group, athletes, trainings, bodyWeights }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedId, setSelectedId] = useState<number | null>(trainings[0]?.id ?? null)
  const [loading, setLoading] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [entryMap, setEntryMap] = useState<Map<string, Entry>>(new Map())
  const [wellnessByAthlete, setWellnessByAthlete] = useState<Map<number, WellnessRow>>(new Map())
  const [feedbackByAthlete, setFeedbackByAthlete] = useState<Map<number, FeedbackRow>>(new Map())

  const selected = trainings.find(t => t.id === selectedId) || null
  const absentIds = useMemo(() => new Set<number>((selected?.absent_athlete_ids || []).map(Number)), [selected])

  // Masa ciała: najpierw z gotowości wybranego treningu, w razie braku — najnowsza znana
  const weightOf = (athleteId: number) =>
    wellnessByAthlete.get(athleteId)?.body_weight_kg ?? bodyWeights[athleteId] ?? null

  // Dane wejściowe analizy bodźca: nagłówek grupy + dane indywidualne zawodniczek.
  // Dla każdej zawodniczki ustalamy rozpiskę: wariant z własną rozpiską > nagłówek,
  // a wpisane przez nią powt./tempo nadpisują domyślne. To pozwala liczyć bodziec,
  // gdy zawodniczki wykonują różne warianty tego samego zadania.
  const toStimulusInput = (ex: Exercise): ExerciseInput => {
    // warianty z czystymi nazwami (odporne na uszkodzony zapis JSON)
    const variants: TaskVariant[] = (ex.variants ?? [])
      .map(v => coerceVariant(v))
      .filter((v): v is CleanVariant => v != null)
    return {
      name: ex.name,
      sets: ex.sets_planned, reps: ex.reps, tempo: ex.tempo, bodyweight: ex.bodyweight,
      individual: ex.individual, variants,
      athletes: athletes
        .filter(a => !absentIds.has(a.id))
        .map(a => {
          const e = entryMap.get(entryKey(ex.id, a.id))
          const vName = cleanVariantName(e?.variant)
          const v = vName ? variants.find(x => x.name === vName) : undefined
          const presc = v && variantHasPrescription(v)
            ? { sets: v.sets ?? null, reps: v.reps ?? null, tempo: v.tempo ?? null }
            : { sets: ex.sets_planned ?? null, reps: ex.reps ?? null, tempo: ex.tempo ?? null }
          const raw = e?.sets || []
          const n = Math.max(raw.length, presc.sets ?? 0, 1)
          const sets = Array.from({ length: n }, (_, i) => ({
            reps: (raw[i]?.reps || '').trim() || presc.reps,
            tempo: (raw[i]?.tempo || '').trim() || presc.tempo,
          }))
          return { athleteId: a.id, name: a.full_name, variant: vName || null, sets }
        }),
    }
  }

  // Czerwono: zawodniczka z NAJNIŻSZYM relative load (ciężar zewn. / masa ciała) w danym ćwiczeniu.
  // Liczymy tylko ćwiczenia z obciążeniem zewn., pomijamy zmodyfikowane i bez masy ciała.
  const redByExercise = useMemo(() => {
    const map = new Map<number, number>()
    for (const ex of exercises) {
      let best: { id: number; val: number } | null = null
      let count = 0
      if (isRepsExercise(ex)) {
        // „na maksa” / masa własna kolumny → najmniej powtórzeń (bez ćwiczeń zamienionych na inne)
        for (const a of athletes) {
          const entry = entryMap.get(entryKey(ex.id, a.id))
          if (entry?.exercise_override) continue
          const m = exerciseMetrics(entry?.sets, effectiveEx(ex, entry), true)
          if (m.totalReps <= 0) continue
          count++
          if (!best || m.totalReps < best.val) best = { id: a.id, val: m.totalReps }
        }
      } else {
        // ćwiczenie z obciążeniem → najniższy relative load (ciężar zewn. / masa ciała)
        for (const a of athletes) {
          const bw = weightOf(a.id)
          if (!bw || bw <= 0) continue
          const entry = entryMap.get(entryKey(ex.id, a.id))
          const exV = effectiveEx(ex, entry)
          if (isModifiedEntry(entry, exV)) continue
          const m = exerciseMetrics(entry?.sets, exV, false)
          if (m.loadVol <= 0) continue
          count++
          const rel = m.loadVol / bw
          if (!best || rel < best.val) best = { id: a.id, val: rel }
        }
      }
      if (best && count >= 2) map.set(ex.id, best.id)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, athletes, entryMap, wellnessByAthlete, bodyWeights])

  // Zielono: w ćwiczeniu na powtórzenia (AMRAP / masa własna) zawodniczka,
  // która zrobiła NAJWIĘCEJ powtórzeń — odwrotność czerwonego „najmniej powt.”.
  const greenByExercise = useMemo(() => {
    const map = new Map<number, number>()
    for (const ex of exercises) {
      if (!isRepsExercise(ex)) continue
      let best: { id: number; val: number } | null = null
      let count = 0
      for (const a of athletes) {
        const entry = entryMap.get(entryKey(ex.id, a.id))
        if (entry?.exercise_override) continue
        const m = exerciseMetrics(entry?.sets, effectiveEx(ex, entry), true)
        if (m.totalReps <= 0) continue
        count++
        if (!best || m.totalReps > best.val) best = { id: a.id, val: m.totalReps }
      }
      if (best && count >= 2) map.set(ex.id, best.id)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, athletes, entryMap])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const athleteIds = athletes.map(a => a.id)
      const { startIso, endIso } = dayRangeIso(selected!.training_date)

      const [{ data: ex }, { data: ent }, wellnessLinked, wellnessSameDay, feedbackLinked, feedbackSameDay] = await Promise.all([
        supabase.from('group_training_exercises').select('*').eq('training_id', selected!.id).order('exercise_order'),
        supabase.from('group_training_entries').select('*').eq('training_id', selected!.id),
        supabase.from('wellness_logs').select('*').eq('group_training_id', selected!.id),
        athleteIds.length
          ? supabase.from('wellness_logs').select('*').in('athlete_id', athleteIds).gte('created_at', startIso).lt('created_at', endIso)
          : Promise.resolve({ data: [] }),
        supabase.from('post_session_feedback').select('*').eq('group_training_id', selected!.id),
        athleteIds.length
          ? supabase.from('post_session_feedback').select('*').in('athlete_id', athleteIds).gte('created_at', startIso).lt('created_at', endIso)
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return

      const wMap = new Map<number, WellnessRow>()
      for (const w of [...(wellnessSameDay.data || []), ...(wellnessLinked.data || [])] as WellnessRow[]) {
        wMap.set(w.athlete_id, w)
      }
      const fMap = new Map<number, FeedbackRow>()
      for (const f of [...(feedbackSameDay.data || []), ...(feedbackLinked.data || [])] as FeedbackRow[]) {
        fMap.set(f.athlete_id, f)
      }

      setExercises((ex || []) as Exercise[])
      setEntryMap(new Map(((ent || []) as Entry[]).map(e => [entryKey(e.exercise_id, e.athlete_id), e])))
      setWellnessByAthlete(wMap)
      setFeedbackByAthlete(fMap)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ── Eksport PDF: tabela ciężarów/serii dla wybranego treningu ────────────────
  const [exportingPdf, setExportingPdf] = useState(false)

  function summaryCellText(athleteId: number, ex: Exercise): string {
    const entry = entryMap.get(entryKey(ex.id, athleteId))
    const exV = effectiveEx(ex, entry)
    const sets = entry?.sets
    const hasAny = (sets || []).some(s => s.skipped || s.reps || s.weight) || (!!exV.reps && (sets?.length ?? 0) > 0)
    if (!hasAny) return '-'
    const modified = isModifiedEntry(entry, exV)
    const m = exerciseMetrics(sets, exV, modified)
    const planned = modified ? (m.setCount + m.skipped) : (exV.sets_planned ?? 0)
    const lines: string[] = []
    if (entry?.variant) lines.push(`> ${cleanVariantName(entry.variant)}`)
    else if (entry?.exercise_override) lines.push(`> ${entry.exercise_override}`)
    else if (entry?.bodyweight) lines.push('> masa wlasna')
    lines.push(`serie ${m.setCount}${planned ? `/${planned}` : ''}${m.skipped ? ` (-${m.skipped})` : ''}`)
    lines.push(`powt ${m.totalReps}`)
    if (m.tut > 0) lines.push(`TUT ${Math.round(m.tut)}s`)
    if (m.loadVol > 0) lines.push(`zew ${Math.round(m.loadVol * 10) / 10}kg`)
    return pl(lines.join('\n'))
  }

  async function exportSummaryPdf() {
    if (exportingPdf || !selected || exercises.length === 0) return
    setExportingPdf(true)
    try {
      const { jsPDF, autoTable } = await loadPdf()
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      // obecne na górze, nieobecne na końcu — jak w aplikacji
      const ordered = [...athletes].sort((a, b) => Number(absentIds.has(a.id)) - Number(absentIds.has(b.id)))
      const head = [['Zawodniczka', ...exercises.map(ex => {
        const presc = [ex.sets_planned ?? '', ex.reps ?? '', ex.tempo ?? ''].filter(x => String(x).trim()).join(' x ')
        return pl(`${ex.name}${presc ? `\n${presc}` : ''}`)
      })]]
      const body = ordered.map(a => [
        pl(a.full_name + (absentIds.has(a.id) ? ' (nieob.)' : '')),
        ...exercises.map(ex => absentIds.has(a.id) ? '-' : summaryCellText(a.id, ex)),
      ])
      drawHeaderBar(doc, group.name, 'Podsumowanie treningu', `${formatDatePl(selected.training_date)} · ${selected.training_date}`)
      // ── Profil treningu (analiza bodźca) ──
      let y = 26
      const w = analyzeWorkout(exercises.map(toStimulusInput))
      if (w.dominant) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(13, 27, 42)
        doc.text(pl(`Profil treningu: ${CATEGORY_LABEL[w.dominant]}`), 14, y); y += 5
        const breakdown = CATEGORY_ORDER.filter(c => w.profile[c] > 0.005).map(c => `${CATEGORY_SHORT[c]} ${pct(w.profile[c])}%`).join('  ·  ')
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 90, 110)
        doc.text(pl(breakdown), 14, y); y += 4.5
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 90, 110)
      doc.text(pl(`TUT treningu ${fmtSeconds(w.totalTut)}   ·   powt. razem ${w.totalReps || '-'}   ·   cwiczen sklasyfikowanych ${w.classified}/${w.exercises.length}`), 14, y); y += 5
      doc.setTextColor(0, 0, 0)
      // ── Tabela ciężarów/serii ──
      autoTable(doc, {
        startY: y,
        head, body,
        ...TABLE_STYLES,
        styles: { ...TABLE_STYLES.styles, fontSize: 7, valign: 'top' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 34 } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index > 0) {
            const ex = exercises[data.column.index - 1]
            const aId = ordered[data.row.index]?.id
            if (redByExercise.get(ex.id) === aId) { data.cell.styles.fillColor = [253, 237, 237]; data.cell.styles.textColor = [200, 30, 30] }
            else if (greenByExercise.get(ex.id) === aId) { data.cell.styles.fillColor = [233, 247, 239]; data.cell.styles.textColor = [21, 128, 61] }
          }
        },
        didDrawPage: () => drawFooter(doc),
      })
      doc.save(`podsumowanie_${selected.training_date}.pdf`)
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <>
        <div className="coach-plan-toolbar">
          {trainings.length > 0 && (
            <select
              className="coach-sort-select"
              value={selectedId ?? ''}
              onChange={e => setSelectedId(parseInt(e.target.value))}
            >
              {trainings.map(t => (
                <option key={t.id} value={t.id}>{t.training_date}</option>
              ))}
            </select>
          )}
          {selected && (
            <span style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: INTER }}>{formatDatePl(selected.training_date)}</span>
          )}
          {selected && exercises.length > 0 && (
            <Button variant="dark" onClick={exportSummaryPdf} disabled={exportingPdf} style={{ marginLeft: 'auto' }}>
              {exportingPdf ? 'Generuję...' : '⬇ PDF'}
            </Button>
          )}
        </div>

        {trainings.length === 0 ? (
          <Card>
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)' }}>
              Jeszcze nie było żadnego treningu.
            </div>
          </Card>
        ) : loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem', fontFamily: INTER, fontSize: '0.8rem' }}>
            Wczytuję dane treningu...
          </div>
        ) : (
          <>
            {/* ── TABELA: ZAWODNICZKI × ĆWICZENIA ── */}
            <div className="coach-section-label">Ćwiczenia i ciężary</div>
            {exercises.length === 0 ? (
              <Card>
                <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--muted)' }}>
                  Ten trening nie ma jeszcze wpisanych ćwiczeń.
                </div>
              </Card>
            ) : (
              <Card style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="coach-track-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 170 }}>Zawodniczka</th>
                        {exercises.map(ex => (
                          <th key={ex.id} style={{ minWidth: 160 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0 }}>{ex.name}</div>
                            {(ex.sets_planned || ex.reps || ex.tempo) && (
                              <div style={{ fontFamily: INTER, fontSize: '0.62rem', fontWeight: 400, color: 'var(--muted)', marginTop: 3, textTransform: 'none' }}>
                                {[
                                  ex.sets_planned && ex.reps ? `${ex.sets_planned} × ${ex.reps}`
                                    : ex.sets_planned ? `${ex.sets_planned} ser.`
                                    : ex.reps ? `${ex.reps} powt.` : '',
                                  ex.tempo || '',
                                ].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            <StimulusBadge ex={toStimulusInput(ex)} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {athletes.map(athlete => {
                        const absent = absentIds.has(athlete.id)
                        return (
                        <tr key={athlete.id}>
                          <td className="coach-track-name" style={{ color: absent ? 'var(--muted)' : 'var(--ink)', textDecoration: absent ? 'line-through' : 'none' }}>
                            {athlete.full_name}
                          </td>
                          {absent ? (
                            <td colSpan={exercises.length} style={{ fontFamily: INTER, fontSize: '0.7rem', color: 'var(--muted)', fontStyle: 'italic' }}>nieobecna</td>
                          ) : exercises.map(ex => {
                            const entry = entryMap.get(entryKey(ex.id, athlete.id))
                            const hasContent = entry && (entry.sets?.length || entry.pain || entry.pain_vas != null || entry.pain_comment || entry.comment || entry.exercise_override)
                            return (
                              <td key={ex.id}>
                                {hasContent ? (
                                  <>
                                    {entry!.exercise_override && (
                                      <div title={`Zamiana ćwiczenia: ${entry!.exercise_override}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', fontFamily: INTER, fontSize: '0.64rem', fontWeight: 700, color: SEM.amber, background: SEM.amberBg, borderRadius: 999, padding: '2px 9px 2px 2px', marginBottom: 5 }}>
                                        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy-900)', fontSize: '0.62rem', fontWeight: 700, lineHeight: 1 }}>⇄</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry!.exercise_override}</span>
                                      </div>
                                    )}
                                    <SetsSummary sets={entry!.sets || []} ex={ex} modified={isModifiedEntry(entry, ex)} />
                                    {(entry!.pain || entry!.pain_vas != null || entry!.pain_comment) && (
                                      <div style={{ marginTop: 5 }}>
                                        <span style={{ fontFamily: INTER, fontSize: '0.62rem', fontWeight: 700, color: '#fff', background: (entry!.pain_vas != null && entry!.pain_vas! >= 5) ? SEM.red : SEM.amber, borderRadius: 6, padding: '1px 6px' }}>
                                          ból{entry!.pain_vas != null ? ` VAS ${entry!.pain_vas}` : ''}
                                        </span>
                                        {entry!.pain_comment && (
                                          <div style={{ fontSize: '0.72rem', color: SEM.red, marginTop: 2 }}>{entry!.pain_comment}</div>
                                        )}
                                      </div>
                                    )}
                                    {entry!.comment && (
                                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 5, fontStyle: 'italic' }}>💬 {entry!.comment}</div>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ fontFamily: INTER, fontSize: '0.72rem', color: 'var(--muted-light)' }}>—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ── ANALIZA BODŹCA TRENINGOWEGO ── */}
            {exercises.length > 0 && (
              <>
                <div className="coach-section-label">Analiza bodźca treningowego</div>
                <StimulusSection exercises={exercises.map(toStimulusInput)} />
                <div style={{ fontFamily: INTER, fontSize: '0.66rem', color: 'var(--muted)', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
                  Na podstawie liczby powtórzeń, tempa i TUT system szacuje, jaki bodziec został zaprogramowany przez trenera. To analiza konstrukcji programu, nie pomiar rzeczywistej odpowiedzi organizmu.
                </div>
              </>
            )}

            {/* ── EXTERNAL LOAD ── */}
            {exercises.length > 0 && (
              <>
                <div className="coach-section-label">External Load</div>
                <Card style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="coach-track-table" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ width: 170 }}>Zawodniczka</th>
                          {exercises.map(ex => (
                            <th key={ex.id} style={{ minWidth: 150 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0 }}>{ex.name}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map(athlete => {
                          const absent = absentIds.has(athlete.id)
                          return (
                          <tr key={athlete.id}>
                            <td className="coach-track-name" style={{ color: absent ? 'var(--muted)' : 'var(--ink)', textDecoration: absent ? 'line-through' : 'none' }}>
                              {athlete.full_name}
                            </td>
                            {absent ? (
                              <td colSpan={exercises.length} style={{ fontFamily: INTER, fontSize: '0.7rem', color: 'var(--muted)', fontStyle: 'italic' }}>nieobecna</td>
                            ) : exercises.map(ex => {
                              const entry = entryMap.get(entryKey(ex.id, athlete.id))
                              const exV = effectiveEx(ex, entry)
                              const m = exerciseMetrics(entry?.sets, exV, isModifiedEntry(entry, exV))
                              const red = redByExercise.get(ex.id) === athlete.id
                              const green = !red && greenByExercise.get(ex.id) === athlete.id
                              const orange = !red && !green && isUnderdone(entry, exV, m)
                              return (
                                <td key={ex.id} style={{ background: red ? SEM.redBg : green ? SEM.greenBg : orange ? SEM.amberBg : undefined }}>
                                  <ExternalLoadCell entry={entry} ex={ex} red={red} green={green} orange={orange} />
                                </td>
                              )
                            })}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <div style={{ fontFamily: INTER, fontSize: '0.62rem', color: 'var(--muted)', margin: '10px 0 0.4rem', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: SEM.red, verticalAlign: 'middle' }} /> najniższy relative load (ciężar zewn./masa ciała); przy „na maksa” — najmniej powtórzeń</span>
                  <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: SEM.green, verticalAlign: 'middle' }} /> ćwiczenie na powtórzenia (AMRAP / masa własna) — najwięcej powtórzeń</span>
                  <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: SEM.amber, verticalAlign: 'middle' }} /> niepełne (seria/powt.) — bez ćwiczeń zmodyfikowanych</span>
                </div>
                <div style={{ fontFamily: INTER, fontSize: '0.62rem', color: 'var(--muted)', margin: '0 0 0.5rem' }}>
                  zew. = Σ powtórzeń × ciężar · TUT = Σ powtórzeń × czas tempa (w sekundach) · ⇄ = modyfikacja
                </div>
              </>
            )}

            {/* ── GOTOWOŚĆ ── */}
            <div className="coach-section-label">Gotowość treningowa</div>
            <Card style={{ padding: 0, overflow: 'auto' }}>
              <div style={{ minWidth: 720 }}>
                {/* Nagłówek kolumn — pozwala porównywać metryki w pionie */}
                <div style={{ display: 'grid', gridTemplateColumns: WELLNESS_COLS, gap: 8, alignItems: 'center', padding: '0.7rem 1rem', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontFamily: INTER, fontSize: '0.62rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  <span>Zawodniczka</span>
                  <span style={{ justifySelf: 'center' }}>😴 Sen</span>
                  <span style={{ justifySelf: 'center' }}>✅ Gotow.</span>
                  <span style={{ justifySelf: 'center' }}>⚡ Energia</span>
                  <span style={{ justifySelf: 'center' }}>😬 Stres</span>
                  <span style={{ justifySelf: 'center' }}>💪 Zakwasy</span>
                  <span>💬 Uwagi</span>
                </div>
                {athletes.map((a, i) => {
                  const w = wellnessByAthlete.get(a.id)
                  return (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: WELLNESS_COLS, gap: 8, alignItems: 'center', padding: '0.6rem 1rem', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--ink)' }}>{a.full_name}</span>
                      {w ? (
                        <>
                          <Score value={w.sleep_hours} kind="sleep" />
                          <Score value={w.readiness} kind="good-high" />
                          <Score value={w.energy} kind="good-high" />
                          <Score value={w.stress} kind="good-low" />
                          <Score value={w.muscle_sorness} kind="good-low" />
                          <span style={{ fontFamily: INTER, fontSize: '0.76rem', color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                            {w.concerns ? `„${w.concerns}”` : ''}
                          </span>
                        </>
                      ) : (
                        <span style={{ gridColumn: '2 / -1', justifySelf: 'start', fontFamily: INTER, fontSize: '0.7rem', color: 'var(--muted)' }}>nie uzupełniono</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* ── FEEDBACK ── */}
            <div className="coach-section-label">Feedback po treningu</div>
            <Card style={{ padding: 0 }}>
              {athletes.map((a, i) => {
                const f = feedbackByAthlete.get(a.id)
                return (
                  <div key={a.id} style={{ padding: '0.75rem 1rem', borderTop: i > 0 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.86rem', minWidth: 140, color: 'var(--ink)' }}>{a.full_name}</span>
                    {f ? (
                      <span style={{ fontFamily: INTER, fontSize: '0.78rem', color: 'var(--ink)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        {f.session_rpe != null && <span style={{ fontWeight: 700 }}>RPE {f.session_rpe}/10</span>}
                        {f.feeling_after && <span>{FEELING_LABELS[f.feeling_after] || f.feeling_after}</span>}
                        {f.what_went_well && <span style={{ color: SEM.green }}>✓ {f.what_went_well}</span>}
                        {f.pain_after_comment && <span style={{ color: SEM.red }}>⚠ {f.pain_after_comment}</span>}
                        {f.general_notes && <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>„{f.general_notes}”</span>}
                      </span>
                    ) : (
                      <span style={{ fontFamily: INTER, fontSize: '0.72rem', color: 'var(--muted)' }}>nie uzupełniono</span>
                    )}
                  </div>
                )
              })}
            </Card>

            {selected && (
              <Button
                variant="ghost"
                onClick={() => router.push(`/coach/groups/${group.id}/training/${selected.id}`)}
                style={{ width: '100%', justifyContent: 'center', padding: '0.9rem' }}
              >
                ✏️ Edytuj ten trening
              </Button>
            )}
          </>
        )}
    </>
  )
}
