'use client'
// src/app/athlete/history/HistoryClient.tsx

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Athlete, WorkoutSession } from '@/types/workout'

interface Props {
  athlete: Athlete
  history: WorkoutSession[]
  feedbacks: any[]
  wellnessLogs: any[]
  painLogs: any[]
  dietLogs: any[]
}

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E',
  blue: '#3B82F6', blueDark: '#1D4ED8', red: '#EF4444', orange: '#F97316',
  purple: '#A855F7', teal: '#14B8A6',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"
const trainerName = 'Urszula Papka'

const FEELING_LABELS: Record<string, string> = {
  swietnie: '💪 Świetnie', dobrze: '😊 Dobrze',
  srednie: '😐 Średnio', zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
}

function rpeColor(rpe: number) {
  return rpe >= 9 ? C.red : rpe >= 7 ? C.orange : rpe >= 5 ? C.gold : C.green
}
function rpeLabel(rpe: number) {
  return rpe <= 3 ? 'Lekki' : rpe <= 5 ? 'Umiarkowany' : rpe <= 7 ? 'Ciężki' : rpe <= 9 ? 'Bardzo ciężki' : 'Maksymalny'
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function isoKey(iso: string) { return dateKey(new Date(iso)) }

function buildCalendar(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth()+1, 0)
  const offset = (first.getDay()+6)%7
  const cells = Math.ceil((offset+last.getDate())/7)*7
  return Array.from({length: cells}, (_, i) => {
    const d = new Date(first)
    d.setDate(first.getDate()-offset+i)
    return d
  })
}

// Activity load color: based on hours and RPE
function activityLoadColor(hours: number, rpe: number | null): string {
  const h = Math.min(hours, 4)
  const r = rpe ?? 5
  const load = (h / 4) * 0.5 + (r / 10) * 0.5
  if (load < 0.2) return '#DBEAFE' // very light - light blue
  if (load < 0.4) return '#93C5FD' // light
  if (load < 0.6) return '#3B82F6' // moderate
  if (load < 0.8) return '#1D4ED8' // hard
  return '#1E3A8A'                  // very hard - dark blue
}

function activityLoadLabel(hours: number, rpe: number | null): string {
  const h = Math.min(hours, 4)
  const r = rpe ?? 5
  const load = (h / 4) * 0.5 + (r / 10) * 0.5
  if (load < 0.2) return 'Bardzo lekki'
  if (load < 0.4) return 'Lekki'
  if (load < 0.6) return 'Umiarkowany'
  if (load < 0.8) return 'Ciężki'
  return 'Bardzo ciężki'
}

// Wellness score → color for readiness
function wellnessColor(score: number): string {
  // score 0-10, higher = better readiness
  if (score >= 8) return '#22C55E'   // great
  if (score >= 6.5) return '#84CC16' // good
  if (score >= 5) return '#F5C842'   // ok
  if (score >= 3.5) return '#F97316' // below average
  return '#EF4444'                    // poor
}

function wellnessLabel(score: number): string {
  if (score >= 8) return 'Świetna gotowość'
  if (score >= 6.5) return 'Dobra gotowość'
  if (score >= 5) return 'Przeciętna'
  if (score >= 3.5) return 'Słaba regeneracja'
  return 'Zła gotowość'
}

function calcWellnessScore(w: any): number | null {
  if (!w) return null
  const items: number[] = []
  if (w.sleep_hours != null) items.push(Math.min(10, (w.sleep_hours / 9) * 10))
  if (w.sleep_quality != null) items.push(w.sleep_quality)
  if (w.readiness != null) items.push(w.readiness)
  if (w.stress != null) items.push(10 - w.stress) // invert stress
  if (w.energy != null) items.push(w.energy)
  if (w.muscle_sorness != null) items.push(10 - w.muscle_sorness) // invert soreness
  if (items.length === 0) return null
  return items.reduce((a, b) => a + b, 0) / items.length
}

