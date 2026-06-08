'use client'
// src/app/athlete/report/[id]/ReportClient.tsx

import { useRouter } from 'next/navigation'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function rpeColor(rpe: number) {
  if (rpe <= 4) return C.green
  if (rpe <= 6) return C.gold
  if (rpe <= 8) return '#F97316'
  return C.red
}
function rpeLabel(rpe: number) {
  if (rpe <= 3) return 'Lekki'
  if (rpe <= 5) return 'Umiarkowany'
  if (rpe <= 7) return 'Ciężki'
  if (rpe <= 9) return 'Bardzo ciężki'
  return 'Maksymalny'
}
const FEELING_LABELS: Record<string, string> = {
  swietnie: '🤩 Świetnie', dobrze: '😊 Dobrze',
  srednie: '😐 Średnio', zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.75rem' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Chip({ label, value, color = C.navy }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: C.offWhite, borderRadius: 10, padding: '0.625rem 0.875rem', border: `1.5px solid ${C.grayLight}` }}>
      <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: '1rem', color }}>{value}</div>
    </div>
  )
}

export default function ReportClient({ session, athlete, setLogs, wellness, painLogs, feedback }: {
  session: any; athlete: any; setLogs: any[]; wellness: any; painLogs: any[]; feedback: any
}) {
  const router = useRouter()

  const day = session.workout_day
  const plan = day?.week?.plan
  const week = day?.week
  const blocks: any[] = (day?.workout_day_blocks || []).sort((a: any, b: any) => a.block_order - b.block_order)

  const rpe = feedback?.session_rpe ?? 0
  const feeling = feedback?.feeling_after ?? ''
  const whatWentWell = feedback?.what_went_well ?? ''
  const painComment = feedback?.pain_after_comment ?? ''
  const generalNotes = feedback?.general_notes ?? ''

  const sessionDate = new Date(session.date_completed || session.date_started || Date.now())
    .toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Mapa set logów po block_exercise_id
  const logsByEx: Record<number, any[]> = {}
  for (const log of setLogs) {
    if (!log.block_exercise_id) continue
    if (!logsByEx[log.block_exercise_id]) logsByEx[log.block_exercise_id] = []
    logsByEx[log.block_exercise_id].push(log)
  }

  const totalPlannedSets = blocks.reduce((s: number, b: any) =>
    s + (b.workout_block_exercises || []).reduce((ss: number, e: any) => ss + e.sets, 0), 0)
  const doneMainSets = setLogs.filter(l => l.completed && !l.is_warmup).length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy, paddingBottom: '6rem' }}>

        {/* Header */}
        <div className="no-print" style={{ background: C.navy, padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => router.push('/athlete')}
              style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 10, padding: '0.6rem 0.875rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', fontFamily: sans }}>
              ← Powrót
            </button>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Raport treningowy
            </div>
            <button onClick={() => window.print()}
              style={{ border: 'none', background: C.gold, color: C.navy, borderRadius: 10, padding: '0.6rem 0.875rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', fontFamily: sans }}>
              🖨️ Drukuj
            </button>
          </div>
        </div>

        <div className="print-page" style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>

          {/* Hero */}
          <div style={{ background: C.navy, borderRadius: 16, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              {plan?.name || 'Plan'} · Tydzień {week?.week_number || '—'}
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.35rem', color: C.white, marginBottom: 2 }}>{day?.day_name || 'Trening'}</div>
            <div style={{ fontSize: '0.8rem', color: C.gray, marginBottom: '1rem' }}>{athlete.full_name} · {sessionDate}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>RPE</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: rpeColor(rpe), lineHeight: 1 }}>{rpe}</div>
                <div style={{ fontSize: '0.68rem', color: C.gray, marginTop: 2 }}>{rpeLabel(rpe)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Po treningu</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.white, lineHeight: 1.3 }}>{FEELING_LABELS[feeling] || '—'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Serie</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: doneMainSets >= totalPlannedSets ? C.green : C.gold, lineHeight: 1 }}>{doneMainSets}</div>
                <div style={{ fontSize: '0.68rem', color: C.gray, marginTop: 2 }}>z {totalPlannedSets} plan.</div>
              </div>
            </div>
          </div>

          {/* ── ĆWICZENIA ── */}
          <Section title="🏋️ Wykonane ćwiczenia">
            {blocks.map((block: any) => {
              const exercises = (block.workout_block_exercises || []).sort((a: any, b: any) => a.exercise_order - b.exercise_order)
              return (
                <div key={block.id} style={{ marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ background: C.navy, borderRadius: 20, padding: '3px 12px', fontSize: '0.72rem', fontWeight: 800, color: C.white, fontFamily: mono }}>{block.block_name}</div>
                    <div style={{ fontSize: '0.68rem', color: C.gray }}>× {block.rounds} rund</div>
                    <div style={{ flex: 1, height: 1, background: C.grayLight }} />
                  </div>

                  {exercises.map((ex: any) => {
                    const exName = (ex.exercise?.name || ex.exercise_code || 'Ćwiczenie').replace(/-/g, ' ')
                    const logs = (logsByEx[ex.id] || []).sort((a: any, b: any) => a.set_number - b.set_number)
                    const mainLogs = logs.filter((l: any) => !l.is_warmup)
                    const warmupLogs = logs.filter((l: any) => l.is_warmup)
                    const completedMain = mainLogs.filter((l: any) => l.completed).length
                    const plannedSets = ex.sets
                    const allDone = completedMain >= plannedSets
                    const noneDone = completedMain === 0

                    return (
                      <div key={ex.id} style={{
                        marginBottom: 6, padding: '0.75rem', background: C.white,
                        border: `1.5px solid ${noneDone ? '#FECACA' : allDone ? '#BBF7D0' : C.grayLight}`,
                        borderRadius: 12, borderLeft: `4px solid ${noneDone ? C.red : allDone ? C.green : C.gold}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: logs.length > 0 ? 8 : 0 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: C.navy }}>{exName}</div>
                            <div style={{ fontSize: '0.7rem', color: C.gray, marginTop: 1, fontFamily: mono }}>
                              Plan: {plannedSets}×{ex.reps || '—'}
                              {ex.tempo ? ` · ${ex.tempo}` : ''}
                              {ex.weight_kg ? ` · ${ex.weight_kg} kg` : ''}
                              {ex.rir != null ? ` · RIR ${ex.rir}` : ''}
                            </div>
                          </div>
                          <div style={{
                            fontFamily: mono, fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                            background: noneDone ? '#FEF2F2' : allDone ? '#F0FDF4' : '#FFFBEB',
                            color: noneDone ? C.red : allDone ? C.green : '#92400E',
                          }}>
                            {completedMain}/{plannedSets}
                          </div>
                        </div>

                        {/* Serie rozgrzewkowe */}
                        {warmupLogs.length > 0 && (
                          <div style={{ marginBottom: 6 }}>
                            {warmupLogs.map((l: any) => (
                              <div key={l.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0', fontSize: '0.75rem', color: C.gray }}>
                                <span style={{ fontFamily: mono, width: 28, flexShrink: 0 }}>WU{l.set_number}</span>
                                <span>{l.weight ? `${l.weight} kg` : '—'}</span>
                                <span>·</span>
                                <span>{l.reps_completed ? `${l.reps_completed} powt.` : '—'}</span>
                                {!l.completed && <span style={{ color: C.red, fontSize: '0.65rem' }}>nie ukończona</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Serie główne */}
                        {mainLogs.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 5 }}>
                            {mainLogs.map((l: any) => (
                              <div key={l.id} style={{
                                background: l.completed ? (allDone ? '#F0FDF4' : C.offWhite) : '#FEF2F2',
                                borderRadius: 8, padding: '0.5rem',
                                border: `1px solid ${l.completed ? (allDone ? '#BBF7D0' : C.grayLight) : '#FECACA'}`,
                                textAlign: 'center',
                              }}>
                                <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, marginBottom: 2 }}>S{l.set_number}</div>
                                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: l.completed ? C.navy : C.red }}>
                                  {l.weight ? `${l.weight} kg` : '—'}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: C.gray }}>
                                  {l.reps_completed ? `${l.reps_completed} ×` : '—'}
                                </div>
                                {l.rir != null && <div style={{ fontSize: '0.6rem', color: C.gray }}>RIR {l.rir}</div>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: C.red, fontStyle: 'italic' }}>Brak zapisanych serii</div>
                        )}

                        {/* Notatka zawodniczki */}
                        {mainLogs.find((l: any) => l.athlete_note) && (
                          <div style={{ marginTop: 6, padding: '0.5rem 0.625rem', background: '#FFFBEB', borderRadius: 8, fontSize: '0.76rem', color: '#92400E', borderLeft: `3px solid ${C.gold}` }}>
                            💬 {mainLogs.find((l: any) => l.athlete_note)?.athlete_note}
                          </div>
                        )}

                        {/* Komentarz trenera */}
                        {ex.coach_comment && (
                          <div style={{ marginTop: 6, padding: '0.5rem 0.625rem', background: C.offWhite, borderRadius: 8, fontSize: '0.76rem', color: C.gray, borderLeft: `3px solid ${C.grayLight}` }}>
                            Trener: {ex.coach_comment}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </Section>

          {/* ── WELLNESS ── */}
          {wellness && (
            <Section title="🩺 Wellness przed treningiem">
              <div style={{ background: C.white, borderRadius: 12, border: `1.5px solid ${C.grayLight}`, overflow: 'hidden' }}>
                {[
                  ['🌙 Sen', wellness.sleep_hours != null ? `${wellness.sleep_hours} h` : null],
                  ['💤 Jakość snu', wellness.sleep_quality != null ? `${wellness.sleep_quality}/10` : null],
                  ['😊 Wypoczęcie', wellness.readiness != null ? `${wellness.readiness}/10` : null],
                  ['⚡ Energia', wellness.energy != null ? `${wellness.energy}/10` : null],
                  ['🧠 Stres', wellness.stress != null ? `${wellness.stress}/10` : null],
                  ['🔥 Zakwasy', wellness.muscle_sorness != null ? `${wellness.muscle_sorness}/10` : null],
                  ['⚖️ Masa ciała', wellness.body_weight_kg != null ? `${wellness.body_weight_kg} kg` : null],
                  ['❤️ Tętno spocz.', wellness.resting_hr != null ? `${wellness.resting_hr} bpm` : null],
                ].filter(([, v]) => v != null).map(([label, value], i, arr) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLight}` : 'none' }}>
                    <span style={{ fontSize: '0.84rem', color: C.navy }}>{label}</span>
                    <span style={{ fontFamily: mono, fontWeight: 800, fontSize: '0.88rem', color: C.navy }}>{value}</span>
                  </div>
                ))}
                {wellness.concerns && (
                  <div style={{ padding: '0.75rem 1rem', background: '#FFFBEB', borderTop: `1px solid ${C.grayLight}`, fontSize: '0.82rem', color: '#92400E' }}>
                    💬 {wellness.concerns}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── BÓL ── */}
          {painLogs && painLogs.length > 0 && (
            <Section title="🩹 Zgłoszony ból">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {painLogs.map((p: any) => (
                  <div key={p.id} style={{ background: '#FEF2F2', border: `1.5px solid #FECACA`, borderRadius: 12, padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: C.navy }}>{p.location || 'Brak lokalizacji'}</span>
                      <span style={{ fontFamily: mono, fontWeight: 800, color: C.red }}>VAS {p.vas_score}/10</span>
                    </div>
                    {p.description && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 4 }}>{p.description}</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── FEEDBACK ── */}
          {(whatWentWell || painComment || generalNotes) && (
            <Section title="💬 Feedback zawodniczki">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: '✅ Co poszło dobrze', val: whatWentWell, color: C.green, bg: '#F0FDF4' },
                  { label: '🩹 Ból / dyskomfort', val: painComment, color: C.red, bg: '#FEF2F2' },
                  { label: '💬 Dodatkowe uwagi', val: generalNotes, color: C.gray, bg: C.offWhite },
                ].filter(f => f.val).map(f => (
                  <div key={f.label} style={{ background: f.bg, borderRadius: 12, padding: '0.75rem 1rem', borderLeft: `4px solid ${f.color}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: f.color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: '0.88rem', color: C.navy, lineHeight: 1.5 }}>{f.val}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── STATUS ── */}
          <div style={{ background: session.report_sent ? '#F0FDF4' : C.offWhite, borderRadius: 12, padding: '0.875rem 1rem', border: `1.5px solid ${session.report_sent ? '#BBF7D0' : C.grayLight}`, textAlign: 'center', fontSize: '0.84rem', color: session.report_sent ? '#166534' : C.gray, fontWeight: 600 }}>
            {session.report_sent ? '📧 Raport wysłany do trenera i na Twój email' : '📋 Raport zapisany lokalnie'}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderTop: `1.5px solid ${C.grayLight}`, padding: '1rem 1.25rem' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 10 }}>
            <button onClick={() => window.print()}
              style={{ flex: 1, padding: '0.875rem', border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, borderRadius: 12, fontFamily: sans, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
              🖨️ Drukuj raport
            </button>
            <button onClick={() => router.push('/athlete')}
              style={{ flex: 1, padding: '0.875rem', border: 'none', background: C.navy, color: C.gold, borderRadius: 12, fontFamily: sans, fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}>
              Wróć do panelu →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
