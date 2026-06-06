'use client'
// src/app/athlete/history/[id]/HistoryDetailClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E',
  red: '#EF4444', orange: '#F97316',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

const FEELING_OPTIONS = [
  { value: 'swietnie', emoji: '💪', label: 'Świetnie' },
  { value: 'dobrze',   emoji: '😊', label: 'Dobrze' },
  { value: 'srednie',  emoji: '😐', label: 'Średnio' },
  { value: 'zmeczona', emoji: '😓', label: 'Zmęczona' },
  { value: 'slabo',    emoji: '😞', label: 'Słabo' },
]

const WC = {
  sleepQ:   ['Brak regenerującego snu','Bardzo słaby sen','Słaby sen','Sen raczej płytki','Poniżej optymalnie','Średnia jakość snu','Całkiem dobry sen','Dobry sen','Bardzo dobry sen','Świetna regeneracja','Maksymalnie regenerujący sen'],
  readiness:['Bardzo duże zmęczenie','Ciało prosi o spokojniejszy start','Niska gotowość','Raczej zmęczona','Lekko poniżej normy','Normalnie','Całkiem wypoczęta','Dobra gotowość','Bardzo wypoczęta','Świetna gotowość','Pełna gotowość'],
  energy:   ['Brak energii','Bardzo niska energia','Trzeba oszczędzać baterie','Energia poniżej normy','Trochę ciężki start','Stabilnie','Energia w porządku','Dobra energia','Bardzo dobra energia','Wysoka energia','Pełna moc'],
  stress:   ['Pełny spokój','Bardzo niski stres','Spokojna głowa','Lekki stres','Do ogarnięcia','Umiarkowanie','Podwyższone napięcie','Warto obserwować','Dużo stresu','Bardzo duże obciążenie','Alarmowo wysoki stres'],
  soreness: ['Brak zakwasów','Ledwo wyczuwalne','Lekkie zakwasy','Czuć mięśnie, ale bez problemu','Umiarkowane zakwasy','Wyraźne zakwasy','Mogą wpływać na ruch','Mocne zakwasy','Ciężko wejść w trening','Bardzo mocne obciążenie mięśni','Regeneracja priorytetem'],
}

function wScaleColor(v: number, max: number, inverse: boolean) {
  const pct = (v / max) * 100
  const risk = inverse ? pct : 100 - pct
  if (risk <= 30) return C.green
  if (risk <= 55) return C.gold
  if (risk <= 75) return C.orange
  return C.red
}
function wComment(v: number, arr: string[]) { return arr[Math.max(0, Math.min(arr.length - 1, Math.round(v)))] }
function readinessEmoji(v: number) { return v <= 1 ? '😴' : v <= 3 ? '😪' : v <= 5 ? '😐' : v <= 8 ? '😊' : '⚡' }

function WBar({ label, value, max, comments, inverse }: { label: string; value: number | null | undefined; max: number; comments?: string[]; inverse?: boolean }) {
  if (value == null) return null
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = wScaleColor(value, max, !!inverse)
  const comment = comments ? wComment(value, comments) : null
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: '0.82rem', color: C.gray }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.82rem', fontWeight: 800, color }}>{value}/10</span>
      </div>
      <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden', marginBottom: comment ? 3 : 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      {comment && <div style={{ fontSize: '0.68rem', fontWeight: 700, color, textAlign: 'right' }}>{comment}</div>}
    </div>
  )
}

function rpeColor(rpe: number) {
  return rpe >= 9 ? C.red : rpe >= 7 ? C.orange : rpe >= 5 ? C.gold : C.green
}
function rpeLabel(rpe: number) {
  if (rpe <= 3) return 'Lekki'
  if (rpe <= 5) return 'Umiarkowany'
  if (rpe <= 7) return 'Ciężki'
  if (rpe <= 9) return 'Bardzo ciężki'
  return 'Maksymalny'
}

