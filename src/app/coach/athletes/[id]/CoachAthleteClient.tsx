'use client'
// src/app/coach/athletes/[id]/CoachAthleteClient.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModuleConfigPanel from '@/components/ModuleConfigPanel'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E',
  red: '#EF4444', orange: '#F97316',
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

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>
      {title}
    </div>
  )
}

function avg(arr: number[]): string | null {
  if (arr.length === 0) return null
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
}

function toDateKey(iso: string) {
  return iso ? iso.split('T')[0] : ''
}

function rpeColor(rpe: number) {
  if (rpe <= 4) return C.green
  if (rpe <= 6) return C.gold
  if (rpe <= 8) return C.orange
  return C.red
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
  if (risk <= 75) return C.orange
  return C.red
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

function WellnessFullReport({ wellness: w }: { wellness: any }) {
  const act = w.activity_data || {}
  const pain = w.pain_data || {}
  const cycle = w.cycle_phase
  const cycleStyle = cycle ? (cycleColors[cycle] || { color: C.gray, bg: C.offWhite }) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
      {/* BASIC */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.875rem', background: C.offWhite, borderRadius: 9, fontFamily: mono, marginTop: '0.5rem' }}>
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
      {/* AKTYWNOŚĆ */}
      {(act.type || act.duration) && (
        <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>Aktywność dnia</div>
          {act.type && <div style={{ display: 'inline-block', padding: '0.4rem 0.875rem', background: C.navyLight, color: C.gold, borderRadius: 8, fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.75rem' }}>{act.type}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {act.time && <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.gray }}>🕐 {act.time}</span>}
            {act.duration && <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.gray }}>⏱ {act.duration} min</span>}
            {act.motivation && motivationLabels[act.motivation] && <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.gray }}>{motivationLabels[act.motivation].emoji} motywacja: {motivationLabels[act.motivation].label}</span>}
          </div>
          {act.rpe != null && act.rpe > 0 && <WScale label="RPE — ciężkość wysiłku" value={act.rpe} max={10} inverse />}
          {act.feelingAfter && feelingLabels[act.feelingAfter] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.55rem 0.875rem', background: C.offWhite, borderRadius: 9, marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: C.gray }}>Samopoczucie po</span>
              <span style={{ fontWeight: 800, color: C.navy }}>{feelingLabels[act.feelingAfter]}</span>
            </div>
          )}
          {act.satisfaction != null && <WScale label="Satysfakcja z treningu" value={act.satisfaction} max={10} />}
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
      {/* BÓL */}
      {(pain.painDuring > 0 || pain.location || (w.muscle_sorness != null && w.muscle_sorness > 0) || pain.headache > 0 || pain.anxiety > 0 || pain.mentalOverload > 0) && (
        <div style={{ background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.red, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>Ból i obciążenie</div>
          {w.muscle_sorness > 0 && <WScale label="Zakwasy" value={w.muscle_sorness} max={10} comments={WC.soreness} inverse />}
          {pain.painDuring > 0 && <WScale label="Ból podczas treningu" value={pain.painDuring} max={10} comments={WC.pain} inverse />}
          {pain.location && <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.84rem', color: C.navy }}><span>📍</span><span style={{ fontWeight: 700 }}>{pain.location}</span></div>}
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
      {/* SUPLEMENTY */}
      {w.supplements_data?.counts && Object.values(w.supplements_data.counts).some((v: any) => v > 0) && (
        <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#92400E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 700 }}>💊 Suplementy</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(w.supplements_data.counts)
              .filter(([, v]: any) => v > 0)
              .map(([id, count]: any) => (
                <span key={id} style={{ padding: '3px 10px', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, fontFamily: mono, fontSize: '0.7rem', color: '#92400E', fontWeight: 700 }}>
                  {id.replace(/_/g, ' ')} × {count}
                </span>
              ))}
          </div>
          {w.supplements_data.note && <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: 8, fontStyle: 'italic' }}>{w.supplements_data.note}</div>}
          {w.supplements_data.caffeineSources?.length > 0 && <div style={{ fontSize: '0.78rem', color: '#92400E', marginTop: 5 }}>Kofeina z: {w.supplements_data.caffeineSources.join(', ')}</div>}
        </div>
      )}
      {/* UWAGI */}
      {w.concerns && (
        <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#92400E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>Uwagi dla trenera</div>
          <div style={{ fontSize: '0.9rem', color: C.navy, lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{w.concerns}&rdquo;</div>
        </div>
      )}
    </div>
  )
}

// Modal z raportem wellness dla wybranego dnia
function WellnessDetailModal({ wellness, dateLabel, onClose }: { wellness: any; dateLabel: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 520, background: C.offWhite, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Raport wellness</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{dateLabel}</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <WellnessFullReport wellness={wellness} />
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', padding: '0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontFamily: sans }}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
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
  dietLogs: any[]
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
    const groupId = parseInt(targetGroupId)
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move_athlete_group', athleteId: athlete.id, groupId }),
    })
    const json = await res.json()
    if (!res.ok || json.error) { setError(json.error || 'Nie udało się przenieść'); setSaving(false); return }
    onMoved(json.athlete.group)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 440, background: C.white, borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.grayLight}` }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Zarządzanie zawodniczką</div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: C.white }}>Przenieś do innej grupy</div>
          <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 4 }}>Plan treningowy pozostanie bez zmian.</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Wybierz grupę docelową</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
            {allGroups.filter(g => g.id !== athlete.group_id).map(g => (
              <button key={g.id} onClick={() => setTargetGroupId(String(g.id))}
                style={{ padding: '0.75rem 1rem', borderRadius: 10, border: `1.5px solid ${targetGroupId === String(g.id) ? C.gold : C.grayLight}`, background: targetGroupId === String(g.id) ? C.navy : C.offWhite, color: targetGroupId === String(g.id) ? C.gold : C.navy, fontWeight: 700, textAlign: 'left', cursor: 'pointer', fontFamily: sans }}>
                {g.name}
                {g.training_level && <span style={{ fontFamily: mono, fontSize: '0.65rem', color: targetGroupId === String(g.id) ? C.gray : C.gray, marginLeft: 8 }}>{g.training_level}</span>}
              </button>
            ))}
            {allGroups.filter(g => g.id !== athlete.group_id).length === 0 && (
              <div style={{ color: C.gray, fontSize: '0.84rem', fontStyle: 'italic' }}>Brak innych grup.</div>
            )}
          </div>
          {error && <div style={{ color: C.red, fontSize: '0.82rem', marginBottom: '0.75rem' }}>Błąd: {error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.75rem 1rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, fontWeight: 700, cursor: 'pointer', fontFamily: sans }}>Anuluj</button>
            <button onClick={handleMove} disabled={!targetGroupId || saving}
              style={{ flex: 1, padding: '0.75rem', borderRadius: 10, border: 'none', background: !targetGroupId ? C.grayLight : C.navy, color: !targetGroupId ? C.gray : C.gold, fontWeight: 800, cursor: 'pointer', fontFamily: sans }}>
              {saving ? 'Przenoszę...' : 'Przenieś'}
            </button>
          </div>
        </div>
      </div>
    </div>
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
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'change_plan',
        athleteId: athlete.id,
        planId: parseInt(selectedPlanId),
        orderMode,
        currentAssignmentId: currentAssignment?.id || null,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || json.error) { setError(json.error || 'Nie udało się zmienić planu'); return }
    onChanged(json.assignment)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 480, background: C.white, borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Zmiana planu</div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: C.white }}>Przypisz nowy plan treningowy</div>
          {currentAssignment && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 4 }}>Obecny plan: {currentAssignment.plan?.name} zostanie zdezaktywowany.</div>}
        </div>
        <div style={{ padding: '1.25rem' }}>
          {activePlans.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Aktywne plany</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activePlans.map(p => (
                  <button key={p.id} onClick={() => setSelectedPlanId(String(p.id))}
                    style={{ padding: '0.75rem 1rem', borderRadius: 10, border: `1.5px solid ${selectedPlanId === String(p.id) ? C.gold : C.grayLight}`, background: selectedPlanId === String(p.id) ? C.navy : C.offWhite, color: selectedPlanId === String(p.id) ? C.gold : C.navy, fontWeight: 700, textAlign: 'left', cursor: 'pointer', fontFamily: sans }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {archivedPlans.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Archiwalne</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {archivedPlans.map(p => (
                  <button key={p.id} onClick={() => setSelectedPlanId(String(p.id))}
                    style={{ padding: '0.75rem 1rem', borderRadius: 10, border: `1.5px solid ${selectedPlanId === String(p.id) ? C.gold : C.grayLight}`, background: selectedPlanId === String(p.id) ? C.navy : '#FAFAFA', color: selectedPlanId === String(p.id) ? C.gold : C.gray, fontWeight: 600, textAlign: 'left', cursor: 'pointer', fontFamily: sans, opacity: 0.85 }}>
                    📦 {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Tryb realizacji</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['sequential', 'dated'] as const).map(mode => (
                <button key={mode} onClick={() => setOrderMode(mode)}
                  style={{ padding: '0.65rem', borderRadius: 9, border: `1.5px solid ${orderMode === mode ? C.gold : C.grayLight}`, background: orderMode === mode ? C.navy : C.offWhite, color: orderMode === mode ? C.gold : C.navy, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: sans }}>
                  {mode === 'sequential' ? '📋 Sekwencyjny' : '📅 Datowany'}
                </button>
              ))}
            </div>
          </div>

          {error && <div style={{ color: C.red, fontSize: '0.82rem', marginBottom: '0.75rem' }}>Błąd: {error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.75rem 1rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, fontWeight: 700, cursor: 'pointer', fontFamily: sans }}>Anuluj</button>
            <button onClick={handleChange} disabled={!selectedPlanId || saving}
              style={{ flex: 1, padding: '0.75rem', borderRadius: 10, border: 'none', background: !selectedPlanId ? C.grayLight : C.navy, color: !selectedPlanId ? C.gray : C.gold, fontWeight: 800, cursor: 'pointer', fontFamily: sans }}>
              {saving ? 'Zapisuję...' : 'Przypisz plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
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
  const rpeC = (rpe: number) => rpe >= 9 ? C.red : rpe >= 7 ? C.orange : rpe >= 5 ? C.gold : C.green

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 500, background: C.offWhite, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Raport z treningu</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.05rem' }}>{session.workout_day?.day_name || 'Trening'}</div>
          <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 2 }}>{dateStr}</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Ładowanie...</div>
          ) : (<>
            {/* RPE + samopoczucie */}
            {feedback && (
              <div style={{ display: 'flex', gap: 8 }}>
                {feedback.session_rpe != null && (
                  <div style={{ flex: 1, background: rpeC(feedback.session_rpe) + '18', border: `1.5px solid ${rpeC(feedback.session_rpe)}`, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', marginBottom: 3 }}>RPE</div>
                    <div style={{ fontFamily: mono, fontWeight: 900, fontSize: '1.6rem', color: rpeC(feedback.session_rpe), lineHeight: 1 }}>{feedback.session_rpe}</div>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, marginTop: 2 }}>{feedback.session_rpe <= 3 ? 'Lekki' : feedback.session_rpe <= 5 ? 'Umiarkowany' : feedback.session_rpe <= 7 ? 'Ciężki' : 'Bardzo ciężki'}</div>
                  </div>
                )}
                {feedback.feeling_after && (
                  <div style={{ flex: 1.5, background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 10, padding: '0.75rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', marginBottom: 4 }}>Po treningu</div>
                    <div style={{ fontWeight: 800, color: C.navy }}>{({'swietnie': '💪 Świetnie', 'dobrze': '😊 Dobrze', 'srednie': '😐 Średnio', 'zmeczona': '😓 Zmęczona', 'slabo': '😞 Słabo'} as Record<string,string>)[feedback.feeling_after] || feedback.feeling_after}</div>
                  </div>
                )}
              </div>
            )}
            {/* Serie */}
            {orderedExIds.filter(id => logsByEx[id]?.length > 0).length > 0 && (
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '0.6rem 0.875rem', background: C.navy, fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>🏋️ Wykonane serie</div>
                {orderedExIds.filter(id => logsByEx[id]?.length > 0).map(exId => {
                  const logs = logsByEx[exId].sort((a: any, b: any) => a.set_number - b.set_number)
                  const main = logs.filter((l: any) => !l.is_warmup)
                  const wu = logs.filter((l: any) => l.is_warmup)
                  return (
                    <div key={exId} style={{ padding: '0.65rem 0.875rem', borderBottom: `1px solid ${C.grayLight}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontWeight: 700, color: C.navy, fontSize: '0.88rem' }}>{exNameMap[exId] || `Ćw.#${exId}`}</span>
                        <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>{exPlanMap[exId]}</span>
                      </div>
                      {wu.map((l: any) => (
                        <div key={l.id} style={{ padding: '3px 0', opacity: 0.75 }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, minWidth: 38 }}>Rozg</span>
                            <span style={{ fontFamily: mono, fontSize: '0.78rem', color: C.gray }}>{l.weight ? `${l.weight} kg` : '—'}</span>
                            <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>{l.reps_completed ? `${l.reps_completed}p` : '—'}</span>
                          </div>
                          {l.athlete_note && <div style={{ marginLeft: 48, marginTop: 2, fontSize: '0.72rem', color: C.gray, fontStyle: 'italic' }}>“{l.athlete_note}”</div>}
                        </div>
                      ))}
                      {main.map((l: any) => (
                        <div key={l.id} style={{ padding: '3px 0' }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <span style={{ fontFamily: mono, fontSize: '0.65rem', color: l.completed ? C.gold : C.gray, fontWeight: 800, minWidth: 38 }}>S{l.set_number}</span>
                            <span style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 900, color: l.weight ? C.navy : C.gray }}>{l.weight ? `${l.weight} kg` : '—'}</span>
                            <span style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>{l.reps_completed ? `${l.reps_completed}p` : '—'}</span>
                          </div>
                          {l.athlete_note && <div style={{ marginLeft: 48, marginTop: 2, fontSize: '0.72rem', color: C.gray, fontStyle: 'italic' }}>“{l.athlete_note}”</div>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
            {/* Feedback tekstowy */}
            {(feedback?.what_went_well || feedback?.pain_after_comment || feedback?.general_notes) && (
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '0.6rem 0.875rem', background: C.offWhite, borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>💬 Feedback</div>
                <div style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {feedback.what_went_well && <div><div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.green, textTransform: 'uppercase', marginBottom: 2 }}>Co poszło dobrze</div><div style={{ fontSize: '0.86rem', color: C.navy, fontStyle: 'italic' }}>&ldquo;{feedback.what_went_well}&rdquo;</div></div>}
                  {feedback.pain_after_comment && <div><div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.red, textTransform: 'uppercase', marginBottom: 2 }}>Ból/dyskomfort</div><div style={{ fontSize: '0.86rem', color: C.navy, fontStyle: 'italic' }}>&ldquo;{feedback.pain_after_comment}&rdquo;</div></div>}
                  {feedback.general_notes && <div><div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', marginBottom: 2 }}>Uwagi</div><div style={{ fontSize: '0.86rem', color: C.navy }}>{feedback.general_notes}</div></div>}
                </div>
              </div>
            )}
            {!feedback && setLogs.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak danych dla tej sesji.</div>}
          </>)}
        </div>
        <div style={{ padding: '0.875rem', borderTop: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', padding: '0.75rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 10, fontWeight: 800, fontFamily: sans }}>Zamknij</button>
        </div>
      </div>
    </div>
  )
}

