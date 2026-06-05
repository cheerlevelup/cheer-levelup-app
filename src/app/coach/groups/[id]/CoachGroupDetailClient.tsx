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

const thStyle: React.CSSProperties = { padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray, background: C.offWhite, borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap', minWidth: 44 }
function tdWs(bg: string): React.CSSProperties { return { padding: '0.4rem 0.5rem', textAlign: 'center', borderBottom: `1.5px solid ${C.grayLight}`, background: bg, verticalAlign: 'middle' } }
function statTd(bg: string): React.CSSProperties { return { padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, background: bg, fontFamily: mono, fontSize: '0.78rem', fontWeight: 700, color: C.navy } }

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

// ── Wellness helpers ──────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function colorBand(val: number | null, thresholds: [number, number], colors: [string, string, string]): string {
  if (val === null) return C.gray
  if (val <= thresholds[0]) return colors[0]
  if (val <= thresholds[1]) return colors[1]
  return colors[2]
}

function Dot({ color, title }: { color: string; title?: string }) {
  return <div title={title} style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function WellnessBadge({ value, label, color }: { value: string; label?: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.72rem', fontWeight: 800, color }}>{value}</div>
      {label && <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.5rem', color: C.gray }}>{label}</div>}
    </div>
  )
}

function getAthleteWellnessSummary(athleteId: number, logs: any[]) {
  const myLogs = logs.filter((l: any) => l.athlete_id === athleteId)
  const today = new Date().toISOString().split('T')[0]
  const hasToday = myLogs.some((l: any) => l.date === today)

  const sleepVals = myLogs.map((l: any) => l.sleep_hours).filter((v: any) => v != null) as number[]
  const stressVals = myLogs.map((l: any) => l.stress).filter((v: any) => v != null) as number[]

  // Pain: max pain_during from last 7 days
  const painVals = myLogs
    .map((l: any) => l.pain_data?.painDuring ?? null)
    .filter((v: any) => v != null) as number[]
  const maxPain = painVals.length ? Math.max(...painVals) : null

  // Activity hours
  const totalMinutes = myLogs.reduce((sum: number, l: any) => {
    const dur = parseInt(l.activity_data?.duration || '0') || 0
    return sum + dur
  }, 0)
  const activityHours = totalMinutes > 0 ? +(totalMinutes / 60).toFixed(1) : null

  // Cycle
  const latestCycle = myLogs.find((l: any) => l.cycle_phase)?.cycle_phase ?? null

  return {
    hasToday,
    sleepAvg: avg(sleepVals),
    stressAvg: avg(stressVals),
    maxPain,
    activityHours,
    latestCycle,
    entryCount: myLogs.length,
  }
}

export default function CoachGroupDetailClient({ group, athletes, assignments, days, sessions, plans, wellnessLogs = [], wellnessWeek = [], feedbacks = [], dietLogs = [] }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignedMsg, setAssignedMsg] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('plan')
  const [moduleConfig, setModuleConfig] = useState<'wellness' | 'diet' | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)

  const sessionIndex: Record<string, any> = {}
  for (const s of sessions) {
    const key = `${s.athlete_id}_${s.workout_day_id}`
    if (!sessionIndex[key] || new Date(s.created_at) > new Date(sessionIndex[key].created_at)) sessionIndex[key] = s
  }

  const currentPlan = assignments[0]?.plan
  const activePlanId = selectedPlanId ?? currentPlan?.id ?? null
  const activePlanDays = activePlanId
    ? days.filter((d: any) => d.week?.plan_id === activePlanId)
    : days

  function getAthleteProgress(athleteId: number) {
    if (activePlanDays.length === 0) return null
    const done = activePlanDays.filter((d: any) => sessionIndex[`${athleteId}_${d.id}`]?.completed).length
    return { done, total: activePlanDays.length }
  }

  // Archive plan
  async function archivePlan(planId: number) {
    if (!confirm('Zarchiwizować ten plan? Nie będzie można go edytować. Zawodniczki zachowają dostęp do historii.')) return
    await supabase.from('workout_plans').update({ is_archived: true }).eq('id', planId)
    router.refresh()
  }

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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {assignments.length > 1 && (
                  <select value={selectedPlanId ?? ''} onChange={e => setSelectedPlanId(e.target.value ? parseInt(e.target.value) : null)}
                    style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 9, padding: '0.5rem 0.65rem', fontFamily: "'Space Mono',monospace", fontSize: '0.7rem', outline: 'none' }}>
                    <option value="">Aktualny plan</option>
                    {assignments.map((a: any) => <option key={a.plan_id} value={a.plan_id}>{a.plan?.name}</option>)}
                  </select>
                )}
                <button onClick={() => setShowAssignModal(true)} style={{ border: 'none', background: C.gold, color: C.navy, borderRadius: 10, padding: '0.65rem 0.875rem', fontWeight: 800, fontSize: '0.82rem', flexShrink: 0 }}>
                  + Przypisz plan
                </button>
              </div>
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
          {/* ══ WELLNESS TAB ══════════════════════════════════════════════════════ */}
          {activeTab === 'wellness' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Config + individual overrides */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Konfiguracja parametrów</div>
                  <button onClick={() => setModuleConfig('wellness')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                    🩺 Edytuj dla grupy
                  </button>
                </div>
                {athletes.map((athlete: any, i: number) => {
                  const ws = getAthleteWellnessSummary(athlete.id, wellnessWeek)
                  return (
                    <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1, fontWeight: 700, color: C.navy, fontSize: '0.9rem' }}>{athlete.full_name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: ws.hasToday ? C.green : ws.entryCount > 0 ? C.gold : C.red }}>{ws.hasToday ? '✅ dziś' : ws.entryCount > 0 ? `⚠️ ${ws.entryCount} wpisów` : '✗ brak'}</div>
                      <button onClick={() => router.push(`/coach/athletes/${athlete.id}?tab=wellness`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.35rem 0.65rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                        Konfiguruj →
                      </button>
                    </div>
                  )
                })}
              </Card>

              {/* Wellness stats per athlete — 30 days */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Statystyki wellness — ostatnie 30 dni</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: C.offWhite }}>
                        {['Zawodniczka', 'Wpisów', 'Sen śr.', 'Energia śr.', 'Stres śr.', 'Gotowość śr.', 'Max ból', 'Akt. godz.', 'Cykl'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.75rem', fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Zawodniczka' ? 'left' : 'center', borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {athletes.map((athlete: any, ri: number) => {
                        const logs30 = wellnessLogs.filter((l: any) => l.athlete_id === athlete.id)
                        const sleepAvg = avg(logs30.map((l: any) => l.sleep_hours).filter((v: any) => v != null))
                        const energyAvg = avg(logs30.map((l: any) => l.energy).filter((v: any) => v != null))
                        const stressAvg = avg(logs30.map((l: any) => l.stress).filter((v: any) => v != null))
                        const readinessAvg = avg(logs30.map((l: any) => l.readiness).filter((v: any) => v != null))
                        const maxPain = logs30.reduce((m: number | null, l: any) => {
                          const p = l.pain_data?.painDuring ?? null
                          if (p === null) return m
                          return m === null ? p : Math.max(m, p)
                        }, null as number | null)
                        const totalMin = logs30.reduce((s: number, l: any) => s + (parseInt(l.activity_data?.duration || '0') || 0), 0)
                        const actH = totalMin > 0 ? (totalMin / 60).toFixed(1) : null
                        const latestCycle = logs30.find((l: any) => l.cycle_phase)?.cycle_phase ?? null
                        const rowBg = ri % 2 === 0 ? C.white : C.offWhite

                        const sc = (v: number | null, lo: number, hi: number) =>
                          v === null ? C.gray : v < lo ? C.red : v < hi ? C.gold : C.green
                        const stressC = stressAvg === null ? C.gray : stressAvg >= 8 ? C.red : stressAvg >= 5 ? C.gold : C.green

                        return (
                          <tr key={athlete.id} style={{ background: rowBg }}>
                            <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.grayLight}` }}>
                              <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.88rem' }}>{athlete.full_name}</button>
                            </td>
                            <td style={{ ...statTd(rowBg), color: logs30.length === 0 ? C.red : C.navy }}>{logs30.length}</td>
                            <td style={{ ...statTd(rowBg), color: sc(sleepAvg, 5, 7) }}>{sleepAvg !== null ? `${sleepAvg.toFixed(1)}h` : '—'}</td>
                            <td style={{ ...statTd(rowBg), color: sc(energyAvg, 4, 7) }}>{energyAvg !== null ? energyAvg.toFixed(1) : '—'}</td>
                            <td style={{ ...statTd(rowBg), color: stressC }}>{stressAvg !== null ? stressAvg.toFixed(1) : '—'}</td>
                            <td style={{ ...statTd(rowBg), color: sc(readinessAvg, 4, 7) }}>{readinessAvg !== null ? readinessAvg.toFixed(1) : '—'}</td>
                            <td style={{ ...statTd(rowBg), color: maxPain === null ? C.gray : maxPain >= 6 ? C.red : maxPain >= 4 ? C.gold : C.green }}>{maxPain !== null ? maxPain : '—'}</td>
                            <td style={{ ...statTd(rowBg) }}>{actH !== null ? `${actH}h` : '—'}</td>
                            <td style={{ ...statTd(rowBg), color: latestCycle === 'menstruacja' ? C.red : C.gray }}>{latestCycle === 'menstruacja' ? '🔴 mens.' : latestCycle ? latestCycle.slice(0, 6) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ══ DIET TAB ══════════════════════════════════════════════════════════ */}
          {activeTab === 'diet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Config */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Konfiguracja parametrów</div>
                  <button onClick={() => setModuleConfig('diet')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                    🥗 Edytuj dla grupy
                  </button>
                </div>
                {athletes.map((athlete: any, i: number) => {
                  const myDiet = dietLogs.filter((d: any) => d.athlete_id === athlete.id)
                  return (
                    <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1, fontWeight: 700, color: C.navy, fontSize: '0.9rem' }}>{athlete.full_name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: myDiet.length === 0 ? C.gray : C.green }}>{myDiet.length} wpisów / 30 dni</div>
                      <button onClick={() => router.push(`/coach/athletes/${athlete.id}?tab=diet`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.35rem 0.65rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                        Konfiguruj →
                      </button>
                    </div>
                  )
                })}
              </Card>

              {/* Diet stats */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Statystyki diety — ostatnie 30 dni</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: C.offWhite }}>
                        {['Zawodniczka', 'Wpisów', 'Śniadanie %', 'Śr. posiłki', 'Śr. woda ml', 'Śr. kawa', 'Śr. głód'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.75rem', fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Zawodniczka' ? 'left' : 'center', borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {athletes.map((athlete: any, ri: number) => {
                        const logs = dietLogs.filter((d: any) => d.athlete_id === athlete.id)
                        const breakfastPct = logs.length ? Math.round((logs.filter((d: any) => d.had_breakfast).length / logs.length) * 100) : null
                        const mealAvg = avg(logs.map((d: any) => d.meal_count).filter((v: any) => v > 0))
                        const waterAvg = avg(logs.map((d: any) => d.water_ml).filter((v: any) => v != null && v > 0))
                        const coffeeAvg = avg(logs.map((d: any) => d.coffee_count).filter((v: any) => v != null))
                        const hungerAvg = avg(logs.map((d: any) => d.hunger_level).filter((v: any) => v != null))
                        const rowBg = ri % 2 === 0 ? C.white : C.offWhite
                        return (
                          <tr key={athlete.id} style={{ background: rowBg }}>
                            <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, borderBottom: `1px solid ${C.grayLight}` }}>
                              <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.88rem' }}>{athlete.full_name}</button>
                            </td>
                            <td style={{ ...statTd(rowBg), color: logs.length === 0 ? C.red : C.navy }}>{logs.length}</td>
                            <td style={{ ...statTd(rowBg), color: breakfastPct === null ? C.gray : breakfastPct >= 80 ? C.green : breakfastPct >= 50 ? C.gold : C.red }}>{breakfastPct !== null ? `${breakfastPct}%` : '—'}</td>
                            <td style={statTd(rowBg)}>{mealAvg !== null ? mealAvg.toFixed(1) : '—'}</td>
                            <td style={{ ...statTd(rowBg), color: waterAvg === null ? C.gray : waterAvg >= 2000 ? C.green : waterAvg >= 1500 ? C.gold : C.red }}>{waterAvg !== null ? `${Math.round(waterAvg)}` : '—'}</td>
                            <td style={statTd(rowBg)}>{coffeeAvg !== null ? coffeeAvg.toFixed(1) : '—'}</td>
                            <td style={statTd(rowBg)}>{hungerAvg !== null ? hungerAvg.toFixed(1) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── Plan tab ── */}
          {activeTab === 'plan' && athletes.length === 0 ? (
            <Card><div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak zawodniczek w tej grupie.</div></Card>
          ) : activeTab === 'plan' && (
            <>
              {assignments.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Realizacja planu</div>
                      <div style={{ fontWeight: 800, color: C.navy }}>{currentPlan?.name} · {activePlanDays.length} treningów</div>
                    </div>
                    {currentPlan && !currentPlan.is_archived && (
                      <button onClick={() => archivePlan(currentPlan.id)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, borderRadius: 8, padding: '0.35rem 0.7rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>
                        📦 Archiwizuj plan
                      </button>
                    )}
                    {currentPlan?.is_archived && (
                      <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, padding: '0.35rem 0.7rem' }}>📦 Zarchiwizowany</span>
                    )}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', background: C.offWhite, position: 'sticky', left: 0, zIndex: 2, borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>Zawodniczka</th>
                          <th style={thStyle}>Postęp</th>
                          {/* Wellness cols */}
                          <th style={{ ...thStyle, background: '#F0FDF4' }} title="Wellness dzisiaj uzupełniony">W</th>
                          <th style={{ ...thStyle, background: '#F0FDF4' }} title="Średnia snu (7 dni)">Sen</th>
                          <th style={{ ...thStyle, background: '#F0FDF4' }} title="Średni stres (7 dni)">Stres</th>
                          <th style={{ ...thStyle, background: '#F0FDF4' }} title="Max ból (7 dni)">Ból</th>
                          <th style={{ ...thStyle, background: '#F0FDF4' }} title="Aktywność (godz, 7 dni)">Akt.</th>
                          <th style={{ ...thStyle, background: '#F0FDF4' }} title="Faza cyklu">🌸</th>
                          {/* Training cols */}
                          {activePlanDays.map((day: any, i: number) => (
                            <th key={day.id} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray, background: C.offWhite, borderBottom: `1.5px solid ${C.grayLight}`, minWidth: 40 }}>
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
                          const ws = getAthleteWellnessSummary(athlete.id, wellnessLogs)
                          const rowBg = rowIdx % 2 === 0 ? C.white : C.offWhite
                          const wsBg = rowIdx % 2 === 0 ? '#F7FFF9' : '#EFFAF2'

                          const sleepColor = ws.sleepAvg === null ? C.grayLight
                            : ws.sleepAvg <= 5 ? C.red
                            : ws.sleepAvg <= 7 ? C.gold : C.green
                          const stressColor = ws.stressAvg === null ? C.grayLight
                            : ws.stressAvg >= 8 ? C.red
                            : ws.stressAvg >= 5 ? C.gold : C.green
                          const painColor = ws.maxPain === null ? C.grayLight
                            : ws.maxPain >= 6 ? C.red
                            : ws.maxPain >= 5 ? C.gold : C.green

                          return (
                            <tr key={athlete.id} style={{ background: rowBg }}>
                              <td style={{ padding: '0.75rem 1.25rem', position: 'sticky', left: 0, zIndex: 1, background: rowBg, borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>
                                <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', padding: 0 }}>{athlete.full_name}</button>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', borderBottom: `1.5px solid ${C.grayLight}`, background: rowBg }}>
                                {progress ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                    <div style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 800, color: pct === 100 ? C.green : C.navy }}>{pct}%</div>
                                    <div style={{ width: 44, height: 4, background: C.grayLight, borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : C.gold, borderRadius: 2 }} />
                                    </div>
                                    <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray }}>{progress.done}/{progress.total}</div>
                                  </div>
                                ) : <span style={{ color: C.gray, fontSize: '0.75rem' }}>—</span>}
                              </td>
                              {/* Wellness: filled today */}
                              <td style={tdWs(wsBg)} title={ws.hasToday ? 'Uzupełniony dziś' : ws.entryCount > 0 ? `Ostatni wpis w ciągu 7 dni` : 'Brak wpisów w tym tygodniu'}>
                                <div style={{ fontSize: '0.8rem' }}>{ws.hasToday ? '✅' : ws.entryCount > 0 ? <span style={{ color: C.gold }}>⚠️</span> : <span style={{ color: C.red }}>✗</span>}</div>
                              </td>
                              {/* Sleep avg */}
                              <td style={tdWs(wsBg)}>
                                {ws.sleepAvg !== null
                                  ? <WellnessBadge value={ws.sleepAvg.toFixed(1)} label="h" color={sleepColor} />
                                  : <span style={{ color: C.grayLight, fontSize: '0.7rem' }}>—</span>}
                              </td>
                              {/* Stress avg */}
                              <td style={tdWs(wsBg)}>
                                {ws.stressAvg !== null
                                  ? <WellnessBadge value={ws.stressAvg.toFixed(1)} color={stressColor} />
                                  : <span style={{ color: C.grayLight, fontSize: '0.7rem' }}>—</span>}
                              </td>
                              {/* Max pain */}
                              <td style={tdWs(wsBg)}>
                                {ws.maxPain !== null
                                  ? <WellnessBadge value={String(ws.maxPain)} color={painColor} />
                                  : <span style={{ color: C.grayLight, fontSize: '0.7rem' }}>—</span>}
                              </td>
                              {/* Activity hours */}
                              <td style={tdWs(wsBg)}>
                                {ws.activityHours !== null
                                  ? <WellnessBadge value={`${ws.activityHours}h`} color={C.navy} />
                                  : <span style={{ color: C.grayLight, fontSize: '0.7rem' }}>—</span>}
                              </td>
                              {/* Cycle */}
                              <td style={tdWs(wsBg)}>
                                {ws.latestCycle === 'menstruacja'
                                  ? <span title="Menstruacja" style={{ fontSize: '0.8rem' }}>🔴</span>
                                  : ws.latestCycle
                                    ? <span title={ws.latestCycle} style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>{ws.latestCycle.slice(0, 3)}</span>
                                    : <span style={{ color: C.grayLight, fontSize: '0.7rem' }}>—</span>}
                              </td>
                              {/* Training sessions */}
                              {activePlanDays.map((day: any) => (
                                <td key={day.id} style={{ padding: '0.5rem', textAlign: 'center', borderBottom: `1.5px solid ${C.grayLight}`, background: rowBg }}>
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

              {/* Training stats */}
              {feedbacks.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Statystyki treningowe — ostatnie 30 dni</div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr style={{ background: C.offWhite }}>
                          {['Zawodniczka', 'Treningi', 'Ukończone', '% planu', 'Śr. RPE', 'Min RPE', 'Max RPE'].map(h => (
                            <th key={h} style={{ padding: '0.6rem 0.75rem', fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Zawodniczka' ? 'left' : 'center', borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, ri: number) => {
                          const athFeedbacks = feedbacks.filter((f: any) => f.athlete_id === athlete.id)
                          const rpeVals = athFeedbacks.map((f: any) => f.session_rpe).filter((v: any) => v != null) as number[]
                          const rpeAvg = avg(rpeVals)
                          const completed = sessions.filter((s: any) => s.athlete_id === athlete.id && s.completed).length
                          const progress = getAthleteProgress(athlete.id)
                          const pct = progress ? Math.round((progress.done / progress.total) * 100) : null
                          const rowBg = ri % 2 === 0 ? C.white : C.offWhite
                          const rpeColor = rpeAvg === null ? C.gray : rpeAvg >= 8 ? C.red : rpeAvg >= 6 ? C.gold : C.green
                          return (
                            <tr key={athlete.id} style={{ background: rowBg }}>
                              <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, borderBottom: `1px solid ${C.grayLight}` }}>
                                <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.88rem' }}>{athlete.full_name}</button>
                              </td>
                              <td style={statTd(rowBg)}>{athFeedbacks.length}</td>
                              <td style={statTd(rowBg)}>{completed}</td>
                              <td style={{ ...statTd(rowBg), color: pct === null ? C.gray : pct >= 80 ? C.green : pct >= 50 ? C.gold : C.red }}>{pct !== null ? `${pct}%` : '—'}</td>
                              <td style={{ ...statTd(rowBg), color: rpeColor }}>{rpeAvg !== null ? rpeAvg.toFixed(1) : '—'}</td>
                              <td style={statTd(rowBg)}>{rpeVals.length ? Math.min(...rpeVals) : '—'}</td>
                              <td style={statTd(rowBg)}>{rpeVals.length ? Math.max(...rpeVals) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
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