// Simple SVG sparkline
function Sparkline({ data, color, width = 300, height = 60 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 8) - 4
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// Multi-line chart
function MultiLineChart({ series, height = 140 }: { series: { label: string; color: string; data: { date: string; value: number }[] }[]; height?: number }) {
  if (!series.length) return null
  const allDates = Array.from(new Set(series.flatMap(s => s.data.map(d => d.date)))).sort()
  if (allDates.length < 2) return null
  const allVals = series.flatMap(s => s.data.map(d => d.value))
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const range = max - min || 1
  const w = 300; const h = height - 20

  function toPath(points: { date: string; value: number }[]) {
    return points.map(p => {
      const xi = allDates.indexOf(p.date)
      const x = (xi / (allDates.length - 1)) * w
      const y = h - ((p.value - min) / range) * (h - 8) - 4
      return `${x},${y}`
    }).join(' ')
  }

  // x-axis labels: show first, mid, last
  const labelIdxs = allDates.length <= 7
    ? allDates.map((_, i) => i)
    : [0, Math.floor(allDates.length / 2), allDates.length - 1]

  return (
    <div style={{ overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${w} ${h + 20}`} style={{ width: '100%' }} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = h - t * (h - 8) - 4
          return <line key={t} x1={0} y1={y} x2={w} y2={y} stroke={C.grayLight} strokeWidth="1" />
        })}
        {series.map(s => (
          <polyline key={s.label} points={toPath(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* Dots for series with few points */}
        {series.map(s => s.data.map(p => {
          const xi = allDates.indexOf(p.date)
          const x = (xi / (allDates.length - 1)) * w
          const y = h - ((p.value - min) / range) * (h - 8) - 4
          return <circle key={`${s.label}-${p.date}`} cx={x} cy={y} r="3" fill={s.color} />
        }))}
        {/* X labels */}
        {labelIdxs.map(i => {
          const d = allDates[i]
          const x = (i / (allDates.length - 1)) * w
          const label = new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
          return <text key={d} x={x} y={h + 16} textAnchor="middle" fontSize="8" fill={C.gray} fontFamily={mono}>{label}</text>
        })}
      </svg>
    </div>
  )
}

export default function HistoryClient({ athlete, history, feedbacks, wellnessLogs, painLogs, dietLogs }: Props) {
  const router = useRouter()
  const today = new Date()
  const [tab, setTab] = useState<'historia'|'aktywnosc'|'wellness'|'postery'>('historia')
  const [month, setMonth] = useState(() => {
    const last = [...history].sort((a,b) => (b.date_completed||'').localeCompare(a.date_completed||''))[0]
    return last?.date_completed ? new Date(last.date_completed) : today
  })
  const [expandedKey, setExpandedKey] = useState<string|null>(null)
  const [actView, setActView] = useState<'calendar'|'chart'>('calendar')
  const [wellView, setWellView] = useState<'calendar'|'chart'>('calendar')

  // Mapa feedback po session_id
  const fbBySession: Record<number, any> = {}
  for (const f of feedbacks) {
    const sid = f.workout_session_id || f.session_id
    if (sid) fbBySession[sid] = f
  }

  // Mapa sesji po dacie
  const sessionsByDate: Record<string, WorkoutSession[]> = {}
  for (const s of history) {
    const k = s.date_completed ? isoKey(s.date_completed) : ''
    if (!k) continue
    if (!sessionsByDate[k]) sessionsByDate[k] = []
    sessionsByDate[k].push(s)
  }

  // Wellness po dacie
  const wellnessByDate: Record<string, any> = {}
  for (const w of wellnessLogs) {
    const d = w.date || (w.created_at ? isoKey(w.created_at) : null)
    if (d) wellnessByDate[d] = w
  }

  // Pain po dacie
  const painByDate: Record<string, any[]> = {}
  for (const p of painLogs) {
    const d = p.created_at ? isoKey(p.created_at) : null
    if (!d) continue
    if (!painByDate[d]) painByDate[d] = []
    painByDate[d].push(p)
  }

  // Diet po dacie
  const dietByDate: Record<string, any> = {}
  for (const d of dietLogs) {
    const k = d.date || (d.created_at ? isoKey(d.created_at) : null)
    if (k) dietByDate[k] = d
  }

  const hasDiet = dietLogs.length > 0

  const calDays = buildCalendar(month)
  const monthName = month.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
  const sorted = [...history].sort((a,b) => (b.date_completed||'').localeCompare(a.date_completed||''))
  const totalReports = history.filter(s => s.report_sent).length

  function prevMonth() { setMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1)); setExpandedKey(null) }
  function nextMonth() { setMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1)); setExpandedKey(null) }

  // Chart data for wellness
  const wellnessChartData = useMemo(() => {
    const sorted = [...wellnessLogs].sort((a,b) => (a.date||a.created_at||'').localeCompare(b.date||b.created_at||''))
    const toPoints = (fn: (w: any) => number | null | undefined) =>
      sorted.flatMap(w => {
        const val = fn(w)
        const date = w.date || (w.created_at ? isoKey(w.created_at) : null)
        if (val == null || !date) return []
        return [{ date, value: val as number }]
      })
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

  const TABS = [
    { id: 'historia', label: '📅 Historia' },
    { id: 'aktywnosc', label: '⚡ Aktywność' },
    { id: 'wellness', label: '💚 Wellness' },
    { id: 'postery', label: '📊 Postępy' },
  ] as const

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
        .day-btn:active { transform: scale(0.92); }
        .tab-btn { transition: all 0.15s; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>

        {/* Header */}
        <header style={{ background: C.navy, padding: '1rem 1.25rem 0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <button onClick={() => router.push('/athlete')} style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: 'none', padding: 0 }}>
                <img src="/level up.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: C.white }}>{athlete.full_name}</div>
                <div style={{ fontSize: '0.68rem', color: C.gold, marginTop: 1 }}>Trener: {trainerName}</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: C.navyLight }}>
                <img src="/unique.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, background: C.white }} />
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 0 }}>
              {TABS.map(t => (
                <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
                  style={{ flex: '0 0 auto', padding: '0.6rem 0.875rem', border: 'none', borderRadius: '10px 10px 0 0', background: tab === t.id ? C.offWhite : 'transparent', color: tab === t.id ? C.navy : C.gray, fontWeight: tab === t.id ? 800 : 600, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 1rem 5rem' }}>

          {/* ========== HISTORIA ========== */}
          {tab === 'historia' && (
            <>
              {/* Statystyki */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: '1rem' }}>
                {[
                  { label: 'Łącznie', val: history.length, hint: 'treningów', color: C.navy },
                  { label: 'Ten miesiąc', val: Object.values(sessionsByDate).flat().filter(s => {
                    const d = new Date(s.date_completed||'')
                    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
                  }).length, hint: monthName, color: C.gold },
                  { label: 'Raporty', val: totalReports, hint: 'wysłanych', color: C.blue },
                ].map(s => (
                  <div key={s.label} style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '0.75rem', boxShadow: '0 2px 8px rgba(13,27,42,0.04)' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontFamily: mono, fontSize: '1.4rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: '0.66rem', color: C.gray, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.hint}</div>
                  </div>
                ))}
              </div>

              {/* Legenda */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {[
                  { bg: C.blue, label: 'Raport wysłany' },
                  { bg: C.navy, label: 'Trening (bez raportu)' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: l.bg }} />
                    <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray }}>{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Kalendarz historii */}
              <CalendarShell month={month} monthName={monthName} onPrev={prevMonth} onNext={nextMonth} today={today}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                  {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontFamily: mono, fontSize: '0.58rem', color: C.gray, fontWeight: 700 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                  {calDays.map(day => {
                    const key = dateKey(day)
                    const sessions = sessionsByDate[key] || []
                    const inMonth = day.getMonth() === month.getMonth()
                    const hasTraining = sessions.length > 0
                    const reportSent = sessions.some(s => s.report_sent)
                    const isToday = key === dateKey(today)
                    const isExpanded = expandedKey === key

                    let bg = C.offWhite
                    let color = inMonth ? C.gray : C.grayLight
                    let border = `1.5px solid ${C.grayLight}`
                    if (hasTraining && reportSent) { bg = C.blue; color = C.white; border = `1.5px solid ${C.blueDark}` }
                    else if (hasTraining) { bg = C.navy; color = C.gold; border = `1.5px solid ${C.navyBorder}` }
                    if (isToday) border = `2px solid ${C.gold}`

                    return (
                      <button key={key} className="day-btn"
                        onClick={() => hasTraining && inMonth && setExpandedKey(isExpanded ? null : key)}
                        disabled={!hasTraining || !inMonth}
                        style={{ aspectRatio: '1/1', border, borderRadius: 10, background: bg, color, fontFamily: mono, fontWeight: hasTraining ? 800 : 500, fontSize: '0.78rem', opacity: inMonth ? 1 : 0.25, transition: 'transform 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
                        <span>{day.getDate()}</span>
                        {sessions.length > 1 && <span style={{ fontSize: '0.44rem', opacity: 0.8 }}>×{sessions.length}</span>}
                      </button>
                    )
                  })}
                </div>

                {expandedKey && sessionsByDate[expandedKey] && (
                  <div style={{ borderTop: `1.5px solid ${C.grayLight}`, background: C.offWhite, padding: '1rem', margin: '0.875rem -0.875rem -0.875rem' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                      {new Date(expandedKey).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    {sessionsByDate[expandedKey].map((s: any, i: number) => {
                      const fb = fbBySession[s.id]
                      const day = s.workout_day
                      const isArchived = day?.week?.plan?.is_archived
                      return (
                        <div key={s.id} style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, padding: '0.875rem', marginBottom: i < sessionsByDate[expandedKey].length-1 ? 8 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                                {day?.week?.plan?.name} · Tydz. {day?.week?.week_number}
                              </div>
                              <div style={{ fontWeight: 800, color: C.navy, fontSize: '0.92rem' }}>{day?.day_name || 'Trening'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {s.report_sent && <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.white, background: C.blue, borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>📋 wysłany</span>}
                              {isArchived && <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.gray, background: C.grayLight, borderRadius: 6, padding: '2px 6px' }}>archiwum</span>}
                            </div>
                          </div>

                          {fb && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                              {fb.session_rpe != null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: rpeColor(fb.session_rpe) + '18', border: `1px solid ${rpeColor(fb.session_rpe)}`, borderRadius: 8 }}>
                                  <span style={{ fontFamily: mono, fontWeight: 900, color: rpeColor(fb.session_rpe), fontSize: '0.82rem' }}>{fb.session_rpe}</span>
                                  <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>RPE · {rpeLabel(fb.session_rpe)}</span>
                                </div>
                              )}
                              {fb.feeling_after && (
                                <div style={{ padding: '3px 8px', background: C.offWhite, border: `1px solid ${C.grayLight}`, borderRadius: 8, fontSize: '0.78rem', fontWeight: 700 }}>
                                  {FEELING_LABELS[fb.feeling_after] || fb.feeling_after}
                                </div>
                              )}
                            </div>
                          )}
                          {fb?.what_went_well && (
                            <div style={{ fontSize: '0.78rem', color: C.gray, fontStyle: 'italic', marginBottom: 8, borderLeft: `3px solid ${C.green}`, paddingLeft: 8 }}>
                              &ldquo;{fb.what_went_well.slice(0, 120)}{fb.what_went_well.length > 120 ? '...' : ''}&rdquo;
                            </div>
                          )}
                          {!fb && <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.grayLight, marginBottom: 8 }}>Brak feedbacku po sesji</div>}

                          <button onClick={() => router.push(`/athlete/history/${s.id}`)}
                            style={{ width: '100%', padding: '0.6rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.8rem' }}>
                            {isArchived ? 'Podgląd szczegółów →' : 'Otwórz szczegóły →'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CalendarShell>

              {/* Lista ostatnich treningów */}
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(13,27,42,0.06)' }}>
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, background: C.offWhite, fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Ostatnie treningi
                </div>
                {sorted.slice(0, 15).map((s: any, i: number) => {
                  const fb = fbBySession[s.id]
                  return (
                    <button key={s.id} onClick={() => router.push(`/athlete/history/${s.id}`)}
                      style={{ width: '100%', border: 'none', background: 'none', borderBottom: i < Math.min(sorted.length,15)-1 ? `1px solid ${C.grayLight}` : 'none', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.offWhite)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {s.report_sent && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.blue, flexShrink: 0 }} />}
                          <span style={{ fontWeight: 700, color: C.navy, fontSize: '0.88rem' }}>{s.workout_day?.day_name || 'Trening'}</span>
                        </div>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>
                          {s.date_completed ? new Date(s.date_completed).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                          {s.workout_day?.week?.plan?.name && ` · ${s.workout_day.week.plan.name}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {fb?.session_rpe != null && (
                          <div style={{ fontFamily: mono, fontWeight: 800, fontSize: '0.75rem', color: rpeColor(fb.session_rpe), background: rpeColor(fb.session_rpe) + '18', padding: '2px 7px', borderRadius: 6 }}>
                            RPE {fb.session_rpe}
                          </div>
                        )}
                        <span style={{ color: C.gray, fontSize: '0.85rem' }}>›</span>
                      </div>
                    </button>
                  )
                })}
                {sorted.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak historii treningów</div>
                )}
              </div>
            </>
          )}

          {/* ========== AKTYWNOŚĆ ========== */}
          {tab === 'aktywnosc' && (
            <>
              <ViewToggle view={actView} onChange={setActView} />

              {actView === 'calendar' ? (
                <>
                  {/* Legenda */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, fontWeight: 700 }}>OBCIĄŻENIE:</span>
                    {[
                      { bg: '#DBEAFE', label: 'Bardzo lekki' },
                      { bg: '#93C5FD', label: 'Lekki' },
                      { bg: '#3B82F6', label: 'Umiarkowany' },
                      { bg: '#1D4ED8', label: 'Ciężki' },
                      { bg: '#1E3A8A', label: 'Ekstremalny' },
                    ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, border: '1px solid rgba(0,0,0,0.1)' }} />
                        <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray }}>{l.label}</span>
                      </div>
                    ))}
                  </div>

                  <CalendarShell month={month} monthName={monthName} onPrev={prevMonth} onNext={nextMonth} today={today}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                      {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => (
                        <div key={d} style={{ textAlign: 'center', fontFamily: mono, fontSize: '0.58rem', color: C.gray, fontWeight: 700 }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                      {calDays.map(day => {
                        const key = dateKey(day)
                        const sessions = sessionsByDate[key] || []
                        const wellness = wellnessByDate[key]
                        const pains = painByDate[key] || []
                        const inMonth = day.getMonth() === month.getMonth()
                        const isToday = key === dateKey(today)

                        const actDuration = wellness?.activity_data?.duration ? parseInt(wellness.activity_data.duration) || 0 : 0
                        const hasSession = sessions.length > 0

                        // Compute hours from sessions (assume ~1h each if no duration data) + wellness activity
                        const totalMinutes = sessions.length * 60 + actDuration
                        const hours = totalMinutes / 60

                        // Average RPE across sessions feedbacks
                        const rpes = sessions.map(s => fbBySession[(s as any).id]?.session_rpe).filter(Boolean)
                        const avgRpe = rpes.length ? rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length : null

                        const hasPain = pains.length > 0
                        const maxPain = hasPain ? Math.max(...pains.map(p => p.vas_score || 0)) : 0

                        const hasActivity = hasSession || actDuration > 0
                        const bg = hasActivity ? activityLoadColor(hours, avgRpe) : (inMonth ? C.offWhite : 'transparent')
                        const textColor = hasActivity && hours > 0.5 ? C.white : (inMonth ? C.gray : C.grayLight)

                        return (
                          <div key={key} style={{ aspectRatio: '1/1', border: isToday ? `2px solid ${C.gold}` : `1.5px solid ${hasActivity ? 'rgba(0,0,0,0.1)' : C.grayLight}`, borderRadius: 10, background: bg, opacity: inMonth ? 1 : 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1, position: 'relative', overflow: 'hidden' }}>
                            <span style={{ fontFamily: mono, fontWeight: hasActivity ? 800 : 500, fontSize: '0.75rem', color: textColor }}>{day.getDate()}</span>
                            <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                              {hasSession && <span style={{ fontSize: '0.55rem' }}>🏋️</span>}
                              {actDuration > 0 && wellness?.activity_data?.type && <span style={{ fontSize: '0.55rem' }}>🏃</span>}
                              {hasPain && <span style={{ fontSize: '0.55rem' }}>{maxPain >= 7 ? '🔴' : maxPain >= 4 ? '🟡' : '🟢'}</span>}
                            </div>
                            {hasActivity && hours > 0 && (
                              <span style={{ fontFamily: mono, fontSize: '0.42rem', color: textColor, opacity: 0.85 }}>{hours < 1 ? `${Math.round(totalMinutes)}m` : `${hours.toFixed(1)}h`}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CalendarShell>

                  {/* Podsumowanie miesiąca */}
                  <ActivityMonthlySummary
                    calDays={calDays}
                    month={month}
                    sessionsByDate={sessionsByDate}
                    wellnessByDate={wellnessByDate}
                    painByDate={painByDate}
                    fbBySession={fbBySession}
                  />
                </>
              ) : (
                <ActivityCharts
                  sessionsByDate={sessionsByDate}
                  wellnessByDate={wellnessByDate}
                  fbBySession={fbBySession}
                />
              )}
            </>
          )}

          {/* ========== WELLNESS ========== */}
          {tab === 'wellness' && (
            <>
              <ViewToggle view={wellView} onChange={setWellView} />

              {wellView === 'calendar' ? (
                <>
                  {/* Legenda wellness */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, fontWeight: 700 }}>GOTOWOŚĆ:</span>
                    {[
                      { bg: '#22C55E', label: 'Świetna' },
                      { bg: '#84CC16', label: 'Dobra' },
                      { bg: '#F5C842', label: 'Przeciętna' },
                      { bg: '#F97316', label: 'Słaba' },
                      { bg: '#EF4444', label: 'Zła' },
                    ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.bg }} />
                        <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray }}>{l.label}</span>
                      </div>
                    ))}
                  </div>

                  <CalendarShell month={month} monthName={monthName} onPrev={prevMonth} onNext={nextMonth} today={today}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                      {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => (
                        <div key={d} style={{ textAlign: 'center', fontFamily: mono, fontSize: '0.58rem', color: C.gray, fontWeight: 700 }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                      {calDays.map(day => {
                        const key = dateKey(day)
                        const w = wellnessByDate[key]
                        const inMonth = day.getMonth() === month.getMonth()
                        const isToday = key === dateKey(today)
                        const score = calcWellnessScore(w)
                        const bg = score != null ? wellnessColor(score) : (inMonth ? C.offWhite : 'transparent')
                        const textColor = score != null ? C.white : (inMonth ? C.gray : C.grayLight)

                        return (
                          <div key={key} style={{ aspectRatio: '1/1', border: isToday ? `2px solid ${C.gold}` : `1.5px solid ${score != null ? 'rgba(0,0,0,0.1)' : C.grayLight}`, borderRadius: 10, background: bg, opacity: inMonth ? 1 : 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1, position: 'relative' }}>
                            <span style={{ fontFamily: mono, fontWeight: score != null ? 800 : 500, fontSize: '0.75rem', color: textColor }}>{day.getDate()}</span>
                            {w?.sleep_hours != null && (
                              <span style={{ fontFamily: mono, fontSize: '0.42rem', color: textColor, opacity: 0.9 }}>{w.sleep_hours}h 💤</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CalendarShell>

                  {/* Wellness miesiąc stats */}
                  <WellnessMonthStats wellnessByDate={wellnessByDate} calDays={calDays} month={month} />
                </>
              ) : (
                <WellnessCharts data={wellnessChartData} dietData={dietChartData} hasDiet={hasDiet} />
              )}
            </>
          )}

          {/* ========== POSTĘPY ========== */}
          {tab === 'postery' && (
            <ProgressTab router={router} />
          )}

        </main>
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CalendarShell({ month, monthName, onPrev, onNext, today, children }: { month: Date; monthName: string; onPrev: () => void; onNext: () => void; today: Date; children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, overflow: 'hidden', marginBottom: '1rem', boxShadow: '0 2px 12px rgba(13,27,42,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
        <button onClick={onPrev} style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, fontWeight: 800, fontSize: '1rem' }}>‹</button>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: C.navy }}>{monthName}</span>
        <button onClick={onNext}
          disabled={month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear()}
          style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, fontWeight: 800, fontSize: '1rem', opacity: month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear() ? 0.3 : 1 }}>›</button>
      </div>
      <div style={{ padding: '0.875rem' }}>
        {children}
      </div>
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: 'calendar'|'chart'; onChange: (v: 'calendar'|'chart') => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: '0.875rem', background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 12, padding: 4 }}>
      {(['calendar', 'chart'] as const).map(v => (
        <button key={v} onClick={() => onChange(v)}
          style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: 9, background: view === v ? C.navy : 'transparent', color: view === v ? C.white : C.gray, fontWeight: 700, fontSize: '0.78rem' }}>
          {v === 'calendar' ? '📅 Kalendarz' : '📈 Wykres'}
        </button>
      ))}
    </div>
  )
}

