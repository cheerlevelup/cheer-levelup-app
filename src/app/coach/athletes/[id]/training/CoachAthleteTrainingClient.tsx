'use client'
// src/app/coach/athletes/[id]/training/CoachAthleteTrainingClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
  orange: '#F97316',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>{children}</div>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`,
  borderRadius: 10, background: C.offWhite, color: C.navy,
  fontFamily: mono, fontSize: '0.9rem', outline: 'none', textAlign: 'center',
}
const labelCss: React.CSSProperties = {
  fontFamily: mono, fontSize: '0.62rem', color: C.gray,
  letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700,
}

function formatExName(name: string) { return name.replace(/-/g, ' ') }

// ─── MODAL EDYCJI ĆWICZENIA (override + podmiana + skip) ─────────────────────
function ExerciseEditModal({ ex, athleteId, athleteName, existingOverride, exerciseLibrary, onSave, onSkip, onClose }: {
  ex: any; athleteId: number; athleteName: string
  existingOverride: any | null; exerciseLibrary: any[]
  onSave: (override: any) => void
  onSkip: (skipped: boolean) => void
  onClose: () => void
}) {
  const supabase = createClient()

  // Podmiana ćwiczenia
  const [swapMode, setSwapMode] = useState<'same' | 'library' | 'custom'>(
    existingOverride?.exercise_code_override ? 'custom'
    : existingOverride?.exercise_id_override ? 'library'
    : 'same'
  )
  const [swapExerciseId, setSwapExerciseId] = useState(existingOverride?.exercise_id_override?.toString() || '')
  const [swapCode, setSwapCode] = useState(existingOverride?.exercise_code_override || '')

  // Parametry
  const [sets, setSets] = useState(existingOverride?.sets_override?.toString() || ex.sets?.toString() || '3')
  const [reps, setReps] = useState(existingOverride?.reps_override || ex.reps || '')
  const [weight, setWeight] = useState(existingOverride?.weight_override?.toString() || ex.weight_kg?.toString() || '')
  const [tempo, setTempo] = useState(existingOverride?.tempo_override || ex.tempo || '')
  const [rir, setRir] = useState(existingOverride?.rir_override?.toString() || ex.rir?.toString() || '')
  const [note, setNote] = useState(existingOverride?.coach_note_override || ex.coach_comment || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const originalName = ex.exercise?.name || ex.exercise_code || 'Ćwiczenie'

  async function handleSave() {
    setSaving(true); setError('')
    const payload: any = {
      athlete_id: athleteId,
      block_exercise_id: ex.id,
      sets_override: sets ? parseInt(sets) : null,
      reps_override: reps || null,
      weight_override: weight ? parseFloat(weight) : null,
      tempo_override: tempo || null,
      coach_note_override: note || null,
      is_substitution: swapMode !== 'same',
      skip: false,
      exercise_id_override: swapMode === 'library' && swapExerciseId ? parseInt(swapExerciseId) : null,
      exercise_code_override: swapMode === 'custom' && swapCode.trim() ? swapCode.trim() : null,
    }
    let result, err
    if (existingOverride) {
      const { data, error: e } = await supabase.from('athlete_exercise_overrides').update(payload).eq('id', existingOverride.id).select('*, exercise_override:exercises(*)').single()
      result = data; err = e
    } else {
      const { data, error: e } = await supabase.from('athlete_exercise_overrides').insert(payload).select('*, exercise_override:exercises(*)').single()
      result = data; err = e
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    if (result) onSave(result)
    onClose()
  }

  async function handleSkip() {
    setSaving(true)
    const isCurrentlySkipped = existingOverride?.skip
    const payload: any = {
      athlete_id: athleteId, block_exercise_id: ex.id,
      skip: !isCurrentlySkipped, is_substitution: false,
      sets_override: null, reps_override: null, weight_override: null,
      tempo_override: null, coach_note_override: null,
      exercise_id_override: null, exercise_code_override: null,
    }
    let result
    if (existingOverride) {
      const { data } = await supabase.from('athlete_exercise_overrides').update(payload).eq('id', existingOverride.id).select().single()
      result = data
    } else {
      const { data } = await supabase.from('athlete_exercise_overrides').insert(payload).select().single()
      result = data
    }
    setSaving(false)
    onSkip(!isCurrentlySkipped)
    if (result) onSave(result)
    onClose()
  }

  async function handleDeleteOverride() {
    if (!existingOverride) return
    setSaving(true)
    await supabase.from('athlete_exercise_overrides').delete().eq('id', existingOverride.id)
    setSaving(false)
    onSave(null)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 540, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '94vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Modyfikacja ćwiczenia</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem', marginBottom: 3 }}>{originalName}</div>
          <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>
            tylko dla <strong style={{ color: C.gold }}>{athleteName}</strong> · szablon pozostaje bez zmian
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>

          {/* Szablon */}
          <div style={{ background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>Szablon planu</div>
            <div style={{ fontFamily: mono, fontSize: '0.78rem', color: C.navy, fontWeight: 700 }}>
              {ex.sets}×{ex.reps || '—'}{ex.tempo ? ` · ${ex.tempo}` : ''}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}{ex.rir != null ? ` · RIR ${ex.rir}` : ''}
            </div>
            {ex.coach_comment && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 4, fontStyle: 'italic' }}>{ex.coach_comment}</div>}
          </div>

          {/* Sekcja 1: Podmiana ćwiczenia */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 700 }}>Ćwiczenie</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[
                { key: 'same', label: 'Bez zmiany' },
                { key: 'library', label: 'Z biblioteki' },
                { key: 'custom', label: 'Własna nazwa' },
              ].map(opt => (
                <button key={opt.key} onClick={() => setSwapMode(opt.key as any)}
                  style={{ flex: 1, padding: '0.55rem', border: `1.5px solid ${swapMode === opt.key ? C.gold : C.grayLight}`, borderRadius: 8, background: swapMode === opt.key ? C.navy : C.offWhite, color: swapMode === opt.key ? C.gold : C.gray, fontWeight: swapMode === opt.key ? 800 : 500, fontSize: '0.75rem' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {swapMode === 'library' && (
              <select value={swapExerciseId} onChange={e => setSwapExerciseId(e.target.value)}
                style={{ ...inputStyle, textAlign: 'left', fontFamily: sans, appearance: 'none' }}>
                <option value="">Wybierz ćwiczenie z biblioteki...</option>
                {exerciseLibrary.map((ex: any) => (
                  <option key={ex.id} value={ex.id}>{formatExName(ex.name)}{ex.category ? ` (${ex.category})` : ''}</option>
                ))}
              </select>
            )}
            {swapMode === 'custom' && (
              <input type="text" value={swapCode} onChange={e => setSwapCode(e.target.value)}
                placeholder="np. hip thrust, pallof press, zercher squat..."
                style={{ ...inputStyle, textAlign: 'left', fontFamily: sans }} />
            )}
          </div>

          {/* Sekcja 2: Parametry */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 700 }}>Parametry</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
              <div><label style={labelCss}>Serie</label><input type="number" value={sets} onChange={e => setSets(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelCss}>Powt.</label><input type="text" value={reps} onChange={e => setReps(e.target.value)} placeholder="8–10" style={inputStyle} /></div>
              <div><label style={labelCss}>Kg</label><input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" style={inputStyle} /></div>
              <div><label style={labelCss}>RIR</label><input type="number" value={rir} onChange={e => setRir(e.target.value)} placeholder="—" style={inputStyle} /></div>
            </div>
            <div>
              <label style={labelCss}>Tempo</label>
              <input type="text" value={tempo} onChange={e => setTempo(e.target.value)} placeholder="np. 3-1-2-0" style={{ ...inputStyle, textAlign: 'left', fontFamily: sans }} />
            </div>
          </div>

          {/* Sekcja 3: Notatka */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelCss}>Notatka dla zawodniczki</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Wskazówki, modyfikacje techniczne, powód zmiany..." rows={3}
              style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem', outline: 'none', resize: 'none' }} />
          </div>

          {error && <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.82rem', marginBottom: '1rem' }}>❌ {error}</div>}

          {/* Przyciski */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            <button onClick={handleSkip} disabled={saving}
              style={{ padding: '0.875rem 1rem', border: `1.5px solid ${existingOverride?.skip ? C.green : C.orange}`, borderRadius: 12, background: C.white, color: existingOverride?.skip ? C.green : C.orange, fontWeight: 700 }}>
              {existingOverride?.skip ? '↩ Przywróć' : '✕ Pomiń'}
            </button>
            {existingOverride && !existingOverride.skip && (
              <button onClick={handleDeleteOverride} disabled={saving}
                style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.red}`, borderRadius: 12, background: C.white, color: C.red, fontWeight: 700 }}>
                Usuń mod.
              </button>
            )}
            <button onClick={handleSave} disabled={saving || existingOverride?.skip}
              style={{ flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12, background: existingOverride?.skip ? C.grayLight : C.navy, color: existingOverride?.skip ? C.gray : C.gold, fontWeight: 900, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Zapisuję...' : 'Zapisz zmiany ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL DODAWANIA NOWEGO ĆWICZENIA DO BLOKU ────────────────────────────────
function AddExerciseModal({ blockId, athleteId, exerciseLibrary, existingCount, onSave, onClose }: {
  blockId: number; athleteId: number; exerciseLibrary: any[]
  existingCount: number; onSave: (ex: any) => void; onClose: () => void
}) {
  const supabase = createClient()
  const [mode, setMode] = useState<'library' | 'custom'>('library')
  const [exerciseId, setExerciseId] = useState('')
  const [exerciseCode, setExerciseCode] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [tempo, setTempo] = useState('')
  const [rir, setRir] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = mode === 'library' ? !!exerciseId : exerciseCode.trim().length > 0

  async function handleSave() {
    if (!canSave) return
    setSaving(true); setError('')
    const payload = {
      athlete_id: athleteId,
      block_id: blockId,
      exercise_id: mode === 'library' && exerciseId ? parseInt(exerciseId) : null,
      exercise_code: mode === 'custom' ? exerciseCode.trim() : null,
      exercise_order: existingCount + 100,
      sets: parseInt(sets) || 3,
      reps: reps || null,
      weight_kg: weight ? parseFloat(weight) : null,
      tempo: tempo || null,
      rir: rir ? parseInt(rir) : null,
      coach_note: note || null,
    }
    const { data, error: err } = await supabase.from('athlete_extra_exercises')
      .insert(payload).select('*, exercise:exercises(*)').single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) onSave(data)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(13,27,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 540, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Dodaj ćwiczenie</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>Nowe ćwiczenie do bloku</div>
          <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 3 }}>Widoczne tylko dla tej zawodniczki</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {/* Tryb */}
          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 700 }}>Ćwiczenie</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[{ key: 'library', label: 'Z biblioteki' }, { key: 'custom', label: 'Własna nazwa' }].map(opt => (
                <button key={opt.key} onClick={() => setMode(opt.key as any)}
                  style={{ flex: 1, padding: '0.55rem', border: `1.5px solid ${mode === opt.key ? C.gold : C.grayLight}`, borderRadius: 8, background: mode === opt.key ? C.navy : C.offWhite, color: mode === opt.key ? C.gold : C.gray, fontWeight: mode === opt.key ? 800 : 500, fontSize: '0.78rem' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {mode === 'library' ? (
              <select value={exerciseId} onChange={e => setExerciseId(e.target.value)}
                style={{ ...inputStyle, textAlign: 'left', fontFamily: sans, appearance: 'none' }}>
                <option value="">Wybierz ćwiczenie...</option>
                {exerciseLibrary.map((ex: any) => (
                  <option key={ex.id} value={ex.id}>{formatExName(ex.name)}{ex.category ? ` (${ex.category})` : ''}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={exerciseCode} onChange={e => setExerciseCode(e.target.value)}
                placeholder="np. hip thrust, rdl, face pull..."
                style={{ ...inputStyle, textAlign: 'left', fontFamily: sans }} />
            )}
          </div>

          {/* Parametry */}
          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 700 }}>Parametry</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
              <div><label style={labelCss}>Serie</label><input type="number" value={sets} onChange={e => setSets(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelCss}>Powt.</label><input type="text" value={reps} onChange={e => setReps(e.target.value)} placeholder="8–10" style={inputStyle} /></div>
              <div><label style={labelCss}>Kg</label><input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" style={inputStyle} /></div>
              <div><label style={labelCss}>RIR</label><input type="number" value={rir} onChange={e => setRir(e.target.value)} placeholder="—" style={inputStyle} /></div>
            </div>
            <div>
              <label style={labelCss}>Tempo</label>
              <input type="text" value={tempo} onChange={e => setTempo(e.target.value)} placeholder="np. 3-1-2-0" style={{ ...inputStyle, textAlign: 'left', fontFamily: sans }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.1rem' }}>
            <label style={labelCss}>Notatka</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Wskazówki techniczne..." rows={2}
              style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem', outline: 'none', resize: 'none' }} />
          </div>

          {error && <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.82rem', marginBottom: '1rem' }}>❌ {error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            <button onClick={handleSave} disabled={!canSave || saving}
              style={{ flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12, background: !canSave ? C.grayLight : C.navy, color: !canSave ? C.gray : C.gold, fontWeight: 900, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Dodaję...' : 'Dodaj ćwiczenie ＋'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function CoachAthleteTrainingClient({ athlete, assignment, days, blocks, overrides, extraExercises, exerciseLibrary }: any) {
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState<number>(days[0]?.id || 0)
  const [overrideMap, setOverrideMap] = useState<Record<number, any>>(() => {
    const map: Record<number, any> = {}
    for (const o of overrides) map[o.block_exercise_id] = o
    return map
  })
  const [extraMap, setExtraMap] = useState<Record<number, any[]>>(() => {
    const map: Record<number, any[]> = {}
    for (const e of (extraExercises || [])) {
      if (!map[e.block_id]) map[e.block_id] = []
      map[e.block_id].push(e)
    }
    return map
  })
  const [editingExercise, setEditingExercise] = useState<any | null>(null)
  const [addingToBlock, setAddingToBlock] = useState<number | null>(null)

  const currentDayBlocks = blocks.filter((b: any) => b.day_id === selectedDay).sort((a: any, z: any) => a.block_order - z.block_order)
  const currentDay = days.find((d: any) => d.id === selectedDay)

  const overrideCount = Object.values(overrideMap).filter((o: any) => !o.skip).length
  const skipCount = Object.values(overrideMap).filter((o: any) => o.skip).length
  const extraCount = Object.values(extraMap).flat().length

  function handleOverrideSave(exerciseId: number, override: any | null) {
    setOverrideMap(prev => {
      const next = { ...prev }
      if (override) next[exerciseId] = override
      else delete next[exerciseId]
      return next
    })
  }

  function handleExtraAdd(blockId: number, ex: any) {
    setExtraMap(prev => ({ ...prev, [blockId]: [...(prev[blockId] || []), ex] }))
  }

  async function handleExtraDelete(blockId: number, exId: string) {
    const supabase = createClient()
    await supabase.from('athlete_extra_exercises').delete().eq('id', exId)
    setExtraMap(prev => ({ ...prev, [blockId]: (prev[blockId] || []).filter(e => e.id !== exId) }))
  }

  // Pogrupuj dni wg tygodnia
  const weekGroups: Record<number, any[]> = {}
  for (const day of days) {
    const wn = day.week?.week_number || 1
    if (!weekGroups[wn]) weekGroups[wn] = []
    weekGroups[wn].push(day)
  }

  function getExerciseDisplayName(ex: any, override: any | null) {
    if (override?.exercise_code_override) return override.exercise_code_override
    if (override?.exercise_id_override && override.exercise_override?.name) return formatExName(override.exercise_override.name)
    return ex.exercise?.name ? formatExName(ex.exercise.name) : (ex.exercise_code || 'Ćwiczenie')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      {editingExercise && (
        <ExerciseEditModal
          ex={editingExercise}
          athleteId={athlete.id}
          athleteName={athlete.full_name.split(' ')[0]}
          existingOverride={overrideMap[editingExercise.id] || null}
          exerciseLibrary={exerciseLibrary}
          onSave={o => handleOverrideSave(editingExercise.id, o)}
          onSkip={() => {}}
          onClose={() => setEditingExercise(null)}
        />
      )}

      {addingToBlock != null && (
        <AddExerciseModal
          blockId={addingToBlock}
          athleteId={athlete.id}
          exerciseLibrary={exerciseLibrary}
          existingCount={(blocks.find((b: any) => b.id === addingToBlock)?.workout_block_exercises || []).length + (extraMap[addingToBlock] || []).length}
          onSave={ex => handleExtraAdd(addingToBlock, ex)}
          onClose={() => setAddingToBlock(null)}
        />
      )}

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>

        {/* Header */}
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.5rem' }}>
              <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)}
                style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
                ← {athlete.full_name.split(' ')[0]}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Modyfikacje planu</div>
                <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{assignment?.plan?.name || 'Brak planu'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {overrideCount > 0 && <div style={{ background: C.gold, color: C.navy, borderRadius: 20, padding: '3px 10px', fontFamily: mono, fontSize: '0.68rem', fontWeight: 900 }}>{overrideCount} mod.</div>}
                {skipCount > 0 && <div style={{ background: C.red, color: C.white, borderRadius: 20, padding: '3px 10px', fontFamily: mono, fontSize: '0.68rem', fontWeight: 900 }}>{skipCount} pominięte</div>}
                {extraCount > 0 && <div style={{ background: C.green, color: C.white, borderRadius: 20, padding: '3px 10px', fontFamily: mono, fontSize: '0.68rem', fontWeight: 900 }}>+{extraCount} nowe</div>}
              </div>
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>{athlete.full_name}</div>
          </div>
        </header>

        <main style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>

          {!assignment ? (
            <Card><div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak przypisanego planu.</div></Card>
          ) : (
            <>
              {/* Nawigacja dni */}
              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 700 }}>Wybierz dzień</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(weekGroups).map(([weekNum, weekDays]) => (
                      <div key={weekNum}>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>Tydzień {weekNum}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {weekDays.map((day: any) => {
                            const dayBlockIds = blocks.filter((b: any) => b.day_id === day.id).map((b: any) => b.id)
                            const dayExIds = blocks.filter((b: any) => b.day_id === day.id).flatMap((b: any) => (b.workout_block_exercises || []).map((e: any) => e.id))
                            const dayMods = dayExIds.filter((id: number) => overrideMap[id] && !overrideMap[id].skip).length
                            const daySkips = dayExIds.filter((id: number) => overrideMap[id]?.skip).length
                            const dayExtra = dayBlockIds.reduce((sum: number, bid: number) => sum + (extraMap[bid] || []).length, 0)
                            const isSelected = selectedDay === day.id
                            return (
                              <button key={day.id} onClick={() => setSelectedDay(day.id)}
                                style={{ padding: '0.5rem 0.875rem', border: `1.5px solid ${isSelected ? C.gold : C.grayLight}`, borderRadius: 8, background: isSelected ? C.navy : C.white, color: isSelected ? C.gold : C.navy, fontWeight: isSelected ? 800 : 500, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                                {day.day_name}
                                {dayMods > 0 && <span style={{ background: C.gold, color: C.navy, borderRadius: 8, padding: '1px 5px', fontSize: '0.58rem', fontWeight: 900 }}>✎{dayMods}</span>}
                                {daySkips > 0 && <span style={{ background: C.red, color: C.white, borderRadius: 8, padding: '1px 5px', fontSize: '0.58rem', fontWeight: 900 }}>✕{daySkips}</span>}
                                {dayExtra > 0 && <span style={{ background: C.green, color: C.white, borderRadius: 8, padding: '1px 5px', fontSize: '0.58rem', fontWeight: 900 }}>+{dayExtra}</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Info */}
              {currentDay && (
                <div style={{ marginBottom: '1rem', padding: '0.875rem 1.25rem', background: C.navyLight, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, marginBottom: 2 }}>{assignment?.plan?.name}</div>
                    <div style={{ color: C.white, fontWeight: 800 }}>Tydzień {currentDay.week?.week_number} · {currentDay.day_name}</div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gold, textAlign: 'right' }}>Kliknij ćwiczenie<br />aby modyfikować</div>
                </div>
              )}

              {/* Bloki */}
              {currentDayBlocks.length === 0 ? (
                <Card><div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak ćwiczeń w tym dniu.</div></Card>
              ) : (
                currentDayBlocks.map((block: any) => {
                  const templateExercises = (block.workout_block_exercises || []).sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                  const extras = extraMap[block.id] || []
                  const totalEx = templateExercises.length + extras.length

                  return (
                    <Card key={block.id} style={{ marginBottom: '1rem' }}>
                      {/* Nagłówek bloku */}
                      <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 800, fontSize: '1rem', color: C.navy }}>{block.block_name}</span>
                          {block.rounds > 1 && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, background: C.offWhite, padding: '2px 8px', borderRadius: 6 }}>{block.rounds} rundy</span>}
                          <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray }}>{totalEx} ćw.</span>
                        </div>
                        <button onClick={() => setAddingToBlock(block.id)}
                          style={{ padding: '0.45rem 0.875rem', border: `1.5px solid ${C.green}`, borderRadius: 8, background: C.white, color: C.green, fontWeight: 800, fontSize: '0.78rem' }}>
                          + Dodaj
                        </button>
                      </div>

                      {/* Ćwiczenia z szablonu */}
                      {templateExercises.map((ex: any, idx: number) => {
                        const override = overrideMap[ex.id]
                        const isSkipped = override?.skip
                        const isModified = override && !isSkipped
                        const isSwapped = isModified && override.is_substitution
                        const displayName = getExerciseDisplayName(ex, override)

                        return (
                          <button key={ex.id} onClick={() => setEditingExercise(ex)}
                            style={{
                              width: '100%', border: 'none', textAlign: 'left', fontFamily: sans,
                              background: isSkipped ? '#FEF2F2' : isModified ? C.navyLight : C.white,
                              borderBottom: `1.5px solid ${C.grayLight}`,
                              padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: 12,
                              opacity: isSkipped ? 0.7 : 1,
                            }}>
                            {/* Numer */}
                            <div style={{ width: 26, height: 26, borderRadius: 7, background: isSkipped ? C.red : isModified ? C.gold : C.offWhite, color: isSkipped ? C.white : isModified ? C.navy : C.gray, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 900, fontSize: '0.7rem', flexShrink: 0 }}>
                              {isSkipped ? '✕' : idx + 1}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                {ex.is_warmup && <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.gold, background: C.navy, padding: '1px 5px', borderRadius: 4 }}>WU</span>}
                                {isSwapped && <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.white, background: C.orange, padding: '1px 5px', borderRadius: 4 }}>ZAMIANA</span>}
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isSkipped ? C.red : isModified ? C.white : C.navy, textDecoration: isSkipped ? 'line-through' : 'none' }}>
                                  {displayName}
                                </span>
                              </div>
                              {/* Parametry */}
                              <div style={{ fontFamily: mono, fontSize: '0.68rem', letterSpacing: '0.03em', color: isModified && !isSkipped ? C.gray : C.gray }}>
                                {isSkipped ? (
                                  <span style={{ color: C.red }}>Pominięte dla tej zawodniczki</span>
                                ) : isModified ? (
                                  <>
                                    <span style={{ color: C.gold, fontWeight: 800 }}>
                                      {override.sets_override || ex.sets}×{override.reps_override || ex.reps || '—'}
                                      {override.weight_override ? ` · ${override.weight_override}kg` : ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}
                                      {override.tempo_override || ex.tempo ? ` · ${override.tempo_override || ex.tempo}` : ''}
                                    </span>
                                    {isSwapped && <span style={{ color: '#666', marginLeft: 8 }}>(oryg: {ex.exercise?.name ? formatExName(ex.exercise.name) : ex.exercise_code})</span>}
                                    {!isSwapped && <span style={{ color: '#555', marginLeft: 8 }}>(oryg: {ex.sets}×{ex.reps || '—'})</span>}
                                  </>
                                ) : (
                                  <>
                                    {ex.sets}×{ex.reps || '—'}
                                    {ex.tempo ? ` · ${ex.tempo}` : ''}
                                    {ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}
                                    {ex.rir != null ? ` · RIR ${ex.rir}` : ''}
                                  </>
                                )}
                              </div>
                              {(override?.coach_note_override || ex.coach_comment) && !isSkipped && (
                                <div style={{ fontSize: '0.75rem', color: isModified ? C.gold : C.gray, fontStyle: 'italic', marginTop: 3 }}>
                                  ✎ {override?.coach_note_override || ex.coach_comment}
                                </div>
                              )}
                            </div>

                            <div style={{ flexShrink: 0, paddingTop: 2 }}>
                              {isSkipped ? (
                                <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.red, border: `1.5px solid ${C.red}`, borderRadius: 6, padding: '2px 8px' }}>Pominięte</span>
                              ) : isModified ? (
                                <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, border: `1.5px solid ${C.gold}`, borderRadius: 6, padding: '2px 8px' }}>
                                  {isSwapped ? 'Zamienione' : 'Zmodyfikowane'}
                                </span>
                              ) : (
                                <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, border: `1.5px solid ${C.grayLight}`, borderRadius: 6, padding: '2px 8px' }}>✎ edytuj</span>
                              )}
                            </div>
                          </button>
                        )
                      })}

                      {/* Ćwiczenia dodane tylko dla tej zawodniczki */}
                      {extras.map((ex: any) => {
                        const name = ex.exercise?.name ? formatExName(ex.exercise.name) : (ex.exercise_code || '—')
                        return (
                          <div key={ex.id} style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'flex-start', gap: 12, background: '#F0FDF4' }}>
                            <div style={{ width: 26, height: 26, borderRadius: 7, background: C.green, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 900, fontSize: '0.7rem', flexShrink: 0 }}>＋</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.white, background: C.green, padding: '1px 5px', borderRadius: 4 }}>DODANE</span>
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: C.navy }}>{name}</span>
                              </div>
                              <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>
                                {ex.sets}×{ex.reps || '—'}{ex.tempo ? ` · ${ex.tempo}` : ''}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}{ex.rir != null ? ` · RIR ${ex.rir}` : ''}
                              </div>
                              {ex.coach_note && <div style={{ fontSize: '0.75rem', color: C.green, fontStyle: 'italic', marginTop: 3 }}>✎ {ex.coach_note}</div>}
                            </div>
                            <button onClick={() => handleExtraDelete(block.id, ex.id)}
                              style={{ background: 'none', border: `1.5px solid ${C.red}`, borderRadius: 6, color: C.red, padding: '2px 8px', fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                              Usuń
                            </button>
                          </div>
                        )
                      })}

                      {/* Przycisk dodaj na dole bloku */}
                      <button onClick={() => setAddingToBlock(block.id)}
                        style={{ width: '100%', padding: '0.75rem', border: 'none', background: C.offWhite, color: C.gray, fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        ＋ Dodaj ćwiczenie do tego bloku
                      </button>
                    </Card>
                  )
                })
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
