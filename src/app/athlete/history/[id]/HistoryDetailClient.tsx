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
function vasLabel(v: number) {
  return v === 0 ? 'Brak bólu' : v <= 3 ? 'Łagodny' : v <= 6 ? 'Umiarkowany' : v <= 8 ? 'Silny' : 'Bardzo silny'
}
function vasColor(v: number) {
  return v >= 7 ? C.red : v >= 4 ? C.orange : C.green
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
    <div style={{ padding: '0.65rem 1.25rem', background: C.offWhite, borderBottom: `1.5px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </div>
  )
}

// Kafelek edycji serii — tylko ciężar (powtórzenia są w planie trenera)
function SetEditTile({ label, weight, onWeight, onSave, onCancel, saving }: {
  label: string; weight: string
  onWeight: (v: string) => void
  onSave: () => void; onCancel: () => void; saving: boolean
}) {
  // Obsługa przecinka jako separatora dziesiętnego
  function handleWeightChange(raw: string) {
    onWeight(raw.replace(',', '.'))
  }

  return (
    <div style={{ padding: '0.625rem', background: '#FFFBEB', border: `2px solid ${C.gold}`, borderRadius: 12, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 auto' }}>
      <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gold, fontWeight: 700 }}>{label} — edytuj</div>
      <div>
        <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.gray, marginBottom: 2 }}>Ciężar (kg)</div>
        <input
          inputMode="decimal"
          value={weight}
          onChange={e => handleWeightChange(e.target.value)}
          placeholder="0"
          style={{ width: '100%', padding: '0.45rem', border: `1.5px solid ${C.gold}`, borderRadius: 6, fontFamily: mono, fontSize: '1rem', fontWeight: 800, color: C.navy, textAlign: 'center', background: C.white, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <button onClick={onSave} disabled={saving}
          style={{ flex: 2, padding: '0.4rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 7, fontFamily: mono, fontWeight: 800, fontSize: '0.75rem' }}>
          {saving ? '...' : '✓ Zapisz'}
        </button>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '0.4rem', background: C.offWhite, color: C.gray, border: `1px solid ${C.grayLight}`, borderRadius: 7, fontFamily: mono, fontWeight: 700, fontSize: '0.7rem' }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// Kafelek serii — wykonana / niezaznaczona / brakująca
function MissingOrDoneSetTile({ label, weight, reps, missing, done, isSaved, isArchived, onEdit, onMarkDone }: {
  label: string; weight?: number | null; reps?: number | null
  missing: boolean; done: boolean; isSaved: boolean; isArchived: boolean
  onEdit?: () => void; onMarkDone?: () => void
}) {
  // missing = brak logu w ogóle (czerwony)
  // !done = log jest ale niekompletny (szary)
  // done = wykonane (zielony)
  const bg = isSaved ? '#F0FDF4' : missing ? '#FEF2F2' : done ? '#F0FDF4' : C.offWhite
  const border = isSaved ? `2px solid ${C.green}` : missing ? `1.5px solid #FCA5A5` : done ? `1px solid #86EFAC` : `1px solid ${C.grayLight}`
  const labelColor = missing ? C.red : done ? C.green : C.gray

  function handleClick() {
    if (isArchived) return
    if (missing && onMarkDone) { onMarkDone(); return }
    if (onEdit) onEdit()
  }

  return (
    <button onClick={handleClick}
      style={{ padding: '0.5rem 0.75rem', background: bg, border, borderRadius: 9, minWidth: 54, textAlign: 'center', cursor: isArchived ? 'default' : 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: labelColor, fontWeight: 700 }}>{label}</div>
      {missing ? (
        <div style={{ fontFamily: mono, fontSize: '0.7rem', color: C.red, fontWeight: 800 }}>—</div>
      ) : (
        <>
          {weight != null && <div style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 900, color: C.navy }}>{weight}kg</div>}
          {reps != null && <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>{reps}p</div>}
        </>
      )}
      {missing && !isArchived && <div style={{ fontSize: '0.55rem', color: C.red, marginTop: 1 }}>+ zaznacz</div>}
      {!missing && !isArchived && <span style={{ position: 'absolute', top: 2, right: 3, fontSize: '0.45rem' }}>✏️</span>}
    </button>
  )
}

