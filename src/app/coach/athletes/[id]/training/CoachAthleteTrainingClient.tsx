'use client'
// src/app/coach/athletes/[id]/training/CoachAthleteTrainingClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444', orange: '#F97316',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>{children}</div>
}
const inputSt: React.CSSProperties = { width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: mono, fontSize: '0.9rem', outline: 'none', textAlign: 'center' }
const labelSt: React.CSSProperties = { fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }
function fmt(n: string) { return n.replace(/-/g, ' ') }

// ─── MODAL EDYCJI ĆWICZENIA ───────────────────────────────────────────────────
function ExerciseEditModal({ ex, athleteId, athleteName, existingOverride, exerciseLibrary, allBlocks, onSave, onSaveAll, onClose }: {
  ex: any; athleteId: number; athleteName: string
  existingOverride: any | null; exerciseLibrary: any[]; allBlocks: any[]
  onSave: (override: any) => void
  onSaveAll: (exerciseId: number | null, exerciseCode: string | null, overrides: { exerciseId: number; override: any }[]) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const [mode, setMode] = useState<'same' | 'library' | 'custom'>(
    existingOverride?.exercise_code_override ? 'custom'
      : existingOverride?.exercise_id_override ? 'library'
      : 'same'
  )
  const [libId, setLibId] = useState(existingOverride?.exercise_id_override?.toString() || '')
  const [customName, setCustomName] = useState(existingOverride?.exercise_code_override || ex.exercise_code || ex.exercise?.name || '')
  const [sets, setSets] = useState(existingOverride?.sets_override?.toString() || ex.sets?.toString() || '3')
  const [reps, setReps] = useState(existingOverride?.reps_override || ex.reps || '')
  const [weight, setWeight] = useState(existingOverride?.weight_override?.toString() || ex.weight_kg?.toString() || '')
  const [tempo, setTempo] = useState(existingOverride?.tempo_override || ex.tempo || '')
  const [rir, setRir] = useState(existingOverride?.rir?.toString() || ex.rir?.toString() || '')
  const [note, setNote] = useState(existingOverride?.coach_note_override || ex.coach_comment || '')
  const [videoUrl, setVideoUrl] = useState(existingOverride?.exercise_url_override ?? ex.exercise_url ?? '')

  // Warmup sets — format: { reps, weight_kg, note }
  type WarmupSet = { reps: string; weight_kg: string; note: string }
  function parseWarmupSets(raw: any): WarmupSet[] {
    if (!raw) return []
    const arr = Array.isArray(raw) ? raw : []
    return arr.map((s: any) => ({ reps: s.reps?.toString() || '', weight_kg: s.weight_kg?.toString() || '', note: s.note || '' }))
  }
  const initialWarmup = parseWarmupSets(existingOverride?.warmup_sets_override ?? ex.warmup_sets)
  const [warmupSets, setWarmupSets] = useState<WarmupSet[]>(initialWarmup)

  function addWarmupSet() { setWarmupSets(prev => [...prev, { reps: '', weight_kg: '', note: '' }]) }
  function removeWarmupSet(i: number) { setWarmupSets(prev => prev.filter((_, idx) => idx !== i)) }
  function updateWarmupSet(i: number, field: keyof WarmupSet, val: string) {
    setWarmupSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  }

  const [wholePlan, setWholePlan] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const originalName = ex.exercise?.name ? fmt(ex.exercise.name) : (ex.exercise_code || 'Ćwiczenie')

  function buildPayload(blockExerciseId: number): any {
    const cleanWarmup = warmupSets
      .filter(s => s.reps || s.weight_kg || s.note)
      .map(s => ({ reps: s.reps || null, weight_kg: s.weight_kg || null, note: s.note || null }))
    return {
      athlete_id: athleteId,
      block_exercise_id: blockExerciseId,
      sets_override: sets ? parseInt(sets) : null,
      reps_override: reps || null,
      weight_override: weight ? parseFloat(weight) : null,
      tempo_override: tempo || null,
      coach_note_override: note || null,
      is_substitution: mode !== 'same',
      skip: false,
      exercise_id_override: mode === 'library' && libId ? parseInt(libId) : null,
      exercise_code_override: mode === 'custom' && customName.trim() ? customName.trim() : null,
      exercise_url_override: videoUrl.trim() || null,
      warmup_sets_override: cleanWarmup.length > 0 ? cleanWarmup : null,
    }
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const payload = buildPayload(ex.id)

      // Próba z pełnym payloadem (nowe kolumny); fallback do podstawowego jeśli schema cache
      function stripNewCols(p: any) {
        const { exercise_id_override, exercise_code_override, skip, is_substitution, exercise_url_override, warmup_sets_override, ...basic } = p
        return basic
      }
      function isSchemaErr(msg: string) {
        return msg.includes('schema cache') || msg.includes('exercise_id_override') || msg.includes('skip') || msg.includes('exercise_url_override') || msg.includes('warmup_sets_override')
      }
      async function tryUpsert(p: any, id?: number) {
        if (id) {
          const r = await supabase.from('athlete_exercise_overrides').update(p).eq('id', id).select().single()
          if (r.error && isSchemaErr(r.error.message))
            return supabase.from('athlete_exercise_overrides').update(stripNewCols(p)).eq('id', id).select().single()
          return r
        }
        const r = await supabase.from('athlete_exercise_overrides').insert(p).select().single()
        if (r.error && isSchemaErr(r.error.message))
          return supabase.from('athlete_exercise_overrides').insert(stripNewCols(p)).select().single()
        return r
      }

      let result: any
      if (existingOverride) {
        const { data, error: e } = await tryUpsert(payload, existingOverride.id)
        if (e) throw e; result = data
      } else {
        const { data, error: e } = await tryUpsert(payload)
        if (e) throw e; result = data
      }

      // Wzbogać override o nazwę z biblioteki
      const resolvedLibEx = mode === 'library' && libId
        ? exerciseLibrary.find(l => l.id === parseInt(libId))
        : null
      const enriched = { ...result, exercise_override: resolvedLibEx || null }
      onSave(enriched)

      // Jeśli "zachowaj dla całego planu" — znajdź wszystkie ćwiczenia z tym samym exercise_id/code
      if (wholePlan) {
        const srcId = ex.exercise_id
        const srcCode = ex.exercise_code
        const siblings: { exerciseId: number; override: any }[] = []
        for (const block of allBlocks) {
          for (const bex of (block.workout_block_exercises || [])) {
            if (bex.id === ex.id) continue // ten już zapisany
            const match = srcId ? bex.exercise_id === srcId : (srcCode && bex.exercise_code === srcCode)
            if (!match) continue
            const sibPayload = buildPayload(bex.id)
            let sibResult = await supabase.from('athlete_exercise_overrides').upsert({ ...sibPayload }, { onConflict: 'athlete_id,block_exercise_id' }).select().single()
            if (sibResult.error?.message?.includes('schema cache') || sibResult.error?.message?.includes('block_exercise_id')) {
              const { exercise_id_override, exercise_code_override, skip, is_substitution, ...basicSib } = sibPayload
              sibResult = await supabase.from('athlete_exercise_overrides').upsert({ ...basicSib }, { onConflict: 'athlete_id,block_exercise_id' }).select().single()
            }
            const { data: sd } = sibResult
            if (sd) siblings.push({ exerciseId: bex.id, override: { ...sd, exercise_override: resolvedLibEx || null } })
          }
        }
        onSaveAll(srcId || null, srcCode || null, siblings)
      }

      onClose()
    } catch (e: any) {
      setError(e.message || 'Błąd zapisu')
      setSaving(false)
    }
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 540, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '94vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Modyfikacja ćwiczenia</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem', marginBottom: 3 }}>{originalName}</div>
          <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>tylko dla <strong style={{ color: C.gold }}>{athleteName}</strong></div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {/* Szablon */}
          <div style={{ background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontFamily: mono, fontSize: '0.78rem', color: C.navy }}>
            <span style={{ fontWeight: 700 }}>Szablon: </span>
            {ex.sets}×{ex.reps || '—'}{ex.tempo ? ` · ${ex.tempo}` : ''}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}{ex.rir != null ? ` · RIR ${ex.rir}` : ''}
            {ex.coach_comment && <span style={{ display: 'block', marginTop: 4, fontStyle: 'italic', color: C.gray }}>{ex.coach_comment}</span>}
          </div>

          {/* Nazwa ćwiczenia */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ ...labelSt, marginBottom: 8 }}>Ćwiczenie</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[{ k: 'same', l: 'Bez zmiany nazwy' }, { k: 'library', l: 'Z biblioteki' }, { k: 'custom', l: 'Wpisz nazwę' }].map(o => (
                <button key={o.k} onClick={() => setMode(o.k as any)}
                  style={{ flex: 1, padding: '0.55rem 0.4rem', border: `1.5px solid ${mode === o.k ? C.gold : C.grayLight}`, borderRadius: 8, background: mode === o.k ? C.navy : C.offWhite, color: mode === o.k ? C.gold : C.gray, fontWeight: mode === o.k ? 800 : 500, fontSize: '0.72rem' }}>
                  {o.l}
                </button>
              ))}
            </div>
            {mode === 'same' && (
              <div style={{ padding: '0.75rem', background: C.offWhite, borderRadius: 10, fontFamily: mono, fontSize: '0.82rem', color: C.navy, fontWeight: 700 }}>{originalName}</div>
            )}
            {mode === 'library' && (
              <select value={libId} onChange={e => setLibId(e.target.value)} style={{ ...inputSt, textAlign: 'left', fontFamily: sans, appearance: 'none' }}>
                <option value="">Wybierz ćwiczenie...</option>
                {exerciseLibrary.map((e: any) => <option key={e.id} value={e.id}>{fmt(e.name)}{e.category ? ` (${e.category})` : ''}</option>)}
              </select>
            )}
            {mode === 'custom' && (
              <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                placeholder="Wpisz dowolną nazwę ćwiczenia..."
                style={{ ...inputSt, textAlign: 'left', fontFamily: sans }} />
            )}
          </div>

          {/* Parametry */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ ...labelSt, marginBottom: 8 }}>Parametry</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
              <div><label style={labelSt}>Serie</label><input type="number" value={sets} onChange={e => setSets(e.target.value)} style={inputSt} /></div>
              <div><label style={labelSt}>Powt.</label><input type="text" value={reps} onChange={e => setReps(e.target.value)} placeholder="8–10" style={inputSt} /></div>
              <div><label style={labelSt}>Kg</label><input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" style={inputSt} /></div>
              <div><label style={labelSt}>RIR</label><input type="number" value={rir} onChange={e => setRir(e.target.value)} placeholder="—" style={inputSt} /></div>
            </div>
            <div><label style={labelSt}>Tempo</label><input type="text" value={tempo} onChange={e => setTempo(e.target.value)} placeholder="np. 3-1-2-0" style={{ ...inputSt, textAlign: 'left', fontFamily: sans }} /></div>
          </div>

          {/* Notatka */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelSt}>Notatka dla zawodniczki</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Wskazówki, powód zmiany..." rows={2}
              style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem', outline: 'none', resize: 'none' }} />
          </div>

          {/* Link do filmiku */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelSt}>Link do filmiku (YouTube / Vimeo)</label>
            <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              style={{ ...inputSt, textAlign: 'left', fontFamily: sans }} />
          </div>

          {/* Serie rozgrzewkowe */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelSt, marginBottom: 0 }}>Serie rozgrzewkowe</label>
              <button onClick={addWarmupSet} style={{ border: `1.5px solid ${C.gold}`, background: C.navy, color: C.gold, borderRadius: 8, padding: '0.3rem 0.7rem', fontFamily: mono, fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}>+ Dodaj</button>
            </div>
            {warmupSets.length === 0 && (
              <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, fontStyle: 'italic' }}>Brak serii rozgrzewkowych</div>
            )}
            {warmupSets.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <div>
                  {i === 0 && <label style={{ ...labelSt, fontSize: '0.55rem' }}>Powt.</label>}
                  <input type="text" value={s.reps} onChange={e => updateWarmupSet(i, 'reps', e.target.value)}
                    placeholder="np. 8" style={{ ...inputSt, fontSize: '0.82rem', padding: '0.5rem' }} />
                </div>
                <div>
                  {i === 0 && <label style={{ ...labelSt, fontSize: '0.55rem' }}>Ciężar</label>}
                  <input type="text" value={s.weight_kg} onChange={e => updateWarmupSet(i, 'weight_kg', e.target.value)}
                    placeholder="kg / BW" style={{ ...inputSt, fontSize: '0.82rem', padding: '0.5rem' }} />
                </div>
                <div>
                  {i === 0 && <label style={{ ...labelSt, fontSize: '0.55rem' }}>Notatka</label>}
                  <input type="text" value={s.note} onChange={e => updateWarmupSet(i, 'note', e.target.value)}
                    placeholder="wskazówka..." style={{ ...inputSt, textAlign: 'left', fontFamily: sans, fontSize: '0.82rem', padding: '0.5rem' }} />
                </div>
                <button onClick={() => removeWarmupSet(i)} style={{ border: `1.5px solid ${C.red}`, background: C.white, color: C.red, borderRadius: 8, padding: '0.4rem 0.6rem', fontFamily: mono, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', marginTop: i === 0 ? 20 : 0 }}>✕</button>
              </div>
            ))}
          </div>

          {/* Zachowaj dla całego planu */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.875rem', background: wholePlan ? C.navyLight : C.offWhite, border: `1.5px solid ${wholePlan ? C.gold : C.grayLight}`, borderRadius: 10, cursor: 'pointer', marginBottom: '1.25rem' }}>
            <input type="checkbox" checked={wholePlan} onChange={e => setWholePlan(e.target.checked)} style={{ accentColor: C.gold, width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: wholePlan ? C.gold : C.navy }}>Zachowaj dla całego planu</div>
              <div style={{ fontSize: '0.75rem', color: C.gray, marginTop: 2 }}>
                Zastosuje tę modyfikację do wszystkich wystąpień tego samego ćwiczenia w planie (np. we wszystkich tygodniach).
              </div>
            </div>
          </label>

          {error && <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.82rem', marginBottom: '1rem' }}>❌ {error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            {existingOverride && (
              <button onClick={handleDeleteOverride} disabled={saving}
                style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.red}`, borderRadius: 12, background: C.white, color: C.red, fontWeight: 700 }}>
                Usuń mod.
              </button>
            )}
            <button onClick={handleSave} disabled={saving || (mode === 'library' && !libId) || (mode === 'custom' && !customName.trim())}
              style={{ flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12, background: C.navy, color: C.gold, fontWeight: 900, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Zapisuję...' : wholePlan ? 'Zapisz dla całego planu ✓' : 'Zapisz zmiany ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL USUWANIA BLOKU ──────────────────────────────────────────────────────
function DeleteBlockModal({ block, allBlocks, athleteId, onDelete, onClose }: {
  block: any; allBlocks: any[]; athleteId: number
  onDelete: (blockId: number, scope: 'single' | 'all_same') => void
  onClose: () => void
}) {
  const sameName = allBlocks.filter(b => b.block_name === block.block_name && b.id !== block.id)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(13,27,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 440, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.red, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Usuń blok</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{block.block_name}</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.86rem', color: C.gray, marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Ćwiczenia w bloku zostaną oznaczone jako pominięte dla tej zawodniczki. Szablon planu pozostaje bez zmian.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => { onDelete(block.id, 'single'); onClose() }}
              style={{ padding: '0.875rem', border: `1.5px solid ${C.orange}`, borderRadius: 12, background: C.white, color: C.orange, fontWeight: 800, textAlign: 'left' }}>
              <div>Tylko ten trening</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 400, color: C.gray, marginTop: 2 }}>Pomija blok tylko w tym dniu</div>
            </button>
            {sameName.length > 0 && (
              <button onClick={() => { onDelete(block.id, 'all_same'); onClose() }}
                style={{ padding: '0.875rem', border: `1.5px solid ${C.red}`, borderRadius: 12, background: C.white, color: C.red, fontWeight: 800, textAlign: 'left' }}>
                <div>Cały plan tej zawodniczki ({sameName.length + 1} bloków)</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 400, color: C.gray, marginTop: 2 }}>Pomija wszystkie bloki &ldquo;{block.block_name}&rdquo; w planie</div>
              </button>
            )}
            <button onClick={onClose}
              style={{ padding: '0.875rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.offWhite, color: C.gray, fontWeight: 700 }}>
              Anuluj
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL DODANIA NOWEGO BLOKU ────────────────────────────────────────────────
function AddBlockModal({ dayId, dayName, existingCount, onAdd, onClose }: {
  dayId: number; dayName: string; existingCount: number
  onAdd: (block: any) => void; onClose: () => void
}) {
  const supabase = createClient()
  const [blockName, setBlockName] = useState(`Blok ${String.fromCharCode(65 + existingCount)}`)
  const [rounds, setRounds] = useState('3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('workout_day_blocks').insert({
      day_id: dayId,
      block_name: blockName.trim() || `Blok ${String.fromCharCode(65 + existingCount)}`,
      block_order: existingCount + 1,
      rounds: parseInt(rounds) || 3,
    }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) onAdd({ ...data, workout_block_exercises: [] })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(13,27,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 440, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Dodaj blok</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{dayName}</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '0.75rem', marginBottom: '1.1rem', fontSize: '0.82rem', color: '#92400E' }}>
            ⚠️ Blok zostanie dodany do szablonu planu — będzie widoczny dla wszystkich zawodniczek z tym planem.
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelSt}>Nazwa bloku</label>
            <input type="text" value={blockName} onChange={e => setBlockName(e.target.value)}
              style={{ ...inputSt, textAlign: 'left', fontFamily: sans }} />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelSt}>Liczba rund</label>
            <input type="number" value={rounds} onChange={e => setRounds(e.target.value)} min={1} max={10} style={inputSt} />
          </div>
          {error && <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.82rem', marginBottom: '1rem' }}>❌ {error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            <button onClick={handleAdd} disabled={saving}
              style={{ flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12, background: C.navy, color: C.gold, fontWeight: 900, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Dodaję...' : 'Dodaj blok ＋'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL DODAWANIA ĆWICZENIA ─────────────────────────────────────────────────
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
      athlete_id: athleteId, block_id: blockId,
      exercise_id: mode === 'library' && exerciseId ? parseInt(exerciseId) : null,
      exercise_code: mode === 'custom' ? exerciseCode.trim() : null,
      exercise_order: existingCount + 100,
      sets: parseInt(sets) || 3, reps: reps || null,
      weight_kg: weight ? parseFloat(weight) : null, tempo: tempo || null,
      rir: rir ? parseInt(rir) : null, coach_note: note || null,
    }
    const { data, error: err } = await supabase.from('athlete_extra_exercises').insert(payload).select('*, exercise:exercises(*)').single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) onSave(data)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(13,27,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 500, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Dodaj ćwiczenie</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>Tylko dla tej zawodniczki</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[{ k: 'library', l: 'Z biblioteki' }, { k: 'custom', l: 'Własna nazwa' }].map(o => (
              <button key={o.k} onClick={() => setMode(o.k as any)}
                style={{ flex: 1, padding: '0.55rem', border: `1.5px solid ${mode === o.k ? C.gold : C.grayLight}`, borderRadius: 8, background: mode === o.k ? C.navy : C.offWhite, color: mode === o.k ? C.gold : C.gray, fontWeight: mode === o.k ? 800 : 500, fontSize: '0.78rem' }}>
                {o.l}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            {mode === 'library'
              ? <select value={exerciseId} onChange={e => setExerciseId(e.target.value)} style={{ ...inputSt, textAlign: 'left', fontFamily: sans, appearance: 'none' }}>
                  <option value="">Wybierz ćwiczenie...</option>
                  {exerciseLibrary.map((e: any) => <option key={e.id} value={e.id}>{fmt(e.name)}{e.category ? ` (${e.category})` : ''}</option>)}
                </select>
              : <input type="text" value={exerciseCode} onChange={e => setExerciseCode(e.target.value)} placeholder="np. hip thrust, face pull..." style={{ ...inputSt, textAlign: 'left', fontFamily: sans }} />
            }
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
            <div><label style={labelSt}>Serie</label><input type="number" value={sets} onChange={e => setSets(e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>Powt.</label><input type="text" value={reps} onChange={e => setReps(e.target.value)} placeholder="8–10" style={inputSt} /></div>
            <div><label style={labelSt}>Kg</label><input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" style={inputSt} /></div>
            <div><label style={labelSt}>RIR</label><input type="number" value={rir} onChange={e => setRir(e.target.value)} placeholder="—" style={inputSt} /></div>
          </div>
          <div style={{ marginBottom: '1rem' }}><label style={labelSt}>Tempo</label><input type="text" value={tempo} onChange={e => setTempo(e.target.value)} placeholder="np. 3-1-2-0" style={{ ...inputSt, textAlign: 'left', fontFamily: sans }} /></div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelSt}>Notatka</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Wskazówki techniczne..." rows={2} style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem', outline: 'none', resize: 'none' }} />
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
  const supabase = createClient()
  const [selectedDay, setSelectedDay] = useState<number>(days[0]?.id || 0)
  const [localBlocks, setLocalBlocks] = useState<any[]>(blocks)
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
  const [deletingBlock, setDeletingBlock] = useState<any | null>(null)
  const [addingBlock, setAddingBlock] = useState(false)
  const [addingToBlock, setAddingToBlock] = useState<number | null>(null)

  const currentDayBlocks = localBlocks.filter((b: any) => b.day_id === selectedDay).sort((a: any, z: any) => a.block_order - z.block_order)
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

  function handleSaveAll(_srcId: number | null, _srcCode: string | null, siblings: { exerciseId: number; override: any }[]) {
    setOverrideMap(prev => {
      const next = { ...prev }
      for (const s of siblings) next[s.exerciseId] = s.override
      return next
    })
  }

  async function handleDeleteBlock(blockId: number, scope: 'single' | 'all_same') {
    const block = localBlocks.find(b => b.id === blockId)
    if (!block) return

    let toSkip: any[] = block.workout_block_exercises || []
    if (scope === 'all_same') {
      toSkip = localBlocks
        .filter(b => b.block_name === block.block_name)
        .flatMap(b => b.workout_block_exercises || [])
    }

    const newOverrides: Record<number, any> = {}
    for (const ex of toSkip) {
      const existing = overrideMap[ex.id]
      const payload = {
        athlete_id: athlete.id, block_exercise_id: ex.id, skip: true,
        is_substitution: false, sets_override: null, reps_override: null,
        weight_override: null, tempo_override: null, coach_note_override: null,
        exercise_id_override: null, exercise_code_override: null,
      }
      if (existing) {
        await supabase.from('athlete_exercise_overrides').update({ skip: true }).eq('id', existing.id)
        newOverrides[ex.id] = { ...existing, skip: true }
      } else {
        const { data } = await supabase.from('athlete_exercise_overrides').insert(payload).select().single()
        if (data) newOverrides[ex.id] = data
      }
    }
    setOverrideMap(prev => ({ ...prev, ...newOverrides }))
  }

  function handleExtraAdd(blockId: number, ex: any) {
    setExtraMap(prev => ({ ...prev, [blockId]: [...(prev[blockId] || []), ex] }))
  }

  async function handleExtraDelete(blockId: number, exId: string) {
    await supabase.from('athlete_extra_exercises').delete().eq('id', exId)
    setExtraMap(prev => ({ ...prev, [blockId]: (prev[blockId] || []).filter(e => e.id !== exId) }))
  }

  const weekGroups: Record<number, any[]> = {}
  for (const day of days) {
    const wn = day.week?.week_number || 1
    if (!weekGroups[wn]) weekGroups[wn] = []
    weekGroups[wn].push(day)
  }

  function getDisplayName(ex: any, override: any | null) {
    if (override?.exercise_code_override) return override.exercise_code_override
    if (override?.exercise_id_override) {
      const lib = exerciseLibrary.find((l: any) => l.id === override.exercise_id_override)
      return lib ? fmt(lib.name) : `Ćwiczenie #${override.exercise_id_override}`
    }
    return ex.exercise?.name ? fmt(ex.exercise.name) : (ex.exercise_code || 'Ćwiczenie')
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} body{background:${C.offWhite};} button{cursor:pointer;font-family:inherit;}`}</style>

      {editingExercise && (
        <ExerciseEditModal
          ex={editingExercise} athleteId={athlete.id} athleteName={athlete.full_name.split(' ')[0]}
          existingOverride={overrideMap[editingExercise.id] || null}
          exerciseLibrary={exerciseLibrary} allBlocks={localBlocks}
          onSave={o => handleOverrideSave(editingExercise.id, o)}
          onSaveAll={handleSaveAll}
          onClose={() => setEditingExercise(null)}
        />
      )}
      {deletingBlock && (
        <DeleteBlockModal block={deletingBlock} allBlocks={localBlocks} athleteId={athlete.id}
          onDelete={handleDeleteBlock} onClose={() => setDeletingBlock(null)} />
      )}
      {addingBlock && (
        <AddBlockModal dayId={selectedDay} dayName={currentDay?.day_name || ''}
          existingCount={currentDayBlocks.length}
          onAdd={b => setLocalBlocks(prev => [...prev, b])}
          onClose={() => setAddingBlock(false)} />
      )}
      {addingToBlock != null && (
        <AddExerciseModal blockId={addingToBlock} athleteId={athlete.id}
          exerciseLibrary={exerciseLibrary}
          existingCount={(localBlocks.find(b => b.id === addingToBlock)?.workout_block_exercises || []).length + (extraMap[addingToBlock] || []).length}
          onSave={ex => handleExtraAdd(addingToBlock, ex)}
          onClose={() => setAddingToBlock(null)} />
      )}

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        {/* Header */}
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.5rem' }}>
              <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>← {athlete.full_name.split(' ')[0]}</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Modyfikacje planu</div>
                <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{assignment?.plan?.name || 'Brak planu'}</div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {overrideCount > 0 && <span style={{ background: C.gold, color: C.navy, borderRadius: 20, padding: '3px 10px', fontFamily: mono, fontSize: '0.65rem', fontWeight: 900 }}>{overrideCount} mod.</span>}
                {skipCount > 0 && <span style={{ background: C.red, color: C.white, borderRadius: 20, padding: '3px 10px', fontFamily: mono, fontSize: '0.65rem', fontWeight: 900 }}>{skipCount} pom.</span>}
                {extraCount > 0 && <span style={{ background: C.green, color: C.white, borderRadius: 20, padding: '3px 10px', fontFamily: mono, fontSize: '0.65rem', fontWeight: 900 }}>+{extraCount} nowe</span>}
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
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', marginBottom: 5 }}>Tydzień {weekNum}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {weekDays.map((day: any) => {
                            const dayBlockIds = localBlocks.filter(b => b.day_id === day.id).map(b => b.id)
                            const dayExIds = localBlocks.filter(b => b.day_id === day.id).flatMap(b => (b.workout_block_exercises || []).map((e: any) => e.id))
                            const mods = dayExIds.filter((id: number) => overrideMap[id] && !overrideMap[id].skip).length
                            const skips = dayExIds.filter((id: number) => overrideMap[id]?.skip).length
                            const extra = dayBlockIds.reduce((s: number, bid: number) => s + (extraMap[bid] || []).length, 0)
                            const isSel = selectedDay === day.id
                            return (
                              <button key={day.id} onClick={() => setSelectedDay(day.id)}
                                style={{ padding: '0.5rem 0.875rem', border: `1.5px solid ${isSel ? C.gold : C.grayLight}`, borderRadius: 8, background: isSel ? C.navy : C.white, color: isSel ? C.gold : C.navy, fontWeight: isSel ? 800 : 500, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                                {day.day_name}
                                {mods > 0 && <span style={{ background: C.gold, color: C.navy, borderRadius: 8, padding: '1px 5px', fontSize: '0.55rem', fontWeight: 900 }}>✎{mods}</span>}
                                {skips > 0 && <span style={{ background: C.red, color: C.white, borderRadius: 8, padding: '1px 5px', fontSize: '0.55rem', fontWeight: 900 }}>✕{skips}</span>}
                                {extra > 0 && <span style={{ background: C.green, color: C.white, borderRadius: 8, padding: '1px 5px', fontSize: '0.55rem', fontWeight: 900 }}>+{extra}</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Info o dniu */}
              {currentDay && (
                <div style={{ marginBottom: '1rem', padding: '0.875rem 1.25rem', background: C.navyLight, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, marginBottom: 2 }}>{assignment?.plan?.name}</div>
                    <div style={{ color: C.white, fontWeight: 800 }}>Tydzień {currentDay.week?.week_number} · {currentDay.day_name}</div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gold, textAlign: 'right' }}>Kliknij ćwiczenie<br/>aby modyfikować</div>
                </div>
              )}

              {/* Bloki */}
              {currentDayBlocks.map((block: any) => {
                const templateEx = (block.workout_block_exercises || []).sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                const extras = extraMap[block.id] || []
                return (
                  <Card key={block.id} style={{ marginBottom: '1rem' }}>
                    {/* Nagłówek bloku */}
                    <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: C.navy, flex: 1 }}>{block.block_name}</span>
                      {block.rounds > 1 && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, background: C.offWhite, padding: '2px 8px', borderRadius: 6 }}>{block.rounds} rundy</span>}
                      <button onClick={() => setAddingToBlock(block.id)}
                        style={{ padding: '0.4rem 0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.75rem' }}>
                        + Ćwiczenie
                      </button>
                      <button onClick={() => setDeletingBlock(block)}
                        style={{ padding: '0.4rem 0.75rem', border: `1.5px solid ${C.red}`, borderRadius: 8, background: C.white, color: C.red, fontWeight: 700, fontSize: '0.75rem' }}>
                        Usuń blok
                      </button>
                    </div>

                    {/* Ćwiczenia szablonu */}
                    {templateEx.map((ex: any, idx: number) => {
                      const override = overrideMap[ex.id]
                      const isSkipped = override?.skip
                      const isModified = override && !isSkipped
                      const isSwapped = isModified && override.is_substitution
                      const displayName = getDisplayName(ex, override)
                      return (
                        <button key={ex.id} onClick={() => setEditingExercise(ex)}
                          style={{ width: '100%', border: 'none', textAlign: 'left', fontFamily: sans, background: isSkipped ? '#FEF2F2' : isModified ? C.navyLight : C.white, borderBottom: `1.5px solid ${C.grayLight}`, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: 12, opacity: isSkipped ? 0.75 : 1 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: isSkipped ? C.red : isModified ? C.gold : C.offWhite, color: isSkipped ? C.white : isModified ? C.navy : C.gray, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 900, fontSize: '0.7rem', flexShrink: 0, marginTop: 2 }}>
                            {isSkipped ? '✕' : idx + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              {ex.is_warmup && <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.gold, background: C.navy, padding: '1px 5px', borderRadius: 4 }}>WU</span>}
                              {isSwapped && <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.white, background: C.orange, padding: '1px 5px', borderRadius: 4 }}>ZAMIANA</span>}
                              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isSkipped ? C.red : isModified ? C.white : C.navy, textDecoration: isSkipped ? 'line-through' : 'none' }}>{displayName}</span>
                            </div>
                            <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>
                              {isSkipped ? <span style={{ color: C.red }}>Pominięte</span>
                                : isModified ? (
                                  <>
                                    <span style={{ color: C.gold, fontWeight: 800 }}>
                                      {override.sets_override || ex.sets}×{override.reps_override || ex.reps || '—'}
                                      {override.weight_override ? ` · ${override.weight_override}kg` : ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}
                                      {override.tempo_override || ex.tempo ? ` · ${override.tempo_override || ex.tempo}` : ''}
                                    </span>
                                    <span style={{ color: '#555', marginLeft: 8 }}>
                                      {isSwapped ? `(oryg: ${ex.exercise?.name ? fmt(ex.exercise.name) : ex.exercise_code})` : `(oryg: ${ex.sets}×${ex.reps || '—'})`}
                                    </span>
                                  </>
                                ) : (
                                  <>{ex.sets}×{ex.reps || '—'}{ex.tempo ? ` · ${ex.tempo}` : ''}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}{ex.rir != null ? ` · RIR ${ex.rir}` : ''}</>
                                )
                              }
                            </div>
                            {(override?.coach_note_override || ex.coach_comment) && !isSkipped && (
                              <div style={{ fontSize: '0.75rem', color: isModified ? C.gold : C.gray, fontStyle: 'italic', marginTop: 3 }}>✎ {override?.coach_note_override || ex.coach_comment}</div>
                            )}
                          </div>
                          <div style={{ flexShrink: 0, paddingTop: 2 }}>
                            {isSkipped ? <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.red, border: `1.5px solid ${C.red}`, borderRadius: 6, padding: '2px 7px' }}>Pominięte</span>
                              : isModified ? <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gold, border: `1.5px solid ${C.gold}`, borderRadius: 6, padding: '2px 7px' }}>{isSwapped ? 'Zamienione' : 'Zmodyfikowane'}</span>
                              : <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, border: `1.5px solid ${C.grayLight}`, borderRadius: 6, padding: '2px 7px' }}>✎ edytuj</span>}
                          </div>
                        </button>
                      )
                    })}

                    {/* Ćwiczenia dodane dla tej zawodniczki */}
                    {extras.map((ex: any) => {
                      const name = ex.exercise?.name ? fmt(ex.exercise.name) : (ex.exercise_code || '—')
                      return (
                        <div key={ex.id} style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'flex-start', gap: 12, background: '#F0FDF4' }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: C.green, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 900, fontSize: '0.7rem', flexShrink: 0, marginTop: 2 }}>＋</div>
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
                            style={{ background: 'none', border: `1.5px solid ${C.red}`, borderRadius: 6, color: C.red, padding: '2px 8px', fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                            Usuń
                          </button>
                        </div>
                      )
                    })}
                    {/* Przycisk dodaj ćwiczenie na dole bloku */}
                    <button onClick={() => setAddingToBlock(block.id)}
                      style={{ width: '100%', padding: '0.75rem 1.25rem', border: 'none', background: C.offWhite, color: C.gray, fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      ＋ Dodaj ćwiczenie do bloku
                    </button>
                  </Card>
                )
              })}

              {/* Dodaj blok */}
              <button onClick={() => setAddingBlock(true)}
                style={{ width: '100%', padding: '0.875rem', border: `1.5px dashed ${C.grayLight}`, borderRadius: 14, background: C.white, color: C.gray, fontFamily: mono, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                ＋ Dodaj nowy blok do tego treningu
              </button>
            </>
          )}
        </main>
      </div>
    </>
  )
}
