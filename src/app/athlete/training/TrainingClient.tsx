'use client'
// src/app/athlete/training/TrainingClient.tsx
// Nowy design — Sesja 7

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Athlete, TrainingView, SetLog, WorkoutBlockExercise } from '@/types/workout'

// ─── STAŁE ────────────────────────────────────────────────────────────────────

const C = {
  navy: '#0D1B2A',
  navyLight: '#1A2E45',
  navyBorder: '#243652',
  gold: '#F5C842',
  white: '#FFFFFF',
  offWhite: '#F4F6F9',
  gray: '#8A9BB0',
  grayLight: '#E8ECF2',
  green: '#22C55E',
  red: '#EF4444',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"
const trainerName = 'Urszula Papka'
const contentMaxWidth = 520

function formatExerciseName(name: string) {
  return name.replace(/-/g, ' ')
}

const FEELING_OPTIONS = [
  { value: 'swietnie', emoji: '🤩', label: 'Świetnie' },
  { value: 'dobrze', emoji: '😊', label: 'Dobrze' },
  { value: 'srednie', emoji: '😐', label: 'Średnio' },
  { value: 'zmeczona', emoji: '😓', label: 'Zmęczona' },
  { value: 'slabo', emoji: '😞', label: 'Słabo' },
]

interface Props {
  athlete: Athlete
  trainingView: TrainingView
  existingSetLogs: SetLog[]
  existingWellness: WellnessLog | null
  wellnessPreFields: string[] | null
}

interface WellnessLog {
  id: number
  sleep_hours?: number
  sleep_quality?: number
  energy?: number
  stress?: number
  mood?: number
  muscle_sorness?: number
  readiness?: number
  concerns?: string
}

type TrainingExercise = WorkoutBlockExercise & {
  warmup_reps?: string | number | null
  warmup_weight?: string | number | null
}

type TrainingWarmupSet = {
  reps?: string | number | null
  weight_kg?: string | number | null
  note?: string | null
}

// ─── TEMPO HELPERS ────────────────────────────────────────────────────────────

function setLogKey(log: Pick<SetLog, 'block_exercise_id' | 'set_number' | 'is_warmup'>) {
  return `${log.block_exercise_id || 0}:${log.set_number}:${log.is_warmup ? 'w' : 'm'}`
}

function dedupeSetLogs(logs: SetLog[]) {
  const byKey = new Map<string, SetLog>()
  for (const log of logs) {
    if (!log.block_exercise_id) continue
    const key = setLogKey(log)
    const existing = byKey.get(key)
    const logTime = new Date(log.created_at || 0).getTime()
    const existingTime = new Date(existing?.created_at || 0).getTime()
    if (!existing || logTime >= existingTime || log.id > existing.id) byKey.set(key, log)
  }
  return Array.from(byKey.values())
}

function normalizeTempo(tempo: string | undefined | null) {
  if (!tempo) return ''
  return tempo.toUpperCase().replace(/[^0-9X]/g, '')
}

function parseTempo(tempo: string | undefined | null) {
  const normalizedTempo = normalizeTempo(tempo)
  if (!normalizedTempo || normalizedTempo === 'X' || normalizedTempo.length < 4) return null
  const dirs = ['down', 'pause_bottom', 'up', 'pause_top']
  const labels = ['↓ opuszczanie', '⏸ pauza dół', '↑ unoszenie', '⏸ pauza góra']
  const colors = ['#60A5FA', C.gold, C.green, C.gold]
  return normalizedTempo.slice(0, 4).split('').map((d, i) => ({
    dir: dirs[i],
    label: labels[i],
    color: colors[i],
    seconds: d === 'X' ? 0.15 : parseInt(d) || 0.15,
    isX: d === 'X',
  }))
}

// ─── TEMPO VISUALIZER ─────────────────────────────────────────────────────────

function TempoVisualizer({ tempo }: { tempo: string }) {
  const phases = useMemo(() => parseTempo(tempo), [tempo])
  const [running, setRunning] = useState(false)
  const [barPosition, setBarPosition] = useState(1)
  const [activePhase, setActivePhase] = useState(0)
  const rafRef = useRef<number>(0)

  const TRACK_HEIGHT = 280
  const BAR_HEIGHT = 64

  const makeTickFn = useCallback((phaseIdx: number, phaseStartTime: number): FrameRequestCallback => {
    return function tick(now: number) {
      const phase = phases?.[phaseIdx]
      if (!phase || !phases) return
      const elapsed = (now - phaseStartTime) / 1000
      const progress = Math.min(elapsed / phase.seconds, 1)
      let pos = 1
      if (phaseIdx === 0) pos = 1 - progress
      else if (phaseIdx === 1) pos = 0
      else if (phaseIdx === 2) pos = progress
      else pos = 1
      setBarPosition(pos)
      setActivePhase(phaseIdx)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        const nextIdx = (phaseIdx + 1) % phases.length
        rafRef.current = requestAnimationFrame(makeTickFn(nextIdx, performance.now()))
      }
    }
  }, [phases])

  const start = () => { if (!phases) return; setRunning(true); setBarPosition(1); rafRef.current = requestAnimationFrame(makeTickFn(0, performance.now())) }
  const stop = () => { cancelAnimationFrame(rafRef.current); setRunning(false); setBarPosition(1); setActivePhase(0) }
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  if (!phases) return null

  const barTop = (1 - barPosition) * (TRACK_HEIGHT - BAR_HEIGHT)
  const activeColor = phases[activePhase]?.color || C.gold

  return (
    <div style={{ marginTop: '1rem', padding: '1.25rem', background: C.navyLight, borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: C.white, fontFamily: sans }}>Wizualizacja tempa</span>
        <button onClick={running ? stop : start}
          style={{ padding: '6px 18px', background: running ? C.gray : C.gold, color: C.navy, border: 'none', borderRadius: 20, fontFamily: sans, fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
          {running ? '■ Stop' : '▶ Start'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.7rem', color: C.gray, fontFamily: mono, letterSpacing: '0.06em' }}>GÓRA</span>
          <div style={{ position: 'relative', width: 56, height: TRACK_HEIGHT, background: C.navyBorder, borderRadius: 28, overflow: 'hidden' }}>
            {running && (
              <div style={{ position: 'absolute', left: 4, right: 4, height: BAR_HEIGHT, top: barTop, background: `radial-gradient(ellipse at center, ${activeColor}44 0%, transparent 70%)`, borderRadius: 22, filter: 'blur(8px)', transform: 'scale(1.5)' }} />
            )}
            <div style={{ position: 'absolute', left: 6, right: 6, height: BAR_HEIGHT, top: barTop, background: running ? activeColor : C.gold, borderRadius: 22, boxShadow: running ? `0 0 20px ${activeColor}99, 0 0 40px ${activeColor}44` : 'none', transition: 'background 0.3s' }} />
          </div>
          <span style={{ fontSize: '0.7rem', color: C.gray, fontFamily: mono, letterSpacing: '0.06em' }}>DÓŁ</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {phases.map((phase, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: running && activePhase === i ? 1 : 0.4, transition: 'opacity 0.2s' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: phase.color, flexShrink: 0, boxShadow: running && activePhase === i ? `0 0 10px ${phase.color}` : 'none' }} />
              <div style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: running && activePhase === i ? phase.color : C.gray, fontFamily: sans }}>{phase.label}</div>
              <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 700, color: running && activePhase === i ? C.gold : C.gray }}>{phase.isX ? 'X' : `${phase.seconds}s`}</span>
            </div>
          ))}
          {running && (
            <div style={{ marginTop: 4, padding: '6px 12px', background: C.navyBorder, borderRadius: 8, textAlign: 'center' }}>
              <span style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 700, color: activeColor, letterSpacing: '0.04em' }}>{phases[activePhase]?.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── RIR MODAL ────────────────────────────────────────────────────────────────

function RirModal({ rir, onClose }: { rir: number; onClose: () => void }) {
  const rows = [
    { rir: 0, reserve: '0 powtórzeń w zapasie', intensity: 'Maksymalny wysiłek' },
    { rir: 1, reserve: '1 powtórzenie w zapasie', intensity: 'Bardzo ciężki wysiłek' },
    { rir: 2, reserve: '2 powtórzenia w zapasie', intensity: 'Intensywny wysiłek' },
    { rir: 3, reserve: '3 powtórzenia w zapasie', intensity: 'Umiarkowany' },
    { rir: 4, reserve: '4 powtórzenia w zapasie', intensity: 'Lekki wysiłek' },
    { rir: 5, reserve: '5 powtórzeń w zapasie', intensity: 'Bardzo lekki wysiłek' },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '1.5rem', borderTop: `4px solid ${C.gold}`, fontFamily: sans }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 1.25rem' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: C.navy, marginBottom: 4 }}>Skala RIR</h3>
        <p style={{ fontSize: '0.82rem', color: C.gray, marginBottom: '1rem' }}>
          <strong>RIR</strong> = Reps In Reserve = powtórzenia w zapasie. Ile powtórzeń mógłabyś jeszcze zrobić, gdybyś chciała?
        </p>
        <p style={{ fontSize: '0.82rem', color: C.navy, fontWeight: 700, marginBottom: '0.875rem' }}>
          Twoje zadanie: <span style={{ color: C.gold }}>RIR {rir}</span> = zatrzymaj się gdy masz jeszcze {rir} powtórzenie{rir === 1 ? '' : rir < 5 ? 'a' : 'ń'} w zapasie.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: C.navy }}>
                <th style={{ padding: '0.5rem 0.75rem', color: C.gold, fontFamily: '"Space Mono",monospace', fontSize: '0.65rem', letterSpacing: '0.08em', textAlign: 'center' }}>SKALA RIR</th>
                <th style={{ padding: '0.5rem 0.75rem', color: C.gold, fontFamily: '"Space Mono",monospace', fontSize: '0.65rem', letterSpacing: '0.08em', textAlign: 'left' }}>ZAPAS</th>
                <th style={{ padding: '0.5rem 0.75rem', color: C.gold, fontFamily: '"Space Mono",monospace', fontSize: '0.65rem', letterSpacing: '0.08em', textAlign: 'left' }}>INTENSYWNOŚĆ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.rir} style={{ background: r.rir === rir ? C.navy + '18' : r.rir % 2 === 0 ? '#F4F6F9' : '#fff', fontWeight: r.rir === rir ? 800 : 400 }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontFamily: '"Space Mono",monospace', fontWeight: 900, color: r.rir === rir ? C.gold : C.navy, textAlign: 'center', borderBottom: '1px solid #E8ECF2', fontSize: '1rem' }}>{r.rir}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.navy, borderBottom: '1px solid #E8ECF2' }}>{r.reserve}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.gray, borderBottom: '1px solid #E8ECF2' }}>{r.intensity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: '1.25rem', padding: '0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontFamily: sans, fontSize: '0.95rem' }}>
          Rozumiem ✓
        </button>
      </div>
    </div>
  )
}

// ─── LEGEND MODAL ─────────────────────────────────────────────────────────────

