'use client'
// src/app/coach/groups/[id]/training/[trainingId]/GroupTrainingClient.tsx
// Tabela treningowa grupy zorganizowanej — wiersze: zawodniczki, kolumny: ćwiczenia
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatDatePl } from '@/lib/groupTraining'
import { CheckSquare, MessageCircle } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Button } from '@/components/coach/ui'

type Group = { id: number; name: string }
type Training = { id: number; group_id: number; training_date: string; absent_athlete_ids?: number[] | null }
type Athlete = { id: number; full_name: string }
type Exercise = {
  id: number
  training_id: number
  name: string
  exercise_order: number
  // rozpiska dla całej grupy (nagłówek kolumny)
  sets_planned?: number | null
  reps?: string | null
  tempo?: string | null
  // cała kolumna na masie własnej — wpisujemy powtórzenia zamiast ciężaru dla całej drużyny
  bodyweight?: boolean | null
  // jedno zadanie, kilka wariantów wykonania — każdy z własną rozpiską
  variants?: Variant[] | null
  // tryb indywidualny — serie/powt./tempo per zawodniczka; pusty nagłówek to nie błąd
  individual?: boolean | null
}
// Wariant: nazwa + opcjonalna własna rozpiska (serie/powt./tempo) + tryb masy własnej + tryb indywidualny.
type Variant = { name: string; sets?: number | null; reps?: string | null; tempo?: string | null; bodyweight?: boolean | null; individual?: boolean | null }
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
  // wybrany wariant ćwiczenia dla tej zawodniczki
  variant?: string | null
}

interface Props {
  group: Group
  training: Training
  athletes: Athlete[]
  initialExercises: Exercise[]
  initialEntries: Entry[]
}

const entryKey = (exerciseId: number, athleteId: number) => `${exerciseId}_${athleteId}`

// Ćwiczenie „na maksa" — w polu POWT. wpisano max/maks/amrap/do upadku.
// Wtedy w komórkach zawodniczek wpisujemy wykonane powtórzenia, nie ciężar.
const isMaxReps = (reps?: string | null) => /(amrap|maks|max|upad)/i.test((reps || '').trim())

// Normalizacja jednego wariantu z bazy: jsonb (obiekt), starszy text[] (sama nazwa),
// albo USZKODZONY zapis, gdzie nazwa to zserializowany obiekt wariantu
// (efekt zapisu obiektów do kolumny text[] przed migracją text[]→jsonb).
function coerceVariant(x: unknown): Variant | null {
  if (typeof x === 'string') {
    const s = x.trim()
    // string wyglądający jak JSON wariantu — rozpakuj rekurencyjnie
    if (s.startsWith('{')) { try { return coerceVariant(JSON.parse(s)) } catch { /* nie JSON */ } }
    return s ? { name: s, sets: null, reps: '', tempo: '', bodyweight: false, individual: false } : null
  }
  if (x && typeof x === 'object') {
    const o = x as Variant
    // nazwa = zserializowany obiekt wariantu → rozpakuj zamiast pokazywać surowy JSON
    if (typeof o.name === 'string' && o.name.trim().startsWith('{')) {
      try { const inner = coerceVariant(JSON.parse(o.name)); if (inner) return inner } catch { /* zostaw */ }
    }
    const name = String(o.name ?? '').trim()
    return name ? { name, sets: o.sets ?? null, reps: o.reps ?? '', tempo: o.tempo ?? '', bodyweight: !!o.bodyweight, individual: !!o.individual } : null
  }
  return null
}

// Normalizacja listy wariantów z bazy.
function normalizeVariants(raw: unknown): Variant[] {
  if (!Array.isArray(raw)) return []
  return raw.map(coerceVariant).filter((v): v is Variant => v != null)
}

const variantHasPresc = (v: Variant) => v.sets != null || !!(v.reps && v.reps.trim()) || !!(v.tempo && v.tempo.trim())

// Rozpiska obowiązująca daną zawodniczkę: wariant z własną rozpiską > nagłówek grupy.
function resolvePresc(ex: Exercise, entry: Entry | null | undefined): { sets: number | null; reps: string; tempo: string } {
  const v = entry?.variant ? (ex.variants || []).find(x => x.name === entry.variant) : undefined
  if (v && variantHasPresc(v)) return { sets: v.sets ?? null, reps: v.reps || '', tempo: v.tempo || '' }
  return { sets: ex.sets_planned ?? null, reps: ex.reps || '', tempo: ex.tempo || '' }
}

