'use client'
// src/app/coach/groups/[id]/plan/[planId]/day/[dayId]/DayFillClient.tsx
// Trener uzupełnia trening z planu za zawodniczki grupy samodzielnej — wiersze:
// zawodniczki, kolumny: ćwiczenia dnia. Zapis do tych samych tabel, z których
// korzysta aplikacja zawodniczki, więc obie strony widzą swoje zmiany:
//  - seria → set_logs (weight albo reps_completed dla AMRAP/max), completed gdy wpisano
//  - notatka do ćwiczenia → set_logs.athlete_note pierwszej serii
//  - ból → pain_logs (pain_location = nazwa ćwiczenia, jak u zawodniczki)
//  - „zakończony" → workout_sessions.completed (zaznacza trener albo zawodniczka)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Button } from '@/components/coach/ui'
import { AlertTriangle, MessageCircle, Check, X, RefreshCw } from 'lucide-react'

type Athlete = { id: number; full_name: string }
type BlockEx = {
  id: number; block_id: number; exercise_order: number; sets: number | null; reps?: string | null; tempo?: string | null
  weight_kg?: number | null; rir?: number | null; coach_comment?: string | null; exercise_code?: string | null
  exercise?: { id: number; name: string } | null
}
type Block = { id: number; block_name: string | null; block_order: number; rounds?: number | null; workout_block_exercises: BlockEx[] }
type Session = { id: number; athlete_id: number; workout_day_id: number; assignment_id: number | null; completed: boolean; date_completed?: string | null; created_at?: string }
type SetLog = { id: number; workout_session_id: number; block_exercise_id: number; athlete_id: number; set_number: number; weight: number | null; reps_completed: number | null; completed: boolean; athlete_note?: string | null }
type PainLog = { id: number; workout_session_id: number; vas_score: number | null; pain_comment: string | null; pain_location: string | null }
type Override = { athlete_id: number; block_exercise_id: number; sets_override?: number | null; reps_override?: string | null; tempo_override?: string | null; weight_override?: number | null; skip?: boolean | null; exercise_code_override?: string | null; is_substitution?: boolean | null }

interface Props {
  group: { id: number; name: string }
  plan: { id: number; name: string }
  day: { id: number; day_name: string | null }
  dayNav: { id: number; day_name: string | null; week_number: number; day_order: number }[]
  blocks: Block[]
  athletes: Athlete[]
  overrides: Override[]
  sessions: Session[]
  setLogs: SetLog[]
  painLogs: PainLog[]
  assignmentByAthlete: Record<number, number>
}

const INTER = 'var(--font-inter), sans-serif'
const fmtName = (s: string) => s.replace(/-/g, ' ')
const isAmrap = (r: unknown) => typeof r === 'string' && /(amrap|maks|max|upad)/i.test(r)
const logKey = (sessionId: number, exId: number, setNum: number) => `${sessionId}_${exId}_${setNum}`
const ovrKey = (athleteId: number, exId: number) => `${athleteId}_${exId}`
const blockLetter = (pos: number) => String.fromCharCode(65 + (pos % 26))

const qiBtn: React.CSSProperties = {
  width: 20, height: 20, padding: 0, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, border: '1.5px solid var(--border)', background: '#ffffff', color: 'var(--muted-light)', lineHeight: 1, outline: 'none',
}

