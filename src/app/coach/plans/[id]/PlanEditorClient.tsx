'use client'
// src/app/coach/plans/[id]/PlanEditorClient.tsx

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ClipboardList, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import PlanTableView, { type ExercisePatch } from './PlanTableView'
import PlanWellnessConfig from '@/components/PlanWellnessConfig'
import { SetPageMeta, usePageMeta } from '@/components/coach/PageMetaContext'
import { Modal, Button, Field } from '@/components/coach/ui'
import { insertExercisesWithVariants, sortWithVariants, variantLabels } from '@/lib/exerciseVariants'
import { moveExercise, moveBlock } from '@/lib/planReorder'

type Plan = {
  id: number
  name: string
  // plan grupy samodzielnej — edytor otwierany z jej zakładki Plan
  group_id?: number | null
}

type Week = {
  id: number
  plan_id: number
  week_number: number
  name?: string | null
}

type Day = {
  id: number
  week_id: number
  day_name: string
  day_order: number
  coach_intro?: string | null
  coach_outro?: string | null
  coach_closing?: string | null
}

type ExerciseLibraryItem = {
  id: number
  name: string
  category?: string | null
}

type WarmupSet = {
  reps?: string
  weight_kg?: string
  note?: string
}

// Jedna seria główna: własne powt./ciężar/tempo/RIR (zamiast jednej wspólnej
// rozpiski na całe ćwiczenie). Wzorem WarmupSet. Dla ćwiczeń ISO: seconds
// (czas napięcia) i intensity (tylko PIMA) zamiast reps/tempo.
type WorkSet = {
  reps?: string
  weight_kg?: string
  tempo?: string
  rir?: string
  seconds?: string
  intensity?: string
  // ISO: przerwa (w sekundach) między powtórzeniami W OBRĘBIE tej serii
  // (inaczej niż przerwa między samymi seriami, którą trenerka planuje sama).
  rest?: string
  // ekscentryczne: czas fazy ekscentrycznej (s) i hold w rozciągnięciu (s) — zamiast tempa
  ecc?: string
  hold?: string
}

type BlockExercise = {
  id?: number
  block_id: number
  exercise_id?: number | null
  exercise_code?: string | null
  exercise_order: number
  sets: number
  reps?: string | null
  tempo?: string | null
  weight_kg?: number | null
  rir?: number | null
  is_warmup: boolean
  warmup_sets?: WarmupSet[] | null
  work_sets?: WorkSet[] | null
  iso?: boolean | null
  iso_type?: 'PIMA' | 'HIMA' | null
  // ćwiczenie ekscentryczne (obok standardowego i ISO)
  ecc?: boolean | null
  coach_comment?: string | null
  exercise_url?: string | null
  exercise?: ExerciseLibraryItem | null
  // wariant ćwiczenia (1b, 1c...): id ćwiczenia bazowego (1a) i zawodniczki, które go robią
  variant_of?: number | null
  variant_athlete_ids?: number[] | null
}

type Block = {
  id: number
  day_id: number
  block_name: string
  block_order: number
  rounds: number
  workout_block_exercises?: BlockExercise[]
}

interface Props {
  plan: Plan
  // zawodniczki planu — do przydziału wariantów ćwiczeń
  athletes?: { id: number; full_name: string }[]
  weeks: Week[]
  days: Day[]
  blocks: Block[]
  exercises: ExerciseLibraryItem[]
  allPlans: Plan[]
  allWeeks: Week[]
  allDays: Day[]
  allBlocks: Block[]
}

type MoveItem =
  | { type: 'exercise'; exercise: BlockExercise; fromBlockId: number }
  | { type: 'block'; block: Block }
  | { type: 'day'; day: Day }

function formatExerciseName(name: string) {
  return name.replace(/-/g, ' ')
}

function nextBlockName(count: number) {
  return `Blok ${String.fromCharCode(65 + count)}`
}

function normalizeWarmupSets(value?: WarmupSet[] | null): WarmupSet[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ reps: '', weight_kg: '', note: '' }]
  }

  return value.map(set => ({
    reps: set.reps?.toString() || '',
    weight_kg: set.weight_kg?.toString() || '',
    note: set.note?.toString() || '',
  }))
}

function cleanWarmupSets(value: WarmupSet[]): WarmupSet[] {
  return value
    .map(set => ({
      reps: set.reps?.trim() || '',
      weight_kg: set.weight_kg?.trim() || '',
      note: set.note?.trim() || '',
    }))
    .filter(set => set.reps || set.weight_kg || set.note)
}

function isWarmupColumnError(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() || ''
  return message.includes('warmup_sets')
}

function exercisePayloadWithoutWarmup<T extends { warmup_sets?: WarmupSet[] }>(payload: T) {
  const rest = { ...payload }
  delete rest.warmup_sets
  return rest
}

// Serie główne: jeśli ćwiczenie ma już zapisane work_sets, użyj ich wprost.
// W przeciwnym razie zbuduj tyle wierszy, ile wynosi dotychczasowa liczba serii,
// wypełnionych dotychczasową (wspólną) rozpiską — nic nie znika przy przejściu
// na edycję per-seria.
function normalizeWorkSets(exercise: BlockExercise): WorkSet[] {
  if (Array.isArray(exercise.work_sets) && exercise.work_sets.length > 0) {
    return exercise.work_sets.map(set => ({
      reps: set.reps?.toString() || '',
      weight_kg: set.weight_kg?.toString() || '',
      tempo: set.tempo?.toString() || '',
      rir: set.rir?.toString() || '',
      seconds: set.seconds?.toString() || '',
      intensity: set.intensity?.toString() || '',
      rest: set.rest?.toString() || '',
      ecc: set.ecc?.toString() || '',
      hold: set.hold?.toString() || '',
    }))
  }
  const count = Math.max(exercise.sets || 1, 1)
  return Array.from({ length: count }, () => ({
    reps: exercise.reps || '',
    weight_kg: exercise.weight_kg?.toString() || '',
    tempo: exercise.tempo || '',
    rir: exercise.rir?.toString() || '',
    seconds: '',
    intensity: '',
    rest: '',
    ecc: '',
    hold: '',
  }))
}

function cleanWorkSets(value: WorkSet[]): WorkSet[] {
  return value.map(set => ({
    reps: set.reps?.trim() || '',
    weight_kg: set.weight_kg?.trim() || '',
    tempo: set.tempo?.trim() || '',
    rir: set.rir?.trim() || '',
    seconds: set.seconds?.trim() || '',
    intensity: set.intensity?.trim() || '',
    rest: set.rest?.trim() || '',
    ecc: set.ecc?.trim() || '',
    hold: set.hold?.trim() || '',
  }))
}

function isWorkSetsColumnError(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() || ''
  return message.includes('work_sets')
}

function exercisePayloadWithoutWorkSets<T extends { work_sets?: WorkSet[] }>(payload: T) {
  const rest = { ...payload }
  delete rest.work_sets
  return rest
}

function isIsoColumnError(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() || ''
  return message.includes("'iso'") || message.includes('iso_type')
}

function isEccColumnError(error: { message?: string; code?: string } | null) {
  return (error?.message?.toLowerCase() || '').includes("'ecc'")
}

function exercisePayloadWithoutEcc<T extends { ecc?: boolean }>(payload: T) {
  const rest = { ...payload }
  delete rest.ecc
  return rest
}

// Skrót serii ekscentrycznej do kolumny tempo — tak widzi go zawodniczka w aplikacji
// (która pokazuje tempo ćwiczenia): "ECC 5''" albo "ECC 5'' · hold 3''"
function eccTempoLabel(set?: { ecc?: string; hold?: string } | null): string | null {
  if (!set?.ecc && !set?.hold) return null
  return [set.ecc ? `ECC ${set.ecc}''` : '', set.hold ? `hold ${set.hold}''` : ''].filter(Boolean).join(' · ')
}