// Serie do wyświetlenia: wpis zawodniczki dopełniony do liczby serii z rozpiski,
// puste serie dziedziczą powtórzenia i tempo z rozpiski (wariantu lub nagłówka)
function effectiveSets(ex: Exercise, entry: Entry | null | undefined, minOne = false): SetRow[] {
  const presc = resolvePresc(ex, entry)
  const fromEntry = entry?.sets || []
  const planned = presc.sets ?? 0
  const n = Math.max(planned, fromEntry.length, minOne ? 1 : 0)
  return Array.from({ length: n }, (_, i) =>
    fromEntry[i] ? { ...fromEntry[i] } : { reps: presc.reps, tempo: presc.tempo, weight: '' }
  )
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
  // Rozpiska obowiązująca tę zawodniczkę (wariant > nagłówek) — do podpowiedzi i
  // dziedziczenia powt./tempa także w seriach, które mają już wpisany ciężar.
  const presc = resolvePresc(exercise, entry)
  const [sets, setSets] = useState<SetRow[]>(() =>
    effectiveSets(exercise, entry, true).map(s => ({
      ...s,
      reps: s.reps || (isMaxReps(presc.reps) ? '' : presc.reps),
      tempo: s.tempo || presc.tempo,
    }))
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
      updated_at: new Date().toISOString(),
    }
    let { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(payload, { onConflict: 'exercise_id,athlete_id' })
      .select()
      .single()
    // Migracje kolumn „pain” / „bodyweight” jeszcze nie wgrane — zapisz bez brakującej
    let attempt: Record<string, any> = payload
    let guard = 0
    while (err && guard++ < 3) {
      const missing = ['pain', 'bodyweight'].find(col => new RegExp(`'${col}'`).test(err!.message) && col in attempt)
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
                <input value={s.reps || ''} onChange={e => updateSet(idx, 'reps', e.target.value)} placeholder={presc.reps || '8'} style={skipInput} inputMode="text" disabled={s.skipped} />
                <input value={s.tempo || ''} onChange={e => updateSet(idx, 'tempo', e.target.value)} placeholder={presc.tempo || '3010'} style={skipInput} inputMode="text" disabled={s.skipped} />
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
  const supabase = createClient()

  const [exercises, setExercises] = useState<Exercise[]>(
    () => initialExercises.map(e => ({ ...e, variants: normalizeVariants(e.variants) }))
  )
  const [entryMap, setEntryMap] = useState<Map<string, Entry>>(
    () => new Map(initialEntries.map(e => [entryKey(e.exercise_id, e.athlete_id), e]))
  )
  const [openCell, setOpenCell] = useState<{ athlete: Athlete; exercise: Exercise } | null>(null)
  const [noteOpen, setNoteOpen] = useState<string | null>(null) // entryKey z otwartym polem notatki
  const [trainingDate, setTrainingDate] = useState(training.training_date)
  const [absentIds, setAbsentIds] = useState<Set<number>>(() => new Set(training.absent_athlete_ids || []))
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)
  const [focusExerciseId, setFocusExerciseId] = useState<number | null>(null)
  const nameInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  // Najnowsze serie per komórka — chroni przed zgubieniem ciężaru przy szybkim
  // przechodzeniu między polami (zapis async może nie zdążyć przed kolejnym blur)
  const latestSetsRef = useRef<Map<string, SetRow[]>>(new Map())
  const dragExId = useRef<number | null>(null) // ćwiczenie przeciągane (zmiana kolejności)
  const [dragOverExId, setDragOverExId] = useState<number | null>(null)
  const [variantsOpenExId, setVariantsOpenExId] = useState<number | null>(null) // edytor wariantów
  const [newVariant, setNewVariant] = useState('')

  // Jednorazowe naprawienie uszkodzonych wariantów w bazie (nazwa = zserializowany
  // obiekt). Po znormalizowaniu zapisujemy czystą wersję, żeby zniknęła też w analizie.
  useEffect(() => {
    initialExercises.forEach(e => {
      const clean = normalizeVariants(e.variants)
      if (clean.length === 0) return
      if (JSON.stringify(clean) === JSON.stringify(e.variants)) return
      supabase.from('group_training_exercises').update({ variants: clean }).eq('id', e.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Po dodaniu kolumny kursor wskakuje w pole nazwy nowego ćwiczenia
  useEffect(() => {
    if (focusExerciseId == null) return
    const input = nameInputRefs.current.get(focusExerciseId)
    if (input) { input.focus(); setFocusExerciseId(null) }
  }, [focusExerciseId, exercises])

  const sortedExercises = useMemo(
    () => [...exercises].sort((a, b) => a.exercise_order - b.exercise_order || a.id - b.id),
    [exercises]
  )

  // Obecne zawodniczki na górze (w oryginalnej kolejności), wykreślone na końcu
  const orderedAthletes = useMemo(() => {
    const present = athletes.filter(a => !absentIds.has(a.id)).map(a => ({ athlete: a, absent: false }))
    const absent = athletes.filter(a => absentIds.has(a.id)).map(a => ({ athlete: a, absent: true }))
    return [...present, ...absent]
  }, [athletes, absentIds])

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

  // Nowa kolumna ćwiczenia — od razu z pustym polem nazwy do wpisania (jak w Excelu)
  async function handleAddExercise() {
    setError('')
    const maxOrder = Math.max(0, ...exercises.map(e => e.exercise_order))
    const { data, error: err } = await supabase
      .from('group_training_exercises')
      .insert({ training_id: training.id, name: '', exercise_order: maxOrder + 1, sets_planned: 3 })
      .select()
      .single()
    if (err || !data) { setError(err?.message || 'Błąd dodawania ćwiczenia'); return }
    setExercises(prev => [...prev, data as Exercise])
    setFocusExerciseId((data as Exercise).id)
  }

  function handleExerciseField(exerciseId: number, field: 'name' | 'reps' | 'tempo' | 'sets_planned', value: string) {
    setExercises(prev => prev.map(e => {
      if (e.id !== exerciseId) return e
      if (field === 'sets_planned') return { ...e, sets_planned: value === '' ? null : parseInt(value) || null }
      return { ...e, [field]: value }
    }))
  }

  async function persistExercise(exerciseId: number) {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex) return
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update({ name: ex.name.trim(), sets_planned: ex.sets_planned ?? null, reps: ex.reps?.trim() || null, tempo: ex.tempo?.trim() || null })
      .eq('id', ex.id)
    if (err) setError(err.message)
  }

  // Wpisz 0 (masa ciała) w ciężar zawodniczkom na grupowej rozpisce (bez wybranego
  // wariantu). Zawodniczki z wariantem mają własny przycisk BW przy wariancie.
  async function fillColumnBodyweight(ex: Exercise) {
    const hasVariants = (ex.variants?.length ?? 0) > 0
    const present = athletes.filter(a => !absentIds.has(a.id) && !entryMap.get(entryKey(ex.id, a.id))?.variant)
    if (present.length === 0) { setError(hasVariants ? 'Brak zawodniczek bez wariantu — użyj BW przy wariancie.' : 'Brak obecnych zawodniczek.'); return }
    const who = hasVariants ? `zawodniczkom bez wariantu (${present.length})` : 'wszystkim zawodniczkom'
    if (!confirm(`Wpisać 0 (masa ciała) w ciężar ${who} w „${ex.name || 'tym ćwiczeniu'}”?`)) return
    setError('')
    const rows = present.map(a => {
      const key = entryKey(ex.id, a.id)
      const current = entryMap.get(key)
      const sets = (latestSetsRef.current.get(key) ?? effectiveSets(ex, current)).map(s => ({ ...s, weight: '0' }))
      latestSetsRef.current.set(key, sets)
      return {
        training_id: training.id, exercise_id: ex.id, athlete_id: a.id, sets,
        pain_vas: current?.pain_vas ?? null, pain_comment: current?.pain_comment ?? null,
        comment: current?.comment ?? null, exercise_override: current?.exercise_override ?? null,
        updated_at: new Date().toISOString(),
      }
    })
    if (rows.length === 0) return
    const { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(rows, { onConflict: 'exercise_id,athlete_id' })
      .select()
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
        ? 'Aby używać trybu indywidualnego, uruchom migrację 202606220001 (kolumny variants/individual/variant).'
        : err.message)
    }
  }

  // Zapis listy wariantów ćwiczenia (optymistycznie + DB), z cofnięciem przy błędzie
  async function persistVariants(exerciseId: number, variants: Variant[]) {
    const prev = exercises.find(e => e.id === exerciseId)?.variants ?? []
    setExercises(p => p.map(e => e.id === exerciseId ? { ...e, variants } : e))
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update({ variants })
      .eq('id', exerciseId)
    if (err) {
      setExercises(p => p.map(e => e.id === exerciseId ? { ...e, variants: prev } : e))
      setError(/'variants'/.test(err.message)
        ? 'Aby dodawać warianty, uruchom migracje 202606220001 i 202606220002 (kolumna variants jako jsonb).'
        : err.message)
    }
  }

  function addVariant(exerciseId: number) {
    const name = newVariant.trim()
    if (!name) return
    const current = exercises.find(e => e.id === exerciseId)?.variants ?? []
    if (current.some(v => v.name.toLowerCase() === name.toLowerCase())) { setNewVariant(''); return }
    persistVariants(exerciseId, [...current, { name, sets: null, reps: '', tempo: '' }])
    setNewVariant('')
  }

  function removeVariant(exerciseId: number, name: string) {
    const current = exercises.find(e => e.id === exerciseId)?.variants ?? []
    persistVariants(exerciseId, current.filter(v => v.name !== name))
  }

  // Zmiana nazwy wariantu — aktualizuje listę wariantów I przepisuje wybór wariantu
  // u zawodniczek (po czystej nazwie, więc łapie też uszkodzony zapis). Jeśli nowa
  // nazwa już istnieje, warianty się scalają.
  async function renameVariant(exerciseId: number, oldName: string, raw: string) {
    const newName = raw.trim()
    const current = exercises.find(e => e.id === exerciseId)?.variants ?? []
    if (!newName || newName === oldName) return
    const exists = current.some(v => v.name === newName)
    const next = exists
      ? current.filter(v => v.name !== oldName)
      : current.map(v => v.name === oldName ? { ...v, name: newName } : v)
    await persistVariants(exerciseId, next)
    // przepisz wybór wariantu u zawodniczek: oldName (też zapisany jako JSON) -> newName
    const ids = athletes
      .filter(a => coerceVariant(entryMap.get(entryKey(exerciseId, a.id))?.variant)?.name === oldName)
      .map(a => a.id)
    if (ids.length === 0) return
    const { error: err } = await supabase
      .from('group_training_entries')
      .update({ variant: newName })
      .eq('exercise_id', exerciseId)
      .in('athlete_id', ids)
    if (err) { setError(err.message); return }
    setEntryMap(prev => {
      const nextMap = new Map(prev)
      for (const aid of ids) {
        const k = entryKey(exerciseId, aid)
        const e = nextMap.get(k)
        if (e) nextMap.set(k, { ...e, variant: newName })
      }
      return nextMap
    })
  }

  // Edycja rozpiski wariantu (serie/powt./tempo) — stan lokalny; zapis na blur.
  function updateVariantField(exerciseId: number, name: string, field: 'sets' | 'reps' | 'tempo', value: string) {
    setExercises(p => p.map(e => {
      if (e.id !== exerciseId) return e
      const variants = (e.variants ?? []).map(v => {
        if (v.name !== name) return v
        if (field === 'sets') return { ...v, sets: value === '' ? null : parseInt(value) || null }
        return { ...v, [field]: value }
      })
      return { ...e, variants }
    }))
  }

  async function persistVariantsNow(exerciseId: number) {
    const variants = exercises.find(e => e.id === exerciseId)?.variants ?? []
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update({ variants })
      .eq('id', exerciseId)
    if (err) setError(/'variants'/.test(err.message)
      ? 'Aby zapisać rozpiskę wariantu, uruchom migrację 202606220002 (kolumna variants jako jsonb).'
      : err.message)
  }

  // Tryb powtórzeń (masa własna) tylko dla tego wariantu — zawodniczki z nim wpisują powt.
  function toggleVariantBodyweight(exerciseId: number, name: string) {
    const current = exercises.find(e => e.id === exerciseId)?.variants ?? []
    persistVariants(exerciseId, current.map(v => v.name === name ? { ...v, bodyweight: !v.bodyweight } : v))
  }

  // Tryb indywidualny tylko dla tego wariantu — rozpiska liczona z wierszy zawodniczek.
  function toggleVariantIndividual(exerciseId: number, name: string) {
    const current = exercises.find(e => e.id === exerciseId)?.variants ?? []
    persistVariants(exerciseId, current.map(v => v.name === name ? { ...v, individual: !v.individual } : v))
  }

  // Wpisz 0 (masa ciała) w ciężar zawodniczkom wykonującym ten wariant
  async function fillVariantBodyweight(ex: Exercise, name: string) {
    const present = athletes.filter(a => !absentIds.has(a.id) && entryMap.get(entryKey(ex.id, a.id))?.variant === name)
    if (present.length === 0) { setError(`Żadna obecna zawodniczka nie ma jeszcze wybranego wariantu „${name}”.`); return }
    if (!confirm(`Wpisać 0 (masa ciała) w ciężar zawodniczkom wykonującym „${name}” (${present.length})?`)) return
    setError('')
    const rows = present.map(a => {
      const key = entryKey(ex.id, a.id)
      const current = entryMap.get(key)
      const sets = (latestSetsRef.current.get(key) ?? effectiveSets(ex, current)).map(s => ({ ...s, weight: '0' }))
      latestSetsRef.current.set(key, sets)
      return {
        training_id: training.id, exercise_id: ex.id, athlete_id: a.id, sets,
        pain_vas: current?.pain_vas ?? null, pain_comment: current?.pain_comment ?? null,
        comment: current?.comment ?? null, exercise_override: current?.exercise_override ?? null,
        updated_at: new Date().toISOString(),
      }
    })
    const { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(rows, { onConflict: 'exercise_id,athlete_id' })
      .select()
    if (err || !data) { setError(err?.message || 'Błąd zapisu'); return }
    setEntryMap(prev => {
      const next = new Map(prev)
      for (const d of data as Entry[]) next.set(entryKey(d.exercise_id, d.athlete_id), d)
      return next
    })
  }

  // Wybór wariantu dla konkretnej zawodniczki (zapisywany przy jej wpisie)
  async function saveVariant(athlete: Athlete, ex: Exercise, variant: string | null) {
    await saveEntryMeta(athlete, ex, { variant: variant || null })
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
    const [moved] = ordered.splice(fromIdx, 1)
    ordered.splice(toIdx, 0, moved)
    const updates = ordered.map((e, i) => ({ id: e.id, exercise_order: i }))
    setExercises(prev => prev.map(e => {
      const u = updates.find(x => x.id === e.id)
      return u ? { ...e, exercise_order: u.exercise_order } : e
    }))
    const results = await Promise.all(updates.map(u =>
      supabase.from('group_training_exercises').update({ exercise_order: u.exercise_order }).eq('id', u.id)
    ))
    const failed = results.find(r => r.error)
    if (failed?.error) setError(failed.error.message)
  }

  // Szybki zapis wartości wpisanej w komórce tabeli (ciężar albo wykonane powtórzenia)
  async function saveInlineField(athlete: Athlete, ex: Exercise, idx: number, field: 'weight' | 'reps', value: string) {
    const key = entryKey(ex.id, athlete.id)
    const current = entryMap.get(key)
    const presc = resolvePresc(ex, current)
    const sets = latestSetsRef.current.get(key) ?? effectiveSets(ex, current)
    if ((sets[idx]?.[field] || '') === value.trim()) return
    sets[idx] = { ...(sets[idx] || { reps: presc.reps, tempo: presc.tempo }), [field]: value.trim() }
    latestSetsRef.current.set(key, sets)
    const payload = {
      training_id: training.id,
      exercise_id: ex.id,
      athlete_id: athlete.id,
      sets,
      pain_vas: current?.pain_vas ?? null,
      pain_comment: current?.pain_comment ?? null,
      comment: current?.comment ?? null,
      exercise_override: current?.exercise_override ?? null,
      updated_at: new Date().toISOString(),
    }
    const { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(payload, { onConflict: 'exercise_id,athlete_id' })
      .select()
      .single()
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
    const presc = resolvePresc(ex, current)
    sets[idx] = { ...(sets[idx] || { reps: presc.reps, tempo: presc.tempo }), skipped: !sets[idx]?.skipped }
    latestSetsRef.current.set(key, sets)
    const payload = {
      training_id: training.id,
      exercise_id: ex.id,
      athlete_id: athlete.id,
      sets,
      pain_vas: current?.pain_vas ?? null,
      pain_comment: current?.pain_comment ?? null,
      comment: current?.comment ?? null,
      exercise_override: current?.exercise_override ?? null,
      updated_at: new Date().toISOString(),
    }
    const { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(payload, { onConflict: 'exercise_id,athlete_id' })
      .select()
      .single()
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
      pain_vas: current?.pain_vas ?? null,
      pain_comment: current?.pain_comment ?? null,
      comment: current?.comment ?? null,
      exercise_override: current?.exercise_override ?? null,
      updated_at: new Date().toISOString(),
    }
    const { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(payload, { onConflict: 'exercise_id,athlete_id' })
      .select()
      .single()
    if (err || !data) { setError(err?.message || 'Błąd zapisu'); return }
    setEntryMap(prev => {
      const next = new Map(prev)
      next.set(key, data as Entry)
      return next
    })
  }

  function addInlineSet(athlete: Athlete, ex: Exercise) {
    const key = entryKey(ex.id, athlete.id)
    const entry = entryMap.get(key)
    const presc = resolvePresc(ex, entry)
    const sets = (latestSetsRef.current.get(key) ?? effectiveSets(ex, entry)).map(s => ({ ...s }))
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
    const payload = { training_id: training.id, exercise_id: ex.id, athlete_id: athlete.id, ...patch, updated_at: new Date().toISOString() }
    const { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(payload, { onConflict: 'exercise_id,athlete_id' })
      .select()
      .single()
    if (err || !data) {
      const msg = err?.message || ''
      setError('pain' in patch && /'pain'/.test(msg)
        ? 'Aby oznaczać ból w tabeli, uruchom migrację 202606200002 (kolumna pain).'
        : 'variant' in patch && /'variant'/.test(msg)
        ? 'Aby przypisywać warianty, uruchom migrację 202606220001 (kolumny variants/individual/variant).'
        : (msg || 'Błąd zapisu'))
      return
    }
    setEntryMap(prev => { const next = new Map(prev); next.set(key, data as Entry); return next })
  }

  function toggleInlinePain(athlete: Athlete, ex: Exercise) {
    const entry = entryMap.get(entryKey(ex.id, athlete.id))
    const on = !!entry?.pain || entry?.pain_vas != null
    saveEntryMeta(athlete, ex, on ? { pain: false, pain_vas: null } : { pain: true })
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
        .gt-row td { transition: background 0.12s ease; }
        .gt-row:nth-child(even) td, .gt-row:nth-child(even) .gt-sticky { background: #FBFCFE; }
        .gt-row:hover td, .gt-row:hover .gt-sticky { background: #EFF4FB; }
        .gt-w { width: 44px; border: 1.5px solid #DBE2EB; border-radius: 7px; background: #FAFBFC; font-family: var(--font-inter), sans-serif; font-size: 0.74rem; color: var(--navy-900); padding: 0.3rem 0.2rem; outline: none; text-align: center; transition: border-color 0.12s, background 0.12s; }
        .gt-w.filled { border-color: var(--border); background: #ffffff; }
        .gt-w:focus { border-color: var(--gold); background: #ffffff; }
      `}</style>
      <SetPageMeta title="Trening" backHref={`/coach/groups/${group.id}`} backLabel={group.name} />
      <div className="coach-content">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: 'var(--ink)', fontSize: '1.15rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-inter), sans-serif' }}>
              Trening · {formatDatePl(trainingDate)}
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 4, maxWidth: 760, fontFamily: 'var(--font-inter), sans-serif' }}>
              W nagłówku kolumny: serie, powtórzenia i tempo dla całej grupy. Przeciągnij ⠿, by zmienić kolejność. „BW" wpisuje 0 (masa ciała) w ciężar wszystkim, „P" przełącza kolumnę na wpisywanie powtórzeń zamiast kg. W wierszu zawodniczki wpisujesz ciężar, „+ ból"/„+ notatka" dają szybki wpis bez ✎. Kliknij numer serii (S1, S2…), by oznaczyć „nie zrobiła", a ✕ przy nazwisku wykreśla nieobecną.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '11px', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Data</span>
            <input
              type="date"
              value={trainingDate}
              onChange={e => handleDateChange(e.target.value)}
              style={{ border: '1px solid var(--border)', background: '#ffffff', color: 'var(--ink)', borderRadius: 8, padding: '7px 10px', fontFamily: 'var(--font-inter), sans-serif', fontSize: '13px', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="small" onClick={() => router.push(`/coach/groups/${group.id}/readiness`)}>
            <CheckSquare size={13} /> Gotowość treningowa
          </Button>
          <Button variant="ghost" size="small" onClick={() => router.push(`/coach/groups/${group.id}/feedback`)}>
            <MessageCircle size={13} /> Feedback po treningu
          </Button>
        </div>

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

              <div className="coach-attendance-grid-wrap" style={{ background: '#ffffff', overflow: 'auto', maxHeight: '72vh', boxShadow: 'var(--shadow)' }}>
                <table className="gt-table">
                  <thead>
                    <tr>
                      <th className="gt-sticky" style={{ minWidth: 150, padding: '0.7rem 0.85rem', textAlign: 'left', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--bg)', zIndex: 5 }}>
                        Zawodniczka
                      </th>
                      {sortedExercises.map(ex => {
                        const headerInput: React.CSSProperties = {
                          width: '100%', minWidth: 0, border: `1px solid transparent`, borderRadius: 6,
                          background: '#ffffff', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.72rem', fontWeight: 700, color: 'var(--navy-900)',
                          padding: '0.28rem 0.15rem', outline: 'none', textAlign: 'center',
                        }
                        return (
                          <th
                            key={ex.id}
                            onDragOver={e => { if (dragExId.current != null) { e.preventDefault(); if (dragOverExId !== ex.id) setDragOverExId(ex.id) } }}
                            onDrop={e => { e.preventDefault(); reorderExercise(ex.id) }}
                            style={{ width: 178, minWidth: 178, maxWidth: 178, padding: '0.4rem 0.45rem', background: 'var(--bg)', boxShadow: dragOverExId === ex.id ? `inset 3px 0 0 var(--gold)` : undefined }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span
                                draggable
                                onDragStart={e => { dragExId.current = ex.id; e.dataTransfer.effectAllowed = 'move' }}
                                onDragEnd={() => { dragExId.current = null; setDragOverExId(null) }}
                                title="Przeciągnij, by zmienić kolejność ćwiczeń"
                                style={{ cursor: 'grab', color: 'var(--muted-light)', fontSize: '0.82rem', lineHeight: 1, flexShrink: 0, padding: '0 1px', userSelect: 'none' }}
                              >
                                ⠿
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
                                style={{ flex: 1, minWidth: 0, border: `1.5px solid transparent`, borderRadius: 7, background: 'transparent', fontWeight: 800, fontSize: '0.82rem', color: 'var(--navy-900)', padding: '0.3rem 0.35rem', outline: 'none', fontFamily: 'var(--font-inter), sans-serif' }}
                                onFocus={e => { e.target.style.background = '#ffffff'; e.target.style.borderColor = 'var(--gold)' }}
                              />
                              {!ex.bodyweight && (
                                <button
                                  onClick={() => fillColumnBodyweight(ex)}
                                  title="Wpisz 0 (masa ciała) w ciężar wszystkim zawodniczkom"
                                  style={{ flexShrink: 0, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, border: `1px solid var(--border)`, background: '#ffffff', color: 'var(--navy-900)', borderRadius: 5, padding: '2px 4px', lineHeight: 1 }}
                                >
                                  BW
                                </button>
                              )}
                              <button
                                onClick={() => toggleExerciseBodyweight(ex.id)}
                                title={ex.bodyweight ? 'Tryb powtórzeń włączony — kliknij, by wrócić do kg' : 'Cała kolumna: wpisuj powtórzenia zamiast kg'}
                                style={{ flexShrink: 0, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, border: `1px solid ${ex.bodyweight ? 'var(--gold)' : 'var(--border)'}`, background: ex.bodyweight ? '#FFFBEB' : '#ffffff', color: ex.bodyweight ? '#92600A' : 'var(--muted-light)', borderRadius: 5, padding: '2px 4px', lineHeight: 1 }}
                              >
                                P
                              </button>
                              <button
                                onClick={() => toggleIndividual(ex.id)}
                                title={ex.individual ? 'Tryb indywidualny — dane liczone z wierszy zawodniczek (kliknij, by wrócić do grupowego)' : 'Tryb indywidualny: serie/powt./tempo różne per zawodniczka, nagłówek może być pusty'}
                                style={{ flexShrink: 0, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, border: `1px solid ${ex.individual ? 'var(--gold)' : 'var(--border)'}`, background: ex.individual ? '#FFFBEB' : '#ffffff', color: ex.individual ? '#92600A' : 'var(--muted-light)', borderRadius: 5, padding: '2px 4px', lineHeight: 1 }}
                              >
                                I
                              </button>
                              <button onClick={() => handleDeleteExercise(ex)} title="Usuń ćwiczenie" style={{ border: 'none', background: 'none', color: 'var(--muted-light)', fontSize: '0.78rem', padding: 2, flexShrink: 0 }}>✕</button>
                            </div>
                            {/* Rozpiska dla całej grupy: serie / powtórzenia / tempo */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 2, marginTop: 5, padding: 3, background: '#ffffff', border: `1px solid var(--border)`, borderRadius: 9 }}>
                              {([
                                { field: 'sets_planned' as const, label: 'serie', value: ex.sets_planned ?? '', placeholder: '3', type: 'number' },
                                { field: 'reps' as const, label: 'powt.', value: ex.reps ?? '', placeholder: '8', type: 'text' },
                                { field: 'tempo' as const, label: 'tempo', value: ex.tempo ?? '', placeholder: '3010', type: 'text' },
                              ]).map(f => (
                                <div key={f.field}>
                                  <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.48rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', marginBottom: 1 }}>{f.label}</div>
                                  <input
                                    type={f.type}
                                    {...(f.type === 'number' ? { min: 0, max: 20 } : {})}
                                    value={f.value}
                                    onChange={e => handleExerciseField(ex.id, f.field, e.target.value)}
                                    onBlur={() => persistExercise(ex.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                    placeholder={f.placeholder}
                                    style={headerInput}
                                  />
                                </div>
                              ))}
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
                            {/* ── WARIANTY ZADANIA ── */}
                            <div style={{ marginTop: 4 }}>
                              <button
                                onClick={() => { setVariantsOpenExId(variantsOpenExId === ex.id ? null : ex.id); setNewVariant('') }}
                                title="Warianty wykonania tego zadania (np. Podciąganie / Negatywne / z gumą)"
                                style={{ width: '100%', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, border: `1px solid ${(ex.variants?.length ?? 0) > 0 ? 'var(--gold)' : 'var(--border)'}`, background: (ex.variants?.length ?? 0) > 0 ? '#FFFBEB' : '#ffffff', color: (ex.variants?.length ?? 0) > 0 ? '#92600A' : 'var(--muted-light)', borderRadius: 6, padding: '2px 5px', lineHeight: 1.3 }}
                              >
                                ⋔ warianty{(ex.variants?.length ?? 0) > 0 ? ` (${ex.variants!.length})` : ''} {variantsOpenExId === ex.id ? '▴' : '▾'}
                              </button>
                              {variantsOpenExId === ex.id && (
                                <div style={{ marginTop: 4, padding: 5, background: '#ffffff', border: `1px solid var(--border)`, borderRadius: 8 }}>
                                  {(ex.variants ?? []).length === 0 && (
                                    <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', color: 'var(--muted-light)', marginBottom: 4, textAlign: 'center' }}>brak — dodaj wersje wykonania</div>
                                  )}
                                  {(ex.variants ?? []).map(v => (
                                    <div key={v.name} style={{ marginBottom: 6, padding: 4, background: 'var(--bg)', border: `1px solid var(--border)`, borderRadius: 7 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
                                        <input
                                          defaultValue={v.name}
                                          title="Kliknij, by zmienić nazwę wariantu (zaktualizuje też zawodniczki)"
                                          onFocus={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'var(--gold)' }}
                                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                          onBlur={e => {
                                            e.currentTarget.style.background = 'transparent'
                                            e.currentTarget.style.borderColor = 'transparent'
                                            const val = e.target.value.trim()
                                            if (!val) { e.target.value = v.name; return }
                                            renameVariant(ex.id, v.name, val)
                                          }}
                                          style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.64rem', fontWeight: 700, color: 'var(--navy-900)', border: '1px solid transparent', borderRadius: 6, background: 'transparent', padding: '2px 4px', outline: 'none' }}
                                        />
                                        {!v.bodyweight && (
                                          <button
                                            onClick={() => fillVariantBodyweight(ex, v.name)}
                                            title="Wpisz 0 (masa ciała) zawodniczkom z tym wariantem"
                                            style={{ flexShrink: 0, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, border: `1px solid var(--border)`, background: '#ffffff', color: 'var(--navy-900)', borderRadius: 5, padding: '2px 4px', lineHeight: 1 }}
                                          >
                                            BW
                                          </button>
                                        )}
                                        <button
                                          onClick={() => toggleVariantBodyweight(ex.id, v.name)}
                                          title={v.bodyweight ? 'Wariant na masie własnej — wpisuj powt. (kliknij, by wrócić do kg)' : 'Ten wariant: wpisuj powtórzenia zamiast kg'}
                                          style={{ flexShrink: 0, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, border: `1px solid ${v.bodyweight ? 'var(--gold)' : 'var(--border)'}`, background: v.bodyweight ? '#FFFBEB' : '#ffffff', color: v.bodyweight ? '#92600A' : 'var(--muted-light)', borderRadius: 5, padding: '2px 4px', lineHeight: 1 }}
                                        >
                                          P
                                        </button>
                                        <button
                                          onClick={() => toggleVariantIndividual(ex.id, v.name)}
                                          title={v.individual ? 'Wariant indywidualny — rozpiska z wierszy zawodniczek (kliknij, by wrócić do wspólnej)' : 'Ten wariant: serie/powt./tempo różne per zawodniczka'}
                                          style={{ flexShrink: 0, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, border: `1px solid ${v.individual ? 'var(--gold)' : 'var(--border)'}`, background: v.individual ? '#FFFBEB' : '#ffffff', color: v.individual ? '#92600A' : 'var(--muted-light)', borderRadius: 5, padding: '2px 4px', lineHeight: 1 }}
                                        >
                                          I
                                        </button>
                                        <button onClick={() => removeVariant(ex.id, v.name)} title="Usuń wariant" style={{ flexShrink: 0, border: 'none', background: 'none', color: 'var(--muted-light)', fontSize: '0.72rem', padding: 0, lineHeight: 1 }}>✕</button>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 2 }}>
                                        {([
                                          { field: 'sets' as const, label: 'serie', value: v.sets ?? '', placeholder: String(ex.sets_planned ?? 3), type: 'number' },
                                          { field: 'reps' as const, label: 'powt.', value: v.reps ?? '', placeholder: ex.reps || '8', type: 'text' },
                                          { field: 'tempo' as const, label: 'tempo', value: v.tempo ?? '', placeholder: ex.tempo || '3010', type: 'text' },
                                        ]).map(f => (
                                          <div key={f.field}>
                                            <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.44rem', color: 'var(--muted-light)', textTransform: 'uppercase', textAlign: 'center', marginBottom: 1 }}>{f.label}</div>
                                            <input
                                              type={f.type}
                                              {...(f.type === 'number' ? { min: 0, max: 20 } : {})}
                                              value={f.value}
                                              onChange={e => updateVariantField(ex.id, v.name, f.field, e.target.value)}
                                              onBlur={() => persistVariantsNow(ex.id)}
                                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                              placeholder={f.placeholder}
                                              style={{ width: '100%', border: `1px solid var(--border)`, borderRadius: 5, background: '#ffffff', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.66rem', color: 'var(--navy-900)', padding: '0.2rem 0.15rem', outline: 'none', textAlign: 'center' }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                      {v.individual && (
                                        <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.46rem', fontWeight: 700, color: '#854F0B', background: '#FEF6E0', border: '1px solid #F7D27A', borderRadius: 5, padding: '2px 4px', marginTop: 3, textAlign: 'center' }}>
                                          tryb indywidualny — dane z zawodniczek
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.46rem', color: 'var(--muted-light)', marginBottom: 4, textAlign: 'center' }}>puste pole = jak nagłówek grupy</div>
                                  <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                                    <input
                                      value={variantsOpenExId === ex.id ? newVariant : ''}
                                      onChange={e => setNewVariant(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariant(ex.id) } }}
                                      placeholder="nazwa wariantu"
                                      style={{ flex: 1, minWidth: 0, border: `1px solid var(--border)`, borderRadius: 6, background: 'var(--bg)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', color: 'var(--navy-900)', padding: '0.25rem 0.35rem', outline: 'none' }}
                                    />
                                    <button onClick={() => addVariant(ex.id)} style={{ border: 'none', background: 'var(--navy-900)', color: 'var(--gold)', borderRadius: 6, padding: '0.25rem 0.45rem', fontWeight: 800, fontSize: '0.7rem', lineHeight: 1 }}>＋</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </th>
                        )
                      })}
                      <th style={{ width: 44, minWidth: 44, padding: 0, background: 'var(--bg)' }}>
                        <button
                          onClick={handleAddExercise}
                          title="Dodaj ćwiczenie (nowa kolumna)"
                          style={{ width: '100%', height: '100%', minHeight: 44, border: 'none', background: 'none', color: 'var(--navy-900)', fontWeight: 800, fontSize: '1.05rem' }}
                        >
                          ＋
                        </button>
                      </th>
                      {/* Wypełniacz — nie pozwala kolumnom ćwiczeń rozciągać się na cały ekran */}
                      <th style={{ width: '100%', background: 'var(--bg)', borderRight: 'none' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {orderedAthletes.map(({ athlete, absent }) => (
                      <tr key={athlete.id} className="gt-row">
                        <td className="gt-sticky" style={{ padding: '0.5rem 0.7rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <button
                              onClick={() => toggleAbsent(athlete.id)}
                              title={absent ? 'Przywróć na trening' : 'Wykreśl z treningu (nieobecna)'}
                              style={{ flexShrink: 0, width: 22, height: 22, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: `1.5px solid ${absent ? 'var(--gold)' : 'var(--border)'}`, background: absent ? '#FFFBEB' : '#ffffff', color: absent ? '#92600A' : 'var(--muted-light)', fontSize: '0.72rem', lineHeight: 1 }}
                            >
                              {absent ? '↩' : '✕'}
                            </button>
                            <span style={{ fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap', textDecoration: absent ? 'line-through' : 'none', color: absent ? 'var(--muted-light)' : 'var(--navy-900)' }}>
                              {athlete.full_name}
                            </span>
                            {absent && (
                              <span style={{ flexShrink: 0, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.5rem', fontWeight: 700, color: '#92600A', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 5, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>nieob.</span>
                            )}
                          </div>
                        </td>
                        {sortedExercises.map(ex => {
                          const entry = entryMap.get(entryKey(ex.id, athlete.id)) || null
                          const sets = effectiveSets(ex, entry)
                          const variant = entry?.variant ? (ex.variants || []).find(v => v.name === entry.variant) : undefined
                          // Tryb powtórzeń: wybrany wariant rządzi się swoim „P" (nie dziedziczy
                          // z głównego ćwiczenia); bez wariantu obowiązuje „P" kolumny. Plus „max"
                          // z rozpiski i „bez ciężaru" ustawione tej zawodniczce w szczegółach.
                          const repsMode = isMaxReps(resolvePresc(ex, entry).reps) || !!entry?.bodyweight || (variant ? !!variant.bodyweight : !!ex.bodyweight)
                          return (
                            <td key={ex.id} style={{ padding: '0.45rem 0.5rem', ...(absent ? { opacity: 0.35, pointerEvents: 'none' as const } : {}) }}>
                              {(ex.variants?.length ?? 0) > 0 && (
                                <select
                                  value={entry?.variant || ''}
                                  onChange={e => saveVariant(athlete, ex, e.target.value || null)}
                                  title="Wariant wykonania dla tej zawodniczki"
                                  style={{ width: '100%', marginBottom: 5, border: `1.5px solid ${entry?.variant ? 'var(--gold)' : 'var(--border)'}`, background: entry?.variant ? '#FFFBEB' : '#ffffff', color: entry?.variant ? '#92600A' : 'var(--muted-light)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', fontWeight: 700, borderRadius: 6, padding: '3px 4px', outline: 'none' }}
                                >
                                  <option value="">— wariant —</option>
                                  {ex.variants!.map(v => <option key={v.name} value={v.name}>{v.name}{variantHasPresc(v) ? ` (${[v.sets, v.reps, v.tempo].filter(Boolean).join(' · ')})` : ''}</option>)}
                                </select>
                              )}
                              {entry?.exercise_override && (
                                <div title={`Zamiana ćwiczenia: ${entry.exercise_override}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.64rem', fontWeight: 700, color: '#854F0B', background: '#FEF6E0', border: '1px solid #F7D27A', borderRadius: 999, padding: '2px 9px 2px 2px', marginBottom: 5 }}>
                                  <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy-900)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', fontWeight: 700, lineHeight: 1 }}>⇄</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.exercise_override}</span>
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap' }}>
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
                                        S{i + 1}
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
                                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                          className={`gt-w${cellVal ? ' filled' : ''}`}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                                <button
                                  onClick={() => addInlineSet(athlete, ex)}
                                  title="Dodaj serię tej zawodniczce"
                                  style={{ border: `1.5px solid var(--border)`, background: '#ffffff', color: 'var(--navy-900)', borderRadius: 7, padding: '0.28rem 0.42rem', fontSize: '0.82rem', fontWeight: 800, flexShrink: 0, lineHeight: 1 }}
                                >
                                  ＋
                                </button>
                                {sets.length > Math.max(resolvePresc(ex, entry).sets ?? 0, 1) && (
                                  <button
                                    onClick={() => removeInlineSet(athlete, ex)}
                                    title="Usuń ostatnią serię tej zawodniczce"
                                    style={{ border: `1.5px solid var(--border)`, background: '#ffffff', color: 'var(--muted-light)', borderRadius: 7, padding: '0.28rem 0.42rem', fontSize: '0.82rem', fontWeight: 800, flexShrink: 0, lineHeight: 1 }}
                                  >
                                    －
                                  </button>
                                )}
                                <button
                                  onClick={() => setOpenCell({ athlete, exercise: ex })}
                                  title="Szczegóły: powtórzenia, tempo, ból, komentarz"
                                  style={{ border: `1.5px solid var(--border)`, background: '#ffffff', color: 'var(--muted-light)', borderRadius: 7, padding: '0.28rem 0.36rem', fontSize: '0.72rem', flexShrink: 0, lineHeight: 1 }}
                                >
                                  ✎
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                                {(() => {
                                  const painActive = !!entry?.pain || entry?.pain_vas != null
                                  return (
                                    <button
                                      onClick={() => toggleInlinePain(athlete, ex)}
                                      title={painActive ? (entry?.pain_comment ? `Ból: ${entry.pain_comment} (kliknij, by odznaczyć)` : 'Odznacz ból') : 'Zaznacz ból'}
                                      style={painActive
                                        ? { fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.6rem', fontWeight: 700, color: '#ffffff', background: (entry?.pain_vas != null && entry.pain_vas >= 5) ? '#c23b3b' : '#c07f1e', border: 'none', borderRadius: 6, padding: '2px 7px', lineHeight: 1.3 }
                                        : { fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.56rem', fontWeight: 700, color: 'var(--muted-light)', background: '#ffffff', border: `1px solid var(--border)`, borderRadius: 6, padding: '2px 6px', lineHeight: 1.3 }}
                                    >
                                      {painActive ? `ból${entry?.pain_vas != null ? ` ${entry.pain_vas}` : ''}` : '+ ból'}
                                    </button>
                                  )
                                })()}
                                {noteOpen === entryKey(ex.id, athlete.id) ? (
                                  <input
                                    autoFocus
                                    defaultValue={entry?.comment || ''}
                                    placeholder="notatka..."
                                    onBlur={e => { saveInlineComment(athlete, ex, e.target.value); setNoteOpen(null) }}
                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') setNoteOpen(null) }}
                                    style={{ flex: 1, minWidth: 96, border: `1.5px solid var(--gold)`, borderRadius: 6, background: '#ffffff', fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.7rem', color: 'var(--navy-900)', padding: '2px 6px', outline: 'none' }}
                                  />
                                ) : entry?.comment ? (
                                  <button onClick={() => setNoteOpen(entryKey(ex.id, athlete.id))} title={entry.comment}
                                    style={{ maxWidth: 140, fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.62rem', color: 'var(--navy-900)', background: '#F4F6F9', border: `1px solid var(--border)`, borderRadius: 6, padding: '2px 7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                                    💬 {entry.comment}
                                  </button>
                                ) : (
                                  <button onClick={() => setNoteOpen(entryKey(ex.id, athlete.id))}
                                    style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '0.56rem', fontWeight: 700, color: 'var(--muted-light)', background: '#ffffff', border: `1px solid var(--border)`, borderRadius: 6, padding: '2px 6px', lineHeight: 1.3 }}>
                                    + notatka
                                  </button>
                                )}
                              </div>
                            </td>
                          )
                        })}
                        <td style={{ background: '#FAFBFC' }} />
                        <td style={{ borderRight: 'none' }} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="ghost" onClick={() => router.push(`/coach/groups/${group.id}/summary`)}>
                  📊 Podsumowanie
                </Button>
                <Button variant="dark" onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ flex: 1, color: 'var(--gold)', fontWeight: 900 }}>
                  Gotowe — wróć do grupy
                </Button>
              </div>
            </>
          )}
      </div>

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
