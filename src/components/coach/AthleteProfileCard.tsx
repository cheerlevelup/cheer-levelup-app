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
  test_catalog_id: number
  value: number | null
  test_date: string | null
}

type CatalogTest = {
  id: number
  name: string
  unit: string
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
  // catalogAll: także zarchiwizowane testy (żeby historyczne wyniki miały nazwę)
  const [catalogAll, setCatalogAll] = useState<(CatalogTest & { is_archived?: boolean })[] | null>(null)
  const [results, setResults] = useState<BenchmarkTest[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [newTestId, setNewTestId] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [savingTest, setSavingTest] = useState(false)
  const [testError, setTestError] = useState('')

  async function loadTests() {
    if (results !== null) return
    const [{ data: catalogData }, { data: testsData }] = await Promise.all([
      supabase.from('test_catalog').select('id, name, unit, is_archived').order('sort_order', { ascending: true }),
      supabase.from('benchmark_tests').select('*').eq('athlete_id', athlete.id).order('test_date', { ascending: false }),
    ])
    setCatalogAll((catalogData || []) as (CatalogTest & { is_archived?: boolean })[])
    // tylko faktycznie wykonane testy (z wynikiem) — wpisy „brak testu” pomijamy
    setResults(((testsData || []) as BenchmarkTest[]).filter(r => r.value != null))
  }

  async function addTestResult() {
    const testId = parseInt(newTestId)
    const value = parseFloat(newValue.replace(',', '.'))
    if (!testId || isNaN(value)) { setTestError('Wybierz test i wpisz wynik.'); return }
    setSavingTest(true); setTestError('')
    const { data, error } = await supabase.from('benchmark_tests').insert({
      athlete_id: athlete.id, test_catalog_id: testId, value, test_date: newDate || null,
    }).select().single()
    setSavingTest(false)
    if (error) { setTestError(error.message); return }
    setResults(prev => [data as BenchmarkTest, ...(prev || [])])
    setAdding(false); setNewTestId(''); setNewValue('')
  }

  async function removeTestResult(id?: number) {
    if (!id || !confirm('Usunąć ten wynik testu?')) return
    const { error } = await supabase.from('benchmark_tests').delete().eq('id', id)
    if (!error) setResults(prev => (prev || []).filter(r => r.id !== id))
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
            <div className="coach-section-label" style={{ padding: '0 0 8px' }}>Wykonane testy sprawnościowe</div>
            {results === null ? (
              <div className="coach-injury-empty">Wczytuję...</div>
            ) : results.length === 0 ? (
              <div className="coach-injury-empty">Zawodniczka nie ma jeszcze wyników testów.</div>
            ) : (
              (catalogAll || [])
                .filter(ct => results.some(r => r.test_catalog_id === ct.id))
                .map(ct => {
                  const rows = results
                    .filter(r => r.test_catalog_id === ct.id)
                    .sort((a, b) => (b.test_date || '').localeCompare(a.test_date || ''))
                  return (
                    <div key={ct.id} className="coach-test-group">
                      <div className="coach-test-group-head"><Ruler size={14} /> {ct.name.toUpperCase()}{ct.unit ? ` [${ct.unit.toUpperCase()}]` : ''}</div>
                      <div className="coach-test-group-body">
                        {rows.map((r, i) => (
                          <div key={r.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                            <span style={{ width: 90, fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                              {r.test_date ? new Date(r.test_date + 'T00:00:00').toLocaleDateString('pl-PL') : 'bez daty'}
                            </span>
                            <span style={{ flex: 1, fontWeight: i === 0 ? 800 : 600, color: 'var(--navy-900)' }}>
                              {r.value} {ct.unit}
                              {i === 0 && rows.length > 1 && <span style={{ marginLeft: 8, fontSize: '0.65rem', fontWeight: 700, color: 'var(--gold)' }}>OSTATNI</span>}
                            </span>
                            <button onClick={() => removeTestResult(r.id)} title="Usuń wynik"
                              style={{ background: 'none', border: 'none', color: 'var(--muted-light)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
            )}

            {adding ? (
              <div className="coach-test-group">
                <div className="coach-test-group-head"><Ruler size={14} /> NOWY WYNIK TESTU</div>
                <div className="coach-test-group-body">
                  <div className="coach-test-row" style={{ flexWrap: 'wrap' }}>
                    <select value={newTestId} onChange={e => setNewTestId(e.target.value)} style={{ minWidth: 200 }}>
                      <option value="">— wybierz test —</option>
                      {(catalogAll || []).filter(ct => !ct.is_archived).map(ct => (
                        <option key={ct.id} value={ct.id}>{ct.name}{ct.unit ? ` [${ct.unit}]` : ''}</option>
                      ))}
                    </select>
                    <input type="number" step="any" placeholder={(catalogAll || []).find(c => String(c.id) === newTestId)?.unit || 'wynik'}
                      value={newValue} onChange={e => setNewValue(e.target.value)} />
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                  </div>
                  {testError && <div style={{ color: '#c23b3b', fontSize: '0.75rem', marginTop: 6 }}>{testError}</div>}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <Button variant="ghost" onClick={() => { setAdding(false); setTestError('') }}>Anuluj</Button>
                    <Button variant="gold" onClick={addTestResult} disabled={savingTest}>{savingTest ? 'Zapisuję...' : 'Zapisz'}</Button>
                  </div>
                </div>
              </div>
            ) : (
              <button className="coach-add-injury-btn" onClick={() => setAdding(true)}>+ Dodaj wynik testu</button>
            )}
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
