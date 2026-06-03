'use client'
// src/app/coach/athletes/[id]/CoachAthleteClient.tsx

import { useRouter } from 'next/navigation'

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function rpeColor(rpe: number) {
  if (rpe <= 4) return '#4CAF50'
  if (rpe <= 6) return '#F5C842'
  if (rpe <= 8) return '#FF9800'
  return '#f44336'
}

function feelingLabel(f: string) {
  const map: Record<string, string> = {
    swietnie: '💪 Świetnie', dobrze: '😊 Dobrze',
    srednie: '😐 Średnio', zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
  }
  return map[f] || f
}

export default function CoachAthleteClient({ athlete, sessions, feedbacks, wellnessList, painLogs }: any) {
  const router = useRouter()

  const completedSessions = (sessions || []).filter((s: any) => s.completed)
  const avgRpe = (feedbacks || []).length > 0
    ? ((feedbacks || []).reduce((sum: number, f: any) => sum + (f.session_rpe || 0), 0) / (feedbacks || []).length).toFixed(1)
    : null

  const lastWellness = (wellnessList || [])[0]
  const recentPain = (painLogs || []).slice(0, 3)

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F0EEE9; }`}</style>
      <div style={{ minHeight: '100vh', background: '#F0EEE9', fontFamily: sans, color: '#111' }}>

        {/* Header */}
        <header style={{
          borderBottom: '1px solid #D5D2CB', padding: '1.25rem 2rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: '#F0EEE9', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button
            onClick={() => athlete.group_id ? router.push(`/coach/groups/${athlete.group_id}`) : router.push('/coach')}
            style={{ fontFamily: mono, fontSize: '0.75rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            ← {athlete.group?.name || 'Panel'}
          </button>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{athlete.full_name}</h1>
          <button
            onClick={() => router.push(`/coach/athletes/${athlete.id}/training`)}
            style={{ marginLeft: 'auto', padding: '0.5rem 1rem', background: '#111', color: '#F0EEE9', fontFamily: mono, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}
          >
            Plan ✎
          </button>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem' }}>

          {/* Profil */}
          <div style={{ background: '#111', color: '#F0EEE9', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Profil zawodniczki
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {athlete.full_name}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.75rem', color: '#888' }}>
              {athlete.group?.name && <span>Grupa {athlete.group.name}</span>}
              {athlete.birth_year && <span> · ur. {athlete.birth_year}</span>}
            </div>
          </div>

          {/* Statystyki */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginBottom: '1.5rem' }}>
            {[
              { label: 'Treningów', value: completedSessions.length },
              { label: 'Śr. RPE', value: avgRpe || '—' },
              { label: 'Zgłoszenia bólu', value: painLogs.length },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#E8E6E0', padding: '1rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontFamily: mono, fontSize: '1.6rem', fontWeight: 700, color: '#111', lineHeight: 1 }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Ostatnie wellness */}
          {lastWellness && (
            <section style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                Ostatni wellness ({formatDate(lastWellness.created_at)})
              </p>
              <div style={{ background: '#E8E6E0', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {[
                  ['Sen', lastWellness.sleep_hours ? `${lastWellness.sleep_hours}h` : null],
                  ['Energia', lastWellness.energy ? `${lastWellness.energy}/5` : null],
                  ['Stres', lastWellness.stress ? `${lastWellness.stress}/5` : null],
                  ['Gotowość', lastWellness.readiness ? `${lastWellness.readiness}/5` : null],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string}>
                    <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: mono, fontSize: '1rem', fontWeight: 700, color: '#111' }}>{value}</div>
                  </div>
                ))}
              </div>
              {lastWellness.concerns && (
                <div style={{ background: '#fff8f0', borderLeft: '3px solid #F5C842', padding: '0.75rem 1rem', marginTop: 1 }}>
                  <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#888', letterSpacing: '0.06em', marginBottom: 3 }}>UWAGI</div>
                  <div style={{ fontSize: '0.88rem', color: '#111', fontStyle: 'italic' }}>"{lastWellness.concerns}"</div>
                </div>
              )}
            </section>
          )}

          {/* Ból — ostatnie zgłoszenia */}
          {(recentPain || []).length > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                Ostatnie zgłoszenia bólu
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {recentPain.map((p: any) => (
                  <div key={p.id} style={{ background: '#fff8f0', borderLeft: '3px solid #F5C842', padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 2 }}>{p.location || '—'}</div>
                        {p.description && <div style={{ fontSize: '0.8rem', color: '#555' }}>{p.description}</div>}
                      </div>
                      <div style={{
                        fontFamily: mono, fontSize: '0.8rem', fontWeight: 700,
                        color: p.vas_score >= 7 ? '#f44336' : p.vas_score >= 4 ? '#FF9800' : '#4CAF50',
                        minWidth: 40, textAlign: 'right',
                      }}>
                        VAS {p.vas_score}
                      </div>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#aaa', marginTop: 4 }}>
                      {formatDate(p.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Historia treningów */}
          <section>
            <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
              Historia treningów
            </p>
            {(sessions || []).length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#888', fontStyle: 'italic' }}>Brak treningów.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(sessions || []).map((s: any) => {
                  const fb = feedbacks.find((f: any) => f.workout_session_id === s.id || f.session_id === s.id)
                  return (
                    <div key={s.id} style={{
                      padding: '0.875rem 0', borderBottom: '1px solid #D5D2CB',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 2 }}>
                          {s.workout_day?.day_name || 'Trening'}
                          {!s.completed && <span style={{ marginLeft: 8, fontFamily: mono, fontSize: '0.6rem', color: '#888', textTransform: 'uppercase' }}>w trakcie</span>}
                        </div>
                        <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.04em' }}>
                          {s.date_completed ? formatDate(s.date_completed) : s.date_started ? formatDate(s.date_started) : '—'}
                          {s.workout_day?.week?.plan?.name && ` · ${s.workout_day.week.plan.name}`}
                        </div>
                        {fb?.what_went_well && (
                          <div style={{ fontSize: '0.78rem', color: '#555', marginTop: 3, fontStyle: 'italic' }}>
                            "{fb.what_went_well}"
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {fb?.session_rpe && (
                          <div style={{
                            fontFamily: mono, fontSize: '0.75rem', fontWeight: 700,
                            color: rpeColor(fb.session_rpe),
                            background: '#111', padding: '2px 8px',
                          }}>
                            RPE {fb.session_rpe}
                          </div>
                        )}
                        {fb?.feeling_after && (
                          <span style={{ fontSize: '0.8rem' }}>{feelingLabel(fb.feeling_after).split(' ')[0]}</span>
                        )}
                        {s.report_sent && <span style={{ fontSize: '0.75rem' }}>📋</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </main>
      </div>
    </>
  )
}
