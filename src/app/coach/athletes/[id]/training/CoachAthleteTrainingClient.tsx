'use client'
// src/app/coach/athletes/[id]/training/CoachAthleteTrainingClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Button, Field, FieldGrid, Modal } from '@/components/coach/ui'

// Styl pól spoza <Field> (np. <select> obok przełącznika trybu) — dopasowany
// 1:1 do .coach-field input/select z coach-theme.css.
const fieldInputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-inter),sans-serif', fontSize: 13.5, color: 'var(--ink)',
  border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', outline: 'none',
  background: 'var(--bg)', boxSizing: 'border-box',
}

function fmt(n: string) { return n.replace(/-/g, ' ') }

// ─── MODAL EDYCJI ĆWICZENIA ───────────────────────────────────────────────────
function ExerciseEditModal({ ex, athleteId, athleteName, existingOverride, exerciseLibrary, allBlocks, days, currentDayId, onSave, onSaveAll, onClose }: {
  ex: any; athleteId: number; athleteName: string
  existingOverride: any | null; exerciseLibrary: any[]; allBlocks: any[]
  days: any[]; currentDayId: number
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

      // Jeśli "zachowaj dla kolejnych treningów" — znajdź to samo ćwiczenie
      // w tym i we wszystkich PÓŹNIEJSZYCH dniach planu (wcześniejsze bez zmian)
      if (wholePlan) {
        const srcId = ex.exercise_id
        const srcCode = ex.exercise_code

        // Kolejność dni w planie: tydzień, potem kolejność dnia
        const sortedDays = [...days].sort((a: any, b: any) =>
          (a.week?.week_number || 1) - (b.week?.week_number || 1)
          || (a.day_order || 0) - (b.day_order || 0)
          || a.id - b.id
        )
        const dayRank: Record<number, number> = {}
        sortedDays.forEach((d: any, i: number) => { dayRank[d.id] = i })
        const currentRank = dayRank[currentDayId] ?? 0

        const siblings: { exerciseId: number; override: any }[] = []
        for (const block of allBlocks) {
          // Pomiń bloki z treningów wcześniejszych niż aktualnie edytowany
          if ((dayRank[block.day_id] ?? 0) < currentRank) continue
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
    <Modal
      open
      onClose={onClose}
      eyebrow="Modyfikacja ćwiczenia"
      title={originalName}
      sub={`tylko dla ${athleteName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          {existingOverride && (
            <Button variant="ghost" onClick={handleDeleteOverride} disabled={saving} style={{ color: '#c23b3b', borderColor: '#f0b3b3' }}>Usuń mod.</Button>
          )}
          <Button variant="dark" onClick={handleSave} disabled={saving || (mode === 'library' && !libId) || (mode === 'custom' && !customName.trim())}>
            {saving ? 'Zapisuję...' : wholePlan ? 'Zapisz dla kolejnych treningów ✓' : 'Zapisz zmiany ✓'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Szablon */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--ink)', fontFamily: 'var(--font-inter),sans-serif' }}>
          <span style={{ fontWeight: 700 }}>Szablon: </span>
          {ex.sets}×{ex.reps || '—'}{ex.tempo ? ` · ${ex.tempo}` : ''}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}{ex.rir != null ? ` · RIR ${ex.rir}` : ''}
          {ex.coach_comment && <span style={{ display: 'block', marginTop: 4, fontStyle: 'italic', color: 'var(--muted)' }}>{ex.coach_comment}</span>}
        </div>

        {/* Nazwa ćwiczenia */}
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-inter),sans-serif' }}>Ćwiczenie</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[{ k: 'same', l: 'Bez zmiany nazwy' }, { k: 'library', l: 'Z biblioteki' }, { k: 'custom', l: 'Wpisz nazwę' }].map(o => (
              <button key={o.k} onClick={() => setMode(o.k as any)}
                style={{ flex: 1, padding: '8px 6px', border: `1px solid ${mode === o.k ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 8, background: mode === o.k ? 'var(--navy-900)' : 'var(--bg)', color: mode === o.k ? 'var(--gold)' : 'var(--muted)', fontWeight: mode === o.k ? 700 : 500, fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif' }}>
                {o.l}
              </button>
            ))}
          </div>
          {mode === 'same' && (
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 10, fontSize: 13, color: 'var(--ink)', fontWeight: 700 }}>{originalName}</div>
          )}
          {mode === 'library' && (
            <select value={libId} onChange={e => setLibId(e.target.value)} style={fieldInputStyle}>
              <option value="">Wybierz ćwiczenie...</option>
              {exerciseLibrary.map((e: any) => <option key={e.id} value={e.id}>{fmt(e.name)}{e.category ? ` (${e.category})` : ''}</option>)}
            </select>
          )}
          {mode === 'custom' && (
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder="Wpisz dowolną nazwę ćwiczenia..." style={fieldInputStyle} />
          )}
        </div>

        {/* Parametry */}
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-inter),sans-serif' }}>Parametry</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
            <Field label="Serie"><input type="number" value={sets} onChange={e => setSets(e.target.value)} /></Field>
            <Field label="Powt."><input type="text" value={reps} onChange={e => setReps(e.target.value)} placeholder="8–10" /></Field>
            <Field label="Kg"><input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" /></Field>
            <Field label="RIR"><input type="number" value={rir} onChange={e => setRir(e.target.value)} placeholder="—" /></Field>
          </div>
          <Field label="Tempo"><input type="text" value={tempo} onChange={e => setTempo(e.target.value)} placeholder="np. 3-1-2-0" /></Field>
        </div>

        {/* Notatka */}
        <Field label="Notatka dla zawodniczki" full>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Wskazówki, powód zmiany..." rows={2} />
        </Field>

        {/* Link do filmiku */}
        <Field label="Link do filmiku (YouTube / Vimeo)" full>
          <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
        </Field>

        {/* Serie rozgrzewkowe */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 10.5, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>Serie rozgrzewkowe</div>
            <Button size="small" variant="dark" onClick={addWarmupSet}>+ Dodaj</Button>
          </div>
          {warmupSets.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', fontFamily: 'var(--font-inter),sans-serif' }}>Brak serii rozgrzewkowych</div>
          )}
          {warmupSets.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <div>
                {i === 0 && <div style={{ fontSize: 9.5, color: 'var(--muted-light)', textTransform: 'uppercase', marginBottom: 3, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Powt.</div>}
                <input type="text" value={s.reps} onChange={e => updateWarmupSet(i, 'reps', e.target.value)}
                  placeholder="np. 8" style={{ ...fieldInputStyle, padding: '7px 9px', fontSize: 12.5 }} />
              </div>
              <div>
                {i === 0 && <div style={{ fontSize: 9.5, color: 'var(--muted-light)', textTransform: 'uppercase', marginBottom: 3, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Ciężar</div>}
                <input type="text" value={s.weight_kg} onChange={e => updateWarmupSet(i, 'weight_kg', e.target.value)}
                  placeholder="kg / BW" style={{ ...fieldInputStyle, padding: '7px 9px', fontSize: 12.5 }} />
              </div>
              <div>
                {i === 0 && <div style={{ fontSize: 9.5, color: 'var(--muted-light)', textTransform: 'uppercase', marginBottom: 3, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Notatka</div>}
                <input type="text" value={s.note} onChange={e => updateWarmupSet(i, 'note', e.target.value)}
                  placeholder="wskazówka..." style={{ ...fieldInputStyle, padding: '7px 9px', fontSize: 12.5 }} />
              </div>
              <button onClick={() => removeWarmupSet(i)}
                style={{ border: '1px solid #c23b3b', background: '#fff', color: '#c23b3b', borderRadius: 8, padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: i === 0 ? 18 : 0, fontFamily: 'var(--font-inter),sans-serif' }}>✕</button>
            </div>
          ))}
        </div>

        {/* Zachowaj dla całego planu */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: wholePlan ? 'var(--navy-800)' : 'var(--bg)', border: `1px solid ${wholePlan ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={wholePlan} onChange={e => setWholePlan(e.target.checked)} style={{ accentColor: 'var(--gold)', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: wholePlan ? 'var(--gold)' : 'var(--ink)' }}>Zachowaj dla kolejnych treningów</div>
            <div style={{ fontSize: 12, color: wholePlan ? '#cdd4e3' : 'var(--muted)', marginTop: 2, fontFamily: 'var(--font-inter),sans-serif' }}>
              Zastosuje tę modyfikację do tego i wszystkich późniejszych wystąpień tego ćwiczenia w planie. Wcześniejsze treningi zostają bez zmian.
            </div>
          </div>
        </label>

        {error && <div style={{ padding: 10, background: '#fdecec', border: '1px solid #f0a3a3', borderRadius: 10, color: '#c23b3b', fontWeight: 700, fontSize: 12.5 }}>❌ {error}</div>}
      </div>
    </Modal>
  )
}

// ─── MODAL USUWANIA BLOKU ──────────────────────────────────────────────────────
function DeleteBlockModal({ block, allBlocks, onDelete, onClose }: {
  block: any; allBlocks: any[]; athleteId: number
  onDelete: (blockId: number, scope: 'single' | 'all_same') => void
  onClose: () => void
}) {
  const sameName = allBlocks.filter(b => b.block_name === block.block_name && b.id !== block.id)
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Usuń blok"
      title={block.block_name}
      footer={<Button variant="ghost" onClick={onClose}>Anuluj</Button>}
    >
      <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.6, fontFamily: 'var(--font-inter),sans-serif' }}>
        Ćwiczenia w bloku zostaną oznaczone jako pominięte dla tej zawodniczki. Szablon planu pozostaje bez zmian.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => { onDelete(block.id, 'single'); onClose() }}
          style={{ padding: 14, border: '1px solid #c07f1e', borderRadius: 10, background: '#fff', color: '#c07f1e', fontWeight: 700, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif' }}>
          <div>Tylko ten trening</div>
          <div style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--muted)', marginTop: 2 }}>Pomija blok tylko w tym dniu</div>
        </button>
        {sameName.length > 0 && (
          <button onClick={() => { onDelete(block.id, 'all_same'); onClose() }}
            style={{ padding: 14, border: '1px solid #c23b3b', borderRadius: 10, background: '#fff', color: '#c23b3b', fontWeight: 700, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif' }}>
            <div>Cały plan tej zawodniczki ({sameName.length + 1} bloków)</div>
            <div style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--muted)', marginTop: 2 }}>Pomija wszystkie bloki &ldquo;{block.block_name}&rdquo; w planie</div>
          </button>
        )}
      </div>
    </Modal>
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
    <Modal
      open
      onClose={onClose}
      eyebrow="Dodaj blok"
      title={dayName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleAdd} disabled={saving}>{saving ? 'Dodaję...' : 'Dodaj blok ＋'}</Button>
        </>
      }
    >
      <div style={{ background: '#fdf1de', border: '1px solid var(--gold-light)', borderRadius: 10, padding: 12, marginBottom: 18, fontSize: 13, color: '#92600a', fontFamily: 'var(--font-inter),sans-serif' }}>
        ⚠️ Blok zostanie dodany do szablonu planu — będzie widoczny dla wszystkich zawodniczek z tym planem.
      </div>
      <FieldGrid>
        <Field label="Nazwa bloku" full><input type="text" value={blockName} onChange={e => setBlockName(e.target.value)} /></Field>
        <Field label="Liczba rund"><input type="number" value={rounds} onChange={e => setRounds(e.target.value)} min={1} max={10} /></Field>
      </FieldGrid>
      {error && <div style={{ marginTop: 14, padding: 10, background: '#fdecec', border: '1px solid #f0a3a3', borderRadius: 10, color: '#c23b3b', fontWeight: 700, fontSize: 12.5 }}>❌ {error}</div>}
    </Modal>
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
    <Modal
      open
      onClose={onClose}
      eyebrow="Dodaj ćwiczenie"
      title="Tylko dla tej zawodniczki"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleSave} disabled={!canSave || saving}>{saving ? 'Dodaję...' : 'Dodaj ćwiczenie ＋'}</Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{ k: 'library', l: 'Z biblioteki' }, { k: 'custom', l: 'Własna nazwa' }].map(o => (
          <button key={o.k} onClick={() => setMode(o.k as any)}
            style={{ flex: 1, padding: 9, border: `1px solid ${mode === o.k ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 8, background: mode === o.k ? 'var(--navy-900)' : 'var(--bg)', color: mode === o.k ? 'var(--gold)' : 'var(--muted)', fontWeight: mode === o.k ? 700 : 500, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif' }}>
            {o.l}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        {mode === 'library'
          ? <select value={exerciseId} onChange={e => setExerciseId(e.target.value)} style={fieldInputStyle}>
              <option value="">Wybierz ćwiczenie...</option>
              {exerciseLibrary.map((e: any) => <option key={e.id} value={e.id}>{fmt(e.name)}{e.category ? ` (${e.category})` : ''}</option>)}
            </select>
          : <input type="text" value={exerciseCode} onChange={e => setExerciseCode(e.target.value)} placeholder="np. hip thrust, face pull..." style={fieldInputStyle} />
        }
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        <Field label="Serie"><input type="number" value={sets} onChange={e => setSets(e.target.value)} /></Field>
        <Field label="Powt."><input type="text" value={reps} onChange={e => setReps(e.target.value)} placeholder="8–10" /></Field>
        <Field label="Kg"><input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" /></Field>
        <Field label="RIR"><input type="number" value={rir} onChange={e => setRir(e.target.value)} placeholder="—" /></Field>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Field label="Tempo"><input type="text" value={tempo} onChange={e => setTempo(e.target.value)} placeholder="np. 3-1-2-0" /></Field>
      </div>
      <Field label="Notatka" full>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Wskazówki techniczne..." rows={2} />
      </Field>
      {error && <div style={{ marginTop: 14, padding: 10, background: '#fdecec', border: '1px solid #f0a3a3', borderRadius: 10, color: '#c23b3b', fontWeight: 700, fontSize: 12.5 }}>❌ {error}</div>}
    </Modal>
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
      <SetPageMeta title="Modyfikacje planu" backHref={`/coach/athletes/${athlete.id}`} backLabel={athlete.full_name.split(' ')[0]} />

      {editingExercise && (
        <ExerciseEditModal
          ex={editingExercise} athleteId={athlete.id} athleteName={athlete.full_name.split(' ')[0]}
          existingOverride={overrideMap[editingExercise.id] || null}
          exerciseLibrary={exerciseLibrary} allBlocks={localBlocks}
          days={days} currentDayId={selectedDay}
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

      <div className="coach-content">
        {!assignment ? (
          <div className="coach-empty-training">
            <h3>Brak przypisanego planu</h3>
            <p>Ta zawodniczka nie ma jeszcze przypisanego planu treningowego.</p>
            <Button variant="dark" onClick={() => router.push(`/coach/athletes/${athlete.id}`)}>← Wróć do profilu</Button>
          </div>
        ) : (
          <>
            <div className="coach-editor-hero">
              <div className="coach-editor-hero-left">
                <div className="coach-eyebrow">{athlete.full_name}</div>
                <h2>{assignment?.plan?.name || 'Brak planu'}</h2>
              </div>
              <div className="coach-editor-hero-right">
                {overrideCount > 0 && <span style={{ background: 'var(--gold)', color: 'var(--navy-900)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>{overrideCount} mod.</span>}
                {skipCount > 0 && <span style={{ background: '#c23b3b', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>{skipCount} pom.</span>}
                {extraCount > 0 && <span style={{ background: 'var(--green)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>+{extraCount} nowe</span>}
              </div>
            </div>

            <div className="coach-editor-layout">
              {/* Sidebar — wybór dnia */}
              <div className="coach-editor-sidebar">
                <div className="coach-editor-sidebar-head"><span className="coach-label">Wybierz dzień</span></div>
                {Object.entries(weekGroups).map(([weekNum, weekDays]) => (
                  <div className="coach-week-block" key={weekNum}>
                    <div className="coach-week-label">Tydzień {weekNum}</div>
                    {weekDays.map((day: any) => {
                      const dayBlockIds = localBlocks.filter(b => b.day_id === day.id).map(b => b.id)
                      const dayExIds = localBlocks.filter(b => b.day_id === day.id).flatMap(b => (b.workout_block_exercises || []).map((e: any) => e.id))
                      const mods = dayExIds.filter((id: number) => overrideMap[id] && !overrideMap[id].skip).length
                      const skips = dayExIds.filter((id: number) => overrideMap[id]?.skip).length
                      const extra = dayBlockIds.reduce((s: number, bid: number) => s + (extraMap[bid] || []).length, 0)
                      const isSel = selectedDay === day.id
                      return (
                        <button key={day.id} className={`coach-training-pill ${isSel ? 'coach-active' : ''}`} onClick={() => setSelectedDay(day.id)}>
                          <span className="coach-training-pill-name">{day.day_name}</span>
                          <span className="coach-training-pill-count" style={{ display: 'flex', gap: 5 }}>
                            {mods > 0 && <span style={{ color: 'var(--gold)' }}>✎{mods}</span>}
                            {skips > 0 && <span style={{ color: '#e0685f' }}>✕{skips}</span>}
                            {extra > 0 && <span style={{ color: '#3ecf8e' }}>+{extra}</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Main — blok/ćwiczenia wybranego dnia */}
              <div className="coach-editor-main">
                {currentDay && (
                  <div className="coach-training-head-card">
                    <div>
                      <div className="coach-training-head-eyebrow">Tydzień {currentDay.week?.week_number}</div>
                      <div className="coach-training-head-name">{currentDay.day_name}</div>
                    </div>
                    <div className="coach-training-head-actions">
                      <span style={{ fontSize: 11.5, color: 'var(--gold)', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 600 }}>Kliknij ćwiczenie, aby modyfikować</span>
                    </div>
                  </div>
                )}

                {currentDayBlocks.map((block: any) => {
                  const templateEx = (block.workout_block_exercises || []).sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                  const extras = extraMap[block.id] || []
                  return (
                    <div className="coach-block-card" key={block.id}>
                      <div className="coach-block-card-head">
                        <span className="coach-block-card-title">{block.block_name}</span>
                        {block.rounds > 1 && <span className="coach-tag-category">{block.rounds} rundy</span>}
                        <div className="coach-block-card-actions" style={{ marginLeft: 'auto' }}>
                          <Button size="small" variant="ghost" onClick={() => setAddingToBlock(block.id)}>+ Ćwiczenie</Button>
                          <Button size="small" variant="ghost" onClick={() => setDeletingBlock(block)} style={{ color: '#c23b3b' }}>Usuń blok</Button>
                        </div>
                      </div>

                      <div className="coach-block-card-body">
                        {/* Ćwiczenia szablonu */}
                        {templateEx.map((ex: any, idx: number) => {
                          const override = overrideMap[ex.id]
                          const isSkipped = override?.skip
                          const isModified = override && !isSkipped
                          const isSwapped = isModified && override.is_substitution
                          const displayName = getDisplayName(ex, override)
                          return (
                            <div
                              key={ex.id}
                              className="coach-exercise-row"
                              onClick={() => setEditingExercise(ex)}
                              style={{
                                cursor: 'pointer',
                                background: isSkipped ? '#fdecec' : isModified ? 'var(--navy-800)' : 'var(--bg)',
                                opacity: isSkipped ? 0.85 : 1,
                              }}
                            >
                              <div className="coach-exercise-order" style={{ background: isSkipped ? '#c23b3b' : isModified ? 'var(--gold)' : 'var(--navy-900)', color: isSkipped ? '#fff' : isModified ? 'var(--navy-900)' : 'var(--gold)' }}>
                                {isSkipped ? '✕' : idx + 1}
                              </div>
                              <div className="coach-exercise-body">
                                {(ex.is_warmup || isSwapped) && (
                                  <div className="coach-exercise-chips">
                                    {ex.is_warmup && <span className="coach-ex-chip coach-warmup">WU</span>}
                                    {isSwapped && <span className="coach-ex-chip" style={{ background: '#c07f1e' }}>ZAMIANA</span>}
                                  </div>
                                )}
                                <div className="coach-exercise-name" style={{ color: isSkipped ? '#c23b3b' : isModified ? '#fff' : 'var(--ink)', textDecoration: isSkipped ? 'line-through' : 'none' }}>
                                  {displayName}
                                </div>
                                <div style={{ fontSize: 12, color: isModified ? '#cdd4e3' : 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>
                                  {isSkipped ? <span style={{ color: '#c23b3b' }}>Pominięte</span>
                                    : isModified ? (
                                      <>
                                        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                                          {override.sets_override || ex.sets}×{override.reps_override || ex.reps || '—'}
                                          {override.weight_override ? ` · ${override.weight_override}kg` : ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}
                                          {override.tempo_override || ex.tempo ? ` · ${override.tempo_override || ex.tempo}` : ''}
                                        </span>
                                        <span style={{ marginLeft: 8, opacity: 0.75 }}>
                                          {isSwapped ? `(oryg: ${ex.exercise?.name ? fmt(ex.exercise.name) : ex.exercise_code})` : `(oryg: ${ex.sets}×${ex.reps || '—'})`}
                                        </span>
                                      </>
                                    ) : (
                                      <>{ex.sets}×{ex.reps || '—'}{ex.tempo ? ` · ${ex.tempo}` : ''}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}{ex.rir != null ? ` · RIR ${ex.rir}` : ''}</>
                                    )
                                  }
                                </div>
                                {(override?.coach_note_override || ex.coach_comment) && !isSkipped && (
                                  <div className="coach-exercise-comment" style={{ color: isModified ? 'var(--gold)' : 'var(--muted)', marginTop: 3 }}>✎ {override?.coach_note_override || ex.coach_comment}</div>
                                )}
                              </div>
                              <div className="coach-exercise-actions">
                                {isSkipped ? <span style={{ fontSize: 10.5, color: '#c23b3b', border: '1px solid #c23b3b', borderRadius: 6, padding: '2px 7px', fontFamily: 'var(--font-inter),sans-serif' }}>Pominięte</span>
                                  : isModified ? <span style={{ fontSize: 10.5, color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: 6, padding: '2px 7px', fontFamily: 'var(--font-inter),sans-serif' }}>{isSwapped ? 'Zamienione' : 'Zmodyfikowane'}</span>
                                  : <span style={{ fontSize: 10.5, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontFamily: 'var(--font-inter),sans-serif' }}>✎ edytuj</span>}
                              </div>
                            </div>
                          )
                        })}

                        {/* Ćwiczenia dodane dla tej zawodniczki */}
                        {extras.map((ex: any) => {
                          const name = ex.exercise?.name ? fmt(ex.exercise.name) : (ex.exercise_code || '—')
                          return (
                            <div key={ex.id} className="coach-exercise-row" style={{ background: '#f0fdf4' }}>
                              <div className="coach-exercise-order" style={{ background: 'var(--green)', color: '#fff' }}>＋</div>
                              <div className="coach-exercise-body">
                                <div className="coach-exercise-chips">
                                  <span className="coach-ex-chip" style={{ background: 'var(--green)' }}>DODANE</span>
                                </div>
                                <div className="coach-exercise-name">{name}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>
                                  {ex.sets}×{ex.reps || '—'}{ex.tempo ? ` · ${ex.tempo}` : ''}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}{ex.rir != null ? ` · RIR ${ex.rir}` : ''}
                                </div>
                                {ex.coach_note && <div className="coach-exercise-comment" style={{ color: 'var(--green)', marginTop: 3 }}>✎ {ex.coach_note}</div>}
                              </div>
                              <div className="coach-exercise-actions">
                                <Button size="small" variant="ghost" onClick={() => handleExtraDelete(block.id, ex.id)} style={{ color: '#c23b3b' }}>Usuń</Button>
                              </div>
                            </div>
                          )
                        })}

                        {/* Przycisk dodaj ćwiczenie na dole bloku */}
                        <button className="coach-add-exercise-btn" onClick={() => setAddingToBlock(block.id)}>＋ Dodaj ćwiczenie do bloku</button>
                      </div>
                    </div>
                  )
                })}

                {/* Dodaj blok */}
                <div className="coach-add-block-link" onClick={() => setAddingBlock(true)}>＋ Dodaj nowy blok do tego treningu</div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