type MainTab = 'overview' | 'wellness' | 'diet'

export default function CoachAthleteClient({ athlete, assignment, pastAssignments, sessions, feedbacks, wellnessLogs, wellnessList, dietLogs, painLogs, groupModuleConfigs, athleteModuleConfigs, allGroups, allPlans }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [planTab, setPlanTab] = useState<'active' | 'history'>('active')
  const [movingGroup, setMovingGroup] = useState(false)
  const [changingPlan, setChangingPlan] = useState(false)
  const [localAthlete, setLocalAthlete] = useState(athlete)
  const [localAssignment, setLocalAssignment] = useState(assignment)
  const [selectedWellness, setSelectedWellness] = useState<{ wellness: any; dateLabel: string } | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('overview')
  const [moduleConfig, setModuleConfig] = useState<'wellness' | 'diet' | null>(null)
  const [localAthleteModuleConfigs, setLocalAthleteModuleConfigs] = useState<any[]>(athleteModuleConfigs)
  const [selectedSessionFeedback, setSelectedSessionFeedback] = useState<{ session: any } | null>(null)
  const inheritedModuleConfig = moduleConfig
    ? groupModuleConfigs.find((config: any) => config.module === moduleConfig)
    : null

  const moduleDefaults = {
    diet: { pre: ['had_breakfast', 'meal_count', 'water_ml'], post: [] },
    wellness: {
      pre: ['sleep_hours', 'sleep_quality', 'readiness', 'energy', 'stress', 'muscle_soreness', 'hydration', 'recovery_score'],
      post: [],
    },
  }
  const groupConfigFor = (module: 'wellness' | 'diet') => groupModuleConfigs.find((config: any) => config.module === module)
  const athleteConfigFor = (module: 'wellness' | 'diet') => localAthleteModuleConfigs.find((config: any) => config.module === module)
  const effectiveConfigFor = (module: 'wellness' | 'diet') => athleteConfigFor(module) || groupConfigFor(module)
  const isModuleEnabled = (module: 'wellness' | 'diet') => effectiveConfigFor(module)?.enabled !== false
  const configSource = (module: 'wellness' | 'diet') => athleteConfigFor(module) ? 'indywidualnie' : 'wg grupy'
  const sameList = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every(item => b.includes(item))

  async function saveModuleAccess(module: 'wellness' | 'diet', enabled: boolean) {
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
  const dietByDate: Record<string, any> = {}
  for (const d of dietLogs) {
    if (d.date) dietByDate[d.date] = d
  }

  const completedByDate: Record<string, { session: any; num: number }> = {}
  const sortedCompleted = [...completedSessions].sort(
    (a, b) => new Date(a.date_completed || a.date_started || 0).getTime() - new Date(b.date_completed || b.date_started || 0).getTime()
  )
  sortedCompleted.forEach((s, i) => {
    const key = toDateKey(s.date_completed || s.date_started || '')
    if (key) completedByDate[key] = { session: s, num: i + 1 }
  })

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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

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

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>

        {/* Header — bez przycisku edytuj */}
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => athlete.group_id ? router.push(`/coach/groups/${athlete.group_id}`) : router.push('/coach')}
              style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}
            >
              ← {athlete.group?.name || 'Panel'}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Zawodniczka</div>
              <h1 style={{ color: C.white, fontSize: '1.25rem', fontWeight: 800 }}>{athlete.full_name}</h1>
            </div>
          </div>
        </header>

        {/* Tab bar */}
        <div style={{ background: C.navyLight, borderBottom: `1.5px solid ${C.navyBorder}` }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex' }}>
            {([
              { id: 'overview', label: '📊 Przegląd' },
              { id: 'wellness', label: '🩺 Wellness' },
              { id: 'diet',     label: '🥗 Dieta' },
            ] as { id: MainTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setMainTab(t.id)} style={{ padding: '0.7rem 1rem', border: 'none', background: 'transparent', color: mainTab === t.id ? C.gold : C.gray, fontWeight: mainTab === t.id ? 800 : 600, fontFamily: mono, fontSize: '0.7rem', borderBottom: mainTab === t.id ? `2px solid ${C.gold}` : '2px solid transparent', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <main style={{ maxWidth: 800, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>

          {/* ── Wellness tab ── */}
          {mainTab === 'wellness' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Card>
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Konfiguracja wellness</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                    <span style={{ border: `1.5px solid ${isModuleEnabled('wellness') ? '#86EFAC' : '#FCA5A5'}`, background: isModuleEnabled('wellness') ? '#F0FDF4' : '#FEF2F2', color: isModuleEnabled('wellness') ? C.green : C.red, borderRadius: 999, padding: '0.35rem 0.7rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 900 }}>
                      {isModuleEnabled('wellness') ? 'Wellness włączony' : 'Wellness wyłączony'}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: '0.62rem', color: athleteConfigFor('wellness') ? C.gold : C.gray }}>{configSource('wellness')}</span>
                  </div>
                  <p style={{ color: C.gray, fontSize: '0.84rem', marginBottom: '1rem' }}>
                    Wybierz które parametry wellness widzi ta zawodniczka. Nadpisuje ustawienia grupy.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => saveModuleAccess('wellness', !isModuleEnabled('wellness'))} style={{ border: `1.5px solid ${isModuleEnabled('wellness') ? '#FCA5A5' : '#86EFAC'}`, background: isModuleEnabled('wellness') ? '#FEF2F2' : '#F0FDF4', color: isModuleEnabled('wellness') ? C.red : C.green, borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 800, cursor: 'pointer' }}>
                      {isModuleEnabled('wellness') ? 'Wyłącz wellness' : 'Włącz wellness'}
                    </button>
                    <button onClick={() => setModuleConfig('wellness')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 800, cursor: 'pointer' }}>
                      🩺 Edytuj parametry wellness
                    </button>
                    <button onClick={() => router.push(`/coach/athletes/${athlete.id}/training`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 700, cursor: 'pointer' }}>
                      Zobacz historię →
                    </button>
                  </div>
                </div>
              </Card>
              {wellnessLogs.length > 0 && (
                <Card>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ostatnie wpisy wellness</div>
                  </div>
                  {wellnessLogs.slice(0, 7).map((w: any, i: number) => (
                    <button key={w.id} onClick={() => setSelectedWellness({ wellness: w, dateLabel: new Date(w.date || w.created_at).toLocaleDateString('pl-PL') })}
                      style={{ width: '100%', background: 'none', border: 'none', borderBottom: i < Math.min(wellnessLogs.length, 7) - 1 ? `1.5px solid ${C.grayLight}` : 'none', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontFamily: mono, fontSize: '0.75rem', color: C.navy, fontWeight: 700 }}>{new Date(w.date || w.created_at).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {w.energy != null && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gold }}>⚡{w.energy}</span>}
                        {w.sleep_hours != null && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>🌙{w.sleep_hours}h</span>}
                        {w.readiness != null && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.green }}>💪{w.readiness}</span>}
                        <span style={{ color: C.gray }}>›</span>
                      </div>
                    </button>
                  ))}
                </Card>
              )}
            </div>
          )}

          {/* ── Diet tab ── */}
          {mainTab === 'diet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Card>
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Konfiguracja diety</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                    <span style={{ border: `1.5px solid ${isModuleEnabled('diet') ? '#86EFAC' : '#FCA5A5'}`, background: isModuleEnabled('diet') ? '#F0FDF4' : '#FEF2F2', color: isModuleEnabled('diet') ? C.green : C.red, borderRadius: 999, padding: '0.35rem 0.7rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 900 }}>
                      {isModuleEnabled('diet') ? 'Dieta włączona' : 'Dieta wyłączona'}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: '0.62rem', color: athleteConfigFor('diet') ? C.gold : C.gray }}>{configSource('diet')}</span>
                  </div>
                  <p style={{ color: C.gray, fontSize: '0.84rem', marginBottom: '1rem' }}>
                    Wybierz które pola dziennika diety wypełnia ta zawodniczka. Nadpisuje ustawienia grupy.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => saveModuleAccess('diet', !isModuleEnabled('diet'))} style={{ border: `1.5px solid ${isModuleEnabled('diet') ? '#FCA5A5' : '#86EFAC'}`, background: isModuleEnabled('diet') ? '#FEF2F2' : '#F0FDF4', color: isModuleEnabled('diet') ? C.red : C.green, borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 800, cursor: 'pointer' }}>
                    {isModuleEnabled('diet') ? 'Wyłącz dietę' : 'Włącz dietę'}
                  </button>
                  <button onClick={() => setModuleConfig('diet')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 800, cursor: 'pointer' }}>
                    🥗 Edytuj parametry diety
                  </button>
                  </div>
                </div>
              </Card>
              {dietLogs.length > 0 && (
                <Card>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ostatnie wpisy diety</div>
                  </div>
                  {dietLogs.slice(0, 7).map((d: any, i: number) => (
                    <div key={d.id} style={{ padding: '0.75rem 1.25rem', borderBottom: i < Math.min(dietLogs.length, 7) - 1 ? `1.5px solid ${C.grayLight}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: mono, fontSize: '0.75rem', color: C.navy, fontWeight: 700 }}>{new Date(d.date || d.created_at).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {d.meal_count > 0 && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>🍽️{d.meal_count}</span>}
                        {d.water_ml > 0 && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>💧{d.water_ml}ml</span>}
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          )}

          {/* ── Overview tab ── */}
          {mainTab === 'overview' && <>

          {/* Modals */}
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

          {/* Profil */}
          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <SectionHeader title="Profil" />
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: C.navy, marginBottom: 5 }}>{localAthlete.full_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  {localAthlete.group?.name && <div style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>📁 {localAthlete.group.name}</div>}
                  <button onClick={() => setMovingGroup(true)}
                    style={{ padding: '2px 8px', border: `1px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, borderRadius: 6, fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer' }}>
                    Zmień
                  </button>
                </div>
                {localAthlete.birth_year && <div style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>ur. {localAthlete.birth_year}</div>}
              </div>

              {/* Plany — zakładki Aktywny / Historia */}
              <div>
                <div style={{ display: 'flex', gap: 1, marginBottom: '0.875rem' }}>
                  {(['active', 'history'] as const).map(tab => (
                    <button key={tab} onClick={() => setPlanTab(tab)}
                      style={{ padding: '0.4rem 0.75rem', border: 'none', borderRadius: tab === 'active' ? '8px 0 0 8px' : '0 8px 8px 0', background: planTab === tab ? C.navy : C.grayLight, color: planTab === tab ? C.gold : C.gray, fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {tab === 'active' ? 'Aktywny' : `Historia (${pastAssignments.length})`}
                    </button>
                  ))}
                </div>

                {planTab === 'active' ? (
                  localAssignment ? (
                    <>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: C.navy, marginBottom: 4 }}>{localAssignment.plan?.name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray, marginBottom: 10 }}>
                        {localAssignment.order_mode === 'sequential' ? 'Sekwencyjny' : 'Datowany'} · od {new Date(localAssignment.start_date).toLocaleDateString('pl-PL')}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => router.push(`/coach/athletes/${localAthlete.id}/training`)}
                          style={{ padding: '0.5rem 0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                          ✎ Modyfikuj ćwiczenia →
                        </button>
                        <button onClick={() => setChangingPlan(true)}
                          style={{ padding: '0.5rem 0.875rem', background: C.offWhite, color: C.navy, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                          🔄 Zmień plan
                        </button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div style={{ color: C.gray, fontSize: '0.86rem', fontStyle: 'italic', marginBottom: 10 }}>Brak aktywnego planu</div>
                      <button onClick={() => setChangingPlan(true)}
                        style={{ padding: '0.5rem 0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                        + Przypisz plan
                      </button>
                    </div>
                  )
                ) : (
                  pastAssignments.length === 0 ? (
                    <div style={{ color: C.gray, fontSize: '0.86rem', fontStyle: 'italic' }}>Brak historii planów</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pastAssignments.map(a => (
                        <div key={a.id} style={{ padding: '0.625rem 0.875rem', background: C.offWhite, borderRadius: 8, border: `1.5px solid ${C.grayLight}` }}>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: C.navy }}>{a.plan?.name}</div>
                          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 2 }}>
                            od {new Date(a.start_date || a.created_at).toLocaleDateString('pl-PL')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </Card>

          {/* Szybkie statystyki */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1rem' }}>
            {[
              { label: 'Treningi', value: completedSessions.length, color: C.navy },
              { label: 'Śr. RPE', value: avgRpe ?? '—', color: avgRpe ? rpeColor(parseFloat(avgRpe)) : C.gray },
              { label: 'Wellness', value: `${wellnessLogs.length}d`, color: C.green },
              { label: 'Dieta', value: `${dietLogs.length}d`, color: C.gold },
            ].map(stat => (
              <Card key={stat.label}>
                <div style={{ padding: '0.875rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{stat.label}</div>
                  <div style={{ fontFamily: mono, fontSize: '1.5rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Wellness — średnie */}
          {wellnessLogs.length > 0 && (
            <Card style={{ marginBottom: '1rem' }}>
              <div style={{ padding: '1rem 1.25rem' }}>
                <SectionHeader title={`Wellness — średnie z 28 dni (${wellnessLogs.length} wpisów)`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Sen', value: wellnessSleepAvg, unit: 'h', max: 12, inverse: false },
                    { label: 'Energia', value: wellnessEnergyAvg, unit: '/10', max: 10, inverse: false },
                    { label: 'Stres', value: wellnessStressAvg, unit: '/10', max: 10, inverse: true },
                    { label: 'Gotowość', value: wellnessReadinessAvg, unit: '/10', max: 10, inverse: false },
                  ].map(stat => {
                    const num = stat.value ? parseFloat(stat.value) : null
                    const pct = num ? (num / stat.max) * 100 : 0
                    const barColor = stat.inverse ? (pct > 60 ? C.red : pct > 30 ? C.gold : C.green) : (pct > 60 ? C.green : pct > 30 ? C.gold : C.red)
                    return (
                      <div key={stat.label}>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontFamily: mono, fontSize: '1.1rem', fontWeight: 800, color: C.navy, marginBottom: 6 }}>{stat.value ?? '—'}{stat.value ? stat.unit : ''}</div>
                        {num != null && <div style={{ height: 4, background: C.grayLight, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} /></div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Kalendarz — klikalne kółeczka wellness */}
          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1rem 1.25rem' }}>
              <SectionHeader title="Kalendarz — ostatnie 28 dni" />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
                  <thead>
                    <tr>
                      {dayNames.map(d => (
                        <th key={d} style={{ padding: '0 4px 8px', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray, fontWeight: 700 }}>{d}</th>
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
                          const hasDiet = !!dietByDate[key]
                          const trainingInfo = completedByDate[key]
                          return (
                            <td key={key} style={{ padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                              <div style={{ minHeight: 72, padding: '5px 3px', borderRadius: 8, background: isToday ? C.navyLight : 'transparent', border: isToday ? `1.5px solid ${C.gold}` : '1.5px solid transparent' }}>
                                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: isToday ? C.gold : C.gray, fontWeight: isToday ? 800 : 400, marginBottom: 5 }}>
                                  {day.getDate()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                  {/* Wellness — klikalny jeśli uzupełniony */}
                                  <button
                                    title={hasWellness ? 'Kliknij aby zobaczyć raport wellness' : 'Brak wellness tego dnia'}
                                    onClick={() => hasWellness && openWellness(key)}
                                    style={{
                                      width: 16, height: 16, borderRadius: '50%',
                                      background: hasWellness ? C.green : C.red,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '0.5rem', color: C.white, fontWeight: 800,
                                      border: 'none', padding: 0,
                                      cursor: hasWellness ? 'pointer' : 'default',
                                      transition: 'transform 0.1s',
                                    }}
                                  >
                                    {hasWellness ? '✓' : ''}
                                  </button>
                                  {/* Dieta */}
                                  {hasDiet && <div title="Dieta uzupełniona" style={{ fontSize: '0.72rem', lineHeight: 1 }}>🥗</div>}
                                  {/* Trening */}
                                  {trainingInfo && (
                                    <div title={`Trening #${trainingInfo.num}`} style={{ position: 'relative', width: 18, height: 18 }}>
                                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>🏋️</div>
                                      <div style={{ position: 'absolute', top: -4, right: -5, width: 12, height: 12, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.48rem', fontWeight: 900, color: C.navy }}>
                                        {trainingInfo.num}
                                      </div>
                                    </div>
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
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: `1.5px solid ${C.grayLight}` }}>
                {[
                  { icon: <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.green }} />, label: 'Wellness ✓ (kliknij aby zobaczyć)' },
                  { icon: <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.red }} />, label: 'Wellness brak' },
                  { icon: <span style={{ fontSize: '0.7rem' }}>🥗</span>, label: 'Dieta' },
                  { icon: <span style={{ fontSize: '0.7rem' }}>🏋️</span>, label: 'Trening (nr w planie)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {item.icon}
                    <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Ostatni wellness */}
          {lastWellness && (
            <Card style={{ marginBottom: '1rem' }}>
              <div style={{ padding: '1rem 1.25rem' }}>
                <SectionHeader title={`Ostatni wellness — ${new Date(lastWellness.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                  {([
                    ['Sen', lastWellness.sleep_hours != null ? `${lastWellness.sleep_hours}h` : null],
                    ['Energia', lastWellness.energy != null ? `${lastWellness.energy}/10` : null],
                    ['Stres', lastWellness.stress != null ? `${lastWellness.stress}/10` : null],
                    ['Gotowość', lastWellness.readiness != null ? `${lastWellness.readiness}/10` : null],
                  ] as [string, string | null][]).filter(([, v]) => v != null).map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontFamily: mono, fontSize: '1rem', fontWeight: 800, color: C.navy }}>{value}</div>
                    </div>
                  ))}
                </div>
                {lastWellness.concerns && (
                  <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '0.75rem', fontSize: '0.86rem', color: C.navy, fontStyle: 'italic' }}>
                    💬 &ldquo;{lastWellness.concerns}&rdquo;
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Zgłoszenia bólu */}
          {painLogs.length > 0 && (
            <Card style={{ marginBottom: '1rem' }}>
              <div style={{ padding: '1rem 1.25rem' }}>
                <SectionHeader title="Zgłoszenia bólu" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {painLogs.slice(0, 5).map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: C.offWhite, borderRadius: 10, border: `1.5px solid ${C.grayLight}` }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: C.navy }}>{p.location || '—'}</div>
                        {p.description && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 2 }}>{p.description}</div>}
                        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 3 }}>{new Date(p.created_at).toLocaleDateString('pl-PL')}</div>
                      </div>
                      <div style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 800, color: p.vas_score >= 7 ? C.red : p.vas_score >= 4 ? C.orange : C.green, background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                        VAS {p.vas_score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Historia treningów */}
          <Card>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
              <SectionHeader title="Historia treningów" />
            </div>
            {completedSessions.length === 0 ? (
              <div style={{ padding: '1.5rem', color: C.gray, fontSize: '0.9rem', textAlign: 'center' }}>Brak ukończonych treningów.</div>
            ) : (
              completedSessions.slice(0, 15).map((s: any, i: number, arr: any[]) => {
                const fb = feedbackMap[s.id]
                const hasFeedback = !!fb
                return (
                  <button key={s.id}
                    onClick={() => setSelectedSessionFeedback({ session: s })}
                    style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '0.875rem 1.25rem', borderBottom: i < arr.length - 1 ? `1.5px solid ${C.grayLight}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.offWhite)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {s.workout_day?.day_name || 'Trening'}
                        {s.report_sent && <span style={{ fontSize: '0.75rem' }}>📋</span>}
                        {hasFeedback && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.green, background: C.green + '18', borderRadius: 4, padding: '1px 5px' }}>feedback</span>}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray }}>
                        {s.date_completed ? new Date(s.date_completed).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '—'}
                        {s.workout_day?.week?.plan?.name && ` · ${s.workout_day.week.plan.name}`}
                      </div>
                      {fb?.what_went_well && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>&ldquo;{fb.what_went_well}&rdquo;</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {fb?.session_rpe && (
                        <div style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 800, color: rpeColor(fb.session_rpe), background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, padding: '4px 10px' }}>
                          RPE {fb.session_rpe}
                        </div>
                      )}
                      <span style={{ color: C.gray, fontSize: '0.85rem' }}>›</span>
                    </div>
                  </button>
                )
              })
            )}
          </Card>

          </>}  {/* end overview tab */}

        </main>
      </div>
    </>
  )
}
