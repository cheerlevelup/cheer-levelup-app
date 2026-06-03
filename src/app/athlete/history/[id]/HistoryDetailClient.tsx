'use client'
// src/app/athlete/history/[id]/HistoryDetailClient.tsx

import { useRouter } from 'next/navigation'

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function rpeLabel(rpe: number) {
  if (rpe <= 3) return 'Lekki'
  if (rpe <= 5) return 'Umiarkowany'
  if (rpe <= 7) return 'Ciężki'
  if (rpe <= 9) return 'Bardzo ciężki'
  return 'Maksymalny'
}

function feelingLabel(f: string) {
  const map: Record<string, string> = {
    swietnie: '💪 Świetnie', dobrze: '😊 Dobrze',
    srednie: '😐 Średnio', zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
  }
  return map[f] || f
}

export default function HistoryDetailClient({ athlete, session, setLogs, wellness, feedback, painLogs }: any) {
  const router = useRouter()
  const day = session.workout_day
  const plan = day?.week?.plan

  // Mapa: block_exercise_id → dane ćwiczenia
  const exerciseMap: Record<number, any> = {}
  for (const block of (day?.workout_day_blocks || [])) {
    for (const ex of (block.workout_block_exercises || [])) {
      exerciseMap[ex.id] = { ...ex, blockName: block.block_name }
    }
  }

  // Pogrupuj logi po ćwiczeniu
  const logsByExercise: Record<number, any[]> = {}
  for (const log of setLogs) {
    if (!log.block_exercise_id) continue
    if (!logsByExercise[log.block_exercise_id]) logsByExercise[log.block_exercise_id] = []
    logsByExercise[log.block_exercise_id].push(log)
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F0EEE9; }`}</style>
      <div style={{ minHeight: '100vh', background: '#F0EEE9', fontFamily: sans, color: '#111' }}>

        {/* Header */}
        <header style={{
          borderBottom: '1px solid #D5D2CB', padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: '#F0EEE9', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button
            onClick={() => router.push('/athlete/history')}
            style={{ fontFamily: mono, fontSize: '0.75rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            ← Historia
          </button>
          <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>Szczegóły treningu</h1>
        </header>

        <main style={{ maxWidth: 520, margin: '0 auto', padding: '1.5rem 1.5rem 4rem' }}>

          {/* Info o treningu */}
          <div style={{ background: '#111', color: '#F0EEE9', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#F5C842', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              {plan?.name} · Tydzień {day?.week?.week_number}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
              {day?.day_name}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.7rem', color: '#888' }}>
              {session.date_completed ? formatDate(session.date_completed) : '—'}
            </div>
            {session.report_sent && (
              <div style={{ marginTop: 8, fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.06em' }}>
                RAPORT WYSŁANY ✓
              </div>
            )}
          </div>

          {/* RPE + Samopoczucie */}
          {feedback && (
            <div style={{ display: 'flex', gap: 1, marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, background: '#E8E6E0', padding: '1rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>RPE</div>
                <div style={{ fontFamily: mono, fontSize: '1.8rem', fontWeight: 700, color: '#111', lineHeight: 1, marginBottom: 4 }}>{feedback.session_rpe}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{rpeLabel(feedback.session_rpe)}</div>
              </div>
              {feedback.feeling_after && (
                <div style={{ flex: 1, background: '#E8E6E0', padding: '1rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Samopoczucie</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111' }}>{feelingLabel(feedback.feeling_after)}</div>
                </div>
              )}
            </div>
          )}

          {/* Wellness */}
          {wellness && (
            <section style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                Wellness przed treningiem
              </p>
              <div style={{ background: '#E8E6E0', padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {[
                    ['Sen', wellness.sleep_hours ? `${wellness.sleep_hours}h` : null],
                    ['Jakość snu', wellness.sleep_quality ? `${wellness.sleep_quality}/5` : null],
                    ['Energia', wellness.energy ? `${wellness.energy}/5` : null],
                    ['Stres', wellness.stress ? `${wellness.stress}/5` : null],
                    ['Nastrój', wellness.mood ? `${wellness.mood}/5` : null],
                    ['Zakwasy', wellness.muscle_sorness ? `${wellness.muscle_sorness}/5` : null],
                    ['Gotowość', wellness.readiness ? `${wellness.readiness}/5` : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontFamily: mono, fontSize: '1rem', fontWeight: 700, color: '#111' }}>{value}</div>
                    </div>
                  ))}
                </div>
                {wellness.concerns && (
                  <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#555', fontStyle: 'italic', borderTop: '1px solid #D5D2CB', paddingTop: '0.75rem' }}>
                    "{wellness.concerns}"
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Serie */}
          {Object.keys(logsByExercise).length > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                Wykonane serie
              </p>
              {Object.entries(logsByExercise).map(([exId, logs]) => {
                const ex = exerciseMap[parseInt(exId)]
                const name = ex?.exercise?.name || ex?.exercise_code || `Ćwiczenie #${exId}`
                return (
                  <div key={exId} style={{ marginBottom: '1rem', borderBottom: '1px solid #D5D2CB', paddingBottom: '1rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>{name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {logs.sort((a, b) => a.set_number - b.set_number).map(log => (
                        <div key={log.id} style={{
                          background: '#E8E6E0', padding: '0.5rem 0.75rem',
                          fontFamily: mono, fontSize: '0.72rem', letterSpacing: '0.04em',
                          color: '#111', lineHeight: 1.5,
                        }}>
                          {log.is_warmup ? 'WU' : `S${log.set_number}`}
                          {log.weight && <><br /><strong>{log.weight}kg</strong></>}
                          {log.reps_completed && <><br />{log.reps_completed} powt.</>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )}

          {/* Ból */}
          {painLogs && painLogs.length > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                Zgłoszony ból
              </p>
              {painLogs.map((p: any) => (
                <div key={p.id} style={{ background: '#fff8f0', borderLeft: '3px solid #F5C842', padding: '0.75rem 1rem', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.location || '—'} · VAS {p.vas_score}/10</div>
                  {p.description && <div style={{ fontSize: '0.82rem', color: '#555', marginTop: 2 }}>{p.description}</div>}
                </div>
              ))}
            </section>
          )}

          {/* Feedback tekstowy */}
          {feedback && (feedback.what_went_well || feedback.pain_after_comment || feedback.general_notes) && (
            <section style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                Feedback
              </p>
              <div style={{ background: '#E8E6E0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {feedback.what_went_well && (
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Co poszło dobrze</div>
                    <div style={{ fontSize: '0.9rem', color: '#111' }}>{feedback.what_went_well}</div>
                  </div>
                )}
                {feedback.pain_after_comment && (
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Ból / dyskomfort</div>
                    <div style={{ fontSize: '0.9rem', color: '#111' }}>{feedback.pain_after_comment}</div>
                  </div>
                )}
                {feedback.general_notes && (
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Notatki</div>
                    <div style={{ fontSize: '0.9rem', color: '#111' }}>{feedback.general_notes}</div>
                  </div>
                )}
              </div>
            </section>
          )}

        </main>
      </div>
    </>
  )
}
