'use client'
// src/app/coach/groups/[id]/CoachGroupDetailClient.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModuleConfigPanel from '@/components/ModuleConfigPanel'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Modal, Field, Button, TabsNav, SegmentedControl, StatsTable } from '@/components/coach/ui'
import { dedupeLogs } from '@/lib/coach/dedupeLogs'

const thStyle: React.CSSProperties = { padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', background: 'var(--bg)', borderBottom: `1.5px solid var(--border)`, whiteSpace: 'nowrap', minWidth: 44 }
function tdWs(bg: string): React.CSSProperties { return { padding: '0.4rem 0.5rem', textAlign: 'center', borderBottom: `1.5px solid var(--border)`, background: bg, verticalAlign: 'middle' } }
function statTd(bg: string): React.CSSProperties { return { padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid var(--border)`, background: bg, fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy-900)' } }

function CellStatus({ session }: { session: any | null }) {
  if (!session) return <div className="coach-track-status coach-none">○</div>
  if (session.completed && session.report_sent) return <div title="Raport wysłany" className="coach-track-status coach-sent">📋</div>
  if (session.completed) return <div className="coach-track-status coach-done">✓</div>
  return <div className="coach-track-status coach-progress">◑</div>
}

function AssignPlanModal({ athletes, plans, groupId, onClose, onAssigned }: {
  athletes: any[]; plans: any[]; groupId: number
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
      // Dezaktywuj przypisania indywidualne dla wybranych zawodniczek
      await supabase.from('athlete_workout_assignments')
        .update({ is_active: false })
        .in('athlete_id', selectedAthletes)
        .eq('is_active', true)

      // Dezaktywuj przypisania grupowe (group_id) — żeby nie było duplikatów
      await supabase.from('athlete_workout_assignments')
        .update({ is_active: false })
        .eq('group_id', groupId)
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
    <Modal
      open
      onClose={onClose}
      eyebrow="Przypisz plan"
      title="Wybierz plan dla zawodniczek"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleAssign} disabled={!selectedPlanId || selectedAthletes.length === 0 || saving}>
            {saving ? 'Przypisuję...' : `Przypisz plan (${selectedAthletes.length})`}
          </Button>
        </>
      }
    >
      <Field label="Plan treningowy">
        <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}>
          <option value="">Wybierz plan...</option>
          {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'block', fontSize: 10.5, letterSpacing: '.04em', color: 'var(--muted-light)', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
          Tryb realizacji
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[{ v: 'sequential', label: 'Sekwencyjny', desc: 'Treningi po kolei' }, { v: 'dated', label: 'Datowany', desc: 'Wg daty' }].map(opt => (
            <button key={opt.v} onClick={() => setOrderMode(opt.v as 'sequential' | 'dated')}
              style={{ padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${orderMode === opt.v ? 'var(--gold)' : 'var(--border)'}`, background: orderMode === opt.v ? 'var(--navy-900)' : 'var(--bg)', color: orderMode === opt.v ? 'var(--gold)' : 'var(--navy-900)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted-light)', marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 10.5, letterSpacing: '.04em', color: 'var(--muted-light)', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700, textTransform: 'uppercase' }}>Zawodniczki</label>
          <button onClick={() => setSelectedAthletes(selectedAthletes.length === athletes.length ? [] : athletes.map(a => a.id))}
            style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
            {selectedAthletes.length === athletes.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '40vh', overflowY: 'auto' }}>
          {athletes.map(a => (
            <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.875rem', border: `1.5px solid ${selectedAthletes.includes(a.id) ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 10, background: selectedAthletes.includes(a.id) ? 'var(--navy-900)' : '#fff', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedAthletes.includes(a.id)} onChange={() => toggleAthlete(a.id)} style={{ accentColor: 'var(--gold)', width: 16, height: 16 }} />
              <span style={{ fontWeight: 600, color: selectedAthletes.includes(a.id) ? '#fff' : 'var(--ink)', fontSize: '0.9rem' }}>{a.full_name}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <div style={{ color: '#c23b3b', fontSize: 12.5, marginTop: 10 }}>❌ {error}</div>}
    </Modal>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid var(--border)` }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--muted-light)' }}>{label}</span>
      {isEmpty
        ? <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>
        : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.82rem', fontWeight: 800, color: color ?? 'var(--navy-900)' }}>{value}{unit}</span>
      }
    </div>
  )
}

function WBar({ label, value, max, inverse }: { label: string; value: number | null | undefined; max: number; inverse?: boolean }) {
  const isEmpty = value === null || value === undefined
  const pct = isEmpty ? 0 : Math.min(100, Math.max(0, (value! / max) * 100))
  const color = isEmpty ? 'var(--border)' : wScaleColor(value!, max, !!inverse)
  const comment = isEmpty ? null : (
    inverse
      ? (pct > 70 ? 'Wysoki' : pct > 40 ? 'Średni' : 'Niski')
      : (pct < 30 ? 'Niski' : pct < 60 ? 'Średni' : 'Wysoki')
  )
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--muted-light)' }}>{label}</span>
        {isEmpty
          ? <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>
          : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.82rem', fontWeight: 800, color }}>{value}/10</span>
        }
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
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
      try {
        const sb = createClient()
        // Data sesji w czasie lokalnym (UTC przesuwało wieczorne treningi na inny dzień)
        const sessionBase = session.date_completed ? new Date(session.date_completed) : new Date()
        const sessionDate = `${sessionBase.getFullYear()}-${String(sessionBase.getMonth() + 1).padStart(2, '0')}-${String(sessionBase.getDate()).padStart(2, '0')}`

        // Każde zapytanie niezależnie — błąd jednego nie blokuje reszty
        let fbData = null, logsData: any[] = [], blocksData: any[] = [], wellnessData = null

        try {
          const r = await sb.from('post_session_feedback').select('*').eq('workout_session_id', session.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          fbData = r.data || null
        } catch {}

        try {
          const r = await sb.from('set_logs').select('*').eq('workout_session_id', session.id).order('set_number', { ascending: true })
          logsData = r.data || []
        } catch {}

        if (session.workout_day_id) {
          try {
            const r = await sb.from('workout_day_blocks').select('*, workout_block_exercises(id, exercise_id, exercise_code, sets, reps, weight_kg, exercise:exercises(name))').eq('day_id', session.workout_day_id).order('block_order', { ascending: true })
            blocksData = r.data || []
          } catch {}
        }

        // 1) Gotowość wypełniona w trakcie treningu — powiązana z sesją
        try {
          const r = await sb.from('wellness_logs').select('*').eq('workout_session_id', session.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          wellnessData = r.data || null
        } catch {}

        // 2) Dzienny wpis wellness z datą sesji (strona wellness zapisuje pole date)
        if (!wellnessData) {
          try {
            const r = await sb.from('wellness_logs').select('*').eq('athlete_id', athleteId).eq('date', sessionDate).order('created_at', { ascending: false }).limit(1).maybeSingle()
            wellnessData = r.data || null
          } catch {}
        }

        // 3) Jakikolwiek wpis zawodniczki z tego samego dnia (po created_at)
        if (!wellnessData) {
          try {
            const dayStart = new Date(sessionBase); dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
            const r = await sb.from('wellness_logs').select('*').eq('athlete_id', athleteId).gte('created_at', dayStart.toISOString()).lt('created_at', dayEnd.toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()
            wellnessData = r.data || null
          } catch {}
        }

        setFeedback(fbData)
        setSetLogs(logsData)
        setBlocks(blocksData)
        setWellness(wellnessData)
      } catch (e) {
        console.error('SessionReportModal load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session.id, session.workout_day_id, athleteId])

  const dateStr = session.date_completed
    ? new Date(session.date_completed).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    : '—'

  const rpeC = (rpe: number) => rpe >= 9 ? '#EF4444' : rpe >= 7 ? '#F97316' : rpe >= 5 ? 'var(--gold)' : 'var(--green)'

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
  for (const l of dedupeLogs(setLogs)) {
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
    <Modal
      open
      onClose={onClose}
      eyebrow={session.completed ? 'Raport z treningu' : 'Podgląd treningu'}
      title={dayName}
      sub={`${athleteName} · ${dateStr}`}
      footer={<Button variant="dark" onClick={onClose} style={{ width: '100%' }}>Zamknij</Button>}
    >
      {!session.completed && (
        <div style={{ background: '#F97316', margin: '-10px -14px 10px', padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem' }}>◑</span>
          <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>TRENING W TOKU — dane na bieżąco, raport jeszcze nie wysłany</span>
        </div>
      )}

      <div>
        <div style={{ overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', color: 'var(--muted-light)' }}>Ładowanie danych...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

              {/* ── 1. WELLNESS PRZED TRENINGIEM ── */}
              <div style={{ background: '#fff', border: `1.5px solid var(--border)`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 1rem', background: '#0D2D1A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: '#86EFAC', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>🩺 Gotowość do treningu</span>
                  {!wellness && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: '#4ADE80', fontStyle: 'italic' }}>brak wpisu na ten dzień</span>}
                </div>
                <div style={{ padding: '0.75rem 1rem' }}>
                  {/* Pasek snu */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted-light)' }}>🌙 Sen — ilość godzin</span>
                      {wellness?.sleep_hours != null
                        ? <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.82rem', fontWeight: 800, color: wScaleColor(wellness.sleep_hours, 12, false) }}>{wellness.sleep_hours}h</span>
                        : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>}
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
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
                    const cStyle: Record<string, { color: string }> = { menstruacja: { color: '#EF4444' }, folikularna: { color: '#F59E0B' }, owulacja: { color: 'var(--green)' }, lutealna: { color: '#A78BFA' } }
                    const cs = cp ? (cStyle[cp] || { color: 'var(--muted-light)' }) : null
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid var(--border)` }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--muted-light)' }}>Faza cyklu</span>
                        {cp
                          ? <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.78rem', fontWeight: 800, color: cs?.color }}>{cp}{cd ? ` · dzień ${cd}` : ''}</span>
                          : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>}
                      </div>
                    )
                  })()}
                  {/* Aktywność */}
                  {wellness?.activity_data?.type ? (
                    <div style={{ marginTop: 8, padding: '0.6rem 0.75rem', background: 'var(--bg)', borderRadius: 8 }}>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Aktywność</div>
                      <div style={{ fontWeight: 700, color: 'var(--navy-900)', fontSize: '0.85rem' }}>{wellness.activity_data.type}</div>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', color: 'var(--muted-light)', marginTop: 2 }}>
                        {wellness.activity_data.time && `${wellness.activity_data.time} · `}
                        {wellness.activity_data.duration && `${wellness.activity_data.duration} min`}
                        {wellness.activity_data.rpe != null && ` · RPE ${wellness.activity_data.rpe}/10`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid var(--border)` }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted-light)' }}>Aktywność dnia</span>
                      <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>
                    </div>
                  )}
                  {/* Ból */}
                  {wellness?.pain_data?.painDuring > 0 && (
                    <div style={{ marginTop: 8, padding: '0.6rem 0.75rem', background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 8 }}>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: '#EF4444', textTransform: 'uppercase', marginBottom: 3 }}>Ból podczas treningu</div>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontWeight: 800, color: '#EF4444' }}>{wellness.pain_data.painDuring}/10</div>
                      {wellness.pain_data.location && <div style={{ fontSize: '0.78rem', color: 'var(--muted-light)', marginTop: 2 }}>📍 {wellness.pain_data.location}</div>}
                    </div>
                  )}
                  {/* Uwagi */}
                  {/* Suplementy */}
                  {wellness?.supplements_data?.counts && Object.values(wellness.supplements_data.counts).some((v: any) => v > 0) && (
                    <div style={{ marginTop: 8, padding: '0.6rem 0.75rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 8 }}>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: '#92400E', textTransform: 'uppercase', marginBottom: 4 }}>💊 Suplementy</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {Object.entries(wellness.supplements_data.counts)
                          .filter(([, v]: any) => v > 0)
                          .map(([id, count]: any) => (
                            <span key={id} style={{ padding: '2px 8px', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', color: '#92400E' }}>
                              {id.replace(/_/g, ' ')}: {count}×
                            </span>
                          ))}
                      </div>
                      {wellness.supplements_data.note && <div style={{ fontSize: '0.78rem', color: 'var(--muted-light)', marginTop: 4, fontStyle: 'italic' }}>{wellness.supplements_data.note}</div>}
                      {wellness.supplements_data.caffeineSources?.length > 0 && <div style={{ fontSize: '0.75rem', color: '#92400E', marginTop: 3 }}>Kofeina: {wellness.supplements_data.caffeineSources.join(', ')}</div>}
                    </div>
                  )}
                  {wellness?.concerns && (
                    <div style={{ marginTop: 8, padding: '0.6rem 0.75rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 8 }}>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: '#92400E', textTransform: 'uppercase', marginBottom: 3 }}>Uwagi dla trenera</div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--navy-900)', fontStyle: 'italic' }}>&ldquo;{wellness.concerns}&rdquo;</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 2. ĆWICZENIA ── */}
              <div style={{ background: '#fff', border: `1.5px solid var(--border)`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 1rem', background: 'var(--navy-900)', borderBottom: `1.5px solid var(--navy-600)`, fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                  🏋️ Ćwiczenia z treningu
                </div>
                {blocks.length === 0 && (
                  <div style={{ padding: '1rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', color: 'var(--muted-light)', textAlign: 'center' }}>Brak danych o planie.</div>
                )}
                {blocks.map((block: any) => {
                  const blockExs = (block.workout_block_exercises || []).sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                  if (blockExs.length === 0) return null
                  return (
                    <div key={block.id}>
                      <div style={{ padding: '0.45rem 1rem', background: 'var(--navy-700)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{block.block_name}</span>
                        {block.rounds > 1 && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.55rem', color: 'var(--muted-light)' }}>{block.rounds} rundy</span>}
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
                          <div key={ex.id} style={{ borderBottom: isLast ? 'none' : `1px solid var(--border)`, padding: '0.75rem 1rem', background: !hasLogs ? '#FAFAFA' : '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: hasLogs ? 8 : 4 }}>
                              <div style={{ fontWeight: 700, color: hasLogs ? 'var(--navy-900)' : 'var(--muted-light)', fontSize: '0.9rem' }}>{name}</div>
                              <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)' }}>
                                {plan ? `plan: ${plan.sets}×${plan.reps}${plan.weight ? ` · ${plan.weight}kg` : ''}` : ''}
                              </div>
                            </div>
                            {!hasLogs && (
                              <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wykonano / brak danych</div>
                            )}
                            {warmupLogs.map((l: any) => (
                              <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0', opacity: 0.6 }}>
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', minWidth: 42 }}>Rozg</span>
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.78rem', color: 'var(--muted-light)' }}>{l.weight ? `${l.weight} kg` : '—'}</span>
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--muted-light)' }}>{l.reps_completed ? `${l.reps_completed} powt.` : '—'}</span>
                              </div>
                            ))}
                            {mainLogs.map((l: any, i: number) => (
                              <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', borderTop: i === 0 && warmupLogs.length > 0 ? `1px dashed var(--border)` : 'none' }}>
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', color: l.completed ? 'var(--gold)' : 'var(--muted-light)', fontWeight: 800, minWidth: 42 }}>S{l.set_number}</span>
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.92rem', fontWeight: 900, color: l.weight ? 'var(--navy-900)' : 'var(--muted-light)' }}>{l.weight ? `${l.weight} kg` : '—'}</span>
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.75rem', color: 'var(--muted-light)' }}>{l.reps_completed ? `${l.reps_completed} powt.` : '—'}</span>
                                {!l.completed && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.52rem', color: 'var(--muted-light)', background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>nieukończona</span>}
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
              <div style={{ background: '#fff', border: `1.5px solid var(--border)`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem 1rem', background: '#1A0D2A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: '#C4B5FD', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>💬 Feedback po treningu</span>
                  {!feedback && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: '#A78BFA', fontStyle: 'italic' }}>nie wypełniony</span>}
                </div>
                <div style={{ padding: '0.75rem 1rem' }}>
                  {/* RPE */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted-light)' }}>RPE — ciężkość treningu</span>
                      {feedback?.session_rpe != null
                        ? <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontWeight: 900, fontSize: '1rem', color: rpeC(feedback.session_rpe) }}>{feedback.session_rpe}/10 <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>{feedback.session_rpe <= 3 ? 'Lekki' : feedback.session_rpe <= 5 ? 'Umiarkowany' : feedback.session_rpe <= 7 ? 'Ciężki' : feedback.session_rpe <= 9 ? 'Bardzo ciężki' : 'Maksymalny'}</span></span>
                        : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>}
                    </div>
                    {feedback?.session_rpe != null && (
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(feedback.session_rpe / 10) * 100}%`, background: rpeC(feedback.session_rpe), borderRadius: 3 }} />
                      </div>
                    )}
                  </div>
                  {/* Samopoczucie */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid var(--border)` }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted-light)' }}>Samopoczucie po treningu</span>
                    {feedback?.feeling_after
                      ? <span style={{ fontWeight: 700, color: 'var(--navy-900)', fontSize: '0.88rem' }}>{feelingLabelMap[feedback.feeling_after] || feedback.feeling_after}</span>
                      : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>}
                  </div>
                  {/* Co poszło dobrze */}
                  <div style={{ padding: '7px 0', borderBottom: `1px solid var(--border)` }}>
                    <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 700 }}>Co poszło dobrze</div>
                    {feedback?.what_went_well
                      ? <div style={{ fontSize: '0.86rem', color: 'var(--navy-900)', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{feedback.what_went_well}&rdquo;</div>
                      : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>}
                  </div>
                  {/* Ból po treningu */}
                  <div style={{ padding: '7px 0', borderBottom: `1px solid var(--border)` }}>
                    <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 700 }}>Ból / dyskomfort po treningu</div>
                    {feedback?.pain_after_comment
                      ? <div style={{ fontSize: '0.86rem', color: 'var(--navy-900)', fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{feedback.pain_after_comment}&rdquo;</div>
                      : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>}
                  </div>
                  {/* Dodatkowe uwagi */}
                  <div style={{ padding: '7px 0' }}>
                    <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 700 }}>Dodatkowe uwagi dla trenera</div>
                    {feedback?.general_notes
                      ? <div style={{ fontSize: '0.86rem', color: 'var(--navy-900)', lineHeight: 1.5 }}>{feedback.general_notes}</div>
                      : <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: 'var(--border)', fontStyle: 'italic' }}>nie wypełnione</span>}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </Modal>
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
  if (risk <= 30) return 'var(--green)'
  if (risk <= 55) return 'var(--gold)'
  if (risk <= 75) return '#F97316'
  return '#EF4444'
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: 'var(--navy-900)', fontSize: '0.9rem' }}>
          {emoji && <span style={{ fontSize: '1.15rem' }}>{emoji}</span>}
          <span>{label}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontWeight: 900, color, fontSize: '1rem' }}>{value}{unit}</span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: comment ? 4 : 0 }}>
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
  const cycleStyle = cycle ? (cycleColors[cycle] || { color: 'var(--muted-light)', bg: 'var(--bg)' }) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>

      {/* ── BASIC ── */}
      <div style={{ background: '#fff', border: `1.5px solid var(--border)`, borderRadius: 14, padding: '1rem' }}>
        <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>Basic — najważniejsze</div>
        {w.sleep_hours != null && (
          <div style={{ marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontWeight: 800, color: 'var(--navy-900)' }}>🌙 Sen — ilość godzin</span>
              <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontWeight: 900, color: wScaleColor(w.sleep_hours, 12, false), fontSize: '1rem' }}>{w.sleep_hours}h</span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (w.sleep_hours / 12) * 100)}%`, background: wScaleColor(w.sleep_hours, 12, false), borderRadius: 4 }} />
            </div>
          </div>
        )}
        <WScale label="Jakość snu" value={w.sleep_quality} max={10} comments={WC.sleepQ} />
        <WScale label={`${readinessEmoji(w.readiness ?? 5)} Poziom wypoczęcia`} value={w.readiness} max={10} comments={WC.readiness} />
        <WScale label="Energia" value={w.energy} max={10} comments={WC.energy} />
        <WScale label="Obciążenie stresem" value={w.stress} max={10} comments={WC.stress} inverse />
        {w.body_weight_kg && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.875rem', background: 'var(--bg)', borderRadius: 9, fontFamily: 'var(--font-inter),sans-serif' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Masa ciała</span>
            <span style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{w.body_weight_kg} kg</span>
          </div>
        )}
        {cycle && cycleStyle && (
          <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.875rem', background: cycleStyle.bg, border: `1.5px solid ${cycleStyle.color}55`, borderRadius: 9 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cycleStyle.color }} />
            <span style={{ fontWeight: 800, color: cycleStyle.color, fontSize: '0.88rem' }}>{cycle.charAt(0).toUpperCase() + cycle.slice(1)}</span>
            {w.cycle_day && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', color: cycleStyle.color }}>dzień {w.cycle_day}</span>}
          </div>
        )}
      </div>

      {/* ── AKTYWNOŚĆ ── */}
      {(act.type || act.duration) && (
        <div style={{ background: '#fff', border: `1.5px solid var(--border)`, borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>Aktywność dnia</div>
          {act.type && (
            <div style={{ display: 'inline-block', padding: '0.4rem 0.875rem', background: 'var(--navy-700)', color: 'var(--gold)', borderRadius: 8, fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.75rem' }}>{act.type}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {act.time && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.75rem', color: 'var(--muted-light)' }}>🕐 {act.time}</span>}
            {act.duration && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.75rem', color: 'var(--muted-light)' }}>⏱ {act.duration} min</span>}
            {act.motivation && motivationLabels[act.motivation] && (
              <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.75rem', color: 'var(--muted-light)' }}>{motivationLabels[act.motivation].emoji} motywacja: {motivationLabels[act.motivation].label}</span>
            )}
          </div>
          {act.rpe != null && act.rpe > 0 && (
            <WScale label="RPE — ciężkość wysiłku" value={act.rpe} max={10} inverse />
          )}
          {act.feelingAfter && feelingLabels[act.feelingAfter] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.55rem 0.875rem', background: 'var(--bg)', borderRadius: 9, marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-light)' }}>Samopoczucie po</span>
              <span style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{feelingLabels[act.feelingAfter]}</span>
            </div>
          )}
          {act.satisfaction != null && (
            <WScale label="Satysfakcja z treningu" value={act.satisfaction} max={10} />
          )}
          {act.goal && goalLabels[act.goal] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.55rem 0.875rem', background: 'var(--bg)', borderRadius: 9, marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-light)' }}>Plan zrealizowany?</span>
              <span style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{goalLabels[act.goal]}</span>
            </div>
          )}
          {act.goalComment && <div style={{ fontSize: '0.82rem', color: 'var(--muted-light)', fontStyle: 'italic', marginTop: '0.25rem' }}>{act.goalComment}</div>}
          {act.note && <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.875rem', background: 'var(--bg)', borderRadius: 9, fontSize: '0.84rem', color: 'var(--navy-900)' }}>{act.note}</div>}
        </div>
      )}

      {/* ── BÓL ── */}
      {(pain.painDuring > 0 || pain.location || w.muscle_sorness > 0 || pain.headache > 0 || pain.anxiety > 0 || pain.mentalOverload > 0) && (
        <div style={{ background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: '#EF4444', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>Ból i obciążenie</div>
          {w.muscle_sorness > 0 && <WScale label="Zakwasy" value={w.muscle_sorness} max={10} comments={WC.soreness} inverse />}
          {pain.painDuring > 0 && <WScale label="Ból podczas treningu" value={pain.painDuring} max={10} comments={WC.pain} inverse />}
          {pain.location && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.84rem', color: 'var(--navy-900)' }}>
              <span>📍</span><span style={{ fontWeight: 700 }}>{pain.location}</span>
            </div>
          )}
          {pain.note && <div style={{ fontSize: '0.82rem', color: 'var(--muted-light)', fontStyle: 'italic' }}>{pain.note}</div>}
          {pain.headache > 0 && <WScale label="Ból głowy" value={pain.headache} max={10} inverse />}
          {pain.anxiety > 0 && <WScale label="Lęk / niepokój" value={pain.anxiety} max={10} inverse />}
          {pain.mentalOverload > 0 && <WScale label="Przeciążenie mentalne" value={pain.mentalOverload} max={10} inverse />}
          {(pain.anxietySources?.length > 0 || pain.mentalSources?.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: '0.5rem' }}>
              {[...(pain.anxietySources || []), ...(pain.mentalSources || [])].map((s: string) => (
                <span key={s} style={{ padding: '2px 9px', background: '#FEE2E2', color: '#EF4444', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── UWAGI ── */}
      {w.concerns && (
        <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: '#92400E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>Uwagi dla trenera</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--navy-900)', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{w.concerns}&rdquo;</div>
        </div>
      )}
    </div>
  )
}

// ── AthleteQuickReportModal ───────────────────────────────────────────────────

function WellnessEntryDetail({ w, onClose }: { w: any; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Raport wellness"
      title={new Date(w.date || w.created_at).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
      footer={<Button variant="dark" onClick={onClose} style={{ width: '100%' }}>Zamknij</Button>}
    >
      <div style={{ margin: '-10px -14px' }}>
        <WellnessFullReport w={w} />
      </div>
    </Modal>
  )
}

function AthleteQuickReportModal({ athlete, wellnessLogs, onClose, onGoToProfile }: { athlete: any; wellnessLogs: any[]; onClose: () => void; onGoToProfile: () => void }) {
  const [detailEntry, setDetailEntry] = useState<any | null>(null)

  const myWellness = wellnessLogs.filter((l: any) => l.athlete_id === athlete.id).sort((a: any, b: any) => b.date?.localeCompare(a.date ?? '') || 0)

  return (
    <>
      {detailEntry && <WellnessEntryDetail w={detailEntry} onClose={() => setDetailEntry(null)} />}
      <Modal
        open
        onClose={onClose}
        eyebrow="Raport wellness zawodniczki"
        title={athlete.full_name}
        footer={<Button variant="ghost" onClick={onClose} style={{ width: '100%' }}>Zamknij</Button>}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onGoToProfile} style={{ border: 'none', background: 'var(--gold)', color: 'var(--navy-900)', borderRadius: 8, padding: '0.4rem 0.75rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Pełny profil →
          </button>
        </div>
        {myWellness.length === 0
          ? <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', color: 'var(--muted-light)' }}>Brak wpisów wellness (ostatnie 30 dni)</div>
          : myWellness.map((w: any, i: number) => {
              const hasDetail = w.sleep_hours != null || w.energy != null || w.stress != null || w.readiness != null || w.pain_data?.painDuring != null
              return (
                <button key={w.date || i} onClick={() => hasDetail && setDetailEntry(w)}
                  style={{ width: '100%', background: 'none', border: 'none', borderBottom: i < myWellness.length - 1 ? `1.5px solid var(--border)` : 'none', padding: '0.7rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: hasDetail ? 'pointer' : 'default', textAlign: 'left' }}
                  onMouseEnter={e => hasDetail && (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                    {new Date(w.date || w.created_at).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {w.energy != null && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', color: 'var(--gold)' }}>⚡{w.energy}</span>}
                    {w.sleep_hours != null && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', color: 'var(--muted-light)' }}>🌙{w.sleep_hours}h</span>}
                    {w.readiness != null && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', color: 'var(--green)' }}>💪{w.readiness}</span>}
                    {w.stress != null && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', color: w.stress >= 7 ? '#EF4444' : 'var(--muted-light)' }}>🧠{w.stress}</span>}
                    {w.pain_data?.painDuring > 0 && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', color: '#EF4444' }}>🩹{w.pain_data.painDuring}</span>}
                    {hasDetail && <span style={{ color: 'var(--muted-light)', fontSize: '0.8rem' }}>›</span>}
                  </div>
                </button>
              )
            })
        }
      </Modal>
    </>
  )
}

type SubView = 'trening' | 'wellness'

// ── Wellness helpers ──────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function colorBand(val: number | null, thresholds: [number, number], colors: [string, string, string]): string {
  if (val === null) return 'var(--muted-light)'
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
      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', fontWeight: 800, color }}>{value}</div>
      {label && <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.5rem', color: 'var(--muted-light)' }}>{label}</div>}
    </div>
  )
}

function getAthleteWellnessSummary(athleteId: number, logs: any[]) {
  const myLogs = logs.filter((l: any) => l.athlete_id === athleteId)
  const today = new Date().toISOString().split('T')[0]
  const hasToday = myLogs.some((l: any) => (l.date ?? l.created_at?.slice(0, 10)) === today)

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


function filterByDays(logs: any[], days: number, dateField = 'date') {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return logs.filter((l: any) => {
    const d = l[dateField] ? String(l[dateField]).slice(0, 10) : String(l.created_at).slice(0, 10)
    return d >= cutoffStr
  })
}


export default function CoachGroupDetailClient({ group, athletes, assignments, days, sessions, plans, wellnessLogs = [], wellnessWeek = [], feedbacks = [], moduleConfigs = [], assignmentsHistory = [], archivedPlans = [] }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignedMsg, setAssignedMsg] = useState('')
  const [subView, setSubView] = useState<SubView>('trening')
  const [moduleConfig, setModuleConfig] = useState<'wellness' | null>(null)
  const [athleteWellnessConfig, setAthleteWellnessConfig] = useState<any | null>(null)
  const [localModuleConfigs, setLocalModuleConfigs] = useState<any[]>(moduleConfigs)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [wellnessPeriod, setWellnessPeriod] = useState(14)
  const [editingGroup, setEditingGroup] = useState(false)
  const [localGroup, setLocalGroup] = useState(group)
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupSaved, setGroupSaved] = useState(false)

  const [groupError, setGroupError] = useState('')

  async function saveGroup() {
    setGroupSaving(true)
    setGroupError('')
    const { data, error } = await supabase
      .from('groups')
      .update({
        name: localGroup.name?.trim() || group.name,
        training_level: localGroup.training_level?.trim() || null,
      })
      .eq('id', group.id)
      .select()
      .single()
    setGroupSaving(false)
    if (error) { setGroupError(error.message); return }
    if (data) setLocalGroup(data)
    setGroupSaved(true)
    setTimeout(() => setGroupSaved(false), 2500)
    setEditingGroup(false)
  }
  const [quickReportAthlete, setQuickReportAthlete] = useState<any | null>(null)
  const [sessionReport, setSessionReport] = useState<{ session: any; athleteId: number; athleteName: string; dayName: string } | null>(null)

  const defaultWellnessPreParams = ['sleep_hours', 'sleep_quality', 'readiness', 'energy', 'stress', 'muscle_soreness', 'hydration', 'recovery_score']
  const defaultWellnessPostParams: string[] = []
  const groupWellnessConfig = localModuleConfigs.find((config: any) => config.module === 'wellness' && config.group_id === group.id)
  const groupWellnessEnabled = groupWellnessConfig?.enabled !== false
  const getAthleteWellnessConfig = (athleteId: number) => localModuleConfigs.find((config: any) => config.module === 'wellness' && config.athlete_id === athleteId)
  const getWellnessEnabled = (athleteId: number) => {
    const config = getAthleteWellnessConfig(athleteId)
    return config ? config.enabled !== false : groupWellnessEnabled
  }
  const groupWellnessForPanel = {
    enabled: groupWellnessEnabled,
    pre: groupWellnessConfig?.pre_params || defaultWellnessPreParams,
    post: groupWellnessConfig?.post_params || defaultWellnessPostParams,
  }

  function sameList(a: string[] = [], b: string[] = []) {
    return a.length === b.length && a.every(item => b.includes(item))
  }

  async function saveWellnessAccess(target: { athleteId?: number; enabled: boolean }) {
    const current = target.athleteId ? getAthleteWellnessConfig(target.athleteId) || groupWellnessConfig : groupWellnessConfig
    const groupPre = groupWellnessConfig?.pre_params || defaultWellnessPreParams
    const groupPost = groupWellnessConfig?.post_params || defaultWellnessPostParams

    if (target.athleteId && target.enabled === groupWellnessEnabled) {
      const athleteConfig = getAthleteWellnessConfig(target.athleteId)
      const hasCustomParams = athleteConfig && (
        !sameList(athleteConfig.pre_params || [], groupPre)
        || !sameList(athleteConfig.post_params || [], groupPost)
      )

      if (!hasCustomParams) {
        if (athleteConfig?.id) {
          const { error } = await supabase.from('group_module_config').delete().eq('id', athleteConfig.id)
          if (error) {
            setAssignedMsg(`Błąd zapisu wellness: ${error.message}`)
            return
          }
        }

        setLocalModuleConfigs(prev => prev.filter((config: any) => !(config.module === 'wellness' && config.athlete_id === target.athleteId)))
        setAssignedMsg('Wellness ustawiony jak grupa')
        setTimeout(() => setAssignedMsg(''), 1800)
        return
      }
    }

    const payload: any = {
      module: 'wellness',
      enabled: target.enabled,
      pre_params: current?.pre_params || defaultWellnessPreParams,
      post_params: current?.post_params || defaultWellnessPostParams,
      updated_at: new Date().toISOString(),
    }
    if (target.athleteId) payload.athlete_id = target.athleteId
    else payload.group_id = group.id

    const { data, error } = await supabase
      .from('group_module_config')
      .upsert(payload, { onConflict: target.athleteId ? 'athlete_id,module' : 'group_id,module' })
      .select('id, group_id, athlete_id, module, enabled, pre_params, post_params, updated_at')
      .single()

    if (error) {
      setAssignedMsg(`Błąd zapisu wellness: ${error.message}`)
      return
    }

    setLocalModuleConfigs(prev => [
      ...prev.filter((config: any) => target.athleteId
        ? !(config.module === 'wellness' && config.athlete_id === target.athleteId)
        : !(config.module === 'wellness' && config.group_id === group.id)
      ),
      data,
    ])
    setAssignedMsg(target.enabled ? 'Wellness włączony' : 'Wellness wyłączony')
    setTimeout(() => setAssignedMsg(''), 1800)
  }

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
      <SetPageMeta title={localGroup.name} backHref="/coach/groups" backLabel="Grupy" />

      {showAssignModal && (
        <AssignPlanModal
          athletes={athletes} plans={plans} groupId={group.id}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { setAssignedMsg('Plan przypisany!'); router.refresh() }}
        />
      )}
      {moduleConfig && (
        <ModuleConfigPanel
          groupId={group.id}
          module={moduleConfig}
          onClose={() => { setModuleConfig(null); router.refresh() }}
        />
      )}
      {athleteWellnessConfig && (
        <ModuleConfigPanel
          athleteId={athleteWellnessConfig.id}
          module="wellness"
          groupConfig={groupWellnessForPanel}
          onClose={() => { setAthleteWellnessConfig(null); router.refresh() }}
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
          onClose={() => setQuickReportAthlete(null)}
          onGoToProfile={() => { setQuickReportAthlete(null); router.push(`/coach/athletes/${quickReportAthlete.id}`) }}
        />
      )}

      <div className="coach-content">
        <div className="coach-group-hero">
          <div className="coach-group-hero-title">
            {editingGroup ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 320 }}>
                <input
                  value={localGroup.name || ''}
                  onChange={e => setLocalGroup((g: any) => ({ ...g, name: e.target.value }))}
                  placeholder="Nazwa grupy"
                  style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid var(--navy-600)`, borderRadius: 8, color: '#fff', padding: '0.45rem 0.75rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '1rem', fontWeight: 800, outline: 'none', width: '100%' }}
                />
                <input
                  value={localGroup.training_level || ''}
                  onChange={e => setLocalGroup((g: any) => ({ ...g, training_level: e.target.value }))}
                  placeholder="Poziom treningu (np. zaawansowany)"
                  style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid var(--navy-600)`, borderRadius: 8, color: '#fff', padding: '0.35rem 0.75rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', outline: 'none', width: '100%' }}
                />
                {groupError && <div style={{ fontSize: '0.72rem', color: '#EF4444', fontFamily: 'var(--font-inter),sans-serif' }}>❌ {groupError}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="gold" size="small" onClick={saveGroup} disabled={groupSaving}>
                    {groupSaving ? '...' : groupSaved ? '✓ Zapisano' : 'Zapisz'}
                  </Button>
                  <Button variant="ghost" size="small" onClick={() => { setEditingGroup(false); setLocalGroup(group); setGroupError('') }}>
                    Anuluj
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2>{localGroup.name}</h2>
                <button onClick={() => setEditingGroup(true)}
                  style={{ padding: '3px 10px', background: 'var(--navy-700)', color: 'var(--muted-light)', border: `1px solid var(--navy-600)`, borderRadius: 7, fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  ✎ Edytuj
                </button>
              </>
            )}
          </div>
          <div className="coach-group-hero-sub">
            {athletes.length} zawodniczek <span className="coach-dot-sep">·</span> Trener motoryczny: <b>{group.trainer_name || 'Urszula Papka'}</b>
            {localGroup.training_level && <><span className="coach-dot-sep">·</span> {localGroup.training_level}</>}
            {currentPlan && <><span className="coach-dot-sep">·</span> 📋 {currentPlan.name}</>}
            {assignedMsg && <><span className="coach-dot-sep">·</span> <span style={{ color: 'var(--green)' }}>✓ {assignedMsg}</span></>}
          </div>
        </div>

        <TabsNav items={[
          { key: 'treningi', label: 'Treningi', href: `/coach/groups/${group.id}` },
          { key: 'plan', label: 'Plan', href: `/coach/groups/${group.id}/plan` },
          { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${group.id}/stats` },
          { key: 'obecnosc', label: 'Obecność', href: `/coach/groups/${group.id}/attendance` },
          { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${group.id}/athletes` },
          { key: 'testy', label: 'Testy', href: `/coach/groups/${group.id}/tests` },
        ]} />

        <div className="coach-group-tab-panel">
          <div style={{ marginBottom: '1rem' }}>
            <SegmentedControl
              options={[
                { value: 'trening', label: 'Trening' },
                { value: 'wellness', label: 'Wellness' },
              ]}
              value={subView}
              onChange={(v) => setSubView(v as SubView)}
            />
          </div>

          {/* ══ WELLNESS TAB ══════════════════════════════════════════════════════ */}
          {subView === 'wellness' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Config + individual overrides */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Konfiguracja parametrów</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => saveWellnessAccess({ enabled: !groupWellnessEnabled })} style={{ border: `1.5px solid ${groupWellnessEnabled ? '#86EFAC' : '#FCA5A5'}`, background: groupWellnessEnabled ? '#F0FDF4' : '#FEF2F2', color: groupWellnessEnabled ? 'var(--green)' : '#EF4444', borderRadius: 999, padding: '0.45rem 0.85rem', fontWeight: 900, fontSize: '0.74rem', cursor: 'pointer' }}>
                    {groupWellnessEnabled ? 'Wellness włączony' : 'Wellness wyłączony'}
                  </button>
                  <button onClick={() => setModuleConfig('wellness')} style={{ border: 'none', background: 'var(--navy-900)', color: 'var(--gold)', borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                    🩺 Edytuj dla grupy
                  </button>
                  </div>
                </div>
                {athletes.map((athlete: any, i: number) => {
                  const ws = getAthleteWellnessSummary(athlete.id, wellnessWeek)
                  const individualConfig = getAthleteWellnessConfig(athlete.id)
                  const wellnessEnabled = getWellnessEnabled(athlete.id)
                  return (
                    <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid var(--border)` : 'none' }}>
                      <div style={{ flex: 1, fontWeight: 700, color: 'var(--navy-900)', fontSize: '0.9rem' }}>{athlete.full_name}</div>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', color: ws.hasToday ? 'var(--green)' : ws.entryCount > 0 ? 'var(--gold)' : '#EF4444' }}>{ws.hasToday ? '✅ dziś' : ws.entryCount > 0 ? `⚠️ ${ws.entryCount} wpisów` : '✗ brak'}</div>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: individualConfig ? 'var(--gold)' : 'var(--muted-light)', minWidth: 82, textAlign: 'center' }}>
                        {individualConfig ? 'indywidualnie' : 'wg grupy'}
                      </div>
                      <button onClick={() => saveWellnessAccess({ athleteId: athlete.id, enabled: !wellnessEnabled })} style={{ border: `1.5px solid ${wellnessEnabled ? '#86EFAC' : '#FCA5A5'}`, background: wellnessEnabled ? '#F0FDF4' : '#FEF2F2', color: wellnessEnabled ? 'var(--green)' : '#EF4444', borderRadius: 999, padding: '0.35rem 0.7rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', minWidth: 84 }}>
                        {wellnessEnabled ? 'włączony' : 'wyłączony'}
                      </button>
                      <button onClick={() => setAthleteWellnessConfig(athlete)} style={{ border: `1.5px solid var(--border)`, background: 'var(--bg)', color: 'var(--navy-900)', borderRadius: 7, padding: '0.35rem 0.65rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                        Konfiguruj →
                      </button>
                    </div>
                  )
                })}
              </Card>

              {/* ── Wellness stats table ── */}
              <StatsTable
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
                  const sc = (v: number | null, lo: number, hi: number) => v === null ? undefined : v < lo ? '#EF4444' : v < hi ? 'var(--gold)' : 'var(--green)'
                  const stressC = stressAvg === null ? undefined : stressAvg >= 8 ? '#EF4444' : stressAvg >= 5 ? 'var(--gold)' : 'var(--green)'

                  return {
                    id: athlete.id, name: athlete.full_name,
                    cells: [
                      { v: logs.length || null, color: logs.length === 0 ? '#EF4444' : 'var(--green)' },
                      { v: sleepAvg !== null ? `${sleepAvg.toFixed(1)}h` : null, color: sc(sleepAvg, 5, 7) },
                      { v: energyAvg !== null ? energyAvg.toFixed(1) : null, color: sc(energyAvg, 4, 7) },
                      { v: stressAvg !== null ? stressAvg.toFixed(1) : null, color: stressC },
                      { v: readinessAvg !== null ? readinessAvg.toFixed(1) : null, color: sc(readinessAvg, 4, 7) },
                      { v: maxPain !== null ? maxPain : null, color: maxPain !== null ? (maxPain >= 6 ? '#EF4444' : maxPain >= 4 ? 'var(--gold)' : 'var(--green)') : undefined },
                      { v: actH !== null ? `${actH}h` : null },
                      { v: latestCycle === 'menstruacja' ? '🔴 mens.' : latestCycle ? latestCycle.slice(0, 7) : null, color: latestCycle === 'menstruacja' ? '#EF4444' : 'var(--muted-light)' },
                    ],
                  }
                })}
                onAthleteClick={openQuickReport}
              />

              {/* ── Wellness — przegląd tygodniowy (7 dni) ── */}
              {athletes.length > 0 && (
                <Card>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Wellness — przegląd tygodniowy</div>
                      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', color: 'var(--navy-900)', fontWeight: 700, marginTop: 2 }}>Dane z ostatnich 7 dni</div>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                      <thead>
                        <tr style={{ background: '#0D2D1A' }}>
                          <th style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: '#86EFAC', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid #1A4D2E` }}>Zawodniczka</th>
                          {[
                            { label: 'Wellness', title: 'Czy uzupełniła dziś' },
                            { label: '🌙 Sen śr.', title: 'Średnia snu (h)' },
                            { label: '🧠 Stres', title: 'Średni stres (1-10)' },
                            { label: '🩹 Max ból', title: 'Maks. ból podczas treningu' },
                            { label: '🏃 Aktywność', title: 'Łączne godziny aktywności' },
                            { label: '🌸 Cykl', title: 'Ostatnia zaznaczona faza' },
                          ].map(h => (
                            <th key={h.label} title={h.title} style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: '#86EFAC', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid #1A4D2E`, minWidth: 80 }}>
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, rowIdx: number) => {
                          const ws = getAthleteWellnessSummary(athlete.id, wellnessWeek)
                          const rowBg = rowIdx % 2 === 0 ? '#fff' : '#F7FFF9'

                          const sleepColor = ws.sleepAvg === null ? undefined : ws.sleepAvg <= 5 ? '#EF4444' : ws.sleepAvg <= 7 ? 'var(--gold)' : 'var(--green)'
                          const stressColor = ws.stressAvg === null ? undefined : ws.stressAvg >= 8 ? '#EF4444' : ws.stressAvg >= 5 ? 'var(--gold)' : 'var(--green)'
                          const painColor = ws.maxPain === null ? undefined : ws.maxPain >= 6 ? '#EF4444' : ws.maxPain >= 5 ? 'var(--gold)' : 'var(--green)'

                          const pill = (val: string | number | null, color?: string) => val !== null ? (
                            <span style={{ display: 'inline-block', background: (color ?? 'var(--navy-900)') + '1A', color: color ?? 'var(--navy-900)', borderRadius: 6, padding: '2px 8px', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.75rem', fontWeight: 800 }}>{val}</span>
                          ) : <span style={{ color: 'var(--border)', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem' }}>—</span>

                          return (
                            <tr key={athlete.id} style={{ background: rowBg }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#ECFDF5')}
                              onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                              <td style={{ padding: '0.7rem 1.25rem', fontWeight: 700, color: 'var(--navy-900)', borderBottom: `1px solid #E0F2EA`, whiteSpace: 'nowrap' }}>
                                <button onClick={() => openQuickReport(athlete.id)} style={{ background: 'none', border: 'none', color: 'var(--navy-900)', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}>{athlete.full_name}</button>
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
                                {pill(ws.activityHours !== null ? `${ws.activityHours}h` : null, 'var(--navy-900)')}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {ws.latestCycle === 'menstruacja'
                                  ? <span title="Menstruacja">🔴</span>
                                  : ws.latestCycle
                                    ? <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', color: 'var(--muted-light)' }}>{ws.latestCycle.slice(0, 7)}</span>
                                    : <span style={{ color: 'var(--border)', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem' }}>—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ══ TRENING TAB ═══════════════════════════════════════════════════════ */}
          {subView === 'trening' && athletes.length === 0 && (
            <Card><div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-light)' }}>Brak zawodniczek w tej grupie.</div></Card>
          )}
          {subView === 'trening' && athletes.length > 0 && (
            <>
              {/* ── Akcje planu ── */}
              <Card style={{ marginBottom: '1.25rem' }}>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Aktualny plan</div>
                    <div style={{ fontWeight: 800, color: 'var(--navy-900)', fontSize: '0.95rem' }}>{currentPlan?.name ?? '— brak przypisanego planu —'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {assignments.length > 1 && (
                      <select value={selectedPlanId ?? ''} onChange={e => setSelectedPlanId(e.target.value ? parseInt(e.target.value) : null)}
                        style={{ border: `1.5px solid var(--border)`, background: 'var(--bg)', color: 'var(--navy-900)', borderRadius: 8, padding: '0.45rem 0.65rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', outline: 'none' }}>
                        <option value="">Aktualny</option>
                        {Array.from(new Map(assignments.map((a: any) => [a.plan_id, a])).values()).map((a: any) => <option key={a.plan_id} value={a.plan_id}>{a.plan?.name}</option>)}
                      </select>
                    )}
                    {currentPlan && !currentPlan.is_archived && (
                      <button onClick={() => router.push(`/coach/plans/${currentPlan.id}`)} style={{ border: `1.5px solid var(--border)`, background: 'var(--bg)', color: 'var(--navy-900)', borderRadius: 8, padding: '0.45rem 0.75rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                        ✏️ Edytuj plan
                      </button>
                    )}
                    {currentPlan && !currentPlan.is_archived && (
                      <button onClick={() => archivePlan(currentPlan.id)} style={{ border: `1.5px solid var(--border)`, background: 'var(--bg)', color: 'var(--muted-light)', borderRadius: 8, padding: '0.45rem 0.75rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                        📦 Archiwizuj
                      </button>
                    )}
                    <button onClick={() => setShowAssignModal(true)} style={{ border: 'none', background: 'var(--navy-900)', color: 'var(--gold)', borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                      + Przypisz plan
                    </button>
                  </div>
                </div>
              </Card>

              {assignments.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid var(--border)` }}>
                    <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Realizacja planu</div>
                    <div style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{currentPlan?.name} · {activePlanDays.length} treningów</div>
                  </div>
                  {/* ── TABELA 1: Realizacja planu (treningi) ── */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="coach-track-table" style={{ minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fff' }}>Zawodniczka</th>
                          <th style={{ textAlign: 'center' }}>Postęp</th>
                          {activePlanDays.map((day: any, i: number) => (
                            <th key={day.id} style={{ textAlign: 'center', minWidth: 42 }}>
                              <div style={{ fontWeight: 800 }}>T{i + 1}</div>
                              <div style={{ fontSize: '0.52rem', marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>{(day.day_name || '').replace('Dzień ', '').replace('Trening ', '')}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, rowIdx: number) => {
                          const progress = getAthleteProgress(athlete.id)
                          const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0
                          const rowBg = rowIdx % 2 === 0 ? '#fff' : '#FAFBFC'
                          return (
                            <tr key={athlete.id} style={{ background: rowBg }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                              onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                              <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'inherit', whiteSpace: 'nowrap' }}>
                                <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} className="coach-track-name" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>{athlete.full_name}</button>
                              </td>
                              <td className="coach-track-progress-cell" style={{ textAlign: 'center' }}>
                                {progress ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                      <span className="coach-track-pct" style={{ color: pct === 100 ? 'var(--green)' : 'var(--ink)' }}>{pct}%</span>
                                      <span className="coach-track-frac">{progress.done}/{progress.total}</span>
                                    </span>
                                    <div style={{ width: 40, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--gold)', borderRadius: 2 }} />
                                    </div>
                                  </div>
                                ) : <span style={{ color: 'var(--border)', fontSize: '0.7rem' }}>—</span>}
                              </td>
                              {activePlanDays.map((day: any) => {
                                const sess = sessionIndex[`${athlete.id}_${day.id}`] || null
                                const clickable = !!sess
                                return (
                                  <td key={day.id} style={{ textAlign: 'center' }}>
                                    <div
                                      onClick={() => clickable && openSessionReport(sess, athlete.id, athlete.full_name, day.day_name || `Trening ${day.id}`)}
                                      title={sess?.completed ? 'Kliknij aby zobaczyć raport' : sess ? 'Trening w toku — kliknij aby zobaczyć bieżące dane' : undefined}
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
                  <div className="coach-track-legend" style={{ borderTop: `1.5px solid var(--border)` }}>
                    {[
                      { symbol: '○', label: 'Niewykonany', cls: 'coach-none' },
                      { symbol: '✓', label: 'Wykonany', cls: 'coach-done' },
                      { symbol: '📋', label: 'Raport wysłany', cls: 'coach-sent' },
                      { symbol: '◑', label: 'W trakcie', cls: 'coach-progress' },
                    ].map(item => (
                      <div key={item.label} className="coach-track-legend-item">
                        <div className={`coach-track-status ${item.cls}`}>{item.symbol}</div>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Historia przypisanych planów */}
              {assignmentsHistory.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid var(--border)` }}>
                    <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Historia przypisanych planów</div>
                  </div>
                  {assignmentsHistory.map((a: any, i: number) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < assignmentsHistory.length - 1 ? `1px solid var(--border)` : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--navy-900)', fontSize: '0.88rem' }}>{a.plan?.name ?? '—'}</div>
                        <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', marginTop: 2 }}>
                          {new Date(a.created_at).toLocaleDateString('pl-PL')}
                          {a.is_active ? <span style={{ marginLeft: 8, color: 'var(--green)', fontWeight: 700 }}>● aktywny</span> : <span style={{ marginLeft: 8, color: 'var(--muted-light)' }}>zakończony</span>}
                          {a.plan?.is_archived && <span style={{ marginLeft: 8, color: 'var(--muted-light)' }}>📦 zarchiwizowany</span>}
                        </div>
                      </div>
                      {a.plan && !a.plan.is_archived && (
                        <button onClick={() => router.push(`/coach/plans/${a.plan_id}`)} style={{ border: `1.5px solid var(--border)`, background: 'var(--bg)', color: 'var(--navy-900)', borderRadius: 7, padding: '0.3rem 0.6rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
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
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid var(--border)` }}>
                    <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>📦 Archiwum planów</div>
                  </div>
                  {archivedPlans.map((plan: any, i: number) => (
                    <div key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < archivedPlans.length - 1 ? `1px solid var(--border)` : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--muted-light)', fontSize: '0.88rem' }}>{plan.name}</div>
                        <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--border)', marginTop: 2 }}>
                          Utworzony {new Date(plan.created_at).toLocaleDateString('pl-PL')}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', background: 'var(--bg)', border: `1px solid var(--border)`, borderRadius: 6, padding: '2px 8px' }}>zarchiwizowany</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
