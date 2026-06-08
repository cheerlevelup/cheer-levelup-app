'use client'
// src/app/coach/plans/[id]/PlanEditorClient.tsx

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PlanTableView from './PlanTableView'
import PlanWellnessConfig from '@/components/PlanWellnessConfig'

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

const C = {
  navy: '#0D1B2A',
  navyLight: '#1A2E45',
  navyBorder: '#243652',
  gold: '#F5C842',
  white: '#FFFFFF',
  offWhite: '#F4F6F9',
  gray: '#8A9BB0',
  grayLight: '#E8ECF2',
  green: '#22C55E',
  red: '#EF4444',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function inputStyle(extra?: CSSProperties): CSSProperties {
  return {
    width: '100%',
    minHeight: 42,
    border: `1.5px solid ${C.grayLight}`,
    borderRadius: 10,
    background: C.offWhite,
    color: C.navy,
    padding: '0 0.75rem',
    fontFamily: sans,
    fontSize: '0.9rem',
    outline: 'none',
    ...extra,
  }
}

function labelStyle(): CSSProperties {
  return {
    display: 'block',
    fontFamily: mono,
    fontSize: '0.62rem',
    color: C.gray,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 5,
    fontWeight: 700,
  }
}

function Card({ children, style, className }: { children: React.ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: C.white,
      border: `1.5px solid ${C.grayLight}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(13,27,42,0.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

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

function ExerciseModal({
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 620, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem', color: C.white }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
            {isNew ? 'Nowe cwiczenie' : 'Edycja cwiczenia'}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{isNew ? 'Dodaj do bloku' : 'Ustaw parametry'}</h2>
        </div>

        <div className="exercise-modal-inner" style={{ padding: '1rem 1.25rem 1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1rem' }}>
            <button
              onClick={() => setUseCustomName(false)}
              style={{ padding: '0.75rem', borderRadius: 10, border: 'none', background: !useCustomName ? C.navy : C.offWhite, color: !useCustomName ? C.gold : C.navy, fontWeight: 800 }}
            >
              Z biblioteki
            </button>
            <button
              onClick={() => setUseCustomName(true)}
              style={{ padding: '0.75rem', borderRadius: 10, border: 'none', background: useCustomName ? C.navy : C.offWhite, color: useCustomName ? C.gold : C.navy, fontWeight: 800 }}
            >
              Wlasna nazwa
            </button>
          </div>

          {!useCustomName ? (
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle()}>Cwiczenie</label>
              <select value={exerciseId} onChange={e => setExerciseId(e.target.value)} style={inputStyle({ appearance: 'none' })}>
                <option value="">Wybierz cwiczenie</option>
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{formatExerciseName(ex.name)}{ex.category ? ` (${ex.category})` : ''}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle()}>Nazwa cwiczenia</label>
              <input value={exerciseCode} onChange={e => setExerciseCode(e.target.value)} placeholder="np. rdl, tgu, chest press" style={inputStyle()} />
            </div>
          )}

          <div className="exercise-params-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle()}>Serie</label>
              <input type="number" value={sets} onChange={e => setSets(e.target.value)} style={inputStyle({ fontFamily: mono, textAlign: 'center' })} />
            </div>
            <div>
              <label style={labelStyle()}>Powt.</label>
              <input value={reps} onChange={e => setReps(e.target.value)} placeholder="8-10" style={inputStyle({ fontFamily: mono, textAlign: 'center' })} />
            </div>
            <div>
              <label style={labelStyle()}>Ciężar</label>
              <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="-" style={inputStyle({ fontFamily: mono, textAlign: 'center' })} />
            </div>
            <div>
              <label style={labelStyle()}>Tempo</label>
              <input value={tempo} onChange={e => setTempo(e.target.value)} placeholder="3-1-2-0" style={inputStyle({ fontFamily: mono, textAlign: 'center' })} />
            </div>
            <div>
              <label style={labelStyle()}>RIR</label>
              <input type="number" value={rir} onChange={e => setRir(e.target.value)} placeholder="-" style={inputStyle({ fontFamily: mono, textAlign: 'center' })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1rem' }}>
            <div>
              <div style={labelStyle()}>Szybkie serie</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['2', '3', '4', '5'].map(value => (
                  <button key={value} onClick={() => setSets(value)} style={{ flex: 1, padding: '0.5rem', borderRadius: 9, border: `1.5px solid ${sets === value ? C.gold : C.grayLight}`, background: sets === value ? C.navy : C.offWhite, color: sets === value ? C.gold : C.navy, fontFamily: mono, fontWeight: 800 }}>{value}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={labelStyle()}>Tempo</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['3-1-2-0', '4-0-1-0', '3-0-1-0'].map(value => (
                  <button key={value} onClick={() => setTempo(value)} style={{ flex: 1, padding: '0.5rem', borderRadius: 9, border: `1.5px solid ${tempo === value ? C.gold : C.grayLight}`, background: tempo === value ? C.navy : C.offWhite, color: tempo === value ? C.gold : C.navy, fontFamily: mono, fontSize: '0.68rem', fontWeight: 800 }}>{value}</button>
                ))}
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem', background: C.offWhite, borderRadius: 10, color: C.navy, fontWeight: 700, marginBottom: isWarmup ? '0.65rem' : '1rem' }}>
            <input type="checkbox" checked={isWarmup} onChange={e => setIsWarmup(e.target.checked)} style={{ accentColor: C.gold, width: 16, height: 16 }} />
            Dodaj serie rozgrzewkowe
          </label>

          {isWarmup && (
            <div style={{ border: `1.5px solid ${C.grayLight}`, borderRadius: 12, padding: '0.85rem', marginBottom: '1rem', background: '#FAFBFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <div style={labelStyle()}>Serie rozgrzewkowe</div>
                  <div style={{ color: C.gray, fontSize: '0.78rem' }}>Kazda seria moze miec inna liczbe powtorzen i ciezar.</div>
                </div>
                <button onClick={addWarmupSet} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 9, padding: '0.55rem 0.75rem', fontWeight: 800 }}>
                  Dodaj
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {warmupSets.map((set, index) => (
                  <div className="warmup-set-row" key={index} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr 1.4fr 38px', gap: 7, alignItems: 'center' }}>
                    <div style={{ height: 40, borderRadius: 9, background: C.navy, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 800, fontSize: '0.72rem' }}>
                      R{index + 1}
                    </div>
                    <input value={set.reps || ''} onChange={e => updateWarmupSet(index, 'reps', e.target.value)} placeholder="powt." style={inputStyle({ minHeight: 40, fontFamily: mono, textAlign: 'center' })} />
                    <input value={set.weight_kg || ''} onChange={e => updateWarmupSet(index, 'weight_kg', e.target.value)} placeholder="kg" style={inputStyle({ minHeight: 40, fontFamily: mono, textAlign: 'center' })} />
                    <input className="warmup-set-note" value={set.note || ''} onChange={e => updateWarmupSet(index, 'note', e.target.value)} placeholder="komentarz" style={inputStyle({ minHeight: 40 })} />
                    <button onClick={() => removeWarmupSet(index)} style={{ height: 40, border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.gray, borderRadius: 9, fontWeight: 800 }}>
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {saveError && (
            <div style={{ border: `1.5px solid ${C.red}`, background: '#FEF2F2', color: C.red, borderRadius: 10, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.84rem', fontWeight: 700 }}>
              {saveError}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle()}>Link do filmu / instrukcji</label>
            <input value={exerciseUrl} onChange={e => setExerciseUrl(e.target.value)} placeholder="https://youtube.com/..." style={inputStyle()} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle()}>Komentarz dla zawodniczki</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Wskazowki techniczne, zakres ruchu, uwagi..." rows={3} style={{ ...inputStyle({ padding: '0.75rem', resize: 'none', minHeight: 86 }), display: 'block' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            {!isNew && (
              <button onClick={handleDelete} disabled={saving} style={{ padding: '0.875rem 1rem', borderRadius: 10, border: `1.5px solid ${C.red}`, background: C.white, color: C.red, fontWeight: 700 }}>Usun</button>
            )}
            <button onClick={handleSave} disabled={saving || !canSave} style={{ flex: 1, padding: '0.875rem', borderRadius: 10, border: 'none', background: !canSave ? C.grayLight : C.navy, color: !canSave ? C.gray : C.gold, fontWeight: 800 }}>
              {saving ? 'Zapisuje...' : isNew ? 'Dodaj cwiczenie' : 'Zapisz zmiany'}
            </button>
          </div>
        </div>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 520, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, overflow: 'hidden' }}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem', color: C.white }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Organizacja planu</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{title}</h2>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <p style={{ color: C.gray, fontSize: '0.86rem', marginBottom: '1rem' }}>{hint}</p>
          <label style={labelStyle()}>Miejsce docelowe</label>
          <select value={targetId} onChange={event => setTargetId(event.target.value)} style={inputStyle({ appearance: 'none', marginBottom: '1rem' })}>
            <option value="">Wybierz...</option>
            {options.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          {options.length === 0 && (
            <div style={{ color: C.gray, fontSize: '0.84rem', marginBottom: '1rem' }}>Brak innych miejsc docelowych. Dodaj najpierw tydzien, trening albo blok.</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            <button onClick={handleMove} disabled={!targetId || saving} style={{ flex: 1, padding: '0.875rem', borderRadius: 10, border: 'none', background: !targetId ? C.grayLight : C.navy, color: !targetId ? C.gray : C.gold, fontWeight: 800 }}>
              {saving ? 'Przenosze...' : 'Przenies'}
            </button>
          </div>
        </div>
      </div>
    </div>
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button, input, select, textarea { font-family: inherit; }

        @media (max-width: 768px) {
          .plan-header-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .plan-header-right {
            width: 100% !important;
            align-items: flex-start !important;
          }
          .plan-header-actions {
            flex-wrap: wrap !important;
            gap: 6px !important;
            width: 100% !important;
          }
          .plan-header-actions button {
            font-size: 0.72rem !important;
            padding: 0.55rem 0.65rem !important;
          }
          .plan-header-status {
            text-align: left !important;
          }
          .plan-notes-row {
            flex-direction: column !important;
            gap: 6px !important;
          }
          .plan-body-grid {
            grid-template-columns: 1fr !important;
          }
          .plan-sidebar-card {
            position: static !important;
          }
          .plan-sidebar-days {
            display: flex !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            gap: 6px !important;
            padding-bottom: 4px !important;
          }
          .plan-sidebar-week {
            min-width: 0 !important;
          }
          .plan-sidebar-day-row {
            min-width: 120px !important;
            flex-shrink: 0 !important;
          }
          .exercise-params-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .exercise-modal-inner {
            padding: 0.85rem !important;
          }
          .warmup-set-row {
            grid-template-columns: 40px 1fr 1fr 34px !important;
          }
          .warmup-set-note { display: none !important; }
          .block-header-row {
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          .day-header-row {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .block-header-row {
            flex-wrap: wrap !important;
          }
          .view-toggle-wrap {
            flex-wrap: wrap !important;
          }
          .plan-sidebar-days {
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
          }
          .plan-sidebar-days::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {globalError && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 12, padding: '0.75rem 1.25rem', color: C.red, fontWeight: 700, fontFamily: sans, fontSize: '0.86rem', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: 520, width: 'calc(100vw - 2rem)', textAlign: 'center' }}>
          ❌ {globalError}
        </div>
      )}

      {showWellness && (
        <PlanWellnessConfig planId={plan.id} onClose={() => setShowWellness(false)} />
      )}

      {editingExercise && (
        <ExerciseModal
          exercise={editingExercise}
          exercises={exercises}
          onSave={saved => { handleExerciseSave(editingExercise.block_id, saved); setEditingExercise(null) }}
          onDelete={() => { handleExerciseDelete(editingExercise.block_id, editingExercise.id); setEditingExercise(null) }}
          onClose={() => setEditingExercise(null)}
        />
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

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.25rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div className="plan-header-grid" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block' }}>Edytor planu</label>
              <input
                value={planName}
                onChange={event => setPlanName(event.target.value)}
                onBlur={savePlanName}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: C.white, fontWeight: 800, fontSize: '1.35rem' }}
              />
              <div className="plan-notes-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <textarea
                  value={planNotes}
                  onChange={e => setPlanNotes(e.target.value)}
                  placeholder="Notatki dla zawodniczek (skróty, wskazówki) — widoczne w panelu ℹ️ podczas treningu..."
                  rows={2}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: `1px solid ${C.navyBorder}`, borderRadius: 8, color: C.white, padding: '0.4rem 0.6rem', fontFamily: sans, fontSize: '0.78rem', resize: 'none', outline: 'none', minWidth: 0 }}
                />
                <button onClick={savePlanNotes} disabled={savingNotes}
                  style={{ flexShrink: 0, padding: '0.45rem 0.75rem', background: notesSaved ? '#22C55E' : C.gold, color: C.navy, border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {savingNotes ? '...' : notesSaved ? '✓ Zapisano' : 'Zapisz notatki'}
                </button>
              </div>
            </div>
            <div className="plan-header-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <div className="plan-header-actions view-toggle-wrap" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', background: C.navyLight, borderRadius: 9, border: `1.5px solid ${C.navyBorder}`, overflow: 'hidden' }}>
                  <button onClick={() => setViewMode('blocks')} style={{ padding: '0.5rem 0.75rem', border: 'none', background: viewMode === 'blocks' ? C.gold : 'transparent', color: viewMode === 'blocks' ? C.navy : C.gray, fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>⊞ Bloki</button>
                  <button onClick={() => setViewMode('table')} style={{ padding: '0.5rem 0.75rem', border: 'none', background: viewMode === 'table' ? C.gold : 'transparent', color: viewMode === 'table' ? C.navy : C.gray, fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>⊟ Tabelka</button>
                </div>
                <button onClick={() => setShowWellness(true)} title="Skonfiguruj parametry wellness dla tego planu" style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 9, padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                  🩺 Wellness
                </button>
                <button
                  onClick={() => router.push('/coach/plans')}
                  style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 10, padding: '0.7rem 0.85rem', fontWeight: 800 }}
                >
                  Powrot
                </button>
                <button
                  onClick={saveWholePlan}
                  disabled={savingPlan}
                  style={{ border: 'none', background: savingPlan ? C.grayLight : C.gold, color: C.navy, borderRadius: 10, padding: '0.7rem 0.95rem', fontWeight: 900, minWidth: 126 }}
                >
                  {savingPlan ? 'Zapisuje...' : 'Zapisz plan'}
                </button>
              </div>
              <div className="plan-header-status" style={{ fontFamily: mono, fontSize: '0.62rem', color: planSaveMessage === 'Plan zapisany' ? C.green : planSaveMessage ? C.red : savingName ? C.gold : C.gray, minWidth: 126, textAlign: 'right' }}>
                {planSaveMessage || (savingName ? 'zapisuje nazwe...' : 'gotowy do zapisu')}
              </div>
            </div>
          </div>
        </header>

        <div className="plan-body-grid" style={{ maxWidth: viewMode === 'table' ? 1600 : 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: viewMode === 'table' ? '1fr' : '280px minmax(0, 1fr)', gap: 16, padding: '1rem' }}>
          {viewMode === 'table' && (
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
          )}
          {viewMode === 'blocks' && <>
          <aside>
            <Card style={{ position: 'sticky', top: 102 }} className="plan-sidebar-card">
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Struktura</div>
                  <button onClick={addWeek} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 9, padding: '0.45rem 0.6rem', fontSize: '0.72rem', fontWeight: 800 }}>+ tydz.</button>
                </div>

                <div className="plan-sidebar-days" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {localWeeks.map(week => {
                    const weekDays = localDays.filter(day => day.week_id === week.id).sort((a, b) => a.day_order - b.day_order)
                    return (
                      <div className="plan-sidebar-week" key={week.id}>
                        <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                          Tydzien {week.week_number}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {weekDays.map(day => {
                            const isActive = selectedDayId === day.id
                            return (
                              <div className="plan-sidebar-day-row" key={day.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'stretch' }}>
                                <button onClick={() => setSelectedDayId(day.id)} style={{ width: '100%', border: `1.5px solid ${isActive ? C.gold : C.grayLight}`, background: isActive ? C.navy : C.offWhite, color: isActive ? C.gold : C.navy, borderRadius: 10, padding: '0.65rem 0.75rem', textAlign: 'left' }}>
                                  <div style={{ fontWeight: 800, fontSize: '0.86rem' }}>{day.day_name}</div>
                                  <div style={{ fontFamily: mono, color: isActive ? C.gray : C.gray, fontSize: '0.62rem', marginTop: 2 }}>
                                    {localBlocks.filter(block => block.day_id === day.id).length} blokow
                                  </div>
                                </button>
                                <button
                                  onClick={() => deleteDay(day.id)}
                                  title="Usun trening"
                                  style={{ width: 42, border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.red, borderRadius: 10, fontWeight: 900 }}
                                >
                                  x
                                </button>
                              </div>
                            )
                          })}
                          <button onClick={() => addDay(week.id)} style={{ width: '100%', border: `1.5px dashed ${C.grayLight}`, background: C.white, color: C.gray, borderRadius: 10, padding: '0.6rem', fontFamily: mono, fontSize: '0.65rem', fontWeight: 700 }}>
                            + dodaj trening
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          </aside>

          <main>
            {!selectedDayId || !currentDay ? (
              <Card>
                <div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Wybierz trening z listy albo dodaj nowy tydzien.</div>
              </Card>
            ) : (
              <>
                <Card style={{ marginBottom: '1rem' }}>
                  <div className="day-header-row" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                        Tydzien {currentWeek?.week_number || '-'}
                      </div>
                      <input
                        value={currentDay.day_name}
                        onChange={event => setLocalDays(prev => prev.map(day => day.id === selectedDayId ? { ...day, day_name: event.target.value } : day))}
                        onBlur={event => renameDay(selectedDayId, event.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontWeight: 800, fontSize: '1.45rem', color: C.navy }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button onClick={() => addBlock()} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 9, padding: '0.55rem 0.85rem', fontWeight: 800, fontSize: '0.84rem' }}>+ Blok</button>
                      <button onClick={() => setMovingItem({ type: 'day', day: currentDay })} title="Przenieś trening" style={iconBtn()}>↕</button>
                      <button onClick={() => deleteDay(selectedDayId)} title="Usuń trening" style={iconBtn('#FEF2F2', C.red)}>🗑</button>
                    </div>
                  </div>
                  {/* Notatka wstępna trenera */}
                  <div style={{ borderTop: `1.5px solid ${C.grayLight}`, padding: '0.875rem 1rem', background: '#FFFBEC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: '1rem' }}>📣</span>
                      <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#92660A', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                        Przemowa przed treningiem — widoczna jako pierwsza dla zawodniczek
                      </span>
                    </div>
                    <textarea
                      value={currentDay.coach_intro || ''}
                      onChange={event => setLocalDays(prev => prev.map(day => day.id === selectedDayId ? { ...day, coach_intro: event.target.value } : day))}
                      onBlur={event => saveCoachIntro(selectedDayId, event.target.value)}
                      placeholder="Motywacja, wskazówki, na co zwrócić uwagę... Zawodniczki zobaczą to zanim zaczną ćwiczyć."
                      rows={3}
                      style={{ width: '100%', border: `1.5px solid #F5C84260`, borderRadius: 10, background: C.white, color: C.navy, padding: '0.625rem 0.75rem', fontFamily: sans, fontSize: '0.86rem', resize: 'vertical', outline: 'none', lineHeight: 1.5 }}
                    />
                  </div>
                  {/* Notatka końcowa trenera */}
                  <div style={{ borderTop: `1.5px solid ${C.grayLight}`, padding: '0.875rem 1rem', background: '#F0FDF4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: '1rem' }}>🏁</span>
                      <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#166534', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                        Słowo od trenera po ćwiczeniach — przed wypełnieniem raportu
                      </span>
                    </div>
                    <textarea
                      value={currentDay.coach_outro || ''}
                      onChange={event => setLocalDays(prev => prev.map(day => day.id === selectedDayId ? { ...day, coach_outro: event.target.value } : day))}
                      onBlur={event => saveCoachOutro(selectedDayId, event.target.value)}
                      placeholder="Gratulacje, refleksja, co było dziś celem... Zawodniczki zobaczą to przed wypełnieniem raportu."
                      rows={3}
                      style={{ width: '100%', border: `1.5px solid #22C55E40`, borderRadius: 10, background: C.white, color: C.navy, padding: '0.625rem 0.75rem', fontFamily: sans, fontSize: '0.86rem', resize: 'vertical', outline: 'none', lineHeight: 1.5 }}
                    />
                  </div>
                  {/* Notatka po całym treningu (pod Podsumowaniem) */}
                  <div style={{ borderTop: `1.5px solid ${C.grayLight}`, padding: '0.875rem 1rem', background: '#EFF6FF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: '1rem' }}>💙</span>
                      <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#1E40AF', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                        Notatka pod całym treningiem — widoczna po raporcie
                      </span>
                    </div>
                    <textarea
                      value={currentDay.coach_closing || ''}
                      onChange={event => setLocalDays(prev => prev.map(day => day.id === selectedDayId ? { ...day, coach_closing: event.target.value } : day))}
                      onBlur={event => saveCoachClosing(selectedDayId, event.target.value)}
                      placeholder="Co dalej, recovery, dieta, sen, kolejny trening... Zawodniczki zobaczą to na absolutnym końcu strony treningu."
                      rows={3}
                      style={{ width: '100%', border: `1.5px solid #3B82F640`, borderRadius: 10, background: C.white, color: C.navy, padding: '0.625rem 0.75rem', fontFamily: sans, fontSize: '0.86rem', resize: 'vertical', outline: 'none', lineHeight: 1.5 }}
                    />
                  </div>
                </Card>

                {currentDayBlocks.map(block => (
                  <Card key={block.id} style={{ marginBottom: '1rem', overflow: 'visible' }}>
                    {/* Block header */}
                    <div className="block-header-row" style={{ padding: '0.75rem 1rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        value={block.block_name}
                        onChange={event => setLocalBlocks(prev => prev.map(item => item.id === block.id ? { ...item, block_name: event.target.value } : item))}
                        onBlur={event => renameBlock(block.id, event.target.value)}
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontWeight: 800, fontSize: '1rem', color: C.navy, minWidth: 0 }}
                      />
                      {/* rounds */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.offWhite, borderRadius: 8, padding: '0.28rem 0.55rem', border: `1.5px solid ${C.grayLight}` }}>
                        <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.06em' }}>🔁</span>
                        <input
                          type="number" min={1} max={10} value={block.rounds}
                          onChange={event => updateBlockRounds(block.id, parseInt(event.target.value) || 1)}
                          style={{ width: 28, border: 'none', background: 'transparent', outline: 'none', textAlign: 'center', fontFamily: mono, color: C.navy, fontWeight: 800, fontSize: '0.9rem' }}
                        />
                        <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>rund</span>
                      </div>
                      {/* icon buttons */}
                      <button onClick={() => copyBlockToAllDays(block)} title="Kopiuj blok do wszystkich treningów" style={iconBtn()}>📋</button>
                      <button onClick={() => setMovingItem({ type: 'block', block })} title="Przenieś blok" style={iconBtn()}>↕</button>
                      <button onClick={() => deleteBlock(block.id)} title="Usuń blok" style={iconBtn('#FEF2F2', C.red)}>🗑</button>
                    </div>

                    <div style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(block.workout_block_exercises || [])
                          .sort((a, b) => a.exercise_order - b.exercise_order)
                          .map((exercise, index) => {
                            const name = formatExerciseName(exercise.exercise?.name || exercise.exercise_code || 'Cwiczenie')
                            const warmupCount = cleanWarmupSets(exercise.warmup_sets || []).length
                            return (
                              <div key={exercise.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center', padding: '0.6rem 0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: C.navy, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 800, fontSize: '0.75rem' }}>
                                  {index + 1}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, color: C.navy, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {name}
                                    {exercise.exercise_url && (
                                      <a href={exercise.exercise_url} target="_blank" rel="noopener noreferrer" title="Otwórz film/instrukcję" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>🔗</a>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                                    <span style={chipStyle(C.navy, C.gold)}>{exercise.sets}×{exercise.reps || '—'}</span>
                                    {exercise.tempo && <span style={chipStyle(C.navy, C.gold)}>{exercise.tempo}</span>}
                                    {exercise.weight_kg && <span style={chipStyle(C.grayLight, C.gray)}>{exercise.weight_kg} kg</span>}
                                    {exercise.rir !== null && exercise.rir !== undefined && <span style={chipStyle(C.grayLight, C.gray)}>RIR {exercise.rir}</span>}
                                    {exercise.is_warmup && <span style={chipStyle('#FEF9C3', '#854D0E')}>🔥 rozgrzewka ×{warmupCount || 1}</span>}
                                  </div>
                                  {exercise.coach_comment && <div style={{ color: C.gray, fontSize: '0.76rem', marginTop: 4, fontStyle: 'italic' }}>{exercise.coach_comment}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => setMovingItem({ type: 'exercise', exercise: { ...exercise, block_id: block.id }, fromBlockId: block.id })} title="Przenieś" style={iconBtn()}>↕</button>
                                  <button onClick={() => setEditingExercise({ ...exercise, block_id: block.id })} title="Edytuj" style={iconBtn(C.navy + '10', C.navy)}>✏️</button>
                                  <button onClick={() => deleteExercise(block.id, exercise.id)} title="Usuń" style={iconBtn('#FEF2F2', C.red)}>✕</button>
                                </div>
                              </div>
                            )
                          })}
                      </div>

                      <button
                        onClick={() => setEditingExercise({ block_id: block.id, exercise_order: (block.workout_block_exercises || []).length + 1, sets: 3, is_warmup: false })}
                        style={{ width: '100%', marginTop: '0.65rem', padding: '0.65rem', border: `1.5px dashed ${C.grayLight}`, borderRadius: 10, background: C.white, color: C.gray, fontFamily: mono, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        + dodaj ćwiczenie
                      </button>
                    </div>
                  </Card>
                ))}

                {currentDayBlocks.length === 0 && (
                  <Card>
                    <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: C.navy, marginBottom: 6 }}>Ten trening nie ma jeszcze blokow</div>
                      <div style={{ color: C.gray, fontSize: '0.86rem', marginBottom: '1rem' }}>Dodaj pierwszy blok i zacznij wpisywac cwiczenia.</div>
                      <button onClick={() => addBlock()} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.85rem 1rem', fontWeight: 800 }}>Dodaj blok</button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </main>
          </>}
        </div>
      </div>
    </>
  )
}

function iconBtn(bg = C.offWhite, color = C.navy): CSSProperties {
  return {
    width: 32, height: 32, border: `1.5px solid ${C.grayLight}`, background: bg,
    color, borderRadius: 8, fontWeight: 800, fontSize: '0.9rem', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  }
}

function chipStyle(background: string, color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    padding: '2px 8px',
    borderRadius: 7,
    background,
    color,
    fontFamily: mono,
    fontWeight: 800,
    fontSize: '0.68rem',
  }
}
