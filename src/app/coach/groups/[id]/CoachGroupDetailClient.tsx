'use client'
// src/app/coach/groups/[id]/CoachGroupDetailClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModuleConfigPanel from '@/components/ModuleConfigPanel'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>{children}</div>
}

function CellStatus({ session }: { session: any | null }) {
  if (!session) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.grayLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>○</div>
  if (session.completed && session.report_sent) return <div title="Raport wysłany" style={{ width: 28, height: 28, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>📋</div>
  if (session.completed) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.white, fontWeight: 800 }}>✓</div>
  return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.7rem', color: C.navy, fontWeight: 800 }}>◑</div>
}

function AssignPlanModal({ athletes, plans, onClose, onAssigned }: {
  athletes: any[]; plans: any[]
  onClose: () => void; onAssigned: () => void
}) {
  const supabase = createClient()
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedAthletes, setSelectedAthletes] = useState<number[]>(athletes.map(a => a.id))
  const [orderMode, setOrderMode] = useState<'sequential' | 'dated'>('sequential')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleAthlete(id: number) {
    setSelectedAthletes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAssign() {
    if (!selectedPlanId || selectedAthletes.length === 0) return
    setSaving(true); setError('')
    try {
      await supabase.from('athlete_workout_assignments')
        .update({ is_active: false })
        .in('athlete_id', selectedAthletes)
        .eq('is_active', true)

      const rows = selectedAthletes.map(athleteId => ({
        athlete_id: athleteId,
        plan_id: parseInt(selectedPlanId),
        is_active: true,
        order_mode: orderMode,
        start_date: new Date().toISOString().split('T')[0],
      }))
      const { error: err } = await supabase.from('athlete_workout_assignments').insert(rows)
      if (err) throw err
      onAssigned()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 480, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Przypisz plan</div>
          <h2 style={{ color: C.white, fontSize: '1.15rem', fontWeight: 800 }}>Wybierz plan dla zawodniczek</h2>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Plan treningowy</div>
            <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem', outline: 'none', appearance: 'none' }}>
              <option value="">Wybierz plan...</option>
              {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Tryb realizacji</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ v: 'sequential', label: 'Sekwencyjny', desc: 'Treningi po kolei' }, { v: 'dated', label: 'Datowany', desc: 'Wg daty' }].map(opt => (
                <button key={opt.v} onClick={() => setOrderMode(opt.v as 'sequential' | 'dated')}
                  style={{ padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${orderMode === opt.v ? C.gold : C.grayLight}`, background: orderMode === opt.v ? C.navy : C.offWhite, color: orderMode === opt.v ? C.gold : C.navy, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.72rem', color: C.gray, marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Zawodniczki</div>
              <button onClick={() => setSelectedAthletes(selectedAthletes.length === athletes.length ? [] : athletes.map(a => a.id))}
                style={{ background: 'none', border: 'none', color: C.gold, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                {selectedAthletes.length === athletes.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {athletes.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.875rem', border: `1.5px solid ${selectedAthletes.includes(a.id) ? C.gold : C.grayLight}`, borderRadius: 10, background: selectedAthletes.includes(a.id) ? C.navyLight : C.offWhite, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedAthletes.includes(a.id)} onChange={() => toggleAthlete(a.id)} style={{ accentColor: C.gold, width: 16, height: 16 }} />
                  <span style={{ fontWeight: 600, color: selectedAthletes.includes(a.id) ? C.white : C.navy, fontSize: '0.9rem' }}>{a.full_name}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.82rem', marginBottom: '1rem' }}>❌ {error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            <button onClick={handleAssign} disabled={!selectedPlanId || selectedAthletes.length === 0 || saving}
              style={{ flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12, background: !selectedPlanId || selectedAthletes.length === 0 ? C.grayLight : C.navy, color: !selectedPlanId || selectedAthletes.length === 0 ? C.gray : C.gold, fontWeight: 900 }}>
              {saving ? 'Przypisuję...' : `Przypisz plan (${selectedAthletes.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type Tab = 'plan' | 'wellness' | 'diet'

export default function CoachGroupDetailClient({ group, athletes, assignments, days, sessions, plans }: any) {
  const router = useRouter()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignedMsg, setAssignedMsg] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('plan')
  const [moduleConfig, setModuleConfig] = useState<'wellness' | 'diet' | null>(null)

  const sessionIndex: Record<string, any> = {}
  for (const s of sessions) {
    const key = `${s.athlete_id}_${s.workout_day_id}`
    if (!sessionIndex[key] || new Date(s.created_at) > new Date(sessionIndex[key].created_at)) sessionIndex[key] = s
  }

  function getAthleteProgress(athleteId: number) {
    if (days.length === 0) return null
    const done = days.filter((d: any) => sessionIndex[`${athleteId}_${d.id}`]?.completed).length
    return { done, total: days.length }
  }

  const currentPlan = assignments[0]?.plan

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} body{background:${C.offWhite};} button{cursor:pointer;font-family:inherit;} ::-webkit-scrollbar{height:4px;} ::-webkit-scrollbar-thumb{background:#ccc;}`}</style>

      {showAssignModal && (
        <AssignPlanModal
          athletes={athletes} plans={plans}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { setAssignedMsg('Plan przypisany!'); router.refresh() }}
        />
      )}
      {moduleConfig && (
        <ModuleConfigPanel
          groupId={group.id}
          module={moduleConfig}
          onClose={() => setModuleConfig(null)}
        />
      )}

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.5rem' }}>
              <button onClick={() => router.push('/coach')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>← Panel</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Grupa</div>
                <h1 style={{ color: C.white, fontSize: '1.25rem', fontWeight: 800 }}>{group.name}</h1>
              </div>
              <button onClick={() => setShowAssignModal(true)} style={{ border: 'none', background: C.gold, color: C.navy, borderRadius: 10, padding: '0.65rem 0.875rem', fontWeight: 800, fontSize: '0.82rem', flexShrink: 0 }}>
                + Przypisz plan
              </button>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>{athletes.length} zawodniczek</span>
              {currentPlan && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gold }}>📋 {currentPlan.name}</span>}
              {assignedMsg && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.green }}>✓ {assignedMsg}</span>}
            </div>
          </div>
        </header>

        {/* Tab navigation */}
        <div style={{ background: C.navyLight, borderBottom: `1.5px solid ${C.navyBorder}` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 0 }}>
            {([
              { id: 'plan',     label: '📋 Plan' },
              { id: 'wellness', label: '🩺 Wellness' },
              { id: 'diet',     label: '🥗 Dieta' },
            ] as { id: Tab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '0.7rem 1.1rem', border: 'none', background: 'transparent', color: activeTab === t.id ? C.gold : C.gray, fontWeight: activeTab === t.id ? 800 : 600, fontFamily: mono, fontSize: '0.72rem', borderBottom: activeTab === t.id ? `2px solid ${C.gold}` : '2px solid transparent', cursor: 'pointer', letterSpacing: '0.04em' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {/* ── Wellness tab ── */}
          {activeTab === 'wellness' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Card>
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Konfiguracja grupy</div>
                  <p style={{ color: C.gray, fontSize: '0.84rem', marginBottom: '1rem' }}>Ustaw które parametry wellness widzą wszystkie zawodniczki w grupie. Możesz nadpisać ustawienia indywidualnie dla każdej zawodniczki.</p>
                  <button onClick={() => setModuleConfig('wellness')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.75rem 1.1rem', fontWeight: 800, cursor: 'pointer' }}>
                    🩺 Skonfiguruj wellness dla grupy
                  </button>
                </div>
              </Card>
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ustawienia indywidualne</div>
                </div>
                {athletes.map((athlete: any, i: number) => (
                  <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                    <div style={{ fontWeight: 700, color: C.navy }}>{athlete.full_name}</div>
                    <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 8, padding: '0.4rem 0.75rem', fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                      Edytuj →
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* ── Diet tab ── */}
          {activeTab === 'diet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Card>
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Konfiguracja grupy</div>
                  <p style={{ color: C.gray, fontSize: '0.84rem', marginBottom: '1rem' }}>Ustaw które parametry dziennika diety widzą zawodniczki. Możesz wyłączyć dietę dla całej grupy lub poszczególnych zawodniczek.</p>
                  <button onClick={() => setModuleConfig('diet')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.75rem 1.1rem', fontWeight: 800, cursor: 'pointer' }}>
                    🥗 Skonfiguruj dietę dla grupy
                  </button>
                </div>
              </Card>
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ustawienia indywidualne</div>
                </div>
                {athletes.map((athlete: any, i: number) => (
                  <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                    <div style={{ fontWeight: 700, color: C.navy }}>{athlete.full_name}</div>
                    <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 8, padding: '0.4rem 0.75rem', fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                      Edytuj →
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* ── Plan tab ── */}
          {activeTab === 'plan' && athletes.length === 0 ? (
            <Card><div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak zawodniczek w tej grupie.</div></Card>
          ) : activeTab === 'plan' && (
            <>
              {assignments.length > 0 && days.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Realizacja planu</div>
                    <div style={{ fontWeight: 800, color: C.navy }}>{currentPlan?.name} · {days.length} dni</div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', background: C.offWhite, position: 'sticky', left: 0, zIndex: 2, borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>Zawodniczka</th>
                          <th style={{ padding: '0.75rem 0.875rem', textAlign: 'center', fontFamily: mono, fontSize: '0.62rem', color: C.gray, background: C.offWhite, borderBottom: `1.5px solid ${C.grayLight}` }}>Postęp</th>
                          {days.map((day: any, i: number) => (
                            <th key={day.id} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray, background: C.offWhite, borderBottom: `1.5px solid ${C.grayLight}`, minWidth: 44 }}>
                              <div style={{ fontWeight: 700, color: C.navy }}>T{i + 1}</div>
                              <div style={{ fontSize: '0.55rem', marginTop: 1 }}>{(day.day_name || '').replace('Dzień ', '').replace('Trening ', '')}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, rowIdx: number) => {
                          const progress = getAthleteProgress(athlete.id)
                          const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0
                          return (
                            <tr key={athlete.id} style={{ background: rowIdx % 2 === 0 ? C.white : C.offWhite }}>
                              <td style={{ padding: '0.75rem 1.25rem', position: 'sticky', left: 0, zIndex: 1, background: rowIdx % 2 === 0 ? C.white : C.offWhite, borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>
                                <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', padding: 0 }}>{athlete.full_name}</button>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', borderBottom: `1.5px solid ${C.grayLight}` }}>
                                {progress ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                    <div style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 800, color: pct === 100 ? C.green : C.navy }}>{pct}%</div>
                                    <div style={{ width: 48, height: 4, background: C.grayLight, borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : C.gold, borderRadius: 2 }} />
                                    </div>
                                    <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray }}>{progress.done}/{progress.total}</div>
                                  </div>
                                ) : <span style={{ color: C.gray, fontSize: '0.75rem' }}>—</span>}
                              </td>
                              {days.map((day: any) => (
                                <td key={day.id} style={{ padding: '0.5rem', textAlign: 'center', borderBottom: `1.5px solid ${C.grayLight}` }}>
                                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <CellStatus session={sessionIndex[`${athlete.id}_${day.id}`] || null} />
                                  </div>
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '0.75rem 1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {[{ symbol: '○', label: 'Niewykonany', bg: C.grayLight, color: C.gray }, { symbol: '✓', label: 'Wykonany', bg: C.green, color: C.white }, { symbol: '📋', label: 'Raport', bg: C.navy, color: C.white }, { symbol: '◑', label: 'W trakcie', bg: C.gold, color: C.navy }].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem' }}>{item.symbol}</div>
                        <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Zawodniczki</div>
                </div>
                {athletes.map((athlete: any, i: number) => {
                  const progress = getAthleteProgress(athlete.id)
                  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0
                  return (
                    <button key={athlete.id} onClick={() => router.push(`/coach/athletes/${athlete.id}`)}
                      style={{ width: '100%', background: 'none', border: 'none', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: C.navy }}>{athlete.full_name}</div>
                        {athlete.birth_year && <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, marginTop: 2 }}>ur. {athlete.birth_year}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {progress && <div style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 800, color: pct === 100 ? C.green : C.navy }}>{pct}%</div>}
                        <span style={{ color: C.gray }}>›</span>
                      </div>
                    </button>
                  )
                })}
              </Card>
            </>
          )}
        </main>
      </div>
    </>
  )
}
