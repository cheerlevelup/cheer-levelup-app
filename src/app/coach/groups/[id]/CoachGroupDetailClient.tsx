'use client'
// src/app/coach/groups/[id]/CoachGroupDetailClient.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModuleConfigPanel from '@/components/ModuleConfigPanel'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

const thStyle: React.CSSProperties = { padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray, background: C.offWhite, borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap', minWidth: 44 }
function tdWs(bg: string): React.CSSProperties { return { padding: '0.4rem 0.5rem', textAlign: 'center', borderBottom: `1.5px solid ${C.grayLight}`, background: bg, verticalAlign: 'middle' } }
function statTd(bg: string): React.CSSProperties { return { padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, background: bg, fontFamily: mono, fontSize: '0.78rem', fontWeight: 700, color: C.navy } }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>{children}</div>
}

function CellStatus({ session }: { session: any | null }) {
  if (!session) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.grayLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>○</div>
  if (session.completed && session.report_sent) return <div title="Raport wysłany" style={{ width: 28, height: 28, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>📋</div>
  if (session.completed) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.white, fontWeight: 800 }}>✓</div>
  return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.7rem', color: C.navy, fontWeight: 800 }}>◑</div>
}

function AssignPlanModal({ athletes, plans, onClose, onAssigned }: {
  athletes: any[]; plans: any[]
  onClose: () => void; onAssigned: () => void
}) {
  const supabase = createClient()
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedAthletes, setSelectedAthletes] = useState<number[]>(athletes.map(a => a.id))
  const [orderMode, setOrderMode] = useState<'sequential' | 'dated'>('sequential')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleAthlete(id: number) {
    setSelectedAthletes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAssign() {
    if (!selectedPlanId || selectedAthletes.length === 0) return
    setSaving(true); setError('')
    try {
      await supabase.from('athlete_workout_assignments')
        .update({ is_active: false })
        .in('athlete_id', selectedAthletes)
        .eq('is_active', true)

      const rows = selectedAthletes.map(athleteId => ({
        athlete_id: athleteId,
        plan_id: parseInt(selectedPlanId),
        is_active: true,
        order_mode: orderMode,
        start_date: new Date().toISOString().split('T')[0],
      }))
      const { error: err } = await supabase.from('athlete_workout_assignments').insert(rows)
      if (err) throw err
      onAssigned()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 480, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Przypisz plan</div>
          <h2 style={{ color: C.white, fontSize: '1.15rem', fontWeight: 800 }}>Wybierz plan dla zawodniczek</h2>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Plan treningowy</div>
            <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem', outline: 'none', appearance: 'none' }}>
              <option value="">Wybierz plan...</option>
              {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Tryb realizacji</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ v: 'sequential', label: 'Sekwencyjny', desc: 'Treningi po kolei' }, { v: 'dated', label: 'Datowany', desc: 'Wg daty' }].map(opt => (
                <button key={opt.v} onClick={() => setOrderMode(opt.v as 'sequential' | 'dated')}
                  style={{ padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${orderMode === opt.v ? C.gold : C.grayLight}`, background: orderMode === opt.v ? C.navy : C.offWhite, color: orderMode === opt.v ? C.gold : C.navy, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.72rem', color: C.gray, marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Zawodniczki</div>
              <button onClick={() => setSelectedAthletes(selectedAthletes.length === athletes.length ? [] : athletes.map(a => a.id))}
                style={{ background: 'none', border: 'none', color: C.gold, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                {selectedAthletes.length === athletes.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {athletes.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.875rem', border: `1.5px solid ${selectedAthletes.includes(a.id) ? C.gold : C.grayLight}`, borderRadius: 10, background: selectedAthletes.includes(a.id) ? C.navyLight : C.offWhite, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedAthletes.includes(a.id)} onChange={() => toggleAthlete(a.id)} style={{ accentColor: C.gold, width: 16, height: 16 }} />
                  <span style={{ fontWeight: 600, color: selectedAthletes.includes(a.id) ? C.white : C.navy, fontSize: '0.9rem' }}>{a.full_name}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.82rem', marginBottom: '1rem' }}>❌ {error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            <button onClick={handleAssign} disabled={!selectedPlanId || selectedAthletes.length === 0 || saving}
              style={{ flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12, background: !selectedPlanId || selectedAthletes.length === 0 ? C.grayLight : C.navy, color: !selectedPlanId || selectedAthletes.length === 0 ? C.gray : C.gold, fontWeight: 900 }}>
              {saving ? 'Przypisuję...' : `Przypisz plan (${selectedAthletes.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SessionReportModal ────────────────────────────────────────────────────────

const feelingLabelMap: Record<string, string> = {
  swietnie: '💪 Świetnie', dobrze: '😊 Dobrze', srednie: '😐 Średnio',
  zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
}

// ── Wellness row helper — zawsze pokazuje pole, nawet puste ──────────────────
function WRow({ label, value, unit, color }: { label: string; value: any; unit?: string; color?: string }) {
  const isEmpty = value === null || value === undefined || value === ''
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.grayLight}` }}>
      <span style={{ fontSize: '0.82rem', color: C.gray }}>{label}</span>
      {isEmpty
        ? <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>
        : <span style={{ fontFamily: mono, fontSize: '0.82rem', fontWeight: 800, color: color ?? C.navy }}>{value}{unit}</span>
      }
    </div>
  )
}

function WBar({ label, value, max, inverse }: { label: string; value: number | null | undefined; max: number; inverse?: boolean }) {
  const isEmpty = value === null || value === undefined
  const pct = isEmpty ? 0 : Math.min(100, Math.max(0, (value! / max) * 100))
  const color = isEmpty ? C.grayLight : wScaleColor(value!, max, !!inverse)
  const comment = isEmpty ? null : (
    inverse
      ? (pct > 70 ? 'Wysoki' : pct > 40 ? 'Średni' : 'Niski')
      : (pct < 30 ? 'Niski' : pct < 60 ? 'Średni' : 'Wysoki')
  )
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.82rem', color: C.gray }}>{label}</span>
        {isEmpty
          ? <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>
          : <span style={{ fontFamily: mono, fontSize: '0.82rem', fontWeight: 800, color }}>{value}/10</span>
        }
      </div>
      <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden' }}>
        {!isEmpty && <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />}
      </div>
      {!isEmpty && comment && <div style={{ fontSize: '0.65rem', color, textAlign: 'right', marginTop: 2 }}>{wComment(value!, inverse ? WC.stress : WC.energy)}</div>}
    </div>
  )
}

function SessionReportModal({ session, athleteId, athleteName, dayName, onClose }: {
  session: any; athleteId: number; athleteName: string; dayName: string; onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<any | null>(null)
  const [wellness, setWellness] = useState<any | null>(null)
  const [setLogs, setSetLogs] = useState<any[]>([])
  const [blocks, setBlocks] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const sessionDate = session.date_completed
        ? new Date(session.date_completed).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

      const [fbRes, logsRes, blocksRes, wellnessRes] = await Promise.all([
        sb.from('post_session_feedback')
          .select('*')
          .eq('workout_session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb.from('set_logs')
          .select('*')
          .eq('workout_session_id', session.id)
          .order('set_number', { ascending: true }),
        sb.from('workout_day_blocks')
          .select('*, workout_block_exercises(id, exercise_id, exercise_code, sets, reps, weight_kg, exercise:exercises(name))')
          .eq('day_id', session.workout_day_id)
          .order('block_order', { ascending: true }),
        sb.from('wellness_logs')
          .select('*')
          .eq('athlete_id', athleteId)
          .eq('date', sessionDate)
          .maybeSingle(),
      ])
      setFeedback(fbRes.data || null)
      setSetLogs(logsRes.data || [])
      setBlocks(blocksRes.data || [])
      setWellness(wellnessRes.data || null)
      setLoading(false)
    }
    load()
  }, [session.id, session.workout_day_id, athleteId])

  const dateStr = session.date_completed
    ? new Date(session.date_completed).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    : '—'

  const rpeC = (rpe: number) => rpe >= 9 ? C.red : rpe >= 7 ? '#F97316' : rpe >= 5 ? C.gold : C.green

  // Mapa nazw ćwiczeń
  const exNameMap: Record<number, string> = {}
  const exPlanMap: Record<number, { sets: number; reps: string; weight: number | null }> = {}
  for (const block of blocks) {
    for (const ex of (block.workout_block_exercises || [])) {
      const name = ex.exercise?.name ? ex.exercise.name.replace(/-/g, ' ') : (ex.exercise_code || `Ćw. #${ex.id}`)
      exNameMap[ex.id] = name
      exPlanMap[ex.id] = { sets: ex.sets, reps: ex.reps || '—', weight: ex.weight_kg }
    }
  }

  // Grupuj set_logs po exercise
  const logsByEx: Record<number, any[]> = {}
  for (const l of setLogs) {
    if (!l.block_exercise_id) continue
    if (!logsByEx[l.block_exercise_id]) logsByEx[l.block_exercise_id] = []
    logsByEx[l.block_exercise_id].push(l)
  }

  // Kolejność ćwiczeń wg bloków
  const orderedExIds: number[] = []
  for (const block of blocks) {
    for (const ex of (block.workout_block_exercises || [])) {
      orderedExIds.push(ex.id)
    }
  }

  const hasSetLogs = setLogs.length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 520, background: C.offWhite, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: C.navy, padding: '1rem 1.25rem', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Raport z treningu</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{dayName}</div>
          <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 3 }}>{athleteName} · {dateStr}</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Ładowanie danych...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

              {/* ── 1. WELLNESS PRZED TRENINGIEM ── */}
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 1rem', background: '#0D2D1A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#86EFAC', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>🩺 Wellness przed treningiem</span>
                  {!wellness && <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#4ADE80', fontStyle: 'italic' }}>brak wpisu na ten dzień</span>}
                </div>
                <div style={{ padding: '0.75rem 1rem' }}>
                  {/* Pasek snu */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.82rem', color: C.gray }}>🌙 Sen — ilość godzin</span>
                      {wellness?.sleep_hours != null
                        ? <span style={{ fontFamily: mono, fontSize: '0.82rem', fontWeight: 800, color: wScaleColor(wellness.sleep_hours, 12, false) }}>{wellness.sleep_hours}h</span>
                        : <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>}
                    </div>
                    <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden' }}>
                      {wellness?.sleep_hours != null && <div style={{ height: '100%', width: `${Math.min(100, (wellness.sleep_hours / 12) * 100)}%`, background: wScaleColor(wellness.sleep_hours, 12, false), borderRadius: 3 }} />}
                    </div>
                  </div>
                  <WBar label="Jakość snu" value={wellness?.sleep_quality} max={10} />
                  <WBar label={`${readinessEmoji(wellness?.readiness ?? 5)} Poziom wypoczęcia`} value={wellness?.readiness} max={10} />
                  <WBar label="Energia" value={wellness?.energy} max={10} />
                  <WBar label="Obciążenie stresem" value={wellness?.stress} max={10} inverse />
                  <WBar label="Zakwasy" value={wellness?.muscle_sorness} max={10} inverse />
                  {/* Opcjonalne pola */}
                  <WRow label="Masa ciała" value={wellness?.body_weight_kg} unit=" kg" />
                  <WRow label="Nawodnienie" value={wellness?.hydration_glasses} unit=" szkl." />
                  <WRow label="Tętno spoczynkowe" value={wellness?.resting_hr} unit=" bpm" />
                  {/* Cykl */}
                  {(() => {
                    const cp = wellness?.cycle_phase
                    const cd = wellness?.cycle_day
                    const cStyle: Record<string, { color: string }> = { menstruacja: { color: C.red }, folikularna: { color: '#F59E0B' }, owulacja: { color: C.green }, lutealna: { color: '#A78BFA' } }
                    const cs = cp ? (cStyle[cp] || { color: C.gray }) : null
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.grayLight}` }}>
                        <span style={{ fontSize: '0.82rem', color: C.gray }}>Faza cyklu</span>
                        {cp
                          ? <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 800, color: cs?.color }}>{cp}{cd ? ` · dzień ${cd}` : ''}</span>
                          : <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>}
                      </div>
                    )
                  })()}
                  {/* Aktywność */}
                  {wellness?.activity_data?.type ? (
                    <div style={{ marginTop: 8, padding: '0.6rem 0.75rem', background: C.offWhite, borderRadius: 8 }}>
                      <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Aktywność</div>
                      <div style={{ fontWeight: 700, color: C.navy, fontSize: '0.85rem' }}>{wellness.activity_data.type}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 2 }}>
                        {wellness.activity_data.time && `${wellness.activity_data.time} · `}
                        {wellness.activity_data.duration && `${wellness.activity_data.duration} min`}
                        {wellness.activity_data.rpe != null && ` · RPE ${wellness.activity_data.rpe}/10`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.grayLight}` }}>
                      <span style={{ fontSize: '0.82rem', color: C.gray }}>Aktywność dnia</span>
                      <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>
                    </div>
                  )}
                  {/* Ból */}
                  {wellness?.pain_data?.painDuring > 0 && (
                    <div style={{ marginTop: 8, padding: '0.6rem 0.75rem', background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 8 }}>
                      <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.red, textTransform: 'uppercase', marginBottom: 3 }}>Ból podczas treningu</div>
                      <div style={{ fontFamily: mono, fontWeight: 800, color: C.red }}>{wellness.pain_data.painDuring}/10</div>
                      {wellness.pain_data.location && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 2 }}>📍 {wellness.pain_data.location}</div>}
                    </div>
                  )}
                  {/* Uwagi */}
                  {/* Suplementy */}
                  {wellness?.supplements_data?.counts && Object.values(wellness.supplements_data.counts).some((v: any) => v > 0) && (
                    <div style={{ marginTop: 8, padding: '0.6rem 0.75rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 8 }}>
                      <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#92400E', textTransform: 'uppercase', marginBottom: 4 }}>💊 Suplementy</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {Object.entries(wellness.supplements_data.counts)
                          .filter(([, v]: any) => v > 0)
                          .map(([id, count]: any) => (
                            <span key={id} style={{ padding: '2px 8px', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, fontFamily: mono, fontSize: '0.65rem', color: '#92400E' }}>
                              {id.replace(/_/g, ' ')}: {count}×
                            </span>
                          ))}
                      </div>
                      {wellness.supplements_data.note && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 4, fontStyle: 'italic' }}>{wellness.supplements_data.note}</div>}
                      {wellness.supplements_data.caffeineSources?.length > 0 && <div style={{ fontSize: '0.75rem', color: '#92400E', marginTop: 3 }}>Kofeina: {wellness.supplements_data.caffeineSources.join(', ')}</div>}
                    </div>
                  )}
                  {wellness?.concerns && (
                    <div style={{ marginTop: 8, padding: '0.6rem 0.75rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 8 }}>
                      <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#92400E', textTransform: 'uppercase', marginBottom: 3 }}>Uwagi dla trenera</div>
                      <div style={{ fontSize: '0.84rem', color: C.navy, fontStyle: 'italic' }}>&ldquo;{wellness.concerns}&rdquo;</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 2. ĆWICZENIA ── */}
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 1rem', background: C.navy, borderBottom: `1.5px solid ${C.navyBorder}`, fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                  🏋️ Ćwiczenia z treningu
                </div>
                {blocks.length === 0 && (
                  <div style={{ padding: '1rem', fontFamily: mono, fontSize: '0.72rem', color: C.gray, textAlign: 'center' }}>Brak danych o planie.</div>
                )}
                {blocks.map((block: any) => {
                  const blockExs = (block.workout_block_exercises || []).sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                  if (blockExs.length === 0) return null
                  return (
                    <div key={block.id}>
                      <div style={{ padding: '0.45rem 1rem', background: C.navyLight, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{block.block_name}</span>
                        {block.rounds > 1 && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray }}>{block.rounds} rundy</span>}
                      </div>
                      {blockExs.map((ex: any, exIdx: number) => {
                        const name = ex.exercise?.name ? ex.exercise.name.replace(/-/g, ' ') : (ex.exercise_code || `Ćw. #${ex.id}`)
                        const plan = exPlanMap[ex.id]
                        const logs = (logsByEx[ex.id] || []).sort((a: any, b: any) => a.set_number - b.set_number)
                        const warmupLogs = logs.filter((l: any) => l.is_warmup)
                        const mainLogs = logs.filter((l: any) => !l.is_warmup)
                        const hasLogs = logs.length > 0
                        const isLast = exIdx === blockExs.length - 1
                        return (
                          <div key={ex.id} style={{ borderBottom: isLast ? 'none' : `1px solid ${C.grayLight}`, padding: '0.75rem 1rem', background: !hasLogs ? '#FAFAFA' : C.white }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: hasLogs ? 8 : 4 }}>
                              <div style={{ fontWeight: 700, color: hasLogs ? C.navy : C.gray, fontSize: '0.9rem' }}>{name}</div>
                              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>
                                {plan ? `plan: ${plan.sets}×${plan.reps}${plan.weight ? ` · ${plan.weight}kg` : ''}` : ''}
                              </div>
                            </div>
                            {!hasLogs && (
                              <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.grayLight, fontStyle: 'italic' }}>nie wykonano / brak danych</div>
                            )}
                            {warmupLogs.map((l: any) => (
                              <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0', opacity: 0.6 }}>
                                <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, minWidth: 42 }}>Rozg</span>
                                <span style={{ fontFamily: mono, fontSize: '0.78rem', color: C.gray }}>{l.weight ? `${l.weight} kg` : '—'}</span>
                                <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>{l.reps_completed ? `${l.reps_completed} powt.` : '—'}</span>
                              </div>
                            ))}
                            {mainLogs.map((l: any, i: number) => (
                              <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', borderTop: i === 0 && warmupLogs.length > 0 ? `1px dashed ${C.grayLight}` : 'none' }}>
                                <span style={{ fontFamily: mono, fontSize: '0.65rem', color: l.completed ? C.gold : C.gray, fontWeight: 800, minWidth: 42 }}>S{l.set_number}</span>
                                <span style={{ fontFamily: mono, fontSize: '0.92rem', fontWeight: 900, color: l.weight ? C.navy : C.gray }}>{l.weight ? `${l.weight} kg` : '—'}</span>
                                <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.gray }}>{l.reps_completed ? `${l.reps_completed} powt.` : '—'}</span>
                                {!l.completed && <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.gray, background: C.offWhite, padding: '1px 5px', borderRadius: 4 }}>nieukończona</span>}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* ── 3. FEEDBACK PO TRENINGU ── */}
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 1rem', background: '#1A0D2A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#C4B5FD', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>💬 Feedback po treningu</span>
                  {!feedback && <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#A78BFA', fontStyle: 'italic' }}>nie wypełniony</span>}
                </div>
                <div style={{ padding: '0.75rem 1rem' }}>
                  {/* RPE */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.82rem', color: C.gray }}>RPE — ciężkość treningu</span>
                      {feedback?.session_rpe != null
                        ? <span style={{ fontFamily: mono, fontWeight: 900, fontSize: '1rem', color: rpeC(feedback.session_rpe) }}>{feedback.session_rpe}/10 <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>{feedback.session_rpe <= 3 ? 'Lekki' : feedback.session_rpe <= 5 ? 'Umiarkowany' : feedback.session_rpe <= 7 ? 'Ciężki' : feedback.session_rpe <= 9 ? 'Bardzo ciężki' : 'Maksymalny'}</span></span>
                        : <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>}
                    </div>
                    {feedback?.session_rpe != null && (
                      <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(feedback.session_rpe / 10) * 100}%`, background: rpeC(feedback.session_rpe), borderRadius: 3 }} />
                      </div>
                    )}
                  </div>
                  {/* Samopoczucie */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.grayLight}` }}>
                    <span style={{ fontSize: '0.82rem', color: C.gray }}>Samopoczucie po treningu</span>
                    {feedback?.feeling_after
                      ? <span style={{ fontWeight: 700, color: C.navy, fontSize: '0.88rem' }}>{feelingLabelMap[feedback.feeling_after] || feedback.feeling_after}</span>
                      : <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>}
                  </div>
                  {/* Co poszło dobrze */}
                  <div style={{ padding: '7px 0', borderBottom: `1px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.green, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 700 }}>Co poszło dobrze</div>
                    {feedback?.what_went_well
                      ? <div style={{ fontSize: '0.86rem', color: C.navy, fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{feedback.what_went_well}&rdquo;</div>
                      : <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>}
                  </div>
                  {/* Ból po treningu */}
                  <div style={{ padding: '7px 0', borderBottom: `1px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 700 }}>Ból / dyskomfort po treningu</div>
                    {feedback?.pain_after_comment
                      ? <div style={{ fontSize: '0.86rem', color: C.navy, fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{feedback.pain_after_comment}&rdquo;</div>
                      : <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>}
                  </div>
                  {/* Dodatkowe uwagi */}
                  <div style={{ padding: '7px 0' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 700 }}>Dodatkowe uwagi dla trenera</div>
                    {feedback?.general_notes
                      ? <div style={{ fontSize: '0.86rem', color: C.navy, lineHeight: 1.5 }}>{feedback.general_notes}</div>
                      : <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.grayLight, fontStyle: 'italic' }}>nie wypełnione</span>}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        <div style={{ padding: '0.875rem 1rem', borderTop: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', padding: '0.75rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 10, fontWeight: 800, fontFamily: sans }}>Zamknij</button>
        </div>
      </div>
    </div>
  )
}

// ── Wellness read-only helpers ────────────────────────────────────────────────

const WC = {
  sleepQ:   ['Brak regenerującego snu','Bardzo słaby sen','Słaby sen','Sen raczej płytki','Poniżej optymalnie','Średnia jakość snu','Całkiem dobry sen','Dobry sen','Bardzo dobry sen','Świetna regeneracja','Maksymalnie regenerujący sen'],
  readiness:['Bardzo duże zmęczenie','Ciało prosi o spokojniejszy start','Niska gotowość','Raczej zmęczona','Lekko poniżej normy','Normalnie','Całkiem wypoczęta','Dobra gotowość','Bardzo wypoczęta','Świetna gotowość','Pełna gotowość'],
  energy:   ['Brak energii','Bardzo niska energia','Trzeba oszczędzać baterie','Energia poniżej normy','Trochę ciężki start','Stabilnie','Energia w porządku','Dobra energia','Bardzo dobra energia','Wysoka energia','Pełna moc'],
  stress:   ['Pełny spokój','Bardzo niski stres','Spokojna głowa','Lekki stres','Do ogarnięcia','Umiarkowanie','Podwyższone napięcie','Warto obserwować','Dużo stresu','Bardzo duże obciążenie','Alarmowo wysoki stres'],
  soreness: ['Brak zakwasów','Ledwo wyczuwalne','Lekkie zakwasy','Czuć mięśnie, ale bez problemu','Umiarkowane zakwasy','Wyraźne zakwasy','Mogą wpływać na ruch','Mocne zakwasy','Ciężko wejść w trening','Bardzo mocne obciążenie mięśni','Regeneracja priorytetem'],
  pain:     ['Brak bólu','Minimalny sygnał','Lekki dyskomfort','Do obserwacji','Umiarkowany ból','Wyraźny ból','Może ograniczać trening','Ważne dla trenera','Mocno ogranicza','Bardzo silny ból','Alarmowo — nie ignorować'],
}

function wScaleColor(v: number, max: number, inverse: boolean) {
  const pct = (v / max) * 100
  const risk = inverse ? pct : 100 - pct
  if (risk <= 30) return C.green
  if (risk <= 55) return C.gold
  if (risk <= 75) return '#F97316'
  return C.red
}
function wComment(v: number, arr: string[]) { return arr[Math.max(0, Math.min(arr.length - 1, Math.round(v)))] }
function readinessEmoji(v: number) { return v <= 1 ? '😴' : v <= 3 ? '😪' : v <= 5 ? '😐' : v <= 8 ? '😊' : '⚡' }

function WScale({ label, emoji, value, max, unit, comments, inverse }: { label: string; emoji?: string; value: number | null | undefined; max: number; unit?: string; comments?: string[]; inverse?: boolean }) {
  if (value == null) return null
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = wScaleColor(value, max, !!inverse)
  const comment = comments ? wComment(value, comments) : null
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: C.navy, fontSize: '0.9rem' }}>
          {emoji && <span style={{ fontSize: '1.15rem' }}>{emoji}</span>}
          <span>{label}</span>
        </div>
        <span style={{ fontFamily: mono, fontWeight: 900, color, fontSize: '1rem' }}>{value}{unit}</span>
      </div>
      <div style={{ height: 8, background: C.grayLight, borderRadius: 4, overflow: 'hidden', marginBottom: comment ? 4 : 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
      {comment && <div style={{ fontSize: '0.72rem', fontWeight: 700, color, textAlign: 'center', marginTop: 3 }}>{comment}</div>}
    </div>
  )
}

const motivationLabels: Record<number, { label: string; emoji: string }> = { 1: { label: 'Zerowa', emoji: '😴' }, 2: { label: 'Niska', emoji: '🙄' }, 3: { label: 'Średnia', emoji: '😐' }, 4: { label: 'Wysoka', emoji: '💪' }, 5: { label: 'Ogień!', emoji: '🔥' } }
const feelingLabels: Record<string, string> = { swietnie: '🤩 Świetnie', dobrze: '😊 Dobrze', ok: '😐 OK', zmeczona: '😓 Zmęczona', slabo: '😞 Słabo' }
const goalLabels: Record<string, string> = { tak: '✅ Zrealizowała', czesciowo: '⚡ Częściowo', nie: '❌ Nie', brak: '— Brak planu' }
const cycleColors: Record<string, { color: string; bg: string }> = { menstruacja: { color: '#EF4444', bg: '#FEF2F2' }, folikularna: { color: '#F59E0B', bg: '#FFFBEB' }, owulacja: { color: '#22C55E', bg: '#F0FDF4' }, lutealna: { color: '#A78BFA', bg: '#F5F3FF' } }

function WellnessFullReport({ w }: { w: any }) {
  const act = w.activity_data || {}
  const pain = w.pain_data || {}
  const cycle = w.cycle_phase
  const cycleStyle = cycle ? (cycleColors[cycle] || { color: C.gray, bg: C.offWhite }) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>

      {/* ── BASIC ── */}
      <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>Basic — najważniejsze</div>
        {w.sleep_hours != null && (
          <div style={{ marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontWeight: 800, color: C.navy }}>🌙 Sen — ilość godzin</span>
              <span style={{ fontFamily: mono, fontWeight: 900, color: wScaleColor(w.sleep_hours, 12, false), fontSize: '1rem' }}>{w.sleep_hours}h</span>
            </div>
            <div style={{ height: 8, background: C.grayLight, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (w.sleep_hours / 12) * 100)}%`, background: wScaleColor(w.sleep_hours, 12, false), borderRadius: 4 }} />
            </div>
          </div>
        )}
        <WScale label="Jakość snu" value={w.sleep_quality} max={10} comments={WC.sleepQ} />
        <WScale label={`${readinessEmoji(w.readiness ?? 5)} Poziom wypoczęcia`} value={w.readiness} max={10} comments={WC.readiness} />
        <WScale label="Energia" value={w.energy} max={10} comments={WC.energy} />
        <WScale label="Obciążenie stresem" value={w.stress} max={10} comments={WC.stress} inverse />
        {w.body_weight_kg && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.875rem', background: C.offWhite, borderRadius: 9, fontFamily: mono }}>
            <span style={{ fontSize: '0.72rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Masa ciała</span>
            <span style={{ fontWeight: 800, color: C.navy }}>{w.body_weight_kg} kg</span>
          </div>
        )}
        {cycle && cycleStyle && (
          <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.875rem', background: cycleStyle.bg, border: `1.5px solid ${cycleStyle.color}55`, borderRadius: 9 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cycleStyle.color }} />
            <span style={{ fontWeight: 800, color: cycleStyle.color, fontSize: '0.88rem' }}>{cycle.charAt(0).toUpperCase() + cycle.slice(1)}</span>
            {w.cycle_day && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: cycleStyle.color }}>dzień {w.cycle_day}</span>}
          </div>
        )}
      </div>

      {/* ── AKTYWNOŚĆ ── */}
      {(act.type || act.duration) && (
        <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>Aktywność dnia</div>
          {act.type && (
            <div style={{ display: 'inline-block', padding: '0.4rem 0.875rem', background: C.navyLight, color: C.gold, borderRadius: 8, fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.75rem' }}>{act.type}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {act.time && <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.gray }}>🕐 {act.time}</span>}
            {act.duration && <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.gray }}>⏱ {act.duration} min</span>}
            {act.motivation && motivationLabels[act.motivation] && (
              <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.gray }}>{motivationLabels[act.motivation].emoji} motywacja: {motivationLabels[act.motivation].label}</span>
            )}
          </div>
          {act.rpe != null && act.rpe > 0 && (
            <WScale label="RPE — ciężkość wysiłku" value={act.rpe} max={10} inverse />
          )}
          {act.feelingAfter && feelingLabels[act.feelingAfter] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.55rem 0.875rem', background: C.offWhite, borderRadius: 9, marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: C.gray }}>Samopoczucie po</span>
              <span style={{ fontWeight: 800, color: C.navy }}>{feelingLabels[act.feelingAfter]}</span>
            </div>
          )}
          {act.satisfaction != null && (
            <WScale label="Satysfakcja z treningu" value={act.satisfaction} max={10} />
          )}
          {act.goal && goalLabels[act.goal] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.55rem 0.875rem', background: C.offWhite, borderRadius: 9, marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: C.gray }}>Plan zrealizowany?</span>
              <span style={{ fontWeight: 800, color: C.navy }}>{goalLabels[act.goal]}</span>
            </div>
          )}
          {act.goalComment && <div style={{ fontSize: '0.82rem', color: C.gray, fontStyle: 'italic', marginTop: '0.25rem' }}>{act.goalComment}</div>}
          {act.note && <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.875rem', background: C.offWhite, borderRadius: 9, fontSize: '0.84rem', color: C.navy }}>{act.note}</div>}
        </div>
      )}

      {/* ── BÓL ── */}
      {(pain.painDuring > 0 || pain.location || w.muscle_sorness > 0 || pain.headache > 0 || pain.anxiety > 0 || pain.mentalOverload > 0) && (
        <div style={{ background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.red, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>Ból i obciążenie</div>
          {w.muscle_sorness > 0 && <WScale label="Zakwasy" value={w.muscle_sorness} max={10} comments={WC.soreness} inverse />}
          {pain.painDuring > 0 && <WScale label="Ból podczas treningu" value={pain.painDuring} max={10} comments={WC.pain} inverse />}
          {pain.location && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.84rem', color: C.navy }}>
              <span>📍</span><span style={{ fontWeight: 700 }}>{pain.location}</span>
            </div>
          )}
          {pain.note && <div style={{ fontSize: '0.82rem', color: C.gray, fontStyle: 'italic' }}>{pain.note}</div>}
          {pain.headache > 0 && <WScale label="Ból głowy" value={pain.headache} max={10} inverse />}
          {pain.anxiety > 0 && <WScale label="Lęk / niepokój" value={pain.anxiety} max={10} inverse />}
          {pain.mentalOverload > 0 && <WScale label="Przeciążenie mentalne" value={pain.mentalOverload} max={10} inverse />}
          {(pain.anxietySources?.length > 0 || pain.mentalSources?.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: '0.5rem' }}>
              {[...(pain.anxietySources || []), ...(pain.mentalSources || [])].map((s: string) => (
                <span key={s} style={{ padding: '2px 9px', background: '#FEE2E2', color: C.red, borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── UWAGI ── */}
      {w.concerns && (
        <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#92400E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>Uwagi dla trenera</div>
          <div style={{ fontSize: '0.9rem', color: C.navy, lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{w.concerns}&rdquo;</div>
        </div>
      )}
    </div>
  )
}

// ── AthleteQuickReportModal ───────────────────────────────────────────────────

function WellnessEntryDetail({ w, onClose }: { w: any; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(13,27,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 520, background: C.offWhite, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Raport wellness</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.05rem' }}>{new Date(w.date || w.created_at).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <WellnessFullReport w={w} />
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', padding: '0.75rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 10, fontWeight: 800, fontFamily: sans }}>Zamknij</button>
        </div>
      </div>
    </div>
  )
}

function AthleteQuickReportModal({ athlete, wellnessLogs, dietLogs, onClose, onGoToProfile }: { athlete: any; wellnessLogs: any[]; dietLogs: any[]; onClose: () => void; onGoToProfile: () => void }) {
  const [reportTab, setReportTab] = useState<'wellness' | 'diet'>('wellness')
  const [detailEntry, setDetailEntry] = useState<any | null>(null)

  const myWellness = wellnessLogs.filter((l: any) => l.athlete_id === athlete.id).sort((a: any, b: any) => b.date?.localeCompare(a.date ?? '') || 0)
  const myDiet = dietLogs.filter((d: any) => d.athlete_id === athlete.id).sort((a: any, b: any) => b.date?.localeCompare(a.date ?? '') || 0)

  return (
    <>
      {detailEntry && <WellnessEntryDetail w={detailEntry} onClose={() => setDetailEntry(null)} />}
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }} onClick={onClose}>
        <div style={{ width: '100%', maxWidth: 520, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ background: C.navy, padding: '1rem 1.25rem', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Raporty zawodniczki</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ color: C.white, fontSize: '1.1rem', fontWeight: 800 }}>{athlete.full_name}</h2>
              <button onClick={onGoToProfile} style={{ border: 'none', background: C.gold, color: C.navy, borderRadius: 8, padding: '0.4rem 0.75rem', fontFamily: mono, fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Pełny profil →
              </button>
            </div>
          </div>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
            {([{ id: 'wellness', label: '🩺 Wellness' }, { id: 'diet', label: '🥗 Dieta' }] as { id: 'wellness' | 'diet'; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setReportTab(t.id)} style={{ flex: 1, padding: '0.65rem', border: 'none', background: reportTab === t.id ? C.white : C.offWhite, color: reportTab === t.id ? C.navy : C.gray, fontWeight: reportTab === t.id ? 800 : 600, fontFamily: mono, fontSize: '0.7rem', borderBottom: reportTab === t.id ? `2px solid ${C.gold}` : '2px solid transparent', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Content */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {reportTab === 'wellness' && (
              myWellness.length === 0
                ? <div style={{ padding: '2rem', textAlign: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak wpisów wellness (ostatnie 30 dni)</div>
                : myWellness.map((w: any, i: number) => {
                    const hasDetail = w.sleep_hours != null || w.energy != null || w.stress != null || w.readiness != null || w.pain_data?.painDuring != null
                    return (
                      <button key={w.date || i} onClick={() => hasDetail && setDetailEntry(w)}
                        style={{ width: '100%', background: 'none', border: 'none', borderBottom: i < myWellness.length - 1 ? `1.5px solid ${C.grayLight}` : 'none', padding: '0.7rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: hasDetail ? 'pointer' : 'default', textAlign: 'left' }}
                        onMouseEnter={e => hasDetail && (e.currentTarget.style.background = C.offWhite)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <div style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 700, color: C.navy }}>
                          {new Date(w.date || w.created_at).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {w.energy != null && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gold }}>⚡{w.energy}</span>}
                          {w.sleep_hours != null && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>🌙{w.sleep_hours}h</span>}
                          {w.readiness != null && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.green }}>💪{w.readiness}</span>}
                          {w.stress != null && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: w.stress >= 7 ? C.red : C.gray }}>🧠{w.stress}</span>}
                          {w.pain_data?.painDuring > 0 && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.red }}>🩹{w.pain_data.painDuring}</span>}
                          {hasDetail && <span style={{ color: C.gray, fontSize: '0.8rem' }}>›</span>}
                        </div>
                      </button>
                    )
                  })
            )}
            {reportTab === 'diet' && (
              myDiet.length === 0
                ? <div style={{ padding: '2rem', textAlign: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak wpisów diety (ostatnie 30 dni)</div>
                : myDiet.map((d: any, i: number) => (
                    <div key={d.date || i} style={{ padding: '0.7rem 1.25rem', borderBottom: i < myDiet.length - 1 ? `1.5px solid ${C.grayLight}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 700, color: C.navy }}>
                        {new Date(d.date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {d.had_breakfast && <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.green }}>🌅śniad.</span>}
                        {d.meal_count > 0 && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>🍽️{d.meal_count}</span>}
                        {d.water_ml > 0 && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.navy }}>💧{d.water_ml}ml</span>}
                        {d.coffee_count > 0 && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>☕{d.coffee_count}</span>}
                        {d.hunger_level != null && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>głód:{d.hunger_level}</span>}
                      </div>
                    </div>
                  ))
            )}
          </div>
          <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
            <button onClick={onClose} style={{ width: '100%', padding: '0.7rem', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, borderRadius: 10, fontWeight: 700, fontFamily: sans, cursor: 'pointer' }}>Zamknij</button>
          </div>
        </div>
      </div>
    </>
  )
}

