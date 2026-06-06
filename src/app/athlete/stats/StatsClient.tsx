'use client'
// src/app/athlete/stats/StatsClient.tsx

import { useRouter } from 'next/navigation'
import type { Athlete, SetLog } from '@/types/workout'

type WellnessLog = {
  id: number
  created_at?: string
  sleep_hours?: number | null
  sleep_quality?: number | null
  energy?: number | null
  stress?: number | null
  mood?: number | null
  muscle_sorness?: number | null
  readiness?: number | null
}

type Feedback = {
  id: number
  created_at?: string
  workout_session_id?: number | null
  session_id?: number | null
  session_rpe?: number | null
  feeling_after?: string | null
}

type PainLog = {
  id: number
  created_at?: string
  vas_score?: number | null
  location?: string | null
  description?: string | null
}

type SessionSummary = {
  id: number
  date_started?: string | null
  date_completed?: string | null
  completed: boolean
}

interface Props {
  athlete: Athlete
  wellnessLogs: WellnessLog[]
  feedbacks: Feedback[]
  painLogs: PainLog[]
  setLogs: SetLog[]
  sessions: SessionSummary[]
}

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
  orange: '#F97316',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"
const trainerName = 'Urszula Papka'

function avg(values: Array<number | null | undefined>) {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (nums.length === 0) return null
  return nums.reduce((sum, v) => sum + v, 0) / nums.length
}

