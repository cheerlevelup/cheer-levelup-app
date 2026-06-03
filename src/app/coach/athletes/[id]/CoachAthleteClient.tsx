'use client'
// src/app/coach/athletes/[id]/CoachAthleteClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E',
  red: '#EF4444', orange: '#F97316',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>
      {children}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>
      {title}
    </div>
  )
}

function avg(arr: number[]): string | null {
  if (arr.length === 0) return null
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
}

function toDateKey(iso: string) {
  return iso ? iso.split('T')[0] : ''
}

function rpeColor(rpe: number) {
  if (rpe <= 4) return C.green
  if (rpe <= 6) return C.gold
  if (rpe <= 8) return C.orange
  return C.red
}

// Modal z raportem wellness dla wybranego dnia
function WellnessDetailModal({ wellness, dateLabel, onClose }: { wellness: any; dateLabel: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 500, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Raport wellness</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>{dateLabel}</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {/* Podstawowe */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1rem' }}>
            {[
              ['Sen', wellness.sleep_hours != null ? `${wellness.sleep_hours}h` : null],
              ['Jakość snu', wellness.sleep_quality != null ? `${wellness.sleep_quality}/10` : null],
              ['Energia', wellness.energy != null ? `${wellness.energy}/10` : null],
              ['Stres', wellness.stress != null ? `${wellness.stress}/10` : null],
              ['Gotowość', wellness.readiness != null ? `${wellness.readiness}/10` : null],
              ['Zakwasy', wellness.muscle_sorness != null ? `${wellness.muscle_sorness}/10` : null],
            ].filter(([, v]) => v != null).map(([label, value]) => (
              <div key={label as string} style={{ background: C.offWhite, borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: mono, fontSize: '1.1rem', fontWeight: 800, color: C.navy }}>{value}</div>
              </div>
            ))}
          </div>
          {/* Dodatkowe pola */}
          {wellness.body_weight_kg && (
            <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: C.offWhite, borderRadius: 10 }}>
              <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray }}>MASA CIAŁA: </span>
              <span style={{ fontFamily: mono, fontWeight: 800, color: C.navy }}>{wellness.body_weight_kg} kg</span>
            </div>
          )}
          {/* Aktywność */}
          {wellness.activity_data?.type && (
            <div style={{ marginBottom: '0.75rem', padding: '0.875rem', background: C.offWhite, borderRadius: 10 }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Aktywność</div>
              <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>{wellness.activity_data.type}</div>
              <div style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>
                {wellness.activity_data.time && `${wellness.activity_data.time} · `}
                {wellness.activity_data.duration && `${wellness.activity_data.duration} min · `}
                {wellness.activity_data.rpe != null && `RPE ${wellness.activity_data.rpe}/10`}
              </div>
              {wellness.activity_data.note && (
                <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: 6, fontStyle: 'italic' }}>{wellness.activity_data.note}</div>
              )}
            </div>
          )}
          {/* Ból */}
          {wellness.pain_data?.painDuring != null && wellness.pain_data.painDuring > 0 && (
            <div style={{ marginBottom: '0.75rem', padding: '0.875rem', background: '#FEF2F2', border: `1.5px solid #FCA5A5`, borderRadius: 10 }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Ból podczas treningu</div>
              <div style={{ fontFamily: mono, fontWeight: 800, color: C.red }}>{wellness.pain_data.painDuring}/10</div>
              {wellness.pain_data.location && <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: 4 }}>📍 {wellness.pain_data.location}</div>}
              {wellness.pain_data.note && <div style={{ fontSize: '0.82rem', color: C.gray, marginTop: 4, fontStyle: 'italic' }}>{wellness.pain_data.note}</div>}
            </div>
          )}
          {/* Uwagi */}
          {wellness.concerns && (
            <div style={{ padding: '0.875rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, marginBottom: '0.75rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Uwagi dla trenera</div>
              <div style={{ fontSize: '0.86rem', color: C.navy, fontStyle: 'italic' }}>&ldquo;{wellness.concerns}&rdquo;</div>
            </div>
          )}
          <button onClick={onClose} style={{ width: '100%', padding: '0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontWeight: 800, fontFamily: sans }}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  athlete: any
  assignment: any
  pastAssignments: any[]
  sessions: any[]
  feedbacks: any[]
  wellnessLogs: any[]
  wellnessList: any[]
  dietLogs: any[]
  painLogs: any[]
}

export default function CoachAthleteClient({ athlete, assignment, pastAssignments, sessions, feedbacks, wellnessLogs, wellnessList, dietLogs, painLogs }: Props) {
  const router = useRouter()
  const [planTab, setPlanTab] = useState<'active' | 'history'>('active')
  const [selectedWellness, setSelectedWellness] = useState<{ wellness: any; dateLabel: string } | null>(null)

  const completedSessions = sessions.filter(s => s.completed)
  const feedbackMap: Record<number, any> = {}
  for (const f of feedbacks) feedbackMap[f.workout_session_id || f.session_id] = f

  const avgRpe = feedbacks.length > 0
    ? avg(feedbacks.map(f => f.session_rpe).filter((v): v is number => v != null))
    : null

  const wellnessSleepAvg = avg(wellnessLogs.map(w => w.sleep_hours).filter((v): v is number => v != null))
  const wellnessEnergyAvg = avg(wellnessLogs.map(w => w.energy).filter((v): v is number => v != null))
  const wellnessStressAvg = avg(wellnessLogs.map(w => w.stress).filter((v): v is number => v != null))
  const wellnessReadinessAvg = avg(wellnessLogs.map(w => w.readiness).filter((v): v is number => v != null))

  // Indeksy po dacie
  const wellnessByDate: Record<string, any> = {}
  for (const w of wellnessLogs) {
    const k = toDateKey(w.created_at)
    if (k) wellnessByDate[k] = w
  }
  const dietByDate: Record<string, any> = {}
  for (const d of dietLogs) {
    if (d.date) dietByDate[d.date] = d
  }

  const completedByDate: Record<string, { session: any; num: number }> = {}
  const sortedCompleted = [...completedSessions].sort(
    (a, b) => new Date(a.date_completed || a.date_started || 0).getTime() - new Date(b.date_completed || b.date_started || 0).getTime()
  )
  sortedCompleted.forEach((s, i) => {
    const key = toDateKey(s.date_completed || s.date_started || '')
    if (key) completedByDate[key] = { session: s, num: i + 1 }
  })

  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const todayKey = todayDate.toISOString().split('T')[0]
  const calendarDays: Date[] = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(todayDate); d.setDate(d.getDate() - i); calendarDays.push(d)
  }
  const weeks: Date[][] = []
  for (let i = 0; i < calendarDays.length; i += 7) weeks.push(calendarDays.slice(i, i + 7))
  const dayNames = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']

  const lastWellness = wellnessList[0]

  function openWellness(key: string) {
    const w = wellnessByDate[key]
    if (!w) return
    const day = new Date(key)
    const dateLabel = day.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    setSelectedWellness({ wellness: w, dateLabel })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      {selectedWellness && (
        <WellnessDetailModal
          wellness={selectedWellness.wellness}
          dateLabel={selectedWellness.dateLabel}
          onClose={() => setSelectedWellness(null)}
        />
      )}

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>

        {/* Header — bez przycisku edytuj */}
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => athlete.group_id ? router.push(`/coach/groups/${athlete.group_id}`) : router.push('/coach')}
              style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}
            >
              ← {athlete.group?.name || 'Panel'}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Zawodniczka</div>
              <h1 style={{ color: C.white, fontSize: '1.25rem', fontWeight: 800 }}>{athlete.full_name}</h1>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 800, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>

          {/* Profil */}
          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <SectionHeader title="Profil" />
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: C.navy, marginBottom: 5 }}>{athlete.full_name}</div>
                {athlete.group?.name && <div style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray, marginBottom: 2 }}>Grupa: {athlete.group.name}</div>}
                {athlete.birth_year && <div style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>ur. {athlete.birth_year}</div>}
              </div>

              {/* Plany — zakładki Aktywny / Historia */}
              <div>
                <div style={{ display: 'flex', gap: 1, marginBottom: '0.875rem' }}>
                  {(['active', 'history'] as const).map(tab => (
                    <button key={tab} onClick={() => setPlanTab(tab)}
                      style={{ padding: '0.4rem 0.75rem', border: 'none', borderRadius: tab === 'active' ? '8px 0 0 8px' : '0 8px 8px 0', background: planTab === tab ? C.navy : C.grayLight, color: planTab === tab ? C.gold : C.gray, fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {tab === 'active' ? 'Aktywny' : `Historia (${pastAssignments.length})`}
                    </button>
                  ))}
                </div>

                {planTab === 'active' ? (
                  assignment ? (
                    <>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: C.navy, marginBottom: 4 }}>{assignment.plan?.name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray, marginBottom: 10 }}>
                        {assignment.order_mode === 'sequential' ? 'Sekwencyjny' : 'Datowany'} · od {new Date(assignment.start_date).toLocaleDateString('pl-PL')}
                      </div>
                      <button
                        onClick={() => router.push(`/coach/athletes/${athlete.id}/training`)}
                        style={{ padding: '0.5rem 0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '0.78rem' }}
                      >
                        ✎ Modyfikuj ćwiczenia →
                      </button>
                    </>
                  ) : (
                    <div style={{ color: C.gray, fontSize: '0.86rem', fontStyle: 'italic' }}>Brak aktywnego planu</div>
                  )
                ) : (
                  pastAssignments.length === 0 ? (
                    <div style={{ color: C.gray, fontSize: '0.86rem', fontStyle: 'italic' }}>Brak historii planów</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pastAssignments.map(a => (
                        <div key={a.id} style={{ padding: '0.625rem 0.875rem', background: C.offWhite, borderRadius: 8, border: `1.5px solid ${C.grayLight}` }}>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: C.navy }}>{a.plan?.name}</div>
                          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 2 }}>
                            od {new Date(a.start_date || a.created_at).toLocaleDateString('pl-PL')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </Card>

          {/* Szybkie statystyki */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1rem' }}>
            {[
              { label: 'Treningi', value: completedSessions.length, color: C.navy },
              { label: 'Śr. RPE', value: avgRpe ?? '—', color: avgRpe ? rpeColor(parseFloat(avgRpe)) : C.gray },
              { label: 'Wellness', value: `${wellnessLogs.length}d`, color: C.green },
              { label: 'Dieta', value: `${dietLogs.length}d`, color: C.gold },
            ].map(stat => (
              <Card key={stat.label}>
                <div style={{ padding: '0.875rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{stat.label}</div>
                  <div style={{ fontFamily: mono, fontSize: '1.5rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Wellness — średnie */}
          {wellnessLogs.length > 0 && (
            <Card style={{ marginBottom: '1rem' }}>
              <div style={{ padding: '1rem 1.25rem' }}>
                <SectionHeader title={`Wellness — średnie z 28 dni (${wellnessLogs.length} wpisów)`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Sen', value: wellnessSleepAvg, unit: 'h', max: 12, inverse: false },
                    { label: 'Energia', value: wellnessEnergyAvg, unit: '/10', max: 10, inverse: false },
                    { label: 'Stres', value: wellnessStressAvg, unit: '/10', max: 10, inverse: true },
                    { label: 'Gotowość', value: wellnessReadinessAvg, unit: '/10', max: 10, inverse: false },
                  ].map(stat => {
                    const num = stat.value ? parseFloat(stat.value) : null
                    const pct = num ? (num / stat.max) * 100 : 0
                    const barColor = stat.inverse ? (pct > 60 ? C.red : pct > 30 ? C.gold : C.green) : (pct > 60 ? C.green : pct > 30 ? C.gold : C.red)
                    return (
                      <div key={stat.label}>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontFamily: mono, fontSize: '1.1rem', fontWeight: 800, color: C.navy, marginBottom: 6 }}>{stat.value ?? '—'}{stat.value ? stat.unit : ''}</div>
                        {num != null && <div style={{ height: 4, background: C.grayLight, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} /></div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Kalendarz — klikalne kółeczka wellness */}
          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1rem 1.25rem' }}>
              <SectionHeader title="Kalendarz — ostatnie 28 dni" />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
                  <thead>
                    <tr>
                      {dayNames.map(d => (
                        <th key={d} style={{ padding: '0 4px 8px', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray, fontWeight: 700 }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((week, wi) => (
                      <tr key={wi}>
                        {week.map(day => {
                          const key = day.toISOString().split('T')[0]
                          const isToday = key === todayKey
                          const wellnessEntry = wellnessByDate[key]
                          const hasWellness = !!wellnessEntry
                          const hasDiet = !!dietByDate[key]
                          const trainingInfo = completedByDate[key]
                          return (
                            <td key={key} style={{ padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                              <div style={{ minHeight: 72, padding: '5px 3px', borderRadius: 8, background: isToday ? C.navyLight : 'transparent', border: isToday ? `1.5px solid ${C.gold}` : '1.5px solid transparent' }}>
                                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: isToday ? C.gold : C.gray, fontWeight: isToday ? 800 : 400, marginBottom: 5 }}>
                                  {day.getDate()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                  {/* Wellness — klikalny jeśli uzupełniony */}
                                  <button
                                    title={hasWellness ? 'Kliknij aby zobaczyć raport wellness' : 'Brak wellness tego dnia'}
                                    onClick={() => hasWellness && openWellness(key)}
                                    style={{
                                      width: 16, height: 16, borderRadius: '50%',
                                      background: hasWellness ? C.green : C.red,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '0.5rem', color: C.white, fontWeight: 800,
                                      border: 'none', padding: 0,
                                      cursor: hasWellness ? 'pointer' : 'default',
                                      transition: 'transform 0.1s',
                                    }}
                                  >
                                    {hasWellness ? '✓' : ''}
                                  </button>
                                  {/* Dieta */}
                                  {hasDiet && <div title="Dieta uzupełniona" style={{ fontSize: '0.72rem', lineHeight: 1 }}>🥗</div>}
                                  {/* Trening */}
                                  {trainingInfo && (
                                    <div title={`Trening #${trainingInfo.num}`} style={{ position: 'relative', width: 18, height: 18 }}>
                                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>🏋️</div>
                                      <div style={{ position: 'absolute', top: -4, right: -5, width: 12, height: 12, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.48rem', fontWeight: 900, color: C.navy }}>
                                        {trainingInfo.num}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: `1.5px solid ${C.grayLight}` }}>
                {[
                  { icon: <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.green }} />, label: 'Wellness ✓ (kliknij aby zobaczyć)' },
                  { icon: <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.red }} />, label: 'Wellness brak' },
                  { icon: <span style={{ fontSize: '0.7rem' }}>🥗</span>, label: 'Dieta' },
                  { icon: <span style={{ fontSize: '0.7rem' }}>🏋️</span>, label: 'Trening (nr w planie)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {item.icon}
                    <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Ostatni wellness */}
          {lastWellness && (
            <Card style={{ marginBottom: '1rem' }}>
              <div style={{ padding: '1rem 1.25rem' }}>
                <SectionHeader title={`Ostatni wellness — ${new Date(lastWellness.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                  {([
                    ['Sen', lastWellness.sleep_hours != null ? `${lastWellness.sleep_hours}h` : null],
                    ['Energia', lastWellness.energy != null ? `${lastWellness.energy}/10` : null],
                    ['Stres', lastWellness.stress != null ? `${lastWellness.stress}/10` : null],
                    ['Gotowość', lastWellness.readiness != null ? `${lastWellness.readiness}/10` : null],
                  ] as [string, string | null][]).filter(([, v]) => v != null).map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontFamily: mono, fontSize: '1rem', fontWeight: 800, color: C.navy }}>{value}</div>
                    </div>
                  ))}
                </div>
                {lastWellness.concerns && (
                  <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '0.75rem', fontSize: '0.86rem', color: C.navy, fontStyle: 'italic' }}>
                    💬 &ldquo;{lastWellness.concerns}&rdquo;
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Zgłoszenia bólu */}
          {painLogs.length > 0 && (
            <Card style={{ marginBottom: '1rem' }}>
              <div style={{ padding: '1rem 1.25rem' }}>
                <SectionHeader title="Zgłoszenia bólu" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {painLogs.slice(0, 5).map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: C.offWhite, borderRadius: 10, border: `1.5px solid ${C.grayLight}` }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: C.navy }}>{p.location || '—'}</div>
                        {p.description && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 2 }}>{p.description}</div>}
                        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 3 }}>{new Date(p.created_at).toLocaleDateString('pl-PL')}</div>
                      </div>
                      <div style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 800, color: p.vas_score >= 7 ? C.red : p.vas_score >= 4 ? C.orange : C.green, background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                        VAS {p.vas_score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Historia treningów */}
          <Card>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
              <SectionHeader title="Historia treningów" />
            </div>
            {completedSessions.length === 0 ? (
              <div style={{ padding: '1.5rem', color: C.gray, fontSize: '0.9rem', textAlign: 'center' }}>Brak ukończonych treningów.</div>
            ) : (
              completedSessions.slice(0, 15).map((s: any, i: number, arr: any[]) => {
                const fb = feedbackMap[s.id]
                return (
                  <div key={s.id} style={{ padding: '0.875rem 1.25rem', borderBottom: i < arr.length - 1 ? `1.5px solid ${C.grayLight}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy, marginBottom: 2 }}>
                        {s.workout_day?.day_name || 'Trening'}
                        {s.report_sent && <span style={{ marginLeft: 8, fontSize: '0.75rem' }}>📋</span>}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray }}>
                        {s.date_completed ? new Date(s.date_completed).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '—'}
                        {s.workout_day?.week?.plan?.name && ` · ${s.workout_day.week.plan.name}`}
                      </div>
                      {fb?.what_went_well && <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 3, fontStyle: 'italic' }}>&ldquo;{fb.what_went_well}&rdquo;</div>}
                    </div>
                    {fb?.session_rpe && (
                      <div style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 800, color: rpeColor(fb.session_rpe), background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                        RPE {fb.session_rpe}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </Card>

        </main>
      </div>
    </>
  )
}
