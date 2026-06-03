'use client'
// src/app/coach/athletes/[id]/training/CoachAthleteTrainingClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`,
  borderRadius: 10, background: C.offWhite, color: C.navy,
  fontFamily: mono, fontSize: '0.95rem', outline: 'none', textAlign: 'center',
}

const labelStyle: React.CSSProperties = {
  fontFamily: mono, fontSize: '0.62rem', color: C.gray,
  letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700,
}

// ─── MODAL MODYFIKACJI ────────────────────────────────────────────────────────
function OverrideModal({ exercise, athleteName, existingOverride, onSave, onClose }: {
  exercise: any; athleteName: string; existingOverride: any | null
  onSave: (override: any) => void; onClose: () => void
}) {
  const supabase = createClient()
  const [sets, setSets] = useState(existingOverride?.sets_override?.toString() || exercise.sets?.toString() || '')
  const [reps, setReps] = useState(existingOverride?.reps_override || exercise.reps || '')
  const [weight, setWeight] = useState(existingOverride?.weight_override?.toString() || exercise.weight_kg?.toString() || '')
  const [tempo, setTempo] = useState(existingOverride?.tempo_override || exercise.tempo || '')
  const [note, setNote] = useState(existingOverride?.coach_note_override || exercise.coach_comment || '')
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
      const { data } = await supabase.from('athlete_exercise_overrides').update(payload).eq('id', existingOverride.id).select().single()
      result = data
    } else {
      const { data } = await supabase.from('athlete_exercise_overrides').insert(payload).select().single()
      result = data
    }
    setSaving(false)
    if (result) onSave(result)
    onClose()
  }

  async function handleDelete() {
    if (!existingOverride) return
    setSaving(true)
    await supabase.from('athlete_exercise_overrides').delete().eq('id', existingOverride.id)
    setSaving(false)
    onSave(null)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 500, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Modyfikacja indywidualna</div>
          <h2 style={{ color: C.white, fontSize: '1.2rem', fontWeight: 800, marginBottom: 4 }}>{exerciseName}</h2>
          <p style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>
            Zmiana dotyczy tylko <strong style={{ color: C.gold }}>{athleteName}</strong> — szablon pozostaje bez zmian
          </p>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* Szablon */}
          <div style={{ background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>
            <span style={{ fontWeight: 700, color: C.navy }}>Szablon: </span>
            {exercise.sets}×{exercise.reps || '—'}
            {exercise.tempo && ` · ${exercise.tempo}`}
            {exercise.weight_kg && ` · ${exercise.weight_kg}kg`}
            {exercise.rir != null && ` · RIR ${exercise.rir}`}
            {exercise.coach_comment && <span style={{ display: 'block', marginTop: 4, fontStyle: 'italic' }}>{exercise.coach_comment}</span>}
          </div>

          {/* Pola */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Serie</label>
              <input type="number" value={sets} onChange={e => setSets(e.target.value)} placeholder={exercise.sets?.toString()} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Powtórzenia</label>
              <input type="text" value={reps} onChange={e => setReps(e.target.value)} placeholder={exercise.reps || '—'} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Ciężar (kg)</label>
              <input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder={exercise.weight_kg?.toString() || '—'} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tempo</label>
              <input type="text" value={tempo} onChange={e => setTempo(e.target.value)} placeholder={exercise.tempo || '—'} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Notatka dla zawodniczki</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Wskazówki, powód modyfikacji..." rows={3}
              style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem', outline: 'none', resize: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1.1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            {existingOverride && (
              <button onClick={handleDelete} disabled={saving} style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.red}`, borderRadius: 12, background: C.white, color: C.red, fontWeight: 700 }}>Usuń mod.</button>
            )}
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12, background: C.navy, color: C.gold, fontWeight: 900, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Zapisuję...' : 'Zapisz modyfikację ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
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
  const overrideCount = Object.keys(overrideMap).length

  function handleOverrideSave(exerciseId: number, override: any | null) {
    setOverrideMap(prev => {
      const next = { ...prev }
      if (override) next[exerciseId] = override
      else delete next[exerciseId]
      return next
    })
  }

  // Pogrupuj dni wg tygodnia
  const weekGroups: Record<number, any[]> = {}
  for (const day of days) {
    const wn = day.week?.week_number || 1
    if (!weekGroups[wn]) weekGroups[wn] = []
    weekGroups[wn].push(day)
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
        <OverrideModal
          exercise={{ ...editingExercise, _athleteId: athlete.id }}
          athleteName={athlete.full_name.split(' ')[0]}
          existingOverride={overrideMap[editingExercise.id] || null}
          onSave={o => handleOverrideSave(editingExercise.id, o)}
          onClose={() => setEditingExercise(null)}
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
              {overrideCount > 0 && (
                <div style={{ background: C.gold, color: C.navy, borderRadius: 20, padding: '4px 12px', fontFamily: mono, fontSize: '0.7rem', fontWeight: 900 }}>
                  {overrideCount} modyfikacji
                </div>
              )}
            </div>
            {assignment && (
              <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>
                {athlete.full_name} · {assignment.order_mode === 'sequential' ? 'sekwencyjny' : 'datowany'}
              </div>
            )}
          </div>
        </header>

        <main style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>

          {!assignment ? (
            <Card>
              <div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📋</div>
                <div style={{ fontWeight: 800, color: C.navy, marginBottom: 4 }}>Brak przypisanego planu</div>
                <div style={{ fontSize: '0.86rem' }}>Przypisz plan zawodniczce z widoku grupy lub panelu.</div>
              </div>
            </Card>
          ) : (
            <>
              {/* Nawigacja po dniach — pogrupowana wg tygodni */}
              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 700 }}>
                    Wybierz dzień treningowy
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(weekGroups).map(([weekNum, weekDays]) => (
                      <div key={weekNum}>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                          Tydzień {weekNum}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {weekDays.map((day: any) => {
                            const dayExerciseIds = blocks
                              .filter((b: any) => b.day_id === day.id)
                              .flatMap((b: any) => (b.workout_block_exercises || []).map((e: any) => e.id))
                            const dayOverrides = dayExerciseIds.filter((id: number) => overrideMap[id]).length
                            const isSelected = selectedDay === day.id
                            return (
                              <button key={day.id} onClick={() => setSelectedDay(day.id)}
                                style={{ padding: '0.5rem 0.875rem', border: `1.5px solid ${isSelected ? C.gold : C.grayLight}`, borderRadius: 8, background: isSelected ? C.navy : C.white, color: isSelected ? C.gold : C.navy, fontWeight: isSelected ? 800 : 500, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {day.day_name}
                                {dayOverrides > 0 && (
                                  <span style={{ background: C.gold, color: C.navy, borderRadius: 10, padding: '1px 6px', fontFamily: mono, fontSize: '0.58rem', fontWeight: 900 }}>
                                    ✎{dayOverrides}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Info o wybranym dniu */}
              {currentDay && (
                <div style={{ marginBottom: '1rem', padding: '0.875rem 1.25rem', background: C.navyLight, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, marginBottom: 2 }}>{assignment?.plan?.name}</div>
                    <div style={{ color: C.white, fontWeight: 800, fontSize: '1rem' }}>
                      Tydzień {currentDay.week?.week_number} · {currentDay.day_name}
                    </div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gold, textAlign: 'right' }}>
                    Kliknij ćwiczenie<br />aby zmodyfikować
                  </div>
                </div>
              )}

              {/* Bloki i ćwiczenia */}
              {currentDayBlocks.length === 0 ? (
                <Card>
                  <div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak ćwiczeń w tym dniu.</div>
                </Card>
              ) : (
                currentDayBlocks.map((block: any) => (
                  <Card key={block.id} style={{ marginBottom: '1rem' }}>
                    {/* Nagłówek bloku */}
                    <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: C.navy }}>{block.block_name}</span>
                      {block.rounds > 1 && (
                        <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, background: C.offWhite, padding: '2px 8px', borderRadius: 6 }}>
                          {block.rounds} rundy
                        </span>
                      )}
                    </div>

                    {/* Ćwiczenia */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(block.workout_block_exercises || [])
                        .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                        .map((ex: any, idx: number, arr: any[]) => {
                          const override = overrideMap[ex.id]
                          const hasOverride = !!override
                          const exerciseName = ex.exercise?.name || ex.exercise_code || 'Ćwiczenie'

                          return (
                            <button key={ex.id} onClick={() => setEditingExercise(ex)}
                              style={{
                                width: '100%', border: 'none', background: hasOverride ? C.navyLight : C.white,
                                borderBottom: idx < arr.length - 1 ? `1.5px solid ${C.grayLight}` : 'none',
                                padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'flex-start',
                                justifyContent: 'space-between', gap: 12, textAlign: 'left', fontFamily: sans,
                              }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Nazwa */}
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: hasOverride ? C.white : C.navy, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {ex.is_warmup && (
                                    <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gold, background: C.navy, padding: '1px 5px', borderRadius: 4, letterSpacing: '0.06em' }}>WU</span>
                                  )}
                                  {exerciseName}
                                </div>
                                {/* Parametry */}
                                <div style={{ fontFamily: mono, fontSize: '0.68rem', color: hasOverride ? C.gray : C.gray, letterSpacing: '0.03em' }}>
                                  {hasOverride ? (
                                    <>
                                      <span style={{ color: C.gold, fontWeight: 800 }}>
                                        {override.sets_override || ex.sets}×{override.reps_override || ex.reps || '—'}
                                        {override.weight_override && ` · ${override.weight_override}kg`}
                                        {override.tempo_override && ` · ${override.tempo_override}`}
                                      </span>
                                      <span style={{ color: C.gray, marginLeft: 8 }}>
                                        (szablon: {ex.sets}×{ex.reps || '—'})
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      {ex.sets}×{ex.reps || '—'}
                                      {ex.tempo && ` · ${ex.tempo}`}
                                      {ex.weight_kg && ` · ${ex.weight_kg}kg`}
                                      {ex.rir != null && ex.rir !== undefined && ` · RIR ${ex.rir}`}
                                    </>
                                  )}
                                </div>
                                {/* Notatka */}
                                {(override?.coach_note_override || ex.coach_comment) && (
                                  <div style={{ marginTop: 4, fontSize: '0.78rem', color: hasOverride ? C.gold : C.gray, fontStyle: 'italic' }}>
                                    ✎ {override?.coach_note_override || ex.coach_comment}
                                  </div>
                                )}
                              </div>
                              {/* Badge + ikona */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 2 }}>
                                {hasOverride ? (
                                  <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, background: C.navy, padding: '2px 8px', borderRadius: 6, letterSpacing: '0.06em', border: `1.5px solid ${C.gold}` }}>
                                    Zmodyfikowane
                                  </span>
                                ) : (
                                  <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, border: `1.5px solid ${C.grayLight}`, borderRadius: 6, padding: '2px 8px' }}>
                                    ✎ edytuj
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </Card>
                ))
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