// ─── EDYTOWALNY PANEL WELLNESS ────────────────────────────────────────────────
function WellnessEditPanel({ wellness, athleteId, sessionDate, sessionId, onSaved }: {
  wellness: any; athleteId: number; sessionDate: string; sessionId?: number; onSaved: (w: any) => void
}) {
  const supabase = createClient()

  const [sleepHours, setSleepHours] = useState<number>(wellness?.sleep_hours ?? 7)
  const [sleepQ, setSleepQ] = useState<number>(wellness?.sleep_quality ?? 7)
  const [readiness, setReadiness] = useState<number>(wellness?.readiness ?? 7)
  const [energy, setEnergy] = useState<number>(wellness?.energy ?? 7)
  const [stress, setStress] = useState<number>(wellness?.stress ?? 3)
  const [soreness, setSoreness] = useState<number>(wellness?.muscle_sorness ?? 0)
  const [bodyWeight, setBodyWeight] = useState<string>(wellness?.body_weight_kg ? String(wellness.body_weight_kg) : '')
  const [concerns, setConcerns] = useState<string>(wellness?.concerns ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const sliders = [
    { label: '🌙 Sen', value: sleepHours, set: setSleepHours, min: 3, max: 12, step: 0.5, unit: 'h', comments: null as null | string[], inverse: false },
    { label: 'Jakość snu', value: sleepQ, set: setSleepQ, min: 0, max: 10, step: 1, unit: '/10', comments: WC.sleepQ, inverse: false },
    { label: `${readinessEmoji(readiness)} Wypoczęcie`, value: readiness, set: setReadiness, min: 0, max: 10, step: 1, unit: '/10', comments: WC.readiness, inverse: false },
    { label: 'Energia', value: energy, set: setEnergy, min: 0, max: 10, step: 1, unit: '/10', comments: WC.energy, inverse: false },
    { label: 'Stres', value: stress, set: setStress, min: 0, max: 10, step: 1, unit: '/10', comments: WC.stress, inverse: true },
    { label: 'Zakwasy', value: soreness, set: setSoreness, min: 0, max: 10, step: 1, unit: '/10', comments: WC.soreness, inverse: true },
  ]

  async function save() {
    setSaving(true)
    const payload = {
      athlete_id: athleteId,
      date: sessionDate,
      ...(sessionId ? { workout_session_id: sessionId } : {}),
      sleep_hours: sleepHours,
      sleep_quality: sleepQ,
      readiness,
      energy,
      stress,
      muscle_sorness: soreness,
      body_weight_kg: bodyWeight ? parseFloat(bodyWeight.replace(',', '.')) : null,
      concerns: concerns.trim() || null,
    }
    let result
    if (wellness?.id) {
      result = await supabase.from('wellness_logs').update(payload).eq('id', wellness.id).select().single()
    } else {
      result = await supabase.from('wellness_logs').upsert({ ...payload }, { onConflict: 'athlete_id,date' }).select().single()
    }
    setSaving(false)
    if (result.data) { setSaved(true); onSaved(result.data); setTimeout(() => setSaved(false), 2500) }
  }

  return (
    <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {sliders.map(s => {
        const color = wScaleColor(s.value, s.max, s.inverse)
        const comment = s.comments ? wComment(s.value, s.comments) : null
        return (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: '0.84rem', color: C.gray }}>{s.label}</span>
              <span style={{ fontFamily: mono, fontSize: '0.84rem', fontWeight: 800, color }}>{s.value}{s.unit}</span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
              onChange={e => s.set(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: color }} />
            {comment && <div style={{ fontSize: '0.66rem', fontWeight: 700, color, textAlign: 'right', marginTop: 2 }}>{comment}</div>}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Masa ciała (kg)</div>
          <input inputMode="decimal" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} placeholder="np. 62.5"
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: mono, fontSize: '0.9rem', color: C.navy, background: C.offWhite, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div>
        <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Uwagi dla trenera</div>
        <textarea value={concerns} onChange={e => setConcerns(e.target.value)} placeholder="Coś do zgłoszenia..." rows={2}
          style={{ width: '100%', padding: '0.5rem 0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: '0.84rem', color: C.navy, resize: 'none', outline: 'none', background: C.offWhite, boxSizing: 'border-box' }} />
      </div>

      <button onClick={save} disabled={saving}
        style={{ width: '100%', padding: '0.75rem', background: saved ? C.green : C.navy, color: saved ? C.white : C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.88rem' }}>
        {saving ? 'Zapisuję...' : saved ? '✓ Wellness zapisany!' : 'Zapisz wellness'}
      </button>
    </div>
  )
}

// Panel bólu i notatki per ćwiczenie
function ExercisePainPanel({ exerciseName, sessionId, athleteId, existingPains, isArchived }: {
  exerciseName: string; sessionId: number; athleteId: number
  existingPains: any[]; isArchived: boolean
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [vas, setVas] = useState(0)
  const [painNote, setPainNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pains, setPains] = useState(existingPains)

  async function savePain() {
    if (vas === 0 && !painNote.trim()) return
    setSaving(true)
    const { data } = await supabase.from('pain_logs').insert({
      workout_session_id: sessionId,
      vas_score: vas,
      pain_comment: painNote.trim() || null,
      pain_location: exerciseName,
      pain_reported: true,
    }).select().single()
    if (data) setPains(prev => [...prev, data])
    setVas(0); setPainNote(''); setSaved(true); setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasPain = pains.length > 0

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '0.6rem 0.875rem', background: open ? '#FFF7ED' : (hasPain ? '#FEF2F2' : C.grayLight), border: open ? `1.5px solid #FED7AA` : (hasPain ? `1.5px solid #FCA5A5` : `1.5px solid ${C.grayLight}`), borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: sans, transition: 'all 0.15s' }}>
        <span style={{ fontSize: '1rem' }}>🩹</span>
        <span style={{ fontWeight: 600, fontSize: '0.84rem', color: C.navy }}>
          Ból / dyskomfort
          {hasPain && <span style={{ marginLeft: 6, fontFamily: mono, fontSize: '0.62rem', color: C.red, fontWeight: 800 }}>VAS {Math.max(...pains.map((p: any) => p.vas_score || 0))}</span>}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: C.gray }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 6, padding: '0.875rem', background: '#FAFBFC', borderRadius: 10, border: `1.5px solid ${C.grayLight}` }}>
          {/* Istniejące bóle */}
          {pains.map((p: any) => (
            <div key={p.id} style={{ marginBottom: 8, padding: '0.625rem 0.75rem', background: '#FEF2F2', border: `1px solid #FCA5A5`, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: p.description ? 4 : 0 }}>
                <span style={{ fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, color: vasColor(p.vas_score || 0) }}>VAS {p.vas_score}/10 · {vasLabel(p.vas_score || 0)}</span>
                <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray }}>{new Date(p.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {p.description && <div style={{ fontSize: '0.78rem', color: C.gray }}>{p.description}</div>}
            </div>
          ))}

          {/* Dodaj nowy (tylko jeśli nie w archiwum) */}
          {!isArchived && (
            <>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: mono }}>
                {pains.length > 0 ? 'Dodaj nowe' : 'Skala bólu VAS'} — {vas}/10
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '0.72rem', color: C.green, fontWeight: 600 }}>0</span>
                <input type="range" min={0} max={10} step={1} value={vas} onChange={e => setVas(parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: vasColor(vas) }} />
                <span style={{ fontSize: '0.72rem', color: C.red, fontWeight: 600 }}>10</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, color: vasColor(vas), marginBottom: '0.625rem' }}>
                {vasLabel(vas)}
              </div>
              <textarea placeholder="Gdzie boli? Opis odczuć..." value={painNote} onChange={e => setPainNote(e.target.value)} rows={2}
                style={{ width: '100%', padding: '0.55rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: '0.84rem', color: C.navy, resize: 'none', outline: 'none', background: C.white, boxSizing: 'border-box' }} />
              {(vas > 0 || painNote.trim()) && (
                <button onClick={savePain} disabled={saving}
                  style={{ marginTop: 8, width: '100%', padding: '0.6rem', background: saved ? C.green : C.navy, color: saved ? C.white : C.gold, border: 'none', borderRadius: 8, fontFamily: sans, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                  {saved ? '✓ Zapisano' : saving ? '...' : 'Zapisz odczucia'}
                </button>
              )}
            </>
          )}
          {isArchived && pains.length === 0 && (
            <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gray, textAlign: 'center', padding: '0.5rem 0' }}>Brak zapisanego bólu</div>
          )}
        </div>
      )}
    </div>
  )
}

