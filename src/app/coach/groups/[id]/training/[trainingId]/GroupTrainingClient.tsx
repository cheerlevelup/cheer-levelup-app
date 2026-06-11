'use client'
// src/app/coach/groups/[id]/training/[trainingId]/GroupTrainingClient.tsx
// Tabela treningowa grupy zorganizowanej — wiersze: zawodniczki, kolumny: ćwiczenia
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatDatePl } from '@/lib/groupTraining'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444', orange: '#F97316',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = { id: number; name: string }
type Training = { id: number; group_id: number; training_date: string }
type Athlete = { id: number; full_name: string }
type Exercise = { id: number; training_id: number; name: string; exercise_order: number }
type SetRow = { reps?: string; tempo?: string; weight?: string }
type Entry = {
  id?: number
  training_id: number
  exercise_id: number
  athlete_id: number
  sets: SetRow[]
  pain_vas?: number | null
  pain_comment?: string | null
  comment?: string | null
}

interface Props {
  group: Group
  training: Training
  athletes: Athlete[]
  initialExercises: Exercise[]
  initialEntries: Entry[]
}

const entryKey = (exerciseId: number, athleteId: number) => `${exerciseId}_${athleteId}`

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
  const [sets, setSets] = useState<SetRow[]>(entry?.sets?.length ? entry.sets.map(s => ({ ...s })) : [{}])
  const [painVas, setPainVas] = useState<number | null>(entry?.pain_vas ?? null)
  const [painComment, setPainComment] = useState(entry?.pain_comment || '')
  const [comment, setComment] = useState(entry?.comment || '')
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

  async function handleSave() {
    setSaving(true); setError('')
    const cleanSets = sets.filter(s => (s.reps || '').trim() || (s.tempo || '').trim() || (s.weight || '').trim())
    const payload = {
      training_id: training.id,
      exercise_id: exercise.id,
      athlete_id: athlete.id,
      sets: cleanSets,
      pain_vas: painVas,
      pain_comment: painVas !== null ? (painComment.trim() || null) : null,
      comment: comment.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { data, error: err } = await supabase
      .from('group_training_entries')
      .upsert(payload, { onConflict: 'exercise_id,athlete_id' })
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError(err?.message || 'Błąd zapisu'); return }
    onSaved(data as Entry)
    onClose()
  }

  const cellInput: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.5rem', border: `1.5px solid ${C.grayLight}`,
    borderRadius: 8, background: C.offWhite, color: C.navy,
    fontFamily: mono, fontSize: '0.82rem', outline: 'none', textAlign: 'center',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: C.white, borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.grayLight}` }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {exercise.name || 'Ćwiczenie'}
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: C.white }}>{athlete.full_name}</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '1.1rem 1.25rem' }}>
          {/* ── SERIE ── */}
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
            Serie
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr 1fr 1fr 30px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textAlign: 'center' }}>#</span>
            <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textAlign: 'center' }}>POWT.</span>
            <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textAlign: 'center' }}>TEMPO</span>
            <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textAlign: 'center' }}>CIĘŻAR</span>
            <span />
          </div>
          {sets.map((s, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 1fr 1fr 30px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: mono, fontSize: '0.82rem', fontWeight: 700, color: C.navy, textAlign: 'center' }}>{idx + 1}</span>
              <input value={s.reps || ''} onChange={e => updateSet(idx, 'reps', e.target.value)} placeholder="8" style={cellInput} inputMode="text" />
              <input value={s.tempo || ''} onChange={e => updateSet(idx, 'tempo', e.target.value)} placeholder="3010" style={cellInput} inputMode="text" />
              <input value={s.weight || ''} onChange={e => updateSet(idx, 'weight', e.target.value)} placeholder="kg" style={cellInput} inputMode="text" />
              <button onClick={() => removeSet(idx)} title="Usuń serię" style={{ border: 'none', background: 'none', color: C.gray, fontSize: '0.9rem', padding: 4 }}>✕</button>
            </div>
          ))}
          <button onClick={addSet} style={{ width: '100%', padding: '0.6rem', borderRadius: 10, border: `1.5px dashed ${C.gray}`, background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            ＋ Dodaj serię
          </button>

          {/* ── BÓL ── */}
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
            Ból (skala VAS)
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            <button
              onClick={() => setPainVas(null)}
              style={{ padding: '0.45rem 0.7rem', borderRadius: 8, border: `1.5px solid ${painVas === null ? C.gold : C.grayLight}`, background: painVas === null ? C.navy : C.offWhite, color: painVas === null ? C.gold : C.navy, fontFamily: mono, fontSize: '0.72rem', fontWeight: 700 }}
            >
              brak
            </button>
            {Array.from({ length: 11 }, (_, v) => (
              <button
                key={v}
                onClick={() => setPainVas(v)}
                style={{ width: 34, padding: '0.45rem 0', borderRadius: 8, border: `1.5px solid ${painVas === v ? C.gold : C.grayLight}`, background: painVas === v ? (v >= 5 ? C.red : C.orange) : C.offWhite, color: painVas === v ? C.white : C.navy, fontFamily: mono, fontSize: '0.78rem', fontWeight: 700 }}
              >
                {v}
              </button>
            ))}
          </div>
          {painVas !== null && (
            <input
              value={painComment}
              onChange={e => setPainComment(e.target.value)}
              placeholder="Gdzie boli? Komentarz do bólu..."
              style={{ width: '100%', padding: '0.65rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.88rem', outline: 'none', marginBottom: '1rem' }}
            />
          )}

          {/* ── KOMENTARZ ── */}
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8, marginTop: painVas === null ? '0.25rem' : 0 }}>
            Komentarz do całego ćwiczenia
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Uwagi do techniki, przebiegu wszystkich serii..."
            rows={2}
            style={{ width: '100%', padding: '0.65rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
          />
          {error && <div style={{ color: C.red, fontSize: '0.82rem', marginTop: '0.75rem' }}>❌ {error}</div>}
        </div>

        <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '0.8rem 1.1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>
            Anuluj
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: 12, background: C.navy, color: C.gold, fontWeight: 900, fontSize: '0.92rem' }}>
            {saving ? 'Zapisuję...' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GroupTrainingClient({ group, training, athletes, initialExercises, initialEntries }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [exercises, setExercises] = useState<Exercise[]>(initialExercises)
  const [entryMap, setEntryMap] = useState<Map<string, Entry>>(
    () => new Map(initialEntries.map(e => [entryKey(e.exercise_id, e.athlete_id), e]))
  )
  const [openCell, setOpenCell] = useState<{ athlete: Athlete; exercise: Exercise } | null>(null)
  const [trainingDate, setTrainingDate] = useState(training.training_date)
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)

  const sortedExercises = useMemo(
    () => [...exercises].sort((a, b) => a.exercise_order - b.exercise_order || a.id - b.id),
    [exercises]
  )

  async function handleAddExercise() {
    setError('')
    const name = prompt('Nazwa ćwiczenia:')
    if (!name || !name.trim()) return
    const maxOrder = Math.max(0, ...exercises.map(e => e.exercise_order))
    const { data, error: err } = await supabase
      .from('group_training_exercises')
      .insert({ training_id: training.id, name: name.trim(), exercise_order: maxOrder + 1 })
      .select()
      .single()
    if (err || !data) { setError(err?.message || 'Błąd dodawania ćwiczenia'); return }
    setExercises(prev => [...prev, data as Exercise])
  }

  async function handleRenameExercise(ex: Exercise) {
    const name = prompt('Nowa nazwa ćwiczenia:', ex.name)
    if (!name || !name.trim() || name.trim() === ex.name) return
    const { error: err } = await supabase
      .from('group_training_exercises')
      .update({ name: name.trim() })
      .eq('id', ex.id)
    if (err) { setError(err.message); return }
    setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, name: name.trim() } : e))
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
      .select('name, exercise_order')
      .eq('training_id', prevTraining.id)
      .order('exercise_order', { ascending: true })
    if (!prevExercises || prevExercises.length === 0) { setError('Poprzedni trening nie miał ćwiczeń.'); setCopying(false); return }
    const { data: inserted, error: err } = await supabase
      .from('group_training_exercises')
      .insert(prevExercises.map(e => ({ training_id: training.id, name: e.name, exercise_order: e.exercise_order })))
      .select()
    setCopying(false)
    if (err || !inserted) { setError(err?.message || 'Błąd kopiowania'); return }
    setExercises(prev => [...prev, ...(inserted as Exercise[])])
  }

  function cellSummary(entry: Entry | undefined) {
    if (!entry || (!entry.sets?.length && entry.pain_vas == null && !entry.comment)) return null
    return entry
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
        .gt-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; }
        .gt-table th, .gt-table td { border-bottom: 1.5px solid ${C.grayLight}; border-right: 1.5px solid ${C.grayLight}; vertical-align: top; }
        .gt-sticky { position: sticky; left: 0; z-index: 2; background: ${C.white}; box-shadow: 2px 0 0 ${C.grayLight}; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.2rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
                ← {group.name}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data:</span>
                <input
                  type="date"
                  value={trainingDate}
                  onChange={e => handleDateChange(e.target.value)}
                  style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 8, padding: '0.4rem 0.6rem', fontFamily: mono, fontSize: '0.78rem', outline: 'none' }}
                />
              </div>
            </div>
            <h1 style={{ color: C.white, fontSize: '1.25rem', fontWeight: 800, marginTop: '0.8rem' }}>
              Trening · {formatDatePl(trainingDate)}
            </h1>
            <p style={{ color: C.gray, fontSize: '0.8rem', marginTop: 3 }}>
              Kliknij komórkę, aby wpisać serie, ciężar i ból. Kliknij nazwę ćwiczenia, aby ją zmienić.
            </p>
          </div>
        </header>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.86rem', marginBottom: '1rem' }}>
              ❌ {error}
            </div>
          )}

          {athletes.length === 0 ? (
            <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: C.gray }}>
              Brak zawodniczek w grupie — najpierw dodaj zawodniczki z panelu grupy.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button onClick={handleAddExercise} style={{ padding: '0.7rem 1.1rem', borderRadius: 12, border: 'none', background: C.navy, color: C.gold, fontWeight: 800, fontSize: '0.85rem' }}>
                  ＋ Dodaj ćwiczenie
                </button>
                {exercises.length === 0 && (
                  <button onClick={handleCopyFromPrevious} disabled={copying} style={{ padding: '0.7rem 1.1rem', borderRadius: 12, border: `1.5px dashed ${C.gray}`, background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.85rem' }}>
                    {copying ? 'Kopiuję...' : '⧉ Skopiuj ćwiczenia z poprzedniego treningu'}
                  </button>
                )}
              </div>

              {exercises.length === 0 ? (
                <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: C.gray }}>
                  Dodaj pierwsze ćwiczenie — pojawi się jako kolumna tabeli.
                </div>
              ) : (
                <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'auto', maxHeight: '70vh' }}>
                  <table className="gt-table">
                    <thead>
                      <tr>
                        <th className="gt-sticky" style={{ minWidth: 150, padding: '0.7rem 0.8rem', textAlign: 'left', fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', background: C.offWhite, zIndex: 3 }}>
                          Zawodniczka
                        </th>
                        {sortedExercises.map(ex => (
                          <th key={ex.id} style={{ minWidth: 150, padding: '0.5rem 0.6rem', background: C.offWhite }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                              <button onClick={() => handleRenameExercise(ex)} title="Zmień nazwę" style={{ flex: 1, border: 'none', background: 'none', fontWeight: 800, fontSize: '0.82rem', color: C.navy, textAlign: 'left', padding: '0.2rem 0', lineHeight: 1.3 }}>
                                {ex.name || '(bez nazwy)'}
                              </button>
                              <button onClick={() => handleDeleteExercise(ex)} title="Usuń ćwiczenie" style={{ border: 'none', background: 'none', color: C.gray, fontSize: '0.78rem', padding: 2 }}>✕</button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {athletes.map(athlete => (
                        <tr key={athlete.id}>
                          <td className="gt-sticky" style={{ padding: '0.7rem 0.8rem', fontWeight: 700, fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                            {athlete.full_name}
                          </td>
                          {sortedExercises.map(ex => {
                            const entry = cellSummary(entryMap.get(entryKey(ex.id, athlete.id)))
                            return (
                              <td key={ex.id} style={{ padding: 0 }}>
                                <button
                                  onClick={() => setOpenCell({ athlete, exercise: ex })}
                                  style={{ display: 'block', width: '100%', minHeight: 52, border: 'none', background: entry ? C.white : '#FAFBFC', textAlign: 'left', padding: '0.5rem 0.6rem' }}
                                >
                                  {entry ? (
                                    <>
                                      {entry.sets.map((s, i) => (
                                        <div key={i} style={{ fontFamily: mono, fontSize: '0.7rem', color: C.navy, whiteSpace: 'nowrap' }}>
                                          <span style={{ color: C.gray }}>{i + 1}:</span>{' '}
                                          {s.reps ? `${s.reps}` : '—'}
                                          {s.weight ? ` × ${s.weight}${/[a-zA-Z%]/.test(s.weight) ? '' : ' kg'}` : ''}
                                          {s.tempo ? ` @${s.tempo}` : ''}
                                        </div>
                                      ))}
                                      <div style={{ display: 'flex', gap: 4, marginTop: entry.sets.length ? 4 : 0, flexWrap: 'wrap' }}>
                                        {entry.pain_vas != null && (
                                          <span style={{ fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, color: C.white, background: entry.pain_vas >= 5 ? C.red : C.orange, borderRadius: 6, padding: '1px 6px' }}>
                                            ból {entry.pain_vas}
                                          </span>
                                        )}
                                        {entry.comment && <span style={{ fontSize: '0.7rem' }} title={entry.comment}>💬</span>}
                                      </div>
                                    </>
                                  ) : (
                                    <span style={{ fontFamily: mono, fontSize: '0.72rem', color: C.grayLight }}>＋</span>
                                  )}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
                <button onClick={() => router.push(`/coach/groups/${group.id}/summary`)} style={{ padding: '0.8rem 1.1rem', borderRadius: 12, border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.85rem' }}>
                  📊 Podsumowanie
                </button>
                <button onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ flex: 1, padding: '0.8rem', borderRadius: 12, border: 'none', background: C.navy, color: C.gold, fontWeight: 900, fontSize: '0.9rem' }}>
                  Gotowe — wróć do grupy
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {openCell && (
        <CellModal
          athlete={openCell.athlete}
          exercise={openCell.exercise}
          entry={entryMap.get(entryKey(openCell.exercise.id, openCell.athlete.id)) || null}
          training={training}
          onClose={() => setOpenCell(null)}
          onSaved={saved => {
            setEntryMap(prev => {
              const next = new Map(prev)
              next.set(entryKey(saved.exercise_id, saved.athlete_id), saved)
              return next
            })
          }}
        />
      )}
    </>
  )
}
