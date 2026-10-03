'use client'
// src/app/coach/groups/[id]/training/[trainingId]/GroupTrainingClient.tsx
// Tabela treningowa grupy zorganizowanej — wiersze: zawodniczki, kolumny: ćwiczenia
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatDatePl } from '@/lib/groupTraining'
import { CheckSquare, MessageCircle, Info, AlertTriangle, Pencil, Plus, Check, X, Trash2, PanelLeftClose, PanelLeftOpen, ChevronsLeft, ChevronsRight, Download } from 'lucide-react'
import { SetPageMeta, usePageMeta } from '@/components/coach/PageMetaContext'
import { Button } from '@/components/coach/ui'
import { loadPdf, pl, drawHeaderBar, drawFooter, TABLE_STYLES } from '@/lib/groupPdf'

type Group = { id: number; name: string }
type Training = { id: number; group_id: number; training_date: string; absent_athlete_ids?: number[] | null; individual_athlete_ids?: number[] | null }
type Athlete = { id: number; full_name: string }
type Exercise = {
  id: number
  training_id: number
  name: string
  exercise_order: number
  // blok ćwiczeń (0 = A, 1 = B...); brak = blok A
  block_index?: number | null
  // rozpiska dla całej grupy (nagłówek kolumny)
  sets_planned?: number | null
  reps?: string | null
  tempo?: string | null
  // cała kolumna na masie własnej — wpisujemy powtórzenia zamiast ciężaru dla całej drużyny
  bodyweight?: boolean | null
  // tryb indywidualny — serie/powt./tempo per zawodniczka; pusty nagłówek to nie błąd
  individual?: boolean | null
  // gdy ustawione: ćwiczenie NIE jest kolumną grupy, tylko elementem odrębnego
  // planu indywidualnego tej jednej zawodniczki (osobna sekcja pod siatką)
  athlete_id?: number | null
  // ćwiczenie izometryczne — zamiast serie/powt./tempo pokazujemy serie/czas(/intensywność)
  iso?: boolean | null
  iso_type?: 'PIMA' | 'HIMA' | null
  iso_seconds?: number | null
  iso_intensity?: number | null
  // rozpiska per seria (tabelka serii); null w danej pozycji = seria bierze
  // wspólną wartość z pola bazowego (iso_seconds, reps, tempo, iso_intensity)
  iso_seconds_sets?: (number | null)[] | null
  iso_intensity_sets?: (number | null)[] | null
  reps_sets?: (string | null)[] | null
  tempo_sets?: (string | null)[] | null
}
type SetRow = { reps?: string; tempo?: string; weight?: string; skipped?: boolean }
type Entry = {
  id?: number
  training_id: number
  exercise_id: number
  athlete_id: number
  sets: SetRow[]
  pain?: boolean | null
  pain_vas?: number | null
  pain_comment?: string | null
  comment?: string | null
  // zamiana / modyfikacja ćwiczenia tylko dla tej zawodniczki
  exercise_override?: string | null
  // masa własna — w komórce wpisujemy powtórzenia zamiast ciężaru
  bodyweight?: boolean | null
  // ta konkretna zawodniczka nie robi TEGO ćwiczenia (inaczej niż nieobecność
  // na całym treningu — reszty ćwiczeń to nie dotyczy)
  excluded?: boolean | null
}

interface Props {
  group: Group
  training: Training
  athletes: Athlete[]
  initialExercises: Exercise[]
  initialEntries: Entry[]
}

const entryKey = (exerciseId: number, athleteId: number) => `${exerciseId}_${athleteId}`

// Mały kwadratowy przycisk-ikonka w rzędzie serii (dodaj/ból/notatka/szczegóły) —
// jeden spójny styl, kolorowany tylko gdy dana rzecz jest aktywna.
const qiBtn: React.CSSProperties = {
  width: 20, height: 20, padding: 0, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, border: '1.5px solid var(--border)', background: '#ffffff', color: 'var(--muted-light)', lineHeight: 1, outline: 'none',
}

// Pigułka z pełnym tekstem w nagłówku kolumny (BW / Powtórzenia / Indywidualnie).
function headerPill(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, outline: 'none', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.52rem', fontWeight: 700,
    border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    background: active ? '#FFFBEB' : '#ffffff', color: active ? '#92600A' : 'var(--muted-light)',
    borderRadius: 5, padding: '3px 5px', lineHeight: 1,
  }
}

// Pigułka ISO / PIMA / HIMA — ciemne tło + złoty tekst gdy aktywna (inna paleta
// niż BW/Powtórzenia/Indywidualnie, żeby wizualnie odróżnić grupę izometrii).
function isoPill(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, outline: 'none', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.52rem', fontWeight: 700,
    border: `1.5px solid ${active ? 'var(--navy-900)' : 'var(--border)'}`,
    background: active ? 'var(--navy-900)' : '#ffffff', color: active ? 'var(--gold)' : 'var(--muted-light)',
    borderRadius: 5, padding: '3px 5px', lineHeight: 1,
  }
}

// Wiersz szybkiej edycji pod komórką (modyfikacja ćwiczenia / ból / notatka) —
// zawsze pod rzędem serii i ikonek, nigdy w ich miejsce.
function InlineFieldEditor({ initialValue, initialScale, placeholder, borderColor = 'var(--gold)', bg = '#FFFBEB', showScale, onSave, onCancel }: {
  initialValue: string
  initialScale?: number | null
  placeholder: string
  borderColor?: string
  bg?: string
  showScale?: boolean
  onSave: (value: string, scale: number | null) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const [scale, setScale] = useState(initialScale != null ? String(initialScale) : '')
  const parsedScale = () => (scale.trim() === '' ? null : Math.max(0, Math.min(10, Number(scale))))
  return (
    <div style={{ marginTop: 6, width: 260, display: 'flex', alignItems: 'center', gap: 6 }}>
      {showScale && (
        <input
          type="number" min={0} max={10} value={scale}
          onChange={e => setScale(e.target.value)}
          placeholder="0–10"
          onKeyDown={e => { if (e.key === 'Enter') onSave(value, parsedScale()); else if (e.key === 'Escape') onCancel() }}
          style={{ width: 42, flexShrink: 0, textAlign: 'center', border: '1.5px solid #c23b3b', borderRadius: 7, background: '#FDEDED', color: '#c23b3b', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.72rem', fontWeight: 700, padding: '5px 2px', outline: 'none' }}
        />
      )}
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSave(value, showScale ? parsedScale() : null) } else if (e.key === 'Escape') onCancel() }}
        style={{ flex: 1, minWidth: 0, border: `1.5px solid ${borderColor}`, borderRadius: 8, background: bg, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.76rem', color: 'var(--navy-900)', padding: '5px 9px', outline: 'none' }}
      />
      <button onClick={() => onSave(value, showScale ? parsedScale() : null)} title="Zapisz" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: 'none', outline: 'none', background: 'var(--green)', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={13} />
      </button>
      <button onClick={onCancel} title="Anuluj" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: 'none', outline: 'none', background: 'none', color: 'var(--muted-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={13} />
      </button>
    </div>
  )
}

// Kolor awatara — deterministyczny wg pierwszej litery imienia, żeby wiersze
// łatwiej się od siebie odróżniały w gęstej tabeli.
const AVATAR_COLORS = ['#1b2740', '#2c5aa3', '#0f766e', '#92600A', '#7c3aed', '#b45309', '#334155', '#9d174d']
function avatarBg(name: string) {
  const code = name.trim().charCodeAt(0) || 0
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

// Ćwiczenie „na maksa" — w polu POWT. wpisano max/maks/amrap/do upadku.
// Wtedy w komórkach zawodniczek wpisujemy wykonane powtórzenia, nie ciężar.
const isMaxReps = (reps?: string | null) => /(amrap|maks|max|upad)/i.test((reps || '').trim())

// Bloki ćwiczeń: numer bloku kolumny i litera wg pozycji bloku (A, B, ... Z, AA...)
const blockOf = (ex: Exercise) => ex.block_index ?? 0
const blockLetter = (pos: number): string =>
  pos < 26 ? String.fromCharCode(65 + pos) : blockLetter(Math.floor(pos / 26) - 1) + String.fromCharCode(65 + (pos % 26))

// Kolumny tabelki serii w nagłówku ćwiczenia: normalnie powt./tempo, dla ISO
// czas (+ intensywność przy PIMA). Każda wartość ma wersję per seria (*_sets);
// pole bazowe (reps, tempo...) trzyma wartość 1. serii dla starszych widoków.
type PlanField = 'reps' | 'tempo' | 'iso_seconds' | 'iso_intensity'
type PlanColumn = { field: PlanField; label: string; placeholder: string; numeric: boolean; suffix?: string; max?: number }
const PLAN_SETS_KEY = {
  reps: 'reps_sets', tempo: 'tempo_sets', iso_seconds: 'iso_seconds_sets', iso_intensity: 'iso_intensity_sets',
} as const satisfies Record<PlanField, keyof Exercise>
type PlanValue = string | number | null

function planColumns(ex: Exercise): PlanColumn[] {
  if (ex.iso) {
    const cols: PlanColumn[] = [{ field: 'iso_seconds', label: 'Czas', placeholder: '20', numeric: true, suffix: 's', max: 600 }]
    if (ex.iso_type !== 'HIMA') cols.push({ field: 'iso_intensity', label: 'Int.', placeholder: '70', numeric: true, suffix: '%', max: 100 })
    return cols
  }
  return [
    { field: 'reps', label: 'Powt.', placeholder: '8', numeric: false },
    { field: 'tempo', label: 'Tempo', placeholder: '3010', numeric: false },
  ]
}

const planSetCount = (ex: Exercise) => Math.max(ex.sets_planned ?? 0, 1)

// Wartość danej serii — własna wartość serii albo wspólna z pola bazowego
// (treningi sprzed rozpiski per seria).
function planValues(ex: Exercise, field: PlanField): PlanValue[] {
  const perSet = ex[PLAN_SETS_KEY[field]] as PlanValue[] | null | undefined
  return Array.from({ length: planSetCount(ex) }, (_, i) => perSet?.[i] ?? ex[field] ?? null)
}

const isoSetTimes = (ex: Exercise) => planValues(ex, 'iso_seconds') as (number | null)[]

// Krótki zapis wartości w seriach: "8" gdy wszystkie równe, inaczej "8/8/6"
function joinPerSet(values: PlanValue[], suffix = ''): string {
  if (values.every(v => v == null || v === '')) return ''
  if (values.every(v => v === values[0])) return `${values[0]}${suffix}`
  return `${values.map(v => v ?? '?').join('/')}${suffix}`
}

// Skrótowy opis rozpiski ćwiczenia, wszędzie poza edytorem (Plany, PDF,
// podsumowanie treningu): "3×8, tempo 3010" albo dla ISO "3×20s @70% (PIMA)".
// Różne wartości w seriach: "8/8/6, tempo 3010" / "45/40/30s".
function formatExercisePresc(ex: Exercise): string {
  const vary = (f: PlanField) => new Set(planValues(ex, f)).size > 1
  const sets = ex.sets_planned != null ? `${ex.sets_planned}×` : ''
  if (ex.iso) {
    const intensityVal = joinPerSet(planValues(ex, 'iso_intensity'), '%')
    const intensity = ex.iso_type !== 'HIMA' && intensityVal ? ` @${intensityVal}` : ''
    const type = ex.iso_type ? ` (${ex.iso_type})` : ''
    return `${vary('iso_seconds') ? '' : sets}${joinPerSet(planValues(ex, 'iso_seconds'), 's')}${intensity}${type}`.trim()
  }
  const tempo = joinPerSet(planValues(ex, 'tempo'))
  return `${vary('reps') ? '' : sets}${joinPerSet(planValues(ex, 'reps'))}${tempo ? `, tempo ${tempo}` : ''}`
}

// Tabelka serii: wiersz = seria, po lewej numer, dalej wartości do edycji.
// „+ Dodaj serię" dopisuje wiersz z wartościami poprzedniej serii.
function SetPlanTable({ ex, onChange, onCommit, onAdd, onRemove }: {
  ex: Exercise
  onChange: (setIdx: number, field: PlanField, value: string) => void
  onCommit: () => void
  onAdd: () => void
  onRemove: (setIdx: number) => void
}) {
  const cols = planColumns(ex)
  const values = cols.map(c => planValues(ex, c.field))
  const n = planSetCount(ex)
  const grid = `40px repeat(${cols.length}, 1fr) 22px`
  const headCell: React.CSSProperties = { fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.48rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 700, padding: '3px 4px', textAlign: 'center' }
  return (
    <div style={{ marginTop: 6, background: '#ffffff', border: `1px solid var(--border)`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, borderBottom: `1px solid var(--border)`, background: 'var(--bg)' }}>
        <span style={headCell}>Seria</span>
        {cols.map(c => <span key={c.field} style={headCell}>{c.label}</span>)}
        <span />
      </div>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: grid, alignItems: 'center', borderBottom: `1px solid var(--border)` }}>
          <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.68rem', fontWeight: 800, color: 'var(--navy-900)', textAlign: 'center', borderRight: `1px solid var(--border)`, padding: '4px 0' }}>{i + 1}</span>
          {cols.map((c, ci) => (
            <div key={c.field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, borderRight: `1px solid var(--border)` }}>
              <input
                type={c.numeric ? 'number' : 'text'}
                {...(c.numeric ? { min: 0, max: c.max } : {})}
                value={values[ci][i] ?? ''}
                onChange={e => onChange(i, c.field, e.target.value)}
                onBlur={onCommit}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder={c.placeholder}
                style={{ width: c.suffix ? 34 : 52, minWidth: 0, border: 'none', background: 'none', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.72rem', fontWeight: 800, color: 'var(--navy-900)', padding: '4px 0', outline: 'none', textAlign: c.suffix ? 'right' : 'center' }}
              />
              {c.suffix && <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)' }}>{c.suffix}</span>}
            </div>
          ))}
          {n > 1 ? (
            <button onClick={() => onRemove(i)} title="Usuń serię" style={{ border: 'none', background: 'none', color: 'var(--muted-light)', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}>
              <X size={11} />
            </button>
          ) : <span />}
        </div>
      ))}
      <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', border: 'none', background: 'none', color: 'var(--navy-900)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', fontWeight: 700, padding: '5px 0', outline: 'none' }}>
        <Plus size={11} /> Dodaj serię
      </button>
    </div>
  )
}