function ActivityMonthlySummary({ calDays, month, sessionsByDate, wellnessByDate, painByDate, fbBySession }: any) {
  const daysInMonth = calDays.filter((d: Date) => d.getMonth() === month.getMonth())
  let totalSessions = 0, totalMinutes = 0, rpeSum = 0, rpeCount = 0, painCount = 0

  for (const day of daysInMonth) {
    const key = dateKey(day)
    const sessions = sessionsByDate[key] || []
    const wellness = wellnessByDate[key]
    totalSessions += sessions.length
    totalMinutes += sessions.length * 60
    if (wellness?.activity_data?.duration) totalMinutes += parseInt(wellness.activity_data.duration) || 0
    for (const s of sessions) {
      const fb = fbBySession[(s as any).id]
      if (fb?.session_rpe != null) { rpeSum += fb.session_rpe; rpeCount++ }
    }
    if ((painByDate[key] || []).length > 0) painCount++
  }

  const avgRpe = rpeCount > 0 ? rpeSum / rpeCount : null
  const hours = totalMinutes / 60

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: '1rem' }}>
      {[
        { label: 'Treningi', val: String(totalSessions), hint: 'w tym miesiącu', color: C.blue },
        { label: 'Godz. aktyw.', val: `${hours.toFixed(1)}h`, hint: 'łącznie', color: C.navy },
        { label: 'Śr. RPE', val: avgRpe != null ? avgRpe.toFixed(1) : '—', hint: painCount > 0 ? `${painCount} dni z bólem` : 'brak bólu', color: avgRpe != null ? rpeColor(avgRpe) : C.gray },
      ].map(s => (
        <div key={s.label} style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '0.75rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
          <div style={{ fontSize: '0.63rem', color: C.gray, marginTop: 3 }}>{s.hint}</div>
        </div>
      ))}
    </div>
  )
}

