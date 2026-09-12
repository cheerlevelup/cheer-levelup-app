'use client'
// src/components/coach/AthleteProfileCard.tsx
// Rozwijana karta zawodniczki (Profil/Kontuzje/Testy/Raporty/Plany) — używana
// w zakładce "Zawodniczki" grupy. Dane kontuzji/testów/raportów/planów są
// doczytywane leniwie (dopiero gdy trener otworzy daną zakładkę).
import { useState } from 'react'
import { AlertTriangle, User, Bandage, Ruler, LineChart as LineChartIcon, CalendarCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { TabsState, Field, FieldGrid, Button, StatusPill } from '@/components/coach/ui'

export type AthleteRow = {
  id: number
  full_name: string
  birth_year?: number | null
  phone?: string | null
  height_cm?: number | null
  weight_kg?: number | null
  notes?: string | null
  group_name?: string | null
}

type Injury = {
  id: number
  athlete_id: number
  body_part: string | null
  status: 'active' | 'in_treatment' | 'healed' | 'chronic'
  date_occurred: string | null
  date_resolved: string | null
  notes: string | null
}

type BenchmarkTest = {
  id?: number
  athlete_id: number
  test_type: string
  value: number | null
  test_date: string | null
}

type Session = {
  id: number
  date_completed: string | null
  report_sent: boolean | null
  completed: boolean | null
  workout_day?: { day_name?: string | null } | null
}

type PlanProgress = {
  assignmentId: number
  planName: string
  isActive: boolean
  done: number
  total: number
}

const STATUS_LABEL: Record<Injury['status'], string> = {
  active: 'Aktywna', in_treatment: 'W leczeniu', healed: 'Wyleczona', chronic: 'Przewlekła',
}
const STATUS_TONE: Record<Injury['status'], 'red' | 'amber' | 'green' | 'muted'> = {
  active: 'red', in_treatment: 'amber', healed: 'green', chronic: 'muted',
}

const TEST_GROUPS: { title: string; icon: React.ReactNode; rows: { type: string; label: string; unit: string }[] }[] = [
  {
    title: 'BROAD JUMP [CM]',
    icon: <Ruler size={14} />,
    rows: [
      { type: 'broad_jump_both', label: 'BROAD JUMP', unit: 'cm' },
      { type: 'broad_jump_right', label: 'SL BROAD JUMP (R)', unit: 'cm' },
      { type: 'broad_jump_left', label: 'SL BROAD JUMP (L)', unit: 'cm' },
    ],
  },
  { title: 'CHIN-UP [SEC]', icon: <LineChartIcon size={14} />, rows: [{ type: 'chin_up', label: 'Wynik', unit: 'sec.' }] },
  { title: 'PUSH-UP [REPS]', icon: <LineChartIcon size={14} />, rows: [{ type: 'push_up', label: 'Wynik', unit: 'reps' }] },
]

export default function AthleteProfileCard({ athlete, onClose }: { athlete: AthleteRow; onClose: () => void }) {
  const supabase = createClient()
  const [tab, setTab] = useState('profil')

  // ── Profil ──
  const [fullName, setFullName] = useState(athlete.full_name)
  const [birthYear, setBirthYear] = useState(athlete.birth_year != null ? String(athlete.birth_year) : '')
  const [phone, setPhone] = useState(athlete.phone || '')
  const [height, setHeight] = useState(athlete.height_cm != null ? String(athlete.height_cm) : '')
  const [weight, setWeight] = useState(athlete.weight_kg != null ? String(athlete.weight_kg) : '')
  const [notes, setNotes] = useState(athlete.notes || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  async function saveProfile() {
    setSavingProfile(true); setProfileSaved(false)
    await supabase.from('athletes').update({
      full_name: fullName.trim() || athlete.full_name,
      birth_year: birthYear ? parseInt(birthYear) : null,
      phone: phone.trim() || null,
      height_cm: height ? parseFloat(height) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      notes: notes.trim() || null,
    }).eq('id', athlete.id)
    setSavingProfile(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 1500)
  }

  // ── Kontuzje ──
  const [injuries, setInjuries] = useState<Injury[] | null>(null)
  const [loadingInjuries, setLoadingInjuries] = useState(false)

  async function loadInjuries() {
    if (injuries !== null || loadingInjuries) return
    setLoadingInjuries(true)
    const { data } = await supabase.from('injuries').select('*').eq('athlete_id', athlete.id).order('date_occurred', { ascending: false })
    setInjuries((data || []) as Injury[])
    setLoadingInjuries(false)
  }

  function addInjury() {
    setInjuries(prev => [{ id: -Date.now(), athlete_id: athlete.id, body_part: '', status: 'active', date_occurred: new Date().toISOString().slice(0, 10), date_resolved: null, notes: '' }, ...(prev || [])])
  }

  function updateInjuryLocal(id: number, patch: Partial<Injury>) {
    setInjuries(prev => (prev || []).map(i => i.id === id ? { ...i, ...patch } : i))
  }

  async function saveInjury(inj: Injury) {
    if (inj.id < 0) {
      const { data } = await supabase.from('injuries').insert({
        athlete_id: inj.athlete_id, body_part: inj.body_part || null, status: inj.status,
        date_occurred: inj.date_occurred || null, notes: inj.notes || null,
      }).select().single()
      if (data) setInjuries(prev => (prev || []).map(i => i.id === inj.id ? (data as Injury) : i))
    } else {
      await supabase.from('injuries').update({
        body_part: inj.body_part || null, status: inj.status, date_occurred: inj.date_occurred || null, notes: inj.notes || null,
      }).eq('id', inj.id)
    }
  }

  async function removeInjury(id: number) {
    if (id >= 0) await supabase.from('injuries').delete().eq('id', id)
    setInjuries(prev => (prev || []).filter(i => i.id !== id))
  }

  const activeInjuryCount = (injuries || []).filter(i => i.status === 'active').length

  // ── Testy ──
  const [tests, setTests] = useState<Map<string, BenchmarkTest> | null>(null)

  async function loadTests() {
    if (tests !== null) return
    const { data } = await supabase.from('benchmark_tests').select('*').eq('athlete_id', athlete.id).order('test_date', { ascending: false })
    const m = new Map<string, BenchmarkTest>()
    for (const row of (data || []) as BenchmarkTest[]) {
      if (!m.has(row.test_type)) m.set(row.test_type, row) // najnowszy (posortowane malejąco)
    }
    setTests(m)
  }

  function updateTestLocal(type: string, patch: Partial<BenchmarkTest>) {
    setTests(prev => {
      const m = new Map(prev)
      const existing = m.get(type) || { athlete_id: athlete.id, test_type: type, value: null, test_date: null }
      m.set(type, { ...existing, ...patch })
      return m
    })
  }

  async function saveTest(type: string) {
    const row = tests?.get(type)
    if (!row) return
    if (row.id) {
      await supabase.from('benchmark_tests').update({ value: row.value, test_date: row.test_date || null }).eq('id', row.id)
    } else {
      const { data } = await supabase.from('benchmark_tests').insert({
        athlete_id: athlete.id, test_type: type, value: row.value, test_date: row.test_date || null,
      }).select().single()
      if (data) setTests(prev => { const m = new Map(prev); m.set(type, data as BenchmarkTest); return m })
    }
  }

  // ── Raporty ──
  const [sessions, setSessions] = useState<Session[] | null>(null)

  async function loadSessions() {
    if (sessions !== null) return
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, date_completed, report_sent, completed, workout_day:workout_days(day_name)')
      .eq('athlete_id', athlete.id)
      .eq('completed', true)
      .order('date_completed', { ascending: false })
      .limit(20)
    setSessions((data || []) as unknown as Session[])
  }

  // ── Plany ──
  const [plans, setPlans] = useState<PlanProgress[] | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(false)

  async function loadPlans() {
    if (plans !== null || loadingPlans) return
    setLoadingPlans(true)
    const { data: assignments } = await supabase
      .from('athlete_workout_assignments')
      .select('id, plan_id, is_active, plan:workout_plans(id, name)')
      .eq('athlete_id', athlete.id)
      .order('created_at', { ascending: false })

    const out: PlanProgress[] = []
    for (const a of (assignments || []) as any[]) {
      if (!a.plan) continue
      const { data: weeks } = await supabase.from('workout_weeks').select('id').eq('plan_id', a.plan_id)
      const weekIds = (weeks || []).map((w: any) => w.id)
      let total = 0
      let dayIds: number[] = []
      if (weekIds.length) {
        const { data: days } = await supabase.from('workout_days').select('id').in('week_id', weekIds)
        dayIds = (days || []).map((d: any) => d.id)
        total = dayIds.length
      }
      let done = 0
      if (dayIds.length) {
        const { count } = await supabase
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('athlete_id', athlete.id)
          .eq('completed', true)
          .in('workout_day_id', dayIds)
        done = count || 0
      }
      out.push({ assignmentId: a.id, planName: a.plan.name, isActive: !!a.is_active, done, total })
    }
    setPlans(out)
    setLoadingPlans(false)
  }

  function handleTabChange(k: string) {
    setTab(k)
    if (k === 'kontuzje') loadInjuries()
    if (k === 'testy') loadTests()
    if (k === 'raporty') loadSessions()
    if (k === 'plany') loadPlans()
  }

  return (
    <div className="coach-comp-card">
      <div className="coach-comp-card-head">
        <div className="coach-comp-card-head-left">
          <div className="coach-comp-avatar-lg">{athlete.full_name.charAt(0).toUpperCase()}</div>
          <div>
            <h3 className="coach-comp-card-name">{athlete.full_name}</h3>
            <div className="coach-comp-card-sub">
              {athlete.birth_year && <span>ur. {athlete.birth_year}</span>}
              {athlete.group_name && <span>· {athlete.group_name}</span>}
              {activeInjuryCount > 0 && (
                <span className="coach-comp-injury-flag"><AlertTriangle size={12} /> {activeInjuryCount} aktywna kontuzja</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <TabsState
        items={[
          { key: 'profil', label: 'Profil', icon: <User size={14} /> },
          { key: 'kontuzje', label: 'Kontuzje', icon: <Bandage size={14} /> },
          { key: 'testy', label: 'Testy', icon: <Ruler size={14} /> },
          { key: 'raporty', label: 'Raporty', icon: <LineChartIcon size={14} /> },
          { key: 'plany', label: 'Plany', icon: <CalendarCheck size={14} /> },
        ]}
        active={tab}
        onChange={handleTabChange}
      />

      <div className="coach-comp-tab-body">
        {tab === 'profil' && (
          <>
            <FieldGrid>
              <Field label="Imię i nazwisko">
                <input value={fullName} onChange={e => setFullName(e.target.value)} />
              </Field>
              <Field label="Rok urodzenia">
                <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} />
              </Field>
              <Field label="Telefon">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 000 000 000" />
              </Field>
              <Field label="Wzrost (cm)">
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} />
              </Field>
              <Field label="Masa ciała (kg)">
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} />
              </Field>
              <Field label="Notatki trenerskie" full>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Uwagi ogólne, cele, dyspozycje..." />
              </Field>
            </FieldGrid>
            <div className="coach-comp-tab-foot" style={{ marginTop: 12, borderTop: 'none', padding: 0 }}>
              <Button variant="ghost" onClick={onClose}>Zamknij</Button>
              <Button variant="gold" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Zapisuję...' : profileSaved ? '✓ Zapisano' : 'Zapisz'}
              </Button>
            </div>
          </>
        )}

        {tab === 'kontuzje' && (
          <>
            {loadingInjuries ? (
              <div className="coach-injury-empty">Wczytuję...</div>
            ) : (injuries || []).length === 0 ? (
              <div className="coach-injury-empty">Brak zarejestrowanych kontuzji.</div>
            ) : (
              (injuries || []).map(inj => (
                <div key={inj.id} className={`coach-injury-card ${inj.status === 'active' ? 'coach-active' : ''}`}>
                  <button className="coach-injury-remove" onClick={() => removeInjury(inj.id)}>✕</button>
                  <FieldGrid>
                    <Field label="Data">
                      <input type="date" value={inj.date_occurred || ''} onChange={e => updateInjuryLocal(inj.id, { date_occurred: e.target.value })} onBlur={() => saveInjury({ ...inj, date_occurred: inj.date_occurred })} />
                    </Field>
                    <Field label="Status">
                      <select value={inj.status} onChange={e => { const v = e.target.value as Injury['status']; updateInjuryLocal(inj.id, { status: v }); saveInjury({ ...inj, status: v }) }}>
                        {(Object.keys(STATUS_LABEL) as Injury['status'][]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </Field>
                    <Field label="Rodzaj / lokalizacja" full>
                      <input value={inj.body_part || ''} placeholder="np. naciągnięcie kostki, ból kolana…" onChange={e => updateInjuryLocal(inj.id, { body_part: e.target.value })} onBlur={() => saveInjury({ ...inj, body_part: inj.body_part })} />
                    </Field>
                    <Field label="Notatka" full>
                      <input value={inj.notes || ''} placeholder="Leczenie, ograniczenia, uwagi…" onChange={e => updateInjuryLocal(inj.id, { notes: e.target.value })} onBlur={() => saveInjury({ ...inj, notes: inj.notes })} />
                    </Field>
                  </FieldGrid>
                </div>
              ))
            )}
            <button className="coach-add-injury-btn" onClick={addInjury}>+ Dodaj kontuzję</button>
          </>
        )}

        {tab === 'testy' && (
          <>
            <div className="coach-section-label" style={{ padding: '0 0 8px' }}>Testy sprawnościowe — wyniki i daty pomiarów</div>
            {TEST_GROUPS.map(group => (
              <div key={group.title} className="coach-test-group">
                <div className="coach-test-group-head">{group.icon} {group.title}</div>
                <div className="coach-test-group-body">
                  {group.rows.map(row => {
                    const t = tests?.get(row.type)
                    return (
                      <div key={row.type} className="coach-test-row">
                        <span className="coach-test-row-label">{row.label}</span>
                        <input
                          type="number"
                          placeholder={row.unit}
                          value={t?.value ?? ''}
                          onChange={e => updateTestLocal(row.type, { value: e.target.value ? parseFloat(e.target.value) : null })}
                          onBlur={() => saveTest(row.type)}
                        />
                        <input
                          type="date"
                          value={t?.test_date ?? ''}
                          onChange={e => updateTestLocal(row.type, { test_date: e.target.value })}
                          onBlur={() => saveTest(row.type)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'raporty' && (
          <div className="coach-report-list">
            {(sessions || []).length === 0 ? (
              <div className="coach-injury-empty">Brak ukończonych sesji.</div>
            ) : (
              (sessions || []).map(s => (
                <div key={s.id} className="coach-report-card">
                  <div className="coach-report-card-top">
                    <span className="coach-report-date">{s.date_completed}</span>
                    <span className={`coach-report-status ${s.report_sent ? 'coach-ok' : 'coach-pending'}`}>
                      {s.report_sent ? 'Wysłany' : 'Bez raportu'}
                    </span>
                  </div>
                  <div className="coach-report-title">{s.workout_day?.day_name || 'Trening'}</div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'plany' && (
          <div className="coach-plan-list">
            {loadingPlans ? (
              <div className="coach-injury-empty">Wczytuję...</div>
            ) : (plans || []).length === 0 ? (
              <div className="coach-injury-empty">Brak przypisanych planów.</div>
            ) : (
              (plans || []).map(p => (
                <div key={p.assignmentId} className="coach-plan-card">
                  <div className="coach-plan-card-top">
                    <span className="coach-plan-name">{p.planName}</span>
                    <span className={`coach-plan-status ${p.isActive ? 'coach-progress' : 'coach-done'}`}>
                      {p.isActive ? 'W toku' : 'Zrealizowany'}
                    </span>
                  </div>
                  <div className="coach-plan-progress-row">
                    <div className="coach-bar-track" style={{ flex: 1 }}>
                      <div className="coach-bar-fill" style={{ width: `${p.total ? Math.round((p.done / p.total) * 100) : 0}%` }} />
                    </div>
                    <span className="coach-plan-progress-label">{p.done}/{p.total} treningów</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