// Rozpiska obowiązująca daną zawodniczkę w danej serii — zawsze nagłówek grupy.
function resolvePresc(ex: Exercise, _entry: Entry | null | undefined, setIdx = 0): { sets: number | null; reps: string; tempo: string } {
  const at = (f: 'reps' | 'tempo') => String(planValues(ex, f)[Math.min(setIdx, planSetCount(ex) - 1)] ?? '')
  return { sets: ex.sets_planned ?? null, reps: at('reps'), tempo: at('tempo') }
}

// Serie do wyświetlenia: wpis zawodniczki dopełniony do liczby serii z rozpiski,
// puste serie dziedziczą powtórzenia i tempo z rozpiski (wariantu lub nagłówka)
function effectiveSets(ex: Exercise, entry: Entry | null | undefined, minOne = false): SetRow[] {
  const presc = resolvePresc(ex, entry)
  const fromEntry = entry?.sets || []
  // Jeśli zawodniczka ma już zapisane serie, ich liczba jest rozstrzygająca —
  // nawet gdy jest mniejsza niż rozpiska grupy (inaczej „usuń serię" nigdy nie
  // zeszłoby poniżej planu grupy). Dopiero brak jakichkolwiek zapisanych serii
  // pokazuje tyle pustych pól, ile zakłada rozpiska — żeby było co wypełnić.
  if (fromEntry.length > 0) {
    const n = Math.max(fromEntry.length, minOne ? 1 : 0)
    return Array.from({ length: n }, (_, i) => ({ ...fromEntry[i] }))
  }
  const n = Math.max(presc.sets ?? 0, minOne ? 1 : 0)
  return Array.from({ length: n }, (_, i) => {
    const p = resolvePresc(ex, entry, i)
    return { reps: p.reps, tempo: p.tempo, weight: '' }
  })
}