// Pole edycji pod komórką: notatka albo ból (z oceną 0–10)
function InlineEditor({ initialValue, initialScale, showScale, placeholder, color, bg, onSave, onCancel }: {
  initialValue: string; initialScale?: number | null; showScale?: boolean; placeholder: string; color: string; bg: string
  onSave: (value: string, scale: number | null) => void; onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const [scale, setScale] = useState(initialScale != null ? String(initialScale) : '')
  const parsed = () => (scale.trim() === '' ? null : Math.max(0, Math.min(10, Number(scale))))
  const submit = () => onSave(value, showScale ? parsed() : null)
  return (
    <div style={{ marginTop: 6, width: 250, display: 'flex', alignItems: 'center', gap: 6 }}>
      {showScale && (
        <input type="number" min={0} max={10} value={scale} onChange={e => setScale(e.target.value)} placeholder="0–10"
          onKeyDown={e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') onCancel() }}
          style={{ width: 42, flexShrink: 0, textAlign: 'center', border: '1.5px solid #c23b3b', borderRadius: 7, background: '#FDEDED', color: '#c23b3b', fontFamily: INTER, fontSize: '0.72rem', fontWeight: 700, padding: '5px 2px', outline: 'none' }} />
      )}
      <input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } else if (e.key === 'Escape') onCancel() }}
        style={{ flex: 1, minWidth: 0, border: `1.5px solid ${color}`, borderRadius: 8, background: bg, fontFamily: INTER, fontSize: '0.76rem', color: 'var(--navy-900)', padding: '5px 9px', outline: 'none' }} />
      <button onClick={submit} title="Zapisz" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: 'none', background: 'var(--green)', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={13} /></button>
      <button onClick={onCancel} title="Anuluj" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: 'none', background: 'none', color: 'var(--muted-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
    </div>
  )
}

