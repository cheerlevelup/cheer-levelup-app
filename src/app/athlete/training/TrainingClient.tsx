'use client'
// src/app/athlete/training/TrainingClient.tsx
// Nowy design — Sesja 7

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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

function VideoModal({ exerciseName, onClose }: { exerciseName: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '1.5rem', borderTop: `4px solid ${C.gold}`, fontFamily: sans }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 1.25rem' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.navy, marginBottom: '1rem' }}>📹 {exerciseName}</h3>
        <div style={{ background: C.navy, borderRadius: 14, aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', gap: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(245,200,66,0.15)', border: `2px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.5rem', marginLeft: 4 }}>▶</span>
          </div>
          <span style={{ fontSize: '0.82rem', color: C.gray, textAlign: 'center', maxWidth: 200 }}>Film instruktażowy zostanie dodany przez trenera</span>
        </div>
        <div style={{ background: C.grayLight, borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, fontFamily: mono }}>Wskazówki</div>
          <div style={{ fontSize: '0.85rem', color: C.navy, lineHeight: 1.5 }}>Brak filmiku? Szukaj: <span style={{ color: C.gold, fontWeight: 600 }}>&quot;{exerciseName} tutorial&quot;</span></div>
        </div>
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

// ─── WARMUP ROW ───────────────────────────────────────────────────────────────

function WarmupRow({ warmup }: { warmup: { reps: number; weight: string; fixed: boolean } }) {
  const [done, setDone] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', background: done ? '#F0FDF4' : '#FAFBFC', borderRadius: 10, marginBottom: 6, border: `1.5px solid ${done ? '#86EFAC' : C.grayLight}`, transition: 'all 0.2s', fontFamily: sans }}>
      <span style={{ fontWeight: 800, fontSize: '0.75rem', color: C.gray, minWidth: 44, fontFamily: mono }}>Rozg</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>{warmup.reps} pow.</span>
        <span style={{ color: C.gray, fontSize: '0.88rem' }}> · {warmup.weight}</span>
        {!warmup.fixed && <span style={{ fontSize: '0.7rem', color: C.gray, marginLeft: 6 }}>(ref.)</span>}
      </div>
      <button onClick={() => setDone(!done)} style={{ width: 36, height: 36, borderRadius: 8, background: done ? C.green : C.grayLight, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
        {done && <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 800 }}>✓</span>}
      </button>
    </div>
  )
}

// ─── SET ROW ──────────────────────────────────────────────────────────────────

function SetRow({ setNum, reps, isAmrap, prevWeight, existingLog, sessionId, athleteId, blockExerciseId, isWarmupRow, onComplete }: {
  setNum: number; reps: string | number; isAmrap: boolean; prevWeight?: number | null
  existingLog?: SetLog; sessionId: number; athleteId: number; blockExerciseId: number
  isWarmupRow: boolean; onComplete: (done: boolean) => void
}) {
  const supabase = createClient()
  const [weight, setWeight] = useState(existingLog?.weight?.toString() || '')
  const [actualReps, setActualReps] = useState(existingLog?.reps_completed?.toString() || '')
  const [done, setDone] = useState(!!existingLog?.completed)

  async function toggle() {
    const newDone = !done
    setDone(newDone)
    onComplete(newDone)
    const payload = {
      workout_session_id: sessionId, block_exercise_id: blockExerciseId,
      athlete_id: athleteId, set_number: setNum,
      weight: weight ? parseFloat(weight) : null,
      reps_completed: actualReps ? parseInt(actualReps) : null,
      is_warmup: isWarmupRow, completed: newDone,
    }
    if (existingLog) {
      await supabase.from('set_logs').update(payload).eq('id', existingLog.id)
    } else {
      await supabase.from('set_logs').insert(payload)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem 1rem', background: done ? '#F0FDF4' : '#FAFBFC', borderRadius: 10, marginBottom: 6, border: `1.5px solid ${done ? '#86EFAC' : C.grayLight}`, transition: 'all 0.2s', fontFamily: sans }}>
      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: done ? C.green : C.gold, minWidth: 28, fontFamily: mono }}>
        {isWarmupRow ? 'Rozg' : `S${setNum}`}
      </span>
      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.navy, minWidth: 36 }}>{reps}</span>
      <div style={{ flex: 1 }}>
        <input type="number" inputMode="decimal" placeholder="kg" value={weight} onChange={e => setWeight(e.target.value)}
          style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.9rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center' }} />
        {prevWeight && !weight && (
          <div style={{ fontSize: '0.62rem', color: C.gray, textAlign: 'center', marginTop: 2 }}>poprzednio: {prevWeight} kg</div>
        )}
      </div>
      {isAmrap && (
        <input type="number" inputMode="numeric" placeholder="powt." value={actualReps} onChange={e => setActualReps(e.target.value)}
          style={{ width: 60, padding: '0.4rem 0.5rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.9rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center' }} />
      )}
      <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: 8, background: done ? C.green : C.grayLight, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
        {done && <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 800 }}>✓</span>}
      </button>
    </div>
  )
}

// ─── WELLNESS EXPANDED ────────────────────────────────────────────────────────

function WellnessExpanded({ sessionId, athleteId, existingWellness, onSaved }: {
  sessionId: number; athleteId: number; existingWellness: WellnessLog | null; onSaved: () => void
}) {
  const supabase = createClient()
  const fields = [
    { key: 'sleep_hours', label: 'Sen', min: 3, max: 12, step: 0.5, unit: 'h' },
    { key: 'sleep_quality', label: 'Jakość snu', min: 1, max: 5, step: 1, unit: '/5' },
    { key: 'energy', label: 'Energia', min: 1, max: 5, step: 1, unit: '/5' },
    { key: 'stress', label: 'Stres', min: 1, max: 5, step: 1, unit: '/5' },
    { key: 'mood', label: 'Nastrój', min: 1, max: 5, step: 1, unit: '/5' },
    { key: 'muscle_sorness', label: 'Zakwasy', min: 1, max: 5, step: 1, unit: '/5' },
    { key: 'readiness', label: 'Gotowość', min: 1, max: 5, step: 1, unit: '/5' },
  ]
  const [vals, setVals] = useState<Record<string, number>>({
    sleep_hours: existingWellness?.sleep_hours || 7,
    sleep_quality: existingWellness?.sleep_quality || 3,
    energy: existingWellness?.energy || 3,
    stress: existingWellness?.stress || 2,
    mood: existingWellness?.mood || 3,
    muscle_sorness: existingWellness?.muscle_sorness || 1,
    readiness: existingWellness?.readiness || 3,
  })
  const [concerns, setConcerns] = useState(existingWellness?.concerns || '')
  const [saved, setSaved] = useState(!!existingWellness)

  async function save() {
    const payload = { athlete_id: athleteId, workout_session_id: sessionId, session_id: sessionId, ...vals, concerns }
    if (existingWellness) {
      await supabase.from('wellness_logs').update(payload).eq('id', existingWellness.id)
    } else {
      await supabase.from('wellness_logs').insert(payload)
    }
    setSaved(true)
    onSaved()
  }

  return (
    <div style={{ padding: '0 1rem 1rem', fontFamily: sans }}>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.navy }}>{f.label}</span>
            <span style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 700, color: C.gold }}>{vals[f.key]}{f.unit}</span>
          </div>
          <input type="range" min={f.min} max={f.max} step={f.step} value={vals[f.key]}
            onChange={e => setVals(v => ({ ...v, [f.key]: parseFloat(e.target.value) }))}
            style={{ width: '100%', accentColor: C.gold }} />
        </div>
      ))}
      <textarea placeholder="Uwagi dla trenera..." value={concerns} onChange={e => setConcerns(e.target.value)} rows={2}
        style={{ width: '100%', padding: '0.625rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
      <button onClick={save} style={{ width: '100%', padding: '0.75rem', background: saved ? C.green : C.navy, color: saved ? '#fff' : C.gold, border: 'none', borderRadius: 10, fontFamily: sans, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
        {saved ? '✓ Zapisano' : 'Zapisz wellness'}
      </button>
    </div>
  )
}

// ─── EXERCISE CARD ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, sessionId, athleteId, setLogs, onSetsChange, prevWeight }: {
  exercise: TrainingExercise; sessionId: number; athleteId: number
  setLogs: SetLog[]; onSetsChange: (delta: number) => void; prevWeight?: number | null
}) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [tempoOpen, setTempoOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [feelingOpen, setFeelingOpen] = useState(false)
  const [rirOpen, setRirOpen] = useState(false)
  const [vas, setVas] = useState(0)
  const [painNote, setPainNote] = useState('')
  const [painSaved, setPainSaved] = useState(false)
  const [exerciseNote, setExerciseNote] = useState('')

  const effectiveSets = exercise.override?.sets_override || exercise.sets
  const effectiveReps = exercise.override?.reps_override || exercise.reps || '—'
  const effectiveTempo = exercise.override?.tempo_override || exercise.tempo
  const effectiveTempoNote = exercise.override?.coach_note_override || exercise.coach_comment

  const warmupSets: TrainingWarmupSet[] = Array.isArray(exercise.warmup_sets) ? exercise.warmup_sets : []
  const legacyWarmupSets: TrainingWarmupSet[] = !warmupSets.length && exercise.warmup_reps
    ? [{ reps: exercise.warmup_reps, weight_kg: exercise.warmup_weight }]
    : []
  const visibleWarmupSets = warmupSets.length ? warmupSets : legacyWarmupSets

  const exSetLogs = setLogs.filter(l => l.block_exercise_id === exercise.id)
  const completedSets = exSetLogs.filter(l => l.completed && !l.is_warmup).length
  const allDone = completedSets >= effectiveSets
  const isAmrap = typeof effectiveReps === 'string' && effectiveReps.toUpperCase() === 'AMRAP'
  const exerciseName = formatExerciseName(exercise.exercise?.name || exercise.exercise_code || 'Ćwiczenie')

  async function savePain() {
    await supabase.from('pain_logs').insert({
      workout_session_id: sessionId, athlete_id: athleteId,
      vas_score: vas, description: painNote,
      location: exerciseName,
    })
    setPainSaved(true)
  }

  return (
    <>
      {tempoOpen && effectiveTempo && <TempoModal tempo={effectiveTempo} note={effectiveTempoNote || undefined} onClose={() => setTempoOpen(false)} />}
      {videoOpen && <VideoModal exerciseName={exerciseName} onClose={() => setVideoOpen(false)} />}
      {rirOpen && exercise.rir != null && <RirModal rir={exercise.rir} onClose={() => setRirOpen(false)} />}

      <div style={{ background: '#fff', borderRadius: 14, border: allDone ? '1.5px solid #86EFAC' : `1.5px solid ${C.grayLight}`, marginBottom: 10, overflow: 'hidden', boxShadow: expanded ? '0 4px 20px rgba(13,27,42,0.08)' : 'none', transition: 'all 0.2s', fontFamily: sans }}>

        {/* Nagłówek */}
        <div onClick={() => setExpanded(!expanded)} style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: C.navyLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: '0.7rem', color: C.gold, fontFamily: mono }}>{exercise.exercise_order ? `${String.fromCharCode(64 + Math.ceil(exercise.exercise_order / 10))}${exercise.exercise_order}` : '—'}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: C.navy, marginBottom: 4 }}>{exerciseName}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {(effectiveTempo || effectiveTempoNote) && (
                <button onClick={e => { e.stopPropagation(); setTempoOpen(true) }}
                  style={{ padding: '2px 8px', background: C.navyLight, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: mono, fontWeight: 700, fontSize: '0.68rem', color: C.gold }}>
                  {effectiveTempo || 'wolno'}
                </button>
              )}
              <span style={{ padding: '2px 8px', background: C.grayLight, borderRadius: 6, fontSize: '0.7rem', color: C.gray, fontWeight: 500 }}>
                {effectiveSets}×{effectiveReps}
              </span>
              {exercise.rir != null && (
                <button onClick={e => { e.stopPropagation(); setRirOpen(true) }}
                  style={{ padding: '2px 8px', background: C.navyLight, border: 'none', borderRadius: 6, fontSize: '0.68rem', color: C.gold, fontWeight: 700, cursor: 'pointer', fontFamily: mono }}>
                  RIR {exercise.rir} ❓
                </button>
              )}
            </div>
          </div>

          {/* Video icon */}
          <button onClick={e => { e.stopPropagation(); setVideoOpen(true) }}
            style={{ width: 32, height: 32, borderRadius: 8, background: C.grayLight, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="Film instruktażowy">
            <span style={{ fontSize: '0.85rem' }}>▶️</span>
          </button>

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
              <p style={{ fontSize: '0.83rem', color: C.gray, marginBottom: '0.875rem', lineHeight: 1.55, paddingTop: '0.5rem', borderTop: '1px solid #F0F4F8' }}>
                💬 {effectiveTempoNote || exercise.coach_comment}
              </p>
            )}

            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: mono }}>Serie</div>

            {visibleWarmupSets.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 700, color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.35rem', fontFamily: mono }}>Rozgrzewka</div>
                {visibleWarmupSets.map((warmup, index) => (
                  <SetRow
                    key={`warmup-${index}`}
                    setNum={index + 1}
                    reps={`${warmup.reps || '-'}${warmup.weight_kg ? ` / ${warmup.weight_kg} kg` : ''}${warmup.note ? ` / ${warmup.note}` : ''}`}
                    isAmrap={false}
                    prevWeight={null}
                    existingLog={exSetLogs.find(l => l.set_number === index + 1 && l.is_warmup)}
                    sessionId={sessionId}
                    athleteId={athleteId}
                    blockExerciseId={exercise.id}
                    isWarmupRow
                    onComplete={() => undefined}
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
                isWarmupRow={false}
                onComplete={done => onSetsChange(done ? 1 : -1)}
              />
            ))}

            {/* Notatki */}
            <div style={{ marginTop: 10, marginBottom: 8 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5, fontFamily: mono }}>Twoje notatki</div>
              <textarea placeholder="Jak poszło? Uwagi do następnego razu..." value={exerciseNote} onChange={e => setExerciseNote(e.target.value)} rows={2}
                style={{ width: '100%', padding: '0.625rem', border: '1.5px solid #E0E8F0', borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', background: '#FAFBFC', boxSizing: 'border-box' }} />
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

// ─── POST WORKOUT ─────────────────────────────────────────────────────────────

function PostWorkoutSection({ sessionId, athleteId, onFinish }: { sessionId: number; athleteId: number; onFinish: () => void }) {
  const supabase = createClient()
  const router = useRouter()
  const [rpe, setRpe] = useState(6)
  const [feeling, setFeeling] = useState('')
  const [whatWell, setWhatWell] = useState('')
  const [pain, setPain] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  async function finish(sendReport: boolean) {
    if (!feeling && sendReport) return
    setSaving(true)

    try {
      // 1. Zapisz feedback
      await supabase.from('post_session_feedback').insert({
        session_id: sessionId,
        workout_session_id: sessionId,
        athlete_id: athleteId,
        session_rpe: rpe,
        feeling_after: feeling,
        what_went_well: whatWell,
        pain_after_comment: pain,
        general_notes: notes,
      })

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
    setSent(true)
    setTimeout(() => router.push('/athlete'), 2000)
  }

  if (sent) return (
    <div style={{ padding: '1.5rem 1rem', textAlign: 'center', fontFamily: sans }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: '1rem' }}>Trening zapisany!</div>
      <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: 4 }}>Wracam do panelu...</div>
    </div>
  )

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => finish(true)} disabled={saving || !feeling}
          style={{ width: '100%', padding: '0.875rem', background: !feeling ? C.grayLight : C.navy, color: !feeling ? C.gray : C.gold, border: 'none', borderRadius: 10, fontFamily: sans, fontWeight: 700, fontSize: '0.9rem', cursor: !feeling ? 'default' : 'pointer' }}>
          {saving ? 'Wysyłam raport...' : !feeling ? 'Wybierz samopoczucie ↑' : 'Zakończ i wyślij raport do trenera 🏁'}
        </button>
        <button onClick={() => finish(false)} disabled={saving}
          style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: C.gray, border: `1.5px solid ${C.grayLight}`, borderRadius: 10, fontFamily: sans, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
          Zapisz bez wysyłania raportu
        </button>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function TrainingClient({ athlete, trainingView, existingSetLogs, existingWellness }: Props) {
  const router = useRouter()
  const { session, day, blocks, plan, week } = trainingView
  const [setLogs, setSetLogs] = useState<SetLog[]>(existingSetLogs)
  const [wellnessSaved, setWellnessSaved] = useState(!!existingWellness)
  const [wellnessOpen, setWellnessOpen] = useState(!existingWellness)
  const [postOpen, setPostOpen] = useState(false)
  const [savedLocal, setSavedLocal] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)

  const supabase = createClient()

  const totalSets = blocks.reduce((sum, b) => sum + (b.exercises || []).reduce((s: number, e: WorkoutBlockExercise) => s + (e.override?.sets_override || e.sets), 0), 0)
  const doneSets = setLogs.filter(l => l.completed && !l.is_warmup).length
  const progress = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0

  const handleSetsChange = useCallback((delta: number) => {
    // Odświeżamy licznik przez re-fetch lub lokalnie
  }, [])

  async function saveLocal() {
    setSavedLocal(true)
    setTimeout(() => setSavedLocal(false), 3000)
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button onClick={() => router.push('/athlete')} style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                <img src="/level up.jpg" alt="Level Up" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
              <button
                onClick={() => router.push('/athlete')}
                style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 10, padding: '0.58rem 0.75rem', fontSize: '0.78rem', fontWeight: 800 }}
              >
                Powrot
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: '0.875rem', position: 'relative' }}>
            <div style={{ background: C.gold, borderRadius: 20, padding: '4px 12px', flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: '0.72rem', color: C.navy, letterSpacing: '0.06em', fontFamily: mono }}>
                {plan?.name?.split('—')[0]?.trim() || 'PLAN'} · TYD {week?.week_number || '1'}
              </span>
            </div>
            <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: '0.78rem', fontWeight: 700, color: C.white, textAlign: 'center', width: `min(60vw, ${contentMaxWidth}px)` }}>{plan?.name || day.day_name}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
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
                {doneSets}/{totalSets} serii · {progress}%
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

          {/* Wellness */}
          <div style={{ background: '#fff', borderRadius: 14, marginBottom: '1rem', border: `1.5px solid ${C.grayLight}`, overflow: 'hidden', boxShadow: wellnessOpen ? '0 4px 20px rgba(13,27,42,0.08)' : 'none' }}>
            <button onClick={() => setWellnessOpen(!wellnessOpen)} style={{ width: '100%', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: sans }}>
              <span style={{ fontSize: '1.2rem' }}>☀️</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>Wellness przed treningiem</div>
                <div style={{ fontSize: '0.75rem', color: C.gray }}>{wellnessSaved ? '✓ Zapisano' : 'Jak się dziś czujesz?'}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: C.gray, fontSize: '0.75rem', transform: wellnessOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            {wellnessOpen && session && (
              <WellnessExpanded sessionId={session.id} athleteId={athlete.id} existingWellness={existingWellness} onSaved={() => { setWellnessSaved(true); setWellnessOpen(false) }} />
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
                />
              ))}
            </div>
          ))}

          {/* Podsumowanie */}
          <div style={{ background: '#fff', borderRadius: 14, marginTop: '1rem', border: `1.5px solid ${C.grayLight}`, overflow: 'hidden', boxShadow: postOpen ? '0 4px 20px rgba(13,27,42,0.08)' : 'none' }}>
            <button onClick={() => setPostOpen(!postOpen)} style={{ width: '100%', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: sans }}>
              <span style={{ fontSize: '1.2rem' }}>🏁</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>Podsumowanie treningu</div>
                <div style={{ fontSize: '0.75rem', color: C.gray }}>RPE, samopoczucie, raport do trenera</div>
              </div>
              <span style={{ marginLeft: 'auto', color: C.gray, fontSize: '0.75rem', transform: postOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            {postOpen && session && (
              <PostWorkoutSection sessionId={session.id} athleteId={athlete.id} onFinish={() => router.push('/athlete')} />
            )}
          </div>
        </div>
        </div>

        {/* ── BOTTOM BUTTONS ── */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1.5px solid ${C.grayLight}`, padding: '0.875rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => router.push('/athlete')}
              style={{ flex: 1, padding: '0.875rem 0.75rem', background: C.white, color: C.navy, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, fontFamily: sans, fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', lineHeight: 1.3, textAlign: 'center' }}>
              Powrot do panelu
            </button>
            <button onClick={saveLocal}
              style={{ flex: 1, padding: '0.875rem 0.75rem', background: savedLocal ? '#F0FDF4' : '#F4F6F9', color: savedLocal ? C.green : C.navy, border: savedLocal ? '1.5px solid #86EFAC' : `1.5px solid ${C.grayLight}`, borderRadius: 12, fontFamily: sans, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', lineHeight: 1.3, textAlign: 'center' }}>
              {savedLocal ? '✓ Zapisano' : '💾 Zapisz trening'}
              {!savedLocal && <div style={{ fontSize: '0.68rem', fontWeight: 400, color: C.gray, marginTop: 2 }}>bez raportu</div>}
            </button>
            <button onClick={() => setPostOpen(true)}
              style={{ flex: 2, padding: '0.875rem 0.75rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontFamily: sans, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', lineHeight: 1.3, textAlign: 'center' }}>
              Zakończ trening
              <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#8A9BB0', marginTop: 2 }}>wyślij raport do trenera</div>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
