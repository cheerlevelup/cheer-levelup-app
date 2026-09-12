'use client'
// src/app/coach/athletes/[id]/CoachAthleteClient.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModuleConfigPanel from '@/components/ModuleConfigPanel'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Button, Modal, StatCard, StatusPill, TabsState } from '@/components/coach/ui'

// Semantyczne kolory (odwołania do tokenów motywu coach-theme.css + kilka
// dodatkowych odcieni spójnych z .coach-report-status/.coach-att-cell itd.,
// tam gdzie w motywie nie ma osobnej zmiennej).
const TONE = {
  green: 'var(--green)',
  gold: 'var(--gold)',
  orange: '#c07f1e',
  red: '#c23b3b',
}

const sectionBoxStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, background: '#fff',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, color: 'var(--muted-light)', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10, fontFamily: 'var(--font-inter),sans-serif' }}>
      {children}
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
}

function avg(arr: number[]): string | null {
  if (arr.length === 0) return null
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
}

function toDateKey(iso: string) {
  return iso ? iso.split('T')[0] : ''
}

function rpeColor(rpe: number) {
  if (rpe <= 4) return TONE.green
  if (rpe <= 6) return TONE.gold
  if (rpe <= 8) return TONE.orange
  return TONE.red
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
  if (risk <= 30) return TONE.green
  if (risk <= 55) return TONE.gold
  if (risk <= 75) return TONE.orange
  return TONE.red
}
function wComment(v: number, arr: string[]) { return arr[Math.max(0, Math.min(arr.length - 1, Math.round(v)))] }
function readinessEmoji(v: number) { return v <= 1 ? '😴' : v <= 3 ? '😪' : v <= 5 ? '😐' : v <= 8 ? '😊' : '⚡' }

type MinimalSetLog = {
  id?: number
  created_at?: string | null
  block_exercise_id?: number | null
  set_number: number
  is_warmup?: boolean | null
}

function dedupeLogs<T extends MinimalSetLog>(logs: T[]) {
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

function WScale({ label, emoji, value, max, unit, comments, inverse }: { label: string; emoji?: string; value: number | null | undefined; max: number; unit?: string; comments?: string[]; inverse?: boolean }) {
  if (value == null) return null
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = wScaleColor(value, max, !!inverse)
  const comment = comments ? wComment(value, comments) : null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--ink)', fontSize: 14.5 }}>
          {emoji && <span style={{ fontSize: 18 }}>{emoji}</span>}
          <span>{label}</span>
        </div>
        <span style={{ fontWeight: 800, color, fontSize: 15 }}>{value}{unit}</span>
      </div>
      <div className="coach-bar-track"><div className="coach-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
      {comment && <div style={{ fontSize: 11.5, fontWeight: 700, color, textAlign: 'center', marginTop: 4 }}>{comment}</div>}
    </div>
  )
}

const motivationLabels: Record<number, { label: string; emoji: string }> = { 1: { label: 'Zerowa', emoji: '😴' }, 2: { label: 'Niska', emoji: '🙄' }, 3: { label: 'Średnia', emoji: '😐' }, 4: { label: 'Wysoka', emoji: '💪' }, 5: { label: 'Ogień!', emoji: '🔥' } }
const feelingLabels: Record<string, string> = { swietnie: '🤩 Świetnie', dobrze: '😊 Dobrze', ok: '😐 OK', zmeczona: '😓 Zmęczona', slabo: '😞 Słabo' }
const goalLabels: Record<string, string> = { tak: '✅ Zrealizowała', czesciowo: '⚡ Częściowo', nie: '❌ Nie', brak: '— Brak planu' }
const cycleColors: Record<string, { color: string; bg: string }> = { menstruacja: { color: '#EF4444', bg: '#FEF2F2' }, folikularna: { color: '#F59E0B', bg: '#FFFBEB' }, owulacja: { color: '#22C55E', bg: '#F0FDF4' }, lutealna: { color: '#A78BFA', bg: '#F5F3FF' } }

