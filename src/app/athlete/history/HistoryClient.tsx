'use client'
// src/app/athlete/history/HistoryClient.tsx

import { useRouter } from 'next/navigation'
import type { Athlete, WorkoutSession } from '@/types/workout'

interface Props {
  athlete: Athlete
  history: WorkoutSession[]
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
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"
const trainerName = 'Urszula Papka'
const contentMaxWidth = 520

function getSessionDate(session: WorkoutSession) {
  return session.date_completed || session.date_started || ''
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
  })
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function isoDateKey(iso: string) {
  return dateKey(new Date(iso))
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const totalCells = Math.ceil((mondayOffset + lastDay.getDate()) / 7) * 7

  return Array.from({ length: totalCells }, (_, index) => {
    const day = new Date(firstDay)
    day.setDate(firstDay.getDate() - mondayOffset + index)
    return day
  })
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

function StatCard({ label, value, hint, tone = 'navy' }: { label: string; value: string; hint: string; tone?: 'navy' | 'gold' | 'green' }) {
  const color = tone === 'gold' ? C.gold : tone === 'green' ? C.green : C.navy

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

export default function HistoryClient({ athlete, history }: Props) {
  const router = useRouter()
  const sortedHistory = [...history].sort((a, b) => {
    const aDate = getSessionDate(a)
    const bDate = getSessionDate(b)
    return aDate.localeCompare(bDate)
  })
  const newestSession = [...history].sort((a, b) => getSessionDate(b).localeCompare(getSessionDate(a)))[0]
  const calendarMonth = newestSession && getSessionDate(newestSession)
    ? new Date(getSessionDate(newestSession))
    : null
  const calendarDays = calendarMonth ? buildCalendarDays(calendarMonth) : []
  const sessionNumberById = new Map(sortedHistory.map((session, index) => [session.id, index + 1]))

  const sessionsByDate = new Map<string, WorkoutSession[]>()
  for (const session of history) {
    const sessionDate = getSessionDate(session)
    if (!sessionDate) continue
    const key = isoDateKey(sessionDate)
    sessionsByDate.set(key, [...(sessionsByDate.get(key) || []), session])
  }

  const monthSessions = calendarMonth
    ? history.filter(session => {
        const sessionDate = getSessionDate(session)
        if (!sessionDate) return false
        const date = new Date(sessionDate)
        return date.getMonth() === calendarMonth.getMonth() && date.getFullYear() === calendarMonth.getFullYear()
      })
    : []
  const reportCount = history.filter(session => session.report_sent).length

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

            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: `min(60vw, ${contentMaxWidth}px)`, textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: C.white }}>{athlete.full_name}</div>
              <div style={{ fontSize: '0.72rem', color: C.gold, marginTop: 2, fontWeight: 700 }}>Trener: {trainerName}</div>
            </div>

            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: C.navyLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/unique.png" alt="Unique" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, background: C.white }} />
            </div>
          </div>

          <div style={{ maxWidth: contentMaxWidth, margin: '0 auto' }}>
            <button onClick={() => router.push('/athlete')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← Panel
            </button>
            <h1 style={{ color: C.white, fontSize: '1.45rem', fontWeight: 800, marginTop: '1rem' }}>Historia</h1>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>Kalendarz treningow i ostatnie sesje.</p>
          </div>
        </header>

        <main style={{ maxWidth: contentMaxWidth, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '1rem' }}>
            <StatCard label="Lacznie" value={String(history.length)} hint="treningow" />
            <StatCard label="Miesiac" value={String(monthSessions.length)} hint={calendarMonth ? monthLabel(calendarMonth) : 'brak danych'} tone="gold" />
            <StatCard label="Raporty" value={String(reportCount)} hint="wyslane" tone="green" />
          </div>

          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.875rem' }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Kalendarz</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: C.navy }}>{calendarMonth ? monthLabel(calendarMonth) : 'Brak treningow'}</div>
                </div>
                <button onClick={() => router.push('/athlete/stats')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.5rem 0.75rem', fontWeight: 800, fontSize: '0.78rem' }}>
                  Statystyki
                </button>
              </div>

              {calendarMonth ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
                    {['Pn', 'Wt', 'Sr', 'Cz', 'Pt', 'So', 'Nd'].map(day => (
                      <div key={day} style={{ textAlign: 'center', fontFamily: mono, fontSize: '0.62rem', color: C.gray, fontWeight: 700 }}>{day}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                    {calendarDays.map(day => {
                      const key = dateKey(day)
                      const daySessions = sessionsByDate.get(key) || []
                      const isCurrentMonth = day.getMonth() === calendarMonth.getMonth()
                      const hasTraining = daySessions.length > 0
                      const firstSession = daySessions[0]

                      return (
                        <button
                          key={key}
                          onClick={() => firstSession && router.push(`/athlete/history/${firstSession.id}`)}
                          disabled={!firstSession}
                          title={firstSession?.workout_day?.day_name || ''}
                          style={{
                            aspectRatio: '1 / 1',
                            border: hasTraining ? `1.5px solid ${C.gold}` : `1.5px solid ${C.grayLight}`,
                            borderRadius: 10,
                            background: hasTraining ? C.navy : C.offWhite,
                            color: hasTraining ? C.gold : isCurrentMonth ? C.navy : C.gray,
                            fontFamily: mono,
                            fontWeight: hasTraining ? 800 : 600,
                            fontSize: '0.78rem',
                            opacity: isCurrentMonth ? 1 : 0.35,
                            position: 'relative',
                          }}
                        >
                          {day.getDate()}
                          {hasTraining && (
                            <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%', background: C.gold }} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div style={{ color: C.gray, fontSize: '0.9rem', padding: '1rem 0' }}>Kalendarz pojawi sie po pierwszym treningu.</div>
              )}
            </div>
          </Card>

          <Card>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Ostatnie treningi</div>

              {history.length === 0 ? (
                <div style={{ color: C.gray, fontSize: '0.9rem' }}>Brak wykonanych treningow. Wroc tutaj po pierwszej sesji.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...history]
                    .sort((a, b) => getSessionDate(b).localeCompare(getSessionDate(a)))
                    .map(session => {
                      const sessionDate = getSessionDate(session)
                      return (
                        <button
                          key={session.id}
                          onClick={() => router.push(`/athlete/history/${session.id}`)}
                          style={{
                            width: '100%',
                            border: `1.5px solid ${C.grayLight}`,
                            borderRadius: 12,
                            background: C.offWhite,
                            padding: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.navy, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 800, flexShrink: 0 }}>
                              {sessionNumberById.get(session.id)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: C.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {session.workout_day?.day_name || 'Trening'}
                              </div>
                              <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 2 }}>
                                {sessionDate ? formatDate(sessionDate) : '—'}
                                {session.workout_day?.week?.plan?.name && ` · ${session.workout_day.week.plan.name}`}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {session.report_sent && <span style={{ fontSize: '0.85rem' }}>✓</span>}
                            <span style={{ color: C.gray }}>›</span>
                          </div>
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          </Card>
        </main>
      </div>
    </>
  )
}