const ABBREV = [
  { short: 'iso', full: 'izometria — zatrzymanie bez ruchu' },
  { short: 'bb', full: 'barbell — sztanga' },
  { short: 'ssb', full: 'safety squat bar — sztanga bezpieczna' },
  { short: 'kb', full: 'kettlebell' },
  { short: 'db', full: 'dumbbell — hantle' },
  { short: 'sl', full: 'single leg — jednonóż' },
  { short: 'BW', full: 'body weight — ciężar ciała (bez dodatkowego obciążenia)' },
  { short: '1RM', full: 'one repetition maximum — maksymalny ciężar na 1 powtórzenie' },
  { short: '50% 1RM', full: 'obciążenie 50% Twojego maksimum' },
  { short: 'rampa', full: 'stopniowe zwiększanie ciężaru w kolejnych seriach (np. 35 / 37,5 / 40 kg)' },
  { short: '30"', full: '30 sekund' },
  { short: '5" ecc', full: 'faza ekscentryczna (opuszczanie) trwa 5 sekund — np. w przysiadzie to faza schodzenia w dół' },
]

function LegendModal({ planNotes, onClose }: { planNotes?: string | null; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', borderTop: `4px solid ${C.gold}`, maxHeight: '85vh', overflowY: 'auto', fontFamily: sans }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <div style={{ width: 40, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 1.25rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: C.navy, marginBottom: '1rem' }}>ℹ️ Skróty i legenda</h3>
        </div>
        {planNotes && (
          <div style={{ margin: '0 1.5rem 1rem', padding: '0.875rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 12 }}>
            <div style={{ fontFamily: '"Space Mono",monospace', fontSize: '0.6rem', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Notatki od trenera</div>
            <div style={{ fontSize: '0.84rem', color: C.navy, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{planNotes}</div>
          </div>
        )}
        <div style={{ padding: '0 1.5rem' }}>
          <div style={{ fontFamily: '"Space Mono",monospace', fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 700 }}>Skróty</div>
          {ABBREV.map(a => (
            <div key={a.short} style={{ display: 'flex', gap: 12, padding: '0.5rem 0', borderBottom: '1px solid #F0F4F8', alignItems: 'flex-start' }}>
              <span style={{ fontFamily: '"Space Mono",monospace', fontWeight: 800, fontSize: '0.82rem', color: C.gold, minWidth: 70, flexShrink: 0 }}>{a.short}</span>
              <span style={{ fontSize: '0.82rem', color: C.navy, lineHeight: 1.45 }}>{a.full}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <button onClick={onClose} style={{ width: '100%', padding: '0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontFamily: sans, fontSize: '0.95rem' }}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TEMPO MODAL ──────────────────────────────────────────────────────────────

function TempoModal({ tempo, note, onClose }: { tempo: string; note?: string; onClose: () => void }) {
  const normalizedTempo = normalizeTempo(tempo)
  const isX = normalizedTempo === 'X'
  const digits = normalizedTempo && !isX ? normalizedTempo.slice(0, 4).split('') : []
  const phaseDesc = [
    { name: 'Faza 1 – ekscentryczna (w dół)', desc: 'Liczba sekund opuszczania. X = jak najszybciej.' },
    { name: 'Faza 2 – pauza na dole', desc: 'Czas zatrzymania w najniższym punkcie.' },
    { name: 'Faza 3 – koncentryczna (w górę)', desc: 'Liczba sekund unoszenia. X = jak najszybciej.' },
    { name: 'Faza 4 – pauza na górze', desc: 'Czas zatrzymania w górnym punkcie.' },
  ]
  const canVisualize = !!parseTempo(tempo)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '1.5rem', borderTop: `4px solid ${C.gold}`, maxHeight: '90vh', overflowY: 'auto', fontFamily: sans }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 1.25rem' }} />
        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.navy, marginBottom: 4 }}>Tempo: <span style={{ color: C.gold }}>{tempo}</span></h3>
        {isX
          ? <p style={{ color: C.gray, fontSize: '0.9rem', marginBottom: '1rem' }}>X = wykonaj ruch <strong>jak najszybciej</strong>.</p>
          : note
          ? <p style={{ color: C.gray, fontSize: '0.9rem', marginBottom: '1rem' }}>{note}</p>
          : <>
            <p style={{ color: C.gray, fontSize: '0.82rem', marginBottom: '0.875rem' }}>4 cyfry = 4 fazy ruchu</p>
            {digits.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '0.625rem 0', borderBottom: i < 3 ? '1px solid #F0F0F0' : 'none' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: C.gold, minWidth: 28, fontFamily: mono }}>{d}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: C.navy }}>{phaseDesc[i].name}</div>
                  <div style={{ fontSize: '0.75rem', color: C.gray, marginTop: 2 }}>{phaseDesc[i].desc}</div>
                </div>
              </div>
            ))}
          </>}
        {canVisualize && <TempoVisualizer tempo={normalizedTempo} />}
        <button onClick={onClose} style={{ width: '100%', marginTop: '1.25rem', padding: '0.875rem', border: '1.5px solid #E0E0E0', borderRadius: 12, background: 'none', fontSize: '0.9rem', color: C.gray, cursor: 'pointer', fontWeight: 600, fontFamily: sans }}>Zamknij</button>
      </div>
    </div>
  )
}

// ─── VIDEO MODAL ──────────────────────────────────────────────────────────────

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    // youtu.be/ID lub youtube.com/watch?v=ID lub youtube.com/shorts/ID
    let videoId: string | null = null
    if (u.hostname === 'youtu.be') videoId = u.pathname.slice(1)
    else if (u.hostname.includes('youtube.com')) {
      videoId = u.searchParams.get('v') || u.pathname.split('/shorts/')[1] || null
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
  } catch {}
  return null
}

function VideoModal({ exerciseName, exerciseUrl, onClose }: { exerciseName: string; exerciseUrl?: string | null; onClose: () => void }) {
  const embedUrl = exerciseUrl ? getYouTubeEmbedUrl(exerciseUrl) : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '1.5rem', borderTop: `4px solid ${C.gold}`, fontFamily: sans }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 1.25rem' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.navy, marginBottom: '1rem' }}>📹 {exerciseName}</h3>

        {embedUrl ? (
          <div style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9', marginBottom: '1rem' }}>
            <iframe
              src={embedUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : exerciseUrl ? (
          <div style={{ marginBottom: '1rem' }}>
            <a href={exerciseUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', background: C.navy, borderRadius: 14, padding: '1.25rem', textAlign: 'center', textDecoration: 'none' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔗</div>
              <div style={{ color: C.gold, fontWeight: 700, fontSize: '0.9rem' }}>Otwórz film / instrukcję</div>
              <div style={{ color: C.gray, fontSize: '0.72rem', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exerciseUrl}</div>
            </a>
          </div>
        ) : (
          <div style={{ background: C.navy, borderRadius: 14, aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', gap: 10 }}>
            <span style={{ fontSize: '0.82rem', color: C.gray, textAlign: 'center', maxWidth: 200 }}>Brak filmiku. Szukaj: <span style={{ color: C.gold, fontWeight: 600 }}>&quot;{exerciseName} tutorial&quot;</span></span>
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', padding: '0.875rem', border: '1.5px solid #E0E0E0', borderRadius: 12, background: 'none', fontSize: '0.9rem', color: C.gray, cursor: 'pointer', fontWeight: 600, fontFamily: sans }}>Zamknij</button>
      </div>
    </div>
  )
}

// ─── FLOATING TIMER ───────────────────────────────────────────────────────────

function FloatingTimer() {
  const [open, setOpen] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [preset, setPreset] = useState(90)
  const [countdown, setCountdown] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) { intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000) }
    else { if (intervalRef.current) clearInterval(intervalRef.current) }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const reset = () => { setSeconds(0); setRunning(false) }
  const startPreset = (p: number) => { setPreset(p); setSeconds(0); setRunning(true) }
  const displayed = countdown ? Math.max(0, preset - seconds) : seconds
  const isFinished = countdown && displayed === 0

  return (
    <div onClick={() => setOpen(!open)}
      style={{ position: 'fixed', bottom: open ? 'auto' : 96, top: open ? 0 : 'auto', right: open ? 0 : 16, width: open ? '100%' : 52, height: open ? 'auto' : 52, maxWidth: open ? 480 : 'none', background: isFinished ? C.green : C.navy, borderRadius: open ? 0 : '50%', border: open ? 'none' : `2px solid ${isFinished ? C.green : C.gold}`, cursor: 'pointer', zIndex: 50, display: 'flex', flexDirection: open ? 'column' : 'row', alignItems: 'center', justifyContent: open ? 'stretch' : 'center', boxShadow: open ? 'none' : '0 4px 20px rgba(13,27,42,0.25)', fontFamily: sans }}>
      {!open ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <span style={{ fontSize: '1.1rem' }}>{isFinished ? '✅' : '⏱️'}</span>
          {running && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: isFinished ? '#fff' : C.gold, fontWeight: 700 }}>{fmt(displayed)}</span>}
        </div>
      ) : (
        <div style={{ background: C.navy, width: '100%', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: C.white }}>⏱️ Timer</span>
            <button onClick={e => { e.stopPropagation(); setOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: '1.2rem', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '3.5rem', fontWeight: 700, color: isFinished ? C.green : running ? C.gold : C.white, lineHeight: 1 }}>{fmt(displayed)}</div>
            {isFinished && <div style={{ color: C.green, fontWeight: 700, fontSize: '0.9rem', marginTop: 4 }}>Czas minął! 🎉</div>}
            {!isFinished && countdown && running && (
              <div style={{ marginTop: 8, height: 4, background: C.navyBorder, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((preset - seconds) / preset) * 100}%`, background: C.gold, borderRadius: 2, transition: 'width 1s linear' }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            <button onClick={e => { e.stopPropagation(); setRunning(!running) }} style={{ flex: 1, padding: '0.75rem', background: running ? C.gold : C.green, color: C.navy, border: 'none', borderRadius: 10, fontFamily: sans, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>{running ? '⏸ Pauza' : '▶ Start'}</button>
            <button onClick={e => { e.stopPropagation(); reset() }} style={{ padding: '0.75rem 1rem', background: C.navyLight, color: C.gray, border: 'none', borderRadius: 10, fontFamily: sans, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>Reset</button>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontFamily: mono }}>Szybki start</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[30, 60, 90, 120, 180].map(p => (
                <button key={p} onClick={e => { e.stopPropagation(); setCountdown(true); startPreset(p) }} style={{ padding: '6px 12px', background: C.navyLight, border: `1.5px solid ${C.navyBorder}`, borderRadius: 8, fontFamily: mono, fontSize: '0.75rem', color: C.gold, cursor: 'pointer', fontWeight: 700 }}>
                  {p < 60 ? `${p}s` : `${p / 60}min`}
                </button>
              ))}
              <button onClick={e => { e.stopPropagation(); setCountdown(false); setSeconds(0); setRunning(true) }} style={{ padding: '6px 12px', background: C.navyLight, border: `1.5px solid ${C.navyBorder}`, borderRadius: 8, fontFamily: mono, fontSize: '0.75rem', color: C.gray, cursor: 'pointer' }}>stoper</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── WARMUP SET ROW ───────────────────────────────────────────────────────────

function WarmupSetRow({ warmup, setNum, existingLog, sessionId, athleteId, blockExerciseId, onLogSaved }: {
  warmup: TrainingWarmupSet; setNum: number
  existingLog?: SetLog; sessionId: number; athleteId: number; blockExerciseId: number
  onLogSaved?: (log: SetLog) => void
}) {
  const supabase = createClient()
  const [weight, setWeight] = useState(existingLog?.weight?.toString() || '')
  const [done, setDone] = useState(!!existingLog?.completed)
  const savedIdRef = React.useRef<number | null>(existingLog?.id ?? null)

  async function toggle() {
    const newDone = !done
    setDone(newDone)
    const payload = {
      workout_session_id: sessionId, block_exercise_id: blockExerciseId,
      athlete_id: athleteId, set_number: setNum,
      weight: weight ? parseFloat(weight.replace(',', '.')) : null,
      reps_completed: null, is_warmup: true, completed: newDone,
    }
    if (savedIdRef.current) {
      await supabase.from('set_logs').update(payload).eq('id', savedIdRef.current)
      onLogSaved?.({ ...payload, reps_completed: undefined, id: savedIdRef.current, created_at: new Date().toISOString() } as SetLog)
    } else {
      const { data } = await supabase.from('set_logs').insert(payload).select('id').single()
      if (data?.id) {
        savedIdRef.current = data.id
        onLogSaved?.({ ...payload, reps_completed: undefined, id: data.id, created_at: new Date().toISOString() } as SetLog)
      }
    }
  }

  // Notatka dla zawodniczki: powtórzenia, ciężar (bez słowa "ref" i zduplikowanego "kg"), treść notatki
  const noteText = [
    warmup.reps ? `${warmup.reps} powt.` : null,
    warmup.weight_kg ? String(warmup.weight_kg).replace(/\s*kg\s*$/i, '') + ' kg' : null,
    warmup.note || null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ padding: '0.6rem 0.875rem', background: done ? '#F0FDF4' : '#FAFBFC', borderRadius: 10, marginBottom: 6, border: `1.5px solid ${done ? '#86EFAC' : C.grayLight}`, fontFamily: sans }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: mono, fontSize: '0.7rem', fontWeight: 800, color: C.gray, minWidth: 40 }}>
          Rozg{setNum > 1 ? ` ${setNum}` : ''}
        </span>
        <div style={{ flex: 1 }}>
          <input
            inputMode="decimal" placeholder=""
            value={weight} onChange={e => setWeight(e.target.value.replace(',', '.'))}
            style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.9rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center' }}
          />
        </div>
        <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: 8, background: done ? C.green : C.grayLight, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {done && <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 800 }}>✓</span>}
        </button>
      </div>
      {noteText && (
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 4, paddingLeft: 48 }}>
          {noteText}
        </div>
      )}
    </div>
  )
}

// ─── SET ROW ──────────────────────────────────────────────────────────────────

function SetRow({ setNum, reps, isAmrap, prevWeight, existingLog, sessionId, athleteId, blockExerciseId, onComplete, onLogSaved }: {
  setNum: number; reps: string | number; isAmrap: boolean; prevWeight?: number | null
  existingLog?: SetLog; sessionId: number; athleteId: number; blockExerciseId: number
  onComplete: (done: boolean) => void; onLogSaved?: (log: SetLog) => void
}) {
  const supabase = createClient()
  const [weight, setWeight] = useState(existingLog?.weight?.toString() || '')
  const [actualReps, setActualReps] = useState(existingLog?.reps_completed?.toString() || '')
  const [done, setDone] = useState(!!existingLog?.completed)
  const [saveError, setSaveError] = useState('')
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cache ID po pierwszym zapisie, żeby uniknąć wyścigu INSERT vs INSERT
  const savedLogIdRef = React.useRef<number | null>(existingLog?.id ?? null)

  async function saveSet(nextDone: boolean, currentWeight: string) {
    setSaveError('')
    const payload = {
      workout_session_id: sessionId, block_exercise_id: blockExerciseId,
      athlete_id: athleteId, set_number: setNum,
      weight: currentWeight ? parseFloat(currentWeight.replace(',', '.')) : null,
      reps_completed: actualReps ? parseInt(actualReps) : null,
      is_warmup: false, completed: nextDone,
    }

    // Jeśli mamy już ID z cache — update; w przeciwnym razie szukaj lub twórz nowy
    if (savedLogIdRef.current) {
      const { error } = await supabase.from('set_logs').update(payload).eq('id', savedLogIdRef.current)
      if (!error) onLogSaved?.({ ...payload, id: savedLogIdRef.current, created_at: new Date().toISOString() } as SetLog)
      else setSaveError(error.message)
      return
    }

    const { data: currentLog } = await supabase
      .from('set_logs').select('id')
      .eq('workout_session_id', sessionId).eq('block_exercise_id', blockExerciseId)
      .eq('set_number', setNum).eq('is_warmup', false)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    const logId = currentLog?.id
    if (logId) {
      savedLogIdRef.current = logId
      const { error } = await supabase.from('set_logs').update(payload).eq('id', logId)
      if (!error) onLogSaved?.({ ...payload, id: logId, created_at: new Date().toISOString() } as SetLog)
      else setSaveError(error.message)
    } else {
      const { data, error } = await supabase.from('set_logs').insert(payload).select('id').single()
      if (error) setSaveError(error.message)
      else if (data?.id) {
        savedLogIdRef.current = data.id
        onLogSaved?.({ ...payload, id: data.id, created_at: new Date().toISOString() } as SetLog)
      }
    }
  }

  async function toggle() {
    const newDone = !done
    setDone(newDone)
    onComplete(newDone)
    await saveSet(newDone, weight)
  }

  function handleWeightChange(val: string) {
    const cleaned = val.replace(',', '.')
    setWeight(cleaned)
    const hasWeight = cleaned.trim() !== ''

    // Natychmiastowa zmiana stanu UI
    if (hasWeight && !done) {
      setDone(true)
      onComplete(true)
    } else if (!hasWeight && done) {
      setDone(false)
      onComplete(false)
    }

    // Debounce 350ms — zapis do DB dopiero po zakończeniu wpisywania
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const nextDone = hasWeight ? true : (!hasWeight && done ? false : done)
      saveSet(nextDone, cleaned)
    }, 350)
  }

  // Sprawdź czy reps to długi opis (>12 znaków) — wtedy układ 2-rzędowy
  const repsStr = String(reps || '—')
  const isLongReps = repsStr.length > 12

  return (
    <div style={{
      padding: '0.625rem 0.875rem',
      background: done ? '#F0FDF4' : '#FAFBFC',
      borderRadius: 10, marginBottom: 6,
      border: `1.5px solid ${done ? '#86EFAC' : C.grayLight}`,
      transition: 'all 0.2s', fontFamily: sans,
    }}>
      {/* Górny rząd: numer serii + opis powtórzeń */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: isLongReps ? 8 : 0 }}>
        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: done ? C.green : C.gold, minWidth: 24, fontFamily: mono, paddingTop: 1 }}>
          S{setNum}
        </span>
        <span style={{
          fontWeight: isLongReps ? 600 : 700,
          fontSize: isLongReps ? '0.82rem' : '0.95rem',
          color: C.navy,
          flex: 1,
          lineHeight: 1.4,
        }}>
          {repsStr}
        </span>
        {/* Na krótkich repsach — inputy i przycisk w tym samym rzędzie */}
        {!isLongReps && (
          <>
            <div style={{ width: 72 }}>
              <input inputMode="decimal" placeholder="kg" value={weight}
                onChange={e => handleWeightChange(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.9rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center' }} />
            </div>
            {isAmrap && (
              <input type="number" inputMode="numeric" placeholder="powt." value={actualReps}
                onChange={e => setActualReps(e.target.value)} onBlur={() => saveSet(done, weight)}
                style={{ width: 60, padding: '0.4rem 0.5rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.9rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center' }} />
            )}
            <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: 8, background: done ? C.green : C.grayLight, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0 }}>
              {done && <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 800 }}>✓</span>}
            </button>
          </>
        )}
      </div>

      {/* Dolny rząd: inputy na pełną szerokość (tylko przy długim opisie) */}
      {isLongReps && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input inputMode="decimal" placeholder="wpisz ciężar (kg)" value={weight}
              onChange={e => handleWeightChange(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem', border: `1.5px solid ${done ? '#86EFAC' : '#E0E8F0'}`, borderRadius: 8, fontFamily: sans, fontSize: '1rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center', fontWeight: 700 }} />
            {prevWeight && !weight && (
              <div style={{ fontSize: '0.6rem', color: C.gray, textAlign: 'center', marginTop: 2 }}>poprzednio: {prevWeight} kg</div>
            )}
          </div>
          {isAmrap && (
            <input type="number" inputMode="numeric" placeholder="powt." value={actualReps}
              onChange={e => setActualReps(e.target.value)} onBlur={() => saveSet(done, weight)}
              style={{ width: 70, padding: '0.55rem 0.5rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '1rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center', fontWeight: 700 }} />
          )}
          <button onClick={toggle} style={{
            width: 48, height: 44, borderRadius: 10,
            background: done ? C.green : C.navy,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s', flexShrink: 0,
          }}>
            <span style={{ color: done ? '#fff' : C.gold, fontSize: '1.1rem', fontWeight: 800 }}>
              {done ? '✓' : '○'}
            </span>
          </button>
        </div>
      )}
      {saveError && (
        <div style={{ marginTop: 4, fontSize: '0.65rem', color: C.red, background: '#FEF2F2', borderRadius: 6, padding: '2px 8px' }}>
          ❌ {saveError}
        </div>
      )}
    </div>
  )
}

// ─── WELLNESS EXPANDED ────────────────────────────────────────────────────────

// Mapa wszystkich możliwych pól wellness — ID z plan_wellness_config → konfiguracja slidera
const WELLNESS_FIELD_MAP: Record<string, { key: string; label: string; hint: string; min: number; max: number; step: number; unit: string; defaultVal: number }> = {
  sleep_hours:    { key: 'sleep_hours',      label: 'Godziny snu',         hint: 'Ile godzin spałaś tej nocy?',                    min: 3,  max: 12,  step: 0.5, unit: 'h',    defaultVal: 7 },
  sleep_quality:  { key: 'sleep_quality',    label: 'Jakość snu',          hint: 'Jak dobrze spałaś? 1 = bardzo źle, 10 = rewelacja', min: 1,  max: 10,  step: 1,   unit: '/10',  defaultVal: 7 },
  energy:         { key: 'energy',           label: 'Energia',             hint: 'Poziom energii przed treningiem (1 = brak, 10 = pełna moc)', min: 1, max: 10, step: 1, unit: '/10', defaultVal: 7 },
  stress:         { key: 'stress',           label: 'Stres',               hint: 'Poziom stresu/napięcia (1 = spokój, 10 = duży stres)',        min: 1, max: 10, step: 1, unit: '/10', defaultVal: 3 },
  mood:           { key: 'mood',             label: 'Nastrój',             hint: 'Jak się czujesz psychicznie? (1 = źle, 10 = super)',          min: 1, max: 10, step: 1, unit: '/10', defaultVal: 7 },
  readiness:      { key: 'readiness',        label: 'Gotowość',            hint: 'Gotowość do treningu — jak bardzo chcesz ćwiczyć?',           min: 1, max: 10, step: 1, unit: '/10', defaultVal: 7 },
  muscle_soreness:{ key: 'muscle_sorness',   label: 'Zakwasy',             hint: 'Ból mięśni po poprzednim treningu (1 = brak, 10 = silny ból)',min: 0, max: 10, step: 1, unit: '/10', defaultVal: 0 },
  body_weight:    { key: 'body_weight_kg',   label: 'Masa ciała',          hint: 'Waga poranna na czczo (kg)',                                  min: 30, max: 150, step: 0.1, unit: 'kg', defaultVal: 60 },
  hydration:      { key: 'hydration_glasses',label: 'Nawodnienie',         hint: 'Ile szklanek wody wypiłaś od rana?',                         min: 0, max: 20, step: 1, unit: 'szkl.', defaultVal: 8 },
  resting_hr:     { key: 'resting_hr',       label: 'Tętno spoczynkowe',   hint: 'Tętno mierzone rano przed wstaniem z łóżka (bpm)',            min: 40, max: 120, step: 1, unit: 'bpm', defaultVal: 60 },
  motivation_pre: { key: 'motivation_pre',   label: 'Motywacja przed',     hint: 'Chęć do treningu zanim weszłaś — 1 = zerowa, 10 = ogień',    min: 1, max: 10, step: 1, unit: '/10', defaultVal: 7 },
  sitting_hours:  { key: 'sitting_hours',    label: 'Godziny siedzenia',   hint: 'Ile godzin spędziłaś dziś w pozycji siedzącej?',             min: 0, max: 16, step: 0.5, unit: 'h', defaultVal: 4 },
  recovery_score: { key: 'recovery_score',   label: 'Regeneracja',         hint: 'Jak dobrze czujesz się po poprzednim treningu?',             min: 1, max: 10, step: 1, unit: '/10', defaultVal: 7 },
}

// Opisy wartości dla suwaków
function getWellnessDesc(key: string, val: number, max: number): string {
  const pct = val / max
  if (key === 'sleep_hours') {
    if (val < 5) return 'Bardzo mało — niedobór snu'
    if (val < 6.5) return 'Poniżej normy'
    if (val < 8) return 'OK'
    if (val < 9.5) return 'Dobrze'
    return 'Bardzo dużo snu'
  }
  const isInverse = ['stress', 'muscle_sorness', 'muscle_soreness'].includes(key)
  if (isInverse) {
    if (pct <= 0.2) return 'Brak / minimalne'
    if (pct <= 0.4) return 'Niskie'
    if (pct <= 0.6) return 'Umiarkowane'
    if (pct <= 0.8) return 'Wysokie'
    return 'Bardzo wysokie'
  }
  if (pct <= 0.2) return 'Bardzo nisko'
  if (pct <= 0.4) return 'Nisko'
  if (pct <= 0.6) return 'Średnio'
  if (pct <= 0.8) return 'Dobrze'
  return 'Znakomicie'
}

// Domyślna lista pól gdy brak konfiguracji planu
const DEFAULT_PRE_FIELDS = ['sleep_hours', 'sleep_quality', 'energy', 'stress', 'mood', 'muscle_soreness', 'readiness']

function WellnessExpanded({ sessionId, athleteId, existingWellness, preFields, onSaved }: {
  sessionId: number; athleteId: number; existingWellness: WellnessLog | null
  preFields?: string[] | null; onSaved: (saved: any) => void
}) {
  const supabase = createClient()

  // Użyj skonfigurowanych pól lub domyślnych
  const activeFieldIds = (preFields && preFields.length > 0) ? preFields : DEFAULT_PRE_FIELDS
  const fields = activeFieldIds
    .map(id => WELLNESS_FIELD_MAP[id])
    .filter(Boolean)

  const [vals, setVals] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const f of fields) {
      init[f.key] = (existingWellness as any)?.[f.key] ?? f.defaultVal
    }
    return init
  })
  const [concerns, setConcerns] = useState(existingWellness?.concerns || '')
  const [saved, setSaved] = useState(!!existingWellness)

  const [saveError, setSaveError] = useState('')

  async function save() {
    setSaveError('')
    const payload = {
      athlete_id: athleteId,
      workout_session_id: sessionId,
      ...vals,
      concerns,
    }
    const { data: savedData, error } = existingWellness
      ? await supabase.from('wellness_logs').update(payload).eq('id', existingWellness.id).select().single()
      : await supabase.from('wellness_logs').insert(payload).select().single()

    if (error) {
      setSaveError(`Błąd zapisu: ${error.message}`)
      return
    }
    setSaved(true)
    onSaved(savedData || { ...payload, id: existingWellness?.id })
  }

  return (
    <div style={{ padding: '0 1rem 1rem', fontFamily: sans }}>
      {fields.map(f => {
        const val = vals[f.key] ?? f.defaultVal
        const pct = (val - f.min) / (f.max - f.min)
        // Kolory: stres/zakwasy odwrócone (wysoka wartość = zła), reszta normalna
        const isInverse = ['stress', 'muscle_sorness', 'muscle_soreness'].includes(f.key)
        const risk = isInverse ? pct : 1 - pct
        const sliderColor = risk < 0.35 ? C.green : risk < 0.65 ? C.gold : C.red
        // Krótki opis wg wartości
        const desc = getWellnessDesc(f.key, val, f.max)
        return (
          <div key={f.key} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
              <div>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: C.navy }}>{f.label}</span>
                {f.hint && <div style={{ fontSize: '0.68rem', color: C.gray, marginTop: 1, lineHeight: 1.3 }}>{f.hint}</div>}
              </div>
              <span style={{ fontFamily: mono, fontSize: '0.9rem', fontWeight: 800, color: sliderColor, flexShrink: 0, marginLeft: 8 }}>{val}{f.unit}</span>
            </div>
            <input type="range" min={f.min} max={f.max} step={f.step} value={val}
              onChange={e => setVals(v => ({ ...v, [f.key]: parseFloat(e.target.value) }))}
              style={{ width: '100%', accentColor: sliderColor, height: 6 }} />
            {desc && (
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: sliderColor, marginTop: 2, textAlign: 'center' }}>
                {desc}
              </div>
            )}
          </div>
        )
      })}
      <textarea placeholder="Uwagi dla trenera..." value={concerns} onChange={e => setConcerns(e.target.value)} rows={2}
        style={{ width: '100%', padding: '0.625rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
      {saveError && (
        <div style={{ color: C.red, fontSize: '0.78rem', fontWeight: 600, marginBottom: 6, padding: '0.5rem', background: '#FEF2F2', borderRadius: 8 }}>
          ❌ {saveError}
        </div>
      )}
      <button onClick={save} style={{ width: '100%', padding: '0.75rem', background: saved ? C.green : C.navy, color: saved ? '#fff' : C.gold, border: 'none', borderRadius: 10, fontFamily: sans, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
        {saved ? '✓ Zapisano' : 'Zapisz wellness'}
      </button>
    </div>
  )
}

// ─── EXERCISE CARD ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, sessionId, athleteId, setLogs, onSetsChange, prevWeight, blockLetter }: {
  exercise: TrainingExercise; sessionId: number; athleteId: number
  setLogs: SetLog[]; onSetsChange: (delta: number) => void; prevWeight?: number | null
  blockLetter?: string
}) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  // Lokalny stan logów — aktualizuje się po każdym zapisie, żeby przy zwijaniu/rozwijaniu karty dane nie znikały
  const [localLogs, setLocalLogs] = useState<SetLog[]>(() => setLogs.filter(l => l.block_exercise_id === exercise.id))
  // Synchronizuj gdy rodzic dostanie nowe logi (np. initial load)
  const prevLogsRef = React.useRef(setLogs)
  if (prevLogsRef.current !== setLogs) {
    prevLogsRef.current = setLogs
    setLocalLogs(setLogs.filter(l => l.block_exercise_id === exercise.id))
  }
  function handleLogSaved(log: SetLog) {
    setLocalLogs(prev => {
      const key = setLogKey(log)
      const without = prev.filter(l => setLogKey(l) !== key)
      return [...without, log]
    })
  }
  const [tempoOpen, setTempoOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [feelingOpen, setFeelingOpen] = useState(false)
  const [rirOpen, setRirOpen] = useState(false)
  const [vas, setVas] = useState(0)
  const [painNote, setPainNote] = useState('')
  const [painSaved, setPainSaved] = useState(false)
  const [existingPainId, setExistingPainId] = useState<number | null>(null)

  useEffect(() => {
    if (!sessionId || !exercise.id) return
    supabase.from('pain_logs').select('id,vas_score,pain_comment')
      .eq('workout_session_id', sessionId)
      .ilike('pain_location', `%${formatExerciseName(exercise.exercise?.name || exercise.exercise_code || '')}%`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingPainId(data.id)
          setVas(data.vas_score ?? 0)
          setPainNote(data.pain_comment ?? '')
          setPainSaved(true)
        }
      })
  }, [sessionId, exercise.id])
  const [exerciseNote, setExerciseNote] = useState(() => {
    // Wczytaj notatkę z pierwszej serii (zapisanej wcześniej)
    const firstLog = setLogs.filter(l => l.block_exercise_id === exercise.id && !l.is_warmup)
      .sort((a, b) => a.set_number - b.set_number)[0]
    return (firstLog as any)?.athlete_note || ''
  })

  const effectiveSets = exercise.override?.sets_override || exercise.sets
  const effectiveReps = exercise.override?.reps_override || exercise.reps || '—'
  const effectiveTempo = exercise.override?.tempo_override || exercise.tempo
  const effectiveTempoNote = exercise.override?.coach_note_override || exercise.coach_comment
  const effectiveRir = exercise.override?.rir ?? exercise.rir ?? null

  // Nazwa ćwiczenia — uwzględnia zamiennik trenera
  function getEffectiveName(): string {
    if (exercise.override?.exercise_code_override) return exercise.override.exercise_code_override
    // exercise_id_override — nazwa pobrana przez serwer w override lub z exercise
    if (exercise.override?.is_substitution && exercise.override.exercise_id_override) {
      return `Zamiennik #${exercise.override.exercise_id_override}` // fallback jeśli brak join
    }
    return formatExerciseName(exercise.exercise?.name || exercise.exercise_code || 'Ćwiczenie')
  }
  const isSubstituted = !!exercise.override?.is_substitution && !exercise.override.skip
  const isExtra = !!(exercise as any).is_extra

  const warmupSets: TrainingWarmupSet[] = Array.isArray(exercise.warmup_sets) ? exercise.warmup_sets : []
  const legacyWarmupSets: TrainingWarmupSet[] = !warmupSets.length && exercise.warmup_reps
    ? [{ reps: exercise.warmup_reps, weight_kg: exercise.warmup_weight }]
    : []
  const visibleWarmupSets = warmupSets.length ? warmupSets : legacyWarmupSets

  const exSetLogs = localLogs
  // Lokalny licznik — aktualizuje się od razu po kliknięciu
  const [localCompleted, setLocalCompleted] = useState(() =>
    exSetLogs.filter(l => l.completed && !l.is_warmup).length
  )
  const completedSets = localCompleted
  const allDone = completedSets >= effectiveSets
  const isAmrap = typeof effectiveReps === 'string' && effectiveReps.toUpperCase() === 'AMRAP'
  const exerciseName = getEffectiveName()

  const [painError, setPainError] = useState('')

  async function savePain() {
    setPainError('')
    const payload = {
      workout_session_id: sessionId,
      vas_score: vas,
      pain_comment: painNote || null,
      pain_location: exerciseName,
      pain_reported: true,
    }
    let painId = existingPainId
    if (!painId) {
      const { data: existing } = await supabase.from('pain_logs')
        .select('id')
        .eq('workout_session_id', sessionId)
        .eq('pain_location', exerciseName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      painId = existing?.id ?? null
    }
    const { data, error } = painId
      ? await supabase.from('pain_logs').update(payload).eq('id', painId).select('id').single()
      : await supabase.from('pain_logs').insert(payload).select('id').single()
    if (error) { setPainError(error.message); return }
    if (data?.id) setExistingPainId(data.id)
    setPainSaved(true)
  }

  return (
    <>
      {tempoOpen && effectiveTempo && <TempoModal tempo={effectiveTempo} note={effectiveTempoNote || undefined} onClose={() => setTempoOpen(false)} />}
      {videoOpen && <VideoModal exerciseName={exerciseName} exerciseUrl={exercise.exercise_url} onClose={() => setVideoOpen(false)} />}
      {rirOpen && effectiveRir != null && <RirModal rir={effectiveRir} onClose={() => setRirOpen(false)} />}

      <div style={{ background: '#fff', borderRadius: 14, border: allDone ? '1.5px solid #86EFAC' : `1.5px solid ${C.grayLight}`, marginBottom: 10, overflow: 'hidden', boxShadow: expanded ? '0 4px 20px rgba(13,27,42,0.08)' : 'none', transition: 'all 0.2s', fontFamily: sans }}>

        {/* Nagłówek */}
        <div onClick={() => setExpanded(!expanded)} style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: C.navyLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: '0.7rem', color: C.gold, fontFamily: mono }}>{blockLetter && exercise.exercise_order ? `${blockLetter}${exercise.exercise_order}` : exercise.exercise_order || '—'}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {isExtra && <span style={{ fontFamily: mono, fontSize: '0.55rem', background: C.green, color: C.white, borderRadius: 4, padding: '1px 5px', fontWeight: 800 }}>+DODANE</span>}
              {isSubstituted && <span style={{ fontFamily: mono, fontSize: '0.55rem', background: '#F97316', color: C.white, borderRadius: 4, padding: '1px 5px', fontWeight: 800 }}>ZAMIANA</span>}
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.navy }}>{exerciseName}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {effectiveTempo && (
                <button onClick={e => { e.stopPropagation(); setTempoOpen(true) }}
                  style={{ padding: '2px 8px', background: C.navyLight, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: mono, fontWeight: 700, fontSize: '0.68rem', color: C.gold }}>
                  ⏱ {effectiveTempo}
                </button>
              )}
              <span style={{ padding: '2px 8px', background: C.grayLight, borderRadius: 6, fontSize: '0.7rem', color: C.gray, fontWeight: 500 }}>
                {effectiveSets}×{effectiveReps}
              </span>
              {effectiveRir != null && (
                <button onClick={e => { e.stopPropagation(); setRirOpen(true) }}
                  style={{ padding: '2px 8px', background: C.navyLight, border: 'none', borderRadius: 6, fontSize: '0.68rem', color: C.gold, fontWeight: 700, cursor: 'pointer', fontFamily: mono }}>
                  RIR {effectiveRir} ❓
                </button>
              )}
            </div>
          </div>

          {/* Video icon — tylko gdy jest URL */}
          {exercise.exercise_url && (
            <button onClick={e => { e.stopPropagation(); setVideoOpen(true) }}
              style={{ width: 32, height: 32, borderRadius: 8, background: C.navy, border: `1.5px solid ${C.gold}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              title="Film instruktażowy">
              <span style={{ fontSize: '0.8rem' }}>▶️</span>
            </button>
          )}

          {/* Kropki serii */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginLeft: 2 }}>
            {Array.from({ length: effectiveSets }, (_, i) => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < completedSets ? C.green : C.grayLight, transition: 'background 0.2s' }} />
            ))}
          </div>
          {allDone && <span style={{ fontSize: '0.9rem', marginLeft: 4 }}>✅</span>}
          <span style={{ color: C.gray, fontSize: '0.75rem', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 4 }}>▼</span>
        </div>

        {expanded && (
          <div style={{ padding: '0 1rem 1rem' }}>
            {(effectiveTempoNote || exercise.coach_comment) && (
              <div style={{
                margin: '0.5rem 0 1rem',
                padding: '0.75rem 0.875rem',
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FFF8E1 100%)',
                borderLeft: `3px solid ${C.gold}`,
                borderRadius: '0 10px 10px 0',
              }}>
                <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#92660A', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>
                  💬 Wskazówka trenera
                </div>
                <p style={{ fontSize: '0.86rem', color: C.navy, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  {effectiveTempoNote || exercise.coach_comment}
                </p>
              </div>
            )}

            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: mono }}>Serie</div>

            {visibleWarmupSets.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 700, color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.35rem', fontFamily: mono }}>Rozgrzewka</div>
                {visibleWarmupSets.map((warmup, index) => (
                  <WarmupSetRow
                    key={`warmup-${index}`}
                    warmup={warmup}
                    setNum={index + 1}
                    existingLog={exSetLogs.find(l => l.set_number === index + 1 && l.is_warmup)}
                    sessionId={sessionId}
                    athleteId={athleteId}
                    blockExerciseId={exercise.id}
                    onLogSaved={handleLogSaved}
                  />
                ))}
              </div>
            )}

            {Array.from({ length: effectiveSets }, (_, i) => (
              <SetRow
                key={i}
                setNum={i + 1}
                reps={effectiveReps}
                isAmrap={isAmrap}
                prevWeight={prevWeight}
                existingLog={exSetLogs.find(l => l.set_number === i + 1 && !l.is_warmup)}
                sessionId={sessionId}
                athleteId={athleteId}
                blockExerciseId={exercise.id}
                onComplete={done => {
                  setLocalCompleted(prev => Math.max(0, prev + (done ? 1 : -1)))
                  onSetsChange(done ? 1 : -1)
                }}
                onLogSaved={handleLogSaved}
              />
            ))}

            {/* Notatka do ćwiczenia (jedna, zapisuje do first set_log) */}
            <div style={{ marginTop: 10, marginBottom: 8 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5, fontFamily: mono }}>Notatka do ćwiczenia</div>
              <textarea
                placeholder="Jak poszło? Uwagi do następnego razu, co poprawić..."
                value={exerciseNote}
                onChange={e => setExerciseNote(e.target.value)}
                onBlur={async () => {
                  if (!sessionId || !exercise.id) return
                  // Zapisz jako athlete_note do pierwszej serii
                  const { data: firstLog } = await supabase.from('set_logs').select('id')
                    .eq('workout_session_id', sessionId).eq('block_exercise_id', exercise.id)
                    .eq('is_warmup', false).order('set_number', { ascending: true }).limit(1).maybeSingle()
                  if (firstLog?.id) {
                    await supabase.from('set_logs').update({ athlete_note: exerciseNote.trim() || null }).eq('id', firstLog.id)
                  }
                }}
                rows={2}
                style={{ width: '100%', padding: '0.625rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', background: '#FAFBFC', boxSizing: 'border-box' }}
              />
            </div>

            {/* Ból */}
            <button onClick={() => setFeelingOpen(!feelingOpen)}
              style={{ width: '100%', padding: '0.75rem 1rem', background: feelingOpen ? '#FFF7ED' : C.grayLight, border: feelingOpen ? '1.5px solid #FED7AA' : `1.5px solid ${C.grayLight}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: sans, transition: 'all 0.15s' }}>
              <span style={{ fontSize: '1.1rem' }}>🩹</span>
              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: C.navy }}>Ból / dyskomfort</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: C.gray }}>{feelingOpen ? '▲' : '▼'}</span>
            </button>
            {feelingOpen && (
              <div style={{ marginTop: 6, padding: '1rem', background: '#FAFBFC', borderRadius: 10, border: `1.5px solid ${C.grayLight}` }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: mono }}>Skala bólu VAS — {vas}/10</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: C.green, fontWeight: 600 }}>0</span>
                  <input type="range" min={0} max={10} step={1} value={vas} onChange={e => setVas(parseInt(e.target.value))} style={{ flex: 1, accentColor: vas >= 7 ? C.red : vas >= 4 ? '#F97316' : C.green }} />
                  <span style={{ fontSize: '0.75rem', color: C.red, fontWeight: 600 }}>10</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: vas >= 7 ? C.red : vas >= 4 ? '#F97316' : C.green, marginBottom: '0.75rem' }}>
                  {vas === 0 ? 'Brak bólu' : vas <= 3 ? 'Łagodny' : vas <= 6 ? 'Umiarkowany' : vas <= 8 ? 'Silny' : 'Bardzo silny'}
                </div>
                <textarea placeholder="Gdzie boli? Opis odczuć..." value={painNote} onChange={e => setPainNote(e.target.value)} rows={2}
                  style={{ width: '100%', padding: '0.625rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
                {painError && <div style={{ color: C.red, fontSize: '0.75rem', marginTop: 4 }}>❌ {painError}</div>}
                {(vas > 0 || painNote) && (
                  <button onClick={savePain} style={{ marginTop: 8, width: '100%', padding: '0.625rem', background: painSaved ? C.green : C.navy, color: painSaved ? '#fff' : C.gold, border: 'none', borderRadius: 8, fontFamily: sans, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                    {painSaved ? '✓ Zapisano' : 'Zapisz odczucia'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── REPORT SENT SCREEN ───────────────────────────────────────────────────────

const FEELING_LABELS: Record<string, string> = {
  swietnie: '🤩 Świetnie', dobrze: '😊 Dobrze',
  srednie: '😐 Średnio', zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
}

function rpeLabel(rpe: number) {
  if (rpe <= 3) return 'Lekki'
  if (rpe <= 5) return 'Umiarkowany'
  if (rpe <= 7) return 'Ciężki'
  if (rpe <= 9) return 'Bardzo ciężki'
  return 'Maksymalny'
}

function rpeColor(rpe: number) {
  if (rpe <= 4) return '#22C55E'
  if (rpe <= 6) return '#F5C842'
  if (rpe <= 8) return '#F97316'
  return '#EF4444'
}

function ReportSentScreen({ rpe, feeling, whatWell, pain, notes, onBack }: {
  rpe: number; feeling: string; whatWell: string; pain: string; notes: string; onBack: () => void
}) {
  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-report, #print-report * { visibility: visible !important; }
          #print-report { position: fixed; inset: 0; padding: 2rem; background: white; }
        }
      `}</style>

      <div style={{ padding: '1.5rem 1rem 2rem', fontFamily: sans }}>
        {/* Nagłówek sukcesu */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 800, color: C.navy, fontSize: '1.25rem', marginBottom: 4 }}>
            Raport wysłany!
          </div>
          <div style={{ fontSize: '0.84rem', color: C.gray, lineHeight: 1.5 }}>
            Raport trafił do Ciebie i do trenera na maila.<br />
            Sprawdź czy wszystko jest poprawnie zapisane.
          </div>
        </div>

        {/* Podgląd raportu do druku */}
        <div id="print-report" style={{
          background: C.white, border: `1.5px solid ${C.grayLight}`,
          borderRadius: 16, overflow: 'hidden', marginBottom: '1.25rem',
          boxShadow: '0 4px 20px rgba(13,27,42,0.07)',
        }}>
          {/* Hero */}
          <div style={{ background: C.navy, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: mono, marginBottom: 4 }}>
              Raport treningowy
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: C.white, marginBottom: '1rem' }}>
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.875rem' }}>
                <div style={{ fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: mono, marginBottom: 4 }}>RPE</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: rpeColor(rpe), lineHeight: 1 }}>{rpe}</div>
                <div style={{ fontSize: '0.72rem', color: C.gray, marginTop: 2 }}>{rpeLabel(rpe)}</div>
              </div>
              {feeling && (
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.875rem' }}>
                  <div style={{ fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: mono, marginBottom: 4 }}>Po treningu</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: C.white, lineHeight: 1.3 }}>{FEELING_LABELS[feeling] || feeling}</div>
                </div>
              )}
            </div>
          </div>

          {/* Feedback */}
          <div style={{ padding: '1rem' }}>
            {[
              { label: '✅ Co poszło dobrze', val: whatWell, color: '#22C55E' },
              { label: '🩹 Ból / dyskomfort', val: pain, color: '#EF4444' },
              { label: '💬 Dodatkowe uwagi', val: notes, color: C.gray },
            ].filter(f => f.val).map(f => (
              <div key={f.label} style={{ marginBottom: '0.875rem', padding: '0.75rem', background: C.offWhite, borderRadius: 10, borderLeft: `3px solid ${f.color}` }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: f.color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: '0.88rem', color: C.navy, lineHeight: 1.5 }}>{f.val}</div>
              </div>
            ))}

            {!whatWell && !pain && !notes && (
              <div style={{ color: C.gray, fontSize: '0.84rem', textAlign: 'center', padding: '0.5rem' }}>
                Brak dodatkowych uwag.
              </div>
            )}

            <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#F0FDF4', borderRadius: 10, border: `1px solid #86EFAC` }}>
              <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>
                📧 Raport wysłany na Twój email i do trenera
              </div>
            </div>
          </div>
        </div>

        {/* Przyciski */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: 12, border: `1.5px solid ${C.grayLight}`,
              background: C.white, color: C.navy, fontFamily: sans, fontWeight: 700, fontSize: '0.9rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            🖨️ Drukuj raport
          </button>
          <button
            onClick={onBack}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: 12, border: 'none',
              background: C.navy, color: C.gold, fontFamily: sans, fontWeight: 800, fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Wróć do panelu →
          </button>
        </div>
      </div>
    </>
  )
}

// ─── POST WORKOUT ─────────────────────────────────────────────────────────────

interface FeedbackSnapshot { rpe: number; feeling: string; whatWell: string; pain: string; notes: string }

function PostWorkoutSection({ sessionId, athleteId, wellnessFilled, onFinish, inModal, sendRef, onSaved }: {
  sessionId: number; athleteId: number; wellnessFilled: boolean; onFinish: () => void
  inModal?: boolean; sendRef?: React.MutableRefObject<(() => void) | null>
  onSaved?: (data: FeedbackSnapshot) => void
}) {
  const supabase = createClient()
  const router = useRouter()
  const [rpe, setRpe] = useState(6)
  const [feeling, setFeeling] = useState('')
  const [whatWell, setWhatWell] = useState('')
  const [pain, setPain] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [existingFeedbackId, setExistingFeedbackId] = useState<number | null>(null)
  const [sent, setSent] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  // Wczytaj istniejący feedback przy montowaniu
  React.useEffect(() => {
    supabase.from('post_session_feedback')
      .select('*')
      .eq('workout_session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingFeedbackId(data.id)
          setRpe(data.session_rpe ?? 6)
          setFeeling(data.feeling_after ?? '')
          setWhatWell(data.what_went_well ?? '')
          setPain(data.pain_after_comment ?? '')
          setNotes(data.general_notes ?? '')
          setFeedbackSaved(true)
        }
      })
  }, [sessionId])

  // Zapisz tylko feedback (bez wysyłki raportu)
  async function saveFeedback() {
    setSavingFeedback(true)
    const payload = {
      session_id: sessionId,
      workout_session_id: sessionId,
      athlete_id: athleteId,
      session_rpe: rpe,
      feeling_after: feeling,
      what_went_well: whatWell,
      pain_after_comment: pain,
      general_notes: notes,
    }
    if (existingFeedbackId) {
      const { data } = await supabase.from('post_session_feedback').update(payload).eq('id', existingFeedbackId).select('id').single()
      if (data) setExistingFeedbackId(data.id)
    } else {
      const { data } = await supabase.from('post_session_feedback').insert(payload).select('id').single()
      if (data) setExistingFeedbackId(data.id)
    }
    setSavingFeedback(false)
    setFeedbackSaved(true)
    onSaved?.({ rpe, feeling, whatWell, pain, notes })
  }

  // Udostępnij funkcję wysyłki dla FinishModal (przez ref)
  React.useEffect(() => {
    if (sendRef) {
      sendRef.current = () => {
        if (!feeling || !wellnessFilled) { setShowValidation(true); return }
        finish(true)
      }
    }
  })

  async function finish(sendReport: boolean) {
    if (!feeling && sendReport) return
    setSaving(true)

    try {
      // 1. Zapisz feedback (update jeśli już istnieje, insert jeśli nie)
      const feedbackPayload = {
        session_id: sessionId,
        workout_session_id: sessionId,
        athlete_id: athleteId,
        session_rpe: rpe,
        feeling_after: feeling,
        what_went_well: whatWell,
        pain_after_comment: pain,
        general_notes: notes,
      }
      if (existingFeedbackId) {
        await supabase.from('post_session_feedback').update(feedbackPayload).eq('id', existingFeedbackId)
      } else {
        await supabase.from('post_session_feedback').insert(feedbackPayload)
      }

      // 2. Oznacz sesję jako ukończoną
      await supabase.from('workout_sessions').update({
        completed: true,
        date_completed: new Date().toISOString(),
      }).eq('id', sessionId)

      // 3. Wyślij raport e-mailem (API pobierze dane z bazy)
      if (sendReport) {
        const res = await fetch('/api/send-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, athleteId }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          console.error('Błąd wysyłki raportu:', err)
        }
      }
    } catch (e) {
      console.error('Błąd finish():', e)
    }

    setSaving(false)
    router.push(`/athlete/report/${sessionId}`)
  }

  if (sent) return null

  return (
    <div style={{ padding: '0 1rem 1rem', fontFamily: sans }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.navy }}>Jak ciężki był trening? (RPE)</span>
          <span style={{ fontFamily: mono, fontSize: '1.1rem', fontWeight: 800, color: C.gold }}>{rpe}/10</span>
        </div>
        <input type="range" min={0} max={10} step={1} value={rpe} onChange={e => setRpe(parseInt(e.target.value))} style={{ width: '100%', accentColor: C.gold }} />
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: C.gray, marginTop: 2 }}>
          {rpe <= 3 ? 'Lekki' : rpe <= 5 ? 'Umiarkowany' : rpe <= 7 ? 'Ciężki' : rpe <= 9 ? 'Bardzo ciężki' : 'Maksymalny'}
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.navy, display: 'block', marginBottom: 8 }}>Jak się czujesz po treningu?</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FEELING_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setFeeling(opt.value)}
              style={{ padding: '0.5rem 0.875rem', background: feeling === opt.value ? C.navy : '#F4F6F9', border: feeling === opt.value ? 'none' : `1.5px solid ${C.grayLight}`, borderRadius: 10, fontFamily: sans, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: feeling === opt.value ? 700 : 400, color: feeling === opt.value ? C.gold : C.navy, transition: 'all 0.15s' }}>
              <span>{opt.emoji}</span><span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {[
        { label: 'Co poszło dobrze?', val: whatWell, set: setWhatWell, placeholder: 'Np. lepsza technika, więcej energii...' },
        { label: 'Ból lub dyskomfort po treningu?', val: pain, set: setPain, placeholder: 'Opisz jeśli coś boli...' },
        { label: 'Coś jeszcze dla trenera?', val: notes, set: setNotes, placeholder: 'Pytania, uwagi...' },
      ].map(f => (
        <div key={f.label} style={{ marginBottom: '0.875rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.navy, display: 'block', marginBottom: 5 }}>{f.label}</span>
          <textarea value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} rows={2}
            style={{ width: '100%', padding: '0.625rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      ))}

      {/* Przycisk zapisu feedbacku (bez wysyłki raportu) */}
      {!inModal && (
        <button onClick={saveFeedback} disabled={savingFeedback}
          style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', borderRadius: 10, border: 'none', background: feedbackSaved ? C.green : C.navyLight, color: feedbackSaved ? C.white : C.gold, fontFamily: sans, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', transition: 'all 0.3s' }}>
          {savingFeedback ? 'Zapisuję...' : feedbackSaved ? '✓ Feedback zapisany' : '💾 Zapisz feedback'}
        </button>
      )}

      {/* Walidacja */}
      {showValidation && (() => {
        const missing = []
        if (!wellnessFilled) missing.push('Gotowość do treningu')
        if (!feeling) missing.push('Samopoczucie po treningu')
        return missing.length > 0 ? (
          <div style={{ padding: '0.875rem', background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 10, marginBottom: 10 }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>Aby wysłać raport, uzupełnij:</div>
            {missing.map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', color: C.red, marginBottom: 3 }}>
                <span>✗</span> <span>{m}</span>
              </div>
            ))}
          </div>
        ) : null
      })()}

    </div>
  )
}

// ─── COACH INTRO CARD ─────────────────────────────────────────────────────────

function CoachIntroCard({ intro, trainerName }: { intro: string; trainerName: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = intro.length > 220
  const displayed = isLong && !expanded ? intro.slice(0, 220).trimEnd() + '…' : intro

  return (
    <div style={{
      marginBottom: '1rem',
      borderRadius: 16,
      overflow: 'hidden',
      background: `linear-gradient(135deg, ${C.navy} 0%, #1A2E45 100%)`,
      border: `1.5px solid #F5C84230`,
      boxShadow: '0 4px 24px rgba(13,27,42,0.18)',
    }}>
      {/* Złoty pasek na górze */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.gold}, #FFE082, ${C.gold})` }} />

      <div style={{ padding: '1rem 1.1rem 1.1rem' }}>
        {/* Nagłówek */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.875rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', flexShrink: 0,
            boxShadow: `0 0 0 3px ${C.navy}, 0 0 0 5px #F5C84250`,
          }}>
            📣
          </div>
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              Wiadomość od trenera
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: C.white }}>
              {trainerName}
            </div>
          </div>
        </div>

        {/* Treść */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '0.875rem 1rem',
          borderLeft: `3px solid ${C.gold}`,
          position: 'relative',
        }}>
          {/* Cudzysłów dekoracyjny */}
          <div style={{
            position: 'absolute', top: -8, left: 12,
            fontFamily: 'Georgia, serif', fontSize: '3rem', lineHeight: 1,
            color: C.gold, opacity: 0.3, userSelect: 'none', pointerEvents: 'none',
          }}>"</div>
          <p style={{
            fontFamily: sans, fontSize: '0.92rem', lineHeight: 1.65,
            color: '#E8F0F8', fontWeight: 500, margin: 0,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {displayed}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                marginTop: 8, background: 'none', border: 'none', color: C.gold,
                fontFamily: sans, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', padding: 0,
              }}
            >
              {expanded ? '↑ Zwiń' : '↓ Czytaj dalej'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── COACH CLOSING CARD ───────────────────────────────────────────────────────

function CoachClosingCard({ closing, trainerName }: { closing: string; trainerName: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = closing.length > 220
  const displayed = isLong && !expanded ? closing.slice(0, 220).trimEnd() + '…' : closing

  return (
    <div style={{
      marginTop: '1rem',
      borderRadius: 16,
      overflow: 'hidden',
      background: `linear-gradient(135deg, #1E3A5F 0%, #1E40AF 100%)`,
      border: `1.5px solid #3B82F630`,
      boxShadow: '0 4px 24px rgba(30,58,95,0.22)',
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, #3B82F6, #93C5FD, #3B82F6)` }} />
      <div style={{ padding: '1rem 1.1rem 1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.875rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', flexShrink: 0,
            boxShadow: `0 0 0 3px #1E3A5F, 0 0 0 5px #3B82F640`,
          }}>
            💙
          </div>
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#93C5FD', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              Od trenera
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff' }}>
              {trainerName}
            </div>
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '0.875rem 1rem',
          borderLeft: `3px solid #3B82F6`,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: -8, left: 12,
            fontFamily: 'Georgia, serif', fontSize: '3rem', lineHeight: 1,
            color: '#3B82F6', opacity: 0.3, userSelect: 'none', pointerEvents: 'none',
          }}>"</div>
          <p style={{
            fontFamily: sans, fontSize: '0.92rem', lineHeight: 1.65,
            color: '#DBEAFE', fontWeight: 500, margin: 0,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {displayed}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ marginTop: 8, background: 'none', border: 'none', color: '#93C5FD', fontFamily: sans, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
            >
              {expanded ? '↑ Zwiń' : '↓ Czytaj dalej'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── FINISH MODAL ─────────────────────────────────────────────────────────────

const FEELING_EMOJI: Record<string, string> = {
  swietnie: '🤩', dobrze: '😊', srednie: '😐', zmeczona: '😓', slabo: '😞',
}
const FEELING_LABEL: Record<string, string> = {
  swietnie: 'Świetnie', dobrze: 'Dobrze', srednie: 'Średnio', zmeczona: 'Zmęczona', slabo: 'Słabo',
}

function FinishModal({ doneSets, totalSets, wellnessFilled, feedbackFilled, wellnessData, feedbackData, preFields, blockGroups, setLogs, sessionId, onClose, onFinish }: {
  doneSets: number; totalSets: number
  wellnessFilled: boolean; feedbackFilled: boolean
  wellnessData: any; feedbackData: FeedbackSnapshot | null
  preFields: string[] | null
  blockGroups: any[]; setLogs: SetLog[]; sessionId: number
  onClose: () => void; onFinish: () => void
}) {
  const supabase = createClient()
  const [sending, setSending] = useState(false)
  const [painLogs, setPainLogs] = useState<any[]>([])

  useEffect(() => {
    if (!sessionId) return
    supabase.from('pain_logs').select('*').eq('workout_session_id', sessionId).then(({ data }) => {
      if (data) setPainLogs(data.filter(p => p.vas_score > 0 || p.pain_comment))
    })
  }, [sessionId])

  async function handleSend() {
    setSending(true)
    await onFinish()
  }

  const Chip = ({ ok, label }: { ok: boolean; label: string }) => (
    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.4rem 0.75rem', fontFamily: mono, fontSize: '0.72rem', color: ok ? C.green : C.gray, fontWeight: 700 }}>
      {ok ? `✓ ${label}` : `○ ${label}`}
    </div>
  )

  // Wellness — pokaż tylko aktywne pola z wartościami
  const activeFieldIds = (preFields && preFields.length > 0) ? preFields : DEFAULT_PRE_FIELDS
  const wellnessSummaryFields = activeFieldIds
    .map(id => WELLNESS_FIELD_MAP[id])
    .filter(Boolean)
    .filter(f => wellnessData?.[f.key] != null)
    .slice(0, 5)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: C.offWhite, fontFamily: sans, display: 'flex', flexDirection: 'column' }}>
      {/* Nagłówek */}
      <div style={{ background: C.navy, padding: '1rem 1.25rem', flexShrink: 0 }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <button onClick={onClose}
              style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 10, padding: '0.5rem 0.875rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: sans }}>
              ← Wróć do treningu
            </button>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Zakończenie
            </div>
          </div>
          <div style={{ background: 'rgba(245,200,66,0.12)', border: `1.5px solid ${C.gold}`, borderRadius: 12, padding: '0.875rem 1rem' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: C.gold, marginBottom: 4 }}>
              ⚠️ Sprawdź czy wszystko się zgadza
            </div>
            <div style={{ fontSize: '0.82rem', color: '#C8B96A', lineHeight: 1.5 }}>
              Upewnij się że serie, ciężary i notatki są poprawne. Po wysłaniu nie można edytować treningu.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.4rem 0.75rem', fontFamily: mono, fontSize: '0.72rem', color: doneSets >= totalSets ? C.green : C.gold, fontWeight: 700 }}>
                {doneSets}/{totalSets} serii
              </div>
              <Chip ok={wellnessFilled} label="Gotowość przed treningiem" />
              <Chip ok={feedbackFilled} label="Feedback po treningu" />
            </div>
          </div>
        </div>
      </div>

      {/* Podgląd danych */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Wellness summary */}
          {wellnessFilled && wellnessData && wellnessSummaryFields.length > 0 && (
            <div style={{ background: C.white, borderRadius: 12, padding: '0.875rem', border: `1.5px solid ${C.grayLight}` }}>
              <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '0.625rem' }}>
                🩺 Gotowość przed treningiem
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {wellnessSummaryFields.map(f => {
                  const val = wellnessData[f.key]
                  return (
                    <div key={f.key} style={{ background: C.offWhite, borderRadius: 8, padding: '0.3rem 0.625rem', display: 'flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: C.gray }}>{f.label}:</span>
                      <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 800, color: C.navy }}>{val}{f.unit}</span>
                    </div>
                  )
                })}
                {wellnessData.concerns && (
                  <div style={{ width: '100%', marginTop: 4, fontSize: '0.78rem', color: C.navy, background: C.offWhite, borderRadius: 8, padding: '0.3rem 0.625rem' }}>
                    💬 {wellnessData.concerns}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feedback summary */}
          {feedbackFilled && feedbackData && (
            <div style={{ background: C.white, borderRadius: 12, padding: '0.875rem', border: `1.5px solid ${C.grayLight}` }}>
              <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '0.625rem' }}>
                📝 Feedback po treningu
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: feedbackData.whatWell || feedbackData.pain || feedbackData.notes ? '0.5rem' : 0 }}>
                <div style={{ background: C.offWhite, borderRadius: 8, padding: '0.3rem 0.625rem', display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: C.gray }}>RPE:</span>
                  <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 800, color: C.gold }}>{feedbackData.rpe}/10</span>
                </div>
                {feedbackData.feeling && (
                  <div style={{ background: C.offWhite, borderRadius: 8, padding: '0.3rem 0.625rem', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem' }}>{FEELING_EMOJI[feedbackData.feeling] || ''}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.navy }}>{FEELING_LABEL[feedbackData.feeling] || feedbackData.feeling}</span>
                  </div>
                )}
              </div>
              {[
                { icon: '✅', val: feedbackData.whatWell },
                { icon: '🩹', val: feedbackData.pain },
                { icon: '💬', val: feedbackData.notes },
              ].filter(f => f.val).map((f, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: C.navy, background: C.offWhite, borderRadius: 8, padding: '0.3rem 0.625rem', marginTop: 4 }}>
                  {f.icon} {f.val}
                </div>
              ))}
            </div>
          )}

          {/* Bloki treningowe */}
          {blockGroups.map((block, bi) => {
            const exercises: TrainingExercise[] = block.exercises || []
            return (
              <div key={block.id ?? bi} style={{ background: C.white, borderRadius: 12, border: `1.5px solid ${C.grayLight}`, overflow: 'hidden' }}>
                {/* Nagłówek bloku */}
                <div style={{ background: C.navy, padding: '0.5rem 0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.75rem', color: C.gold, letterSpacing: '0.06em' }}>{block.block_name}</span>
                </div>
                {exercises.map((ex, ei) => {
                  const sets = setLogs.filter(l => l.block_exercise_id === ex.id && !l.is_warmup)
                    .sort((a, b) => a.set_number - b.set_number)
                  const effectiveSets = ex.override?.sets_override || ex.sets
                  const pain = painLogs.find(p => p.pain_location?.toLowerCase().includes(
                    (ex.exercise?.name || ex.exercise_code || '').toLowerCase().slice(0, 10)
                  ))
                  return (
                    <div key={ex.id ?? ei} style={{ padding: '0.625rem 0.875rem', borderTop: ei > 0 ? `1px solid ${C.grayLight}` : 'none' }}>
                      {/* Nazwa ćwiczenia */}
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: C.navy, marginBottom: '0.4rem' }}>
                        {ex.exercise?.name || ex.exercise_code}
                        {ex.override?.sets_override && (
                          <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, marginLeft: 6 }}>
                            {ex.override.sets_override}×{ex.override.reps_override || ex.reps}
                          </span>
                        )}
                      </div>
                      {/* Serie */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {Array.from({ length: effectiveSets }, (_, i) => {
                          const log = sets.find(s => s.set_number === i + 1)
                          const done = log?.completed
                          const w = log?.weight
                          return (
                            <div key={i} style={{
                              padding: '0.2rem 0.5rem', borderRadius: 6, fontFamily: mono, fontSize: '0.72rem', fontWeight: 700,
                              background: done ? '#F0FDF4' : C.offWhite,
                              color: done ? '#166534' : C.gray,
                              border: `1px solid ${done ? '#86EFAC' : C.grayLight}`,
                            }}>
                              S{i + 1} {done ? (w ? `${w}kg` : '✓') : '—'}
                            </div>
                          )
                        })}
                      </div>
                      {/* Ból dla tego ćwiczenia */}
                      {pain && (
                        <div style={{ marginTop: 5, fontSize: '0.72rem', color: '#B45309', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '0.2rem 0.5rem', display: 'inline-block' }}>
                          🩹 VAS {pain.vas_score}/10{pain.pain_comment ? ` · ${pain.pain_comment}` : ''}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Przyciski */}
      <div style={{ flexShrink: 0, background: C.white, borderTop: `1.5px solid ${C.grayLight}`, padding: '0.875rem 1rem' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{ flex: 1, padding: '0.875rem 0.5rem', background: C.offWhite, color: C.navy, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, fontFamily: sans, fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}>
            🖨️ Drukuj
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{ flex: 2, padding: '0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontFamily: sans, fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Wysyłam...' : '✅ Wyślij raport do trenera'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function TrainingClient({ athlete, trainingView, existingSetLogs, existingWellness, wellnessPreFields }: Props) {
  const router = useRouter()
  const { session, day, blocks, plan, week } = trainingView
  const [setLogs, setSetLogs] = useState<SetLog[]>(() => dedupeSetLogs(existingSetLogs))
  const [wellnessSaved, setWellnessSaved] = useState(!!existingWellness)
  const [wellnessOpen, setWellnessOpen] = useState(!existingWellness)
  const [localWellness, setLocalWellness] = useState<any>(existingWellness)
  const [wellnessKey, setWellnessKey] = useState(0)
  const [postOpen, setPostOpen] = useState(false)
  const [postFeedbackSaved, setPostFeedbackSaved] = useState(false)
  const [savedFeedbackData, setSavedFeedbackData] = useState<FeedbackSnapshot | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishBlockMsg, setFinishBlockMsg] = useState<string | null>(null)
  const [savedLocal, setSavedLocal] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)

  const supabase = createClient()

  const totalSets = blocks.reduce((sum, b) => sum + (b.exercises || []).reduce((s: number, e: WorkoutBlockExercise) => s + (e.override?.sets_override || e.sets), 0), 0)
  const [doneSetsCount, setDoneSetsCount] = useState(() => dedupeSetLogs(existingSetLogs).filter(l => l.completed && !l.is_warmup).length)
  const progress = totalSets > 0 ? Math.round((doneSetsCount / totalSets) * 100) : 0

  const handleSetsChange = useCallback((delta: number) => {
    setDoneSetsCount(prev => Math.max(0, prev + delta))
  }, [])

  async function saveLocal() {
    setSavedLocal(true)
    setTimeout(() => setSavedLocal(false), 3000)
  }

  function tryOpenFinish() {
    const missing: string[] = []
    if (!wellnessSaved) missing.push('Gotowość przed treningiem')
    if (!postFeedbackSaved) missing.push('Feedback po treningu')
    if (missing.length > 0) {
      setFinishBlockMsg(`Uzupełnij przed zakończeniem:\n• ${missing.join('\n• ')}`)
      setTimeout(() => setFinishBlockMsg(null), 5000)
      return
    }
    setFinishOpen(true)
  }

  async function finishSession() {
    if (!session) return
    await supabase.from('workout_sessions').update({
      completed: true,
      date_completed: new Date().toISOString(),
    }).eq('id', session.id)

    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, athleteId: athlete.id }),
    }).catch(e => { console.error('send-report fetch error:', e); return null })

    if (res && !res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('send-report error:', err)
      // Mimo błędu wysyłki — przechodzimy do raportu, sesja jest oznaczona jako zakończona
    }

    router.push(`/athlete/report/${session.id}`)
  }

  // Grupuj ćwiczenia po blokach
  const blockGroups = blocks.map(block => ({
    ...block,
    exercises: ([...(block.exercises || [])] as TrainingExercise[]).sort((a, b) => a.exercise_order - b.exercise_order),
  }))

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=range] { cursor: pointer; }
        body { background: ${C.offWhite}; }
      `}</style>

      <FloatingTimer />
      {legendOpen && <LegendModal planNotes={(plan as any)?.description || null} onClose={() => setLegendOpen(false)} />}

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>

        {/* ── HEADER ── */}
        <div style={{ background: C.navy, padding: '1rem 1.25rem 0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={() => router.push('/athlete')}
                style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.gray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}
                title="Powrót do panelu">
                ←
              </button>
              <button onClick={() => router.push('/athlete')} style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                <img src="/level up.jpg" alt="Level Up" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            </div>
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', width: `min(60vw, ${contentMaxWidth}px)`, pointerEvents: 'none' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: C.white }}>{athlete.full_name}</div>
              <div style={{ fontSize: '0.72rem', color: C.gray, marginTop: 1 }}>
                <span style={{ color: C.gold, fontWeight: 600 }}>Trener: {trainerName}</span>
              </div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: C.navyLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/unique.png" alt="Unique" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px', background: '#fff' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: '0.875rem' }}>
            <div style={{ background: C.gold, borderRadius: 20, padding: '4px 12px', flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: '0.72rem', color: C.navy, letterSpacing: '0.06em', fontFamily: mono }}>
                TYD {week?.week_number || '1'}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {day.day_name}
              </div>
              <div style={{ fontSize: '0.65rem', color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {plan?.name}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: '0.72rem', color: C.gray }}>{new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
              <button onClick={() => setLegendOpen(true)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: C.navyLight, border: `1.5px solid ${C.navyBorder}`, color: C.gold, fontWeight: 900, fontFamily: mono, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Legenda skrótów">
                ℹ
              </button>
            </div>
          </div>

          {/* Pasek postępu */}
          <div style={{ paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.68rem', color: C.gray, fontFamily: mono, letterSpacing: '0.04em' }}>Postęp treningu</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: progress === 100 ? C.green : C.gold, fontFamily: mono }}>
                {doneSetsCount}/{totalSets} serii · {progress}%
              </span>
            </div>
            <div style={{ height: 6, background: C.navyBorder, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? C.green : C.gold, borderRadius: 3, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: '1rem 1rem 10rem' }}>
          <div style={{ maxWidth: contentMaxWidth, margin: '0 auto' }}>

          {/* Przemowa trenera */}
          {(day as any).coach_intro && (
            <CoachIntroCard intro={(day as any).coach_intro} trainerName={trainerName} />
          )}

          {/* Wellness */}
          <div style={{ background: '#fff', borderRadius: 14, marginBottom: '1rem', border: `1.5px solid ${C.grayLight}`, overflow: 'hidden', boxShadow: wellnessOpen ? '0 4px 20px rgba(13,27,42,0.08)' : 'none' }}>
            <button onClick={() => setWellnessOpen(!wellnessOpen)} style={{ width: '100%', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: sans }}>
              <span style={{ fontSize: '1.2rem' }}>🩺</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>Gotowość do treningu</div>
                <div style={{ fontSize: '0.75rem', color: C.gray }}>{wellnessSaved ? '✓ Zapisano' : 'Jak się dziś czujesz?'}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: C.gray, fontSize: '0.75rem', transform: wellnessOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            {wellnessOpen && session && (
              <WellnessExpanded
                key={wellnessKey}
                sessionId={session.id}
                athleteId={athlete.id}
                existingWellness={localWellness}
                preFields={wellnessPreFields}
                onSaved={(saved) => {
                  setLocalWellness(saved)
                  setWellnessKey(k => k + 1)
                  setWellnessSaved(true)
                  setWellnessOpen(false)
                }}
              />
            )}
          </div>

          {/* Bloki */}
          {blockGroups.map(block => (
            <div key={block.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.625rem', marginTop: '0.5rem' }}>
                <div style={{ background: C.navy, borderRadius: 20, padding: '5px 14px', flexShrink: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.78rem', color: '#fff', letterSpacing: '0.06em' }}>{block.block_name}</span>
                </div>
                <div style={{ flex: 1, height: 1, background: C.grayLight }} />
              </div>
              {(block.exercises || []).map((exercise: TrainingExercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  sessionId={session?.id || 0}
                  athleteId={athlete.id}
                  setLogs={setLogs}
                  onSetsChange={handleSetsChange}
                  prevWeight={null}
                  blockLetter={block.block_name?.match(/[A-Z]/)?.[0] || ''}
                />
              ))}
            </div>
          ))}

          {/* Feedback po treningu — wypełnij zanim klikniesz Zakończ */}
          <div style={{ background: C.white, borderRadius: 14, marginTop: '1rem', border: `1.5px solid ${postFeedbackSaved ? '#86EFAC' : C.grayLight}`, overflow: 'hidden', boxShadow: postOpen ? '0 4px 20px rgba(13,27,42,0.08)' : 'none' }}>
            <button onClick={() => setPostOpen(v => !v)} style={{ width: '100%', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: sans }}>
              <span style={{ fontSize: '1.2rem' }}>📝</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>Feedback treningowy</div>
                <div style={{ fontSize: '0.75rem', color: postFeedbackSaved ? C.green : C.gray }}>{postFeedbackSaved ? '✓ Zapisano' : 'RPE, samopoczucie, uwagi dla trenera'}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: C.gray, fontSize: '0.75rem', transform: postOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            {postOpen && session && (
              <PostWorkoutSection
                sessionId={session.id}
                athleteId={athlete.id}
                wellnessFilled={wellnessSaved}
                onFinish={() => {}}
                inModal={false}
                sendRef={undefined}
                onSaved={(data) => {
                  setPostFeedbackSaved(true)
                  setSavedFeedbackData(data)
                  setPostOpen(false)
                }}
              />
            )}
          </div>

          {/* Notatka pod całym treningiem */}
          {(day as any).coach_closing && (
            <CoachClosingCard closing={(day as any).coach_closing} trainerName={trainerName} />
          )}

          {/* Odstęp na fixed buttons */}
          <div style={{ height: 100 }} />
        </div>
        </div>

        {/* ── MODAL zakończenia ── */}
        {finishOpen && session && (
          <FinishModal
            doneSets={doneSetsCount}
            totalSets={totalSets}
            wellnessFilled={wellnessSaved}
            feedbackFilled={postFeedbackSaved}
            wellnessData={localWellness}
            feedbackData={savedFeedbackData}
            preFields={wellnessPreFields}
            blockGroups={blockGroups}
            setLogs={setLogs}
            sessionId={session.id}
            onClose={() => setFinishOpen(false)}
            onFinish={finishSession}
          />
        )}

        {/* ── BOTTOM BUTTONS ── */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderTop: `1.5px solid ${C.grayLight}`, padding: '0.75rem 1rem', zIndex: 20 }}>
          <div style={{ display: 'flex', gap: 7, maxWidth: 520, margin: '0 auto' }}>

            {/* Powrót — nie zapisuje */}
            <button onClick={() => router.push('/athlete')}
              style={{ flex: 1, padding: '0.75rem 0.5rem', background: C.white, color: C.gray, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, fontFamily: sans, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', textAlign: 'center', lineHeight: 1.3 }}>
              ← Powrót<br />
              <span style={{ fontSize: '0.62rem', fontWeight: 400 }}>do panelu</span>
            </button>

            {/* Zapisz — dane już auto-zapisane, wraca do panelu */}
            <button onClick={saveLocal}
              style={{ flex: 1.2, padding: '0.75rem 0.5rem', background: savedLocal ? '#F0FDF4' : C.offWhite, color: savedLocal ? C.green : C.navy, border: `1.5px solid ${savedLocal ? '#86EFAC' : C.grayLight}`, borderRadius: 12, fontFamily: sans, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', textAlign: 'center', lineHeight: 1.3, transition: 'all 0.2s' }}>
              {savedLocal ? '✓ Zapisano!' : '💾 Zapisz'}<br />
              <span style={{ fontSize: '0.62rem', fontWeight: 400, color: savedLocal ? C.green : C.gray }}>można kontynuować</span>
            </button>

            {/* Zakończ i wyślij raport */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={tryOpenFinish}
                style={{ width: '100%', padding: '0.75rem 0.5rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontFamily: sans, fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', lineHeight: 1.3 }}>
                🏁 Zakończ<br />
                <span style={{ fontSize: '0.62rem', fontWeight: 500, color: '#8A9BB0' }}>wyślij raport do trenera</span>
              </button>
              {finishBlockMsg && (
                <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 10, padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: C.red, fontWeight: 600, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                  ⚠️ {finishBlockMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
