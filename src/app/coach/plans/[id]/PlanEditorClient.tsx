'use client'
// src/app/coach/plans/[id]/PlanEditorClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { LayoutGrid, Table2, ClipboardList, Plus, X, Move, Trash2, Copy, Pencil } from 'lucide-react'
import PlanTableView from './PlanTableView'
import PlanWellnessConfig from '@/components/PlanWellnessConfig'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Modal, Button, Field } from '@/components/coach/ui'

type Plan = {
  id: number
  name: string
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
  coach_comment?: string | null
  exercise_url?: string | null
  exercise?: ExerciseLibraryItem | null
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
  return message.includes('warmup_sets') || message.includes('schema cache')
}

function exercisePayloadWithoutWarmup<T extends { warmup_sets?: WarmupSet[] }>(payload: T) {
  const rest = { ...payload }
  delete rest.warmup_sets
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
  const [sets, setSets] = useState(exercise.sets?.toString() || '3')
  const [reps, setReps] = useState(exercise.reps || '')
  const [tempo, setTempo] = useState(exercise.tempo || '')
  const [weightKg, setWeightKg] = useState(exercise.weight_kg?.toString() || '')
  const [rir, setRir] = useState(exercise.rir?.toString() || '')
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

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError('')
    const payload = {
      block_id: exercise.block_id,
      exercise_id: !useCustomName && exerciseId ? parseInt(exerciseId) : null,
      exercise_code: useCustomName ? exerciseCode.trim() : null,
      exercise_order: exercise.exercise_order,
      sets: parseInt(sets) || 3,
      reps: reps.trim() || null,
      tempo: tempo.trim() || null,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      rir: rir ? parseInt(rir) : null,
      coach_comment: comment.trim() || null,
      is_warmup: isWarmup,
      warmup_sets: isWarmup ? cleanWarmupSets(warmupSets) : [],
      exercise_url: exerciseUrl.trim() || null,
    }

    const result = isNew
      ? await supabase.from('workout_block_exercises').insert(payload).select('*, exercise:exercises(*)')
      : await supabase.from('workout_block_exercises').update(payload).eq('id', exercise.id)
    let data = 'data' in result ? result.data : null
    let error = result.error
    if (isWarmupColumnError(error)) {
      const fallbackPayload = exercisePayloadWithoutWarmup(payload)
      const fallbackResult = isNew
        ? await supabase.from('workout_block_exercises').insert(fallbackPayload).select('*, exercise:exercises(*)')
        : await supabase.from('workout_block_exercises').update(fallbackPayload).eq('id', exercise.id)
      data = fallbackResult.data
      error = fallbackResult.error
    }
    setSaving(false)
    if (error) {
      const isMissingWarmupColumn = isWarmupColumnError(error)
      setSaveError(isMissingWarmupColumn
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

      <div className="coach-field-grid-5">
        <Field label="Serie">
          <input type="number" value={sets} onChange={e => setSets(e.target.value)} style={{ textAlign: 'center' }} />
        </Field>
        <Field label="Powt.">
          <input value={reps} onChange={e => setReps(e.target.value)} placeholder="8-10" style={{ textAlign: 'center' }} />
        </Field>
        <Field label="Ciężar">
          <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="-" style={{ textAlign: 'center' }} />
        </Field>
        <Field label="Tempo">
          <input value={tempo} onChange={e => setTempo(e.target.value)} placeholder="3-1-2-0" style={{ textAlign: 'center' }} />
        </Field>
        <Field label="RIR">
          <input type="number" value={rir} onChange={e => setRir(e.target.value)} placeholder="-" style={{ textAlign: 'center' }} />
        </Field>
      </div>

      <div className="coach-chip-select-row">
        {['2', '3', '4', '5'].map(value => (
          <button key={value} type="button" className={`coach-chip-select ${sets === value ? 'coach-active' : ''}`} onClick={() => setSets(value)}>
            {value} serie
          </button>
        ))}
      </div>
      <div className="coach-chip-select-row">
        {['3-1-2-0', '4-0-1-0', '3-0-1-0'].map(value => (
          <button key={value} type="button" className={`coach-chip-select ${tempo === value ? 'coach-active' : ''}`} onClick={() => setTempo(value)}>
            {value}
          </button>
        ))}
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
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '38px 1fr 1fr 1.4fr 30px', gap: 6, alignItems: 'center' }}>
                <div style={{ height: 32, borderRadius: 8, background: 'var(--navy-900)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                  R{index + 1}
                </div>
                <input value={set.reps || ''} onChange={e => updateWarmupSet(index, 'reps', e.target.value)} placeholder="powt." style={{ textAlign: 'center' }} />
                <input value={set.weight_kg || ''} onChange={e => updateWarmupSet(index, 'weight_kg', e.target.value)} placeholder="kg" style={{ textAlign: 'center' }} />
                <input value={set.note || ''} onChange={e => updateWarmupSet(index, 'note', e.target.value)} placeholder="komentarz" />
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

export default function PlanEditorClient({ plan, weeks, days, blocks, exercises, allPlans, allWeeks, allDays, allBlocks }: Props) {
  const router = useRouter()
  const supabase = createClient()

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
  const [viewMode, setViewMode] = useState<'blocks' | 'table'>('blocks')
  const [showWellness, setShowWellness] = useState(false)

  const currentDay = localDays.find(day => day.id === selectedDayId)
  const currentWeek = localWeeks.find(week => week.id === currentDay?.week_id)
  const currentDayBlocks = localBlocks
    .filter(block => block.day_id === selectedDayId)
    .sort((a, b) => a.block_order - b.block_order)

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
      router.push('/coach/plans')
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

  async function saveCoachOutro(dayId: number, outro: string) {
    const value = outro.trim() || null
    const { error } = await supabase.from('workout_days').update({ coach_outro: value }).eq('id', dayId)
    if (error) { showError(`Nie udało się zapisać notatki końcowej: ${error.message}`); return }
    setLocalDays(prev => prev.map(day => day.id === dayId ? { ...day, coach_outro: value } : day))
    setTargetDays(prev => prev.map(day => day.id === dayId ? { ...day, coach_outro: value } : day))
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

  async function addBlockToAllDays() {
    if (!confirm(`Dodać nowy blok do wszystkich ${localDays.length} treningów w planie?`)) return
    const newBlocks: Block[] = []
    for (const day of localDays) {
      const dayBlocks = localBlocks.filter(block => block.day_id === day.id)
      const order = dayBlocks.length + 1
      const { data } = await supabase
        .from('workout_day_blocks')
        .insert({ day_id: day.id, block_name: nextBlockName(dayBlocks.length), block_order: order, rounds: 3 })
        .select()
        .single()
      if (data) newBlocks.push({ ...(data as Block), workout_block_exercises: [] })
    }
    setLocalBlocks(prev => [...prev, ...newBlocks])
    setTargetBlocks(prev => [...prev, ...newBlocks])
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
        const { data: exData } = await supabase
          .from('workout_block_exercises')
          .insert(exercises.map(ex => ({
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
          })))
          .select('*, exercise:exercises(*)')
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

  async function updateBlockRounds(blockId: number, rounds: number) {
    const { error } = await supabase.from('workout_day_blocks').update({ rounds }).eq('id', blockId)
    if (error) { showError(`Nie udało się zapisać liczby rund: ${error.message}`); return }
    setLocalBlocks(prev => prev.map(block => block.id === blockId ? { ...block, rounds } : block))
    setTargetBlocks(prev => prev.map(block => block.id === blockId ? { ...block, rounds } : block))
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

  function handleExerciseDelete(blockId: number, exerciseId?: number) {
    if (!exerciseId) return
    setLocalBlocks(prev => prev.map(block => block.id === blockId
      ? { ...block, workout_block_exercises: (block.workout_block_exercises || []).filter(exercise => exercise.id !== exerciseId) }
      : block
    ))
    setTargetBlocks(prev => prev.map(block => block.id === blockId
      ? { ...block, workout_block_exercises: (block.workout_block_exercises || []).filter(exercise => exercise.id !== exerciseId) }
      : block
    ))
  }

  async function deleteExercise(blockId: number, exerciseId?: number) {
    if (!exerciseId) return
    if (!confirm('Usunac to cwiczenie z bloku?')) return
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

      setLocalBlocks(prev => prev.map(block => {
        if (block.id === movingItem.fromBlockId) {
          return { ...block, workout_block_exercises: (block.workout_block_exercises || []).filter(exercise => exercise.id !== movingItem.exercise.id) }
        }
        if (block.id === targetId) {
          return {
            ...block,
            workout_block_exercises: [
              ...(block.workout_block_exercises || []),
              { ...movingItem.exercise, block_id: targetId, exercise_order: targetOrder },
            ],
          }
        }
        return block
      }))
      setTargetBlocks(prev => prev.map(block => block.id === targetId
        ? {
            ...block,
            workout_block_exercises: [
              ...(block.workout_block_exercises || []),
              { ...movingItem.exercise, block_id: targetId, exercise_order: targetOrder },
            ],
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
      <SetPageMeta title={plan.name} backHref="/coach/plans" backLabel="Plany" />

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
            <div className="coach-eyebrow">Edytor planu</div>
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
              <div className="coach-view-toggle">
                <button className={viewMode === 'blocks' ? 'coach-active' : ''} onClick={() => setViewMode('blocks')}>
                  <LayoutGrid size={14} /> Bloki
                </button>
                <button className={viewMode === 'table' ? 'coach-active' : ''} onClick={() => setViewMode('table')}>
                  <Table2 size={14} /> Tabelka
                </button>
              </div>
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

        {viewMode === 'table' ? (
          <PlanTableView
            plan={plan}
            weeks={localWeeks}
            days={localDays}
            blocks={localBlocks}
            onBlocksChange={next => { setLocalBlocks(next); setTargetBlocks(next) }}
            onAddWeek={addWeek}
            onAddDay={addDay}
            onAddBlock={addBlock}
            onAddExercise={blockId => setEditingExercise({ block_id: blockId, exercise_order: (localBlocks.find(b => b.id === blockId)?.workout_block_exercises?.length ?? 0) + 1, sets: 3, is_warmup: false })}
          />
        ) : (
          <div className="coach-editor-layout">
            <aside className="coach-editor-sidebar">
              <div className="coach-editor-sidebar-head">
                <span className="coach-label">Struktura</span>
                <button className="coach-btn coach-btn-dark coach-btn-small" onClick={addWeek}><Plus size={12} /> tydz.</button>
              </div>

              {localWeeks.map(week => {
                const weekDays = localDays.filter(day => day.week_id === week.id).sort((a, b) => a.day_order - b.day_order)
                return (
                  <div className="coach-week-block" key={week.id}>
                    <div className="coach-week-label">Tydzien {week.week_number}</div>
                    {weekDays.map(day => {
                      const isActive = selectedDayId === day.id
                      return (
                        <div key={day.id} className={`coach-training-pill ${isActive ? 'coach-active' : ''}`} onClick={() => setSelectedDayId(day.id)}>
                          <div>
                            <div className="coach-training-pill-name">{day.day_name}</div>
                            <div className="coach-training-pill-count">{localBlocks.filter(block => block.day_id === day.id).length} blokow</div>
                          </div>
                          <button className="coach-training-pill-del" onClick={event => { event.stopPropagation(); deleteDay(day.id) }} title="Usun trening">
                            <X size={13} />
                          </button>
                        </div>
                      )
                    })}
                    <button className="coach-add-training-btn" onClick={() => addDay(week.id)}>+ dodaj trening</button>
                  </div>
                )
              })}
            </aside>

            <main className="coach-editor-main">
              {!selectedDayId || !currentDay ? (
                <div className="coach-empty-training">
                  <h3>Wybierz trening z listy</h3>
                  <p>Albo dodaj nowy tydzień po lewej, żeby zacząć.</p>
                </div>
              ) : (
                <>
                  <div className="coach-training-head-card">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="coach-training-head-eyebrow">Tydzien {currentWeek?.week_number || '-'}</div>
                      <input
                        value={currentDay.day_name}
                        onChange={event => setLocalDays(prev => prev.map(day => day.id === selectedDayId ? { ...day, day_name: event.target.value } : day))}
                        onBlur={event => renameDay(selectedDayId, event.target.value)}
                        className="coach-training-head-name"
                        style={{ display: 'block', width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: 22, color: 'var(--ink)' }}
                      />
                    </div>
                    <div className="coach-training-head-actions">
                      <button className="coach-btn coach-btn-dark coach-btn-small" onClick={() => addBlock()}><Plus size={14} /> Blok</button>
                      <button onClick={() => setMovingItem({ type: 'day', day: currentDay })} title="Przenieś trening" className="coach-icon-btn" data-tip="Przenieś trening">
                        <Move size={14} />
                      </button>
                      <button onClick={() => deleteDay(selectedDayId)} title="Usuń trening" className="coach-icon-btn coach-danger" data-tip="Usuń trening">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="coach-msg-card coach-pre">
                    <div className="coach-msg-card-label"><span>📣</span> Przemowa przed treningiem — widoczna jako pierwsza dla zawodniczek</div>
                    <textarea
                      value={currentDay.coach_intro || ''}
                      onChange={event => setLocalDays(prev => prev.map(day => day.id === selectedDayId ? { ...day, coach_intro: event.target.value } : day))}
                      onBlur={event => saveCoachIntro(selectedDayId, event.target.value)}
                      placeholder="Motywacja, wskazówki, na co zwrócić uwagę... Zawodniczki zobaczą to zanim zaczną ćwiczyć."
                      rows={3}
                    />
                  </div>

                  <div className="coach-msg-card coach-post">
                    <div className="coach-msg-card-label"><span>💙</span> Wiadomość po treningu — widoczna na końcu strony</div>
                    <textarea
                      value={currentDay.coach_closing || ''}
                      onChange={event => setLocalDays(prev => prev.map(day => day.id === selectedDayId ? { ...day, coach_closing: event.target.value } : day))}
                      onBlur={event => saveCoachClosing(selectedDayId, event.target.value)}
                      placeholder="Gratulacje, recovery, co dalej, kolejny trening... Zawodniczki zobaczą to na samym końcu, po wypełnieniu raportu."
                      rows={3}
                    />
                  </div>

                  {currentDayBlocks.map(block => {
                    const isAddingHere = !!editingExercise && !editingExercise.id && editingExercise.block_id === block.id
                    return (
                      <div className="coach-block-card" key={block.id}>
                        <div className="coach-block-card-head">
                          <input
                            value={block.block_name}
                            onChange={event => setLocalBlocks(prev => prev.map(item => item.id === block.id ? { ...item, block_name: event.target.value } : item))}
                            onBlur={event => renameBlock(block.id, event.target.value)}
                            className="coach-block-card-title"
                            style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, minWidth: 0, fontFamily: 'inherit' }}
                          />
                          <div className="coach-block-card-actions">
                            <div className="coach-rounds-chip">
                              <span>🔁</span>
                              <input
                                type="number" min={1} max={10} value={block.rounds}
                                onChange={event => updateBlockRounds(block.id, parseInt(event.target.value) || 1)}
                              />
                              <span>rund</span>
                            </div>
                            <button onClick={() => copyBlockToAllDays(block)} title="Kopiuj blok do wszystkich treningów" className="coach-icon-btn" data-tip="Kopiuj do treningów">
                              <Copy size={14} />
                            </button>
                            <button onClick={() => setMovingItem({ type: 'block', block })} title="Przenieś blok" className="coach-icon-btn" data-tip="Przenieś blok">
                              <Move size={14} />
                            </button>
                            <button onClick={() => deleteBlock(block.id)} title="Usuń blok" className="coach-icon-btn coach-danger" data-tip="Usuń blok">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="coach-block-card-body">
                          {(block.workout_block_exercises || [])
                            .sort((a, b) => a.exercise_order - b.exercise_order)
                            .map((exercise, index) => {
                              const isEditingThis = !!editingExercise && editingExercise.id != null && editingExercise.id === exercise.id
                              if (isEditingThis && editingExercise) {
                                return (
                                  <ExerciseEditForm
                                    key={exercise.id}
                                    exercise={editingExercise}
                                    exercises={exercises}
                                    onSave={saved => { handleExerciseSave(editingExercise.block_id, saved); setEditingExercise(null) }}
                                    onDelete={() => { handleExerciseDelete(editingExercise.block_id, editingExercise.id); setEditingExercise(null) }}
                                    onClose={() => setEditingExercise(null)}
                                  />
                                )
                              }
                              const name = formatExerciseName(exercise.exercise?.name || exercise.exercise_code || 'Cwiczenie')
                              const warmupCount = cleanWarmupSets(exercise.warmup_sets || []).length
                              return (
                                <div className="coach-exercise-row" key={exercise.id}>
                                  <div className="coach-exercise-order">{index + 1}</div>
                                  <div className="coach-exercise-body">
                                    <div className="coach-exercise-name">
                                      {name}
                                      {exercise.exercise_url && (
                                        <a href={exercise.exercise_url} target="_blank" rel="noopener noreferrer" title="Otwórz film/instrukcję" style={{ marginLeft: 6, textDecoration: 'none' }}>🔗</a>
                                      )}
                                    </div>
                                    <div className="coach-exercise-chips">
                                      <span className="coach-ex-chip">{exercise.sets}×{exercise.reps || '—'}</span>
                                      {exercise.tempo && <span className="coach-ex-chip">{exercise.tempo}</span>}
                                      {exercise.weight_kg && <span className="coach-ex-chip">{exercise.weight_kg} kg</span>}
                                      {exercise.rir !== null && exercise.rir !== undefined && <span className="coach-ex-chip">RIR {exercise.rir}</span>}
                                      {exercise.is_warmup && <span className="coach-ex-chip coach-warmup">🔥 rozgrzewka ×{warmupCount || 1}</span>}
                                    </div>
                                    {exercise.coach_comment && <div className="coach-exercise-comment">{exercise.coach_comment}</div>}
                                  </div>
                                  <div className="coach-exercise-actions">
                                    <button onClick={() => setMovingItem({ type: 'exercise', exercise: { ...exercise, block_id: block.id }, fromBlockId: block.id })} title="Przenieś" className="coach-icon-btn" data-tip="Przenieś">
                                      <Move size={14} />
                                    </button>
                                    <button onClick={() => setEditingExercise({ ...exercise, block_id: block.id })} title="Edytuj" className="coach-icon-btn" data-tip="Edytuj">
                                      <Pencil size={14} />
                                    </button>
                                    <button onClick={() => deleteExercise(block.id, exercise.id)} title="Usuń" className="coach-icon-btn coach-danger" data-tip="Usuń">
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}

                          {isAddingHere && editingExercise && (
                            <ExerciseEditForm
                              exercise={editingExercise}
                              exercises={exercises}
                              onSave={saved => { handleExerciseSave(block.id, saved); setEditingExercise(null) }}
                              onDelete={() => { handleExerciseDelete(block.id, editingExercise.id); setEditingExercise(null) }}
                              onClose={() => setEditingExercise(null)}
                            />
                          )}

                          {!isAddingHere && (
                            <button
                              className="coach-add-exercise-btn"
                              onClick={() => setEditingExercise({ block_id: block.id, exercise_order: (block.workout_block_exercises || []).length + 1, sets: 3, is_warmup: false })}
                            >
                              + dodaj ćwiczenie
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {currentDayBlocks.length === 0 && (
                    <div className="coach-empty-training">
                      <h3>Ten trening nie ma jeszcze blokow</h3>
                      <p>Dodaj pierwszy blok i zacznij wpisywac cwiczenia.</p>
                      <button className="coach-btn coach-btn-dark" onClick={() => addBlock()}>Dodaj blok</button>
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        )}
      </div>
    </>
  )
}
