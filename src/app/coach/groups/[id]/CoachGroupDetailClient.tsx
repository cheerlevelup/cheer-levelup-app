'use client'
// src/app/coach/groups/[id]/CoachGroupDetailClient.tsx

import { useRouter } from 'next/navigation'

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

// Status komórki w tabeli realizacji
function CellStatus({ session }: { session: any | null }) {
  if (!session) return (
    <div title="Niewykonany" style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#E8E6E0', borderRadius: '50%',
      fontFamily: mono, fontSize: '0.65rem', color: '#aaa',
    }}>○</div>
  )
  if (session.completed && session.report_sent) return (
    <div title={`Wykonany ${formatDate(session.date_completed)} · Raport wysłany`} style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#111', borderRadius: '50%',
      fontFamily: mono, fontSize: '0.7rem', color: '#F5C842',
    }}>📋</div>
  )
  if (session.completed) return (
    <div title={`Wykonany ${formatDate(session.date_completed)}`} style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#111', borderRadius: '50%',
      fontFamily: mono, fontSize: '0.8rem', color: '#F0EEE9',
    }}>✓</div>
  )
  return (
    <div title="W trakcie" style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5C842', borderRadius: '50%',
      fontFamily: mono, fontSize: '0.7rem', color: '#111',
    }}>◑</div>
  )
}