function exercisePayloadWithoutIso<T extends { iso?: boolean; iso_type?: string | null }>(payload: T) {
  const rest = { ...payload }
  delete rest.iso
  delete rest.iso_type
  return rest
}

// Inline ćwiczenie edit form — osadzony w bloku (mockup: .coach-exercise-edit-form), nie modal.
function ExerciseEditForm({
  exercise,
  exercises,
  onSave,
  onDelete,
  onClose,
}: {
  exercise: BlockExercise
  exercises: ExerciseLibraryItem[]
  onSave: (data: BlockExercise) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [exerciseId, setExerciseId] = useState<string>(exercise.exercise_id?.toString() || '')
  const [exerciseCode, setExerciseCode] = useState(exercise.exercise_code || '')
  const [iso, setIso] = useState(exercise.iso || false)
  const [isoType, setIsoType] = useState<'PIMA' | 'HIMA'>(exercise.iso_type || 'PIMA')
  const [ecc, setEcc] = useState(!exercise.iso && !!exercise.ecc)
  const [workSets, setWorkSets] = useState<WorkSet[]>(() => normalizeWorkSets(exercise))
  const [comment, setComment] = useState(exercise.coach_comment || '')
  const [isWarmup, setIsWarmup] = useState(exercise.is_warmup || false)
  const [warmupSets, setWarmupSets] = useState<WarmupSet[]>(normalizeWarmupSets(exercise.warmup_sets))
  const [exerciseUrl, setExerciseUrl] = useState(exercise.exercise_url || '')
  const [useCustomName, setUseCustomName] = useState(!exercise.exercise_id)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const supabase = createClient()
  const isNew = !exercise.id
  const canSave = useCustomName ? exerciseCode.trim().length > 0 : exerciseId.length > 0

  const workSetInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  function focusWorkSetCell(rowIndex: number, colIndex: number) {
    workSetInputRefs.current[`${rowIndex}-${colIndex}`]?.focus()
  }
  function handleWorkSetKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    const input = e.currentTarget
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusWorkSetCell(rowIndex - 1, colIndex)
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      focusWorkSetCell(rowIndex + 1, colIndex)
    } else if (e.key === 'ArrowLeft' && input.selectionStart === 0 && input.selectionEnd === 0) {
      e.preventDefault()
      focusWorkSetCell(rowIndex, colIndex - 1)
    } else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
      e.preventDefault()
      focusWorkSetCell(rowIndex, colIndex + 1)
    }
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError('')
    const cleanSets = cleanWorkSets(workSets)
    const first = cleanSets[0]
    const payload = {
      block_id: exercise.block_id,
      exercise_id: !useCustomName && exerciseId ? parseInt(exerciseId) : null,
      exercise_code: useCustomName ? exerciseCode.trim() : null,
      exercise_order: exercise.exercise_order,
      iso,
      iso_type: iso ? isoType : null,
      // ecc wysyłamy tylko dla ćwiczeń ekscentrycznych (albo przy zmianie z ekscentrycznego) — bez migracji reszta działa
      ...(ecc || exercise.ecc ? { ecc: !iso && ecc } : {}),
      // Kolumny sets/reps/tempo/weight_kg/rir zostają wypełnione danymi
      // pierwszej serii — tak widoki, które jeszcze nie znają work_sets
      // (np. tabela planu), pokazują sensowny skrót zamiast pustki. Dla ISO
      // reps/tempo nie mają zastosowania (jest czas/intensywność zamiast nich).
      sets: cleanSets.length || 1,
      reps: iso ? null : (first?.reps || null),
      tempo: iso ? null : ecc ? eccTempoLabel(first) : (first?.tempo || null),
      weight_kg: first?.weight_kg ? parseFloat(first.weight_kg) : null,
      rir: first?.rir ? parseInt(first.rir) : null,
      work_sets: cleanSets,
      coach_comment: comment.trim() || null,
      is_warmup: isWarmup,
      warmup_sets: isWarmup ? cleanWarmupSets(warmupSets) : [],
      exercise_url: exerciseUrl.trim() || null,
      // wariant (1b, 1c...) — wysyłane tylko dla wariantów, żeby zwykłe ćwiczenia działały bez migracji
      ...(exercise.variant_of != null ? { variant_of: exercise.variant_of, variant_athlete_ids: exercise.variant_athlete_ids ?? [] } : {}),
    }

    let result = isNew
      ? await supabase.from('workout_block_exercises').insert(payload).select('*, exercise:exercises(*)')
      : await supabase.from('workout_block_exercises').update(payload).eq('id', exercise.id)
    let data = 'data' in result ? result.data : null
    let error = result.error
    if (isEccColumnError(error)) {
      setSaving(false)
      setSaveError('Aby dodawać ćwiczenia ekscentryczne, uruchom migrację 202610050004.')
      return
    }
    if (isIsoColumnError(error)) {
      const withoutIso = exercisePayloadWithoutEcc(exercisePayloadWithoutIso(payload))
      result = isNew
        ? await supabase.from('workout_block_exercises').insert(withoutIso).select('*, exercise:exercises(*)')
        : await supabase.from('workout_block_exercises').update(withoutIso).eq('id', exercise.id)
      data = 'data' in result ? result.data : null
      error = result.error
    }
    if (isWorkSetsColumnError(error)) {
      const withoutWorkSets = exercisePayloadWithoutWorkSets(exercisePayloadWithoutIso(payload))
      result = isNew
        ? await supabase.from('workout_block_exercises').insert(withoutWorkSets).select('*, exercise:exercises(*)')
        : await supabase.from('workout_block_exercises').update(withoutWorkSets).eq('id', exercise.id)
      data = 'data' in result ? result.data : null
      error = result.error
    }
    if (isWarmupColumnError(error)) {
      const fallbackPayload = exercisePayloadWithoutWarmup(exercisePayloadWithoutWorkSets(exercisePayloadWithoutIso(payload)))
      const fallbackResult = isNew
        ? await supabase.from('workout_block_exercises').insert(fallbackPayload).select('*, exercise:exercises(*)')
        : await supabase.from('workout_block_exercises').update(fallbackPayload).eq('id', exercise.id)
      data = fallbackResult.data
      error = fallbackResult.error
    }
    setSaving(false)
    if (error) {
      setSaveError(/variant_of|variant_athlete_ids/.test(error.message || '')
        ? 'Aby dodawać warianty ćwiczeń, uruchom migrację 202610050003.'
        : isIsoColumnError(error)
        ? 'Brakuje pól na ćwiczenia ISO w bazie. Dodaj kolumny iso/iso_type w Supabase.'
        : isWorkSetsColumnError(error)
        ? 'Brakuje pola na serie w bazie. Dodaj kolumnę work_sets w Supabase.'
        : isWarmupColumnError(error)
        ? 'Brakuje pola na serie rozgrzewkowe w bazie. Dodaj kolumne warmup_sets w Supabase.'
        : `Nie udalo sie zapisac: ${error.message}`)
      return
    }
    const returnedExercise = Array.isArray(data) ? data[0] : data
    const fallbackExercise = !isNew
      ? {
          ...exercise,
          ...payload,
          id: exercise.id,
          exercise: !useCustomName && exerciseId
            ? exercises.find(item => item.id === parseInt(exerciseId)) || exercise.exercise || null
            : null,
        }
      : null
    const savedExercise = returnedExercise || fallbackExercise
    if (!savedExercise) {
      setSaveError('Nie udalo sie odswiezyc zapisanego cwiczenia. Sprobuj ponownie.')
      return
    }
    onSave(savedExercise as BlockExercise)
    onClose()
  }

  async function handleDelete() {
    if (!exercise.id) {
      onClose()
      return
    }
    setSaving(true)
    await supabase.from('workout_block_exercises').delete().eq('id', exercise.id)
    setSaving(false)
    onDelete()
    onClose()
  }

  function updateWarmupSet(index: number, field: keyof WarmupSet, value: string) {
    setWarmupSets(prev => prev.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set))
  }

  function addWarmupSet() {
    setWarmupSets(prev => [...prev, { reps: '', weight_kg: '', note: '' }])
  }

  function removeWarmupSet(index: number) {
    setWarmupSets(prev => prev.length === 1 ? [{ reps: '', weight_kg: '', note: '' }] : prev.filter((_, setIndex) => setIndex !== index))
  }

  function updateWorkSet(index: number, field: keyof WorkSet, value: string) {
    setWorkSets(prev => prev.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set))
  }

  function addWorkSet() {
    setWorkSets(prev => {
      const last = prev[prev.length - 1]
      // nowa seria dziedziczy wartości z poprzedniej — szybciej się wpisuje
      return [...prev, last ? { ...last } : { reps: '', weight_kg: '', tempo: '', rir: '', seconds: '', intensity: '', rest: '', ecc: '', hold: '' }]
    })
  }

  function removeWorkSet(index: number) {
    setWorkSets(prev => prev.length === 1 ? prev : prev.filter((_, setIndex) => setIndex !== index))
  }

  return (
    <div className="coach-exercise-edit-form">
      <div className="coach-scheme-row">
        <button type="button" className={`coach-scheme-btn ${!useCustomName ? 'coach-active' : ''}`} onClick={() => setUseCustomName(false)}>
          Z biblioteki
        </button>
        <button type="button" className={`coach-scheme-btn ${useCustomName ? 'coach-active' : ''}`} onClick={() => setUseCustomName(true)}>
          Własna nazwa
        </button>
      </div>

      {!useCustomName ? (
        <Field label="Ćwiczenie">
          <select value={exerciseId} onChange={e => setExerciseId(e.target.value)}>
            <option value="">Wybierz ćwiczenie</option>
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>{formatExerciseName(ex.name)}{ex.category ? ` (${ex.category})` : ''}</option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Nazwa ćwiczenia">
          <input value={exerciseCode} onChange={e => setExerciseCode(e.target.value)} placeholder="np. rdl, tgu, chest press" />
        </Field>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Typ ćwiczenia</div>
        <div className="coach-scheme-row" style={{ marginBottom: iso ? 8 : 0 }}>
          <button type="button" className={`coach-scheme-btn ${!iso && !ecc ? 'coach-active' : ''}`} onClick={() => { setIso(false); setEcc(false) }}>
            Standardowe
          </button>
          <button type="button" className={`coach-scheme-btn ${iso ? 'coach-active' : ''}`} onClick={() => { setIso(true); setEcc(false) }}>
            Izometryczne (ISO)
          </button>
          <button type="button" className={`coach-scheme-btn ${ecc ? 'coach-active' : ''}`} onClick={() => { setEcc(true); setIso(false) }}>
            Ekscentryczne
          </button>
        </div>
        {iso && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Wariant ISO</div>
            <div className="coach-scheme-row" style={{ marginBottom: 6 }}>
              {(['PIMA', 'HIMA'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  className="coach-scheme-btn"
                  style={isoType === v ? { background: 'var(--gold)', color: 'var(--navy-900)', borderColor: 'var(--gold)' } : undefined}
                  onClick={() => setIsoType(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif', marginBottom: 8 }}>
              {isoType === 'PIMA'
                ? 'PIMA — napięcie z narastającą intensywnością (%). Podaj docelową intensywność.'
                : 'HIMA — napięcie na stałej, maksymalnej intensywności przez cały czas trwania.'}
            </div>
          </>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>Serie</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>
              {ecc ? 'Każda seria może mieć inne powtórzenia, ciężar, czas fazy ekscentrycznej, hold w rozciągnięciu i RIR.' : iso ? 'Każda seria może mieć inny czas napięcia, liczbę powtórzeń, przerwę (rest) między nimi, ciężar i RIR.' : 'Każda seria może mieć inne powtórzenia, ciężar, tempo i RIR.'}
            </div>
          </div>
          <button type="button" className="coach-btn coach-btn-dark coach-btn-small" onClick={addWorkSet}>Dodaj serię</button>
        </div>

        {(() => {
          const cols = ecc
            ? [{ field: 'reps' as const, label: 'Powt.', placeholder: '5' }, { field: 'weight_kg' as const, label: 'Ciężar', placeholder: 'kg' }, { field: 'ecc' as const, label: 'Ekscentryka (s)', placeholder: '5' }, { field: 'hold' as const, label: 'Hold w rozciągnięciu (s)', placeholder: '-' }, { field: 'rir' as const, label: 'RIR', placeholder: '-' }]
            : iso
            ? (isoType === 'PIMA'
              ? [{ field: 'seconds' as const, label: 'Czas (s)', placeholder: '20' }, { field: 'reps' as const, label: 'Powt.', placeholder: '-' }, { field: 'rest' as const, label: 'Rest (s)', placeholder: '-' }, { field: 'weight_kg' as const, label: 'Ciężar', placeholder: 'kg' }, { field: 'intensity' as const, label: 'Intensywność (%)', placeholder: '%' }, { field: 'rir' as const, label: 'RIR', placeholder: '-' }]
              : [{ field: 'seconds' as const, label: 'Czas (s)', placeholder: '20' }, { field: 'reps' as const, label: 'Powt.', placeholder: '-' }, { field: 'rest' as const, label: 'Rest (s)', placeholder: '-' }, { field: 'weight_kg' as const, label: 'Ciężar', placeholder: 'kg' }, { field: 'rir' as const, label: 'RIR', placeholder: '-' }])
            : [{ field: 'reps' as const, label: 'Powt.', placeholder: '8-10' }, { field: 'weight_kg' as const, label: 'Ciężar', placeholder: 'kg' }, { field: 'tempo' as const, label: 'Tempo', placeholder: '3-1-2-0' }, { field: 'rir' as const, label: 'RIR', placeholder: '-' }]
          const gridCols = `30px ${cols.map(() => 'minmax(0, 1fr)').join(' ')} 30px`
          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, marginBottom: 4, padding: '0 2px' }}>
                <span />
                {cols.map(c => (
                  <span key={c.field} style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-light)', textTransform: 'uppercase', textAlign: 'center' }}>{c.label}</span>
                ))}
                <span />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {workSets.map((set, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, alignItems: 'center' }}>
                    <div style={{ height: 32, borderRadius: 8, background: 'var(--navy-900)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                      {index + 1}
                    </div>
                    {cols.map((c, colIndex) => (
                      <input
                        key={c.field}
                        ref={el => { workSetInputRefs.current[`${index}-${colIndex}`] = el }}
                        value={set[c.field] || ''}
                        onChange={e => updateWorkSet(index, c.field, e.target.value)}
                        onKeyDown={e => handleWorkSetKeyDown(e, index, colIndex)}
                        placeholder={c.placeholder}
                        style={{ textAlign: 'center', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                      />
                    ))}
                    <button type="button" onClick={() => removeWorkSet(index)} className="coach-icon-btn coach-danger" style={{ width: 30, height: 30 }} disabled={workSets.length === 1}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )
        })()}
      </div>

      <label className="coach-exercise-edit-form-checkbox">
        <input type="checkbox" checked={isWarmup} onChange={e => setIsWarmup(e.target.checked)} />
        Dodaj serie rozgrzewkowe
      </label>

      {isWarmup && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>Serie rozgrzewkowe</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>Każda seria może mieć inną liczbę powtórzeń i ciężar.</div>
            </div>
            <button type="button" className="coach-btn coach-btn-dark coach-btn-small" onClick={addWarmupSet}>Dodaj</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {warmupSets.map((set, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr) 30px', gap: 6, alignItems: 'center' }}>
                <div style={{ height: 32, borderRadius: 8, background: 'var(--navy-900)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                  R{index + 1}
                </div>
                <input value={set.reps || ''} onChange={e => updateWarmupSet(index, 'reps', e.target.value)} placeholder="powt." style={{ textAlign: 'center', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <input value={set.weight_kg || ''} onChange={e => updateWarmupSet(index, 'weight_kg', e.target.value)} placeholder="kg" style={{ textAlign: 'center', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <input value={set.note || ''} onChange={e => updateWarmupSet(index, 'note', e.target.value)} placeholder="komentarz" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <button type="button" onClick={() => removeWarmupSet(index)} className="coach-icon-btn coach-danger" style={{ width: 30, height: 30 }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {saveError && (
        <div style={{ border: '1px solid #c23b3b', background: '#fef2f2', color: '#c23b3b', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>
          {saveError}
        </div>
      )}

      <Field label="Link do filmu / instrukcji">
        <input value={exerciseUrl} onChange={e => setExerciseUrl(e.target.value)} placeholder="https://youtube.com/..." />
      </Field>

      <Field label="Komentarz dla zawodniczki">
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Wskazowki techniczne, zakres ruchu, uwagi..." rows={3} />
      </Field>

      <div className="coach-inline-form-actions">
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        {!isNew && (
          <button className="coach-btn" style={{ border: '1px solid #c23b3b', color: '#c23b3b', background: '#fff' }} onClick={handleDelete} disabled={saving}>
            Usuń
          </button>
        )}
        <Button variant="dark" onClick={handleSave} disabled={saving || !canSave}>
          {saving ? 'Zapisuję...' : isNew ? 'Dodaj ćwiczenie' : 'Zapisz zmiany'}
        </Button>
      </div>
    </div>
  )
}

// Przydział zawodniczek do wariantów ćwiczenia (1a / 1b / 1c...). Każda
// zawodniczka ma dokładnie jeden wybór (radio), więc nikt nie zostaje bez
// wariantu i nikt nie robi dwóch. 1a (bazowe) = wszyscy nieprzypisani gdzie indziej.
function VariantAssignModal({ options, athletes, onSave, onClose }: {
  options: { exercise: BlockExercise; label: string; name: string }[]  // [0] = ćwiczenie bazowe
  athletes: { id: number; full_name: string }[]
  onSave: (assignment: Map<number, number[]>) => Promise<void>       // id wariantu → zawodniczki
  onClose: () => void
}) {
  const base = options[0]
  const [choice, setChoice] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {}
    for (const a of athletes) {
      const v = options.slice(1).find(o => (o.exercise.variant_athlete_ids || []).includes(a.id))
      init[a.id] = (v ?? base).exercise.id as number
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const countFor = (id: number) => athletes.filter(a => choice[a.id] === id).length

  async function handleSave() {
    setSaving(true)
    const assignment = new Map<number, number[]>()
    for (const o of options.slice(1)) assignment.set(o.exercise.id as number, athletes.filter(a => choice[a.id] === o.exercise.id).map(a => a.id))
    await onSave(assignment)
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      eyebrow="Warianty ćwiczenia"
      title="Kto robi który wariant?"
      sub="Każda zawodniczka robi dokładnie jeden wariant."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleSave} disabled={saving}>{saving ? 'Zapisuję...' : 'Zapisz przydział'}</Button>
        </>
      }
    >
      {athletes.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-inter),sans-serif' }}>
          Plan nie ma jeszcze przypisanych zawodniczek — przypisz plan grupie albo zawodniczkom, a potem wybierz warianty.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-inter),sans-serif', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>Zawodniczka</th>
                {options.map(o => (
                  <th key={o.exercise.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', minWidth: 110 }}>
                    <div style={{ fontWeight: 800, color: o.exercise.variant_of != null ? '#7c3aed' : 'var(--navy-900)' }}>{o.label}</div>
                    <div style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 11 }}>{o.name}</div>
                    <div style={{ fontWeight: 600, color: 'var(--muted-light)', fontSize: 10 }}>{countFor(o.exercise.id as number)} os.</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {athletes.map(a => (
                <tr key={a.id}>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--ink)' }}>{a.full_name}</td>
                  {options.map(o => (
                    <td key={o.exercise.id} style={{ textAlign: 'center', padding: '5px 8px', borderBottom: '1px solid var(--border)' }}>
                      <input
                        type="radio"
                        name={`variant-${a.id}`}
                        checked={choice[a.id] === o.exercise.id}
                        onChange={() => setChoice(prev => ({ ...prev, [a.id]: o.exercise.id as number }))}
                        style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {options.map(o => (
              <button key={o.exercise.id} type="button" className="coach-btn coach-btn-ghost coach-btn-small"
                onClick={() => setChoice(Object.fromEntries(athletes.map(a => [a.id, o.exercise.id as number])))}>
                Wszystkie → {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function MoveModal({
  item,
  plans,
  weeks,
  days,
  blocks,
  onMove,
  onClose,
}: {
  item: MoveItem
  plans: Plan[]
  weeks: Week[]
  days: Day[]
  blocks: Block[]
  onMove: (targetId: number) => Promise<void>
  onClose: () => void
}) {
  const [targetId, setTargetId] = useState('')
  const [saving, setSaving] = useState(false)

  const planName = (planId: number) => plans.find(plan => plan.id === planId)?.name || 'Plan'
  const weekLabel = (weekId: number) => {
    const week = weeks.find(itemWeek => itemWeek.id === weekId)
    return week ? `${planName(week.plan_id)} / Tydzien ${week.week_number}` : 'Tydzien'
  }
  const dayLabel = (dayId: number) => {
    const day = days.find(itemDay => itemDay.id === dayId)
    return day ? `${weekLabel(day.week_id)} / ${day.day_name}` : 'Trening'
  }

  const options = item.type === 'exercise'
    ? blocks
        .filter(block => block.id !== item.fromBlockId)
        .map(block => ({ id: block.id, label: `${dayLabel(block.day_id)} / ${block.block_name}` }))
    : item.type === 'block'
      ? days
          .filter(day => day.id !== item.block.day_id)
          .map(day => ({ id: day.id, label: dayLabel(day.id) }))
      : weeks
          .filter(week => week.id !== item.day.week_id)
          .map(week => ({ id: week.id, label: weekLabel(week.id) }))

  const title = item.type === 'exercise'
    ? 'Przenies cwiczenie'
    : item.type === 'block'
      ? 'Przenies blok'
      : 'Przenies trening'

  const hint = item.type === 'exercise'
    ? 'Wybierz blok docelowy.'
    : item.type === 'block'
      ? 'Wybierz trening docelowy.'
      : 'Wybierz tydzien docelowy.'

  async function handleMove() {
    if (!targetId) return
    setSaving(true)
    await onMove(parseInt(targetId))
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Organizacja planu"
      title={title}
      sub={hint}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleMove} disabled={!targetId || saving}>
            {saving ? 'Przenosze...' : 'Przenies'}
          </Button>
        </>
      }
    >
      <Field label="Miejsce docelowe">
        <select value={targetId} onChange={event => setTargetId(event.target.value)}>
          <option value="">Wybierz...</option>
          {options.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </Field>
      {options.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-inter),sans-serif' }}>
          Brak innych miejsc docelowych. Dodaj najpierw tydzien, trening albo blok.
        </div>
      )}
    </Modal>
  )
}

export default function PlanEditorClient({ plan, athletes = [], weeks, days, blocks, exercises, allPlans, allWeeks, allDays, allBlocks }: Props) {
  const router = useRouter()
  const supabase = createClient()
  // Plan grupy samodzielnej wraca do zakładki Plan tej grupy, ogólny — do listy planów
  const backHref = plan.group_id ? `/coach/groups/${plan.group_id}/plan` : '/coach/plans'
  const { sidebarCollapsed, setSidebarCollapsed } = usePageMeta()

  const [planName, setPlanName] = useState(plan.name)
  const [planNotes, setPlanNotes] = useState((plan as any).description || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [localWeeks, setLocalWeeks] = useState<Week[]>(weeks)
  const [localDays, setLocalDays] = useState<Day[]>(days)
  const [localBlocks, setLocalBlocks] = useState<Block[]>(blocks)
  const [targetWeeks, setTargetWeeks] = useState<Week[]>(allWeeks)
  const [targetDays, setTargetDays] = useState<Day[]>(allDays)
  const [targetBlocks, setTargetBlocks] = useState<Block[]>(allBlocks)
  const [selectedDayId, setSelectedDayId] = useState<number | null>(days[0]?.id || null)
  const [editingExercise, setEditingExercise] = useState<BlockExercise | null>(null)
  const [movingItem, setMovingItem] = useState<MoveItem | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planSaveMessage, setPlanSaveMessage] = useState('')
  const [globalError, setGlobalError] = useState('')
  const [showWellness, setShowWellness] = useState(false)


  function showError(msg: string) {
    setGlobalError(msg)
    setTimeout(() => setGlobalError(''), 6000)
  }

  async function savePlanName() {
    setSavingName(true)
    const { error } = await supabase.from('workout_plans').update({ name: planName }).eq('id', plan.id)
    if (error) showError(`Nie udało się zapisać nazwy planu: ${error.message}`)
    setSavingName(false)
  }

  async function savePlanNotes() {
    setSavingNotes(true)
    const { error } = await supabase.from('workout_plans').update({ description: planNotes || null }).eq('id', plan.id)
    if (error) showError(`Błąd zapisu notatek: ${error.message}`)
    else { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2500) }
    setSavingNotes(false)
  }

  async function saveWholePlan() {
    setSavingPlan(true)
    setPlanSaveMessage('')

    try {
      const { error: planError } = await supabase
        .from('workout_plans')
        .update({ name: planName.trim() || plan.name })
        .eq('id', plan.id)
      if (planError) throw planError

      for (const day of localDays) {
        const { error } = await supabase
          .from('workout_days')
          .update({
            week_id: day.week_id,
            day_name: day.day_name,
            day_order: day.day_order,
          })
          .eq('id', day.id)
        if (error) throw error
      }

      for (const block of localBlocks) {
        const { error } = await supabase
          .from('workout_day_blocks')
          .update({
            day_id: block.day_id,
            block_name: block.block_name,
            block_order: block.block_order,
            rounds: block.rounds,
          })
          .eq('id', block.id)
        if (error) throw error

        for (const exercise of block.workout_block_exercises || []) {
          if (!exercise.id) continue
          const exercisePayload = {
            block_id: exercise.block_id,
            exercise_id: exercise.exercise_id || null,
            exercise_code: exercise.exercise_code || null,
            exercise_order: exercise.exercise_order,
            sets: exercise.sets,
            reps: exercise.reps || null,
            tempo: exercise.tempo || null,
            weight_kg: exercise.weight_kg ?? null,
            rir: exercise.rir ?? null,
            is_warmup: exercise.is_warmup,
            warmup_sets: exercise.is_warmup ? cleanWarmupSets(exercise.warmup_sets || []) : [],
            coach_comment: exercise.coach_comment || null,
            exercise_url: exercise.exercise_url || null,
          }
          let { error: exerciseError } = await supabase
            .from('workout_block_exercises')
            .update(exercisePayload)
            .eq('id', exercise.id)
          if (isWarmupColumnError(exerciseError)) {
            const fallbackResult = await supabase
              .from('workout_block_exercises')
              .update(exercisePayloadWithoutWarmup(exercisePayload))
              .eq('id', exercise.id)
            exerciseError = fallbackResult.error
          }
          if (exerciseError) throw exerciseError
        }
      }

      setPlanSaveMessage('Plan zapisany')
      router.push(backHref)
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error)
      setPlanSaveMessage(message && message !== '{}'
        ? `Blad zapisu: ${message}`
        : 'Nie udalo sie zapisac planu')
    } finally {
      setSavingPlan(false)
    }
  }

  async function addDay(weekId: number) {
    const weekDays = localDays.filter(day => day.week_id === weekId)
    const order = weekDays.length + 1
    const { data } = await supabase
      .from('workout_days')
      .insert({ week_id: weekId, day_name: `Trening ${order}`, day_order: order })
      .select()
      .single()
    if (data) {
      const newDay = data as Day
      setLocalDays(prev => [...prev, newDay])
      setTargetDays(prev => [...prev, newDay])
      setSelectedDayId(newDay.id)
    }
  }

  async function renameDay(dayId: number, newName: string) {
    const nextName = newName.trim() || 'Trening'
    const { error } = await supabase.from('workout_days').update({ day_name: nextName }).eq('id', dayId)
    if (error) { showError(`Nie udało się zapisać nazwy treningu: ${error.message}`); return }
    setLocalDays(prev => prev.map(day => day.id === dayId ? { ...day, day_name: nextName } : day))
    setTargetDays(prev => prev.map(day => day.id === dayId ? { ...day, day_name: nextName } : day))
  }

  async function saveCoachIntro(dayId: number, intro: string) {
    const value = intro.trim() || null
    const { error } = await supabase.from('workout_days').update({ coach_intro: value }).eq('id', dayId)
    if (error) { showError(`Nie udało się zapisać notatki wstępnej: ${error.message}`); return }
    setLocalDays(prev => prev.map(day => day.id === dayId ? { ...day, coach_intro: value } : day))
    setTargetDays(prev => prev.map(day => day.id === dayId ? { ...day, coach_intro: value } : day))
  }

  async function saveCoachClosing(dayId: number, closing: string) {
    const value = closing.trim() || null
    const { error } = await supabase.from('workout_days').update({ coach_closing: value }).eq('id', dayId)
    if (error) { showError(`Nie udało się zapisać notatki po treningu: ${error.message}`); return }
    setLocalDays(prev => prev.map(day => day.id === dayId ? { ...day, coach_closing: value } : day))
    setTargetDays(prev => prev.map(day => day.id === dayId ? { ...day, coach_closing: value } : day))
  }

  async function deleteDay(dayId: number) {
    if (!confirm('Usunac ten trening razem z blokami i cwiczeniami?')) return
    // CASCADE na FK usuwa bloki i ćwiczenia automatycznie; sessions dostaną workout_day_id = NULL
    const { data: deleted, error } = await supabase.from('workout_days').delete().eq('id', dayId).select('id')
    if (error) { showError(`Błąd usuwania treningu: ${error.message}`); return }
    if (!deleted || deleted.length === 0) {
      showError('Usuwanie zablokowane przez RLS — sprawdź polityki w Supabase Dashboard.')
      return
    }
    setLocalDays(prev => prev.filter(day => day.id !== dayId))
    setLocalBlocks(prev => prev.filter(block => block.day_id !== dayId))
    setTargetDays(prev => prev.filter(day => day.id !== dayId))
    setTargetBlocks(prev => prev.filter(block => block.day_id !== dayId))
    if (selectedDayId === dayId) {
      const nextDay = localDays.find(day => day.id !== dayId)
      setSelectedDayId(nextDay?.id || null)
    }
  }

  async function addWeek() {
    const nextNum = localWeeks.length + 1
    const { data: weekData } = await supabase
      .from('workout_weeks')
      .insert({ plan_id: plan.id, week_number: nextNum, name: `Tydzien ${nextNum}` })
      .select()
      .single()

    if (!weekData) return
    const newWeek = weekData as Week
    setLocalWeeks(prev => [...prev, newWeek])
    setTargetWeeks(prev => [...prev, newWeek])

    const { data: newDays } = await supabase
      .from('workout_days')
      .insert([
        { week_id: newWeek.id, day_name: 'Trening 1', day_order: 1 },
        { week_id: newWeek.id, day_name: 'Trening 2', day_order: 2 },
      ])
      .select()

    if (newDays) {
      const createdDays = newDays as Day[]
      setLocalDays(prev => [...prev, ...createdDays])
      setTargetDays(prev => [...prev, ...createdDays])
      setSelectedDayId(createdDays[0]?.id || null)
    }
  }

  async function addBlock(dayId?: number) {
    const targetDay = dayId ?? selectedDayId
    if (!targetDay) return
    const existingBlocks = localBlocks.filter(block => block.day_id === targetDay)
    const order = existingBlocks.length + 1
    const { data } = await supabase
      .from('workout_day_blocks')
      .insert({ day_id: targetDay, block_name: nextBlockName(existingBlocks.length), block_order: order, rounds: 3 })
      .select()
      .single()
    if (data) {
      const newBlock = { ...(data as Block), workout_block_exercises: [] }
      setLocalBlocks(prev => [...prev, newBlock])
      setTargetBlocks(prev => [...prev, newBlock])
    }
  }

  async function copyBlockToAllDays(block: Block) {
    const otherDays = localDays.filter(day => day.id !== block.day_id)
    if (otherDays.length === 0) { showError('Brak innych treningów w planie.'); return }
    if (!confirm(`Skopiować blok "${block.block_name}" do ${otherDays.length} pozostałych treningów?`)) return

    const newBlocks: Block[] = []
    for (const day of otherDays) {
      const dayBlocks = localBlocks.filter(b => b.day_id === day.id)
      const order = dayBlocks.length + 1
      const { data: blockData } = await supabase
        .from('workout_day_blocks')
        .insert({ day_id: day.id, block_name: block.block_name, block_order: order, rounds: block.rounds })
        .select()
        .single()
      if (!blockData) continue

      const exercises = block.workout_block_exercises || []
      let copiedExercises: BlockExercise[] = []
      if (exercises.length > 0) {
        const rowFor = (ex: BlockExercise) => ({
          block_id: (blockData as Block).id,
          exercise_id: ex.exercise_id || null,
          exercise_code: ex.exercise_code || null,
          exercise_order: ex.exercise_order,
          sets: ex.sets,
          reps: ex.reps || null,
          tempo: ex.tempo || null,
          weight_kg: ex.weight_kg ?? null,
          rir: ex.rir ?? null,
          is_warmup: ex.is_warmup,
          warmup_sets: ex.warmup_sets || [],
          coach_comment: ex.coach_comment || null,
          exercise_url: ex.exercise_url || null,
          // osobne wartości serii i ISO — jak w oryginale
          work_sets: ex.work_sets || [],
          iso: !!ex.iso,
          ...(ex.ecc ? { ecc: true } : {}),
          iso_type: ex.iso ? (ex.iso_type || null) : null,
        })
        // warianty (1b, 1c...) kopiujemy z przepiętym variant_of na nowe ćwiczenia bazowe
        let { data: exData, error: exErr } = await insertExercisesWithVariants(supabase, exercises, rowFor)
        if (exErr && (isWorkSetsColumnError(exErr) || isIsoColumnError(exErr))) {
          // brak kolumn work_sets / iso w bazie — skopiuj bez nich (usuń to, co już weszło)
          if (exData.length) await supabase.from('workout_block_exercises').delete().in('id', exData.map((e: any) => e.id))
          ;({ data: exData, error: exErr } = await insertExercisesWithVariants(supabase, exercises, ex => exercisePayloadWithoutIso(exercisePayloadWithoutWorkSets(rowFor(ex)))))
        }
        if (exErr) showError(`Nie udało się skopiować ćwiczeń bloku: ${exErr.message}`)
        copiedExercises = (exData as BlockExercise[]) || []
      }

      newBlocks.push({ ...(blockData as Block), workout_block_exercises: copiedExercises })
    }

    setLocalBlocks(prev => [...prev, ...newBlocks])
    setTargetBlocks(prev => [...prev, ...newBlocks])
  }

  async function deleteBlock(blockId: number) {
    if (!confirm('Usunac ten blok razem z cwiczeniami?')) return
    // CASCADE usuwa ćwiczenia automatycznie
    const { data: deleted, error } = await supabase.from('workout_day_blocks').delete().eq('id', blockId).select('id')
    if (error) { showError(`Błąd usuwania bloku: ${error.message}`); return }
    if (!deleted || deleted.length === 0) {
      showError('Usuwanie zablokowane przez RLS — sprawdź polityki w Supabase Dashboard.')
      return
    }
    setLocalBlocks(prev => prev.filter(block => block.id !== blockId))
    setTargetBlocks(prev => prev.filter(block => block.id !== blockId))
  }

  async function renameBlock(blockId: number, name: string) {
    const nextName = name.trim() || 'Blok'
    const { error } = await supabase.from('workout_day_blocks').update({ block_name: nextName }).eq('id', blockId)
    if (error) { showError(`Nie udało się zapisać nazwy bloku: ${error.message}`); return }
    setLocalBlocks(prev => prev.map(block => block.id === blockId ? { ...block, block_name: nextName } : block))
    setTargetBlocks(prev => prev.map(block => block.id === blockId ? { ...block, block_name: nextName } : block))
  }

  function handleExerciseSave(blockId: number, savedExercise: BlockExercise) {
    setLocalBlocks(prev => prev.map(block => {
      if (block.id !== blockId) return block
      const existing = (block.workout_block_exercises || []).find(exercise => exercise.id === savedExercise.id)
      return {
        ...block,
        workout_block_exercises: existing
          ? (block.workout_block_exercises || []).map(exercise => exercise.id === savedExercise.id ? savedExercise : exercise)
          : [...(block.workout_block_exercises || []), savedExercise],
      }
    }))
    setTargetBlocks(prev => prev.map(block => {
      if (block.id !== blockId) return block
      const existing = (block.workout_block_exercises || []).find(exercise => exercise.id === savedExercise.id)
      return {
        ...block,
        workout_block_exercises: existing
          ? (block.workout_block_exercises || []).map(exercise => exercise.id === savedExercise.id ? savedExercise : exercise)
          : [...(block.workout_block_exercises || []), savedExercise],
      }
    }))
  }

  // Edycja komórki tabeli — od razu w stanie i w bazie (bez czekania na „Zapisz plan")
  async function updateExercise(blockId: number, exercise: BlockExercise, patch: ExercisePatch) {
    const apply = (list: Block[]) => list.map(block => block.id !== blockId ? block : {
      ...block,
      workout_block_exercises: (block.workout_block_exercises || []).map(item => item.id === exercise.id ? { ...item, ...patch } : item),
    })
    setLocalBlocks(apply)
    setTargetBlocks(apply)
    if (!exercise.id) return

    // relacji `exercise` nie zapisujemy — tylko kolumny tabeli
    const { exercise: _rel, ...columns } = patch
    let payload: Record<string, any> = { ...columns }
    if ('warmup_sets' in payload) payload.warmup_sets = payload.is_warmup === false ? [] : cleanWarmupSets(payload.warmup_sets || [])
    let { error } = await supabase.from('workout_block_exercises').update(payload).eq('id', exercise.id)
    if (error && isWorkSetsColumnError(error)) {
      const { work_sets: _w, ...rest } = payload
      payload = rest
      ;({ error } = await supabase.from('workout_block_exercises').update(payload).eq('id', exercise.id))
    }
    if (error && isWarmupColumnError(error)) {
      const { warmup_sets: _ws, ...rest } = payload
      ;({ error } = await supabase.from('workout_block_exercises').update(rest).eq('id', exercise.id))
    }
    if (error) showError(`Nie udało się zapisać zmiany: ${error.message}`)
  }

  function handleExerciseDelete(blockId: number, exerciseId?: number) {
    if (!exerciseId) return
    setLocalBlocks(prev => prev.map(block => block.id === blockId
      ? { ...block, workout_block_exercises: (block.workout_block_exercises || []).filter(exercise => exercise.id !== exerciseId && exercise.variant_of !== exerciseId) }
      : block
    ))
    setTargetBlocks(prev => prev.map(block => block.id === blockId
      ? { ...block, workout_block_exercises: (block.workout_block_exercises || []).filter(exercise => exercise.id !== exerciseId && exercise.variant_of !== exerciseId) }
      : block
    ))
  }

  // ── Przeciąganie w obrębie treningu ──
  // Ćwiczenie (z wariantami) na miejsce innego albo na koniec bloku — numeracja liczy się od nowa
  async function dropExercise(exerciseId: number, fromBlockId: number, toBlockId: number, targetBaseId: number | null) {
    const from = localBlocks.find(b => b.id === fromBlockId)
    const to = localBlocks.find(b => b.id === toBlockId)
    if (!from || !to || from.day_id !== to.day_id) return
    const result = moveExercise(from.workout_block_exercises || [], to.workout_block_exercises || [], exerciseId, fromBlockId, toBlockId, targetBaseId)
    if (!result || result.updates.length === 0) return
    const apply = (list: Block[]) => list.map(b =>
      b.id === toBlockId ? { ...b, workout_block_exercises: result.to }
        : b.id === fromBlockId ? { ...b, workout_block_exercises: result.from }
          : b)
    setLocalBlocks(apply)
    setTargetBlocks(apply)
    const results = await Promise.all(result.updates.map(u =>
      supabase.from('workout_block_exercises').update({ block_id: u.block_id, exercise_order: u.exercise_order }).eq('id', u.id)))
    const failed = results.find(r => r.error)
    if (failed?.error) showError(`Nie udało się zapisać nowej kolejności: ${failed.error.message}`)
  }

  // Cały blok na miejsce innego bloku w tym samym treningu — litery A/B/C liczą się od nowa
  async function dropBlock(blockId: number, targetBlockId: number) {
    const block = localBlocks.find(b => b.id === blockId)
    if (!block) return
    const result = moveBlock(localBlocks.filter(b => b.day_id === block.day_id), blockId, targetBlockId)
    if (!result || result.updates.length === 0) return
    // Domyślne nazwy „Blok A/B/C" idą za nową pozycją; własne nazwy zostają bez zmian
    const renamed = new Map<number, string>()
    result.blocks.forEach((b, i) => {
      const name = (b as Block).block_name
      if (/^Blok [A-Z]$/.test(name || '') && name !== nextBlockName(i)) renamed.set(b.id, nextBlockName(i))
    })
    const newOrder = new Map(result.blocks.map(b => [b.id, b.block_order]))
    const apply = (list: Block[]) => list.map(b => newOrder.has(b.id)
      ? { ...b, block_order: newOrder.get(b.id)!, ...(renamed.has(b.id) ? { block_name: renamed.get(b.id)! } : {}) }
      : b)
    setLocalBlocks(apply)
    setTargetBlocks(apply)
    const changedIds = new Set([...result.updates.map(u => u.id), ...renamed.keys()])
    const results = await Promise.all([...changedIds].map(id =>
      supabase.from('workout_day_blocks').update({ block_order: newOrder.get(id), ...(renamed.has(id) ? { block_name: renamed.get(id) } : {}) }).eq('id', id)))
    const failed = results.find(r => r.error)
    if (failed?.error) showError(`Nie udało się zapisać nowej kolejności bloków: ${failed.error.message}`)
  }

  // ── Warianty ćwiczenia (1a/1b/1c) ──
  const [assignSlot, setAssignSlot] = useState<{ blockId: number; baseId: number } | null>(null)

  // Nowy wariant: formularz ćwiczenia z variant_of → baza; po zapisie od razu przydział zawodniczek
  function addVariant(blockId: number, base: BlockExercise) {
    if (!base.id) return
    setEditingExercise({ block_id: blockId, exercise_order: base.exercise_order, sets: base.sets || 3, is_warmup: false, variant_of: base.id, variant_athlete_ids: [] })
  }

  function slotOptions(blockId: number, baseId: number) {
    const exs = sortWithVariants((localBlocks.find(b => b.id === blockId)?.workout_block_exercises || []).filter(e => e.id === baseId || e.variant_of === baseId))
    const labels = variantLabels(sortWithVariants(localBlocks.find(b => b.id === blockId)?.workout_block_exercises || []))
    const labelOf = (e: BlockExercise) => [...labels.entries()].find(([k]) => k.id === e.id)?.[1] ?? ''
    return exs.map(e => ({ exercise: e, label: labelOf(e), name: formatExerciseName(e.exercise?.name || e.exercise_code || 'Ćwiczenie') }))
  }

  async function saveVariantAssignment(blockId: number, assignment: Map<number, number[]>) {
    for (const [variantId, ids] of assignment) {
      const { error } = await supabase.from('workout_block_exercises').update({ variant_athlete_ids: ids }).eq('id', variantId)
      if (error) {
        showError(/variant_athlete_ids/.test(error.message) ? 'Aby dodawać warianty ćwiczeń, uruchom migrację 202610050003.' : `Nie udało się zapisać przydziału: ${error.message}`)
        return
      }
    }
    const apply = (list: Block[]) => list.map(block => block.id !== blockId ? block : {
      ...block,
      workout_block_exercises: (block.workout_block_exercises || []).map(e => e.id != null && assignment.has(e.id) ? { ...e, variant_athlete_ids: assignment.get(e.id) } : e),
    })
    setLocalBlocks(apply)
    setTargetBlocks(apply)
  }

  async function deleteExercise(blockId: number, exerciseId?: number) {
    if (!exerciseId) return
    const variantCount = (localBlocks.find(b => b.id === blockId)?.workout_block_exercises || []).filter(e => e.variant_of === exerciseId).length
    if (!confirm(variantCount
      ? `Usunąć to ćwiczenie razem z jego wariantami (${variantCount})?`
      : 'Usunąć to ćwiczenie z bloku? (wariant: jego zawodniczki wrócą do ćwiczenia bazowego)')) return
    const { data: deleted, error } = await supabase.from('workout_block_exercises').delete().eq('id', exerciseId).select('id')
    if (error) { showError(`Błąd usuwania ćwiczenia: ${error.message}`); return }
    if (!deleted || deleted.length === 0) {
      showError('Usuwanie zablokowane przez RLS — uruchom SQL z politykami w Supabase Dashboard.')
      return
    }
    handleExerciseDelete(blockId, exerciseId)
  }

  async function handleMove(targetId: number) {
    if (!movingItem) return

    if (movingItem.type === 'exercise') {
      const targetBlock = targetBlocks.find(block => block.id === targetId)
      if (!targetBlock || !movingItem.exercise.id) return

      const { count } = await supabase
        .from('workout_block_exercises')
        .select('id', { count: 'exact', head: true })
        .eq('block_id', targetId)
      const targetOrder = (count || 0) + 1
      await supabase
        .from('workout_block_exercises')
        .update({ block_id: targetId, exercise_order: targetOrder })
        .eq('id', movingItem.exercise.id)
      // warianty idą razem ze swoim ćwiczeniem bazowym
      const movingIds = new Set<number>([movingItem.exercise.id])
      const variantsToMove = (localBlocks.find(b => b.id === movingItem.fromBlockId)?.workout_block_exercises || []).filter(e => e.variant_of === movingItem.exercise.id)
      if (variantsToMove.length) {
        await supabase.from('workout_block_exercises').update({ block_id: targetId, exercise_order: targetOrder }).eq('variant_of', movingItem.exercise.id)
        variantsToMove.forEach(v => v.id != null && movingIds.add(v.id))
      }
      const movedRows = [{ ...movingItem.exercise, block_id: targetId, exercise_order: targetOrder }, ...variantsToMove.map(v => ({ ...v, block_id: targetId, exercise_order: targetOrder }))]

      setLocalBlocks(prev => prev.map(block => {
        if (block.id === movingItem.fromBlockId) {
          return { ...block, workout_block_exercises: (block.workout_block_exercises || []).filter(exercise => !movingIds.has(exercise.id as number)) }
        }
        if (block.id === targetId) {
          return { ...block, workout_block_exercises: [...(block.workout_block_exercises || []), ...movedRows] }
        }
        return block
      }))
      setTargetBlocks(prev => prev.map(block => block.id === targetId
        ? {
            ...block,
            workout_block_exercises: [...(block.workout_block_exercises || []), ...movedRows],
          }
        : block
      ))
      return
    }

    if (movingItem.type === 'block') {
      const targetDay = targetDays.find(day => day.id === targetId)
      if (!targetDay) return

      const targetOrder = targetBlocks.filter(block => block.day_id === targetId).length + 1
      await supabase
        .from('workout_day_blocks')
        .update({ day_id: targetId, block_order: targetOrder })
        .eq('id', movingItem.block.id)

      const movedBlock = { ...movingItem.block, day_id: targetId, block_order: targetOrder }
      setLocalBlocks(prev => {
        const withoutBlock = prev.filter(block => block.id !== movingItem.block.id)
        return targetDays.some(day => day.id === targetId && localWeeks.some(week => week.id === day.week_id))
          ? [...withoutBlock, movedBlock]
          : withoutBlock
      })
      setTargetBlocks(prev => prev.map(block => block.id === movingItem.block.id ? movedBlock : block))
      return
    }

    const targetWeek = targetWeeks.find(week => week.id === targetId)
    if (!targetWeek) return

    const targetOrder = targetDays.filter(day => day.week_id === targetId).length + 1
    await supabase
      .from('workout_days')
      .update({ week_id: targetId, day_order: targetOrder })
      .eq('id', movingItem.day.id)

    const movedDay = { ...movingItem.day, week_id: targetId, day_order: targetOrder }
    const isCurrentPlanTarget = targetWeek.plan_id === plan.id
    setLocalDays(prev => {
      const withoutDay = prev.filter(day => day.id !== movingItem.day.id)
      return isCurrentPlanTarget ? [...withoutDay, movedDay] : withoutDay
    })
    setTargetDays(prev => prev.map(day => day.id === movingItem.day.id ? movedDay : day))
    if (!isCurrentPlanTarget && selectedDayId === movingItem.day.id) {
      setSelectedDayId(localDays.find(day => day.id !== movingItem.day.id)?.id || null)
    }
  }

  return (
    <>
      <SetPageMeta title={plan.name} backHref={backHref} backLabel={plan.group_id ? "Plan grupy" : "Plany"} sidebarCollapsible />

      <div className="coach-content">
        {globalError && (
          <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#fef2f2', border: '1.5px solid #c23b3b', borderRadius: 12, padding: '0.75rem 1.25rem', color: '#c23b3b', fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.86rem', boxShadow: 'var(--shadow)', maxWidth: 520, width: 'calc(100vw - 2rem)', textAlign: 'center' }}>
            {globalError}
          </div>
        )}

        {showWellness && (
          <PlanWellnessConfig planId={plan.id} onClose={() => setShowWellness(false)} />
        )}

        {movingItem && (
          <MoveModal
            item={movingItem}
            plans={allPlans}
            weeks={targetWeeks}
            days={targetDays}
            blocks={targetBlocks}
            onMove={handleMove}
            onClose={() => setMovingItem(null)}
          />
        )}

        <div className="coach-editor-hero">
          <div className="coach-editor-hero-left" style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Pokaż menu' : 'Zwiń menu — więcej miejsca'}
                style={{ flexShrink: 0, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: 'var(--gold-light)', borderRadius: 6, outline: 'none' }}
              >
                {sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
              </button>
              <div className="coach-eyebrow" style={{ margin: 0 }}>Edytor planu</div>
            </div>
            <input
              value={planName}
              onChange={event => setPlanName(event.target.value)}
              onBlur={savePlanName}
              style={{ display: 'block', width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontWeight: 600, fontSize: 20, margin: '2px 0 10px', fontFamily: 'inherit' }}
            />
            <div className="coach-editor-notes-row">
              <textarea
                value={planNotes}
                onChange={e => setPlanNotes(e.target.value)}
                placeholder="Notatki dla zawodniczek (skróty, wskazówki) — widoczne w panelu ℹ️ podczas treningu..."
                rows={2}
              />
              <button className="coach-btn coach-btn-gold coach-btn-small" onClick={savePlanNotes} disabled={savingNotes} style={{ flexShrink: 0 }}>
                {savingNotes ? '...' : notesSaved ? '✓ Zapisano' : 'Zapisz notatki'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <div className="coach-editor-hero-right">
              <button className="coach-btn coach-btn-gold coach-btn-small" onClick={() => setShowWellness(true)} title="Skonfiguruj pola gotowości do treningu">
                <ClipboardList size={14} /> Feedback treningowy
              </button>
              <button className="coach-btn coach-btn-dark" onClick={saveWholePlan} disabled={savingPlan} style={{ minWidth: 126 }}>
                {savingPlan ? 'Zapisuje...' : 'Zapisz plan'}
              </button>
            </div>
            <div className="coach-editor-status">
              {planSaveMessage || (savingName ? 'zapisuje nazwe...' : 'gotowy do zapisu')}
            </div>
          </div>
        </div>

        {/* Pełna edycja / dodawanie ćwiczenia (biblioteka, ISO, osobne serie, rozgrzewka) */}
        {editingExercise && (
          <Modal
            open
            wide
            onClose={() => setEditingExercise(null)}
            eyebrow={(() => {
              const block = localBlocks.find(b => b.id === editingExercise.block_id)
              const day = localDays.find(d => d.id === block?.day_id)
              return [day?.day_name, block?.block_name].filter(Boolean).join(' · ') || 'Ćwiczenie'
            })()}
            title={editingExercise.id ? 'Edytuj ćwiczenie' : editingExercise.variant_of != null ? 'Dodaj wariant ćwiczenia' : 'Dodaj ćwiczenie'}
          >
            <ExerciseEditForm
              key={editingExercise.id ?? `new-${editingExercise.block_id}`}
              exercise={editingExercise}
              exercises={exercises}
              onSave={saved => {
                handleExerciseSave(editingExercise.block_id, saved)
                // nowy wariant — od razu wybór, kto go robi
                if (!editingExercise.id && saved.variant_of != null) setAssignSlot({ blockId: editingExercise.block_id, baseId: saved.variant_of })
                setEditingExercise(null)
              }}
              onDelete={() => { handleExerciseDelete(editingExercise.block_id, editingExercise.id); setEditingExercise(null) }}
              onClose={() => setEditingExercise(null)}
            />
          </Modal>
        )}

        <PlanTableView
          plan={plan}
          weeks={localWeeks}
          days={localDays}
          blocks={localBlocks}
          onUpdateExercise={updateExercise}
          onAddWeek={addWeek}
          onAddDay={addDay}
          onRenameDay={renameDay}
          onDeleteDay={deleteDay}
          onMoveDay={day => setMovingItem({ type: 'day', day })}
          onSaveDayMessage={(dayId, field, value) => field === 'coach_intro' ? saveCoachIntro(dayId, value) : saveCoachClosing(dayId, value)}
          onAddBlock={addBlock}
          onRenameBlock={renameBlock}
          onCopyBlock={copyBlockToAllDays}
          onMoveBlock={block => setMovingItem({ type: 'block', block })}
          onDeleteBlock={deleteBlock}
          onAddExercise={blockId => setEditingExercise({ block_id: blockId, exercise_order: (localBlocks.find(b => b.id === blockId)?.workout_block_exercises?.length ?? 0) + 1, sets: 3, is_warmup: false })}
          onEditExercise={(blockId, exercise) => setEditingExercise({ ...exercise, block_id: blockId })}
          onMoveExercise={(blockId, exercise) => setMovingItem({ type: 'exercise', exercise: { ...exercise, block_id: blockId }, fromBlockId: blockId })}
          onDeleteExercise={deleteExercise}
          athletes={athletes}
          onAddVariant={addVariant}
          onDropExercise={dropExercise}
          onDropBlock={dropBlock}
          onAssignVariants={(blockId, baseId) => setAssignSlot({ blockId, baseId })}
        />

        {assignSlot && (
          <VariantAssignModal
            key={`${assignSlot.blockId}-${assignSlot.baseId}`}
            options={slotOptions(assignSlot.blockId, assignSlot.baseId)}
            athletes={athletes}
            onSave={assignment => saveVariantAssignment(assignSlot.blockId, assignment)}
            onClose={() => setAssignSlot(null)}
          />
        )}
      </div>
    </>
  )
}
