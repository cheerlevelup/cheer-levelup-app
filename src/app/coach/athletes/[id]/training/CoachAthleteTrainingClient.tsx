'use client'
// src/app/coach/athletes/[id]/training/CoachAthleteTrainingClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

// ─── MODAL MODYFIKACJI ─────────────────────────────────────────────────────────
function OverrideModal({
  exercise,
  athleteName,
  existingOverride,
  onSave,
  onClose,
}: {
  exercise: any
  athleteName: string
  existingOverride: any | null
  onSave: (override: any) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const [sets, setSets] = useState<string>(existingOverride?.sets_override?.toString() || exercise.sets?.toString() || '')
  const [reps, setReps] = useState<string>(existingOverride?.reps_override || exercise.reps || '')
  const [weight, setWeight] = useState<string>(existingOverride?.weight_override?.toString() || exercise.weight_kg?.toString() || '')
  const [tempo, setTempo] = useState<string>(existingOverride?.tempo_override || exercise.tempo || '')
  const [note, setNote] = useState<string>(existingOverride?.coach_note_override || exercise.coach_comment || '')
  const [saving, setSaving] = useState(false)

  const exerciseName = exercise.exercise?.name || exercise.exercise_code || 'Ćwiczenie'

  async function handleSave() {
    setSaving(true)
    const payload = {
      athlete_id: exercise._athleteId,
      block_exercise_id: exercise.id,
      sets_override: sets ? parseInt(sets) : null,
      reps_override: reps || null,
      weight_override: weight ? parseFloat(weight) : null,
      tempo_override: tempo || null,
      coach_note_override: note || null,
      is_substitution: false,
    }

    let result
    if (existingOverride) {
      const { data } = await supabase
        .from('athlete_exercise_overrides')
        .update(payload)
        .eq('id', existingOverride.id)
        .select()
        .single()
      result = data
    } else {
      const { data } = await supabase
        .from('athlete_exercise_overrides')
        .insert(payload)
        .select()
        .single()
      result = data
    }

    setSaving(false)
    if (result) onSave(result)
    onClose()
  }

  async function handleDelete() {
    if (!existingOverride) return
    setSaving(true)
    await supabase
      .from('athlete_exercise_overrides')
      .delete()
      .eq('id', existingOverride.id)
    setSaving(false)
    onSave(null)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: sans,
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#F0EEE9', padding: '2rem',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Nagłówek */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            fontFamily: mono, fontSize: '0.62rem', color: '#F5C842',
            background: '#111', padding: '4px 10px', display: 'inline-block',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10,
          }}>
            Modyfikacja indywidualna
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111', marginBottom: 4 }}>
            {exerciseName}
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#888' }}>
            Ta zmiana dotyczy tylko <strong style={{ color: '#111' }}>{athleteName}</strong>, nie zmienia szablonu.
          </p>
        </div>

        {/* Oryginalne parametry */}
        <div style={{
          background: '#E8E6E0', padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontFamily: mono, fontSize: '0.7rem', color: '#666',
          letterSpacing: '0.04em',
        }}>
          Szablon: {exercise.sets}×{exercise.reps || '—'}
          {exercise.tempo && ` · ${exercise.tempo}`}
          {exercise.weight_kg && ` · ${exercise.weight_kg}kg`}
          {exercise.coach_comment && ` · "${exercise.coach_comment}"`}
        </div>

        {/* Pola edycji */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
          <div>
            <label style={{ fontFamily: mono, fontSize: '0.62rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Serie
            </label>
            <input
              type="number"
              value={sets}
              onChange={e => setSets(e.target.value)}
              placeholder={exercise.sets?.toString()}
              style={{ width: '100%', padding: '0.75rem', fontFamily: mono, fontSize: '1rem', background: '#E8E6E0', border: 'none', color: '#111', outline: 'none', textAlign: 'center' }}
            />
          </div>
          <div>
            <label style={{ fontFamily: mono, fontSize: '0.62rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Powtórzenia
            </label>
            <input
              type="text"
              value={reps}
              onChange={e => setReps(e.target.value)}
              placeholder={exercise.reps || '—'}
              style={{ width: '100%', padding: '0.75rem', fontFamily: mono, fontSize: '1rem', background: '#E8E6E0', border: 'none', color: '#111', outline: 'none', textAlign: 'center' }}
            />
          </div>
          <div>
            <label style={{ fontFamily: mono, fontSize: '0.62rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Ciężar (kg)
            </label>
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder={exercise.weight_kg?.toString() || '—'}
              style={{ width: '100%', padding: '0.75rem', fontFamily: mono, fontSize: '1rem', background: '#E8E6E0', border: 'none', color: '#111', outline: 'none', textAlign: 'center' }}
            />
          </div>
          <div>
            <label style={{ fontFamily: mono, fontSize: '0.62rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Tempo
            </label>
            <input
              type="text"
              value={tempo}
              onChange={e => setTempo(e.target.value)}
              placeholder={exercise.tempo || '—'}
              style={{ width: '100%', padding: '0.75rem', fontFamily: mono, fontSize: '1rem', background: '#E8E6E0', border: 'none', color: '#111', outline: 'none', textAlign: 'center' }}
            />
          </div>
        </div>

        {/* Notatka dla zawodniczki */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontFamily: mono, fontSize: '0.62rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
            Notatka dla zawodniczki
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Wskazówki, powód modyfikacji..."
            rows={3}
            style={{ width: '100%', padding: '0.75rem', fontFamily: sans, fontSize: '0.9rem', background: '#E8E6E0', border: 'none', color: '#111', outline: 'none', resize: 'none' }}
          />
        </div>

        {/* Przyciski */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 0, padding: '0.875rem 1.25rem', background: '#E8E6E0', color: '#111', fontFamily: sans, fontSize: '0.9rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Anuluj
          </button>
          {existingOverride && (
            <button
              onClick={handleDelete}
              disabled={saving}
              style={{ flex: 0, padding: '0.875rem 1rem', background: 'transparent', color: '#c0392b', fontFamily: sans, fontSize: '0.85rem', border: '1px solid #c0392b', cursor: 'pointer' }}
            >
              Usuń modyfikację
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1, padding: '0.875rem', background: '#111', color: '#F0EEE9', fontFamily: sans, fontSize: '0.95rem', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Zapisuję...' : 'Zapisz modyfikację ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN CLIENT ───────────────────────────────────────────────────────────────
export default function CoachAthleteTrainingClient({ athlete, assignment, days, blocks, overrides }: any) {
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState<number>(days[0]?.id || 0)
  const [overrideMap, setOverrideMap] = useState<Record<number, any>>(() => {
    const map: Record<number, any> = {}
    for (const o of overrides) map[o.block_exercise_id] = o
    return map
  })
  const [editingExercise, setEditingExercise] = useState<any | null>(null)

  const currentDayBlocks = blocks
    .filter((b: any) => b.day_id === selectedDay)
    .sort((a: any, z: any) => a.block_order - z.block_order)

  const currentDay = days.find((d: any) => d.id === selectedDay)

  function handleOverrideSave(exerciseId: number, override: any | null) {
    setOverrideMap(prev => {
      const next = { ...prev }
      if (override) next[exerciseId] = override
      else delete next[exerciseId]
      return next
    })
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F0EEE9; }`}</style>

      {editingExercise && (
        <OverrideModal
          exercise={{ ...editingExercise, _athleteId: athlete.id }}
          athleteName={athlete.full_name.split(' ')[0]}
          existingOverride={overrideMap[editingExercise.id] || null}
          onSave={(o) => handleOverrideSave(editingExercise.id, o)}
          onClose={() => setEditingExercise(null)}
        />
      )}

      <div style={{ minHeight: '100vh', background: '#F0EEE9', fontFamily: sans, color: '#111' }}>

        {/* Header */}
        <header style={{
          borderBottom: '1px solid #D5D2CB', padding: '1rem 2rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: '#F0EEE9', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button
            onClick={() => router.push(`/coach/athletes/${athlete.id}`)}
            style={{ fontFamily: mono, fontSize: '0.75rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            ← {athlete.full_name.split(' ')[0]}
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>
              Plan treningowy
            </h1>
            <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.04em' }}>
              {assignment?.plan?.name} · modyfikacje dla {athlete.full_name.split(' ')[0]}
            </p>
          </div>
          {/* Licznik overrides */}
          {Object.keys(overrideMap).length > 0 && (
            <div style={{
              fontFamily: mono, fontSize: '0.65rem', color: '#F5C842',
              background: '#111', padding: '4px 10px', letterSpacing: '0.06em',
            }}>
              {Object.keys(overrideMap).length} modyfikacji
            </div>
          )}
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 2rem 4rem' }}>

          {!assignment ? (
            <div style={{ background: '#E8E6E0', padding: '2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                Brak przypisanego planu dla tej zawodniczki.
              </p>
            </div>
          ) : (
            <>
              {/* Wybór dnia */}
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                  Wybierz dzień treningowy
                </p>
                <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {days.map((day: any) => {
                    const dayBlocks = blocks.filter((b: any) => b.day_id === day.id)
                    const dayExerciseIds = dayBlocks.flatMap((b: any) => (b.workout_block_exercises || []).map((e: any) => e.id))
                    const dayOverrides = dayExerciseIds.filter((id: number) => overrideMap[id]).length

                    return (
                      <button
                        key={day.id}
                        onClick={() => setSelectedDay(day.id)}
                        style={{
                          padding: '0.625rem 1rem',
                          background: selectedDay === day.id ? '#111' : '#E8E6E0',
                          color: selectedDay === day.id ? '#F0EEE9' : '#111',
                          fontFamily: mono, fontSize: '0.72rem',
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          border: 'none', cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                      >
                        Tydz. {day.week?.week_number} · {day.day_name}
                        {dayOverrides > 0 && (
                          <span style={{ marginLeft: 6, color: selectedDay === day.id ? '#F5C842' : '#888', fontSize: '0.6rem' }}>
                            ✎{dayOverrides}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Info */}
              {currentDay && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ background: '#111', color: '#F0EEE9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.06em', marginBottom: 3 }}>
                        {assignment?.plan?.name}
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                        Tydzień {currentDay.week?.week_number} · {currentDay.day_name}
                      </div>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: '0.7rem', color: '#F5C842', textAlign: 'right' }}>
                      Kliknij ćwiczenie<br />żeby je zmodyfikować
                    </div>
                  </div>
                </div>
              )}

              {/* Bloki z ćwiczeniami */}
              {currentDayBlocks.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Brak ćwiczeń w tym dniu.
                </p>
              ) : (
                currentDayBlocks.map((block: any) => (
                  <div key={block.id} style={{ marginBottom: '1.5rem' }}>
                    {/* Nagłówek bloku */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      marginBottom: '0.75rem', paddingBottom: '0.5rem',
                      borderBottom: '2px solid #111',
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111' }}>
                        {block.block_name}
                      </span>
                      {block.rounds > 1 && (
                        <span style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.06em' }}>
                          {block.rounds} rundy
                        </span>
                      )}
                    </div>

                    {/* Ćwiczenia */}
                    {(block.workout_block_exercises || [])
                      .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                      .map((ex: any) => {
                        const override = overrideMap[ex.id]
                        const hasOverride = !!override
                        const exerciseName = ex.exercise?.name || ex.exercise_code || 'Ćwiczenie'

                        return (
                          <button
                            key={ex.id}
                            onClick={() => setEditingExercise(ex)}
                            style={{
                              width: '100%',
                              background: hasOverride ? '#111' : '#E8E6E0',
                              color: hasOverride ? '#F0EEE9' : '#111',
                              padding: '1rem 1.25rem',
                              marginBottom: 1,
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between',
                              border: 'none', cursor: 'pointer',
                              textAlign: 'left', fontFamily: sans,
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => !hasOverride && (e.currentTarget.style.background = '#DDDAD3')}
                            onMouseLeave={e => !hasOverride && (e.currentTarget.style.background = '#E8E6E0')}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>
                                {ex.is_warmup && (
                                  <span style={{ fontFamily: mono, fontSize: '0.58rem', color: hasOverride ? '#888' : '#aaa', marginRight: 6, letterSpacing: '0.06em' }}>WU</span>
                                )}
                                {exerciseName}
                              </div>

                              {/* Parametry — pokazuje override jeśli istnieje */}
                              <div style={{ fontFamily: mono, fontSize: '0.68rem', color: hasOverride ? '#aaa' : '#888', letterSpacing: '0.04em' }}>
                                {hasOverride ? (
                                  <>
                                    <span style={{ color: '#F5C842' }}>
                                      {override.sets_override || ex.sets}×{override.reps_override || ex.reps || '—'}
                                      {override.weight_override && ` · ${override.weight_override}kg`}
                                      {override.tempo_override && ` · ${override.tempo_override}`}
                                    </span>
                                    <span style={{ color: '#666', marginLeft: 8 }}>
                                      (szablon: {ex.sets}×{ex.reps || '—'})
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {ex.sets}×{ex.reps || '—'}
                                    {ex.tempo && ` · ${ex.tempo}`}
                                    {ex.weight_kg && ` · ${ex.weight_kg}kg`}
                                    {ex.rir !== null && ex.rir !== undefined && ` · RIR ${ex.rir}`}
                                  </>
                                )}
                              </div>

                              {/* Notatka trenera */}
                              {(override?.coach_note_override || ex.coach_comment) && (
                                <div style={{
                                  marginTop: 4, fontSize: '0.78rem',
                                  color: hasOverride ? '#F5C842' : '#666',
                                  fontStyle: 'italic',
                                }}>
                                  ✎ {override?.coach_note_override || ex.coach_comment}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                              {hasOverride && (
                                <span style={{
                                  fontFamily: mono, fontSize: '0.6rem',
                                  color: '#F5C842', letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                }}>
                                  Zmodyfikowane
                                </span>
                              )}
                              <span style={{ color: hasOverride ? '#888' : '#aaa', fontSize: '0.9rem' }}>
                                ✎
                              </span>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                ))
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