type Tab = 'trening' | 'wellness' | 'diet' | 'athletes'

// ── Wellness helpers ──────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function colorBand(val: number | null, thresholds: [number, number], colors: [string, string, string]): string {
  if (val === null) return C.gray
  if (val <= thresholds[0]) return colors[0]
  if (val <= thresholds[1]) return colors[1]
  return colors[2]
}

function Dot({ color, title }: { color: string; title?: string }) {
  return <div title={title} style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function WellnessBadge({ value, label, color }: { value: string; label?: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.72rem', fontWeight: 800, color }}>{value}</div>
      {label && <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.5rem', color: C.gray }}>{label}</div>}
    </div>
  )
}

function getAthleteWellnessSummary(athleteId: number, logs: any[]) {
  const myLogs = logs.filter((l: any) => l.athlete_id === athleteId)
  const today = new Date().toISOString().split('T')[0]
  const hasToday = myLogs.some((l: any) => l.date === today)

  const sleepVals = myLogs.map((l: any) => l.sleep_hours).filter((v: any) => v != null) as number[]
  const stressVals = myLogs.map((l: any) => l.stress).filter((v: any) => v != null) as number[]

  // Pain: max pain_during from last 7 days
  const painVals = myLogs
    .map((l: any) => l.pain_data?.painDuring ?? null)
    .filter((v: any) => v != null) as number[]
  const maxPain = painVals.length ? Math.max(...painVals) : null

  // Activity hours
  const totalMinutes = myLogs.reduce((sum: number, l: any) => {
    const dur = parseInt(l.activity_data?.duration || '0') || 0
    return sum + dur
  }, 0)
  const activityHours = totalMinutes > 0 ? +(totalMinutes / 60).toFixed(1) : null

  // Cycle
  const latestCycle = myLogs.find((l: any) => l.cycle_phase)?.cycle_phase ?? null

  return {
    hasToday,
    sleepAvg: avg(sleepVals),
    stressAvg: avg(stressVals),
    maxPain,
    activityHours,
    latestCycle,
    entryCount: myLogs.length,
  }
}

// ── AthleteEditCard ───────────────────────────────────────────────────────────

type ProfileTab = 'profil' | 'umiejetnosci' | 'kontuzje' | 'testy' | 'motoryczny'

const CHEER_JUMPS = ['Herkie', 'Pike', 'Toe touch', 'Hurdler', 'Spread eagle', 'Double nine', 'Around the world', 'Tuck', 'X jump']
const DANCE_JUMPS = ['Grand jeté', 'Switch leap', 'Turning jump', 'Stag', 'Cabriole']
const ACRO_SKILLS = ['Rondad', 'Flik', 'Salto przodem', 'Salto tyłem', 'Arabian', 'Full', 'Double full', 'Layout', 'Tuck salto', 'Pike salto', 'Handspring']
const DANCE_STYLES = ['Jazz', 'Hip-hop', 'Lyrical', 'Contemporary', 'Pom', 'Cheerleading', 'Balet', 'Taniec nowoczesny']

function AthleteEditCard({ athlete, groupId, onSaved }: { athlete: any; groupId: number; onSaved: (updated: any) => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [profileTab, setProfileTab] = useState<ProfileTab>('profil')

  // Profil
  const [fullName, setFullName]     = useState(athlete.full_name || '')
  const [birthYear, setBirthYear]   = useState(athlete.birth_year?.toString() || '')
  const [phone, setPhone]           = useState(athlete.phone || '')
  const [position, setPosition]     = useState(athlete.position || '')
  const [height, setHeight]         = useState(athlete.height_cm?.toString() || '')
  const [bodyWeight, setBodyWeight] = useState(athlete.body_weight_kg?.toString() || '')
  const [notes, setNotes]           = useState(athlete.notes || '')

  // Umiejętności (trzymane w skills jsonb)
  const initSkills = athlete.skills || {}
  const [pirCount, setPirCount]     = useState(initSkills.pirouettes?.toString() || '')
  const [pirNotes, setPirNotes]     = useState(initSkills.pirouettes_notes || '')
  const [cheerJumps, setCheerJumps] = useState<string[]>(initSkills.cheer_jumps || [])
  const [danceJumps, setDanceJumps] = useState<string[]>(initSkills.dance_jumps || [])
  const [acroSkills, setAcroSkills] = useState<string[]>(initSkills.acro_skills || [])
  const [danceStyles, setDanceStyles] = useState<string[]>(initSkills.dance_styles || [])
  const [stunts, setStunts]         = useState(initSkills.stunts || '')
  const [pyramids, setPyramids]     = useState(initSkills.pyramids || '')
  const [skillsNotes, setSkillsNotes] = useState(initSkills.notes || '')

  // Kontuzje
  const [injuries, setInjuries]     = useState<{date: string; type: string; status: string; note: string}[]>(athlete.injuries || [])

  // Testy
  const initTests = athlete.tests || {}
  const [longJumpBoth, setLongJumpBoth]         = useState(initTests.long_jump_both?.distance_cm?.toString() || '')
  const [longJumpBothDate, setLongJumpBothDate] = useState(initTests.long_jump_both?.date || '')
  const [longJumpLeftDist, setLongJumpLeftDist] = useState(initTests.long_jump_left?.distance_cm?.toString() || '')
  const [longJumpLeftDate, setLongJumpLeftDate] = useState(initTests.long_jump_left?.date || '')
  const [longJumpRightDist, setLongJumpRightDist] = useState(initTests.long_jump_right?.distance_cm?.toString() || '')
  const [longJumpRightDate, setLongJumpRightDate] = useState(initTests.long_jump_right?.date || '')
  const [chinupSec, setChinupSec]   = useState(initTests.chinup?.seconds?.toString() || '')
  const [chinupDate, setChinupDate] = useState(initTests.chinup?.date || '')
  const [pushupsCount, setPushupsCount] = useState(initTests.pushups?.count?.toString() || '')
  const [pushupsDate, setPushupsDate]   = useState(initTests.pushups?.date || '')

  // Trening motoryczny
  const [motorData, setMotorData] = useState<any[]>([])
  const [motorLoaded, setMotorLoaded] = useState(false)
  const [motorLoading, setMotorLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const inp: React.CSSProperties = { width: '100%', minHeight: 36, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, background: C.offWhite, color: C.navy, padding: '0 0.75rem', fontFamily: sans, fontSize: '0.86rem', outline: 'none' }
  const lbl: React.CSSProperties = { fontFamily: mono, fontSize: '0.58rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }

  function toggleArr(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function addInjury() {
    setInjuries(prev => [...prev, { date: new Date().toISOString().split('T')[0], type: '', status: 'aktywna', note: '' }])
  }

  async function loadMotorData() {
    if (motorLoaded || motorLoading) return
    setMotorLoading(true)
    const supabase2 = createClient()

    // 1. Pobierz plany grupy (historia)
    const { data: assigns } = await supabase2
      .from('athlete_workout_assignments')
      .select('plan_id, plan:workout_plans(id, name)')
      .eq('group_id', groupId)

    const planMap: Record<number, string> = {}
    const planIds = (assigns || []).map((a: any) => {
      planMap[a.plan_id] = a.plan?.name ?? '—'
      return a.plan_id
    })
    if (!planIds.length) { setMotorLoaded(true); setMotorLoading(false); return }

    // 2. Pobierz wszystkie tygodnie → dni → bloki → ćwiczenia
    const { data: weeks } = await supabase2.from('workout_weeks').select('id, plan_id').in('plan_id', planIds)
    const weekIds = (weeks || []).map((w: any) => w.id)
    const weekPlanMap: Record<number, number> = {}
    ;(weeks || []).forEach((w: any) => { weekPlanMap[w.id] = w.plan_id })

    const { data: days2 } = await supabase2.from('workout_days').select('id, week_id').in('week_id', weekIds)
    const dayIds = (days2 || []).map((d: any) => d.id)
    const dayWeekMap: Record<number, number> = {}
    ;(days2 || []).forEach((d: any) => { dayWeekMap[d.id] = d.week_id })

    const { data: blocks2 } = await supabase2.from('workout_day_blocks').select('id, day_id').in('day_id', dayIds)
    const blockIds = (blocks2 || []).map((b: any) => b.id)
    const blockDayMap: Record<number, number> = {}
    ;(blocks2 || []).forEach((b: any) => { blockDayMap[b.id] = b.day_id })

    const { data: exs } = await supabase2.from('workout_block_exercises')
      .select('id, block_id, exercise_id, exercise_code, sets, reps, tempo, weight_kg, exercise:exercises(name)')
      .in('block_id', blockIds)

    // 3. Sesje zawodniczki (daty)
    const { data: sessions2 } = await supabase2.from('workout_sessions')
      .select('workout_day_id, date_completed, completed')
      .eq('athlete_id', athlete.id)
      .eq('completed', true)
      .in('workout_day_id', dayIds)

    const sessionDateMap: Record<number, string> = {}
    ;(sessions2 || []).forEach((s: any) => {
      if (!sessionDateMap[s.workout_day_id] || s.date_completed > sessionDateMap[s.workout_day_id]) {
        sessionDateMap[s.workout_day_id] = s.date_completed
      }
    })

    // 4. Zbuduj listę ćwiczeń z metadanymi
    type ExRow = { name: string; sets: number; reps: string; tempo: string; weight: number | null; planName: string; date: string | null }
    const rows: ExRow[] = []
    ;(exs || []).forEach((ex: any) => {
      const dayId = blockDayMap[ex.block_id]
      const weekId = dayWeekMap[dayId]
      const planId = weekPlanMap[weekId]
      const planName = planMap[planId] ?? '—'
      const date = sessionDateMap[dayId] ?? null
      const name = ex.exercise?.name ? ex.exercise.name.replace(/-/g, ' ') : (ex.exercise_code || 'Ćwiczenie')
      rows.push({ name, sets: ex.sets ?? 0, reps: ex.reps ?? '', tempo: ex.tempo ?? '', weight: ex.weight_kg ?? null, planName, date })
    })

    // 5. Deduplikacja: grupuj po (name, reps, tempo) → jeśli te same → zostaw z max(sets, weight)
    // Jeśli różne (reps, tempo) przy tej samej nazwie → osobne wpisy
    const groupMap = new Map<string, ExRow>()
    rows.forEach(row => {
      const key = `${row.name.toLowerCase()}||${row.reps}||${row.tempo}`
      const existing = groupMap.get(key)
      if (!existing) {
        groupMap.set(key, row)
      } else {
        // Zastąp jeśli nowy ma więcej sets lub ciężar lub nowsza data
        const existSets = existing.sets ?? 0
        const newSets = row.sets ?? 0
        const existW = existing.weight ?? 0
        const newW = row.weight ?? 0
        if (newSets > existSets || newW > existW || (row.date && (!existing.date || row.date > existing.date))) {
          groupMap.set(key, row)
        }
      }
    })

    // 6. Posortuj alfabetycznie po nazwie
    const sorted = Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    setMotorData(sorted)
    setMotorLoaded(true)
    setMotorLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const skillsPayload = {
      pirouettes: pirCount ? parseInt(pirCount) : null,
      pirouettes_notes: pirNotes || null,
      cheer_jumps: cheerJumps, dance_jumps: danceJumps,
      acro_skills: acroSkills, dance_styles: danceStyles,
      stunts: stunts || null, pyramids: pyramids || null,
      notes: skillsNotes || null,
    }
    const testsPayload = {
      long_jump_both:  longJumpBoth  ? { distance_cm: parseFloat(longJumpBoth),  date: longJumpBothDate  || null } : null,
      long_jump_left:  longJumpLeftDist  ? { distance_cm: parseFloat(longJumpLeftDist),  date: longJumpLeftDate  || null } : null,
      long_jump_right: longJumpRightDist ? { distance_cm: parseFloat(longJumpRightDist), date: longJumpRightDate || null } : null,
      chinup:   chinupSec   ? { seconds: parseFloat(chinupSec),   date: chinupDate   || null } : null,
      pushups:  pushupsCount ? { count: parseInt(pushupsCount),   date: pushupsDate  || null } : null,
    }

    const { data, error } = await supabase.from('athletes').update({
      full_name: fullName.trim(),
      birth_year: birthYear ? parseInt(birthYear) : null,
      phone: phone.trim() || null,
      position: position.trim() || null,
      height_cm: height ? parseFloat(height) : null,
      body_weight_kg: bodyWeight ? parseFloat(bodyWeight) : null,
      notes: notes.trim() || null,
      skills: skillsPayload,
      injuries,
      tests: testsPayload,
    }).eq('id', athlete.id).select().single()
    setSaving(false)
    if (!error && data) { setSaved(true); onSaved(data); setTimeout(() => setSaved(false), 2000) }
  }

  const chips = (options: string[], selected: string[], setSelected: (v: string[]) => void) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
      {options.map(o => {
        const on = selected.includes(o)
        return (
          <button key={o} onClick={() => toggleArr(selected, setSelected, o)} style={{ borderRadius: 7, border: `1.5px solid ${on ? C.gold : C.grayLight}`, background: on ? C.navy : C.offWhite, color: on ? C.gold : C.navy, padding: '3px 10px', fontFamily: mono, fontSize: '0.65rem', fontWeight: on ? 800 : 600, cursor: 'pointer' }}>
            {o}
          </button>
        )
      })}
    </div>
  )

  return (
    <div style={{ border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, overflow: 'hidden', boxShadow: '0 2px 8px rgba(13,27,42,0.04)' }}>
      {/* Header */}
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', background: 'none', border: 'none', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.navy, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
          {fullName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: C.navy }}>{fullName}</div>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {birthYear && <span>ur. {birthYear}</span>}
            {position && <span>· {position}</span>}
            {height && <span>· {height} cm</span>}
            {initSkills.pirouettes && <span style={{ color: C.gold }}>· {initSkills.pirouettes} piruety</span>}
            {injuries.filter(inj => inj.status === 'aktywna').length > 0 && (
              <span style={{ color: C.red }}>· ⚠️ {injuries.filter(inj => inj.status === 'aktywna').length} aktywna kontuzja</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {saved && <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.green }}>✓ Zapisano</span>}
          <a href={`/coach/athletes/${athlete.id}`} onClick={e => e.stopPropagation()}
            style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.3rem 0.6rem', fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
            title="Pełny profil z raportami wellness i diety">
            📊 Raporty
          </a>
          <span style={{ color: C.gray, fontSize: '1rem', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: `1.5px solid ${C.grayLight}` }}>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', borderBottom: `1.5px solid ${C.grayLight}`, overflowX: 'auto' }}>
            {([
              { id: 'profil',      label: '👤 Profil' },
              { id: 'umiejetnosci',label: '⭐ Umiejętności' },
              { id: 'kontuzje',    label: '🩹 Kontuzje' },
              { id: 'testy',       label: '📏 Testy' },
              { id: 'motoryczny',  label: '🏋️ Motoryczny' },
            ] as { id: ProfileTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => { setProfileTab(t.id); if (t.id === 'motoryczny') loadMotorData() }} style={{ flexShrink: 0, padding: '0.6rem 0.85rem', border: 'none', background: profileTab === t.id ? C.white : C.offWhite, color: profileTab === t.id ? C.navy : C.gray, fontWeight: profileTab === t.id ? 800 : 600, fontFamily: mono, fontSize: '0.63rem', borderBottom: profileTab === t.id ? `2px solid ${C.gold}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
            {/* ── Profil ── */}
            {profileTab === 'profil' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Imię i nazwisko</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} />
                </div>
                <div><label style={lbl}>Rok urodzenia</label><input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="2005" style={inp} /></div>
                <div><label style={lbl}>Telefon</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 000 000 000" style={inp} /></div>
                <div><label style={lbl}>Pozycja / rola</label><input value={position} onChange={e => setPosition(e.target.value)} placeholder="flyer, baza, back spot..." style={inp} /></div>
                <div><label style={lbl}>Wzrost (cm)</label><input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="165" style={inp} /></div>
                <div><label style={lbl}>Masa ciała (kg)</label><input type="number" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} placeholder="55" style={inp} /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Notatki trenerskie</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Uwagi ogólne, cele, dyspozycje..." style={{ ...inp, minHeight: 60, padding: '0.5rem 0.75rem', resize: 'none', display: 'block' }} />
                </div>
              </div>
            )}

            {/* ── Umiejętności ── */}
            {profileTab === 'umiejetnosci' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ ...lbl, marginBottom: 8 }}>🌀 Piruety</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize: '0.55rem' }}>Ilość</label>
                      <input type="number" value={pirCount} onChange={e => setPirCount(e.target.value)} placeholder="0" min="0" max="10" style={inp} />
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: '0.55rem' }}>Uwagi</label>
                      <input value={pirNotes} onChange={e => setPirNotes(e.target.value)} placeholder="np. tylko w prawo, praca nad balansem..." style={inp} />
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>🤸 Skoki cheer</div>
                  {chips(CHEER_JUMPS, cheerJumps, setCheerJumps)}
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>💃 Skoki dance</div>
                  {chips(DANCE_JUMPS, danceJumps, setDanceJumps)}
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>🎪 Elementy akrobatyczne</div>
                  {chips(ACRO_SKILLS, acroSkills, setAcroSkills)}
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>🎵 Style taneczne</div>
                  {chips(DANCE_STYLES, danceStyles, setDanceStyles)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={lbl}>Stunty (opis)</label>
                    <textarea value={stunts} onChange={e => setStunts(e.target.value)} rows={2} placeholder="np. lib, scorpion, full up..." style={{ ...inp, minHeight: 56, padding: '0.5rem 0.75rem', resize: 'none', display: 'block' }} />
                  </div>
                  <div>
                    <label style={lbl}>Piramidy (opis)</label>
                    <textarea value={pyramids} onChange={e => setPyramids(e.target.value)} rows={2} placeholder="np. 2-2-1, pełne wrzuty..." style={{ ...inp, minHeight: 56, padding: '0.5rem 0.75rem', resize: 'none', display: 'block' }} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Dodatkowe uwagi do umiejętności</label>
                  <textarea value={skillsNotes} onChange={e => setSkillsNotes(e.target.value)} rows={2} placeholder="Inne elementy, cele treningowe..." style={{ ...inp, minHeight: 56, padding: '0.5rem 0.75rem', resize: 'none', display: 'block' }} />
                </div>
              </div>
            )}

            {/* ── Kontuzje ── */}
            {profileTab === 'kontuzje' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {injuries.length === 0 && (
                  <div style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray, textAlign: 'center', padding: '1rem' }}>Brak zapisanych kontuzji</div>
                )}
                {injuries.map((inj, i) => (
                  <div key={i} style={{ border: `1.5px solid ${inj.status === 'aktywna' ? C.red : C.grayLight}`, borderRadius: 10, padding: '0.75rem', background: inj.status === 'aktywna' ? '#FFF5F5' : C.offWhite }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                      <div>
                        <label style={lbl}>Data</label>
                        <input type="date" value={inj.date} onChange={e => setInjuries(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Status</label>
                        <select value={inj.status} onChange={e => setInjuries(prev => prev.map((x, j) => j === i ? { ...x, status: e.target.value } : x))} style={{ ...inp, appearance: 'none' }}>
                          <option value="aktywna">Aktywna</option>
                          <option value="w leczeniu">W leczeniu</option>
                          <option value="wyleczona">Wyleczona</option>
                          <option value="przewlekla">Przewlekła</option>
                        </select>
                      </div>
                      <button onClick={() => setInjuries(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: C.red, cursor: 'pointer', fontSize: '1rem', alignSelf: 'flex-end', paddingBottom: 4 }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8 }}>
                      <div>
                        <label style={lbl}>Rodzaj / lokalizacja</label>
                        <input value={inj.type} onChange={e => setInjuries(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} placeholder="np. naciągnięcie kostki, ból kolana..." style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Notatka</label>
                        <input value={inj.note} onChange={e => setInjuries(prev => prev.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="Leczenie, ograniczenia, uwagi..." style={inp} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addInjury} style={{ border: `1.5px dashed ${C.grayLight}`, background: C.white, color: C.gray, borderRadius: 10, padding: '0.6rem', fontFamily: mono, fontSize: '0.68rem', cursor: 'pointer', fontWeight: 700 }}>
                  + Dodaj kontuzję
                </button>
              </div>
            )}

            {/* ── Testy ── */}
            {profileTab === 'testy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Testy sprawnościowe — wyniki i daty pomiarów</div>

                {/* Skok w dal */}
                <div style={{ border: `1.5px solid ${C.grayLight}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: C.navy, padding: '0.5rem 0.875rem', fontFamily: mono, fontSize: '0.65rem', color: C.gold, fontWeight: 700 }}>📏 Skok w dal (cm)</div>
                  <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Obunóż', val: longJumpBoth, setVal: setLongJumpBoth, date: longJumpBothDate, setDate: setLongJumpBothDate },
                      { label: 'Jednonóż — lewa', val: longJumpLeftDist, setVal: setLongJumpLeftDist, date: longJumpLeftDate, setDate: setLongJumpLeftDate },
                      { label: 'Jednonóż — prawa', val: longJumpRightDist, setVal: setLongJumpRightDist, date: longJumpRightDate, setDate: setLongJumpRightDate },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '140px 100px 140px', gap: 8, alignItems: 'center' }}>
                        <label style={{ fontFamily: mono, fontSize: '0.68rem', color: C.navy, fontWeight: 700 }}>{row.label}</label>
                        <input type="number" value={row.val} onChange={e => row.setVal(e.target.value)} placeholder="cm" style={{ ...inp, minHeight: 32 }} />
                        <input type="date" value={row.date} onChange={e => row.setDate(e.target.value)} style={{ ...inp, minHeight: 32, fontSize: '0.78rem' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chin-up */}
                <div style={{ border: `1.5px solid ${C.grayLight}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: C.navy, padding: '0.5rem 0.875rem', fontFamily: mono, fontSize: '0.65rem', color: C.gold, fontWeight: 700 }}>⏱️ Chin-up (czas w sekundach)</div>
                  <div style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: '140px 100px 140px', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontFamily: mono, fontSize: '0.68rem', color: C.navy, fontWeight: 700 }}>Wynik</label>
                    <input type="number" value={chinupSec} onChange={e => setChinupSec(e.target.value)} placeholder="sek." style={{ ...inp, minHeight: 32 }} />
                    <input type="date" value={chinupDate} onChange={e => setChinupDate(e.target.value)} style={{ ...inp, minHeight: 32, fontSize: '0.78rem' }} />
                  </div>
                </div>

                {/* Pompki */}
                <div style={{ border: `1.5px solid ${C.grayLight}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: C.navy, padding: '0.5rem 0.875rem', fontFamily: mono, fontSize: '0.65rem', color: C.gold, fontWeight: 700 }}>💪 Pompki (ilość)</div>
                  <div style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: '140px 100px 140px', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontFamily: mono, fontSize: '0.68rem', color: C.navy, fontWeight: 700 }}>Wynik</label>
                    <input type="number" value={pushupsCount} onChange={e => setPushupsCount(e.target.value)} placeholder="szt." style={{ ...inp, minHeight: 32 }} />
                    <input type="date" value={pushupsDate} onChange={e => setPushupsDate(e.target.value)} style={{ ...inp, minHeight: 32, fontSize: '0.78rem' }} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Trening motoryczny ── */}
            {profileTab === 'motoryczny' && (
              <div>
                {motorLoading && (
                  <div style={{ textAlign: 'center', padding: '2rem', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Ładowanie danych...</div>
                )}
                {motorLoaded && motorData.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak ćwiczeń w planach grupy.</div>
                )}
                {motorLoaded && motorData.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                      {motorData.length} ćwiczeń ze wszystkich planów grupy · posortowane alfabetycznie
                    </div>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr style={{ background: C.navy }}>
                          {['Ćwiczenie', 'Serie', 'Powt.', 'Ciężar', 'Tempo', 'Plan', 'Data treningu'].map(h => (
                            <th key={h} style={{ padding: '0.5rem 0.75rem', fontFamily: mono, fontSize: '0.58rem', color: C.gold, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: h === 'Ćwiczenie' || h === 'Plan' ? 'left' : 'center', whiteSpace: 'nowrap', borderBottom: `1.5px solid ${C.navyBorder}` }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {motorData.map((row: any, i: number) => {
                          const rowBg = i % 2 === 0 ? C.white : '#FAFBFC'
                          return (
                            <tr key={i} style={{ background: rowBg }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.grayLight}`, fontSize: '0.86rem' }}>{row.name}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.75rem', fontWeight: 800, color: C.navy }}>{row.sets || '—'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.75rem', color: C.navy }}>{row.reps || '—'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.75rem', color: C.navy }}>{row.weight ? `${row.weight} kg` : '—'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.75rem', color: C.gray }}>{row.tempo || '—'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>{row.planName}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>{row.date ? new Date(row.date).toLocaleDateString('pl-PL') : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} style={{ padding: '0.55rem 0.875rem', borderRadius: 8, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, fontWeight: 700, cursor: 'pointer' }}>Zamknij</button>
              {profileTab !== 'motoryczny' && (
                <button onClick={handleSave} disabled={saving || !fullName.trim()} style={{ padding: '0.55rem 1rem', borderRadius: 8, border: 'none', background: saved ? C.green : C.navy, color: saved ? C.white : C.gold, fontWeight: 800, cursor: 'pointer', minWidth: 90 }}>
                  {saving ? 'Zapisuję...' : saved ? '✓ Zapisano' : 'Zapisz'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── StatsCard — reusable styled stats table ────────────────────────────────

type StatCell = { v: string | number | null; color?: string }
type StatRow = { id: number; name: string; cells: StatCell[] }
type ColDef = { key: string; left?: boolean; emoji?: string }

function StatsCard({ title, period, onPeriodChange, cols, rows, onAthleteClick, style }: {
  title: string; period: number; onPeriodChange: (v: number) => void
  cols: ColDef[]; rows: StatRow[]; onAthleteClick: (id: number) => void
  style?: React.CSSProperties
}) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(13,27,42,0.06)', ...style }}>
      {/* header */}
      <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: C.offWhite }}>
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: C.navy }}>
              {cols.map((col, i) => (
                <th key={col.key} style={{
                  padding: i === 0 ? '0.65rem 1rem' : '0.65rem 0.75rem',
                  textAlign: col.left ? 'left' : 'center',
                  fontFamily: mono, fontSize: '0.58rem', color: C.gold,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  borderBottom: `1.5px solid ${C.navyBorder}`,
                  whiteSpace: 'nowrap', fontWeight: 700,
                }}>
                  {col.emoji && <span style={{ marginRight: 4 }}>{col.emoji}</span>}{col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const rowBg = ri % 2 === 0 ? C.white : '#FAFBFC'
              return (
                <tr key={row.id} style={{ background: rowBg, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                  <td style={{ padding: '0.65rem 1rem', borderBottom: `1px solid ${C.grayLight}` }}>
                    <button onClick={() => onAthleteClick(row.id)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.88rem', textAlign: 'left' }}>
                      {row.name}
                    </button>
                  </td>
                  {row.cells.map((cell, ci) => (
                    <td key={ci} style={{ padding: '0.55rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}` }}>
                      {cell.v === null || cell.v === undefined
                        ? <span style={{ color: C.grayLight, fontFamily: mono, fontSize: '0.7rem' }}>—</span>
                        : <span style={{
                            display: 'inline-block',
                            background: cell.color ? cell.color + '1A' : C.offWhite,
                            color: cell.color ?? C.navy,
                            borderRadius: 6, padding: '2px 8px',
                            fontFamily: mono, fontSize: '0.75rem', fontWeight: 800,
                          }}>{cell.v}</span>
                      }
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const PERIODS = [
  { label: '7 dni', days: 7 },
  { label: '14 dni', days: 14 },
  { label: '30 dni', days: 30 },
]

function PeriodSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
      {PERIODS.map(p => (
        <button key={p.days} onClick={() => onChange(p.days)} style={{
          padding: '0.35rem 0.75rem', border: 'none', cursor: 'pointer',
          background: value === p.days ? C.navy : 'transparent',
          color: value === p.days ? C.gold : C.gray,
          fontFamily: mono, fontSize: '0.65rem', fontWeight: value === p.days ? 800 : 600,
          transition: 'all 0.15s',
        }}>{p.label}</button>
      ))}
    </div>
  )
}

// Value badge — colored pill
function Val({ v, color, suffix = '' }: { v: string | number | null; color?: string; suffix?: string }) {
  if (v === null || v === undefined || v === '—') {
    return <span style={{ color: C.grayLight, fontFamily: mono, fontSize: '0.72rem' }}>—</span>
  }
  const c = color ?? C.navy
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: c + '18', borderRadius: 6, padding: '2px 7px' }}>
      <span style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 800, color: c }}>{v}{suffix}</span>
    </div>
  )
}

function filterByDays(logs: any[], days: number, dateField = 'date') {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return logs.filter((l: any) => {
    const d = l[dateField] ? String(l[dateField]).slice(0, 10) : String(l.created_at).slice(0, 10)
    return d >= cutoffStr
  })
}

// ── PlanExerciseTable ─────────────────────────────────────────────────────────

type ActualSet = { num: number; weight: number | null; reps: number | null }
type ActualEntry = { sets: ActualSet[] }

function PlanExerciseTable({ rows, athletes, overrides, actual, uniqueDays }: {
  rows: { exId: number; name: string; block: string; day: string; dayId: number; sets: number; reps: string; tempo: string; weight: number | null }[]
  athletes: any[]
  overrides: Record<number, Record<number, any>>
  actual: Record<number, Record<number, ActualEntry>>
  uniqueDays: { id: number; label: string }[]
}) {
  const [selDayId, setSelDayId] = useState(uniqueDays[0]?.id ?? 0)
  const filtered = rows.filter(r => r.dayId === selDayId)

  function effectiveWeight(exId: number, athleteId: number, planWeight: number | null) {
    const o = overrides[exId]?.[athleteId]
    if (!o || o.skip) return planWeight
    return o.weight_override ?? planWeight
  }
  function effectiveSets(exId: number, athleteId: number, planSets: number) {
    const o = overrides[exId]?.[athleteId]
    if (!o || o.skip) return planSets
    return o.sets_override ?? planSets
  }
  function effectiveReps(exId: number, athleteId: number, planReps: string) {
    const o = overrides[exId]?.[athleteId]
    if (!o || o.skip) return planReps
    return o.reps_override ?? planReps
  }
  function effectiveTempo(exId: number, athleteId: number, planTempo: string) {
    const o = overrides[exId]?.[athleteId]
    if (!o || o.skip) return planTempo
    return o.tempo_override ?? planTempo
  }
  function isSkipped(exId: number, athleteId: number) {
    return overrides[exId]?.[athleteId]?.skip === true
  }
  function hasOverride(exId: number, athleteId: number) {
    const o = overrides[exId]?.[athleteId]
    return !!o && !o.skip
  }

  return (
    <div>
      {/* Day tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1.5px solid ${C.grayLight}`, background: C.offWhite }}>
        {uniqueDays.map(d => (
          <button key={d.id} onClick={() => setSelDayId(d.id)}
            style={{ flexShrink: 0, padding: '0.55rem 1rem', border: 'none', background: selDayId === d.id ? C.white : 'transparent', color: selDayId === d.id ? C.navy : C.gray, fontWeight: selDayId === d.id ? 800 : 500, fontFamily: mono, fontSize: '0.68rem', borderBottom: selDayId === d.id ? `2px solid ${C.gold}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {d.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak ćwiczeń w tym treningu.</div>
      )}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr style={{ background: C.navy }}>
                {/* sticky first col: athlete name */}
                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontFamily: mono, fontSize: '0.58rem', color: C.gold, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid ${C.navyBorder}`, position: 'sticky', left: 0, zIndex: 2, background: C.navy }}>Zawodniczka</th>
                {filtered.map((row, ci) => (
                  <th key={`${row.exId}-${ci}`} style={{ padding: '0.5rem 0.65rem', textAlign: 'center', fontFamily: mono, fontSize: '0.56rem', color: C.gold, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid ${C.navyBorder}`, minWidth: 100, verticalAlign: 'bottom' }}>
                    <div style={{ color: C.white, fontWeight: 700, marginBottom: 2 }}>{row.name}</div>
                    <div style={{ color: C.gray, fontSize: '0.52rem' }}>{row.block}</div>
                    <div style={{ color: C.gray, fontSize: '0.52rem' }}>{row.sets}×{row.reps || '—'}{row.weight !== null ? ` · ${row.weight}kg` : ''}{row.tempo ? ` · ${row.tempo}` : ''}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {athletes.map((a: any, ri: number) => {
                const rowBg = ri % 2 === 0 ? C.white : '#FAFBFC'
                return (
                  <tr key={a.id} style={{ background: rowBg }}>
                    <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.grayLight}`, fontSize: '0.88rem', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: rowBg }}>
                      {a.full_name}
                    </td>
                    {filtered.map((row, ci) => {
                      const skip = isSkipped(row.exId, a.id)
                      const mod = hasOverride(row.exId, a.id)
                      const planW = effectiveWeight(row.exId, a.id, row.weight)
                      const planS = effectiveSets(row.exId, a.id, row.sets)
                      const planR = effectiveReps(row.exId, a.id, row.reps)
                      const planT = effectiveTempo(row.exId, a.id, row.tempo)
                      const act = actual[row.exId]?.[a.id] ?? null
                      const hasAct = act !== null && act.sets.length > 0

                      // Kolory tła: priorytet: pominięte > faktyczne > modyfikacja > brak
                      const bgColor = skip ? '#FEF2F2' : hasAct ? '#F0FDF4' : mod ? '#1A2E4520' : undefined

                      return (
                        <td key={`${row.exId}-${ci}`} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, verticalAlign: 'middle', background: bgColor }}>
                          {skip ? (
                            // CZERWONY — pominięte przez trenera
                            <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.red, fontWeight: 700 }}>pominięte</span>
                          ) : hasAct ? (
                            // ZIELONY — faktyczne dane z set_logs
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              {act.sets.map((s, si) => (
                                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontFamily: mono, fontSize: '0.55rem', color: '#16A34A', minWidth: 14 }}>S{s.num}</span>
                                  <span style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 800, color: '#16A34A' }}>
                                    {s.weight !== null ? `${s.weight} kg` : '—'}
                                  </span>
                                  {s.reps !== null && (
                                    <span style={{ fontFamily: mono, fontSize: '0.55rem', color: '#4ADE80' }}>{s.reps}p</span>
                                  )}
                                </div>
                              ))}
                              {mod && (
                                <span style={{ fontFamily: mono, fontSize: '0.5rem', color: C.gold, marginTop: 1 }}>✎ mod.</span>
                              )}
                            </div>
                          ) : mod ? (
                            // ZŁOTY — modyfikacja trenera, brak danych treningowych
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              {planW !== null && (
                                <span style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 800, color: C.gold }}>{planW} kg</span>
                              )}
                              <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gold }}>
                                {planS}×{planR || '—'}{planT ? ` ${planT}` : ''}
                              </span>
                              <span style={{ fontFamily: mono, fontSize: '0.5rem', color: C.gold }}>✎ mod.</span>
                            </div>
                          ) : (
                            // SZARY — plan bazowy, brak danych
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              {planW !== null ? (
                                <span style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 700, color: C.gray }}>{planW} kg</span>
                              ) : (
                                <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.grayLight }}>—</span>
                              )}
                              <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.grayLight, whiteSpace: 'nowrap' }}>
                                {planS}×{planR || '—'}{planT ? ` ${planT}` : ''}
                              </span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ padding: '0.6rem 1rem', borderTop: `1.5px solid ${C.grayLight}`, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#16A34A' }} />
          <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>Faktyczne (z treningu)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: C.gold }} />
          <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>Zmodyfikowane przez trenera</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: C.red + '55', border: `1px solid ${C.red}` }} />
          <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>Pominięte</span>
        </div>
      </div>
    </div>
  )
}

export default function CoachGroupDetailClient({ group, athletes, assignments, days, sessions, plans, wellnessLogs = [], wellnessWeek = [], feedbacks = [], dietLogs = [], assignmentsHistory = [], archivedPlans = [] }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignedMsg, setAssignedMsg] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('trening')
  const [moduleConfig, setModuleConfig] = useState<'wellness' | 'diet' | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [wellnessPeriod, setWellnessPeriod] = useState(14)
  const [dietPeriod, setDietPeriod] = useState(14)
  const [trainingPeriod, setTrainingPeriod] = useState(30)
  const [localAthletes, setLocalAthletes] = useState<any[]>(athletes)
  const [quickReportAthlete, setQuickReportAthlete] = useState<any | null>(null)
  const [sessionReport, setSessionReport] = useState<{ session: any; athleteId: number; athleteName: string; dayName: string } | null>(null)
  const [planExData, setPlanExData] = useState<{ blocks: any[]; overrides: Record<number, Record<number, any>>; actual: Record<number, Record<number, ActualEntry>> } | null>(null)
  const [planExLoading, setPlanExLoading] = useState(false)

  function openQuickReport(athleteId: number) {
    const found = athletes.find((a: any) => a.id === athleteId)
    if (found) setQuickReportAthlete(found)
  }

  const feedbackBySessionId: Record<number, any> = {}
  for (const f of feedbacks) {
    const sid = f.workout_session_id || f.session_id
    if (sid) feedbackBySessionId[sid] = f
  }

  function openSessionReport(session: any, athleteId: number, athleteName: string, dayName: string) {
    setSessionReport({ session, athleteId, athleteName, dayName })
  }

  async function loadPlanExercises() {
    if (planExData || planExLoading || !activePlanId) return
    setPlanExLoading(true)
    const sb = createClient()
    const planDayIds = activePlanDays.map((d: any) => d.id)
    const athleteIds2 = athletes.map((a: any) => a.id)

    // Bloki + ćwiczenia z planu
    const { data: blocks } = await sb
      .from('workout_day_blocks')
      .select('id, day_id, block_name, block_order, rounds, workout_block_exercises(id, exercise_id, exercise_code, exercise_order, sets, reps, weight_kg, tempo, rir, coach_comment, exercise:exercises(name))')
      .in('day_id', planDayIds)
      .order('block_order')

    const allExIds = (blocks || []).flatMap((b: any) => (b.workout_block_exercises || []).map((e: any) => e.id))

    // Indywidualne modyfikacje (override planu przez trenera)
    const { data: ovrs } = allExIds.length > 0
      ? await sb.from('athlete_exercise_overrides')
          .select('athlete_id, block_exercise_id, weight_override, sets_override, reps_override, tempo_override, skip')
          .in('block_exercise_id', allExIds)
          .in('athlete_id', athleteIds2)
      : { data: [] }

    const ovrMap: Record<number, Record<number, any>> = {}
    for (const o of (ovrs || [])) {
      if (!ovrMap[o.block_exercise_id]) ovrMap[o.block_exercise_id] = {}
      ovrMap[o.block_exercise_id][o.athlete_id] = o
    }

    // Faktyczne dane treningowe z set_logs (sesje dla tych dni i zawodniczek)
    const { data: sessionsForPlan } = await sb
      .from('workout_sessions')
      .select('id, athlete_id, workout_day_id')
      .in('workout_day_id', planDayIds)
      .in('athlete_id', athleteIds2)
      .eq('completed', true)

    const sessionIds = (sessionsForPlan || []).map((s: any) => s.id)

    // Mapa: session_id → athlete_id
    const sessionAthleteMap: Record<number, number> = {}
    for (const s of (sessionsForPlan || [])) sessionAthleteMap[s.id] = s.athlete_id

    // set_logs dla tych sesji — zbieramy wszystkie serie per zawodniczka per ćwiczenie
    type _ActualSet = { num: number; weight: number | null; reps: number | null }
    type _ActualEntry = { sets: _ActualSet[] }
    const actualMap: Record<number, Record<number, _ActualEntry>> = {}

    if (sessionIds.length > 0 && allExIds.length > 0) {
      const { data: logs } = await sb
        .from('set_logs')
        .select('workout_session_id, block_exercise_id, set_number, weight, reps_completed, completed, is_warmup')
        .in('workout_session_id', sessionIds)
        .in('block_exercise_id', allExIds)
        .eq('is_warmup', false)
        .order('set_number', { ascending: true })

      for (const l of (logs || [])) {
        const athleteId = sessionAthleteMap[l.workout_session_id]
        if (!athleteId) continue
        if (!actualMap[l.block_exercise_id]) actualMap[l.block_exercise_id] = {}
        if (!actualMap[l.block_exercise_id][athleteId]) actualMap[l.block_exercise_id][athleteId] = { sets: [] }
        actualMap[l.block_exercise_id][athleteId].sets.push({
          num: l.set_number,
          weight: l.weight ?? null,
          reps: l.reps_completed ?? null,
        })
      }
    }

    setPlanExData({ blocks: blocks || [], overrides: ovrMap, actual: actualMap })
    setPlanExLoading(false)
  }

  const sessionIndex: Record<string, any> = {}
  for (const s of sessions) {
    const key = `${s.athlete_id}_${s.workout_day_id}`
    if (!sessionIndex[key] || new Date(s.created_at) > new Date(sessionIndex[key].created_at)) sessionIndex[key] = s
  }

  const currentPlan = assignments[0]?.plan
  const activePlanId = selectedPlanId ?? currentPlan?.id ?? null
  const activePlanDays = activePlanId
    ? days.filter((d: any) => d.week?.plan_id === activePlanId)
    : days

  function getAthleteProgress(athleteId: number) {
    if (activePlanDays.length === 0) return null
    const done = activePlanDays.filter((d: any) => sessionIndex[`${athleteId}_${d.id}`]?.completed).length
    return { done, total: activePlanDays.length }
  }

  // Archive plan
  async function archivePlan(planId: number) {
    if (!confirm('Zarchiwizować ten plan? Nie będzie można go edytować. Zawodniczki zachowają dostęp do historii.')) return
    await supabase.from('workout_plans').update({ is_archived: true }).eq('id', planId)
    router.refresh()
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} body{background:${C.offWhite};} button{cursor:pointer;font-family:inherit;} ::-webkit-scrollbar{height:4px;} ::-webkit-scrollbar-thumb{background:#ccc;}`}</style>

      {showAssignModal && (
        <AssignPlanModal
          athletes={athletes} plans={plans}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { setAssignedMsg('Plan przypisany!'); router.refresh() }}
        />
      )}
      {moduleConfig && (
        <ModuleConfigPanel
          groupId={group.id}
          module={moduleConfig}
          onClose={() => setModuleConfig(null)}
        />
      )}
      {sessionReport && (
        <SessionReportModal
          session={sessionReport.session}
          athleteId={sessionReport.athleteId}
          athleteName={sessionReport.athleteName}
          dayName={sessionReport.dayName}
          onClose={() => setSessionReport(null)}
        />
      )}
      {quickReportAthlete && (
        <AthleteQuickReportModal
          athlete={quickReportAthlete}
          wellnessLogs={wellnessLogs}
          dietLogs={dietLogs}
          onClose={() => setQuickReportAthlete(null)}
          onGoToProfile={() => { setQuickReportAthlete(null); router.push(`/coach/athletes/${quickReportAthlete.id}`) }}
        />
      )}

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.push('/coach')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>← Panel</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Grupa · {athletes.length} zawodniczek</div>
                <h1 style={{ color: C.white, fontSize: '1.25rem', fontWeight: 800 }}>{group.name}</h1>
                <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, marginTop: 3 }}>
                  Trener motoryczny: <span style={{ color: C.white, fontWeight: 700 }}>{group.trainer_name || 'Urszula Papka'}</span>
                  {currentPlan && <span style={{ marginLeft: 12, color: C.gold }}>📋 {currentPlan.name}</span>}
                  {assignedMsg && <span style={{ marginLeft: 12, color: C.green }}>✓ {assignedMsg}</span>}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab navigation */}
        <div style={{ background: C.navyLight, borderBottom: `1.5px solid ${C.navyBorder}` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 0 }}>
            {([
              { id: 'trening',  label: '🏋️ Trening' },
              { id: 'wellness', label: '🩺 Wellness' },
              { id: 'diet',     label: '🥗 Dieta' },
              { id: 'athletes', label: '👤 Zawodniczki' },
            ] as { id: Tab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '0.7rem 1.1rem', border: 'none', background: 'transparent', color: activeTab === t.id ? C.gold : C.gray, fontWeight: activeTab === t.id ? 800 : 600, fontFamily: mono, fontSize: '0.72rem', borderBottom: activeTab === t.id ? `2px solid ${C.gold}` : '2px solid transparent', cursor: 'pointer', letterSpacing: '0.04em' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {/* ── Wellness tab ── */}
          {/* ══ WELLNESS TAB ══════════════════════════════════════════════════════ */}
          {activeTab === 'wellness' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Config + individual overrides */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Konfiguracja parametrów</div>
                  <button onClick={() => setModuleConfig('wellness')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                    🩺 Edytuj dla grupy
                  </button>
                </div>
                {athletes.map((athlete: any, i: number) => {
                  const ws = getAthleteWellnessSummary(athlete.id, wellnessWeek)
                  return (
                    <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1, fontWeight: 700, color: C.navy, fontSize: '0.9rem' }}>{athlete.full_name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: ws.hasToday ? C.green : ws.entryCount > 0 ? C.gold : C.red }}>{ws.hasToday ? '✅ dziś' : ws.entryCount > 0 ? `⚠️ ${ws.entryCount} wpisów` : '✗ brak'}</div>
                      <button onClick={() => router.push(`/coach/athletes/${athlete.id}?tab=wellness`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.35rem 0.65rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                        Konfiguruj →
                      </button>
                    </div>
                  )
                })}
              </Card>

              {/* ── Wellness stats table ── */}
              <StatsCard
                title="Statystyki wellness"
                period={wellnessPeriod}
                onPeriodChange={setWellnessPeriod}
                cols={[
                  { key: 'Zawodniczka', left: true },
                  { key: 'Wpisy', emoji: '📝' },
                  { key: 'Sen śr.', emoji: '🌙' },
                  { key: 'Energia', emoji: '⚡' },
                  { key: 'Stres', emoji: '🧠' },
                  { key: 'Gotowość', emoji: '💪' },
                  { key: 'Max ból', emoji: '🩹' },
                  { key: 'Akt. godz.', emoji: '🏃' },
                  { key: 'Cykl', emoji: '🌸' },
                ]}
                rows={athletes.map((athlete: any) => {
                  const logs = filterByDays(wellnessLogs.filter((l: any) => l.athlete_id === athlete.id), wellnessPeriod)
                  const sleepAvg = avg(logs.map((l: any) => l.sleep_hours).filter((v: any) => v != null))
                  const energyAvg = avg(logs.map((l: any) => l.energy).filter((v: any) => v != null))
                  const stressAvg = avg(logs.map((l: any) => l.stress).filter((v: any) => v != null))
                  const readinessAvg = avg(logs.map((l: any) => l.readiness).filter((v: any) => v != null))
                  const maxPain = logs.reduce((m: number | null, l: any) => {
                    const p = l.pain_data?.painDuring ?? null
                    return p === null ? m : m === null ? p : Math.max(m, p)
                  }, null as number | null)
                  const totalMin = logs.reduce((s: number, l: any) => s + (parseInt(l.activity_data?.duration || '0') || 0), 0)
                  const actH = totalMin > 0 ? (totalMin / 60).toFixed(1) : null
                  const latestCycle = logs.find((l: any) => l.cycle_phase)?.cycle_phase ?? null
                  const sc = (v: number | null, lo: number, hi: number) => v === null ? undefined : v < lo ? C.red : v < hi ? C.gold : C.green
                  const stressC = stressAvg === null ? undefined : stressAvg >= 8 ? C.red : stressAvg >= 5 ? C.gold : C.green

                  return {
                    id: athlete.id, name: athlete.full_name,
                    cells: [
                      { v: logs.length || null, color: logs.length === 0 ? C.red : C.green },
                      { v: sleepAvg !== null ? `${sleepAvg.toFixed(1)}h` : null, color: sc(sleepAvg, 5, 7) },
                      { v: energyAvg !== null ? energyAvg.toFixed(1) : null, color: sc(energyAvg, 4, 7) },
                      { v: stressAvg !== null ? stressAvg.toFixed(1) : null, color: stressC },
                      { v: readinessAvg !== null ? readinessAvg.toFixed(1) : null, color: sc(readinessAvg, 4, 7) },
                      { v: maxPain !== null ? maxPain : null, color: maxPain !== null ? (maxPain >= 6 ? C.red : maxPain >= 4 ? C.gold : C.green) : undefined },
                      { v: actH !== null ? `${actH}h` : null },
                      { v: latestCycle === 'menstruacja' ? '🔴 mens.' : latestCycle ? latestCycle.slice(0, 7) : null, color: latestCycle === 'menstruacja' ? C.red : C.gray },
                    ],
                  }
                })}
                onAthleteClick={openQuickReport}
              />
            </div>
          )}

          {/* ══ DIET TAB ══════════════════════════════════════════════════════════ */}
          {activeTab === 'diet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Config */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Konfiguracja parametrów</div>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.navy, fontWeight: 700 }}>Indywidualne ustawienia zawodniczek</div>
                  </div>
                  <button onClick={() => setModuleConfig('diet')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                    🥗 Edytuj dla grupy
                  </button>
                </div>
                {athletes.map((athlete: any, i: number) => {
                  const myDiet = filterByDays(dietLogs.filter((d: any) => d.athlete_id === athlete.id), 30)
                  return (
                    <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1, fontWeight: 700, color: C.navy, fontSize: '0.9rem' }}>{athlete.full_name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: myDiet.length === 0 ? C.gray : C.green }}>{myDiet.length} wpisów / 30 dni</div>
                      <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.35rem 0.65rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                        Konfiguruj →
                      </button>
                    </div>
                  )
                })}
              </Card>

              {/* ── Diet stats table ── */}
              <StatsCard
                title="Statystyki diety"
                period={dietPeriod}
                onPeriodChange={setDietPeriod}
                cols={[
                  { key: 'Zawodniczka', left: true },
                  { key: 'Wpisy', emoji: '📝' },
                  { key: 'Śniadanie', emoji: '🌅' },
                  { key: 'Posiłki śr.', emoji: '🍽️' },
                  { key: 'Woda ml', emoji: '💧' },
                  { key: 'Kawa śr.', emoji: '☕' },
                  { key: 'Głód śr.', emoji: '🔢' },
                ]}
                rows={athletes.map((athlete: any) => {
                  const logs = filterByDays(dietLogs.filter((d: any) => d.athlete_id === athlete.id), dietPeriod)
                  const breakfastPct = logs.length ? Math.round((logs.filter((d: any) => d.had_breakfast).length / logs.length) * 100) : null
                  const mealAvg = avg(logs.map((d: any) => d.meal_count).filter((v: any) => v > 0))
                  const waterAvg = avg(logs.map((d: any) => d.water_ml).filter((v: any) => v != null && v > 0))
                  const coffeeAvg = avg(logs.map((d: any) => d.coffee_count).filter((v: any) => v != null))
                  const hungerAvg = avg(logs.map((d: any) => d.hunger_level).filter((v: any) => v != null))
                  return {
                    id: athlete.id, name: athlete.full_name,
                    cells: [
                      { v: logs.length || null, color: logs.length === 0 ? C.red : C.green },
                      { v: breakfastPct !== null ? `${breakfastPct}%` : null, color: breakfastPct === null ? undefined : breakfastPct >= 80 ? C.green : breakfastPct >= 50 ? C.gold : C.red },
                      { v: mealAvg !== null ? mealAvg.toFixed(1) : null },
                      { v: waterAvg !== null ? Math.round(waterAvg) : null, color: waterAvg === null ? undefined : waterAvg >= 2000 ? C.green : waterAvg >= 1500 ? C.gold : C.red },
                      { v: coffeeAvg !== null ? coffeeAvg.toFixed(1) : null },
                      { v: hungerAvg !== null ? hungerAvg.toFixed(1) : null },
                    ],
                  }
                })}
                onAthleteClick={openQuickReport}
              />
            </div>
          )}

          {/* ══ ATHLETES TAB ══════════════════════════════════════════════════════ */}
          {activeTab === 'athletes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: C.navy }}>Zawodniczki grupy</div>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 2 }}>Kliknij zawodniczkę aby rozwinąć i edytować profil</div>
                </div>
                <button onClick={() => router.push('/coach/athletes/new')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.6rem 0.9rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                  + Dodaj zawodniczkę
                </button>
              </div>

              {localAthletes.length === 0 && (
                <Card><div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak zawodniczek w grupie.</div></Card>
              )}

              {localAthletes.map(athlete => (
                <AthleteEditCard
                  key={athlete.id}
                  athlete={athlete}
                  groupId={group.id}
                  onSaved={updated => setLocalAthletes(prev => prev.map(a => a.id === updated.id ? updated : a))}
                />
              ))}
            </div>
          )}

          {/* ══ TRENING TAB ═══════════════════════════════════════════════════════ */}
          {activeTab === 'trening' && athletes.length === 0 && (
            <Card><div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak zawodniczek w tej grupie.</div></Card>
          )}
          {activeTab === 'trening' && athletes.length > 0 && (
            <>
              {/* ── Akcje planu ── */}
              <Card style={{ marginBottom: '1.25rem' }}>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Aktualny plan</div>
                    <div style={{ fontWeight: 800, color: C.navy, fontSize: '0.95rem' }}>{currentPlan?.name ?? '— brak przypisanego planu —'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {assignments.length > 1 && (
                      <select value={selectedPlanId ?? ''} onChange={e => setSelectedPlanId(e.target.value ? parseInt(e.target.value) : null)}
                        style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 8, padding: '0.45rem 0.65rem', fontFamily: mono, fontSize: '0.7rem', outline: 'none' }}>
                        <option value="">Aktualny</option>
                        {assignments.map((a: any, i: number) => <option key={`${a.plan_id}-${i}`} value={a.plan_id}>{a.plan?.name}</option>)}
                      </select>
                    )}
                    {currentPlan && !currentPlan.is_archived && (
                      <button onClick={() => router.push(`/coach/plans/${currentPlan.id}`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 8, padding: '0.45rem 0.75rem', fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                        ✏️ Edytuj plan
                      </button>
                    )}
                    {currentPlan && !currentPlan.is_archived && (
                      <button onClick={() => archivePlan(currentPlan.id)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, borderRadius: 8, padding: '0.45rem 0.75rem', fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                        📦 Archiwizuj
                      </button>
                    )}
                    <button onClick={() => setShowAssignModal(true)} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                      + Przypisz plan
                    </button>
                  </div>
                </div>
              </Card>

              {assignments.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Realizacja planu</div>
                    <div style={{ fontWeight: 800, color: C.navy }}>{currentPlan?.name} · {activePlanDays.length} treningów</div>
                  </div>
                  {/* ── TABELA 1: Realizacja planu (treningi) ── */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                      <thead>
                        <tr style={{ background: C.navy }}>
                          <th style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase', position: 'sticky', left: 0, zIndex: 2, background: C.navy, borderBottom: `1.5px solid ${C.navyBorder}`, whiteSpace: 'nowrap' }}>Zawodniczka</th>
                          <th style={{ ...thStyle, background: C.navy, color: C.gold, borderBottom: `1.5px solid ${C.navyBorder}` }}>Postęp</th>
                          {activePlanDays.map((day: any, i: number) => (
                            <th key={day.id} style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gold, background: C.navy, borderBottom: `1.5px solid ${C.navyBorder}`, minWidth: 42 }}>
                              <div style={{ fontWeight: 800 }}>T{i + 1}</div>
                              <div style={{ fontSize: '0.52rem', marginTop: 2, color: C.gray }}>{(day.day_name || '').replace('Dzień ', '').replace('Trening ', '')}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, rowIdx: number) => {
                          const progress = getAthleteProgress(athlete.id)
                          const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0
                          const rowBg = rowIdx % 2 === 0 ? C.white : '#FAFBFC'
                          return (
                            <tr key={athlete.id} style={{ background: rowBg }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                              onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                              <td style={{ padding: '0.75rem 1.25rem', position: 'sticky', left: 0, zIndex: 1, background: 'inherit', borderBottom: `1px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>
                                <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}>{athlete.full_name}</button>
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}` }}>
                                {progress ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                    <div style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 800, color: pct === 100 ? C.green : C.navy }}>{pct}%</div>
                                    <div style={{ width: 44, height: 4, background: C.grayLight, borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : C.gold, borderRadius: 2 }} />
                                    </div>
                                    <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.gray }}>{progress.done}/{progress.total}</div>
                                  </div>
                                ) : <span style={{ color: C.grayLight, fontSize: '0.75rem' }}>—</span>}
                              </td>
                              {activePlanDays.map((day: any) => {
                                const sess = sessionIndex[`${athlete.id}_${day.id}`] || null
                                const clickable = sess?.completed
                                return (
                                  <td key={day.id} style={{ padding: '0.5rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}` }}>
                                    <div
                                      onClick={() => clickable && openSessionReport(sess, athlete.id, athlete.full_name, day.day_name || `Trening ${day.id}`)}
                                      title={clickable ? 'Kliknij aby zobaczyć raport' : undefined}
                                      style={{ display: 'flex', justifyContent: 'center', cursor: clickable ? 'pointer' : 'default' }}>
                                      <CellStatus session={sess} />
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '0.65rem 1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', borderTop: `1.5px solid ${C.grayLight}` }}>
                    {[
                      { symbol: '○', label: 'Niewykonany', bg: C.grayLight, color: C.gray },
                      { symbol: '✓', label: 'Wykonany', bg: C.green, color: C.white },
                      { symbol: '📋', label: 'Raport wysłany', bg: C.navy, color: C.white },
                      { symbol: '◑', label: 'W trakcie', bg: C.gold, color: C.navy },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem' }}>{item.symbol}</div>
                        <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── TABELA 1b: Obciążenia z planu ── */}
              {assignments.length > 0 && activePlanDays.length > 0 && (() => {
                const fmt = (s: string) => s.replace(/-/g, ' ')
                return (
                  <Card style={{ marginBottom: '1.25rem' }}>
                    <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Obciążenia z planu</div>
                        <div style={{ fontWeight: 800, color: C.navy, marginTop: 2 }}>{currentPlan?.name} — ćwiczenia × zawodniczki</div>
                      </div>
                      {!planExData && (
                        <button onClick={loadPlanExercises} disabled={planExLoading}
                          style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.5rem 0.9rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', opacity: planExLoading ? 0.6 : 1 }}>
                          {planExLoading ? 'Ładuję...' : '⚡ Załaduj tabelę'}
                        </button>
                      )}
                    </div>
                    {planExData && (() => {
                      // Flatten exercises with day/block context, deduplicate by name for display
                      type ExRow = { exId: number; name: string; block: string; day: string; dayId: number; sets: number; reps: string; tempo: string; weight: number | null }
                      const rows: ExRow[] = []
                      for (const day of activePlanDays) {
                        const dayBlocks = planExData.blocks.filter((b: any) => b.day_id === day.id).sort((a: any, z: any) => a.block_order - z.block_order)
                        for (const block of dayBlocks) {
                          const exs = (block.workout_block_exercises || []).sort((a: any, z: any) => a.exercise_order - z.exercise_order)
                          for (const ex of exs) {
                            rows.push({
                              exId: ex.id,
                              name: ex.exercise?.name ? fmt(ex.exercise.name) : (ex.exercise_code || 'Ćwiczenie'),
                              block: block.block_name,
                              day: day.day_name || `T${activePlanDays.indexOf(day) + 1}`,
                              dayId: day.id,
                              sets: ex.sets ?? 0,
                              reps: ex.reps ?? '',
                              tempo: ex.tempo ?? '',
                              weight: ex.weight_kg ?? null,
                            })
                          }
                        }
                      }

                      if (rows.length === 0) return (
                        <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak ćwiczeń w planie.</div>
                      )

                      // Day tabs
                      const uniqueDays = activePlanDays.map((d: any, i: number) => ({ id: d.id, label: d.day_name || `T${i + 1}` }))
                      return <PlanExerciseTable rows={rows} athletes={athletes} overrides={planExData.overrides} actual={planExData.actual || {}} uniqueDays={uniqueDays} />
                    })()}
                  </Card>
                )
              })()}

              {/* ── TABELA 2: Dane wellness (7 dni) ── */}
              {athletes.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Wellness — przegląd tygodniowy</div>
                      <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.navy, fontWeight: 700, marginTop: 2 }}>Dane z ostatnich 7 dni</div>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                      <thead>
                        <tr style={{ background: '#0D2D1A' }}>
                          <th style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontFamily: mono, fontSize: '0.6rem', color: '#86EFAC', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid #1A4D2E` }}>Zawodniczka</th>
                          {[
                            { label: 'Wellness', title: 'Czy uzupełniła dziś' },
                            { label: '🌙 Sen śr.', title: 'Średnia snu (h)' },
                            { label: '🧠 Stres', title: 'Średni stres (1-10)' },
                            { label: '🩹 Max ból', title: 'Maks. ból podczas treningu' },
                            { label: '🏃 Aktywność', title: 'Łączne godziny aktywności' },
                            { label: '🌸 Cykl', title: 'Ostatnia zaznaczona faza' },
                          ].map(h => (
                            <th key={h.label} title={h.title} style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: '#86EFAC', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid #1A4D2E`, minWidth: 80 }}>
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, rowIdx: number) => {
                          const ws = getAthleteWellnessSummary(athlete.id, wellnessWeek)
                          const rowBg = rowIdx % 2 === 0 ? C.white : '#F7FFF9'

                          const sleepColor = ws.sleepAvg === null ? undefined : ws.sleepAvg <= 5 ? C.red : ws.sleepAvg <= 7 ? C.gold : C.green
                          const stressColor = ws.stressAvg === null ? undefined : ws.stressAvg >= 8 ? C.red : ws.stressAvg >= 5 ? C.gold : C.green
                          const painColor = ws.maxPain === null ? undefined : ws.maxPain >= 6 ? C.red : ws.maxPain >= 5 ? C.gold : C.green

                          const pill = (val: string | number | null, color?: string) => val !== null ? (
                            <span style={{ display: 'inline-block', background: (color ?? C.navy) + '1A', color: color ?? C.navy, borderRadius: 6, padding: '2px 8px', fontFamily: mono, fontSize: '0.75rem', fontWeight: 800 }}>{val}</span>
                          ) : <span style={{ color: C.grayLight, fontFamily: mono, fontSize: '0.7rem' }}>—</span>

                          return (
                            <tr key={athlete.id} style={{ background: rowBg }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#ECFDF5')}
                              onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                              <td style={{ padding: '0.7rem 1.25rem', fontWeight: 700, color: C.navy, borderBottom: `1px solid #E0F2EA`, whiteSpace: 'nowrap' }}>
                                <button onClick={() => openQuickReport(athlete.id)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}>{athlete.full_name}</button>
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                <span title={ws.hasToday ? 'Uzupełniła dziś' : ws.entryCount > 0 ? 'Wpis w tym tygodniu' : 'Brak wpisów'} style={{ fontSize: '1rem' }}>
                                  {ws.hasToday ? '✅' : ws.entryCount > 0 ? '⚠️' : '❌'}
                                </span>
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {pill(ws.sleepAvg !== null ? `${ws.sleepAvg.toFixed(1)}h` : null, sleepColor)}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {pill(ws.stressAvg !== null ? ws.stressAvg.toFixed(1) : null, stressColor)}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {pill(ws.maxPain !== null ? ws.maxPain : null, painColor)}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {pill(ws.activityHours !== null ? `${ws.activityHours}h` : null, C.navy)}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {ws.latestCycle === 'menstruacja'
                                  ? <span title="Menstruacja">🔴</span>
                                  : ws.latestCycle
                                    ? <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>{ws.latestCycle.slice(0, 7)}</span>
                                    : <span style={{ color: C.grayLight, fontFamily: mono, fontSize: '0.7rem' }}>—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Training stats */}
              <StatsCard
                title="Statystyki treningowe"
                period={trainingPeriod}
                onPeriodChange={setTrainingPeriod}
                cols={[
                  { key: 'Zawodniczka', left: true },
                  { key: 'Treningi', emoji: '🏋️' },
                  { key: 'Ukończone', emoji: '✅' },
                  { key: '% planu', emoji: '📊' },
                  { key: 'Śr. RPE', emoji: '🔥' },
                  { key: 'Min RPE', emoji: '↓' },
                  { key: 'Max RPE', emoji: '↑' },
                ]}
                rows={athletes.map((athlete: any) => {
                  const athFb = filterByDays(feedbacks.filter((f: any) => f.athlete_id === athlete.id), trainingPeriod, 'created_at')
                  const rpeVals = athFb.map((f: any) => f.session_rpe).filter((v: any) => v != null) as number[]
                  const rpeAvg = avg(rpeVals)
                  const completed = filterByDays(sessions.filter((s: any) => s.athlete_id === athlete.id && s.completed), trainingPeriod, 'date_completed').length
                  const progress = getAthleteProgress(athlete.id)
                  const pct = progress ? Math.round((progress.done / progress.total) * 100) : null
                  const rpeColor = rpeAvg === null ? undefined : rpeAvg >= 8 ? C.red : rpeAvg >= 6 ? C.gold : C.green
                  return {
                    id: athlete.id, name: athlete.full_name,
                    cells: [
                      { v: athFb.length || null },
                      { v: completed || null },
                      { v: pct !== null ? `${pct}%` : null, color: pct === null ? undefined : pct >= 80 ? C.green : pct >= 50 ? C.gold : C.red },
                      { v: rpeAvg !== null ? rpeAvg.toFixed(1) : null, color: rpeColor },
                      { v: rpeVals.length ? Math.min(...rpeVals) : null },
                      { v: rpeVals.length ? Math.max(...rpeVals) : null },
                    ],
                  }
                })}
                onAthleteClick={id => router.push(`/coach/athletes/${id}`)}
                style={{ marginBottom: '1.25rem' }}
              />

              {/* Historia przypisanych planów */}
              {assignmentsHistory.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Historia przypisanych planów</div>
                  </div>
                  {assignmentsHistory.map((a: any, i: number) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < assignmentsHistory.length - 1 ? `1px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: C.navy, fontSize: '0.88rem' }}>{a.plan?.name ?? '—'}</div>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, marginTop: 2 }}>
                          {new Date(a.created_at).toLocaleDateString('pl-PL')}
                          {a.is_active ? <span style={{ marginLeft: 8, color: C.green, fontWeight: 700 }}>● aktywny</span> : <span style={{ marginLeft: 8, color: C.gray }}>zakończony</span>}
                          {a.plan?.is_archived && <span style={{ marginLeft: 8, color: C.gray }}>📦 zarchiwizowany</span>}
                        </div>
                      </div>
                      {a.plan && !a.plan.is_archived && (
                        <button onClick={() => router.push(`/coach/plans/${a.plan_id}`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.3rem 0.6rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                          Edytuj →
                        </button>
                      )}
                    </div>
                  ))}
                </Card>
              )}

              {/* Archiwum planów */}
              {archivedPlans.length > 0 && (
                <Card>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>📦 Archiwum planów</div>
                  </div>
                  {archivedPlans.map((plan: any, i: number) => (
                    <div key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < archivedPlans.length - 1 ? `1px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: C.gray, fontSize: '0.88rem' }}>{plan.name}</div>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.grayLight, marginTop: 2 }}>
                          Utworzony {new Date(plan.created_at).toLocaleDateString('pl-PL')}
                        </div>
                      </div>
                      <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, background: C.offWhite, border: `1px solid ${C.grayLight}`, borderRadius: 6, padding: '2px 8px' }}>zarchiwizowany</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
