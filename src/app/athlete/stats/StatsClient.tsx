'use client'
// src/app/athlete/stats/StatsClient.tsx

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Athlete, SetLog } from '@/types/workout'

type WellnessLog = {
  id: number; created_at?: string; date?: string
  sleep_hours?: number | null; sleep_quality?: number | null; energy?: number | null
  stress?: number | null; mood?: number | null; muscle_sorness?: number | null
  readiness?: number | null; resting_hr?: number | null
}
type Feedback = {
  id: number; created_at?: string; workout_session_id?: number | null
  session_id?: number | null; session_rpe?: number | null; feeling_after?: string | null
}
type PainLog = { id: number; created_at?: string; vas_score?: number | null; location?: string | null; description?: string | null }
type SessionSummary = { id: number; date_started?: string | null; date_completed?: string | null; completed: boolean; workout_day?: any }

interface Props {
  athlete: Athlete
  wellnessLogs: WellnessLog[]
  feedbacks: Feedback[]
  painLogs: PainLog[]
  setLogs: SetLog[]
  sessions: SessionSummary[]
  dietLogs: any[]
}

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E',
  red: '#EF4444', orange: '#F97316', blue: '#3B82F6',
  purple: '#A855F7', teal: '#14B8A6',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"
const trainerName = 'Urszula Papka'

function avg(values: Array<number | null | undefined>) {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}
function fmtNumber(value: number | null, digits = 1) {
  return value === null ? '—' : value.toLocaleString('pl-PL', { maximumFractionDigits: digits })
}
function fmtKg(value: number) { return `${Math.round(value).toLocaleString('pl-PL')} kg` }
function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}
function painColor(value: number | null) {
  if (value === null) return C.gray
  return value >= 7 ? C.red : value >= 4 ? C.orange : C.green
}
function rpeColor(rpe: number) {
  return rpe >= 9 ? C.red : rpe >= 7 ? C.orange : rpe >= 5 ? C.gold : C.green
}

function dedupeSetLogs(logs: SetLog[]) {
  const byKey = new Map<string, SetLog>()
  for (const log of logs || []) {
    if (!log.workout_session_id || !log.block_exercise_id) continue
    const key = `${log.workout_session_id}:${log.block_exercise_id}:${log.set_number}:${log.is_warmup ? 'w' : 'm'}`
    const existing = byKey.get(key)
    const logTime = new Date(log.created_at || 0).getTime()
    const existingTime = new Date(existing?.created_at || 0).getTime()
    if (!existing || logTime >= existingTime || log.id > existing.id) byKey.set(key, log)
  }
  return Array.from(byKey.values())
}