function fmtNumber(value: number | null, digits = 1) {
  if (value === null) return '—'
  return value.toLocaleString('pl-PL', { maximumFractionDigits: digits })
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

function fmtKg(value: number) {
  return `${Math.round(value).toLocaleString('pl-PL')} kg`
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

function painColor(value: number | null) {
  if (value === null) return C.gray
  if (value >= 7) return C.red
  if (value >= 4) return C.orange
  return C.green
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${C.grayLight}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(13,27,42,0.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function StatCard({ label, value, hint, tone = 'navy' }: { label: string; value: string; hint: string; tone?: 'navy' | 'gold' | 'green' | 'red' }) {
  const color = tone === 'gold' ? C.gold : tone === 'green' ? C.green : tone === 'red' ? C.red : C.navy

  return (
    <Card>
      <div style={{ padding: '0.875rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
        <div style={{ fontFamily: mono, fontSize: '1.55rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ color: C.gray, fontSize: '0.76rem', marginTop: 5 }}>{hint}</div>
      </div>
    </Card>
  )
}

function MetricRow({ label, value, max = 5, lowerIsBetter = false }: { label: string; value: number | null; max?: number; lowerIsBetter?: boolean }) {
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

export default function StatsClient({ athlete, wellnessLogs, feedbacks, painLogs, setLogs, sessions }: Props) {
  const router = useRouter()
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
  const totalReps = uniqueSetLogs
    .filter(set => set.completed && !set.is_warmup && (set.reps_completed || 0) > 0)
    .reduce((sum, set) => sum + (set.reps_completed || 0), 0)

  const tonnageBySession = new Map<number, number>()
  for (const set of workSets) {
    if (!set.workout_session_id) continue
    tonnageBySession.set(
      set.workout_session_id,
      (tonnageBySession.get(set.workout_session_id) || 0) + (set.weight || 0) * (set.reps_completed || 0)
    )
  }
  const biggestSession = [...tonnageBySession.entries()].sort((a, b) => b[1] - a[1])[0]
  const biggestSessionDate = biggestSession
    ? sessions.find(session => session.id === biggestSession[0])?.date_completed
      || sessions.find(session => session.id === biggestSession[0])?.date_started
    : null
  const avgTonnagePerSession = tonnageBySession.size > 0 ? tonnage / tonnageBySession.size : 0
  const latestPain = painLogs[0]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.25rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', position: 'relative' }}>
            <button onClick={() => router.push('/athlete')} style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: 'none', padding: 0, flexShrink: 0 }}>
              <img src="/level up.jpg" alt="Level Up" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>

            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 'min(60vw, 520px)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: C.white }}>{athlete.full_name}</div>
              <div style={{ fontSize: '0.72rem', color: C.gold, marginTop: 2, fontWeight: 700 }}>Trener: {trainerName}</div>
            </div>

            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: C.navyLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/unique.png" alt="Unique" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, background: C.white }} />
            </div>
          </div>

          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <button onClick={() => router.push('/athlete')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← Panel
            </button>
            <h1 style={{ color: C.white, fontSize: '1.45rem', fontWeight: 800, marginTop: '1rem' }}>Statystyki</h1>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>Wellness, RPE, bol i tonaz z ostatnich wpisow.</p>
          </div>
        </header>

        <main style={{ maxWidth: 520, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
            <StatCard label="Sen" value={`${fmtNumber(avgSleep)}h`} hint="srednio" tone="gold" />
            <StatCard label="Gotowosc" value={`${fmtNumber(avgReadiness)}/5`} hint="przed treningiem" tone="green" />
            <StatCard label="Srednie RPE" value={`${fmtNumber(avgRpe)}/10`} hint={`${highRpeCount} treningow 8+`} tone={avgRpe !== null && avgRpe >= 8 ? 'red' : 'navy'} />
            <StatCard label="Tonaz 30 dni" value={fmtKg(tonnage)} hint="bez rozgrzewki" tone="gold" />
          </div>

          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Regeneracja</div>
              <MetricRow label="Jakosc snu" value={avgSleepQuality} />
              <MetricRow label="Energia" value={avgEnergy} />
              <MetricRow label="Stres" value={avgStress} lowerIsBetter />
              <MetricRow label="Gotowosc" value={avgReadiness} />
            </div>
          </Card>

          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Obciazenie treningowe</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ color: C.gray, fontSize: '0.76rem', marginBottom: 4 }}>Powtorzenia</div>
                  <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 800, color: C.navy }}>{totalReps.toLocaleString('pl-PL')}</div>
                </div>
                <div>
                  <div style={{ color: C.gray, fontSize: '0.76rem', marginBottom: 4 }}>Srednio / trening</div>
                  <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 800, color: C.navy }}>{fmtKg(avgTonnagePerSession)}</div>
                </div>
                <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: `1.5px solid ${C.grayLight}` }}>
                  <div style={{ color: C.gray, fontSize: '0.76rem', marginBottom: 4 }}>Najwiekszy trening</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: mono, fontSize: '1.2rem', fontWeight: 800, color: C.gold }}>{biggestSession ? fmtKg(biggestSession[1]) : '—'}</span>
                    <span style={{ fontFamily: mono, color: C.gray, fontSize: '0.72rem' }}>{formatDate(biggestSessionDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Bol / dyskomfort</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: latestPain ? '0.875rem' : 0 }}>
                <div>
                  <div style={{ color: C.gray, fontSize: '0.76rem', marginBottom: 4 }}>Sredni VAS</div>
                  <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 800, color: painColor(avgPain) }}>{avgPain === null ? '—' : `${fmtNumber(avgPain)}/10`}</div>
                </div>
                <div>
                  <div style={{ color: C.gray, fontSize: '0.76rem', marginBottom: 4 }}>Alerty VAS 7+</div>
                  <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 800, color: highPainCount > 0 ? C.red : C.green }}>{highPainCount}</div>
                </div>
              </div>
              {latestPain && (
                <div style={{ background: C.offWhite, borderRadius: 10, padding: '0.75rem', border: `1.5px solid ${C.grayLight}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: '0.86rem' }}>{latestPain.location || 'Ostatnie zgloszenie'}</strong>
                    <span style={{ fontFamily: mono, fontWeight: 800, color: painColor(latestPain.vas_score || null) }}>VAS {latestPain.vas_score ?? '—'}</span>
                  </div>
                  {latestPain.description && <div style={{ color: C.gray, fontSize: '0.82rem', marginTop: 4 }}>{latestPain.description}</div>}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Dane</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={() => router.push('/athlete')} style={{ padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, fontWeight: 700 }}>Panel</button>
                <button onClick={() => router.push('/athlete/history')} style={{ padding: '0.75rem', borderRadius: 10, border: 'none', background: C.navy, color: C.gold, fontWeight: 800 }}>Historia</button>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </>
  )
}