function dedupeLogs<T extends { id?: number; created_at?: string | null; block_exercise_id?: number | null; set_number: number; is_warmup?: boolean | null }>(logs: T[]) {
  const byKey = new Map<string, T>()
  for (const log of logs || []) {
    if (!log.block_exercise_id) continue
    const key = `${log.block_exercise_id}:${log.set_number}:${log.is_warmup ? 'w' : 'm'}`
    const existing = byKey.get(key)
    const logTime = new Date(log.created_at || 0).getTime()
    const existingTime = new Date(existing?.created_at || 0).getTime()
    if (!existing || logTime >= existingTime || (log.id || 0) > (existing.id || 0)) byKey.set(key, log)
  }
  return Array.from(byKey.values())
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(13,27,42,0.06)', ...style }}>
      {children}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '0.65rem 1.25rem', background: C.offWhite, borderBottom: `1.5px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
      {children}
    </div>
  )
}

export default function HistoryDetailClient({ athlete, session, setLogs, wellness, feedback: initialFeedback, painLogs }: any) {
  const router = useRouter()
  const supabase = createClient()
  const day = session.workout_day
  const plan = day?.week?.plan

  // Edycja feedbacku
  const [rpe, setRpe] = useState<number>(initialFeedback?.session_rpe ?? 6)
  const [feeling, setFeeling] = useState<string>(initialFeedback?.feeling_after ?? '')
  const [whatWell, setWhatWell] = useState(initialFeedback?.what_went_well ?? '')
  const [painComment, setPainComment] = useState(initialFeedback?.pain_after_comment ?? '')
  const [notes, setNotes] = useState(initialFeedback?.general_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'ok' | 'err' | null>(null)

  // Mapa ćwiczeń
  const exerciseMap: Record<number, any> = {}
  const blockOrder: { id: number; name: string; exIds: number[] }[] = []
  for (const block of (day?.workout_day_blocks || [])) {
    const exIds: number[] = []
    for (const ex of (block.workout_block_exercises || [])) {
      exerciseMap[ex.id] = { ...ex, blockName: block.block_name }
      exIds.push(ex.id)
    }
    blockOrder.push({ id: block.id, name: block.block_name, exIds })
  }

  // Logi po ćwiczeniu
  const logsByExercise: Record<number, any[]> = {}
  for (const log of dedupeLogs(setLogs)) {
    if (!log.block_exercise_id) continue
    if (!logsByExercise[log.block_exercise_id]) logsByExercise[log.block_exercise_id] = []
    logsByExercise[log.block_exercise_id].push(log)
  }

  async function saveFeedback() {
    setSaving(true)
    const payload = {
      session_id: session.id, workout_session_id: session.id, athlete_id: athlete.id,
      session_rpe: rpe, feeling_after: feeling,
      what_went_well: whatWell || null, pain_after_comment: painComment || null, general_notes: notes || null,
    }
    if (initialFeedback?.id) {
      await supabase.from('post_session_feedback').update(payload).eq('id', initialFeedback.id)
    } else {
      await supabase.from('post_session_feedback').insert(payload)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function sendReport() {
    setSending(true)
    setSendResult(null)
    // Najpierw zapisz feedback
    await saveFeedback()
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, athleteId: athlete.id }),
    })
    setSendResult(res.ok ? 'ok' : 'err')
    setSending(false)
  }

  const cycleColors: Record<string, string> = { menstruacja: C.red, folikularna: '#F59E0B', owulacja: C.green, lutealna: '#A78BFA' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>

        {/* ── HEADER ── */}
        <header style={{ background: C.navy, padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/athlete/history')}
              style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← Historia
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                {plan?.name} · Tydzień {day?.week?.week_number}
              </div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{day?.day_name}</div>
            </div>
            {session.report_sent && (
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.green, background: C.green + '22', border: `1px solid ${C.green}`, borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}>
                📋 wysłany
              </div>
            )}
          </div>
        </header>

        <main style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 1rem 6rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* ── DATA ── */}
          <div style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray, textAlign: 'center', padding: '0.5rem 0' }}>
            {session.date_completed
              ? new Date(session.date_completed).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </div>

          {/* ── WELLNESS ── */}
          {wellness && (
            <Card>
              <SectionHeader>🩺 Wellness przed treningiem</SectionHeader>
              <div style={{ padding: '1rem 1.25rem' }}>
                {/* Sen */}
                {wellness.sleep_hours != null && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.82rem', color: C.gray }}>🌙 Sen</span>
                      <span style={{ fontFamily: mono, fontWeight: 800, color: wScaleColor(wellness.sleep_hours, 12, false) }}>{wellness.sleep_hours}h</span>
                    </div>
                    <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100,(wellness.sleep_hours/12)*100)}%`, background: wScaleColor(wellness.sleep_hours, 12, false), borderRadius: 3 }} />
                    </div>
                  </div>
                )}
                <WBar label="Jakość snu" value={wellness.sleep_quality} max={10} comments={WC.sleepQ} />
                <WBar label={`${readinessEmoji(wellness.readiness ?? 5)} Wypoczęcie`} value={wellness.readiness} max={10} comments={WC.readiness} />
                <WBar label="Energia" value={wellness.energy} max={10} comments={WC.energy} />
                <WBar label="Stres" value={wellness.stress} max={10} comments={WC.stress} inverse />
                <WBar label="Zakwasy" value={wellness.muscle_sorness} max={10} comments={WC.soreness} inverse />
                {wellness.body_weight_kg && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${C.grayLight}`, marginTop: 4 }}>
                    <span style={{ fontSize: '0.82rem', color: C.gray }}>Masa ciała</span>
                    <span style={{ fontFamily: mono, fontWeight: 800, color: C.navy }}>{wellness.body_weight_kg} kg</span>
                  </div>
                )}
                {wellness.cycle_phase && (
                  <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: (cycleColors[wellness.cycle_phase] || C.gray) + '18', borderRadius: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cycleColors[wellness.cycle_phase] || C.gray }} />
                    <span style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 700, color: cycleColors[wellness.cycle_phase] || C.gray }}>
                      {wellness.cycle_phase}{wellness.cycle_day ? ` · dzień ${wellness.cycle_day}` : ''}
                    </span>
                  </div>
                )}
                {/* Aktywność */}
                {wellness.activity_data?.type && (
                  <div style={{ marginTop: 10, padding: '0.75rem', background: C.offWhite, borderRadius: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Aktywność</div>
                    <div style={{ fontWeight: 700, color: C.navy }}>{wellness.activity_data.type}</div>
                    <div style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray, marginTop: 2 }}>
                      {[wellness.activity_data.time, wellness.activity_data.duration && `${wellness.activity_data.duration} min`, wellness.activity_data.rpe && `RPE ${wellness.activity_data.rpe}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                )}
                {/* Ból wellness */}
                {wellness.pain_data?.painDuring > 0 && (
                  <div style={{ marginTop: 10, padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.red, textTransform: 'uppercase', marginBottom: 3 }}>Ból podczas treningu</div>
                    <div style={{ fontFamily: mono, fontWeight: 800, color: C.red }}>{wellness.pain_data.painDuring}/10</div>
                    {wellness.pain_data.location && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 2 }}>📍 {wellness.pain_data.location}</div>}
                  </div>
                )}
                {/* Suplementy */}
                {wellness.supplements_data?.counts && Object.values(wellness.supplements_data.counts).some((v: any) => v > 0) && (
                  <div style={{ marginTop: 10, padding: '0.65rem 0.875rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#92400E', textTransform: 'uppercase', marginBottom: 5 }}>Suplementy</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {Object.entries(wellness.supplements_data.counts).filter(([,v]: any) => v > 0).map(([id, count]: any) => (
                        <span key={id} style={{ padding: '2px 8px', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, fontFamily: mono, fontSize: '0.65rem', color: '#92400E' }}>
                          {id.replace(/_/g,' ')} ×{count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {wellness.concerns && (
                  <div style={{ marginTop: 10, padding: '0.65rem 0.875rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#92400E', textTransform: 'uppercase', marginBottom: 3 }}>Uwagi dla trenera</div>
                    <div style={{ fontSize: '0.84rem', color: C.navy, fontStyle: 'italic' }}>&ldquo;{wellness.concerns}&rdquo;</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ── SERIE ── */}
          {Object.keys(logsByExercise).length > 0 && (
            <Card>
              <SectionHeader>🏋️ Wykonane serie</SectionHeader>
              {blockOrder.map(block => {
                const blockExIds = block.exIds.filter(id => logsByExercise[id]?.length > 0)
                if (!blockExIds.length) return null
                return (
                  <div key={block.id}>
                    <div style={{ padding: '0.45rem 1.25rem', background: C.navyLight, display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{block.name}</span>
                    </div>
                    {blockExIds.map((exId, ei) => {
                      const ex = exerciseMap[exId]
                      const name = ex?.exercise?.name ? ex.exercise.name.replace(/-/g,' ') : (ex?.exercise_code || `Ćw.#${exId}`)
                      const logs = logsByExercise[exId].sort((a: any, b: any) => a.set_number - b.set_number)
                      const main = logs.filter((l: any) => !l.is_warmup)
                      const wu = logs.filter((l: any) => l.is_warmup)
                      const exNote = logs.find((l: any) => !l.is_warmup && l.athlete_note)?.athlete_note
                      const planStr = ex ? `${ex.sets}×${ex.reps || '—'}${ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}` : ''
                      return (
                        <div key={exId} style={{ padding: '0.875rem 1.25rem', borderBottom: ei < blockExIds.length - 1 ? `1px solid ${C.grayLight}` : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, color: C.navy, fontSize: '0.92rem' }}>{name}</span>
                            {planStr && <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>plan: {planStr}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {wu.map((l: any) => (
                              <div key={l.id} style={{ padding: '0.5rem 0.75rem', background: C.offWhite, border: `1px solid ${C.grayLight}`, borderRadius: 9, minWidth: 52, textAlign: 'center' }}>
                                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginBottom: 3 }}>Rozg</div>
                                {l.weight && <div style={{ fontFamily: mono, fontSize: '0.82rem', fontWeight: 800, color: C.gray }}>{l.weight}kg</div>}
                              </div>
                            ))}
                            {main.map((l: any) => (
                              <div key={l.id} style={{ padding: '0.5rem 0.75rem', background: l.completed ? '#F0FDF4' : C.offWhite, border: `1px solid ${l.completed ? '#86EFAC' : C.grayLight}`, borderRadius: 9, minWidth: 52, textAlign: 'center' }}>
                                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: l.completed ? C.green : C.gray, fontWeight: 700, marginBottom: 3 }}>S{l.set_number}</div>
                                {l.weight != null && <div style={{ fontFamily: mono, fontSize: '0.9rem', fontWeight: 900, color: C.navy }}>{l.weight}kg</div>}
                                {l.reps_completed && <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray }}>{l.reps_completed}p</div>}
                              </div>
                            ))}
                          </div>
                          {exNote && (
                            <div style={{ marginTop: 8, padding: '0.5rem 0.75rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: '0.78rem', color: C.navy, fontStyle: 'italic' }}>
                              💬 {exNote}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </Card>
          )}

          {/* ── BÓL ── */}
          {painLogs?.length > 0 && (
            <Card>
              <SectionHeader>🩹 Zgłoszony ból</SectionHeader>
              <div style={{ padding: '0.875rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {painLogs.map((p: any) => (
                  <div key={p.id} style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: C.navy }}>{p.location || 'Nieznana lokalizacja'}</span>
                      <span style={{ fontFamily: mono, fontWeight: 800, color: p.vas_score >= 7 ? C.red : p.vas_score >= 4 ? C.orange : C.green }}>VAS {p.vas_score}/10</span>
                    </div>
                    {p.description && <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: 4 }}>{p.description}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── FEEDBACK — EDYTOWALNY ── */}
          <Card>
            <SectionHeader>💬 Feedback po treningu <span style={{ color: C.gold, fontSize: '0.55rem', marginLeft: 6 }}>EDYTUJ</span></SectionHeader>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* RPE */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.navy }}>Jak ciężki był trening? (RPE)</span>
                  <span style={{ fontFamily: mono, fontSize: '1rem', fontWeight: 800, color: rpeColor(rpe) }}>{rpe}/10 <span style={{ fontSize: '0.65rem', fontWeight: 400, color: C.gray }}>{rpeLabel(rpe)}</span></span>
                </div>
                <input type="range" min={0} max={10} step={1} value={rpe} onChange={e => setRpe(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: rpeColor(rpe) }} />
                <div style={{ height: 4, background: C.grayLight, borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${rpe * 10}%`, background: rpeColor(rpe), borderRadius: 2, transition: 'width 0.2s' }} />
                </div>
              </div>

              {/* Samopoczucie */}
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.navy, display: 'block', marginBottom: 8 }}>Jak się czułaś po treningu?</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FEELING_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setFeeling(opt.value)}
                      style={{ padding: '0.5rem 0.875rem', background: feeling === opt.value ? C.navy : C.offWhite, border: feeling === opt.value ? 'none' : `1.5px solid ${C.grayLight}`, borderRadius: 10, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5, fontWeight: feeling === opt.value ? 700 : 400, color: feeling === opt.value ? C.gold : C.navy }}>
                      <span>{opt.emoji}</span><span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pola tekstowe */}
              {[
                { label: 'Co poszło dobrze?', val: whatWell, set: setWhatWell, placeholder: 'Np. lepsza technika, więcej energii...', color: C.green },
                { label: 'Ból lub dyskomfort po treningu?', val: painComment, set: setPainComment, placeholder: 'Opisz jeśli coś boli...', color: C.red },
                { label: 'Notatki / uwagi dla trenera', val: notes, set: setNotes, placeholder: 'Pytania, obserwacje...', color: C.gray },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontFamily: mono, fontSize: '0.6rem', color: f.color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 5 }}>{f.label}</div>
                  <textarea value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} rows={2}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', background: C.offWhite, boxSizing: 'border-box' }} />
                </div>
              ))}

              {/* Przyciski */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <button onClick={sendReport} disabled={sending || !feeling}
                  style={{ width: '100%', padding: '0.9rem', background: !feeling ? C.grayLight : C.navy, color: !feeling ? C.gray : C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem', transition: 'all 0.15s' }}>
                  {sending ? 'Wysyłam...' : sendResult === 'ok' ? '✓ Raport wysłany do trenera!' : sendResult === 'err' ? '✗ Błąd — spróbuj ponownie' : '📋 Wyślij raport do trenera'}
                </button>
                <button onClick={saveFeedback} disabled={saving}
                  style={{ width: '100%', padding: '0.75rem', background: saved ? C.green : C.offWhite, color: saved ? C.white : C.gray, border: `1.5px solid ${saved ? C.green : C.grayLight}`, borderRadius: 12, fontWeight: 700, fontSize: '0.82rem' }}>
                  {saving ? 'Zapisuję...' : saved ? '✓ Zapisano' : 'Zapisz bez wysyłania'}
                </button>
              </div>
            </div>
          </Card>

        </main>
      </div>
    </>
  )
}