// Edytowalna notatka do ćwiczenia
function ExerciseNoteField({ initialNote, firstLogId, isArchived }: { initialNote: string; firstLogId: number | null; isArchived: boolean }) {
  const supabase = createClient()
  const [note, setNote] = useState(initialNote)
  const [status, setStatus] = useState<'idle'|'saving'|'saved'>('idle')

  async function save() {
    if (!firstLogId) return
    setStatus('saving')
    await supabase.from('set_logs').update({ athlete_note: note.trim() || null }).eq('id', firstLogId)
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2000)
  }

  if (isArchived) {
    return note ? (
      <div style={{ marginTop: 8, padding: '0.5rem 0.75rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: '0.78rem', color: C.navy, fontStyle: 'italic' }}>
        💬 {note}
      </div>
    ) : null
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5, fontFamily: mono }}>Notatka do ćwiczenia</div>
      <textarea
        placeholder="Jak poszło? Uwagi do następnego razu..."
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={save}
        rows={2}
        style={{ width: '100%', padding: '0.55rem 0.75rem', border: `1.5px solid ${status === 'saved' ? C.green : C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: '0.84rem', color: C.navy, resize: 'none', outline: 'none', background: '#FAFBFC', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
      {status === 'saved' && <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.green, marginTop: 2 }}>✓ zapisano</div>}
    </div>
  )
}

export default function HistoryDetailClient({ athlete, session, setLogs, wellness, feedback: initialFeedback, painLogs }: any) {
  const router = useRouter()
  const supabase = createClient()
  const day = session.workout_day
  const plan = day?.week?.plan
  const isArchived = !!plan?.is_archived

  // Feedback
  const [rpe, setRpe] = useState<number>(initialFeedback?.session_rpe ?? 6)
  const [feeling, setFeeling] = useState<string>(initialFeedback?.feeling_after ?? '')
  const [whatWell, setWhatWell] = useState(initialFeedback?.what_went_well ?? '')
  const [painComment, setPainComment] = useState(initialFeedback?.pain_after_comment ?? '')
  const [notes, setNotes] = useState(initialFeedback?.general_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'ok' | 'err' | null>(null)
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  // Data sesji do wellness
  const sessionDate = session.date_completed
    ? new Date(session.date_completed).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  // Inline edycja gotowości do treningu (nie przekierowuje do pełnej strony wellness)
  const [editingWellness, setEditingWellness] = useState(false)
  const [localWellness, setLocalWellness] = useState(wellness)

  // Edycja serii
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [savingLog, setSavingLog] = useState(false)
  const [savedLogId, setSavedLogId] = useState<number | null>(null)
  const [logOverrides, setLogOverrides] = useState<Record<number, { weight?: number }>>({})

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

  // Ból per ćwiczenie (po location = nazwa ćwiczenia)
  const painByExercise: Record<string, any[]> = {}
  for (const p of (painLogs || [])) {
    const loc = p.location || ''
    if (!painByExercise[loc]) painByExercise[loc] = []
    painByExercise[loc].push(p)
  }

  const cycleColors: Record<string, string> = { menstruacja: C.red, folikularna: '#F59E0B', owulacja: C.green, lutealna: '#A78BFA' }

  // Nowo stworzone logi (kliknięcie "zaznacz" przy brakującej serii)
  const [extraLogs, setExtraLogs] = useState<any[]>([])

  function startEditLog(log: any) {
    setEditingLogId(log.id)
    setEditWeight(log.weight != null ? String(log.weight) : '')
  }

  async function createMissingLog(blockExerciseId: number, setNum: number, isWarmup: boolean, sessionId: number, athleteId: number) {
    const { data } = await supabase.from('set_logs').insert({
      workout_session_id: sessionId, block_exercise_id: blockExerciseId,
      athlete_id: athleteId, set_number: setNum,
      weight: null, reps_completed: null,
      is_warmup: isWarmup, completed: true,
    }).select().single()
    if (data) {
      setExtraLogs(prev => [...prev, data])
      setSavedLogId(data.id)
      setTimeout(() => setSavedLogId(null), 2500)
    }
  }

  async function saveLog(logId: number) {
    setSavingLog(true)
    const w = parseFloat(editWeight.replace(',', '.'))
    const patch: any = {}
    if (!isNaN(w)) patch.weight = w
    await supabase.from('set_logs').update(patch).eq('id', logId)
    setLogOverrides(prev => ({ ...prev, [logId]: { ...prev[logId], ...patch } }))
    setSavingLog(false); setSavedLogId(logId); setEditingLogId(null)
    setTimeout(() => setSavedLogId(null), 2000)
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
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function sendReport() {
    setSending(true); setSendResult(null)
    await saveFeedback()
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, athleteId: athlete.id }),
    })
    const ok = res.ok
    setSendResult(ok ? 'ok' : 'err'); setSending(false)
    if (ok) setShowPrintDialog(true)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px; background: ${C.grayLight}; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: ${C.gold}; cursor: pointer; border: 2px solid ${C.white}; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
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
              <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                {plan?.name} · Tydzień {day?.week?.week_number}
                {isArchived && <span style={{ marginLeft: 8, color: C.gray }}> · archiwum</span>}
              </div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{day?.day_name}</div>
            </div>
            {session.report_sent && (
              <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.green, background: C.green + '22', border: `1px solid ${C.green}`, borderRadius: 8, padding: '4px 8px', fontWeight: 700 }}>
                📋 wysłany
              </div>
            )}
          </div>
        </header>

        <main style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 1rem 6rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* ── DATA ── */}
          <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, textAlign: 'center', padding: '0.25rem 0' }}>
            {session.date_completed
              ? new Date(session.date_completed).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </div>

          {/* ── WELLNESS PRZED TRENINGIEM ── */}
          <Card>
            <SectionHeader>
              🩺 Gotowość do treningu
              {!editingWellness && (
                <button onClick={() => setEditingWellness(true)}
                  style={{ marginLeft: 'auto', padding: '2px 10px', background: C.navyLight, color: C.gold, border: 'none', borderRadius: 6, fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, cursor: 'pointer' }}>
                  {localWellness ? '✏️ edytuj' : '+ uzupełnij'}
                </button>
              )}
            </SectionHeader>

            {editingWellness && (
              <WellnessEditPanel
                wellness={localWellness}
                athleteId={athlete.id}
                sessionDate={sessionDate}
                sessionId={session.id}
                onSaved={saved => { setLocalWellness(saved); setEditingWellness(false) }}
              />
            )}

            {!editingWellness && (localWellness ? (
              <div style={{ padding: '1rem 1.25rem' }}>
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
                {wellness.resting_hr && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${C.grayLight}` }}>
                    <span style={{ fontSize: '0.82rem', color: C.gray }}>HR spoczynkowe</span>
                    <span style={{ fontFamily: mono, fontWeight: 800, color: C.navy }}>{wellness.resting_hr} bpm</span>
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
                {wellness.activity_data?.type && (
                  <div style={{ marginTop: 10, padding: '0.75rem', background: C.offWhite, borderRadius: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Aktywność dodatkowa</div>
                    <div style={{ fontWeight: 700, color: C.navy }}>{wellness.activity_data.type}</div>
                    <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 2 }}>
                      {[wellness.activity_data.time, wellness.activity_data.duration && `${wellness.activity_data.duration} min`, wellness.activity_data.rpe && `RPE ${wellness.activity_data.rpe}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                )}
                {wellness.pain_data?.painDuring > 0 && (
                  <div style={{ marginTop: 10, padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.red, textTransform: 'uppercase', marginBottom: 3 }}>Ból podczas treningu</div>
                    <div style={{ fontFamily: mono, fontWeight: 800, color: C.red }}>{wellness.pain_data.painDuring}/10</div>
                    {wellness.pain_data.location && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 2 }}>📍 {wellness.pain_data.location}</div>}
                  </div>
                )}
                {wellness.concerns && (
                  <div style={{ marginTop: 10, padding: '0.65rem 0.875rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.56rem', color: '#92400E', textTransform: 'uppercase', marginBottom: 3 }}>Uwagi dla trenera</div>
                    <div style={{ fontSize: '0.84rem', color: C.navy, fontStyle: 'italic' }}>&ldquo;{wellness.concerns}&rdquo;</div>
                  </div>
                )}
                {wellness.supplements_data?.counts && Object.values(wellness.supplements_data.counts).some((v: any) => v > 0) && (
                  <div style={{ marginTop: 10, padding: '0.65rem 0.875rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.56rem', color: '#92400E', textTransform: 'uppercase', marginBottom: 5 }}>Suplementy</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {Object.entries(wellness.supplements_data.counts).filter(([,v]: any) => v > 0).map(([id, count]: any) => (
                        <span key={id} style={{ padding: '2px 8px', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, fontFamily: mono, fontSize: '0.65rem', color: '#92400E' }}>
                          {id.replace(/_/g,' ')} ×{count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>📋</span>
                <div>
                  <div style={{ fontWeight: 700, color: C.navy, fontSize: '0.88rem', marginBottom: 3 }}>Brak wpisu gotowości</div>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, lineHeight: 1.4 }}>
                    Gotowość do treningu nie była wypełniona.<br />
                    Kliknij <strong style={{ color: C.gold }}>+ uzupełnij</strong> powyżej.
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* ── SERIE Z ĆWICZENIAMI ── */}
          {blockOrder.some(b => b.exIds.length > 0) && (
            <Card>
              <SectionHeader>
                🏋️ Serie
                {!isArchived && <span style={{ color: C.gold, fontSize: '0.5rem', marginLeft: 4, fontWeight: 600 }}>dotknij serię aby edytować · czerwona = niezaznaczona</span>}
              </SectionHeader>

              {blockOrder.map(block => {
                if (!block.exIds.length) return null
                return (
                  <div key={block.id}>
                    <div style={{ padding: '0.4rem 1.25rem', background: C.navyLight }}>
                      <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{block.name}</span>
                    </div>

                    {block.exIds.map((exId, ei) => {
                      const ex = exerciseMap[exId]
                      const name = ex?.exercise?.name ? ex.exercise.name.replace(/-/g,' ') : (ex?.exercise_code || `Ćw.#${exId}`)
                      const allLogs = [...(logsByExercise[exId] || []), ...extraLogs.filter((l: any) => l.block_exercise_id === exId)]
                        .sort((a: any, b: any) => a.set_number - b.set_number)
                      const main = allLogs.filter((l: any) => !l.is_warmup)
                      const wu = allLogs.filter((l: any) => l.is_warmup)

                      // Zaplanowana liczba serii i rozgrzewek z planu
                      const plannedSets: number = ex?.sets || 0
                      const warmupSets: any[] = Array.isArray(ex?.warmup_sets) ? ex.warmup_sets : (ex?.warmup_reps ? [{ reps: ex.warmup_reps, weight_kg: ex.warmup_weight }] : [])

                      const planStr = ex ? `${plannedSets}×${ex.reps || '—'}${ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}` : ''
                      const firstMainLog = main[0]
                      const initialNote = firstMainLog?.athlete_note || ''
                      const exPains = painByExercise[name] || []

                      return (
                        <div key={exId} style={{ padding: '0.875rem 1.25rem', borderBottom: ei < block.exIds.length - 1 ? `1px solid ${C.grayLight}` : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                            <span style={{ fontWeight: 700, color: C.navy, fontSize: '0.92rem' }}>{name}</span>
                            {planStr && <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>plan: {planStr}</span>}
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>

                            {/* ── Rozgrzewki: z logów lub zaplanowane ── */}
                            {warmupSets.length > 0
                              ? warmupSets.map((_: any, wIdx: number) => {
                                  const setNum = wIdx + 1
                                  const l = wu.find((x: any) => x.set_number === setNum)
                                  const ov = l ? (logOverrides[l.id] || {}) : {}
                                  const w = ov.weight ?? l?.weight
                                  const isEditing = l && editingLogId === l.id
                                  const isSaved = l && savedLogId === l.id
                                  const missing = !l

                                  if (isEditing) return (
                                    <SetEditTile key={`wu-${setNum}`} label={`Rozg${warmupSets.length > 1 ? ` ${setNum}` : ''}`}
                                      weight={editWeight} onWeight={setEditWeight}
                                      onSave={() => saveLog(l!.id)} onCancel={() => setEditingLogId(null)}
                                      saving={savingLog} />
                                  )
                                  return (
                                    <MissingOrDoneSetTile
                                      key={`wu-${setNum}`}
                                      label={`Rozg${warmupSets.length > 1 ? ` ${setNum}` : ''}`}
                                      weight={w} reps={null}
                                      missing={missing}
                                      done={!!l?.completed}
                                      isSaved={!!isSaved}
                                      isArchived={isArchived}
                                      onEdit={l ? () => startEditLog(ov.weight != null ? { ...l, weight: ov.weight } : l) : undefined}
                                      onMarkDone={missing ? () => createMissingLog(exId, setNum, true, session.id, athlete.id) : undefined}
                                    />
                                  )
                                })
                              : wu.map((l: any) => {
                                  const ov = logOverrides[l.id] || {}
                                  const w = ov.weight ?? l.weight
                                  const isEditing = editingLogId === l.id
                                  if (isEditing) return (
                                    <SetEditTile key={l.id} label="Rozg"
                                      weight={editWeight} onWeight={setEditWeight}
                                      onSave={() => saveLog(l.id)} onCancel={() => setEditingLogId(null)}
                                      saving={savingLog} />
                                  )
                                  return (
                                    <MissingOrDoneSetTile key={l.id} label="Rozg"
                                      weight={w} reps={null} missing={false} done={!!l.completed}
                                      isSaved={savedLogId === l.id} isArchived={isArchived}
                                      onEdit={() => startEditLog(ov.weight != null ? { ...l, weight: ov.weight } : l)} />
                                  )
                                })
                            }

                            {/* ── Serie robocze: wszystkie zaplanowane ── */}
                            {plannedSets > 0
                              ? Array.from({ length: plannedSets }, (_, i) => {
                                  const setNum = i + 1
                                  const l = main.find((x: any) => x.set_number === setNum)
                                  const ov = l ? (logOverrides[l.id] || {}) : {}
                                  const w = ov.weight ?? l?.weight
                                  const r = l?.reps_completed
                                  const isEditing = l && editingLogId === l.id
                                  const isSaved = l && savedLogId === l.id
                                  const missing = !l

                                  if (isEditing) return (
                                    <SetEditTile key={`s-${setNum}`} label={`S${setNum}`}
                                      weight={editWeight} onWeight={setEditWeight}
                                      onSave={() => saveLog(l!.id)} onCancel={() => setEditingLogId(null)}
                                      saving={savingLog} />
                                  )
                                  return (
                                    <MissingOrDoneSetTile
                                      key={`s-${setNum}`}
                                      label={`S${setNum}`}
                                      weight={w} reps={r}
                                      missing={missing}
                                      done={!!l?.completed}
                                      isSaved={!!isSaved}
                                      isArchived={isArchived}
                                      onEdit={l ? () => startEditLog({ ...l, weight: w }) : undefined}
                                      onMarkDone={missing ? () => createMissingLog(exId, setNum, false, session.id, athlete.id) : undefined}
                                    />
                                  )
                                })
                              : main.map((l: any) => {
                                  // fallback: pokaż zalogowane jeśli brak ex.sets
                                  const ov = logOverrides[l.id] || {}
                                  const w = ov.weight ?? l.weight
                                  const isEditing = editingLogId === l.id
                                  if (isEditing) return (
                                    <SetEditTile key={l.id} label={`S${l.set_number}`}
                                      weight={editWeight} onWeight={setEditWeight}
                                      onSave={() => saveLog(l.id)} onCancel={() => setEditingLogId(null)}
                                      saving={savingLog} />
                                  )
                                  return (
                                    <MissingOrDoneSetTile key={l.id} label={`S${l.set_number}`}
                                      weight={w} reps={l.reps_completed} missing={false}
                                      done={!!l.completed} isSaved={savedLogId === l.id}
                                      isArchived={isArchived}
                                      onEdit={() => startEditLog({ ...l, weight: w })} />
                                  )
                                })
                            }
                          </div>

                          <ExerciseNoteField
                            initialNote={initialNote}
                            firstLogId={firstMainLog?.id || null}
                            isArchived={isArchived}
                          />

                          <ExercisePainPanel
                            exerciseName={name}
                            sessionId={session.id}
                            athleteId={athlete.id}
                            existingPains={exPains}
                            isArchived={isArchived}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </Card>
          )}

          {/* ── BÓL OGÓLNY (bez przypisania do ćwiczenia) ── */}
          {(() => {
            const generalPains = (painLogs || []).filter((p: any) => {
              // Bóle nie przypisane do ćwiczenia (location null lub 'Ogólny')
              const allExNames = blockOrder.flatMap(b => b.exIds.map(id => {
                const ex = exerciseMap[id]
                return ex?.exercise?.name?.replace(/-/g,' ') || ex?.exercise_code || ''
              }))
              return !p.location || (!allExNames.includes(p.location) && p.location !== '')
            })
            if (!generalPains.length) return null
            return (
              <Card>
                <SectionHeader>🩹 Ból ogólny / po treningu</SectionHeader>
                <div style={{ padding: '0.875rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {generalPains.map((p: any) => (
                    <div key={p.id} style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: C.navy, fontSize: '0.88rem' }}>{p.location || 'Nieznana lokalizacja'}</span>
                        <span style={{ fontFamily: mono, fontWeight: 800, color: vasColor(p.vas_score || 0) }}>VAS {p.vas_score}/10</span>
                      </div>
                      {p.description && <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: 4 }}>{p.description}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            )
          })()}

          {/* ── FEEDBACK PO TRENINGU ── */}
          <Card>
            <SectionHeader>
              💬 Feedback po treningu
              {!isArchived && <span style={{ color: C.gold, fontSize: '0.5rem', marginLeft: 4, fontWeight: 600 }}>edytowalny</span>}
            </SectionHeader>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

              {/* RPE */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: C.navy }}>Jak ciężki był trening? (RPE)</span>
                  <span style={{ fontFamily: mono, fontSize: '1.05rem', fontWeight: 800, color: rpeColor(rpe) }}>
                    {rpe}/10
                    <span style={{ fontSize: '0.62rem', fontWeight: 400, color: C.gray, marginLeft: 5 }}>{rpeLabel(rpe)}</span>
                  </span>
                </div>
                {!isArchived ? (
                  <>
                    <input type="range" min={0} max={10} step={1} value={rpe} onChange={e => setRpe(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: rpeColor(rpe) }} />
                    <div style={{ height: 4, background: C.grayLight, borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                      <div style={{ height: '100%', width: `${rpe * 10}%`, background: rpeColor(rpe), borderRadius: 2, transition: 'width 0.2s' }} />
                    </div>
                  </>
                ) : (
                  <div style={{ height: 8, background: C.grayLight, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${rpe * 10}%`, background: rpeColor(rpe), borderRadius: 4 }} />
                  </div>
                )}
              </div>

              {/* Samopoczucie */}
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: C.navy, display: 'block', marginBottom: 8 }}>Jak się czułaś po treningu?</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FEELING_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => !isArchived && setFeeling(opt.value)}
                      style={{ padding: '0.5rem 0.875rem', background: feeling === opt.value ? C.navy : C.offWhite, border: feeling === opt.value ? 'none' : `1.5px solid ${C.grayLight}`, borderRadius: 10, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 5, fontWeight: feeling === opt.value ? 700 : 400, color: feeling === opt.value ? C.gold : C.navy, cursor: isArchived ? 'default' : 'pointer', opacity: isArchived && feeling !== opt.value ? 0.4 : 1 }}>
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
                  <div style={{ fontFamily: mono, fontSize: '0.58rem', color: f.color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 5 }}>{f.label}</div>
                  {isArchived ? (
                    <div style={{ padding: '0.625rem 0.875rem', background: C.offWhite, borderRadius: 10, fontSize: '0.84rem', color: f.val ? C.navy : C.gray, fontStyle: f.val ? 'normal' : 'italic', minHeight: 38 }}>
                      {f.val || 'Brak wpisu'}
                    </div>
                  ) : (
                    <textarea value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} rows={2}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, fontFamily: sans, fontSize: '0.84rem', color: C.navy, resize: 'none', outline: 'none', background: C.offWhite, boxSizing: 'border-box' }} />
                  )}
                </div>
              ))}

              {/* Przyciski (tylko jeśli nie archiwum) */}
              {!isArchived && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
                  <button onClick={sendReport} disabled={sending || !feeling}
                    style={{ width: '100%', padding: '0.9rem', background: !feeling ? C.grayLight : C.navy, color: !feeling ? C.gray : C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem', transition: 'all 0.15s' }}>
                    {sending ? 'Wysyłam...' : sendResult === 'ok' ? '✓ Raport wysłany do trenera!' : sendResult === 'err' ? '✗ Błąd — spróbuj ponownie' : '📋 Wyślij raport do trenera'}
                  </button>
                  <button onClick={saveFeedback} disabled={saving}
                    style={{ width: '100%', padding: '0.75rem', background: saved ? C.green : C.offWhite, color: saved ? C.white : C.gray, border: `1.5px solid ${saved ? C.green : C.grayLight}`, borderRadius: 12, fontWeight: 700, fontSize: '0.82rem' }}>
                    {saving ? 'Zapisuję...' : saved ? '✓ Zapisano' : 'Zapisz bez wysyłania'}
                  </button>
                </div>
              )}
            </div>
          </Card>

        </main>
      </div>

      {/* ── DIALOG DRUKOWANIA ── */}
      {showPrintDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,42,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: C.white, borderRadius: 20, padding: '1.75rem', maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily: sans }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🖨️</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: C.navy, marginBottom: 6 }}>Raport wysłany!</div>
              <div style={{ fontSize: '0.84rem', color: C.gray, lineHeight: 1.5 }}>
                Raport z treningu trafił do trenera.<br />Czy chcesz również wydrukować raport?
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { setShowPrintDialog(false); window.print() }}
                style={{ padding: '0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem' }}>
                🖨️ Tak, drukuj raport
              </button>
              <button onClick={() => setShowPrintDialog(false)}
                style={{ padding: '0.75rem', background: C.offWhite, color: C.gray, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, fontWeight: 700, fontSize: '0.84rem' }}>
                Nie, dziękuję
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