export default function CoachGroupDetailClient({ group, athletes, assignments, days, sessions }: any) {
  const router = useRouter()

  // Indeks sesji: athleteId_dayId → session
  const sessionIndex: Record<string, any> = {}
  for (const s of sessions) {
    const key = `${s.athlete_id}_${s.workout_day_id}`
    if (!sessionIndex[key] || new Date(s.created_at) > new Date(sessionIndex[key].created_at)) {
      sessionIndex[key] = s
    }
  }

  // Oblicz % realizacji dla zawodniczki
  function getAthleteProgress(athleteId: number) {
    if (days.length === 0) return null
    const done = days.filter((d: any) => {
      const s = sessionIndex[`${athleteId}_${d.id}`]
      return s?.completed
    }).length
    return { done, total: days.length }
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F0EEE9; } ::-webkit-scrollbar { height: 4px; } ::-webkit-scrollbar-track { background: #E8E6E0; } ::-webkit-scrollbar-thumb { background: #aaa; }`}</style>
      <div style={{ minHeight: '100vh', background: '#F0EEE9', fontFamily: sans, color: '#111' }}>

        {/* Header */}
        <header style={{
          borderBottom: '1px solid #D5D2CB', padding: '1.25rem 2rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: '#F0EEE9', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button onClick={() => router.push('/coach/groups')} style={{ fontFamily: mono, fontSize: '0.75rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}>
            ← Grupy
          </button>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Grupa {group.name}</h1>
          <span style={{ fontFamily: mono, fontSize: '0.7rem', color: '#888', marginLeft: 'auto' }}>
            {athletes.length} zawodniczek
          </span>
        </header>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>

          {athletes.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Brak zawodniczek w tej grupie.</p>
          ) : (
            <>
              {/* Legenda */}
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  { symbol: '○', label: 'Niewykonany', bg: '#E8E6E0', color: '#aaa' },
                  { symbol: '✓', label: 'Wykonany', bg: '#111', color: '#F0EEE9' },
                  { symbol: '📋', label: 'Raport wysłany', bg: '#111', color: '#F5C842' },
                  { symbol: '◑', label: 'W trakcie', bg: '#F5C842', color: '#111' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: item.bg, color: item.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6rem', fontFamily: mono,
                    }}>{item.symbol}</div>
                    <span style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.04em' }}>{item.label}</span>
                  </div>
                ))}
              </div>

              {assignments.length === 0 ? (
                <div style={{ background: '#E8E6E0', padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.9rem', color: '#666' }}>
                    Brak przypisanego planu dla tej grupy.
                    Przypisz plan w Supabase lub poczekaj na edytor planów (Sesja 6).
                  </p>
                </div>
              ) : (
                <>
                  {/* Plan info */}
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Plan: {assignments[0]?.plan?.name} · {days.length} dni treningowych
                    </span>
                  </div>

                  {/* Tabela realizacji — scrollowalna w poziomie */}
                  <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{
                            padding: '0.625rem 1rem', textAlign: 'left',
                            fontFamily: mono, fontSize: '0.62rem', color: '#888',
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            background: '#F0EEE9', position: 'sticky', left: 0, zIndex: 2,
                            borderBottom: '1px solid #D5D2CB', whiteSpace: 'nowrap',
                          }}>
                            Zawodniczka
                          </th>
                          <th style={{
                            padding: '0.625rem 0.75rem', textAlign: 'center',
                            fontFamily: mono, fontSize: '0.62rem', color: '#888',
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                            background: '#F0EEE9',
                            borderBottom: '1px solid #D5D2CB', whiteSpace: 'nowrap',
                          }}>
                            Postęp
                          </th>
                          {days.map((day: any, i: number) => (
                            <th key={day.id} style={{
                              padding: '0.625rem 0.5rem', textAlign: 'center',
                              fontFamily: mono, fontSize: '0.6rem', color: '#888',
                              letterSpacing: '0.04em',
                              background: '#F0EEE9',
                              borderBottom: '1px solid #D5D2CB',
                              minWidth: 48,
                            }}>
                              <div style={{ color: '#555', fontWeight: 700 }}>T{i + 1}</div>
                              <div style={{ color: '#aaa', fontSize: '0.55rem', marginTop: 1 }}>{day.day_name.replace('Dzień ', '')}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, rowIdx: number) => {
                          const progress = getAthleteProgress(athlete.id)
                          const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0
                          return (
                            <tr key={athlete.id} style={{ background: rowIdx % 2 === 0 ? '#F0EEE9' : '#F7F6F2' }}>
                              {/* Imię */}
                              <td style={{
                                padding: '0.75rem 1rem',
                                position: 'sticky', left: 0, zIndex: 1,
                                background: rowIdx % 2 === 0 ? '#F0EEE9' : '#F7F6F2',
                                borderBottom: '1px solid #E8E6E0',
                                whiteSpace: 'nowrap',
                              }}>
                                <button
                                  onClick={() => router.push(`/coach/athletes/${athlete.id}`)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontFamily: sans, color: '#111', padding: 0, textAlign: 'left',
                                  }}
                                >
                                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{athlete.full_name}</div>
                                </button>
                              </td>
                              {/* Postęp */}
                              <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #E8E6E0' }}>
                                {progress ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                    <div style={{ fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, color: '#111' }}>
                                      {pct}%
                                    </div>
                                    <div style={{ width: 48, height: 3, background: '#D5D2CB', borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#111' : '#F5C842', borderRadius: 2 }} />
                                    </div>
                                    <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#aaa' }}>{progress.done}/{progress.total}</div>
                                  </div>
                                ) : <span style={{ color: '#ccc', fontSize: '0.75rem' }}>—</span>}
                              </td>
                              {/* Komórki dni */}
                              {days.map((day: any) => {
                                const session = sessionIndex[`${athlete.id}_${day.id}`] || null
                                return (
                                  <td key={day.id} style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #E8E6E0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                      <CellStatus session={session} />
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Lista zawodniczek z linkami */}
              <section>
                <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Zawodniczki
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {athletes.map((athlete: any) => {
                    const progress = getAthleteProgress(athlete.id)
                    return (
                      <button
                        key={athlete.id}
                        onClick={() => router.push(`/coach/athletes/${athlete.id}`)}
                        style={{
                          width: '100%', background: '#E8E6E0', padding: '0.875rem 1.25rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          border: 'none', cursor: 'pointer', fontFamily: sans, color: '#111', textAlign: 'left',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#DDDAD3')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#E8E6E0')}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{athlete.full_name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {progress && (
                            <span style={{ fontFamily: mono, fontSize: '0.7rem', color: '#888' }}>
                              {progress.done}/{progress.total}
                            </span>
                          )}
                          <span style={{ color: '#888' }}>›</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  )
}