function ActivityCharts({ sessionsByDate, wellnessByDate, fbBySession }: any) {
  // Build daily load series
  const entries: { date: string; hours: number; rpe: number | null }[] = []
  const allDates = Array.from(new Set([
    ...Object.keys(sessionsByDate),
    ...Object.keys(wellnessByDate),
  ])).sort().slice(-60)

  for (const date of allDates) {
    const sessions = sessionsByDate[date] || []
    const wellness = wellnessByDate[date]
    const actMin = wellness?.activity_data?.duration ? parseInt(wellness.activity_data.duration) || 0 : 0
    const totalMin = sessions.length * 60 + actMin
    const hours = totalMin / 60
    const rpes = sessions.map((s: any) => fbBySession[s.id]?.session_rpe).filter(Boolean)
    const avgRpe = rpes.length ? rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length : null
    if (hours > 0 || sessions.length > 0) entries.push({ date, hours, rpe: avgRpe })
  }

  const series = [
    { label: 'Godziny aktywności', color: C.blue, data: entries.map(e => ({ date: e.date, value: e.hours })) },
    ...(entries.some(e => e.rpe != null) ? [{ label: 'RPE (÷2)', color: C.orange, data: entries.flatMap(e => e.rpe != null ? [{ date: e.date, value: e.rpe / 2 }] : []) }] : []),
  ]

  return (
    <div>
      <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Obciążenie treningowe</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: '0.625rem', flexWrap: 'wrap' }}>
          {series.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 3, background: s.color, borderRadius: 2 }} />
              <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray }}>{s.label}</span>
            </div>
          ))}
        </div>
        {entries.length >= 2 ? <MultiLineChart series={series} height={160} /> : (
          <div style={{ textAlign: 'center', padding: '2rem', fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>Za mało danych</div>
        )}
      </div>
    </div>
  )
}