// Multi-line chart
function MultiLineChart({ series, height = 160, yLabel }: { series: { label: string; color: string; data: { date: string; value: number }[] }[]; height?: number; yLabel?: string }) {
  if (!series.length) return null
  const allDates = Array.from(new Set(series.flatMap(s => s.data.map(d => d.date)))).sort()
  if (allDates.length < 2) return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>Za mało danych do wykresu</div>
  )
  const allVals = series.flatMap(s => s.data.map(d => d.value))
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const range = maxV - minV || 1
  const w = 320; const h = height - 24

  function toPath(points: { date: string; value: number }[]) {
    return points.map(p => {
      const xi = allDates.indexOf(p.date)
      const x = (xi / (allDates.length - 1)) * w
      const y = h - ((p.value - minV) / range) * (h - 10) - 5
      return `${x},${y}`
    }).join(' ')
  }

  const labelIdxs = allDates.length <= 6
    ? allDates.map((_, i) => i)
    : [0, Math.floor(allDates.length / 3), Math.floor(allDates.length * 2 / 3), allDates.length - 1]

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h + 24}`} style={{ width: '100%', minWidth: 240 }} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = h - t * (h - 10) - 5
          const val = minV + t * range
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={w} y2={y} stroke={C.grayLight} strokeWidth="1" />
              <text x={2} y={y - 2} fontSize="7" fill={C.gray} fontFamily={mono}>{val.toFixed(1)}</text>
            </g>
          )
        })}
        {series.map(s => (
          <polyline key={s.label} points={toPath(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map(s => s.data.map(p => {
          const xi = allDates.indexOf(p.date)
          const x = (xi / (allDates.length - 1)) * w
          const y = h - ((p.value - minV) / range) * (h - 10) - 5
          return <circle key={`${s.label}-${p.date}`} cx={x} cy={y} r="3.5" fill={s.color} stroke={C.white} strokeWidth="1.5" />
        }))}
        {labelIdxs.map(i => {
          const d = allDates[i]
          const x = (i / (allDates.length - 1)) * w
          const label = new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
          return <text key={d} x={x} y={h + 18} textAnchor="middle" fontSize="8" fill={C.gray} fontFamily={mono}>{label}</text>
        })}
      </svg>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>
      {children}
    </div>
  )
}

function StatCard({ label, value, hint, tone = 'navy' }: { label: string; value: string; hint: string; tone?: 'navy' | 'gold' | 'green' | 'red' | 'blue' }) {
  const color = tone === 'gold' ? C.gold : tone === 'green' ? C.green : tone === 'red' ? C.red : tone === 'blue' ? C.blue : C.navy
  return (
    <Card>
      <div style={{ padding: '0.875rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
        <div style={{ fontFamily: mono, fontSize: '1.45rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ color: C.gray, fontSize: '0.74rem', marginTop: 5 }}>{hint}</div>
      </div>
    </Card>
  )
}

function MetricRow({ label, value, max = 10, lowerIsBetter = false }: { label: string; value: number | null; max?: number; lowerIsBetter?: boolean }) {
  const pct = value === null ? 0 : Math.min(100, Math.round((value / max) * 100))
  const color = value === null
    ? C.gray
    : lowerIsBetter
      ? value >= max * 0.7 ? C.red : value >= max * 0.45 ? C.orange : C.green
      : value >= max * 0.7 ? C.green : value >= max * 0.45 ? C.gold : C.orange
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: C.navy }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 800, color }}>{value === null ? '—' : fmtNumber(value)}</span>
      </div>
      <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

// Exercise progress chart
function ExerciseProgress({ setLogs, sessions }: { setLogs: SetLog[]; sessions: SessionSummary[] }) {
  const uniqueLogs = dedupeSetLogs(setLogs)

  // Group by exercise
  const exerciseMap = new Map<string, { name: string; code: string; logs: SetLog[] }>()
  for (const log of uniqueLogs) {
    if (log.is_warmup || !log.completed) continue
    const ex = (log as any).block_exercise?.exercise
    if (!ex) continue
    const name = ex.name || (log as any).block_exercise?.exercise_code || 'Ćwiczenie'
    const code = (log as any).block_exercise?.exercise_id || name
    if (!exerciseMap.has(code)) exerciseMap.set(code, { name, code, logs: [] })
    exerciseMap.get(code)!.logs.push(log)
  }

  const exercises = Array.from(exerciseMap.values())
    .filter(e => e.logs.length >= 2)
    .sort((a, b) => b.logs.length - a.logs.length)

  const [selectedEx, setSelectedEx] = useState(exercises[0]?.code || '')
  const [metric, setMetric] = useState<'weight'|'reps'|'tonnage'>('weight')

  const selected = exerciseMap.get(selectedEx)

  const chartSeries = useMemo(() => {
    if (!selected) return []
    // Group by session → take best set per session
    const bySession = new Map<number, SetLog[]>()
    for (const log of selected.logs) {
      if (!log.workout_session_id) continue
      if (!bySession.has(log.workout_session_id)) bySession.set(log.workout_session_id, [])
      bySession.get(log.workout_session_id)!.push(log)
    }
    const points: { date: string; value: number }[] = []
    for (const [sid, logs] of bySession) {
      const session = sessions.find(s => s.id === sid)
      const date = session?.date_completed?.split('T')[0] || session?.date_started?.split('T')[0]
      if (!date) continue
      let val: number
      if (metric === 'weight') val = Math.max(...logs.map(l => l.weight || 0))
      else if (metric === 'reps') val = Math.max(...logs.map(l => l.reps_completed || 0))
      else val = logs.reduce((sum, l) => sum + (l.weight || 0) * (l.reps_completed || 0), 0)
      if (val > 0) points.push({ date, value: val })
    }
    return [{ label: metric === 'weight' ? 'Max ciężar (kg)' : metric === 'reps' ? 'Max powtórzenia' : 'Tonnage (kg)', color: C.blue, data: points.sort((a, b) => a.date.localeCompare(b.date)) }]
  }, [selected, metric, sessions])

  if (exercises.length === 0) return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>
      Brak wystarczających danych ćwiczeń (min. 2 sesje z tym samym ćwiczeniem)
    </div>
  )

  return (
    <div>
      {/* Exercise selector */}
      <div style={{ marginBottom: '0.875rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
          {exercises.slice(0, 12).map(e => (
            <button key={e.code} onClick={() => setSelectedEx(e.code)}
              style={{ flex: '0 0 auto', padding: '0.4rem 0.75rem', border: `1.5px solid ${selectedEx === e.code ? C.navy : C.grayLight}`, borderRadius: 8, background: selectedEx === e.code ? C.navy : C.white, color: selectedEx === e.code ? C.gold : C.gray, fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
              {e.name}
            </button>
          ))}
        </div>
      </div>

      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '0.875rem', background: C.offWhite, borderRadius: 10, padding: 3 }}>
        {([['weight', 'Ciężar'], ['reps', 'Powtórzenia'], ['tonnage', 'Tonnage']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setMetric(v)}
            style={{ flex: 1, padding: '0.4rem', border: 'none', borderRadius: 8, background: metric === v ? C.navy : 'transparent', color: metric === v ? C.white : C.gray, fontWeight: 700, fontSize: '0.7rem' }}>
            {l}
          </button>
        ))}
      </div>

      {selected && (
        <div>
          <div style={{ fontWeight: 800, color: C.navy, fontSize: '0.9rem', marginBottom: 4 }}>{selected.name}</div>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, marginBottom: '0.875rem' }}>{selected.logs.length} serii · {chartSeries[0]?.data.length || 0} sesji</div>
          <MultiLineChart series={chartSeries} height={180} />

          {/* Stats for this exercise */}
          {chartSeries[0]?.data.length > 0 && (() => {
            const vals = chartSeries[0].data.map(d => d.value)
            const first = vals[0]; const last = vals[vals.length - 1]
            const best = Math.max(...vals)
            const diff = last - first
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: '0.875rem' }}>
                {[
                  { label: 'Najlepszy', val: metric === 'weight' || metric === 'tonnage' ? `${best.toFixed(1)} kg` : String(Math.round(best)), color: C.gold },
                  { label: 'Ostatni', val: metric === 'weight' || metric === 'tonnage' ? `${last.toFixed(1)} kg` : String(Math.round(last)), color: C.navy },
                  { label: 'Zmiana', val: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}${metric === 'reps' ? '' : ' kg'}`, color: diff >= 0 ? C.green : C.red },
                ].map(s => (
                  <div key={s.label} style={{ background: C.offWhite, borderRadius: 10, padding: '0.625rem', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontFamily: mono, fontWeight: 900, color: s.color, fontSize: '1rem' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// Training load over time
function LoadChart({ sessions, feedbacks }: { sessions: SessionSummary[]; feedbacks: Feedback[] }) {
  const fbById: Record<number, Feedback> = {}
  for (const f of feedbacks) {
    const id = f.workout_session_id || f.session_id
    if (id) fbById[id] = f
  }

  const data = sessions
    .filter(s => s.date_completed)
    .map(s => {
      const fb = fbById[s.id]
      return { date: s.date_completed!.split('T')[0], rpe: fb?.session_rpe || null }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const series = [
    ...(data.some(d => d.rpe != null) ? [{ label: 'RPE sesji', color: C.orange, data: data.flatMap(d => d.rpe != null ? [{ date: d.date, value: d.rpe }] : []) }] : []),
  ]

  // Weekly volume
  const weekVolume: Record<string, number> = {}
  for (const s of sessions) {
    const d = s.date_completed
    if (!d) continue
    const dt = new Date(d)
    const monday = new Date(dt)
    monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
    const wk = monday.toISOString().split('T')[0]
    weekVolume[wk] = (weekVolume[wk] || 0) + 1
  }
  const weekSeries = [{ label: 'Treningi/tydzień', color: C.blue, data: Object.entries(weekVolume).sort((a,b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ date: d, value: v })) }]

  return (
    <div>
      {series.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>RPE w czasie</div>
          <MultiLineChart series={series} height={160} />
        </div>
      )}
      {weekSeries[0].data.length > 1 && (
        <div>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Liczba treningów / tydzień</div>
          <MultiLineChart series={weekSeries} height={140} />
        </div>
      )}
    </div>
  )
}

export default function StatsClient({ athlete, wellnessLogs, feedbacks, painLogs, setLogs, sessions, dietLogs }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'ogolne'|'cwiczenia'|'obciazenie'|'wellness'>('ogolne')

  const uniqueSetLogs = dedupeSetLogs(setLogs)
  const avgSleep = avg(wellnessLogs.map(w => w.sleep_hours))
  const avgSleepQuality = avg(wellnessLogs.map(w => w.sleep_quality))
  const avgEnergy = avg(wellnessLogs.map(w => w.energy))
  const avgStress = avg(wellnessLogs.map(w => w.stress))
  const avgReadiness = avg(wellnessLogs.map(w => w.readiness))
  const avgRpe = avg(feedbacks.map(f => f.session_rpe))
  const highRpeCount = feedbacks.filter(f => (f.session_rpe || 0) >= 8).length
  const avgPain = avg(painLogs.map(p => p.vas_score))
  const highPainCount = painLogs.filter(p => (p.vas_score || 0) >= 7).length

  const workSets = uniqueSetLogs.filter(set => set.completed && !set.is_warmup && (set.weight || 0) > 0 && (set.reps_completed || 0) > 0)
  const tonnage = workSets.reduce((sum, set) => sum + (set.weight || 0) * (set.reps_completed || 0), 0)
  const totalReps = uniqueSetLogs.filter(s => s.completed && !s.is_warmup && (s.reps_completed || 0) > 0).reduce((sum, s) => sum + (s.reps_completed || 0), 0)

  const tonnageBySession = new Map<number, number>()
  for (const set of workSets) {
    if (!set.workout_session_id) continue
    tonnageBySession.set(set.workout_session_id, (tonnageBySession.get(set.workout_session_id) || 0) + (set.weight || 0) * (set.reps_completed || 0))
  }
  const biggestSession = [...tonnageBySession.entries()].sort((a, b) => b[1] - a[1])[0]
  const biggestSessionDate = biggestSession
    ? sessions.find(s => s.id === biggestSession[0])?.date_completed || sessions.find(s => s.id === biggestSession[0])?.date_started
    : null
  const avgTonnagePerSession = tonnageBySession.size > 0 ? tonnage / tonnageBySession.size : 0
  const latestPain = painLogs[0]

  const TABS = [
    { id: 'ogolne', label: '📋 Ogólne' },
    { id: 'cwiczenia', label: '🏋️ Ćwiczenia' },
    { id: 'obciazenie', label: '📈 Obciążenie' },
    { id: 'wellness', label: '💚 Wellness' },
  ] as const

  const hasDiet = dietLogs.length > 0

  const wellnessChartData = useMemo(() => {
    const sorted = [...wellnessLogs].sort((a,b) => (a.date||a.created_at||'').localeCompare(b.date||b.created_at||''))
    function toPoints(fn: (w: WellnessLog) => number | null | undefined) {
      return sorted.flatMap(w => {
        const val = fn(w)
        const date = w.date || (w.created_at ? w.created_at.split('T')[0] : null)
        if (val == null || !date) return []
        return [{ date, value: val as number }]
      })
    }
    return {
      sleep: toPoints(w => w.sleep_hours),
      sleepQ: toPoints(w => w.sleep_quality),
      energy: toPoints(w => w.energy),
      stress: toPoints(w => w.stress),
      readiness: toPoints(w => w.readiness),
      soreness: toPoints(w => w.muscle_sorness),
      hr: toPoints(w => w.resting_hr),
    }
  }, [wellnessLogs])

  const dietChartData = useMemo(() => {
    const sorted = [...dietLogs].sort((a,b) => (a.date||'').localeCompare(b.date||''))
    return {
      water: sorted.flatMap(d => d.water_ml != null ? [{ date: d.date, value: d.water_ml / 1000 }] : []),
      coffee: sorted.flatMap(d => d.coffee_count != null ? [{ date: d.date, value: d.coffee_count }] : []),
    }
  }, [dietLogs])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <button onClick={() => router.push('/athlete')} style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: 'none', padding: 0 }}>
                <img src="/level up.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: C.white }}>{athlete.full_name}</div>
                <div style={{ fontSize: '0.7rem', color: C.gold, marginTop: 2 }}>Trener: {trainerName}</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: C.navyLight }}>
                <img src="/unique.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, background: C.white }} />
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ flex: '0 0 auto', padding: '0.6rem 0.875rem', border: 'none', borderRadius: '10px 10px 0 0', background: tab === t.id ? C.offWhite : 'transparent', color: tab === t.id ? C.navy : C.gray, fontWeight: tab === t.id ? 800 : 600, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 560, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>

          {/* ── OGÓLNE ── */}
          {tab === 'ogolne' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                <StatCard label="Sen" value={`${fmtNumber(avgSleep)}h`} hint="średnio" tone="blue" />
                <StatCard label="Gotowość" value={`${fmtNumber(avgReadiness)}/10`} hint="przed treningiem" tone="green" />
                <StatCard label="Średnie RPE" value={`${fmtNumber(avgRpe)}/10`} hint={`${highRpeCount} treningów 8+`} tone={avgRpe !== null && avgRpe >= 8 ? 'red' : 'navy'} />
                <StatCard label="Tonnage 90 dni" value={fmtKg(tonnage)} hint="bez rozgrzewki" tone="gold" />
              </div>

              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '1rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Regeneracja</div>
                  <MetricRow label="Jakość snu" value={avgSleepQuality} />
                  <MetricRow label="Energia" value={avgEnergy} />
                  <MetricRow label="Stres" value={avgStress} lowerIsBetter />
                  <MetricRow label="Gotowość" value={avgReadiness} />
                </div>
              </Card>

              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '1rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Obciążenie treningowe</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ color: C.gray, fontSize: '0.74rem', marginBottom: 4 }}>Powtórzenia</div>
                      <div style={{ fontFamily: mono, fontSize: '1.25rem', fontWeight: 800, color: C.navy }}>{totalReps.toLocaleString('pl-PL')}</div>
                    </div>
                    <div>
                      <div style={{ color: C.gray, fontSize: '0.74rem', marginBottom: 4 }}>Śr./trening</div>
                      <div style={{ fontFamily: mono, fontSize: '1.25rem', fontWeight: 800, color: C.navy }}>{fmtKg(avgTonnagePerSession)}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: `1.5px solid ${C.grayLight}` }}>
                      <div style={{ color: C.gray, fontSize: '0.74rem', marginBottom: 4 }}>Największy trening</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: mono, fontSize: '1.15rem', fontWeight: 800, color: C.gold }}>{biggestSession ? fmtKg(biggestSession[1]) : '—'}</span>
                        <span style={{ fontFamily: mono, color: C.gray, fontSize: '0.7rem' }}>{formatDate(biggestSessionDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '1rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Ból / dyskomfort</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: latestPain ? '0.875rem' : 0 }}>
                    <div>
                      <div style={{ color: C.gray, fontSize: '0.74rem', marginBottom: 4 }}>Średni VAS</div>
                      <div style={{ fontFamily: mono, fontSize: '1.25rem', fontWeight: 800, color: painColor(avgPain) }}>{avgPain === null ? '—' : `${fmtNumber(avgPain)}/10`}</div>
                    </div>
                    <div>
                      <div style={{ color: C.gray, fontSize: '0.74rem', marginBottom: 4 }}>Alerty VAS 7+</div>
                      <div style={{ fontFamily: mono, fontSize: '1.25rem', fontWeight: 800, color: highPainCount > 0 ? C.red : C.green }}>{highPainCount}</div>
                    </div>
                  </div>
                  {latestPain && (
                    <div style={{ background: C.offWhite, borderRadius: 10, padding: '0.75rem', border: `1.5px solid ${C.grayLight}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ fontSize: '0.86rem' }}>{latestPain.location || 'Ostatnie zgłoszenie'}</strong>
                        <span style={{ fontFamily: mono, fontWeight: 800, color: painColor(latestPain.vas_score || null) }}>VAS {latestPain.vas_score ?? '—'}</span>
                      </div>
                      {latestPain.description && <div style={{ color: C.gray, fontSize: '0.8rem', marginTop: 4 }}>{latestPain.description}</div>}
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <div style={{ padding: '1rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Nawigacja</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => router.push('/athlete')} style={{ padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, fontWeight: 700, fontSize: '0.82rem' }}>Panel</button>
                    <button onClick={() => router.push('/athlete/history')} style={{ padding: '0.75rem', borderRadius: 10, border: 'none', background: C.navy, color: C.gold, fontWeight: 800, fontSize: '0.82rem' }}>Historia</button>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* ── ĆWICZENIA ── */}
          {tab === 'cwiczenia' && (
            <Card>
              <div style={{ padding: '1rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>
                  Postępy ćwiczeń
                </div>
                <ExerciseProgress setLogs={setLogs} sessions={sessions} />
              </div>
            </Card>
          )}

          {/* ── OBCIĄŻENIE ── */}
          {tab === 'obciazenie' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                <StatCard label="Treningi 90d" value={String(sessions.length)} hint="sesji" tone="navy" />
                <StatCard label="Śr. RPE" value={`${fmtNumber(avgRpe)}/10`} hint="z feedbacków" tone={avgRpe !== null && avgRpe >= 8 ? 'red' : 'gold'} />
              </div>
              <Card>
                <div style={{ padding: '1rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>
                    Obciążenie w czasie
                  </div>
                  <LoadChart sessions={sessions} feedbacks={feedbacks} />
                </div>
              </Card>
            </>
          )}

          {/* ── WELLNESS ── */}
          {tab === 'wellness' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                <StatCard label="Sen" value={`${fmtNumber(avgSleep)}h`} hint="średnio" tone="blue" />
                <StatCard label="Gotowość" value={`${fmtNumber(avgReadiness)}/10`} hint="śr. gotowość" tone="green" />
              </div>

              {[
                {
                  title: 'Sen i regeneracja',
                  series: [
                    { label: 'Sen (h)', color: C.blue, data: wellnessChartData.sleep },
                    { label: 'Jakość snu', color: C.teal, data: wellnessChartData.sleepQ },
                    { label: 'Gotowość', color: C.green, data: wellnessChartData.readiness },
                  ].filter(s => s.data.length > 0),
                },
                {
                  title: 'Energia i stres',
                  series: [
                    { label: 'Energia', color: C.gold, data: wellnessChartData.energy },
                    { label: 'Stres', color: C.orange, data: wellnessChartData.stress },
                    { label: 'Zakwasy', color: C.purple, data: wellnessChartData.soreness },
                  ].filter(s => s.data.length > 0),
                },
                ...(wellnessChartData.hr.length > 0 ? [{
                  title: 'HR spoczynkowe',
                  series: [{ label: 'HR (bpm)', color: C.red, data: wellnessChartData.hr }],
                }] : []),
                ...(hasDiet ? [{
                  title: 'Nawodnienie i kawa',
                  series: [
                    ...(dietChartData.water.length > 0 ? [{ label: 'Woda (L)', color: C.blue, data: dietChartData.water }] : []),
                    ...(dietChartData.coffee.length > 0 ? [{ label: 'Kawa (filiż.)', color: '#6B3A2A', data: dietChartData.coffee }] : []),
                  ],
                }] : []),
              ].filter(g => g.series.length > 0).map(g => (
                <Card key={g.title} style={{ marginBottom: '1rem' }}>
                  <div style={{ padding: '1rem' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{g.title}</div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: '0.625rem', flexWrap: 'wrap' }}>
                      {g.series.map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 16, height: 3, background: s.color, borderRadius: 2 }} />
                          <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                    <MultiLineChart series={g.series} height={160} />
                  </div>
                </Card>
              ))}

              {wellnessLogs.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak danych wellness</div>
              )}
            </>
          )}

        </main>
      </div>
    </>
  )
}