function WellnessFullReport({ wellness: w }: { wellness: any }) {
  const act = w.activity_data || {}
  const pain = w.pain_data || {}
  const cycle = w.cycle_phase
  const cycleStyle = cycle ? (cycleColors[cycle] || { color: 'var(--muted)', bg: 'var(--bg)' }) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* BASIC */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
        <SectionLabel>Basic — najważniejsze</SectionLabel>
        {w.sleep_hours != null && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>🌙 Sen — ilość godzin</span>
              <span style={{ fontWeight: 800, color: wScaleColor(w.sleep_hours, 12, false), fontSize: 15 }}>{w.sleep_hours}h</span>
            </div>
            <div className="coach-bar-track"><div className="coach-bar-fill" style={{ width: `${Math.min(100, (w.sleep_hours / 12) * 100)}%`, background: wScaleColor(w.sleep_hours, 12, false) }} /></div>
          </div>
        )}
        <WScale label="Jakość snu" value={w.sleep_quality} max={10} comments={WC.sleepQ} />
        <WScale label={`${readinessEmoji(w.readiness ?? 5)} Poziom wypoczęcia`} value={w.readiness} max={10} comments={WC.readiness} />
        <WScale label="Energia" value={w.energy} max={10} comments={WC.energy} />
        <WScale label="Obciążenie stresem" value={w.stress} max={10} comments={WC.stress} inverse />
        {w.body_weight_kg && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--bg)', borderRadius: 9, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--font-inter),sans-serif' }}>Masa ciała</span>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{w.body_weight_kg} kg</span>
          </div>
        )}
        {cycle && cycleStyle && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: cycleStyle.bg, border: `1px solid ${cycleStyle.color}55`, borderRadius: 9 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cycleStyle.color }} />
            <span style={{ fontWeight: 700, color: cycleStyle.color, fontSize: 14 }}>{cycle.charAt(0).toUpperCase() + cycle.slice(1)}</span>
            {w.cycle_day && <span style={{ fontSize: 11, color: cycleStyle.color, fontFamily: 'var(--font-inter),sans-serif' }}>dzień {w.cycle_day}</span>}
          </div>
        )}
      </div>
      {/* AKTYWNOŚĆ */}
      {(act.type || act.duration) && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
          <SectionLabel>Aktywność dnia</SectionLabel>
          {act.type && <div style={{ display: 'inline-block', padding: '7px 14px', background: 'var(--navy-800)', color: 'var(--gold)', borderRadius: 8, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{act.type}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {act.time && <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>🕐 {act.time}</span>}
            {act.duration && <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>⏱ {act.duration} min</span>}
            {act.motivation && motivationLabels[act.motivation] && <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{motivationLabels[act.motivation].emoji} motywacja: {motivationLabels[act.motivation].label}</span>}
          </div>
          {act.rpe != null && act.rpe > 0 && <WScale label="RPE — ciężkość wysiłku" value={act.rpe} max={10} inverse />}
          {act.feelingAfter && feelingLabels[act.feelingAfter] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--bg)', borderRadius: 9, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Samopoczucie po</span>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{feelingLabels[act.feelingAfter]}</span>
            </div>
          )}
          {act.satisfaction != null && <WScale label="Satysfakcja z treningu" value={act.satisfaction} max={10} />}
          {act.goal && goalLabels[act.goal] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--bg)', borderRadius: 9, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Plan zrealizowany?</span>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{goalLabels[act.goal]}</span>
            </div>
          )}
          {act.goalComment && <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginTop: 4 }}>{act.goalComment}</div>}
          {act.note && <div style={{ marginTop: 8, padding: '9px 14px', background: 'var(--bg)', borderRadius: 9, fontSize: 13.5, color: 'var(--ink)' }}>{act.note}</div>}
        </div>
      )}
      {/* BÓL */}
      {(pain.painDuring > 0 || pain.location || (w.muscle_sorness != null && w.muscle_sorness > 0) || pain.headache > 0 || pain.anxiety > 0 || pain.mentalOverload > 0) && (
        <div style={{ background: '#fdecec', border: '1px solid #f0a3a3', borderRadius: 'var(--radius)', padding: 14 }}>
          <div style={{ fontSize: 10.5, color: '#c23b3b', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>Ból i obciążenie</div>
          {w.muscle_sorness > 0 && <WScale label="Zakwasy" value={w.muscle_sorness} max={10} comments={WC.soreness} inverse />}
          {pain.painDuring > 0 && <WScale label="Ból podczas treningu" value={pain.painDuring} max={10} comments={WC.pain} inverse />}
          {pain.location && <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, fontSize: 13.5, color: 'var(--ink)' }}><span>📍</span><span style={{ fontWeight: 700 }}>{pain.location}</span></div>}
          {pain.note && <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>{pain.note}</div>}
          {pain.headache > 0 && <WScale label="Ból głowy" value={pain.headache} max={10} inverse />}
          {pain.anxiety > 0 && <WScale label="Lęk / niepokój" value={pain.anxiety} max={10} inverse />}
          {pain.mentalOverload > 0 && <WScale label="Przeciążenie mentalne" value={pain.mentalOverload} max={10} inverse />}
          {(pain.anxietySources?.length > 0 || pain.mentalSources?.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {[...(pain.anxietySources || []), ...(pain.mentalSources || [])].map((s: string) => (
                <span key={s} style={{ padding: '2px 9px', background: '#fdd8d8', color: '#c23b3b', borderRadius: 999, fontSize: 11.5, fontWeight: 700 }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {/* SUPLEMENTY */}
      {w.supplements_data?.counts && Object.values(w.supplements_data.counts).some((v: any) => v > 0) && (
        <div style={{ background: '#fdf1de', border: '1px solid var(--gold-light)', borderRadius: 'var(--radius)', padding: 14 }}>
          <div style={{ fontSize: 10.5, color: '#92600a', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>💊 Suplementy</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(w.supplements_data.counts)
              .filter(([, v]: any) => v > 0)
              .map(([id, count]: any) => (
                <span key={id} style={{ padding: '3px 10px', background: '#fbe4b8', border: '1px solid var(--gold-light)', borderRadius: 8, fontSize: 11, color: '#92600a', fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>
                  {id.replace(/_/g, ' ')} × {count}
                </span>
              ))}
          </div>
          {w.supplements_data.note && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, fontStyle: 'italic' }}>{w.supplements_data.note}</div>}
          {w.supplements_data.caffeineSources?.length > 0 && <div style={{ fontSize: 12, color: '#92600a', marginTop: 5 }}>Kofeina z: {w.supplements_data.caffeineSources.join(', ')}</div>}
        </div>
      )}
      {/* UWAGI */}
      {w.concerns && (
        <div style={{ background: '#fdf1de', border: '1px solid var(--gold-light)', borderRadius: 'var(--radius)', padding: 14 }}>
          <div style={{ fontSize: 10.5, color: '#92600a', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>Uwagi dla trenera</div>
          <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{w.concerns}&rdquo;</div>
        </div>
      )}
    </div>
  )
}

// Modal z raportem wellness dla wybranego dnia
function WellnessDetailModal({ wellness, dateLabel, onClose }: { wellness: any; dateLabel: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} eyebrow="Raport wellness" title={dateLabel}
      footer={<Button variant="dark" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>Zamknij</Button>}>
      <WellnessFullReport wellness={wellness} />
    </Modal>
  )
}

function GroupTrainingDetailModal({ training, entries, onClose }: { training: any; entries: any[]; onClose: () => void }) {
  const dateStrRaw = training.training_date
    ? new Date(`${training.training_date}T00:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    : '—'
  const dateStr = dateStrRaw.charAt(0).toUpperCase() + dateStrRaw.slice(1)
  const sorted = [...entries].sort((a, b) => (a.exercise?.exercise_order ?? 0) - (b.exercise?.exercise_order ?? 0))

  return (
    <Modal open onClose={onClose} eyebrow={`Trening grupowy · ${training.group?.name || 'grupa'}`} title={dateStr}
      footer={<Button variant="dark" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>Zamknij</Button>}>
      {sorted.length === 0 && (
        <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', fontFamily: 'var(--font-inter),sans-serif' }}>Brak zapisanych ćwiczeń.</div>
      )}
      {sorted.map((e: any) => (
        <div key={e.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14, marginBottom: 8 }}>
            {e.exercise_override || e.exercise?.name || 'Ćwiczenie'}
            {e.variant && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 8, fontWeight: 400, fontFamily: 'var(--font-inter),sans-serif' }}>({e.variant})</span>}
          </div>
          {(e.sets || []).length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--muted-light)', fontStyle: 'italic', fontFamily: 'var(--font-inter),sans-serif' }}>brak wpisanych serii</div>
          ) : (
            (e.sets || []).map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0', opacity: s.skipped ? 0.5 : 1 }}>
                <span style={{ fontSize: 10.5, color: 'var(--muted)', minWidth: 20, fontFamily: 'var(--font-inter),sans-serif' }}>S{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: (e.bodyweight ? s.reps : s.weight) ? 'var(--ink)' : 'var(--muted)', textDecoration: s.skipped ? 'line-through' : 'none', fontFamily: 'var(--font-inter),sans-serif' }}>
                  {e.bodyweight ? (s.reps ? `${s.reps} powt.` : '—') : (s.weight ? `${s.weight} kg` : '—')}
                </span>
                {!e.bodyweight && s.reps && <span style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{s.reps} powt.</span>}
                {s.tempo && <span style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>tempo {s.tempo}</span>}
                {s.skipped && <span style={{ fontSize: 9, color: '#c23b3b', fontFamily: 'var(--font-inter),sans-serif' }}>nie zrobiona</span>}
              </div>
            ))
          )}
          {(e.pain || e.pain_vas != null) && (
            <div style={{ marginTop: 8, padding: '8px 11px', background: '#fdecec', borderRadius: 8, fontSize: 11, color: '#c23b3b', fontFamily: 'var(--font-inter),sans-serif' }}>
              Ból{e.pain_vas != null ? ` — VAS ${e.pain_vas}` : ''}{e.pain_comment ? `: ${e.pain_comment}` : ''}
            </div>
          )}
          {e.comment && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink)', fontStyle: 'italic' }}>&ldquo;{e.comment}&rdquo;</div>}
        </div>
      ))}
    </Modal>
  )
}

interface Props {
  athlete: any
  assignment: any
  pastAssignments: any[]
  sessions: any[]
  feedbacks: any[]
  wellnessLogs: any[]
  wellnessList: any[]
  groupTrainingEntries: any[]
  painLogs: any[]
  groupModuleConfigs: any[]
  athleteModuleConfigs: any[]
  allGroups: any[]
  allPlans: any[]
}

// ── Modal — zmiana grupy ───────────────────────────────────────────────────────
function MoveToGroupModal({ athlete, allGroups, onClose, onMoved }: {
  athlete: any; allGroups: any[]; onClose: () => void; onMoved: (newGroup: any) => void
}) {
  const [targetGroupId, setTargetGroupId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleMove() {
    if (!targetGroupId) return
    setSaving(true); setError('')
    const supabase = createClient()
    const groupId = parseInt(targetGroupId)
    const { data, error: err } = await supabase
      .from('athletes')
      .update({ group_id: groupId })
      .eq('id', athlete.id)
      .select('*, group:groups(*)')
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    onMoved(data?.group)
    onClose()
  }

  const others = allGroups.filter(g => g.id !== athlete.group_id)

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Zarządzanie zawodniczką"
      title="Przenieś do innej grupy"
      sub="Plan treningowy pozostanie bez zmian."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleMove} disabled={!targetGroupId || saving}>
            {saving ? 'Przenoszę...' : 'Przenieś'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '45vh', overflowY: 'auto' }}>
        {others.map(g => (
          <div
            key={g.id}
            onClick={() => setTargetGroupId(String(g.id))}
            style={{
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${targetGroupId === String(g.id) ? 'var(--gold)' : 'var(--border)'}`,
              background: targetGroupId === String(g.id) ? 'var(--navy-900)' : '#fff',
              color: targetGroupId === String(g.id) ? 'var(--gold)' : 'var(--ink)',
              fontWeight: 600, fontFamily: 'var(--font-inter),sans-serif', fontSize: 13.5,
            }}
          >
            {g.name}
            {g.group_type === 'managed' && <span style={{ fontSize: 10, marginLeft: 8, textTransform: 'uppercase', letterSpacing: '.05em', opacity: 0.7 }}>zorganizowana</span>}
            {g.training_level && <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7 }}>{g.training_level}</span>}
          </div>
        ))}
        {others.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', fontFamily: 'var(--font-inter),sans-serif' }}>Brak innych grup.</div>}
      </div>
      {error && <div style={{ color: '#c23b3b', fontSize: 12.5, marginTop: 10 }}>Błąd: {error}</div>}
    </Modal>
  )
}

// ── Modal — zmiana planu ───────────────────────────────────────────────────────
function ChangePlanModal({ athlete, currentAssignment, allPlans, onClose, onChanged }: {
  athlete: any; currentAssignment: any; allPlans: any[]; onClose: () => void; onChanged: (newAssignment: any) => void
}) {
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [orderMode, setOrderMode] = useState<'sequential' | 'dated'>('sequential')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activePlans = allPlans.filter(p => !p.is_archived)
  const archivedPlans = allPlans.filter(p => p.is_archived)

  async function handleChange() {
    if (!selectedPlanId) return
    setSaving(true); setError('')
    const supabase = createClient()
    try {
      if (currentAssignment) {
        const { error: deactErr } = await supabase
          .from('athlete_workout_assignments')
          .update({ is_active: false })
          .eq('id', currentAssignment.id)
        if (deactErr) throw deactErr
      }
      const { data: newAssignment, error: insertErr } = await supabase
        .from('athlete_workout_assignments')
        .insert({
          athlete_id: athlete.id,
          plan_id: parseInt(selectedPlanId),
          is_active: true,
          order_mode: orderMode,
          start_date: new Date().toISOString().split('T')[0],
        })
        .select('*, plan:workout_plans(*)')
        .single()
      if (insertErr) throw insertErr
      onChanged(newAssignment)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Nie udało się zmienić planu')
    }
    setSaving(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Zmiana planu"
      title="Przypisz nowy plan treningowy"
      sub={currentAssignment ? `Obecny plan: ${currentAssignment.plan?.name} zostanie zdezaktywowany.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleChange} disabled={!selectedPlanId || saving}>
            {saving ? 'Zapisuję...' : 'Przypisz plan'}
          </Button>
        </>
      }
    >
      {activePlans.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Aktywne plany</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activePlans.map(p => (
              <div key={p.id} onClick={() => setSelectedPlanId(String(p.id))}
                style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${selectedPlanId === String(p.id) ? 'var(--gold)' : 'var(--border)'}`, background: selectedPlanId === String(p.id) ? 'var(--navy-900)' : '#fff', color: selectedPlanId === String(p.id) ? 'var(--gold)' : 'var(--ink)', fontWeight: 600, fontFamily: 'var(--font-inter),sans-serif', fontSize: 13.5 }}>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      )}
      {archivedPlans.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Archiwalne</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {archivedPlans.map(p => (
              <div key={p.id} onClick={() => setSelectedPlanId(String(p.id))}
                style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${selectedPlanId === String(p.id) ? 'var(--gold)' : 'var(--border)'}`, background: selectedPlanId === String(p.id) ? 'var(--navy-900)' : '#fafafa', color: selectedPlanId === String(p.id) ? 'var(--gold)' : 'var(--muted)', fontWeight: 500, fontFamily: 'var(--font-inter),sans-serif', fontSize: 13.5, opacity: 0.9 }}>
                📦 {p.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10.5, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Tryb realizacji</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {(['sequential', 'dated'] as const).map(mode => (
            <button key={mode} onClick={() => setOrderMode(mode)}
              style={{ padding: '10px', borderRadius: 9, border: `1px solid ${orderMode === mode ? 'var(--gold)' : 'var(--border)'}`, background: orderMode === mode ? 'var(--navy-900)' : '#fff', color: orderMode === mode ? 'var(--gold)' : 'var(--ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif' }}>
              {mode === 'sequential' ? '📋 Sekwencyjny' : '📅 Datowany'}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ color: '#c23b3b', fontSize: 12.5 }}>Błąd: {error}</div>}
    </Modal>
  )
}

// Session feedback detail modal for athlete profile — ładuje dane dynamicznie
function SessionFeedbackModal({ session, onClose }: { session: any; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<any | null>(null)
  const [setLogs, setSetLogs] = useState<any[]>([])
  const [blocks, setBlocks] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const sb = createClient()
      try {
        const r = await sb.from('post_session_feedback').select('*').eq('workout_session_id', session.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        setFeedback(r.data || null)
      } catch {}
      try {
        const r = await sb.from('set_logs').select('*').eq('workout_session_id', session.id).order('set_number', { ascending: true })
        setSetLogs(r.data || [])
      } catch {}
      if (session.workout_day_id) {
        try {
          const r = await sb.from('workout_day_blocks').select('*, workout_block_exercises(id, exercise_id, exercise_code, sets, reps, weight_kg, exercise:exercises(name))').eq('day_id', session.workout_day_id).order('block_order', { ascending: true })
          setBlocks(r.data || [])
        } catch {}
      }
      setLoading(false)
    }
    load()
  }, [session.id, session.workout_day_id])

  const dateStr = session.date_completed
    ? new Date(session.date_completed).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    : '—'
  const rpeC = (rpe: number) => rpe >= 9 ? TONE.red : rpe >= 7 ? TONE.orange : rpe >= 5 ? TONE.gold : TONE.green

  const exNameMap: Record<number, string> = {}
  const exPlanMap: Record<number, string> = {}
  for (const b of blocks) {
    for (const ex of (b.workout_block_exercises || [])) {
      exNameMap[ex.id] = ex.exercise?.name ? ex.exercise.name.replace(/-/g, ' ') : (ex.exercise_code || `Ćw.#${ex.id}`)
      exPlanMap[ex.id] = `${ex.sets}×${ex.reps || '—'}${ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}`
    }
  }
  const logsByEx: Record<number, any[]> = {}
  for (const l of dedupeLogs(setLogs)) {
    if (!l.block_exercise_id) continue
    if (!logsByEx[l.block_exercise_id]) logsByEx[l.block_exercise_id] = []
    logsByEx[l.block_exercise_id].push(l)
  }
  const orderedExIds: number[] = []
  for (const b of blocks) for (const ex of (b.workout_block_exercises || [])) orderedExIds.push(ex.id)

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Raport z treningu"
      title={session.workout_day?.day_name || 'Trening'}
      sub={dateStr}
      footer={<Button variant="dark" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>Zamknij</Button>}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>Ładowanie...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {feedback && (
            <div style={{ display: 'flex', gap: 8 }}>
              {feedback.session_rpe != null && (
                <div style={{ flex: 1, background: rpeC(feedback.session_rpe) + '18', border: `1px solid ${rpeC(feedback.session_rpe)}`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 3, fontFamily: 'var(--font-inter),sans-serif' }}>RPE</div>
                  <div style={{ fontWeight: 800, fontSize: 26, color: rpeC(feedback.session_rpe), lineHeight: 1 }}>{feedback.session_rpe}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--font-inter),sans-serif' }}>{feedback.session_rpe <= 3 ? 'Lekki' : feedback.session_rpe <= 5 ? 'Umiarkowany' : feedback.session_rpe <= 7 ? 'Ciężki' : 'Bardzo ciężki'}</div>
                </div>
              )}
              {feedback.feeling_after && (
                <div style={{ flex: 1.5, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4, fontFamily: 'var(--font-inter),sans-serif' }}>Po treningu</div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{({'swietnie': '💪 Świetnie', 'dobrze': '😊 Dobrze', 'srednie': '😐 Średnio', 'zmeczona': '😓 Zmęczona', 'slabo': '😞 Słabo'} as Record<string,string>)[feedback.feeling_after] || feedback.feeling_after}</div>
                </div>
              )}
            </div>
          )}
          {orderedExIds.filter(id => logsByEx[id]?.length > 0).length > 0 && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', background: 'var(--navy-900)', fontSize: 10, color: 'var(--gold)', letterSpacing: '.04em', textTransform: 'uppercase', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>🏋️ Wykonane serie</div>
              {orderedExIds.filter(id => logsByEx[id]?.length > 0).map(exId => {
                const logs = logsByEx[exId].sort((a: any, b: any) => a.set_number - b.set_number)
                const main = logs.filter((l: any) => !l.is_warmup)
                const wu = logs.filter((l: any) => l.is_warmup)
                return (
                  <div key={exId} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14 }}>{exNameMap[exId] || `Ćw.#${exId}`}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{exPlanMap[exId]}</span>
                    </div>
                    {wu.map((l: any) => (
                      <div key={l.id} style={{ padding: '3px 0', opacity: 0.75 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--muted)', minWidth: 38, fontFamily: 'var(--font-inter),sans-serif' }}>Rozg</span>
                          <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{l.weight ? `${l.weight} kg` : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{l.reps_completed ? `${l.reps_completed}p` : '—'}</span>
                        </div>
                        {l.athlete_note && <div style={{ marginLeft: 48, marginTop: 2, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', fontFamily: 'var(--font-inter),sans-serif' }}>&ldquo;{l.athlete_note}&rdquo;</div>}
                      </div>
                    ))}
                    {main.map((l: any) => (
                      <div key={l.id} style={{ padding: '3px 0' }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ fontSize: 11, color: l.completed ? 'var(--gold)' : 'var(--muted)', fontWeight: 700, minWidth: 38, fontFamily: 'var(--font-inter),sans-serif' }}>S{l.set_number}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: l.weight ? 'var(--ink)' : 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{l.weight ? `${l.weight} kg` : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{l.reps_completed ? `${l.reps_completed}p` : '—'}</span>
                        </div>
                        {l.athlete_note && <div style={{ marginLeft: 48, marginTop: 2, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', fontFamily: 'var(--font-inter),sans-serif' }}>&ldquo;{l.athlete_note}&rdquo;</div>}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
          {(feedback?.what_went_well || feedback?.pain_after_comment || feedback?.general_notes) && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>💬 Feedback</div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {feedback.what_went_well && <div><div style={{ fontSize: 10, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 2, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Co poszło dobrze</div><div style={{ fontSize: 13.5, color: 'var(--ink)', fontStyle: 'italic' }}>&ldquo;{feedback.what_went_well}&rdquo;</div></div>}
                {feedback.pain_after_comment && <div><div style={{ fontSize: 10, color: '#c23b3b', textTransform: 'uppercase', marginBottom: 2, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Ból/dyskomfort</div><div style={{ fontSize: 13.5, color: 'var(--ink)', fontStyle: 'italic' }}>&ldquo;{feedback.pain_after_comment}&rdquo;</div></div>}
                {feedback.general_notes && <div><div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>Uwagi</div><div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{feedback.general_notes}</div></div>}
              </div>
            </div>
          )}
          {!feedback && setLogs.length === 0 && <div style={{ textAlign: 'center', padding: 16, fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>Brak danych dla tej sesji.</div>}
        </div>
      )}
    </Modal>
  )
}

type MainTab = 'overview' | 'wellness'

export default function CoachAthleteClient({ athlete, assignment, pastAssignments, sessions, feedbacks, wellnessLogs, wellnessList, groupTrainingEntries, painLogs, groupModuleConfigs, athleteModuleConfigs, allGroups, allPlans }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [planTab, setPlanTab] = useState<'active' | 'history'>('active')
  const [movingGroup, setMovingGroup] = useState(false)
  const [changingPlan, setChangingPlan] = useState(false)
  const [localAthlete, setLocalAthlete] = useState(athlete)
  const [localAssignment, setLocalAssignment] = useState(assignment)
  const [selectedWellness, setSelectedWellness] = useState<{ wellness: any; dateLabel: string } | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('overview')
  const [moduleConfig, setModuleConfig] = useState<'wellness' | null>(null)
  const [localAthleteModuleConfigs, setLocalAthleteModuleConfigs] = useState<any[]>(athleteModuleConfigs)
  const [selectedSessionFeedback, setSelectedSessionFeedback] = useState<{ session: any } | null>(null)
  const [selectedGroupTraining, setSelectedGroupTraining] = useState<{ training: any; entries: any[] } | null>(null)
  const inheritedModuleConfig = moduleConfig
    ? groupModuleConfigs.find((config: any) => config.module === moduleConfig)
    : null

  const moduleDefaults = {
    wellness: {
      pre: ['sleep_hours', 'sleep_quality', 'readiness', 'energy', 'stress', 'muscle_soreness', 'hydration', 'recovery_score'],
      post: [],
    },
  }
  const groupConfigFor = (module: 'wellness') => groupModuleConfigs.find((config: any) => config.module === module)
  const athleteConfigFor = (module: 'wellness') => localAthleteModuleConfigs.find((config: any) => config.module === module)
  const effectiveConfigFor = (module: 'wellness') => athleteConfigFor(module) || groupConfigFor(module)
  const isModuleEnabled = (module: 'wellness') => effectiveConfigFor(module)?.enabled !== false
  const configSource = (module: 'wellness') => athleteConfigFor(module) ? 'indywidualnie' : 'wg grupy'
  const sameList = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every(item => b.includes(item))

  async function saveModuleAccess(module: 'wellness', enabled: boolean) {
    const athleteConfig = athleteConfigFor(module)
    const groupConfig = groupConfigFor(module)
    const groupEnabled = groupConfig?.enabled !== false
    const defaults = moduleDefaults[module]
    const groupPre = groupConfig?.pre_params || defaults.pre
    const groupPost = groupConfig?.post_params || defaults.post

    if (enabled === groupEnabled) {
      const hasCustomParams = athleteConfig && (
        !sameList(athleteConfig.pre_params || [], groupPre)
        || !sameList(athleteConfig.post_params || [], groupPost)
      )
      if (!hasCustomParams) {
        if (athleteConfig?.id) {
          const { error } = await supabase.from('group_module_config').delete().eq('id', athleteConfig.id)
          if (error) return
        }
        setLocalAthleteModuleConfigs(prev => prev.filter(config => config.module !== module))
        return
      }
    }

    const current = athleteConfig || groupConfig
    const { data, error } = await supabase
      .from('group_module_config')
      .upsert({
        athlete_id: athlete.id,
        module,
        enabled,
        pre_params: current?.pre_params || defaults.pre,
        post_params: current?.post_params || defaults.post,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'athlete_id,module' })
      .select('id, group_id, athlete_id, module, enabled, pre_params, post_params, updated_at')
      .single()

    if (error) return
    setLocalAthleteModuleConfigs(prev => [...prev.filter(config => config.module !== module), data])
  }

  const completedSessions = sessions.filter(s => s.completed)
  const feedbackMap: Record<number, any> = {}
  for (const f of feedbacks) feedbackMap[f.workout_session_id || f.session_id] = f

  const avgRpe = feedbacks.length > 0
    ? avg(feedbacks.map(f => f.session_rpe).filter((v): v is number => v != null))
    : null

  const wellnessSleepAvg = avg(wellnessLogs.map(w => w.sleep_hours).filter((v): v is number => v != null))
  const wellnessEnergyAvg = avg(wellnessLogs.map(w => w.energy).filter((v): v is number => v != null))
  const wellnessStressAvg = avg(wellnessLogs.map(w => w.stress).filter((v): v is number => v != null))
  const wellnessReadinessAvg = avg(wellnessLogs.map(w => w.readiness).filter((v): v is number => v != null))

  // Indeksy po dacie
  const wellnessByDate: Record<string, any> = {}
  for (const w of wellnessLogs) {
    const k = toDateKey(w.created_at)
    if (k) wellnessByDate[k] = w
  }
  const completedByDate: Record<string, { session: any; num: number }> = {}
  const sortedCompleted = [...completedSessions].sort(
    (a, b) => new Date(a.date_completed || a.date_started || 0).getTime() - new Date(b.date_completed || b.date_started || 0).getTime()
  )
  sortedCompleted.forEach((s, i) => {
    const key = toDateKey(s.date_completed || s.date_started || '')
    if (key) completedByDate[key] = { session: s, num: i + 1 }
  })

  // Historia treningów grup zorganizowanych — po wpisach (athlete_id), nie po
  // aktualnej grupie, więc zostaje widoczna nawet po zmianie/opuszczeniu grupy.
  const groupTrainingsById = new Map<number, { training: any; entries: any[] }>()
  for (const e of (groupTrainingEntries || [])) {
    const t = e.training
    if (!t?.id) continue
    if (!groupTrainingsById.has(t.id)) groupTrainingsById.set(t.id, { training: t, entries: [] })
    groupTrainingsById.get(t.id)!.entries.push(e)
  }
  const groupTrainingsList = Array.from(groupTrainingsById.values())
    .sort((a, b) => (b.training.training_date || '').localeCompare(a.training.training_date || ''))

  // Klucz liczymy tak samo jak komórkę kalendarza (lokalna północ → ISO), żeby
  // trening trafił na właściwy dzień.
  const groupTrainingDates = new Set<string>()
  const groupTrainingsByDateKey = new Map<string, { training: any; entries: any[] }>()
  for (const gt of groupTrainingsList) {
    if (!gt.training.training_date) continue
    const key = new Date(`${gt.training.training_date}T00:00:00`).toISOString().split('T')[0]
    groupTrainingDates.add(key)
    groupTrainingsByDateKey.set(key, gt)
  }

  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const todayKey = todayDate.toISOString().split('T')[0]
  const calendarDays: Date[] = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(todayDate); d.setDate(d.getDate() - i); calendarDays.push(d)
  }
  const weeks: Date[][] = []
  for (let i = 0; i < calendarDays.length; i += 7) weeks.push(calendarDays.slice(i, i + 7))
  const dayNames = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']

  const lastWellness = wellnessList[0]

  function openWellness(key: string) {
    const w = wellnessByDate[key]
    if (!w) return
    const day = new Date(key)
    const dateLabel = day.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    setSelectedWellness({ wellness: w, dateLabel })
  }

  return (
    <>
      <SetPageMeta title={localAthlete.full_name} backHref="/coach/groups" backLabel="Grupy" />

      {selectedSessionFeedback && (
        <SessionFeedbackModal
          session={selectedSessionFeedback.session}
          onClose={() => setSelectedSessionFeedback(null)}
        />
      )}
      {selectedWellness && (
        <WellnessDetailModal
          wellness={selectedWellness.wellness}
          dateLabel={selectedWellness.dateLabel}
          onClose={() => setSelectedWellness(null)}
        />
      )}
      {selectedGroupTraining && (
        <GroupTrainingDetailModal
          training={selectedGroupTraining.training}
          entries={selectedGroupTraining.entries}
          onClose={() => setSelectedGroupTraining(null)}
        />
      )}
      {moduleConfig && (
        <ModuleConfigPanel
          athleteId={athlete.id}
          module={moduleConfig}
          groupConfig={inheritedModuleConfig ? {
            enabled: inheritedModuleConfig.enabled ?? true,
            pre: inheritedModuleConfig.pre_params || [],
            post: inheritedModuleConfig.post_params || [],
          } : null}
          onClose={() => setModuleConfig(null)}
        />
      )}
      {movingGroup && (
        <MoveToGroupModal
          athlete={localAthlete}
          allGroups={allGroups}
          onClose={() => setMovingGroup(false)}
          onMoved={newGroup => setLocalAthlete((prev: any) => ({ ...prev, group_id: newGroup?.id, group: newGroup }))}
        />
      )}
      {changingPlan && (
        <ChangePlanModal
          athlete={localAthlete}
          currentAssignment={localAssignment}
          allPlans={allPlans}
          onClose={() => setChangingPlan(false)}
          onChanged={newAssignment => setLocalAssignment(newAssignment)}
        />
      )}

      <div className="coach-content">
        <div className="coach-comp-card">
          <div className="coach-comp-card-head">
            <div className="coach-comp-card-head-left">
              <div className="coach-comp-avatar-lg">{initials(localAthlete.full_name)}</div>
              <div>
                <h3 className="coach-comp-card-name">{localAthlete.full_name}</h3>
                {localAthlete.group?.name && <div className="coach-comp-card-sub">📁 {localAthlete.group.name}</div>}
              </div>
            </div>
          </div>

          <TabsState
            items={[
              { key: 'overview', label: 'Przegląd' },
              { key: 'wellness', label: 'Wellness' },
            ]}
            active={mainTab}
            onChange={k => setMainTab(k as MainTab)}
          />

          <div className="coach-comp-tab-body">
            {mainTab === 'wellness' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={sectionBoxStyle}>
                  <SectionLabel>Konfiguracja wellness</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <StatusPill label={isModuleEnabled('wellness') ? 'Wellness włączony' : 'Wellness wyłączony'} tone={isModuleEnabled('wellness') ? 'green' : 'red'} />
                    <span style={{ fontSize: 11, color: athleteConfigFor('wellness') ? 'var(--gold)' : 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{configSource('wellness')}</span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 14, fontFamily: 'var(--font-inter),sans-serif' }}>
                    Wybierz które parametry wellness widzi ta zawodniczka. Nadpisuje ustawienia grupy.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      onClick={() => saveModuleAccess('wellness', !isModuleEnabled('wellness'))}
                      style={isModuleEnabled('wellness')
                        ? { color: '#c23b3b', background: '#fdecec' }
                        : { color: '#1f9d64', background: '#e9f9f0' }}
                    >
                      {isModuleEnabled('wellness') ? 'Wyłącz wellness' : 'Włącz wellness'}
                    </Button>
                    <Button variant="dark" onClick={() => setModuleConfig('wellness')}>🩺 Edytuj parametry wellness</Button>
                    <Button variant="ghost" onClick={() => router.push(`/coach/athletes/${athlete.id}/training`)}>Zobacz historię →</Button>
                  </div>
                </div>

                {wellnessLogs.length > 0 && (
                  <div style={sectionBoxStyle}>
                    <SectionLabel>Ostatnie wpisy wellness</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {wellnessLogs.slice(0, 7).map((w: any, i: number) => (
                        <button
                          key={w.id}
                          onClick={() => setSelectedWellness({ wellness: w, dateLabel: new Date(w.date || w.created_at).toLocaleDateString('pl-PL') })}
                          style={{ width: '100%', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', padding: '10px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, fontFamily: 'var(--font-inter),sans-serif' }}>
                            {new Date(w.date || w.created_at).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {w.energy != null && <span style={{ fontSize: 11.5, color: 'var(--gold)', fontFamily: 'var(--font-inter),sans-serif' }}>⚡{w.energy}</span>}
                            {w.sleep_hours != null && <span style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>🌙{w.sleep_hours}h</span>}
                            {w.readiness != null && <span style={{ fontSize: 11.5, color: 'var(--green)', fontFamily: 'var(--font-inter),sans-serif' }}>💪{w.readiness}</span>}
                            <span style={{ color: 'var(--muted-light)' }}>›</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Profil + Plan */}
                <div style={{ ...sectionBoxStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <SectionLabel>Profil</SectionLabel>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>{localAthlete.full_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                      {localAthlete.group?.name && <span style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>📁 {localAthlete.group.name}</span>}
                      <button className="coach-action-link coach-manage" onClick={() => setMovingGroup(true)}>Zmień</button>
                    </div>
                    {localAthlete.birth_year && <div style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>ur. {localAthlete.birth_year}</div>}
                  </div>

                  <div>
                    <div style={{ display: 'flex', gap: 1, marginBottom: 12 }}>
                      {(['active', 'history'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setPlanTab(tab)}
                          style={{
                            padding: '7px 12px', border: 'none', borderRadius: tab === 'active' ? '8px 0 0 8px' : '0 8px 8px 0',
                            background: planTab === tab ? 'var(--navy-900)' : 'var(--border)', color: planTab === tab ? 'var(--gold)' : 'var(--muted)',
                            fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif',
                          }}
                        >
                          {tab === 'active' ? 'Aktywny' : `Historia (${pastAssignments.length})`}
                        </button>
                      ))}
                    </div>

                    {planTab === 'active' ? (
                      localAssignment ? (
                        <div className="coach-plan-card">
                          <div className="coach-plan-card-top">
                            <span className="coach-plan-name">{localAssignment.plan?.name}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif', marginBottom: 10 }}>
                            {localAssignment.order_mode === 'sequential' ? 'Sekwencyjny' : 'Datowany'} · od {new Date(localAssignment.start_date).toLocaleDateString('pl-PL')}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Button size="small" variant="dark" onClick={() => router.push(`/coach/athletes/${localAthlete.id}/training`)}>✎ Modyfikuj ćwiczenia →</Button>
                            <Button size="small" variant="ghost" onClick={() => setChangingPlan(true)}>🔄 Zmień plan</Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ color: 'var(--muted)', fontSize: 13.5, fontStyle: 'italic', marginBottom: 10, fontFamily: 'var(--font-inter),sans-serif' }}>Brak aktywnego planu</div>
                          <Button size="small" variant="dark" onClick={() => setChangingPlan(true)}>+ Przypisz plan</Button>
                        </div>
                      )
                    ) : (
                      pastAssignments.length === 0 ? (
                        <div style={{ color: 'var(--muted)', fontSize: 13.5, fontStyle: 'italic', fontFamily: 'var(--font-inter),sans-serif' }}>Brak historii planów</div>
                      ) : (
                        <div className="coach-plan-list">
                          {pastAssignments.map(a => (
                            <div key={a.id} className="coach-plan-card">
                              <div className="coach-plan-name">{a.plan?.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif', marginTop: 4 }}>
                                od {new Date(a.start_date || a.created_at).toLocaleDateString('pl-PL')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Szybkie statystyki */}
                <div className="coach-stats">
                  <StatCard label="Treningi" value={completedSessions.length + groupTrainingDates.size} tone="blue" />
                  <StatCard label="Śr. RPE" value={avgRpe ?? '—'} tone="amber" />
                  <StatCard label="Wellness" value={`${wellnessLogs.length}d`} tone="green" />
                </div>

                {/* Wellness — średnie */}
                {wellnessLogs.length > 0 && (
                  <div style={sectionBoxStyle}>
                    <SectionLabel>{`Wellness — średnie z 28 dni (${wellnessLogs.length} wpisów)`}</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                      {[
                        { label: 'Sen', value: wellnessSleepAvg, unit: 'h', max: 12, inverse: false },
                        { label: 'Energia', value: wellnessEnergyAvg, unit: '/10', max: 10, inverse: false },
                        { label: 'Stres', value: wellnessStressAvg, unit: '/10', max: 10, inverse: true },
                        { label: 'Gotowość', value: wellnessReadinessAvg, unit: '/10', max: 10, inverse: false },
                      ].map(stat => {
                        const num = stat.value ? parseFloat(stat.value) : null
                        const pct = num ? (num / stat.max) * 100 : 0
                        const barColor = stat.inverse ? (pct > 60 ? TONE.red : pct > 30 ? TONE.gold : TONE.green) : (pct > 60 ? TONE.green : pct > 30 ? TONE.gold : TONE.red)
                        return (
                          <div key={stat.label}>
                            <div style={{ fontSize: 10.5, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>{stat.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{stat.value ?? '—'}{stat.value ? stat.unit : ''}</div>
                            {num != null && (
                              <div className="coach-bar-track"><div className="coach-bar-fill" style={{ width: `${pct}%`, background: barColor }} /></div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Kalendarz — klikalne kółeczka wellness */}
                <div style={sectionBoxStyle}>
                  <SectionLabel>Kalendarz — ostatnie 28 dni</SectionLabel>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
                      <thead>
                        <tr>
                          {dayNames.map(d => (
                            <th key={d} style={{ padding: '0 4px 8px', textAlign: 'center', fontSize: 10.5, color: 'var(--muted)', fontWeight: 700, fontFamily: 'var(--font-inter),sans-serif' }}>{d}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {weeks.map((week, wi) => (
                          <tr key={wi}>
                            {week.map(day => {
                              const key = day.toISOString().split('T')[0]
                              const isToday = key === todayKey
                              const wellnessEntry = wellnessByDate[key]
                              const hasWellness = !!wellnessEntry
                              const trainingInfo = completedByDate[key]
                              return (
                                <td key={key} style={{ padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                  <div style={{ minHeight: 72, padding: '5px 3px', borderRadius: 8, background: isToday ? 'var(--navy-800)' : 'transparent', border: isToday ? '1px solid var(--gold)' : '1px solid transparent' }}>
                                    <div style={{ fontSize: 10.5, color: isToday ? 'var(--gold)' : 'var(--muted)', fontWeight: isToday ? 700 : 400, marginBottom: 5, fontFamily: 'var(--font-inter),sans-serif' }}>
                                      {day.getDate()}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                      {/* Wellness — klikalny jeśli uzupełniony */}
                                      <button
                                        title={hasWellness ? 'Kliknij aby zobaczyć raport wellness' : 'Brak wellness tego dnia'}
                                        onClick={() => hasWellness && openWellness(key)}
                                        style={{
                                          width: 16, height: 16, borderRadius: '50%',
                                          background: hasWellness ? 'var(--green)' : '#c23b3b',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 9, color: '#fff', fontWeight: 800,
                                          border: 'none', padding: 0,
                                          cursor: hasWellness ? 'pointer' : 'default',
                                        }}
                                      >
                                        {hasWellness ? '✓' : ''}
                                      </button>
                                      {/* Trening indywidualny (nr w planie) */}
                                      {trainingInfo && (
                                        <div title={`Trening #${trainingInfo.num}`} style={{ position: 'relative', width: 18, height: 18 }}>
                                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🏋️</div>
                                          <div style={{ position: 'absolute', top: -4, right: -5, width: 12, height: 12, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: 'var(--navy-900)' }}>
                                            {trainingInfo.num}
                                          </div>
                                        </div>
                                      )}
                                      {/* Trening grupy zorganizowanej — obecna, klikalna jeśli są zapisane dane */}
                                      {!trainingInfo && groupTrainingDates.has(key) && (
                                        <button
                                          title="Trening grupowy — kliknij aby zobaczyć"
                                          onClick={() => setSelectedGroupTraining(groupTrainingsByDateKey.get(key) || null)}
                                          style={{ position: 'relative', width: 18, height: 18, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                                        >
                                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🏋️</div>
                                          <div style={{ position: 'absolute', top: -4, right: -5, width: 12, height: 12, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#fff' }}>
                                            ✓
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="coach-att-legend" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <span><span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} /> Wellness ✓ (kliknij aby zobaczyć)</span>
                    <span><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#c23b3b', display: 'inline-block' }} /> Wellness brak</span>
                    <span><span style={{ fontSize: 12 }}>🏋️</span> Trening (nr w planie)</span>
                    <span><span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--green)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 900 }}>✓</span> Trening grupowy (obecna)</span>
                  </div>
                </div>

                {/* Ostatni wellness */}
                {lastWellness && (
                  <div style={sectionBoxStyle}>
                    <SectionLabel>{`Ostatni wellness — ${new Date(lastWellness.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}`}</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                      {([
                        ['Sen', lastWellness.sleep_hours != null ? `${lastWellness.sleep_hours}h` : null],
                        ['Energia', lastWellness.energy != null ? `${lastWellness.energy}/10` : null],
                        ['Stres', lastWellness.stress != null ? `${lastWellness.stress}/10` : null],
                        ['Gotowość', lastWellness.readiness != null ? `${lastWellness.readiness}/10` : null],
                      ] as [string, string | null][]).filter(([, v]) => v != null).map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: 10.5, color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700 }}>{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    {lastWellness.concerns && (
                      <div style={{ background: '#fdf1de', border: '1px solid var(--gold-light)', borderRadius: 10, padding: 12, fontSize: 13.5, color: 'var(--ink)', fontStyle: 'italic' }}>
                        💬 &ldquo;{lastWellness.concerns}&rdquo;
                      </div>
                    )}
                  </div>
                )}

                {/* Zgłoszenia bólu */}
                {painLogs.length > 0 && (
                  <div style={sectionBoxStyle}>
                    <SectionLabel>Zgłoszenia bólu</SectionLabel>
                    {painLogs.slice(0, 5).map((p: any) => (
                      <div key={p.id} className="coach-injury-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.pain_location || '—'}</div>
                          {p.pain_comment && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{p.pain_comment}</div>}
                          <div style={{ fontSize: 11, color: 'var(--muted-light)', marginTop: 4, fontFamily: 'var(--font-inter),sans-serif' }}>{new Date(p.created_at).toLocaleDateString('pl-PL')}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: p.vas_score >= 7 ? '#c23b3b' : p.vas_score >= 4 ? '#c07f1e' : 'var(--green)', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                          VAS {p.vas_score}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Historia treningów */}
                <div style={sectionBoxStyle}>
                  <SectionLabel>Historia treningów</SectionLabel>
                  {completedSessions.length === 0 ? (
                    <div className="coach-empty-list">Brak ukończonych treningów.</div>
                  ) : (
                    <div className="coach-report-list">
                      {completedSessions.slice(0, 15).map((s: any) => {
                        const fb = feedbackMap[s.id]
                        const hasFeedback = !!fb
                        return (
                          <div key={s.id} className="coach-report-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedSessionFeedback({ session: s })}>
                            <div className="coach-report-card-top">
                              <span className="coach-report-date">
                                {s.date_completed ? new Date(s.date_completed).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '—'}
                                {s.workout_day?.week?.plan?.name && ` · ${s.workout_day.week.plan.name}`}
                              </span>
                              <span className={`coach-report-status ${hasFeedback ? 'coach-ok' : 'coach-pending'}`}>{hasFeedback ? 'feedback' : 'bez feedbacku'}</span>
                            </div>
                            <div className="coach-report-title">
                              {s.workout_day?.day_name || 'Trening'}
                              {s.report_sent && ' · 📋'}
                              {fb?.session_rpe && <span style={{ marginLeft: 8, color: rpeColor(fb.session_rpe), fontWeight: 700 }}>RPE {fb.session_rpe}</span>}
                            </div>
                            {fb?.what_went_well && <div className="coach-report-note">&ldquo;{fb.what_went_well}&rdquo;</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Historia treningów grupowych — po wpisach, więc widoczna nawet po zmianie grupy */}
                {groupTrainingsList.length > 0 && (
                  <div style={sectionBoxStyle}>
                    <SectionLabel>Historia treningów grupowych</SectionLabel>
                    <div className="coach-report-list">
                      {groupTrainingsList.slice(0, 15).map(gt => (
                        <div key={gt.training.id} className="coach-report-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedGroupTraining(gt)}>
                          <div className="coach-report-card-top">
                            <span className="coach-report-date">
                              {gt.training.training_date ? new Date(`${gt.training.training_date}T00:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '—'}
                            </span>
                            <span className="coach-report-status coach-ok">{gt.entries.length} ćwiczeń</span>
                          </div>
                          <div className="coach-report-title">{gt.training.group?.name || 'Grupa'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