export default function DayFillClient({ group, plan, day, dayNav, blocks, athletes, overrides, sessions: initialSessions, setLogs: initialLogs, painLogs: initialPains, assignmentByAthlete }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Stan z serwera; po „Odśwież" (router.refresh) przychodzą nowe propsy — przejmujemy je
  const buildLogs = (logs: SetLog[]) => {
    const m: Record<string, SetLog> = {}
    for (const l of logs) { const k = logKey(l.workout_session_id, l.block_exercise_id, l.set_number); if (!m[k]) m[k] = l } // najnowszy wygrywa
    return m
  }
  const [sessions, setSessions] = useState<Record<number, Session>>(() => Object.fromEntries(initialSessions.map(s => [s.athlete_id, s])))
  const [logs, setLogs] = useState<Record<string, SetLog>>(() => buildLogs(initialLogs))
  const [pains, setPains] = useState<PainLog[]>(initialPains)
  useEffect(() => {
    setSessions(Object.fromEntries(initialSessions.map(s => [s.athlete_id, s])))
    setLogs(buildLogs(initialLogs))
    setPains(initialPains)
  }, [initialSessions, initialLogs, initialPains])

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(0)
  const [cellEdit, setCellEdit] = useState<{ key: string; type: 'note' | 'pain' } | null>(null)
  const sessionPromises = useRef<Map<number, Promise<Session | null>>>(new Map())
  const boardRef = useRef<HTMLDivElement>(null)

  const ovrMap = useMemo(() => new Map(overrides.map(o => [ovrKey(o.athlete_id, o.block_exercise_id), o])), [overrides])

  // Kolumny: ćwiczenia wszystkich bloków dnia (A1, A2, B1...)
  const columns = useMemo(() => blocks.flatMap((b, bi) => b.workout_block_exercises.map((ex, i) => ({ ex, block: b, label: `${blockLetter(bi)}${i + 1}`, blockStart: i === 0 }))), [blocks])

  const exName = (ex: BlockEx, o?: Override) => o?.exercise_code_override || fmtName(ex.exercise?.name || ex.exercise_code || 'Ćwiczenie')

  function track<T>(p: Promise<T>): Promise<T> {
    setSaving(n => n + 1)
    return p.finally(() => setSaving(n => n - 1))
  }

  // Sesja zawodniczki dla tego dnia — tworzona przy pierwszym wpisie trenera
  async function ensureSession(athleteId: number): Promise<Session | null> {
    if (sessions[athleteId]) return sessions[athleteId]
    const pending = sessionPromises.current.get(athleteId)
    if (pending) return pending
    const p = (async () => {
      const { data, error: err } = await supabase.from('workout_sessions').insert({
        athlete_id: athleteId, workout_day_id: day.id, assignment_id: assignmentByAthlete[athleteId] ?? null,
        completed: false, report_sent: false,
      }).select().single()
      if (err || !data) {
        // zawodniczka mogła właśnie otworzyć trening u siebie — weź jej sesję
        const { data: existing } = await supabase.from('workout_sessions').select('*')
          .eq('athlete_id', athleteId).eq('workout_day_id', day.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (!existing) {
          setError(/policy|permission|row-level/i.test(err?.message || '')
            ? 'Brak uprawnień do zapisu za zawodniczkę — uruchom migrację 202610050001.'
            : (err?.message || 'Nie udało się utworzyć treningu zawodniczki'))
          return null
        }
        setSessions(prev => ({ ...prev, [athleteId]: existing as Session }))
        return existing as Session
      }
      setSessions(prev => ({ ...prev, [athleteId]: data as Session }))
      return data as Session
    })()
    sessionPromises.current.set(athleteId, p)
    const res = await p
    sessionPromises.current.delete(athleteId)
    return res
  }

  // Zapis jednej serii (ciężar albo wykonane powtórzenia w trybie AMRAP/max)
  async function saveSet(athleteId: number, ex: BlockEx, setNum: number, field: 'weight' | 'reps_completed', raw: string) {
    const value = raw.trim().replace(',', '.')
    const session = sessions[athleteId]
    const existing = session ? logs[logKey(session.id, ex.id, setNum)] : undefined
    const current = existing?.[field] != null ? String(existing[field]) : ''
    if (value === current) return
    if (!value && !existing) return
    const num = value === '' ? null : (field === 'weight' ? parseFloat(value) : parseInt(value))
    if (value !== '' && (num == null || isNaN(num))) { setError('Wpisz liczbę.'); return }
    setError('')
    await track((async () => {
      const s = await ensureSession(athleteId)
      if (!s) return
      const other = field === 'weight' ? 'reps_completed' : 'weight'
      const prev = logs[logKey(s.id, ex.id, setNum)]
      const payload = {
        workout_session_id: s.id, block_exercise_id: ex.id, athlete_id: athleteId, set_number: setNum, is_warmup: false,
        [field]: num, [other]: prev?.[other] ?? null,
        completed: num != null || prev?.[other] != null,
      }
      let id = prev?.id
      if (!id) {
        const { data: found } = await supabase.from('set_logs').select('id').eq('workout_session_id', s.id).eq('block_exercise_id', ex.id)
          .eq('set_number', setNum).eq('is_warmup', false).order('created_at', { ascending: false }).limit(1).maybeSingle()
        id = found?.id
      }
      const res = id
        ? await supabase.from('set_logs').update(payload).eq('id', id).select().single()
        : await supabase.from('set_logs').insert(payload).select().single()
      if (res.error || !res.data) { setError(res.error?.message || 'Błąd zapisu serii'); return }
      setLogs(m => ({ ...m, [logKey(s.id, ex.id, setNum)]: res.data as SetLog }))
    })())
  }

  // Notatka do ćwiczenia — jak u zawodniczki: athlete_note pierwszej serii
  async function saveNote(athleteId: number, ex: BlockEx, text: string) {
    await track((async () => {
      const s = await ensureSession(athleteId)
      if (!s) return
      const note = text.trim() || null
      const first = Object.values(logs).filter(l => l.workout_session_id === s.id && l.block_exercise_id === ex.id).sort((a, b) => a.set_number - b.set_number)[0]
      const res = first
        ? await supabase.from('set_logs').update({ athlete_note: note }).eq('id', first.id).select().single()
        : note
          ? await supabase.from('set_logs').insert({ workout_session_id: s.id, block_exercise_id: ex.id, athlete_id: athleteId, set_number: 1, is_warmup: false, weight: null, reps_completed: null, completed: false, athlete_note: note }).select().single()
          : null
      if (!res) return
      if (res.error || !res.data) { setError(res.error?.message || 'Błąd zapisu notatki'); return }
      const l = res.data as SetLog
      setLogs(m => ({ ...m, [logKey(l.workout_session_id, l.block_exercise_id, l.set_number)]: l }))
    })())
  }

  function painFor(sessionId: number | undefined, name: string): PainLog | undefined {
    if (!sessionId) return undefined
    const n = name.toLowerCase()
    return pains.find(p => p.workout_session_id === sessionId && (p.pain_location || '').toLowerCase().includes(n))
  }

  async function savePain(athleteId: number, name: string, comment: string, vas: number | null) {
    await track((async () => {
      const s = await ensureSession(athleteId)
      if (!s) return
      const existing = painFor(s.id, name)
      const empty = !comment.trim() && vas == null
      if (empty) {
        if (!existing) return
        const { error: err } = await supabase.from('pain_logs').delete().eq('id', existing.id)
        if (err) { setError(err.message); return }
        setPains(p => p.filter(x => x.id !== existing.id))
        return
      }
      const payload = { workout_session_id: s.id, vas_score: vas ?? 0, pain_comment: comment.trim() || null, pain_location: name, pain_reported: true }
      const res = existing
        ? await supabase.from('pain_logs').update(payload).eq('id', existing.id).select().single()
        : await supabase.from('pain_logs').insert(payload).select().single()
      if (res.error || !res.data) { setError(res.error?.message || 'Błąd zapisu bólu'); return }
      setPains(p => [res.data as PainLog, ...p.filter(x => x.id !== (res.data as PainLog).id)])
    })())
  }

  // Zakończony / niezakończony — trener może przełączać w obie strony
  async function toggleCompleted(athleteId: number) {
    setError('')
    await track((async () => {
      const s = await ensureSession(athleteId)
      if (!s) return
      const next = !s.completed
      const { data, error: err } = await supabase.from('workout_sessions')
        .update({ completed: next, date_completed: next ? new Date().toISOString() : null })
        .eq('id', s.id).select().single()
      if (err || !data) {
        setError(/unique|duplicate/i.test(err?.message || '')
          ? 'Zawodniczka ma już otwarty ten trening u siebie — odśwież stronę.'
          : (err?.message || 'Błąd zmiany statusu'))
        return
      }
      setSessions(prev => ({ ...prev, [athleteId]: data as Session }))
    })())
  }

  // Enter — ta sama seria u następnej zawodniczki; strzałki — sąsiednia seria
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number, setIdx: number) {
    const go = (r: number, c: number, s: number) => {
      const el = boardRef.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"][data-s="${s}"]`)
      if (el) { el.focus(); el.select(); return true }
      return false
    }
    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); go(row + 1, col, setIdx) }
    else if (e.key === 'ArrowRight' && !go(row, col, setIdx + 1)) { for (let c = col + 1; c < columns.length; c++) if (go(row, c, 0)) break }
    else if (e.key === 'ArrowLeft' && setIdx > 0) go(row, col, setIdx - 1)
  }

  const doneCount = athletes.filter(a => sessions[a.id]?.completed).length

  return (
    <>
      <SetPageMeta title={`${plan.name} · ${day.day_name || 'Trening'}`} backHref={`/coach/groups/${group.id}/plan`} backLabel={group.name} sidebarCollapsible />
      <style>{`
        .df-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; }
        .df-table th, .df-table td { border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); vertical-align: top; }
        .df-sticky { position: sticky; left: 0; z-index: 2; background: #ffffff; box-shadow: 3px 0 8px rgba(13,27,42,0.05); }
        .df-table thead th { position: sticky; top: 0; z-index: 4; }
        .df-table thead tr.df-ex-row th { top: 30px; }
        .df-table thead th.df-sticky { z-index: 5; }
        .df-block-start { border-left: 2px solid var(--navy-900) !important; }
        .df-row:nth-child(even) td, .df-row:nth-child(even) .df-sticky { background: #FBFCFE; }
        .df-row:hover td, .df-row:hover .df-sticky { background: #EFF4FB; }
        .df-w { width: 40px; border: 1.5px solid #DBE2EB; border-radius: 6px; background: #FAFBFC; font-family: var(--font-inter), sans-serif; font-size: 0.7rem; color: var(--navy-900); padding: 0.26rem 0.15rem; outline: none; text-align: center; }
        .df-w.filled { border-color: var(--border); background: #ffffff; font-weight: 700; }
        .df-w:focus { border-color: var(--gold); background: #ffffff; }
      `}</style>
      <div className="coach-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {dayNav.map((d, i) => (
              <button
                key={d.id}
                onClick={() => d.id !== day.id && router.push(`/coach/groups/${group.id}/plan/${plan.id}/day/${d.id}`)}
                style={{ border: `1.5px solid ${d.id === day.id ? 'var(--navy-900)' : 'var(--border)'}`, background: d.id === day.id ? 'var(--navy-900)' : '#ffffff', color: d.id === day.id ? 'var(--gold)' : 'var(--navy-900)', borderRadius: 8, padding: '5px 10px', fontFamily: INTER, fontSize: '0.72rem', fontWeight: 700, outline: 'none' }}
              >
                {d.day_name || `Trening ${i + 1}`}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontFamily: INTER, fontSize: '0.74rem', color: 'var(--muted)' }}>
            {saving > 0 ? 'Zapisuję…' : 'Zapisano'} · zakończone {doneCount}/{athletes.length}
          </span>
          <Button variant="ghost" size="small" onClick={() => router.refresh()} title="Pobierz zmiany wpisane przez zawodniczki">
            <RefreshCw size={13} /> Odśwież
          </Button>
        </div>

        <p style={{ margin: 0, fontFamily: INTER, fontSize: '0.74rem', color: 'var(--muted)' }}>
          Wpisz ciężary (lub powtórzenia przy AMRAP/max) za zawodniczki — zapisują się po wyjściu z pola. Dopóki trening nie jest oznaczony jako
          zakończony, zawodniczka widzi te wpisy u siebie i może je zmieniać. Enter — ta sama seria u następnej zawodniczki, ← → — sąsiednia seria.
        </p>

        {error && (
          <div style={{ padding: '0.7rem', background: '#fdedec', border: '1.5px solid #c23b3b', borderRadius: 10, color: '#c23b3b', fontWeight: 700, fontSize: '0.84rem', fontFamily: INTER }}>❌ {error}</div>
        )}

        {columns.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: 'var(--muted-light)', fontFamily: INTER }}>
            Ten trening nie ma jeszcze ćwiczeń — dodaj je w edytorze planu.
            <div style={{ marginTop: 10 }}><Button variant="dark" size="small" onClick={() => router.push(`/coach/groups/${group.id}/plan/${plan.id}`)} style={{ color: 'var(--gold)' }}>Otwórz edytor planu</Button></div>
          </div>
        ) : athletes.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: 'var(--muted-light)', fontFamily: INTER }}>Brak zawodniczek w grupie.</div>
        ) : (
          <div ref={boardRef} style={{ background: '#ffffff', overflow: 'auto', maxHeight: 'calc(100vh - 220px)', boxShadow: 'var(--shadow)', borderRadius: 12 }}>
            <table className="df-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="df-sticky" style={{ width: 190, minWidth: 190, padding: '0.55rem 0.5rem', textAlign: 'left', fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--bg)' }}>
                    Zawodniczka
                  </th>
                  {blocks.map((b, bi) => b.workout_block_exercises.length > 0 && (
                    <th key={b.id} colSpan={b.workout_block_exercises.length} className="df-block-start" style={{ height: 30, padding: '0 0.6rem', background: 'var(--navy-900)', verticalAlign: 'middle', textAlign: 'left' }}>
                      <span style={{ fontFamily: INTER, fontSize: '0.74rem', fontWeight: 800, color: 'var(--gold)' }}>Blok {blockLetter(bi)}</span>
                      {b.block_name && <span style={{ fontFamily: INTER, fontSize: '0.68rem', fontWeight: 600, color: '#aeb7cc', marginLeft: 8 }}>{b.block_name}{b.rounds && b.rounds > 1 ? ` · ${b.rounds} rundy` : ''}</span>}
                    </th>
                  ))}
                  <th rowSpan={2} style={{ width: '100%', background: 'var(--bg)', border: 'none' }} />
                </tr>
                <tr className="df-ex-row">
                  {columns.map(({ ex, label, blockStart }) => {
                    const presc = [
                      ex.sets ? `${ex.sets}×${ex.reps || '?'}` : ex.reps,
                      ex.tempo ? `tempo ${ex.tempo}` : '',
                      ex.weight_kg != null ? `${ex.weight_kg} kg` : '',
                      ex.rir != null ? `RIR ${ex.rir}` : '',
                    ].filter(Boolean).join(' · ')
                    return (
                      <th key={ex.id} className={blockStart ? 'df-block-start' : undefined} style={{ width: 280, minWidth: 280, maxWidth: 280, padding: '0.45rem 0.55rem', background: 'var(--bg)', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ flexShrink: 0, minWidth: 26, textAlign: 'center', borderRadius: 6, background: 'var(--navy-900)', color: 'var(--gold)', fontFamily: INTER, fontSize: '0.66rem', fontWeight: 800, padding: '3px 5px', lineHeight: 1 }}>{label}</span>
                          <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--navy-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={exName(ex)}>{exName(ex)}</span>
                        </div>
                        {presc && <div style={{ marginTop: 4, fontFamily: INTER, fontSize: '0.66rem', fontWeight: 700, color: 'var(--muted)' }}>{presc}</div>}
                        {ex.coach_comment && <div style={{ marginTop: 2, fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ex.coach_comment}>{ex.coach_comment}</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {athletes.map((athlete, rowIdx) => {
                  const session = sessions[athlete.id]
                  const done = !!session?.completed
                  return (
                    <tr key={athlete.id} className="df-row">
                      <td className="df-sticky" style={{ padding: '0.45rem 0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--navy-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 176 }}>{athlete.full_name}</div>
                        <button
                          onClick={() => toggleCompleted(athlete.id)}
                          title={done ? 'Kliknij, by cofnąć — zawodniczka znów będzie mogła dokończyć trening' : 'Oznacz trening jako zakończony'}
                          style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, border: `1.5px solid ${done ? '#15803d' : 'var(--border)'}`, background: done ? '#EEF8F1' : '#ffffff', color: done ? '#15803d' : 'var(--muted)', borderRadius: 6, padding: '2px 7px', fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, outline: 'none' }}
                        >
                          {done ? <><Check size={11} /> zakończony</> : session ? 'w trakcie · zakończ' : 'nie rozpoczęty · zakończ'}
                        </button>
                      </td>
                      {columns.map(({ ex, blockStart }, colIdx) => {
                        const o = ovrMap.get(ovrKey(athlete.id, ex.id))
                        const cellKey = ovrKey(athlete.id, ex.id)
                        if (o?.skip) {
                          return <td key={ex.id} className={blockStart ? 'df-block-start' : undefined} style={{ padding: '0.45rem 0.55rem', fontFamily: INTER, fontSize: '0.66rem', color: 'var(--muted-light)', fontStyle: 'italic' }}>pominięte dla tej zawodniczki</td>
                        }
                        const name = exName(ex, o)
                        const reps = o?.reps_override || ex.reps || ''
                        const amrap = isAmrap(reps)
                        const field: 'weight' | 'reps_completed' = amrap ? 'reps_completed' : 'weight'
                        const planned = o?.sets_override || ex.sets || 1
                        const sessionLogs = session ? Object.values(logs).filter(l => l.workout_session_id === session.id && l.block_exercise_id === ex.id) : []
                        const maxLogged = Math.max(0, ...sessionLogs.map(l => l.set_number))
                        const nSets = Math.max(planned, maxLogged)
                        const note = sessionLogs.sort((a, b) => a.set_number - b.set_number)[0]?.athlete_note || ''
                        const pain = painFor(session?.id, name)
                        const changed = o && (o.sets_override || o.reps_override || o.weight_override != null || o.exercise_code_override)
                        return (
                          <td key={ex.id} className={blockStart ? 'df-block-start' : undefined} style={{ padding: '0.4rem 0.5rem', ...(done ? { background: '#F4FBF6' } : {}) }}>
                            {changed && (
                              <div style={{ fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, color: '#7c3aed', marginBottom: 3 }}>
                                ✎ {o?.exercise_code_override ? `${o.exercise_code_override} · ` : ''}{planned}×{reps || '?'}{o?.weight_override != null ? ` · ${o.weight_override} kg` : ''}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap' }}>
                              {Array.from({ length: nSets }, (_, i) => {
                                const log = session ? logs[logKey(session.id, ex.id, i + 1)] : undefined
                                const val = log?.[field] != null ? String(log[field]) : ''
                                return (
                                  <div key={`${i}_${val}`}>
                                    <div style={{ fontFamily: INTER, fontSize: '0.5rem', color: 'var(--muted-light)', textAlign: 'center', marginBottom: 1 }}>S{i + 1}</div>
                                    <input
                                      defaultValue={val}
                                      placeholder={amrap ? 'powt.' : (o?.weight_override ?? ex.weight_kg) != null ? String(o?.weight_override ?? ex.weight_kg) : 'kg'}
                                      inputMode="decimal"
                                      className={`df-w${val ? ' filled' : ''}`}
                                      data-r={rowIdx} data-c={colIdx} data-s={i}
                                      onBlur={e => saveSet(athlete.id, ex, i + 1, field, e.target.value)}
                                      onKeyDown={e => handleKeyDown(e, rowIdx, colIdx, i)}
                                    />
                                  </div>
                                )
                              })}
                              <button
                                onClick={() => setCellEdit(prev => prev?.key === cellKey && prev.type === 'pain' ? null : { key: cellKey, type: 'pain' })}
                                title={pain ? `Ból ${pain.vas_score ?? ''}/10${pain.pain_comment ? `: ${pain.pain_comment}` : ''}` : 'Zaznacz ból'}
                                style={pain ? { ...qiBtn, border: '1.5px solid #c23b3b', background: '#FDEDED', color: '#c23b3b' } : qiBtn}
                              >
                                <AlertTriangle size={11} />
                              </button>
                              <button
                                onClick={() => setCellEdit(prev => prev?.key === cellKey && prev.type === 'note' ? null : { key: cellKey, type: 'note' })}
                                title={note || 'Dodaj notatkę'}
                                style={note ? { ...qiBtn, border: '1.5px solid #2c5aa3', background: '#eaf1fb', color: '#2c5aa3' } : qiBtn}
                              >
                                <MessageCircle size={11} />
                              </button>
                            </div>
                            {pain && !(cellEdit?.key === cellKey && cellEdit.type === 'pain') && (
                              <button onClick={() => setCellEdit({ key: cellKey, type: 'pain' })} style={{ display: 'block', marginTop: 3, border: 'none', background: 'none', padding: 0, fontFamily: INTER, fontSize: '0.66rem', fontWeight: 700, color: (pain.vas_score ?? 0) >= 5 ? '#c23b3b' : '#c07f1e', textAlign: 'left', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                ⚠ {pain.vas_score != null ? `${pain.vas_score}/10 ` : ''}{pain.pain_comment || ''}
                              </button>
                            )}
                            {note && !(cellEdit?.key === cellKey && cellEdit.type === 'note') && (
                              <button onClick={() => setCellEdit({ key: cellKey, type: 'note' })} style={{ display: 'block', marginTop: 3, border: 'none', background: 'none', padding: 0, fontFamily: INTER, fontSize: '0.66rem', fontWeight: 700, color: '#2c5aa3', textAlign: 'left', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                💬 {note}
                              </button>
                            )}
                            {cellEdit?.key === cellKey && (cellEdit.type === 'pain' ? (
                              <InlineEditor
                                initialValue={pain?.pain_comment || ''} initialScale={pain?.vas_score ?? null} showScale
                                placeholder="Opisz ból (puste = usuń)" color="#c23b3b" bg="#FEF2F2"
                                onSave={(val, scale) => { savePain(athlete.id, name, val, scale); setCellEdit(null) }}
                                onCancel={() => setCellEdit(null)}
                              />
                            ) : (
                              <InlineEditor
                                initialValue={note} placeholder="Notatka do ćwiczenia..." color="var(--gold)" bg="#FFFBEB"
                                onSave={val => { saveNote(athlete.id, ex, val); setCellEdit(null) }}
                                onCancel={() => setCellEdit(null)}
                              />
                            ))}
                          </td>
                        )
                      })}
                      <td style={{ border: 'none' }} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