// ── Modal komórki: serie + ból + komentarz ──────────────────────────────────
function CellModal({ athlete, exercise, entry, training, onClose, onSaved }: {
  athlete: Athlete
  exercise: Exercise
  entry: Entry | null
  training: Training
  onClose: () => void
  onSaved: (saved: Entry) => void
}) {
  const supabase = createClient()
  const [sets, setSets] = useState<SetRow[]>(() =>
    effectiveSets(exercise, entry, true).map((s, i) => {
      const p = resolvePresc(exercise, entry, i)
      return { ...s, reps: s.reps || (isMaxReps(p.reps) ? '' : p.reps), tempo: s.tempo || p.tempo }
    })
  )
  const [pain, setPain] = useState<boolean>(!!entry?.pain || entry?.pain_vas != null || !!(entry?.pain_comment))
  const [painVas, setPainVas] = useState<number | null>(entry?.pain_vas ?? null)
  const [painComment, setPainComment] = useState(entry?.pain_comment || '')
  const [comment, setComment] = useState(entry?.comment || '')
  const [exerciseOverride, setExerciseOverride] = useState(entry?.exercise_override || '')
  const [bodyweight, setBodyweight] = useState(!!entry?.bodyweight)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateSet(idx: number, field: keyof SetRow, value: string) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  function addSet() {
    setSets(prev => {
      const last = prev[prev.length - 1]
      // nowa seria dziedziczy wartości z poprzedniej — szybciej się wpisuje
      return [...prev, last ? { ...last } : {}]
    })
  }

  function removeSet(idx: number) {
    setSets(prev => prev.filter((_, i) => i !== idx))
  }

  function toggleSkip(idx: number) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, skipped: !s.skipped } : s))
  }

  async function handleSave() {
    setSaving(true); setError('')
    const cleanSets = sets.filter(s => (s.reps || '').trim() || (s.tempo || '').trim() || (s.weight || '').trim() || s.skipped)
    const payload = {
      training_id: training.id,
      exercise_id: exercise.id,
      athlete_id: athlete.id,
      sets: cleanSets,
      pain,
      pain_vas: pain ? painVas : null,
      pain_comment: pain ? (painComment.trim() || null) : null,
      comment: comment.trim() || null,
      exercise_override: exerciseOverride.trim() || null,
      bodyweight,
      excluded: entry?.excluded ?? false,
      updated_at: new Date().toISOString(),
    }
    let { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(payload, { onConflict: 'exercise_id,athlete_id' })
      .select()
      .single()
    // Migracje kolumn „pain” / „bodyweight” / „excluded” jeszcze nie wgrane — zapisz bez brakującej
    let attempt: Record<string, any> = payload
    let guard = 0
    while (err && guard++ < 3) {
      const missing = ['pain', 'bodyweight', 'excluded'].find(col => new RegExp(`'${col}'`).test(err!.message) && col in attempt)
      if (!missing) break
      const { [missing]: _omit, ...rest } = attempt
      attempt = rest
      ;({ data, error: err } = await supabase
        .from('group_training_entries')
        .upsert(attempt, { onConflict: 'exercise_id,athlete_id' })
        .select()
        .single())
    }
    setSaving(false)
    if (err || !data) { setError(err?.message || 'Błąd zapisu'); return }
    onSaved(data as Entry)
    onClose()
  }

  const cellInput: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.5rem', border: `1.5px solid var(--border)`,
    borderRadius: 8, background: 'var(--bg)', color: 'var(--navy-900)',
    fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.82rem', outline: 'none', textAlign: 'center',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'var(--font-inter), sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: 18, overflow: 'hidden', border: `1.5px solid var(--border)` }}>
        <div style={{ background: 'var(--navy-900)', padding: '1rem 1.25rem', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {exercise.name || 'Ćwiczenie'}
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>{athlete.full_name}</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '1.1rem 1.25rem' }}>
          {/* ── MODYFIKACJA ĆWICZENIA ── */}
          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
            Modyfikacja ćwiczenia — tylko ta zawodniczka
          </div>
          <input
            value={exerciseOverride}
            onChange={e => setExerciseOverride(e.target.value)}
            placeholder={`np. zamiast „${exercise.name || 'ćwiczenia'}”: wersja z gumą, inne ćwiczenie...`}
            style={{ width: '100%', padding: '0.65rem', border: `1.5px solid ${exerciseOverride.trim() ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 10, background: exerciseOverride.trim() ? '#FFFBEB' : 'var(--bg)', color: 'var(--navy-900)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.88rem', outline: 'none', marginBottom: '0.75rem' }}
          />

          {/* ── BEZ CIĘŻARU (masa własna) ── */}
          <button
            onClick={() => setBodyweight(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 10, border: `1.5px solid ${bodyweight ? 'var(--gold)' : 'var(--border)'}`, background: bodyweight ? '#FFFBEB' : 'var(--bg)', marginBottom: '1.25rem' }}
          >
            <span style={{ flexShrink: 0, width: 38, height: 22, borderRadius: 999, background: bodyweight ? 'var(--gold)' : 'var(--border)', position: 'relative', transition: 'background 0.15s' }}>
              <span style={{ position: 'absolute', top: 2, left: bodyweight ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#ffffff', transition: 'left 0.15s' }} />
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', color: 'var(--navy-900)' }}>Bez ciężaru — wpisuj powtórzenia</span>
              <span style={{ display: 'block', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', marginTop: 1 }}>masa własna: w tabeli zamiast kg wpisujesz wykonane powt.</span>
            </span>
          </button>

          {/* ── SERIE ── */}
          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
            Serie
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: bodyweight ? '34px 1fr 1fr 30px' : '34px 1fr 1fr 1fr 30px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.58rem', color: 'var(--muted-light)', textAlign: 'center' }}>#</span>
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.58rem', color: 'var(--muted-light)', textAlign: 'center' }}>POWT.</span>
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.58rem', color: 'var(--muted-light)', textAlign: 'center' }}>TEMPO</span>
            {!bodyweight && <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.58rem', color: 'var(--muted-light)', textAlign: 'center' }}>CIĘŻAR</span>}
            <span />
          </div>
          {sets.map((s, idx) => {
            const skipInput: React.CSSProperties = s.skipped
              ? { ...cellInput, textDecoration: 'line-through', color: 'var(--muted-light)', background: '#F1F3F7' }
              : cellInput
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: bodyweight ? '34px 1fr 1fr 30px' : '34px 1fr 1fr 1fr 30px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <button
                  onClick={() => toggleSkip(idx)}
                  title={s.skipped ? 'Cofnij — seria zrobiona' : 'Oznacz: seria nie zrobiona'}
                  style={{ border: s.skipped ? `1.5px solid ${'#c23b3b'}` : '1.5px solid transparent', borderRadius: 7, background: s.skipped ? '#FDEDED' : 'none', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.82rem', fontWeight: 700, color: s.skipped ? '#c23b3b' : 'var(--navy-900)', textAlign: 'center', textDecoration: s.skipped ? 'line-through' : 'none', padding: '0.32rem 0' }}
                >
                  {idx + 1}
                </button>
                <input value={s.reps || ''} onChange={e => updateSet(idx, 'reps', e.target.value)} placeholder={resolvePresc(exercise, entry, idx).reps || '8'} style={skipInput} inputMode="text" disabled={s.skipped} />
                <input value={s.tempo || ''} onChange={e => updateSet(idx, 'tempo', e.target.value)} placeholder={resolvePresc(exercise, entry, idx).tempo || '3010'} style={skipInput} inputMode="text" disabled={s.skipped} />
                {!bodyweight && <input value={s.weight || ''} onChange={e => updateSet(idx, 'weight', e.target.value)} placeholder="kg" style={skipInput} inputMode="text" disabled={s.skipped} />}
                <button onClick={() => removeSet(idx)} title="Usuń serię" style={{ border: 'none', background: 'none', color: 'var(--muted-light)', fontSize: '0.9rem', padding: 4 }}>✕</button>
              </div>
            )
          })}
          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.58rem', color: 'var(--muted-light)', marginBottom: 8 }}>
            Kliknij numer serii, by oznaczyć „nie zrobiła".
          </div>
          <button onClick={addSet} style={{ width: '100%', padding: '0.6rem', borderRadius: 10, border: `1.5px dashed var(--muted-light)`, background: '#ffffff', color: 'var(--navy-900)', fontWeight: 700, fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            ＋ Dodaj serię
          </button>

          {/* ── BÓL ── */}
          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
            Ból
          </div>
          <button
            onClick={() => { const next = !pain; setPain(next); if (!next) { setPainVas(null); setPainComment('') } }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 10, border: `1.5px solid ${pain ? '#c23b3b' : 'var(--border)'}`, background: pain ? '#FEF2F2' : 'var(--bg)', marginBottom: pain ? '0.85rem' : '1.25rem' }}
          >
            <span style={{ flexShrink: 0, width: 38, height: 22, borderRadius: 999, background: pain ? '#c23b3b' : 'var(--border)', position: 'relative', transition: 'background 0.15s' }}>
              <span style={{ position: 'absolute', top: 2, left: pain ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#ffffff', transition: 'left 0.15s' }} />
            </span>
            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: pain ? '#B91C1C' : 'var(--navy-900)' }}>Wystąpił ból</span>
          </button>

          {pain && (
            <>
              <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.58rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>
                Nasilenie (skala VAS) — opcjonalnie
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                <button
                  onClick={() => setPainVas(null)}
                  style={{ padding: '0.45rem 0.7rem', borderRadius: 8, border: `1.5px solid ${painVas === null ? 'var(--gold)' : 'var(--border)'}`, background: painVas === null ? 'var(--navy-900)' : 'var(--bg)', color: painVas === null ? 'var(--gold)' : 'var(--navy-900)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.72rem', fontWeight: 700 }}
                >
                  nie podano
                </button>
                {Array.from({ length: 11 }, (_, v) => (
                  <button
                    key={v}
                    onClick={() => setPainVas(v)}
                    style={{ width: 34, padding: '0.45rem 0', borderRadius: 8, border: `1.5px solid ${painVas === v ? 'var(--gold)' : 'var(--border)'}`, background: painVas === v ? (v >= 5 ? '#c23b3b' : '#c07f1e') : 'var(--bg)', color: painVas === v ? '#ffffff' : 'var(--navy-900)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.78rem', fontWeight: 700 }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <input
                value={painComment}
                onChange={e => setPainComment(e.target.value)}
                placeholder="Gdzie boli? Opis bólu..."
                style={{ width: '100%', padding: '0.65rem', border: `1.5px solid var(--border)`, borderRadius: 10, background: 'var(--bg)', color: 'var(--navy-900)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.88rem', outline: 'none', marginBottom: '1.25rem' }}
              />
            </>
          )}

          {/* ── KOMENTARZ ── */}
          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
            Komentarz do całego ćwiczenia
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Uwagi do techniki, przebiegu wszystkich serii..."
            rows={2}
            style={{ width: '100%', padding: '0.65rem', border: `1.5px solid var(--border)`, borderRadius: 10, background: 'var(--bg)', color: 'var(--navy-900)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
          />
          {error && <div style={{ color: '#c23b3b', fontSize: '0.82rem', marginTop: '0.75rem' }}>❌ {error}</div>}
        </div>

        <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid var(--border)`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="dark" onClick={handleSave} disabled={saving} style={{ flex: 1, color: 'var(--gold)', fontWeight: 900 }}>
            {saving ? 'Zapisuję...' : 'Zapisz'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function GroupTrainingClient({ group, training, athletes, initialExercises, initialEntries }: Props) {
  const router = useRouter()
  const { sidebarCollapsed, setSidebarCollapsed } = usePageMeta()
  const supabase = createClient()

  // `excluded` (migracja 202609150003) jest dopisywana do KAŻDEGO zapisu wpisu
  // defensywnie (żeby jej nie zgubić przy okazji zapisu czegoś innego) — jeśli
  // kolumna jeszcze nie istnieje w bazie, pomijamy ją i zapisujemy resztę, żeby
  // brak jednej migracji nie blokował wpisywania ciężarów/powtórzeń.
  async function upsertTrainingEntry(payload: Record<string, any>) {
    let attempt = payload
    let res = await supabase.from('group_training_entries').upsert(attempt, { onConflict: 'exercise_id,athlete_id' }).select().single()
    if (res.error && 'excluded' in attempt && /'excluded'/.test(res.error.message)) {
      const { excluded, ...rest } = attempt
      attempt = rest
      res = await supabase.from('group_training_entries').upsert(attempt, { onConflict: 'exercise_id,athlete_id' }).select().single()
    }
    return res
  }

  async function upsertTrainingEntries(rows: Record<string, any>[]) {
    let attempt = rows
    let res = await supabase.from('group_training_entries').upsert(attempt, { onConflict: 'exercise_id,athlete_id' }).select()
    if (res.error && attempt[0] && 'excluded' in attempt[0] && /'excluded'/.test(res.error.message)) {
      attempt = attempt.map(({ excluded, ...rest }) => rest)
      res = await supabase.from('group_training_entries').upsert(attempt, { onConflict: 'exercise_id,athlete_id' }).select()
    }
    return res
  }

  const [exercises, setExercises] = useState<Exercise[]>(() => initialExercises)
  const [entryMap, setEntryMap] = useState<Map<string, Entry>>(
    () => new Map(initialEntries.map(e => [entryKey(e.exercise_id, e.athlete_id), e]))
  )
  const [openCell, setOpenCell] = useState<{ athlete: Athlete; exercise: Exercise } | null>(null)
  const [cellEdit, setCellEdit] = useState<{ key: string; type: 'mod' | 'pain' | 'note' } | null>(null)
  const [trainingDate, setTrainingDate] = useState(training.training_date)
  const [absentIds, setAbsentIds] = useState<Set<number>>(() => new Set(training.absent_athlete_ids || []))
  const [individualIds, setIndividualIds] = useState<Set<number>>(() => new Set(training.individual_athlete_ids || []))
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)
  const [focusExerciseId, setFocusExerciseId] = useState<number | null>(null)
  const nameInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const boardWrapRef = useRef<HTMLDivElement>(null)
  // Najnowsze serie per komórka — chroni przed zgubieniem ciężaru przy szybkim
  // przechodzeniu między polami (zapis async może nie zdążyć przed kolejnym blur)
  const latestSetsRef = useRef<Map<string, SetRow[]>>(new Map())
  const dragExId = useRef<number | null>(null) // ćwiczenie przeciągane (zmiana kolejności)
  const [dragOverExId, setDragOverExId] = useState<number | null>(null)

  // Po dodaniu kolumny kursor wskakuje w pole nazwy nowego ćwiczenia
  useEffect(() => {
    if (focusExerciseId == null) return
    const input = nameInputRefs.current.get(focusExerciseId)
    if (input) { input.focus(); setFocusExerciseId(null) }
  }, [focusExerciseId, exercises])

  // Kolumny wspólne dla grupy (athlete_id puste) — to one tworzą główną siatkę.
  const sortedExercises = useMemo(
    () => [...exercises].filter(e => !e.athlete_id).sort((a, b) => blockOf(a) - blockOf(b) || a.exercise_order - b.exercise_order || a.id - b.id),
    [exercises]
  )

  // Bloki ćwiczeń: litery A, B, C... wg kolejności niepustych bloków (po usunięciu
  // wszystkich ćwiczeń bloku kolejne litery się przesuwają), ćwiczenia A1, A2...
  const blocks = useMemo(() => {
    const out: { index: number; letter: string; exercises: Exercise[] }[] = []
    for (const ex of sortedExercises) {
      const last = out[out.length - 1]
      if (last && last.index === blockOf(ex)) last.exercises.push(ex)
      else out.push({ index: blockOf(ex), letter: blockLetter(out.length), exercises: [ex] })
    }
    return out
  }, [sortedExercises])
  const exerciseLabel = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of blocks) b.exercises.forEach((ex, i) => m.set(ex.id, `${b.letter}${i + 1}`))
    return m
  }, [blocks])
  const lastBlockIndex = blocks.length ? blocks[blocks.length - 1].index : 0

  // Zwinięte bloki — tylko widok, pamiętany w przeglądarce per trening
  const collapsedKey = `gt-collapsed-blocks-${training.id}`
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<number>>(() => new Set())
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(collapsedKey) || '[]')
      if (Array.isArray(saved)) setCollapsedBlocks(new Set(saved.filter((n: unknown) => typeof n === 'number')))
    } catch {}
  }, [collapsedKey])
  function toggleBlockCollapsed(blockIndex: number) {
    setCollapsedBlocks(prev => {
      const next = new Set(prev)
      if (next.has(blockIndex)) next.delete(blockIndex); else next.add(blockIndex)
      try { localStorage.setItem(collapsedKey, JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  // Kolumny siatki: ćwiczenia rozwiniętych bloków albo jeden wąski pasek za zwinięty
  // blok. exIdx to pozycja w sortedExercises (nawigacja klawiaturą).
  type BoardColumn =
    | { kind: 'ex'; ex: Exercise; exIdx: number; blockStart: boolean }
    | { kind: 'collapsed'; block: (typeof blocks)[number] }
  const boardColumns = useMemo(() => blocks.flatMap((b): BoardColumn[] => collapsedBlocks.has(b.index)
    ? [{ kind: 'collapsed', block: b }]
    : b.exercises.map((ex, i) => ({ kind: 'ex', ex, exIdx: sortedExercises.indexOf(ex), blockStart: i === 0 }))
  ), [blocks, collapsedBlocks, sortedExercises])

  // Zawodniczki "wyciągnięte" do treningu indywidualnego znikają z głównej siatki
  // i dostają własną sekcję niżej — niezależnie od tego, kto jest nieobecny.
  const boardAthletes = useMemo(() => athletes.filter(a => !individualIds.has(a.id)), [athletes, individualIds])

  // Obecne zawodniczki na górze (w oryginalnej kolejności), wykreślone na końcu
  const orderedAthletes = useMemo(() => {
    const present = boardAthletes.filter(a => !absentIds.has(a.id)).map(a => ({ athlete: a, absent: false }))
    const absent = boardAthletes.filter(a => absentIds.has(a.id)).map(a => ({ athlete: a, absent: true }))
    return [...present, ...absent]
  }, [boardAthletes, absentIds])

  // Wykreślenie / przywrócenie zawodniczki (nieobecność na tym treningu)
  async function toggleAbsent(athleteId: number) {
    setError('')
    const prev = absentIds
    const next = new Set(prev)
    if (next.has(athleteId)) next.delete(athleteId); else next.add(athleteId)
    setAbsentIds(next)
    const { error: err } = await supabase
      .from('group_trainings')
      .update({ absent_athlete_ids: Array.from(next) })
      .eq('id', training.id)
    if (err) { setError(err.message); setAbsentIds(prev) }
  }

  // Przełącz zawodniczkę między treningiem grupowym a odrębnym planem indywidualnym
  // na TEN trening — nie usuwa jej ćwiczeń indywidualnych, tylko chowa/pokazuje sekcję.
  async function toggleIndividualAthlete(athleteId: number) {
    setError('')
    const prev = individualIds
    const next = new Set(prev)
    if (next.has(athleteId)) next.delete(athleteId); else next.add(athleteId)
    setIndividualIds(next)
    const { error: err } = await supabase
      .from('group_trainings')
      .update({ individual_athlete_ids: Array.from(next) })
      .eq('id', training.id)
    if (err) {
      setIndividualIds(prev)
      setError(/'individual_athlete_ids'/.test(err.message)
        ? 'Aby korzystać z planów indywidualnych, uruchom migrację 202609150003.'
        : err.message)
    }
  }

  // Nowe ćwiczenie w odrębnym planie indywidualnym tej zawodniczki (poza siatką grupy)
  async function handleAddIndividualExercise(athleteId: number) {
    setError('')
    const own = exercises.filter(e => e.athlete_id === athleteId)
    const maxOrder = Math.max(0, ...own.map(e => e.exercise_order))
    const { data, error: err } = await supabase
      .from('group_training_exercises')
      .insert({ training_id: training.id, athlete_id: athleteId, name: '', exercise_order: maxOrder + 1, sets_planned: 3 })
      .select()
      .single()
    if (err || !data) {
      setError(/'athlete_id'/.test(err?.message || '')
        ? 'Aby dodawać plany indywidualne, uruchom migrację 202609150003.'
        : (err?.message || 'Błąd dodawania ćwiczenia'))
      return
    }
    setExercises(prev => [...prev, data as Exercise])
    setFocusExerciseId((data as Exercise).id)
  }

  // Wyklucz / przywróć jedną zawodniczkę z jednego ćwiczenia (reszty kolumn to nie dotyczy)
  async function toggleExcludeFromExercise(athlete: Athlete, ex: Exercise) {
    const entry = entryMap.get(entryKey(ex.id, athlete.id))
    await saveEntryMeta(athlete, ex, { excluded: !entry?.excluded })
  }

  // Nowa kolumna ćwiczenia — od razu z pustym polem nazwy do wpisania (jak w Excelu).
  // Domyślnie trafia do ostatniego bloku; „Nowy blok" podaje kolejny numer bloku.
  async function handleAddExercise(blockIndex = lastBlockIndex) {
    setError('')
    const maxOrder = Math.max(0, ...exercises.map(e => e.exercise_order))
    // block_index wysyłamy tylko poza blokiem A — bez migracji blok A dalej działa
    const { data, error: err } = await supabase
      .from('group_training_exercises')
      .insert({ training_id: training.id, name: '', exercise_order: maxOrder + 1, sets_planned: 3, ...(blockIndex ? { block_index: blockIndex } : {}) })
      .select()
      .single()
    if (err || !data) {
      setError(/'block_index'/.test(err?.message || '')
        ? 'Aby grupować ćwiczenia w bloki, uruchom migrację 202610030003.'
        : (err?.message || 'Błąd dodawania ćwiczenia'))
      return
    }
    if (blockIndex && collapsedBlocks.has(blockIndex)) toggleBlockCollapsed(blockIndex)
    setExercises(prev => [...prev, data as Exercise])
    setFocusExerciseId((data as Exercise).id)
  }

  function handleExerciseField(exerciseId: number, field: 'name' | 'reps' | 'tempo' | 'sets_planned' | 'iso_seconds' | 'iso_intensity', value: string) {
    setExercises(prev => prev.map(e => {
      if (e.id !== exerciseId) return e
      if (field === 'sets_planned' || field === 'iso_seconds' || field === 'iso_intensity') {
        return { ...e, [field]: value === '' ? null : parseInt(value) || null }
      }
      return { ...e, [field]: value }
    }))
  }

  // Tabelka serii — liczba wierszy to sets_planned, wartości w *_sets; pole
  // bazowe (reps, tempo, iso_seconds...) trzyma wartość 1. serii dla starszych widoków.
  // `mutate` dostaje wiersze serii (wartość każdej kolumny) i zwraca nowe.
  function withPlanRows(e: Exercise, mutate: (rows: Record<PlanField, PlanValue>[]) => Record<PlanField, PlanValue>[]): Exercise {
    const cols = planColumns(e)
    const current = cols.map(c => planValues(e, c.field))
    const rows = mutate(Array.from({ length: planSetCount(e) }, (_, i) =>
      Object.fromEntries(cols.map((c, ci) => [c.field, current[ci][i]])) as Record<PlanField, PlanValue>))
    const next: Exercise = { ...e, sets_planned: rows.length }
    for (const c of cols) {
      const values = rows.map(r => r[c.field] ?? null)
      Object.assign(next, { [PLAN_SETS_KEY[c.field]]: values, [c.field]: values[0] })
    }
    return next
  }

  function handlePlanCell(exerciseId: number, setIdx: number, field: PlanField, value: string) {
    const parsed = planColumns(exercises.find(e => e.id === exerciseId)!).find(c => c.field === field)?.numeric
      ? (value === '' ? null : parseInt(value) || null)
      : value
    setExercises(prev => prev.map(e => e.id !== exerciseId ? e
      : withPlanRows(e, rows => rows.map((r, i) => i === setIdx ? { ...r, [field]: parsed } : r))))
  }

  function changePlanRows(exerciseId: number, mutate: (rows: Record<PlanField, PlanValue>[]) => Record<PlanField, PlanValue>[]) {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex) return
    const next = withPlanRows(ex, mutate)
    setExercises(prev => prev.map(e => e.id === exerciseId ? next : e))
    persistExercise(exerciseId, next)
  }

  const addPlanRow = (exerciseId: number) => changePlanRows(exerciseId, rows => [...rows, { ...rows[rows.length - 1] }])
  const removePlanRow = (exerciseId: number, idx: number) => changePlanRows(exerciseId, rows => rows.filter((_, j) => j !== idx))

  async function persistExercise(exerciseId: number, override?: Exercise) {
    const ex = override ?? exercises.find(e => e.id === exerciseId)
    if (!ex) return
    const update: Record<string, any> = {
      name: ex.name.trim(), sets_planned: ex.sets_planned ?? null, reps: ex.reps?.trim() || null, tempo: ex.tempo?.trim() || null,
      iso_seconds: ex.iso_seconds ?? null, iso_intensity: ex.iso_intensity ?? null,
    }
    // Rozpiskę per seria wysyłamy tylko gdy jest (edytowano tabelkę albo przyszła
    // z bazy) — brak migracji nie blokuje zapisu nazwy w starych ćwiczeniach.
    for (const key of Object.values(PLAN_SETS_KEY)) if (ex[key] !== undefined) update[key] = ex[key]
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update(update)
      .eq('id', ex.id)
    if (err) setError(/'(reps|tempo|iso_seconds|iso_intensity)_sets'/.test(err.message)
      ? 'Aby ustawiać różne wartości dla każdej serii, uruchom migrację 202610030002.'
      : /'iso_seconds'|'iso_intensity'/.test(err.message)
        ? 'Aby używać ćwiczeń izometrycznych, uruchom migrację 202609200002.'
        : err.message)
  }

  // Przełącz ćwiczenie izometryczne — przy pierwszym włączeniu ustaw sensowne
  // wartości domyślne (PIMA, 20s, 70%), jeśli jeszcze ich nie było.
  async function toggleIso(exerciseId: number) {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex) return
    const next = !ex.iso
    const patch = next
      ? { iso: true, iso_type: ex.iso_type ?? 'PIMA' as const, iso_seconds: ex.iso_seconds ?? 20, iso_intensity: ex.iso_intensity ?? 70 }
      : { iso: false }
    const prevExercises = exercises
    setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, ...patch } : e))
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update(patch)
      .eq('id', exerciseId)
    if (err) {
      setExercises(prevExercises)
      setError(/'iso'/.test(err.message)
        ? 'Aby używać ćwiczeń izometrycznych, uruchom migrację 202609200002.'
        : err.message)
    }
  }

  async function setIsoType(exerciseId: number, isoType: 'PIMA' | 'HIMA') {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex || ex.iso_type === isoType) return
    const prev = ex.iso_type ?? null
    setExercises(p => p.map(e => e.id === exerciseId ? { ...e, iso_type: isoType } : e))
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update({ iso_type: isoType })
      .eq('id', exerciseId)
    if (err) {
      setExercises(p => p.map(e => e.id === exerciseId ? { ...e, iso_type: prev } : e))
      setError(err.message)
    }
  }

  // Wpisz 0 (masa ciała) w ciężar zawodniczkom na grupowej rozpisce (bez wybranego
  // wariantu). Zawodniczki z wariantem mają własny przycisk BW przy wariancie.
  async function fillColumnBodyweight(ex: Exercise) {
    const present = athletes.filter(a => !absentIds.has(a.id))
    if (present.length === 0) { setError('Brak obecnych zawodniczek.'); return }
    if (!confirm(`Wpisać 0 (masa ciała) w ciężar wszystkim zawodniczkom w „${ex.name || 'tym ćwiczeniu'}”?`)) return
    setError('')
    const rows = present.map(a => {
      const key = entryKey(ex.id, a.id)
      const current = entryMap.get(key)
      const sets = (latestSetsRef.current.get(key) ?? effectiveSets(ex, current)).map(s => ({ ...s, weight: '0' }))
      latestSetsRef.current.set(key, sets)
      return {
        training_id: training.id, exercise_id: ex.id, athlete_id: a.id, sets,
        pain: current?.pain ?? false, pain_vas: current?.pain_vas ?? null, pain_comment: current?.pain_comment ?? null,
        comment: current?.comment ?? null, exercise_override: current?.exercise_override ?? null,
        bodyweight: current?.bodyweight ?? false, excluded: current?.excluded ?? false,
        updated_at: new Date().toISOString(),
      }
    })
    if (rows.length === 0) return
    const { data, error: err } = await upsertTrainingEntries(rows)
    if (err || !data) { setError(err?.message || 'Błąd zapisu'); return }
    setEntryMap(prev => {
      const next = new Map(prev)
      for (const d of data as Entry[]) next.set(entryKey(d.exercise_id, d.athlete_id), d)
      return next
    })
  }

  // Przełącz całą kolumnę na masę własną (powtórzenia zamiast kg) — dla całej drużyny
  async function toggleExerciseBodyweight(exerciseId: number) {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex) return
    const next = !ex.bodyweight
    setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, bodyweight: next } : e))
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update({ bodyweight: next })
      .eq('id', exerciseId)
    if (err) {
      setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, bodyweight: !next } : e))
      setError(/'bodyweight'/.test(err.message)
        ? 'Aby wyłączyć ciężar dla kolumny, uruchom migrację 202606200003 (kolumna bodyweight w ćwiczeniach).'
        : err.message)
    }
  }

  // Przełącz tryb indywidualny — dane liczone z wierszy zawodniczek, nie z nagłówka
  async function toggleIndividual(exerciseId: number) {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex) return
    const next = !ex.individual
    setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, individual: next } : e))
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update({ individual: next })
      .eq('id', exerciseId)
    if (err) {
      setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, individual: !next } : e))
      setError(/'individual'/.test(err.message)
        ? 'Aby używać trybu indywidualnego, uruchom migrację 202606220001 (kolumna individual).'
        : err.message)
    }
  }

  // Zmiana kolejności ćwiczeń (przeciągnięcie) — przenosi i zapisuje nowe exercise_order
  async function reorderExercise(targetId: number) {
    const fromId = dragExId.current
    dragExId.current = null
    setDragOverExId(null)
    if (!fromId || fromId === targetId) return
    const ordered = [...sortedExercises]
    const fromIdx = ordered.findIndex(e => e.id === fromId)
    const toIdx = ordered.findIndex(e => e.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    // Przeciągnięte ćwiczenie przechodzi do bloku ćwiczenia, na które je upuszczono
    const targetBlock = blockOf(ordered[toIdx])
    const blockChanged = blockOf(ordered[fromIdx]) !== targetBlock
    const [moved] = ordered.splice(fromIdx, 1)
    ordered.splice(toIdx, 0, { ...moved, block_index: targetBlock })
    const updates = ordered.map((e, i) => ({ id: e.id, exercise_order: i }))
    setExercises(prev => prev.map(e => {
      const u = updates.find(x => x.id === e.id)
      if (!u) return e
      return { ...e, exercise_order: u.exercise_order, ...(e.id === fromId ? { block_index: targetBlock } : {}) }
    }))
    const results = await Promise.all(updates.map(u =>
      supabase.from('group_training_exercises')
        .update({ exercise_order: u.exercise_order, ...(u.id === fromId && blockChanged ? { block_index: targetBlock } : {}) })
        .eq('id', u.id)
    ))
    const failed = results.find(r => r.error)
    if (failed?.error) setError(failed.error.message)
  }

  // Szybki zapis wartości wpisanej w komórce tabeli (ciężar albo wykonane powtórzenia)
  async function saveInlineField(athlete: Athlete, ex: Exercise, idx: number, field: 'weight' | 'reps', value: string) {
    const key = entryKey(ex.id, athlete.id)
    const current = entryMap.get(key)
    const presc = resolvePresc(ex, current, idx)
    const sets = latestSetsRef.current.get(key) ?? effectiveSets(ex, current)
    if ((sets[idx]?.[field] || '') === value.trim()) return
    sets[idx] = { ...(sets[idx] || { reps: presc.reps, tempo: presc.tempo }), [field]: value.trim() }
    latestSetsRef.current.set(key, sets)
    const payload = {
      training_id: training.id,
      exercise_id: ex.id,
      athlete_id: athlete.id,
      sets,
      pain: current?.pain ?? false,
      pain_vas: current?.pain_vas ?? null,
      pain_comment: current?.pain_comment ?? null,
      comment: current?.comment ?? null,
      exercise_override: current?.exercise_override ?? null,
      bodyweight: current?.bodyweight ?? false,
      excluded: current?.excluded ?? false,
      updated_at: new Date().toISOString(),
    }
    const { data, error: err } = await upsertTrainingEntry(payload)
    if (err || !data) { setError(err?.message || 'Błąd zapisu'); return }
    setEntryMap(prev => {
      const next = new Map(prev)
      next.set(key, data as Entry)
      return next
    })
  }

  // Oznaczenie / cofnięcie „nie zrobiła tej serii" bezpośrednio w tabeli
  async function toggleSkipInline(athlete: Athlete, ex: Exercise, idx: number) {
    const key = entryKey(ex.id, athlete.id)
    const current = entryMap.get(key)
    const sets = (latestSetsRef.current.get(key) ?? effectiveSets(ex, current)).map(s => ({ ...s }))
    const presc = resolvePresc(ex, current, idx)
    sets[idx] = { ...(sets[idx] || { reps: presc.reps, tempo: presc.tempo }), skipped: !sets[idx]?.skipped }
    latestSetsRef.current.set(key, sets)
    const payload = {
      training_id: training.id,
      exercise_id: ex.id,
      athlete_id: athlete.id,
      sets,
      pain: current?.pain ?? false,
      pain_vas: current?.pain_vas ?? null,
      pain_comment: current?.pain_comment ?? null,
      comment: current?.comment ?? null,
      exercise_override: current?.exercise_override ?? null,
      bodyweight: current?.bodyweight ?? false,
      excluded: current?.excluded ?? false,
      updated_at: new Date().toISOString(),
    }
    const { data, error: err } = await upsertTrainingEntry(payload)
    if (err || !data) { setError(err?.message || 'Błąd zapisu'); return }
    setEntryMap(prev => {
      const next = new Map(prev)
      next.set(key, data as Entry)
      return next
    })
  }

  // Zapis całej tablicy serii (dodanie/usunięcie serii tej zawodniczce)
  async function persistEntrySets(athlete: Athlete, ex: Exercise, sets: SetRow[]) {
    const key = entryKey(ex.id, athlete.id)
    const current = entryMap.get(key)
    latestSetsRef.current.set(key, sets)
    const payload = {
      training_id: training.id,
      exercise_id: ex.id,
      athlete_id: athlete.id,
      sets,
      pain: current?.pain ?? false,
      pain_vas: current?.pain_vas ?? null,
      pain_comment: current?.pain_comment ?? null,
      comment: current?.comment ?? null,
      exercise_override: current?.exercise_override ?? null,
      bodyweight: current?.bodyweight ?? false,
      excluded: current?.excluded ?? false,
      updated_at: new Date().toISOString(),
    }
    const { data, error: err } = await upsertTrainingEntry(payload)
    if (err || !data) { setError(err?.message || 'Błąd zapisu'); return }
    setEntryMap(prev => {
      const next = new Map(prev)
      next.set(key, data as Entry)
      return next
    })
  }

  // ── Nawigacja klawiaturą między polami serii w głównej siatce ──
  // ArrowLeft/Right: sąsiednia seria (na krawędzi ćwiczenia — sąsiednie ćwiczenie
  // tej samej zawodniczki); Enter: ta sama seria, zawodniczka niżej.
  function focusSetCell(exIdx: number, rowIdx: number, setIdx: number): boolean {
    if (exIdx < 0 || exIdx >= sortedExercises.length) return false
    if (rowIdx < 0 || rowIdx >= orderedAthletes.length) return false
    if (setIdx < 0) return false
    const wrap = boardWrapRef.current
    const input = wrap?.querySelector<HTMLInputElement>(`input[data-set-nav="1"][data-ex-idx="${exIdx}"][data-row-idx="${rowIdx}"][data-set-idx="${setIdx}"]`)
    if (!input || input.disabled) return false
    input.focus()
    input.select()
    return true
  }

  function lastSetIdxAt(exIdx: number, rowIdx: number): number {
    const wrap = boardWrapRef.current
    if (!wrap) return -1
    let max = -1
    wrap.querySelectorAll<HTMLInputElement>(`input[data-set-nav="1"][data-ex-idx="${exIdx}"][data-row-idx="${rowIdx}"]`).forEach(inp => {
      const idx = Number(inp.dataset.setIdx)
      if (idx > max) max = idx
    })
    return max
  }

  function handleSetNavKeyDown(e: React.KeyboardEvent<HTMLInputElement>, athlete: Athlete, ex: Exercise, exIdx: number, rowIdx: number, setIdx: number, field: 'weight' | 'reps') {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      // na krawędzi — pierwsze widoczne ćwiczenie dalej (zwinięte bloki pomijamy)
      if (!focusSetCell(exIdx, rowIdx, setIdx + 1)) {
        for (let j = exIdx + 1; j < sortedExercises.length; j++) if (focusSetCell(j, rowIdx, 0)) break
      }
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (!focusSetCell(exIdx, rowIdx, setIdx - 1)) {
        for (let j = exIdx - 1; j >= 0; j--) {
          const last = lastSetIdxAt(j, rowIdx)
          if (last >= 0 && focusSetCell(j, rowIdx, last)) break
        }
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      saveInlineField(athlete, ex, setIdx, field, (e.target as HTMLInputElement).value)
      focusSetCell(exIdx, rowIdx + 1, setIdx)
    }
  }

  function addInlineSet(athlete: Athlete, ex: Exercise) {
    const key = entryKey(ex.id, athlete.id)
    const entry = entryMap.get(key)
    const sets = (latestSetsRef.current.get(key) ?? effectiveSets(ex, entry)).map(s => ({ ...s }))
    const presc = resolvePresc(ex, entry, sets.length)
    sets.push({ reps: presc.reps, tempo: presc.tempo, weight: '' })
    persistEntrySets(athlete, ex, sets)
  }

  function removeInlineSet(athlete: Athlete, ex: Exercise) {
    const key = entryKey(ex.id, athlete.id)
    const sets = (latestSetsRef.current.get(key) ?? effectiveSets(ex, entryMap.get(key))).map(s => ({ ...s }))
    if (sets.length <= 1) return
    sets.pop()
    persistEntrySets(athlete, ex, sets)
  }

  // Zapis pojedynczego pola wpisu (ból/komentarz) wprost z tabeli — upsert tylko tej kolumny,
  // pozostałe (serie itd.) zostają nietknięte.
  async function saveEntryMeta(athlete: Athlete, ex: Exercise, patch: Record<string, any>) {
    const key = entryKey(ex.id, athlete.id)
    const current = entryMap.get(key)
    // Upsert nadpisuje CAŁY wiersz, nie tylko podane kolumny — trzeba jawnie
    // przepisać resztę pól (serie itd.), inaczej znikają przy każdym drobnym
    // zapisie (np. ból/notatka/wykluczenie z ćwiczenia kasowałoby ciężary).
    const payload = {
      training_id: training.id, exercise_id: ex.id, athlete_id: athlete.id,
      sets: latestSetsRef.current.get(key) ?? current?.sets ?? [],
      pain: current?.pain ?? false,
      pain_vas: current?.pain_vas ?? null,
      pain_comment: current?.pain_comment ?? null,
      comment: current?.comment ?? null,
      exercise_override: current?.exercise_override ?? null,
      bodyweight: current?.bodyweight ?? false,
      excluded: current?.excluded ?? false,
      ...patch,
      updated_at: new Date().toISOString(),
    }
    // "excluded" jest tu też dopisywane tylko defensywnie, gdy patch dotyczy
    // czegoś innego (ból/notatka/modyfikacja) — w tym wypadku brak migracji nie
    // powinien blokować zapisu tamtej rzeczy, więc próbujemy bez tej kolumny.
    let { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(payload, { onConflict: 'exercise_id,athlete_id' })
      .select()
      .single()
    if (err && !('excluded' in patch) && /'excluded'/.test(err.message)) {
      const { excluded, ...rest } = payload
      ;({ data, error: err } = await supabase
        .from('group_training_entries')
        .upsert(rest, { onConflict: 'exercise_id,athlete_id' })
        .select()
        .single())
    }
    if (err || !data) {
      const msg = err?.message || ''
      setError('pain' in patch && /'pain'/.test(msg)
        ? 'Aby oznaczać ból w tabeli, uruchom migrację 202606200002 (kolumna pain).'
        : 'excluded' in patch && /'excluded'/.test(msg)
        ? 'Aby wykluczać z pojedynczego ćwiczenia, uruchom migrację 202609150003.'
        : (msg || 'Błąd zapisu'))
      return
    }
    setEntryMap(prev => { const next = new Map(prev); next.set(key, data as Entry); return next })
  }

  function saveInlineComment(athlete: Athlete, ex: Exercise, value: string) {
    const key = entryKey(ex.id, athlete.id)
    const val = value.trim() || null
    if ((entryMap.get(key)?.comment ?? null) === val) return
    saveEntryMeta(athlete, ex, { comment: val })
  }

  async function handleDeleteExercise(ex: Exercise) {
    if (!confirm(`Usunąć ćwiczenie „${ex.name}” i wszystkie wpisane do niego serie?`)) return
    const { error: err } = await supabase.from('group_training_exercises').delete().eq('id', ex.id)
    if (err) { setError(err.message); return }
    setExercises(prev => prev.filter(e => e.id !== ex.id))
    setEntryMap(prev => {
      const next = new Map(prev)
      for (const key of Array.from(next.keys())) {
        if (key.startsWith(`${ex.id}_`)) next.delete(key)
      }
      return next
    })
  }

  async function handleDateChange(newDate: string) {
    if (!newDate) return
    const prev = trainingDate
    setTrainingDate(newDate)
    const { error: err } = await supabase
      .from('group_trainings')
      .update({ training_date: newDate })
      .eq('id', training.id)
    if (err) {
      setTrainingDate(prev)
      setError(err.message.includes('duplicate') || err.message.includes('unique')
        ? 'Istnieje już trening z tą datą.'
        : err.message)
    }
  }

  // Skopiuj listę ćwiczeń z ostatniego wcześniejszego treningu tej grupy
  // ── Eksport PDF: każdy blok na osobnej stronie, tylko obecne zawodniczki ──
  const [exportingPdf, setExportingPdf] = useState(false)

  // Zawartość komórki w PDF — zwięźle, żeby wszystkie zawodniczki zmieściły się
  // na stronie: "40 / 40 / x kg", pod spodem zamiana ćwiczenia, ból, notatka.
  function pdfCellText(ex: Exercise, entry: Entry | null | undefined): string {
    if (entry?.excluded) return 'nie robi'
    const repsMode = isMaxReps(resolvePresc(ex, entry).reps) || !!entry?.bodyweight || !!ex.bodyweight
    const vals = effectiveSets(ex, entry).map(s => s.skipped ? 'x'
      : repsMode ? (s.reps && !isMaxReps(s.reps) ? s.reps : '-')
      : (s.weight || '-'))
    const filled = vals.some(v => v !== '-' && v !== 'x')
    const lines = [vals.join(' / ') + (filled ? (repsMode ? ' powt.' : ' kg') : '')]
    if (entry?.exercise_override) lines.push(`> ${entry.exercise_override}`)
    if (entry?.pain || entry?.pain_vas != null) lines.push(`! bol${entry.pain_vas != null ? ` ${entry.pain_vas}/10` : ''}${entry.pain_comment ? `: ${entry.pain_comment}` : ''}`)
    if (entry?.comment) lines.push(`"${entry.comment}"`)
    return pl(lines.join('\n'))
  }

  // Rozpiska do nagłówka kolumny w PDF: "3 serie x 8/8/6 powt.  |  tempo 4141"
  // albo dla ISO "2 serie x 45/60 s  |  @70%  |  HIMA".
  function pdfPrescText(ex: Exercise): string {
    const n = planSetCount(ex)
    const series = `${n} ${n === 1 ? 'seria' : n < 5 ? 'serie' : 'serii'}`
    const parts: string[] = []
    if (ex.iso) {
      const secs = joinPerSet(planValues(ex, 'iso_seconds'))
      parts.push(secs ? `${series} x ${secs} s` : series)
      const intensity = joinPerSet(planValues(ex, 'iso_intensity'), '%')
      if (ex.iso_type !== 'HIMA' && intensity) parts.push(`@${intensity}`)
      if (ex.iso_type) parts.push(ex.iso_type)
    } else {
      const reps = joinPerSet(planValues(ex, 'reps'))
      parts.push(reps ? `${series} x ${reps} powt.` : series)
      const tempo = joinPerSet(planValues(ex, 'tempo'))
      if (tempo) parts.push(`tempo ${tempo}`)
    }
    return pl(parts.join('  |  '))
  }

  async function exportTrainingPdf() {
    if (exportingPdf || sortedExercises.length === 0) return
    setExportingPdf(true)
    try {
      const { jsPDF, autoTable } = await loadPdf()
      const NAVY: [number, number, number] = [13, 27, 42]
      const GOLD: [number, number, number] = [245, 200, 66]
      // modyfikacja ćwiczenia — jak na ekranie (#7c3aed na jasnofioletowym tle)
      const PURPLE: [number, number, number] = [124, 58, 237]
      const PURPLE_BG: [number, number, number] = [243, 236, 253]
      const MARGIN = 8
      const NAME_W = 34
      const present = orderedAthletes.filter(r => !r.absent).map(r => r.athlete)
      const lineH = (pt: number) => pt * 0.3528 * 1.15

      // Rysuje stronę jednego bloku z danym rozmiarem czcionki; true = zmieściła się na 1 stronie.
      function drawBlockPage(doc: any, block: (typeof blocks)[number], fs: number): boolean {
        const startPage = doc.getNumberOfPages()
        const startY = drawHeaderBar(doc, group.name, `Trening - Blok ${block.letter}`, `${formatDatePl(trainingDate)} - ${trainingDate}`)
        const pageW = doc.internal.pageSize.getWidth()
        const colW = (pageW - 2 * MARGIN - NAME_W) / block.exercises.length
        const pad = 2
        const pillW = 7 + fs * 0.35, pillH = lineH(fs + 1) + 1
        const nameFs = fs + 1.5, prescFs = fs

        // Wysokość nagłówka: nazwa (zawijana obok etykiety A1) + rozpiska pod spodem
        const headLayout = block.exercises.map(ex => {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(nameFs)
          const nameLines = doc.splitTextToSize(pl(ex.name || 'Bez nazwy'), colW - 3 * pad - pillW)
          doc.setFont('helvetica', 'normal'); doc.setFontSize(prescFs)
          const prescLines = doc.splitTextToSize(pdfPrescText(ex), colW - 2 * pad)
          const nameH = Math.max(pillH, nameLines.length * lineH(nameFs))
          return { nameLines, prescLines, nameH, height: pad + nameH + 1.6 + prescLines.length * lineH(prescFs) + pad }
        })
        const headH = Math.max(...headLayout.map(h => h.height))

        autoTable(doc, {
          startY,
          margin: { left: MARGIN, right: MARGIN, bottom: 10 },
          head: [['Zawodniczka', ...block.exercises.map(() => '')]],
          body: present.map(a => [pl(a.full_name), ...block.exercises.map(ex => pdfCellText(ex, entryMap.get(entryKey(ex.id, a.id))))]),
          ...TABLE_STYLES,
          styles: { ...TABLE_STYLES.styles, fontSize: fs, cellPadding: Math.max(0.8, fs * 0.2), valign: 'top', overflow: 'linebreak' },
          headStyles: { ...TABLE_STYLES.headStyles, fontSize: fs, minCellHeight: headH, valign: 'middle' },
          columnStyles: Object.fromEntries([[0, { halign: 'left', fontStyle: 'bold', cellWidth: NAME_W }], ...block.exercises.map((_, i) => [i + 1, { cellWidth: colW }])]),
          didParseCell: (data: any) => {
            if (data.section !== 'body' || data.column.index === 0) return
            const text = String(data.cell.raw || '')
            if (text === 'nie robi') data.cell.styles.textColor = [160, 165, 175]
            else if (/^> /m.test(text)) data.cell.styles.fillColor = PURPLE_BG
            else if (/^! bol/m.test(text)) data.cell.styles.fillColor = [254, 242, 242]
          },
          // Linie modyfikacji ćwiczenia („> ...", także zawinięte) rysujemy na fioletowo:
          // autoTable ma jeden kolor na komórkę, więc tu je wygaszamy, a w didDrawCell dorysowujemy.
          willDrawCell: (data: any) => {
            if (data.section !== 'body' || data.column.index === 0) return
            const cell = data.cell
            if (!cell.purple) {
              const lines: string[] = cell.text
              const from = lines.findIndex(l => l.startsWith('> '))
              if (from < 0) return
              let to = from + 1
              while (to < lines.length && !lines[to].startsWith('! bol') && !lines[to].startsWith('"')) to++
              cell.purple = { from, lines: lines.slice(from, to) }
              cell.text = lines.map((l, i) => i >= from && i < to ? '' : l)
            }
          },
          didDrawCell: (data: any) => {
            if (data.section === 'body') {
              const p = data.cell.purple
              if (!p) return
              // ta sama geometria co autoTableText (wyrównanie do góry, interlinia 1.15)
              const fsMm = data.cell.styles.fontSize / doc.internal.scaleFactor
              const pos = data.cell.getTextPos()
              doc.setFont('helvetica', 'normal'); doc.setFontSize(data.cell.styles.fontSize); doc.setTextColor(...PURPLE)
              p.lines.forEach((l: string, k: number) => doc.text(l, pos.x, pos.y + fsMm * (2 - 1.15) + (p.from + k) * fsMm * 1.15))
              doc.setTextColor(0, 0, 0)
              return
            }
            // Nagłówek ćwiczenia rysowany ręcznie: złota etykieta A1, nazwa, rozpiska
            if (data.column.index === 0) return
            const i = data.column.index - 1
            const ex = block.exercises[i], hl = headLayout[i]
            const { x, y } = data.cell
            doc.setFillColor(...GOLD)
            doc.roundedRect(x + pad, y + pad, pillW, pillH, 0.8, 0.8, 'F')
            doc.setFont('helvetica', 'bold'); doc.setFontSize(fs + 0.5); doc.setTextColor(...NAVY)
            doc.text(exerciseLabel.get(ex.id) ?? '', x + pad + pillW / 2, y + pad + pillH / 2, { align: 'center', baseline: 'middle' })
            doc.setFontSize(nameFs); doc.setTextColor(255, 255, 255)
            doc.text(hl.nameLines, x + 2 * pad + pillW, y + pad + (hl.nameLines.length === 1 ? (pillH - lineH(nameFs)) / 2 : 0), { baseline: 'top', lineHeightFactor: 1.15 })
            doc.setFont('helvetica', 'normal'); doc.setFontSize(prescFs); doc.setTextColor(...GOLD)
            doc.text(hl.prescLines, x + pad, y + pad + hl.nameH + 1.6, { baseline: 'top', lineHeightFactor: 1.15 })
            doc.setTextColor(0, 0, 0)
          },
          didDrawPage: () => drawFooter(doc),
        })
        return doc.getNumberOfPages() === startPage
      }

      // Największa czcionka, przy której blok mieści się na jednej stronie
      function fitFontSize(block: (typeof blocks)[number]): number {
        for (let fs = 8.5; fs > 4; fs -= 0.5) {
          const probe = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
          if (drawBlockPage(probe, block, fs)) return fs
        }
        return 4
      }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      blocks.forEach((block, bi) => {
        if (bi > 0) doc.addPage()
        drawBlockPage(doc, block, fitFontSize(block))
      })

      // Plany indywidualne — osobna strona, tabelka na zawodniczkę
      const individuals = athletes.filter(a => individualIds.has(a.id))
        .map(person => ({ person, own: exercises.filter(e => e.athlete_id === person.id).sort((a, b) => a.exercise_order - b.exercise_order || a.id - b.id) }))
        .filter(x => x.own.length > 0)
      if (individuals.length) {
        doc.addPage()
        let y = drawHeaderBar(doc, group.name, 'Plany indywidualne', `${formatDatePl(trainingDate)} - ${trainingDate}`)
        for (const { person, own } of individuals) {
          autoTable(doc, {
            startY: y,
            margin: { left: MARGIN, right: MARGIN, bottom: 10 },
            head: [[{ content: pl(person.full_name), colSpan: own.length, styles: { halign: 'left', fontSize: 9 } }],
              own.map(ex => pl(`${ex.name || 'Bez nazwy'}\n`) + pdfPrescText(ex))],
            body: [own.map(ex => pdfCellText(ex, entryMap.get(entryKey(ex.id, person.id))))],
            ...TABLE_STYLES,
            styles: { ...TABLE_STYLES.styles, fontSize: 7.5, valign: 'top' },
            didDrawPage: () => drawFooter(doc),
          })
          y = (doc as any).lastAutoTable.finalY + 6
        }
      }

      doc.save(`trening_${pl(group.name).replace(/\s+/g, '_')}_${trainingDate}.pdf`)
    } catch (e: any) {
      setError(`Nie udało się wygenerować PDF: ${e?.message || e}`)
    } finally {
      setExportingPdf(false)
    }
  }

  async function handleCopyFromPrevious() {
    setCopying(true); setError('')
    const { data: prevTraining } = await supabase
      .from('group_trainings')
      .select('id, training_date')
      .eq('group_id', group.id)
      .neq('id', training.id)
      .lt('training_date', trainingDate)
      .order('training_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!prevTraining) { setError('Brak wcześniejszego treningu do skopiowania.'); setCopying(false); return }
    const { data: prevExercises } = await supabase
      .from('group_training_exercises')
      .select('*')
      .eq('training_id', prevTraining.id)
      .order('exercise_order', { ascending: true })
    if (!prevExercises || prevExercises.length === 0) { setError('Poprzedni trening nie miał ćwiczeń.'); setCopying(false); return }
    const { data: inserted, error: err } = await supabase
      .from('group_training_exercises')
      .insert(prevExercises.map((e: any) => ({
        training_id: training.id,
        name: e.name,
        exercise_order: e.exercise_order,
        ...(e.block_index ? { block_index: e.block_index } : {}),
        sets_planned: e.sets_planned ?? null,
        reps: e.reps ?? null,
        tempo: e.tempo ?? null,
      })))
      .select()
    setCopying(false)
    if (err || !inserted) { setError(err?.message || 'Błąd kopiowania'); return }
    setExercises(prev => [...prev, ...(inserted as Exercise[])])
  }

  return (
    <>
      <style>{`
        .gt-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; }
        .gt-table th, .gt-table td { border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); vertical-align: top; }
        .gt-table tbody tr:last-child td { border-bottom: none; }
        .gt-sticky { position: sticky; left: 0; z-index: 2; background: #ffffff; box-shadow: 3px 0 8px rgba(13,27,42,0.05); }
        .gt-table thead th { position: sticky; top: 0; z-index: 4; box-shadow: 0 2px 6px rgba(13,27,42,0.05); }
        .gt-table thead th.gt-sticky { z-index: 5; }
        .gt-table thead tr.gt-ex-row th { top: 30px; }
        .gt-table th.gt-block-start, .gt-table td.gt-block-start { border-left: 2px solid var(--navy-900); }
        .gt-row td { transition: background 0.12s ease; }
        .gt-row:nth-child(even) td, .gt-row:nth-child(even) .gt-sticky { background: #FBFCFE; }
        .gt-row:hover td, .gt-row:hover .gt-sticky { background: #EFF4FB; }
        .gt-w { width: 38px; border: 1.5px solid #DBE2EB; border-radius: 6px; background: #FAFBFC; font-family: var(--font-inter), sans-serif; font-size: 0.68rem; color: var(--navy-900); padding: 0.24rem 0.15rem; outline: none; text-align: center; transition: border-color 0.12s, background 0.12s; }
        .gt-w.filled { border-color: var(--border); background: #ffffff; }
        .gt-w:focus { border-color: var(--gold); background: #ffffff; }
        .gt-ex-drag { opacity: 0; transition: opacity .15s ease; }
        .gt-ex-header:hover .gt-ex-drag { opacity: 1; }
      `}</style>
      <SetPageMeta title="Trening" sidebarCollapsible />
      <div className="coach-content" style={{ minHeight: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="coach-sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Pokaż menu' : 'Zwiń menu — więcej miejsca na siatkę'}
              style={{ flexShrink: 0, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid var(--border)`, background: '#ffffff', color: 'var(--muted)', borderRadius: 7, outline: 'none' }}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
            <h1 style={{ color: 'var(--ink)', fontSize: '1.15rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-inter), sans-serif' }}>
              Trening · {formatDatePl(trainingDate)}
            </h1>
            <button
              onClick={() => setHelpOpen(v => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--muted)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.74rem', fontWeight: 600, padding: 0 }}
            >
              <Info size={12} /> Jak to działa?
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="small" onClick={() => router.push(`/coach/groups/${group.id}/readiness`)}>
              <CheckSquare size={13} /> Gotowość treningowa
            </Button>
            <Button variant="ghost" size="small" onClick={() => router.push(`/coach/groups/${group.id}/feedback`)}>
              <MessageCircle size={13} /> Feedback po treningu
            </Button>
            <Button variant="dark" size="small" onClick={exportTrainingPdf} disabled={exportingPdf || sortedExercises.length === 0} style={{ color: 'var(--gold)' }}>
              <Download size={13} /> {exportingPdf ? 'Generuję...' : 'PDF'}
            </Button>
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '11px', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Data</span>
            <input
              type="date"
              value={trainingDate}
              onChange={e => handleDateChange(e.target.value)}
              style={{ border: '1px solid var(--border)', background: '#ffffff', color: 'var(--ink)', borderRadius: 8, padding: '7px 10px', fontFamily: 'var(--font-inter), sans-serif', fontSize: '13px', outline: 'none' }}
            />
          </div>
        </div>
        {helpOpen && (
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: 0, maxWidth: 900, fontFamily: 'var(--font-inter), sans-serif' }}>
            W nagłówku kolumny: serie, powtórzenia i tempo dla całej grupy. Przeciągnij ⠿, by zmienić kolejność. „BW" wpisuje 0 (masa ciała) w ciężar wszystkim, „P" przełącza kolumnę na wpisywanie powtórzeń zamiast kg. W wierszu zawodniczki wpisujesz ciężar, „+ ból"/„+ notatka" dają szybki wpis bez ✎. Kliknij numer serii (S1, S2…), by oznaczyć „nie zrobiła", a ✕ przy nazwisku wykreśla nieobecną. W polu z ciężarem: ← / → przechodzi między seriami (i ćwiczeniami), Enter — do tej samej serii u zawodniczki poniżej. Mały ⊘ przy komórce wyklucza jedną zawodniczkę z tego jednego ćwiczenia. Ikona osoby przy nazwisku przenosi ją do odrębnego planu indywidualnego. Ćwiczenia grupujesz w bloki (A, B, C…): „+ Ćwiczenie" dodaje do ostatniego bloku, „+ Nowy blok" zaczyna kolejny, a « przy nazwie bloku zwija go w wąski pasek (» rozwija).
          </p>
        )}

        {error && (
          <div style={{ padding: '0.75rem', background: '#fdedec', border: '1.5px solid #c23b3b', borderRadius: 10, color: '#c23b3b', fontWeight: 700, fontSize: '0.86rem', fontFamily: 'var(--font-inter), sans-serif' }}>
            ❌ {error}
          </div>
        )}

        {athletes.length === 0 ? (
          <div style={{ background: '#ffffff', border: `1.5px solid var(--border)`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: 'var(--muted-light)', fontFamily: 'var(--font-inter), sans-serif' }}>
            Brak zawodniczek w grupie — najpierw dodaj zawodniczki z panelu grupy.
          </div>
        ) : (
          <>
            {exercises.length === 0 && (
              <Button
                variant="ghost"
                onClick={handleCopyFromPrevious}
                disabled={copying}
                style={{ alignSelf: 'flex-start', border: '1.5px dashed var(--muted-light)', color: 'var(--navy-900)' }}
              >
                {copying ? 'Kopiuję...' : '⧉ Skopiuj ćwiczenia z poprzedniego treningu'}
              </Button>
            )}

              <div ref={boardWrapRef} className="coach-attendance-grid-wrap" style={{ background: '#ffffff', overflow: 'auto', flex: '1 1 auto', minHeight: 260, boxShadow: 'var(--shadow)' }}>
                <table className="gt-table">
                  <thead>
                    {/* Wiersz bloków: „Blok A" nad ćwiczeniami bloku, zwinięty blok = wąski pasek */}
                    <tr className="gt-block-row">
                      <th rowSpan={2} className="gt-sticky" style={{ width: 165, minWidth: 165, maxWidth: 165, padding: '0.55rem 0.5rem', textAlign: 'left', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--bg)', zIndex: 5 }}>
                        Zawodniczka
                      </th>
                      {blocks.map(b => collapsedBlocks.has(b.index) ? (
                        <th key={b.index} rowSpan={2} className="gt-block-start" style={{ width: 40, minWidth: 40, maxWidth: 40, padding: '0.4rem 0', background: 'var(--navy-900)', verticalAlign: 'top' }}>
                          <button
                            onClick={() => toggleBlockCollapsed(b.index)}
                            title={`Rozwiń blok ${b.letter}`}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'none', color: 'var(--gold)', padding: 0, outline: 'none' }}
                          >
                            <ChevronsRight size={14} />
                            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.9rem', fontWeight: 800 }}>{b.letter}</span>
                            <span style={{ writingMode: 'vertical-rl', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.6rem', fontWeight: 700, color: '#aeb7cc', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                              {b.exercises.map(ex => exerciseLabel.get(ex.id)).join(' · ')}
                            </span>
                          </button>
                        </th>
                      ) : (
                        <th key={b.index} colSpan={b.exercises.length} className="gt-block-start" style={{ height: 30, padding: '0 0.5rem', background: 'var(--navy-900)', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', left: 173, width: 'max-content' }}>
                            <button
                              onClick={() => toggleBlockCollapsed(b.index)}
                              title={`Zwiń blok ${b.letter}`}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, border: 'none', borderRadius: 5, background: 'rgba(255,255,255,0.08)', color: 'var(--gold)', padding: 0, outline: 'none' }}
                            >
                              <ChevronsLeft size={13} />
                            </button>
                            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.74rem', fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.04em' }}>Blok {b.letter}</span>
                            <button
                              onClick={() => handleAddExercise(b.index)}
                              title={`Dodaj ćwiczenie do bloku ${b.letter}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', borderRadius: 5, background: 'rgba(255,255,255,0.08)', color: '#ffffff', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.6rem', fontWeight: 700, padding: '3px 7px', outline: 'none' }}
                            >
                              <Plus size={10} /> ćwiczenie
                            </button>
                          </div>
                        </th>
                      ))}
                      <th rowSpan={2} style={{ width: 92, minWidth: 92, padding: '0.4rem 0.35rem', background: 'var(--bg)', border: 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <button
                            onClick={() => handleAddExercise()}
                            title={blocks.length ? `Dodaj ćwiczenie do bloku ${blocks[blocks.length - 1].letter}` : 'Dodaj ćwiczenie'}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', minHeight: 34, border: `1.5px dashed var(--muted-light)`, borderRadius: 8, background: '#ffffff', color: 'var(--navy-900)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', fontWeight: 700, outline: 'none' }}
                          >
                            <Plus size={12} /> Ćwiczenie
                          </button>
                          {blocks.length > 0 && (
                            <button
                              onClick={() => handleAddExercise(lastBlockIndex + 1)}
                              title={`Rozpocznij blok ${blockLetter(blocks.length)}`}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', minHeight: 34, border: 'none', borderRadius: 8, background: 'var(--navy-900)', color: 'var(--gold)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', fontWeight: 700, outline: 'none' }}
                            >
                              <Plus size={12} /> Nowy blok
                            </button>
                          )}
                        </div>
                      </th>
                      {/* Wypełniacz — nie pozwala kolumnom ćwiczeń rozciągać się na cały ekran */}
                      <th rowSpan={2} style={{ width: '100%', background: 'var(--bg)', border: 'none' }} />
                    </tr>
                    <tr className="gt-ex-row">
                      {boardColumns.map(col => {
                        if (col.kind !== 'ex') return null
                        const ex = col.ex
                        return (
                          <th
                            key={ex.id}
                            className={`gt-ex-header${col.blockStart ? ' gt-block-start' : ''}`}
                            onDragOver={e => { if (dragExId.current != null) { e.preventDefault(); if (dragOverExId !== ex.id) setDragOverExId(ex.id) } }}
                            onDrop={e => { e.preventDefault(); reorderExercise(ex.id) }}
                            style={{ width: 336, minWidth: 336, maxWidth: 336, padding: '0.35rem 0.5rem', background: 'var(--bg)', boxShadow: dragOverExId === ex.id ? `inset 3px 0 0 var(--gold)` : undefined }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span
                                draggable
                                onDragStart={e => { dragExId.current = ex.id; e.dataTransfer.effectAllowed = 'move' }}
                                onDragEnd={() => { dragExId.current = null; setDragOverExId(null) }}
                                title="Przeciągnij, by zmienić kolejność ćwiczeń"
                                className="gt-ex-drag"
                                style={{ cursor: 'grab', color: 'var(--muted-light)', fontSize: '0.82rem', lineHeight: 1, flexShrink: 0, padding: '0 1px', userSelect: 'none' }}
                              >
                                ⠿
                              </span>
                              <span style={{ flexShrink: 0, minWidth: 26, textAlign: 'center', borderRadius: 6, background: 'var(--navy-900)', color: 'var(--gold)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.66rem', fontWeight: 800, padding: '3px 5px', lineHeight: 1 }}>
                                {exerciseLabel.get(ex.id)}
                              </span>
                              <input
                                ref={el => { if (el) nameInputRefs.current.set(ex.id, el); else nameInputRefs.current.delete(ex.id) }}
                                value={ex.name}
                                onChange={e => handleExerciseField(ex.id, 'name', e.target.value)}
                                onBlur={e => {
                                  e.target.style.background = 'transparent'
                                  e.target.style.borderColor = 'transparent'
                                  persistExercise(ex.id)
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                placeholder="nazwa ćwiczenia"
                                style={{ flex: 1, minWidth: 0, border: `1.5px solid transparent`, borderRadius: 7, background: 'transparent', fontWeight: 800, fontSize: '0.86rem', color: 'var(--navy-900)', padding: '0.2rem 0.3rem', outline: 'none', fontFamily: 'var(--font-inter), sans-serif' }}
                                onFocus={e => { e.target.style.background = '#ffffff'; e.target.style.borderColor = 'var(--gold)' }}
                              />
                              <button
                                onClick={() => handleDeleteExercise(ex)}
                                title="Usuń ćwiczenie"
                                style={{ flexShrink: 0, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid var(--border)`, background: '#ffffff', color: 'var(--muted-light)', borderRadius: 7, outline: 'none' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {/* Rozpiska dla całej grupy — tabelka serii: powt./tempo, dla ISO czas (+ intensywność przy PIMA) */}
                            <SetPlanTable ex={ex} onChange={(i, field, v) => handlePlanCell(ex.id, i, field, v)} onCommit={() => persistExercise(ex.id)} onAdd={() => addPlanRow(ex.id)} onRemove={i => removePlanRow(ex.id, i)} />
                            <div style={{ display: 'flex', gap: 4, rowGap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                              {!ex.bodyweight && (
                                <button
                                  onClick={() => fillColumnBodyweight(ex)}
                                  title="Wpisz 0 (masa ciała) w ciężar wszystkim zawodniczkom"
                                  style={headerPill(false)}
                                >
                                  BW
                                </button>
                              )}
                              <button
                                onClick={() => toggleExerciseBodyweight(ex.id)}
                                title={ex.bodyweight ? 'Tryb powtórzeń włączony — kliknij, by wrócić do kg' : 'Cała kolumna: wpisuj powtórzenia zamiast kg'}
                                style={headerPill(!!ex.bodyweight)}
                              >
                                Powtórzenia
                              </button>
                              <button
                                onClick={() => toggleIndividual(ex.id)}
                                title={ex.individual ? 'Tryb indywidualny — dane liczone z wierszy zawodniczek (kliknij, by wrócić do grupowego)' : 'Tryb indywidualny: serie/powt./tempo różne per zawodniczka, nagłówek może być pusty'}
                                style={headerPill(!!ex.individual)}
                              >
                                Indywidualnie
                              </button>
                              <button
                                onClick={() => toggleIso(ex.id)}
                                title={ex.iso ? 'Ćwiczenie izometryczne — kliknij, by wrócić do serie/powt./tempo' : 'Oznacz jako ćwiczenie izometryczne (PIMA/HIMA)'}
                                style={isoPill(!!ex.iso)}
                              >
                                ISO
                              </button>
                              {ex.iso && (
                                <>
                                  <button onClick={() => setIsoType(ex.id, 'PIMA')} title="PIMA — z intensywnością" style={isoPill(ex.iso_type === 'PIMA')}>PIMA</button>
                                  <button onClick={() => setIsoType(ex.id, 'HIMA')} title="HIMA — bez intensywności" style={isoPill(ex.iso_type === 'HIMA')}>HIMA</button>
                                </>
                              )}
                            </div>
                            {(isMaxReps(ex.reps) || ex.bodyweight) && (
                              <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, color: '#854F0B', background: '#FEF6E0', border: '1px solid #F7D27A', borderRadius: 6, padding: '2px 5px', marginTop: 4, textAlign: 'center' }}>
                                {ex.bodyweight ? '↓ masa własna — wpisuj powt.' : '↓ wpisuj wykonane powt.'}
                              </div>
                            )}
                            {ex.individual && (
                              <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, color: '#854F0B', background: '#FEF6E0', border: '1px solid #F7D27A', borderRadius: 6, padding: '2px 5px', marginTop: 4, textAlign: 'center' }}>
                                tryb indywidualny — dane z zawodniczek
                              </div>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {orderedAthletes.map(({ athlete, absent }, rowIdx) => (
                      <tr key={athlete.id} className="gt-row">
                        <td className="gt-sticky" style={{ padding: '0.4rem 0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: avatarBg(athlete.full_name), color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', fontWeight: 700, opacity: absent ? 0.4 : 1 }}>
                              {athlete.full_name.charAt(0).toUpperCase()}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 108, textDecoration: absent ? 'line-through' : 'none', color: absent ? 'var(--muted-light)' : 'var(--navy-900)' }}>
                              {athlete.full_name}
                            </span>
                            <button
                              onClick={() => toggleIndividualAthlete(athlete.id)}
                              title="Trening indywidualny — inne ćwiczenia niż grupa"
                              style={{ flexShrink: 0, width: 16, height: 16, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: 'var(--muted-light)' }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={11} height={11}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /><path d="m17 3 2 2-2 2" /></svg>
                            </button>
                            <button
                              onClick={() => toggleAbsent(athlete.id)}
                              title={absent ? 'Przywróć na trening' : 'Wykreśl z treningu (nieobecna)'}
                              style={{ flexShrink: 0, width: 16, height: 16, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: absent ? '#92600A' : 'var(--muted-light)', fontSize: '0.62rem', lineHeight: 1 }}
                            >
                              {absent ? '↩' : '✕'}
                            </button>
                          </div>
                        </td>
                        {boardColumns.map(col => {
                          if (col.kind === 'collapsed') {
                            return <td key={`block-${col.block.index}`} className="gt-block-start" style={{ background: 'var(--bg)', width: 40, minWidth: 40, maxWidth: 40 }} />
                          }
                          const { ex, exIdx } = col
                          const entry = entryMap.get(entryKey(ex.id, athlete.id)) || null
                          const sets = effectiveSets(ex, entry)
                          // Tryb powtórzeń: „P" kolumny, „max" z rozpiski, albo „bez ciężaru"
                          // ustawione tej zawodniczce w szczegółach.
                          const repsMode = isMaxReps(resolvePresc(ex, entry).reps) || !!entry?.bodyweight || !!ex.bodyweight
                          const excluded = !!entry?.excluded
                          return (
                            <td key={ex.id} className={col.blockStart ? 'gt-block-start' : undefined} style={{ padding: '0.35rem 0.4rem', ...(entry?.exercise_override ? { background: '#F7F2FE' } : {}), ...(absent || excluded ? { opacity: 0.35, pointerEvents: 'none' as const } : {}) }}>
                              <button
                                onClick={() => toggleExcludeFromExercise(athlete, ex)}
                                title={excluded ? 'Przywróć do tego ćwiczenia' : 'Ta zawodniczka nie robi tego ćwiczenia'}
                                style={{ pointerEvents: 'auto', float: 'right', width: 16, height: 16, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: `1px solid ${excluded ? '#c23b3b' : 'var(--border)'}`, background: excluded ? '#c23b3b' : '#ffffff', color: excluded ? '#ffffff' : 'var(--muted-light)', marginLeft: 4 }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={10} height={10}><circle cx="12" cy="12" r="9" /><path d="m5 19 14-14" /></svg>
                              </button>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap', width: 260 }}>
                                {sets.map((s, i) => {
                                  // W trybie powtórzeń pokazujemy wpisane powt.; odziedziczone „max”
                                  // z rozpiski traktujemy jak puste (jeszcze nie wpisano wyniku).
                                  const repsPerf = s.reps && !isMaxReps(s.reps) ? s.reps : ''
                                  const cellVal = repsMode ? repsPerf : (s.weight || '')
                                  return (
                                    <div key={`${ex.id}_${athlete.id}_${i}_${s.skipped ? 'x' : cellVal}`}>
                                      <button
                                        onClick={() => toggleSkipInline(athlete, ex, i)}
                                        title={s.skipped ? 'Seria nie zrobiona — kliknij, by cofnąć' : 'Oznacz: nie zrobiła tej serii'}
                                        style={{ display: 'block', width: '100%', border: 'none', background: 'none', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', color: s.skipped ? '#c23b3b' : 'var(--muted-light)', textAlign: 'center', marginBottom: 1, letterSpacing: '0.03em', textDecoration: s.skipped ? 'line-through' : 'none', padding: 0 }}
                                      >
                                        S{i + 1}{ex.iso && isoSetTimes(ex)[i] != null ? ` · ${isoSetTimes(ex)[i]}s` : ''}
                                      </button>
                                      {s.skipped ? (
                                        <button
                                          onClick={() => toggleSkipInline(athlete, ex, i)}
                                          title="Nie zrobiła tej serii (kliknij, by cofnąć)"
                                          style={{ width: 44, border: '1.5px solid #F4B5B5', borderRadius: 7, background: '#FDEDED', color: '#c23b3b', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0', lineHeight: 1 }}
                                        >
                                          ✕
                                        </button>
                                      ) : (
                                        <input
                                          defaultValue={cellVal}
                                          placeholder={repsMode ? 'powt.' : 'kg'}
                                          onBlur={e => saveInlineField(athlete, ex, i, repsMode ? 'reps' : 'weight', e.target.value)}
                                          onKeyDown={e => handleSetNavKeyDown(e, athlete, ex, exIdx, rowIdx, i, repsMode ? 'reps' : 'weight')}
                                          className={`gt-w${cellVal ? ' filled' : ''}`}
                                          data-set-nav="1"
                                          data-ex-idx={exIdx}
                                          data-row-idx={rowIdx}
                                          data-set-idx={i}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                                <button
                                  onClick={() => addInlineSet(athlete, ex)}
                                  title="Dodaj serię tej zawodniczce"
                                  style={qiBtn}
                                >
                                  <Plus size={12} />
                                </button>
                                {sets.length > 1 && (
                                  <button
                                    onClick={() => removeInlineSet(athlete, ex)}
                                    title="Usuń ostatnią serię tej zawodniczce"
                                    style={{ ...qiBtn, fontSize: '0.82rem', fontWeight: 800 }}
                                  >
                                    －
                                  </button>
                                )}
                                {(() => {
                                  const painActive = !!entry?.pain || entry?.pain_vas != null
                                  const severe = entry?.pain_vas != null && entry.pain_vas >= 5
                                  const key = entryKey(ex.id, athlete.id)
                                  return (
                                    <button
                                      onClick={() => setCellEdit(prev => prev?.key === key && prev.type === 'pain' ? null : { key, type: 'pain' })}
                                      title={painActive ? `Ból${entry?.pain_vas != null ? ` ${entry.pain_vas}/10` : ''}${entry?.pain_comment ? `: ${entry.pain_comment}` : ''}` : 'Zaznacz ból'}
                                      style={painActive
                                        ? { ...qiBtn, border: `1.5px solid ${severe ? '#c23b3b' : '#c07f1e'}`, background: severe ? '#FDEDED' : '#FEF6E0', color: severe ? '#c23b3b' : '#92600A' }
                                        : qiBtn}
                                    >
                                      <AlertTriangle size={11} />
                                    </button>
                                  )
                                })()}
                                <button
                                  onClick={() => { const key = entryKey(ex.id, athlete.id); setCellEdit(prev => prev?.key === key && prev.type === 'note' ? null : { key, type: 'note' }) }}
                                  title={entry?.comment || 'Dodaj notatkę'}
                                  style={entry?.comment ? { ...qiBtn, border: '1.5px solid #2c5aa3', background: '#eaf1fb', color: '#2c5aa3' } : qiBtn}
                                >
                                  <MessageCircle size={11} />
                                </button>
                                <button
                                  onClick={() => { const key = entryKey(ex.id, athlete.id); setCellEdit(prev => prev?.key === key && prev.type === 'mod' ? null : { key, type: 'mod' }) }}
                                  title="Zmodyfikuj to ćwiczenie dla tej osoby"
                                  style={entry?.exercise_override ? { ...qiBtn, border: '1.5px solid #7c3aed', background: '#f3ecfd', color: '#7c3aed' } : qiBtn}
                                >
                                  <Pencil size={11} />
                                </button>
                              </div>
                              {(() => {
                                const key = entryKey(ex.id, athlete.id)
                                const labelBtn = (color: string): React.CSSProperties => ({
                                  display: 'block', marginTop: 3, border: 'none', outline: 'none', background: 'none', padding: 0,
                                  fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.66rem', fontWeight: 700, color,
                                  textAlign: 'left', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                })
                                const painActive = !!entry?.pain || entry?.pain_vas != null
                                return (
                                  <>
                                    {entry?.exercise_override && !(cellEdit?.key === key && cellEdit.type === 'mod') && (
                                      <button onClick={() => setCellEdit({ key, type: 'mod' })} title="Kliknij, by zmienić" style={labelBtn('#7c3aed')}>
                                        → {entry.exercise_override}
                                      </button>
                                    )}
                                    {painActive && !(cellEdit?.key === key && cellEdit.type === 'pain') && (
                                      <button onClick={() => setCellEdit({ key, type: 'pain' })} title="Kliknij, by zmienić" style={labelBtn(entry?.pain_vas != null && entry.pain_vas >= 5 ? '#c23b3b' : '#c07f1e')}>
                                        ⚠ {entry?.pain_vas != null ? `${entry.pain_vas}/10 ` : ''}{entry?.pain_comment || ''}
                                      </button>
                                    )}
                                    {entry?.comment && !(cellEdit?.key === key && cellEdit.type === 'note') && (
                                      <button onClick={() => setCellEdit({ key, type: 'note' })} title="Kliknij, by zmienić" style={labelBtn('#2c5aa3')}>
                                        💬 {entry.comment}
                                      </button>
                                    )}
                                  </>
                                )
                              })()}
                              {cellEdit?.key === entryKey(ex.id, athlete.id) && (
                                cellEdit.type === 'mod' ? (
                                  <InlineFieldEditor
                                    initialValue={entry?.exercise_override || ''}
                                    placeholder="Nazwa zmodyfikowanego ćwiczenia (np. Goblet przysiad)..."
                                    borderColor="#7c3aed"
                                    bg="#f3ecfd"
                                    onSave={val => { saveEntryMeta(athlete, ex, { exercise_override: val.trim() || null }); setCellEdit(null) }}
                                    onCancel={() => setCellEdit(null)}
                                  />
                                ) : cellEdit.type === 'pain' ? (
                                  <InlineFieldEditor
                                    initialValue={entry?.pain_comment || ''}
                                    initialScale={entry?.pain_vas ?? null}
                                    showScale
                                    placeholder="Opisz ból / dyskomfort..."
                                    borderColor="#c23b3b"
                                    bg="#FEF2F2"
                                    onSave={(val, scale) => {
                                      const has = !!val.trim() || scale != null
                                      saveEntryMeta(athlete, ex, { pain: has, pain_vas: has ? scale : null, pain_comment: has ? (val.trim() || null) : null })
                                      setCellEdit(null)
                                    }}
                                    onCancel={() => setCellEdit(null)}
                                  />
                                ) : (
                                  <InlineFieldEditor
                                    initialValue={entry?.comment || ''}
                                    placeholder="Notatka..."
                                    onSave={val => { saveInlineComment(athlete, ex, val); setCellEdit(null) }}
                                    onCancel={() => setCellEdit(null)}
                                  />
                                )
                              )}
                            </td>
                          )
                        })}
                        <td style={{ border: 'none' }} />
                        <td style={{ border: 'none' }} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {athletes.filter(a => individualIds.has(a.id)).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Plany indywidualne — inne ćwiczenia niż reszta grupy
                  </div>
                  {athletes.filter(a => individualIds.has(a.id)).map(person => {
                    const own = exercises.filter(e => e.athlete_id === person.id).sort((a, b) => a.exercise_order - b.exercise_order || a.id - b.id)
                    return (
                      <div key={person.id} style={{ background: '#ffffff', border: `1.5px solid var(--border)`, borderRadius: 12, padding: '0.55rem 0.7rem', boxShadow: 'var(--shadow)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: '50%', background: 'var(--navy-900)', color: 'var(--gold)', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>
                            {person.full_name.charAt(0).toUpperCase()}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{person.full_name}</h3>
                          <Button variant="ghost" size="small" onClick={() => toggleIndividualAthlete(person.id)}>
                            ← Wróć do treningu grupowego
                          </Button>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 4 }}>
                        {own.length === 0 && (
                          <div style={{ alignSelf: 'center', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.78rem', color: 'var(--muted-light)', padding: '0.5rem 0.75rem' }}>
                            Brak ćwiczeń — dodaj pierwsze obok.
                          </div>
                        )}
                        {own.map(ex => {
                          const entry = entryMap.get(entryKey(ex.id, person.id)) || null
                          const sets = effectiveSets(ex, entry)
                          const presc = resolvePresc(ex, entry)
                          const repsMode = isMaxReps(presc.reps) || !!entry?.bodyweight || !!ex.bodyweight
                          return (
                            <div key={ex.id} style={{ width: 264, flexShrink: 0, background: 'var(--bg)', border: `1px solid var(--border)`, borderRadius: 10, padding: '0.4rem 0.55rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <input
                                  ref={el => { if (el) nameInputRefs.current.set(ex.id, el); else nameInputRefs.current.delete(ex.id) }}
                                  value={ex.name}
                                  onChange={e => handleExerciseField(ex.id, 'name', e.target.value)}
                                  onBlur={() => persistExercise(ex.id)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                  placeholder="nazwa ćwiczenia"
                                  style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy-900)', padding: '0.2rem 0', outline: 'none', fontFamily: 'var(--font-inter), sans-serif' }}
                                />
                                <button onClick={() => handleDeleteExercise(ex)} title="Usuń ćwiczenie" style={{ border: 'none', background: 'none', color: 'var(--muted-light)', fontSize: '0.78rem', padding: 2, flexShrink: 0 }}>✕</button>
                              </div>
                              <div style={{ display: 'flex', gap: 4, rowGap: 4, flexWrap: 'wrap', marginBottom: 6, alignItems: 'flex-end' }}>
                                <button
                                  onClick={() => toggleExerciseBodyweight(ex.id)}
                                  title={ex.bodyweight ? 'Tryb powtórzeń włączony — kliknij, by wrócić do kg' : 'Wpisuj powtórzenia zamiast kg'}
                                  style={{ ...headerPill(!!ex.bodyweight), padding: '3px 5px' }}
                                >
                                  BW
                                </button>
                                <button
                                  onClick={() => toggleIso(ex.id)}
                                  title={ex.iso ? 'Ćwiczenie izometryczne — kliknij, by wrócić do serie/powt./tempo' : 'Oznacz jako ćwiczenie izometryczne (PIMA/HIMA)'}
                                  style={{ ...isoPill(!!ex.iso), padding: '3px 5px' }}
                                >
                                  ISO
                                </button>
                                {ex.iso && (
                                  <>
                                    <button onClick={() => setIsoType(ex.id, 'PIMA')} title="PIMA — z intensywnością" style={{ ...isoPill(ex.iso_type === 'PIMA'), padding: '3px 5px' }}>PIMA</button>
                                    <button onClick={() => setIsoType(ex.id, 'HIMA')} title="HIMA — bez intensywności" style={{ ...isoPill(ex.iso_type === 'HIMA'), padding: '3px 5px' }}>HIMA</button>
                                  </>
                                )}
                              </div>
                              <div style={{ marginTop: -6, marginBottom: 6 }}><SetPlanTable ex={ex} onChange={(i, field, v) => handlePlanCell(ex.id, i, field, v)} onCommit={() => persistExercise(ex.id)} onAdd={() => addPlanRow(ex.id)} onRemove={i => removePlanRow(ex.id, i)} /></div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flexWrap: 'wrap', width: 260 }}>
                                {sets.map((s, i) => {
                                  const repsPerf = s.reps && !isMaxReps(s.reps) ? s.reps : ''
                                  const cellVal = repsMode ? repsPerf : (s.weight || '')
                                  return (
                                    <div key={`${ex.id}_${person.id}_${i}_${s.skipped ? 'x' : cellVal}`}>
                                      <button
                                        onClick={() => toggleSkipInline(person, ex, i)}
                                        title={s.skipped ? 'Seria nie zrobiona — kliknij, by cofnąć' : 'Oznacz: nie zrobiła tej serii'}
                                        style={{ display: 'block', width: '100%', border: 'none', background: 'none', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', color: s.skipped ? '#c23b3b' : 'var(--muted-light)', textAlign: 'center', marginBottom: 1, textDecoration: s.skipped ? 'line-through' : 'none', padding: 0 }}
                                      >
                                        S{i + 1}{ex.iso && isoSetTimes(ex)[i] != null ? ` · ${isoSetTimes(ex)[i]}s` : ''}
                                      </button>
                                      {s.skipped ? (
                                        <button
                                          onClick={() => toggleSkipInline(person, ex, i)}
                                          title="Nie zrobiła tej serii (kliknij, by cofnąć)"
                                          style={{ width: 44, border: '1.5px solid #F4B5B5', borderRadius: 7, background: '#FDEDED', color: '#c23b3b', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0', lineHeight: 1 }}
                                        >
                                          ✕
                                        </button>
                                      ) : (
                                        <input
                                          defaultValue={cellVal}
                                          placeholder={repsMode ? 'powt.' : 'kg'}
                                          onBlur={e => saveInlineField(person, ex, i, repsMode ? 'reps' : 'weight', e.target.value)}
                                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                          className={`gt-w${cellVal ? ' filled' : ''}`}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                                <button
                                  onClick={() => addInlineSet(person, ex)}
                                  title="Dodaj serię"
                                  style={qiBtn}
                                >
                                  <Plus size={12} />
                                </button>
                                {sets.length > 1 && (
                                  <button
                                    onClick={() => removeInlineSet(person, ex)}
                                    title="Usuń ostatnią serię"
                                    style={{ ...qiBtn, fontSize: '0.82rem', fontWeight: 800 }}
                                  >
                                    －
                                  </button>
                                )}
                                {(() => {
                                  const painActive = !!entry?.pain || entry?.pain_vas != null
                                  const severe = entry?.pain_vas != null && entry.pain_vas >= 5
                                  const key = entryKey(ex.id, person.id)
                                  return (
                                    <button
                                      onClick={() => setCellEdit(prev => prev?.key === key && prev.type === 'pain' ? null : { key, type: 'pain' })}
                                      title={painActive ? `Ból${entry?.pain_vas != null ? ` ${entry.pain_vas}/10` : ''}${entry?.pain_comment ? `: ${entry.pain_comment}` : ''}` : 'Zaznacz ból'}
                                      style={painActive
                                        ? { ...qiBtn, border: `1.5px solid ${severe ? '#c23b3b' : '#c07f1e'}`, background: severe ? '#FDEDED' : '#FEF6E0', color: severe ? '#c23b3b' : '#92600A' }
                                        : qiBtn}
                                    >
                                      <AlertTriangle size={11} />
                                    </button>
                                  )
                                })()}
                                <button
                                  onClick={() => { const key = entryKey(ex.id, person.id); setCellEdit(prev => prev?.key === key && prev.type === 'note' ? null : { key, type: 'note' }) }}
                                  title={entry?.comment || 'Dodaj notatkę'}
                                  style={entry?.comment ? { ...qiBtn, border: '1.5px solid #2c5aa3', background: '#eaf1fb', color: '#2c5aa3' } : qiBtn}
                                >
                                  <MessageCircle size={11} />
                                </button>
                              </div>
                              {(() => {
                                const key = entryKey(ex.id, person.id)
                                const labelBtn = (color: string): React.CSSProperties => ({
                                  display: 'block', marginTop: 3, border: 'none', outline: 'none', background: 'none', padding: 0,
                                  fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.66rem', fontWeight: 700, color,
                                  textAlign: 'left', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                })
                                const painActive = !!entry?.pain || entry?.pain_vas != null
                                return (
                                  <>
                                    {painActive && !(cellEdit?.key === key && cellEdit.type === 'pain') && (
                                      <button onClick={() => setCellEdit({ key, type: 'pain' })} title="Kliknij, by zmienić" style={labelBtn(entry?.pain_vas != null && entry.pain_vas >= 5 ? '#c23b3b' : '#c07f1e')}>
                                        ⚠ {entry?.pain_vas != null ? `${entry.pain_vas}/10 ` : ''}{entry?.pain_comment || ''}
                                      </button>
                                    )}
                                    {entry?.comment && !(cellEdit?.key === key && cellEdit.type === 'note') && (
                                      <button onClick={() => setCellEdit({ key, type: 'note' })} title="Kliknij, by zmienić" style={labelBtn('#2c5aa3')}>
                                        💬 {entry.comment}
                                      </button>
                                    )}
                                  </>
                                )
                              })()}
                              {cellEdit?.key === entryKey(ex.id, person.id) && (
                                cellEdit.type === 'pain' ? (
                                  <InlineFieldEditor
                                    initialValue={entry?.pain_comment || ''}
                                    initialScale={entry?.pain_vas ?? null}
                                    showScale
                                    placeholder="Opisz ból / dyskomfort..."
                                    borderColor="#c23b3b"
                                    bg="#FEF2F2"
                                    onSave={(val, scale) => {
                                      const has = !!val.trim() || scale != null
                                      saveEntryMeta(person, ex, { pain: has, pain_vas: has ? scale : null, pain_comment: has ? (val.trim() || null) : null })
                                      setCellEdit(null)
                                    }}
                                    onCancel={() => setCellEdit(null)}
                                  />
                                ) : (
                                  <InlineFieldEditor
                                    initialValue={entry?.comment || ''}
                                    placeholder="Notatka..."
                                    onSave={val => { saveInlineComment(person, ex, val); setCellEdit(null) }}
                                    onCancel={() => setCellEdit(null)}
                                  />
                                )
                              )}
                            </div>
                          )
                        })}
                        <button
                          onClick={() => handleAddIndividualExercise(person.id)}
                          title="Dodaj ćwiczenie"
                          style={{ width: 44, alignSelf: 'stretch', minHeight: 120, flexShrink: 0, border: `1.5px dashed var(--muted-light)`, borderRadius: 10, background: 'none', color: 'var(--muted)', fontSize: '1.3rem', fontFamily: 'var(--font-inter), sans-serif' }}
                        >
                          ＋
                        </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="ghost" onClick={() => setSummaryOpen(true)}>
                  📊 Podsumowanie treningu
                </Button>
                <Button variant="ghost" onClick={() => router.push(`/coach/groups/${group.id}/summary`)}>
                  📈 Statystyki grupy
                </Button>
                <Button variant="dark" onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ flex: 1, color: 'var(--gold)', fontWeight: 900 }}>
                  Gotowe — wróć do grupy
                </Button>
              </div>
            </>
          )}
      </div>

      {summaryOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'var(--font-inter), sans-serif' }} onClick={() => setSummaryOpen(false)}>
          <div style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: 18, overflow: 'hidden', border: `1.5px solid var(--border)` }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'var(--navy-900)', padding: '1rem 1.25rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>📊 Podsumowanie treningu</div>
              <button onClick={() => setSummaryOpen(false)} style={{ border: 'none', background: 'none', color: '#aeb7cc', fontSize: '1.1rem', padding: 4 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.25rem' }}>
              {absentIds.size > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '0.5rem 0', borderBottom: `1px solid var(--border)`, fontSize: '0.82rem' }}>
                  <span>Nieobecne dziś</span>
                  <b>{absentIds.size}: {athletes.filter(a => absentIds.has(a.id)).map(a => a.full_name).join(', ')}</b>
                </div>
              )}
              {sortedExercises.map(ex => {
                const active = boardAthletes.filter(a => !absentIds.has(a.id) && !entryMap.get(entryKey(ex.id, a.id))?.excluded)
                const done = active.filter(a => {
                  const entry = entryMap.get(entryKey(ex.id, a.id))
                  return effectiveSets(ex, entry).some(s => (s.weight || '').trim() || (s.reps || '').trim() || s.skipped)
                }).length
                const excludedCount = boardAthletes.filter(a => !absentIds.has(a.id) && entryMap.get(entryKey(ex.id, a.id))?.excluded).length
                return (
                  <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '0.5rem 0', borderBottom: `1px solid var(--border)`, fontSize: '0.82rem' }}>
                    <span><b>{exerciseLabel.get(ex.id)}</b> {ex.name || 'Bez nazwy'}</span>
                    <b>{done}/{active.length} uzupełnionych{excludedCount ? ` · ${excludedCount} nie robi tego ćwiczenia` : ''}</b>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {openCell && (
        <CellModal
          athlete={openCell.athlete}
          exercise={openCell.exercise}
          entry={entryMap.get(entryKey(openCell.exercise.id, openCell.athlete.id)) || null}
          training={training}
          onClose={() => setOpenCell(null)}
          onSaved={saved => {
            const key = entryKey(saved.exercise_id, saved.athlete_id)
            latestSetsRef.current.delete(key)
            setEntryMap(prev => {
              const next = new Map(prev)
              next.set(key, saved)
              return next
            })
          }}
        />
      )}
    </>
  )
}