function WellnessMonthStats({ wellnessByDate, calDays, month }: any) {
  const entries = calDays
    .filter((d: Date) => d.getMonth() === month.getMonth())
    .map((d: Date) => wellnessByDate[dateKey(d)])
    .filter(Boolean)

  if (entries.length === 0) return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>Brak danych wellness w tym miesiącu</div>
    </div>
  )

  function avg(fn: (w: any) => number | null | undefined) {
    const vals = entries.map(fn).filter((v: any): v is number => v != null)
    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null
  }

  const avgSleep = avg(w => w.sleep_hours)
  const avgSleepQ = avg(w => w.sleep_quality)
  const avgEnergy = avg(w => w.energy)
  const avgStress = avg(w => w.stress)
  const avgReadiness = avg(w => w.readiness)
  const avgSoreness = avg(w => w.muscle_sorness)

  const metrics = [
    { label: 'Sen', val: avgSleep != null ? `${avgSleep.toFixed(1)}h` : '—', color: C.blue },
    { label: 'Jakość snu', val: avgSleepQ != null ? `${avgSleepQ.toFixed(1)}/10` : '—', color: C.teal },
    { label: 'Energia', val: avgEnergy != null ? `${avgEnergy.toFixed(1)}/10` : '—', color: C.gold },
    { label: 'Stres', val: avgStress != null ? `${avgStress.toFixed(1)}/10` : '—', color: C.orange },
    { label: 'Gotowość', val: avgReadiness != null ? `${avgReadiness.toFixed(1)}/10` : '—', color: C.green },
    { label: 'Zakwasy', val: avgSoreness != null ? `${avgSoreness.toFixed(1)}/10` : '—', color: C.purple },
  ]

  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Śr. wellness · {entries.length} wpisów</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: '1.1rem', fontWeight: 900, color: m.color }}>{m.val}</div>
            <div style={{ fontSize: '0.65rem', color: C.gray, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WellnessCharts({ data, dietData, hasDiet }: any) {
  const wellnessSeries = [
    { label: 'Sen (h)', color: C.blue, data: data.sleep },
    { label: 'Jakość snu', color: C.teal, data: data.sleepQ },
    { label: 'Energia', color: C.gold, data: data.energy },
    { label: 'Stres', color: C.orange, data: data.stress },
    { label: 'Gotowość', color: C.green, data: data.readiness },
    { label: 'Zakwasy', color: C.purple, data: data.soreness },
  ].filter(s => s.data.length > 0)

  const groups = [
    {
      title: 'Sen i regeneracja',
      series: [
        { label: 'Sen (h)', color: C.blue, data: data.sleep },
        { label: 'Jakość snu', color: C.teal, data: data.sleepQ },
        { label: 'Gotowość', color: C.green, data: data.readiness },
      ].filter(s => s.data.length > 0),
    },
    {
      title: 'Energia i stres',
      series: [
        { label: 'Energia', color: C.gold, data: data.energy },
        { label: 'Stres', color: C.orange, data: data.stress },
        { label: 'Zakwasy', color: C.purple, data: data.soreness },
      ].filter(s => s.data.length > 0),
    },
    ...(data.hr.length > 0 ? [{
      title: 'HR spoczynkowe',
      series: [{ label: 'HR spoczynkowe (bpm)', color: C.red, data: data.hr }],
    }] : []),
    ...(hasDiet ? [{
      title: 'Nawodnienie i kawa',
      series: [
        ...(dietData.water.length > 0 ? [{ label: 'Nawodnienie (L)', color: C.blue, data: dietData.water }] : []),
        ...(dietData.coffee.length > 0 ? [{ label: 'Kawa (filiż.)', color: '#6B3A2A', data: dietData.coffee }] : []),
      ],
    }] : []),
  ]

  return (
    <div>
      {groups.map(g => g.series.length > 0 && (
        <div key={g.title} style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{g.title}</div>
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
      ))}
      {groups.every(g => g.series.length === 0) && (
        <div style={{ padding: '3rem', textAlign: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>Brak danych wellness</div>
      )}
    </div>
  )
}

function ProgressTab({ router }: { router: any }) {
  return (
    <div>
      <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, padding: '1.25rem', marginBottom: '1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
        <div style={{ fontWeight: 800, color: C.navy, marginBottom: 6 }}>Monitoring postępów</div>
        <div style={{ fontSize: '0.82rem', color: C.gray, marginBottom: '1rem', lineHeight: 1.5 }}>
          Wykresy postępów ćwiczeń i wyniki testów znajdziesz w zakładce Statystyki.
        </div>
        <button onClick={() => router.push('/athlete/stats')}
          style={{ padding: '0.75rem 1.5rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.88rem' }}>
          Przejdź do statystyk →
        </button>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {[
          { icon: '🏋️', title: 'Wykresy ćwiczeń', desc: 'Ciężar, powtórzenia i tonnage dla każdego ćwiczenia z planu', route: '/athlete/stats?tab=cwiczenia' },
          { icon: '🏆', title: 'Wyniki testów', desc: 'Historia wyników testów i porównanie z poprzednimi pomiarami', route: '/athlete/stats?tab=testy' },
          { icon: '📉', title: 'Tonnage i obciążenie', desc: 'Sumaryczne obciążenie treningowe w czasie', route: '/athlete/stats?tab=obciazenie' },
        ].map(card => (
          <button key={card.title} onClick={() => router.push(card.route)}
            style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.875rem', textAlign: 'left', cursor: 'pointer', width: '100%' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.offWhite)}
            onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
            <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{card.icon}</div>
            <div>
              <div style={{ fontWeight: 800, color: C.navy, fontSize: '0.9rem', marginBottom: 3 }}>{card.title}</div>
              <div style={{ fontSize: '0.75rem', color: C.gray }}>{card.desc}</div>
            </div>
            <div style={{ marginLeft: 'auto', color: C.gray }}>›</div>
          </button>
        ))}
      </div>
    </div>
  )
}
