'use client'
// src/app/coach/plans/[id]/PlanEditorClient.tsx

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

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

function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
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

        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle()}>Serie</label>
              <input type="number" value={sets} onChange={e => setSets(e.target.value)} style={inputStyle({ fontFamily: mono, textAlign: 'center' })} />
            </div>
            <div>
              <label style={labelStyle()}>Powt.</label>
              <input value={reps} onChange={e => setReps(e.target.value)} placeholder="8-10" style={inputStyle({ fontFamily: mono, textAlign: 'center' })} />
            </div>
            <div>
              <label style={labelStyle()}>Kg</label>
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
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr 1.4fr 38px', gap: 7, alignItems: 'center' }}>
                    <div style={{ height: 40, borderRadius: 9, background: C.navy, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 800, fontSize: '0.72rem' }}>
                      R{index + 1}
                    </div>
                    <input value={set.reps || ''} onChange={e => updateWarmupSet(index, 'reps', e.target.value)} placeholder="powt." style={inputStyle({ minHeight: 40, fontFamily: mono, textAlign: 'center' })} />
                    <input value={set.weight_kg || ''} onChange={e => updateWarmupSet(index, 'weight_kg', e.target.value)} placeholder="kg" style={inputStyle({ minHeight: 40, fontFamily: mono, textAlign: 'center' })} />
                    <input value={set.note || ''} onChange={e => updateWarmupSet(index, 'note', e.target.value)} placeholder="uwaga" style={inputStyle({ minHeight: 40 })} />
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

  const currentDay = localDays.find(day => day.id === selectedDayId)
  const currentWeek = localWeeks.find(week => week.id === currentDay?.week_id)
  const currentDayBlocks = localBlocks
    .filter(block => block.day_id === selectedDayId)
    .sort((a, b) => a.block_order - b.block_order)

  async function savePlanName() {
    setSavingName(true)
    await supabase.from('workout_plans').update({ name: planName }).eq('id', plan.id)
    setSavingName(false)
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
    await supabase.from('workout_days').update({ day_name: nextName }).eq('id', dayId)
    setLocalDays(prev => prev.map(day => day.id === dayId ? { ...day, day_name: nextName } : day))
    setTargetDays(prev => prev.map(day => day.id === dayId ? { ...day, day_name: nextName } : day))
  }

  async function deleteDay(dayId: number) {
    if (!confirm('Usunac ten trening razem z blokami i cwiczeniami?')) return
    await supabase.from('workout_days').delete().eq('id', dayId)
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

  async function addBlock() {
    if (!selectedDayId) return
    const existingBlocks = localBlocks.filter(block => block.day_id === selectedDayId)
    const order = existingBlocks.length + 1
    const { data } = await supabase
      .from('workout_day_blocks')
      .insert({ day_id: selectedDayId, block_name: nextBlockName(existingBlocks.length), block_order: order, rounds: 3 })
      .select()
      .single()
    if (data) {
      const newBlock = { ...(data as Block), workout_block_exercises: [] }
      setLocalBlocks(prev => [...prev, newBlock])
      setTargetBlocks(prev => [...prev, newBlock])
    }
  }

  async function deleteBlock(blockId: number) {
    if (!confirm('Usunac ten blok razem z cwiczeniami?')) return
    await supabase.from('workout_day_blocks').delete().eq('id', blockId)
    setLocalBlocks(prev => prev.filter(block => block.id !== blockId))
    setTargetBlocks(prev => prev.filter(block => block.id !== blockId))
  }

  async function updateBlockRounds(blockId: number, rounds: number) {
    await supabase.from('workout_day_blocks').update({ rounds }).eq('id', blockId)
    setLocalBlocks(prev => prev.map(block => block.id === blockId ? { ...block, rounds } : block))
    setTargetBlocks(prev => prev.map(block => block.id === blockId ? { ...block, rounds } : block))
  }

  async function renameBlock(blockId: number, name: string) {
    const nextName = name.trim() || 'Blok'
    await supabase.from('workout_day_blocks').update({ block_name: nextName }).eq('id', blockId)
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
    await supabase.from('workout_block_exercises').delete().eq('id', exerciseId)
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
      `}</style>

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
          <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
            <button onClick={() => router.push('/coach/plans')} style={{ border: `1.5px solid ${C.gold}`, background: C.white, color: C.navy, borderRadius: 10, padding: '0.72rem 0.95rem', fontFamily: sans, fontSize: '0.84rem', fontWeight: 900 }}>
              Powrot do panelu
            </button>
            <div>
              <label style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Edytor planu</label>
              <input
                value={planName}
                onChange={event => setPlanName(event.target.value)}
                onBlur={savePlanName}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: C.white, fontWeight: 800, fontSize: '1.35rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <div style={{ display: 'flex', gap: 8 }}>
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
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: planSaveMessage === 'Plan zapisany' ? C.green : planSaveMessage ? C.red : savingName ? C.gold : C.gray, minWidth: 126, textAlign: 'right' }}>
                {planSaveMessage || (savingName ? 'zapisuje nazwe...' : 'gotowy do zapisu')}
              </div>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16, padding: '1rem' }}>
          <aside>
            <Card style={{ position: 'sticky', top: 102 }}>
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Struktura</div>
                  <button onClick={addWeek} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 9, padding: '0.45rem 0.6rem', fontSize: '0.72rem', fontWeight: 800 }}>+ tydz.</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {localWeeks.map(week => {
                    const weekDays = localDays.filter(day => day.week_id === week.id).sort((a, b) => a.day_order - b.day_order)
                    return (
                      <div key={week.id}>
                        <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                          Tydzien {week.week_number}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {weekDays.map(day => {
                            const isActive = selectedDayId === day.id
                            return (
                              <div key={day.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'stretch' }}>
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
                  <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
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
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={addBlock} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.75rem 0.9rem', fontWeight: 800 }}>Dodaj blok</button>
                      <button onClick={() => setMovingItem({ type: 'day', day: currentDay })} style={{ border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, borderRadius: 10, padding: '0.75rem 0.9rem', fontWeight: 700 }}>Przenies</button>
                      <button onClick={() => deleteDay(selectedDayId)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.gray, borderRadius: 10, padding: '0.75rem 0.9rem', fontWeight: 700 }}>Usun</button>
                    </div>
                  </div>
                </Card>

                {currentDayBlocks.map(block => (
                  <Card key={block.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ padding: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10, marginBottom: '0.875rem' }}>
                        <input
                          value={block.block_name}
                          onChange={event => setLocalBlocks(prev => prev.map(item => item.id === block.id ? { ...item, block_name: event.target.value } : item))}
                          onBlur={event => renameBlock(block.id, event.target.value)}
                          style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 800, fontSize: '1.05rem', color: C.navy }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.offWhite, borderRadius: 10, padding: '0.35rem 0.55rem' }}>
                          <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>rundy</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={block.rounds}
                            onChange={event => updateBlockRounds(block.id, parseInt(event.target.value) || 1)}
                            style={{ width: 40, border: 'none', background: 'transparent', outline: 'none', textAlign: 'center', fontFamily: mono, color: C.navy, fontWeight: 800 }}
                          />
                        </div>
                        <button onClick={() => setMovingItem({ type: 'block', block })} style={{ border: 'none', background: C.offWhite, color: C.navy, borderRadius: 9, padding: '0.55rem 0.7rem', fontWeight: 800 }}>Przenies</button>
                        <button onClick={() => deleteBlock(block.id)} style={{ border: 'none', background: 'transparent', color: C.gray, fontWeight: 700 }}>Usun blok</button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(block.workout_block_exercises || [])
                          .sort((a, b) => a.exercise_order - b.exercise_order)
                          .map((exercise, index) => {
                            const name = formatExerciseName(exercise.exercise?.name || exercise.exercise_code || 'Cwiczenie')
                            const warmupCount = cleanWarmupSets(exercise.warmup_sets || []).length
                            return (
                              <div key={exercise.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 10, alignItems: 'center', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.offWhite }}>
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: C.navy, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 800 }}>
                                  {index + 1}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 800, color: C.navy }}>{name}</div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                                    <span style={chipStyle(C.navy, C.gold)}>{exercise.sets}x{exercise.reps || '-'}</span>
                                    {exercise.tempo && <span style={chipStyle(C.navy, C.gold)}>{exercise.tempo}</span>}
                                    {exercise.weight_kg && <span style={chipStyle(C.grayLight, C.gray)}>{exercise.weight_kg}kg</span>}
                                    {exercise.rir !== null && exercise.rir !== undefined && <span style={chipStyle(C.grayLight, C.gray)}>RIR {exercise.rir}</span>}
                                    {exercise.is_warmup && <span style={chipStyle(C.gold, C.navy)}>Rozgrzewka {warmupCount || 1}</span>}
                                  </div>
                                  {exercise.coach_comment && <div style={{ color: C.gray, fontSize: '0.82rem', marginTop: 6, fontStyle: 'italic' }}>{exercise.coach_comment}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => setMovingItem({ type: 'exercise', exercise: { ...exercise, block_id: block.id }, fromBlockId: block.id })} style={{ border: 'none', background: C.white, color: C.gray, borderRadius: 10, padding: '0.65rem 0.75rem', fontWeight: 700 }}>Przenies</button>
                                  <button onClick={() => setEditingExercise({ ...exercise, block_id: block.id })} style={{ border: 'none', background: C.white, color: C.navy, borderRadius: 10, padding: '0.65rem 0.8rem', fontWeight: 800 }}>Edytuj</button>
                                  <button onClick={() => deleteExercise(block.id, exercise.id)} style={{ border: `1.5px solid ${C.red}`, background: C.white, color: C.red, borderRadius: 10, padding: '0.65rem 0.75rem', fontWeight: 800 }}>Usun</button>
                                </div>
                              </div>
                            )
                          })}
                      </div>

                      <button
                        onClick={() => setEditingExercise({ block_id: block.id, exercise_order: (block.workout_block_exercises || []).length + 1, sets: 3, is_warmup: false })}
                        style={{ width: '100%', marginTop: '0.875rem', padding: '0.8rem', border: `1.5px dashed ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontFamily: mono, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}
                      >
                        + Dodaj cwiczenie
                      </button>
                    </div>
                  </Card>
                ))}

                {currentDayBlocks.length === 0 && (
                  <Card>
                    <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: C.navy, marginBottom: 6 }}>Ten trening nie ma jeszcze blokow</div>
                      <div style={{ color: C.gray, fontSize: '0.86rem', marginBottom: '1rem' }}>Dodaj pierwszy blok i zacznij wpisywac cwiczenia.</div>
                      <button onClick={addBlock} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.85rem 1rem', fontWeight: 800 }}>Dodaj blok</button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  )
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
