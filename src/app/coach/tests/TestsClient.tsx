'use client'
// src/app/coach/tests/TestsClient.tsx
// "Testy" — trzy podzakładki: Wyniki (tabela z filtrami, trendem i sortowaniem),
// Katalog testów (definicje testów, edytowalne przez trenera) i Edytor wyników
// (masowe wpisywanie wyników dla wybranej grupy/testu/daty).
import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ChevronDown, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Field, Button } from '@/components/coach/ui'

type Group = { id: number; name: string }
type Athlete = { id: number; full_name: string; birth_year: number | null; group_id: number }
type CatalogTest = {
  id: number; name: string; unit: string
  general_desc: string | null; starting_position: string | null; execution: string | null
  end_position: string | null; measurement: string | null; goal: string | null
  sort_order: number
}
type Result = { id: number; athlete_id: number; test_catalog_id: number | null; value: number | null; test_date: string | null }

interface Props {
  groups: Group[]
  athletes: Athlete[]
  catalog: CatalogTest[]
  results: Result[]
}

function formatShort(iso: string) {
  return iso.slice(5)
}

function datesForTest(results: Result[], testId: number, dateFrom: string, dateTo: string) {
  const forTest = results.filter(r => r.test_catalog_id === testId && r.test_date)
  if (dateFrom || dateTo) {
    const from = dateFrom || '0000-00-00'
    const to = dateTo || '9999-99-99'
    const set = new Set(forTest.filter(r => r.test_date! >= from && r.test_date! <= to).map(r => r.test_date!))
    return [...set].sort()
  }
  const dates = forTest.map(r => r.test_date!)
  if (dates.length === 0) return []
  return [dates.sort().slice(-1)[0]]
}

function valueOn(results: Result[], athleteId: number, testId: number, date: string) {
  const r = results.find(x => x.athlete_id === athleteId && x.test_catalog_id === testId && x.test_date === date)
  return r ? r.value : null
}

export default function TestsClient({ groups, athletes, catalog, results }: Props) {
  const [subtab, setSubtab] = useState<'wyniki' | 'katalog' | 'edytor'>('wyniki')

  return (
    <>
      <SetPageMeta title="Testy" />
      <div className="coach-content" style={{ paddingTop: 4 }}>
        <div className="coach-testy-subtabs">
          <button className={`coach-testy-subtab ${subtab === 'wyniki' ? 'coach-active' : ''}`} onClick={() => setSubtab('wyniki')}>Wyniki</button>
          <button className={`coach-testy-subtab ${subtab === 'katalog' ? 'coach-active' : ''}`} onClick={() => setSubtab('katalog')}>Katalog testów</button>
          <button className={`coach-testy-subtab ${subtab === 'edytor' ? 'coach-active' : ''}`} onClick={() => setSubtab('edytor')}>Edytor wyników</button>
        </div>

        {subtab === 'wyniki' && <WynikiTab groups={groups} athletes={athletes} catalog={catalog} results={results} />}
        {subtab === 'katalog' && <KatalogTab catalog={catalog} />}
        {subtab === 'edytor' && <EdytorTab groups={groups} athletes={athletes} catalog={catalog} results={results} />}
      </div>
    </>
  )
}

// ── Filter dropdown (multi-select chip list) ──────────────────────────────────
function FilterDropdown({ label, summary, children }: { label?: string; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`coach-tf-dropdown ${open ? 'coach-open' : ''}`} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }} tabIndex={-1}>
      <button type="button" className="coach-tf-trigger" onClick={() => setOpen(o => !o)}>
        {label && <span className="coach-tf-trigger-label">{label}</span>}
        <span className="coach-tf-trigger-value">{summary}</span>
        <ChevronDown size={12} />
      </button>
      {open && <div className="coach-tf-panel" onMouseDown={e => e.preventDefault()}>{children}</div>}
    </div>
  )
}

function multiSummary<T>(sel: Set<T>, all: T[], labelOf: (v: T) => string) {
  if (sel.size === all.length) return 'Wszystkie'
  if (sel.size === 0) return 'Brak'
  if (sel.size === 1) return labelOf([...sel][0])
  return `${sel.size} z ${all.length}`
}

// ── Wyniki ──────────────────────────────────────────────────────────────────
function WynikiTab({ groups, athletes, catalog, results }: Props) {
  const router = useRouter()
  const allYears = useMemo(() => [...new Set(athletes.map(a => a.birth_year).filter((y): y is number => y != null))].sort((a, b) => a - b), [athletes])

  const [groupFilter, setGroupFilter] = useState<Set<number>>(new Set(groups.map(g => g.id)))
  const [yearFilter, setYearFilter] = useState<Set<number>>(new Set(allYears))
  const [visibleTests, setVisibleTests] = useState<Set<number>>(new Set(catalog.map(t => t.id)))
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortTestId, setSortTestId] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'

  const visibleTestList = catalog.filter(t => visibleTests.has(t.id))
  const testDates = useMemo(() => {
    const map: Record<number, string[]> = {}
    for (const t of visibleTestList) map[t.id] = datesForTest(results, t.id, dateFrom, dateTo)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, dateFrom, dateTo, visibleTests, catalog])

  const people = useMemo(() => {
    let list = athletes.filter(a => groupFilter.has(a.group_id) && a.birth_year != null && yearFilter.has(a.birth_year))
    if (sortTestId != null) {
      const dates = testDates[sortTestId] || []
      const lastDate = dates[dates.length - 1]
      list = list.slice().sort((a, b) => {
        const va = lastDate ? valueOn(results, a.id, sortTestId, lastDate) : null
        const vb = lastDate ? valueOn(results, b.id, sortTestId, lastDate) : null
        if (va === null && vb === null) return 0
        if (va === null) return 1
        if (vb === null) return -1
        return sortDir === 'desc' ? vb - va : va - vb
      })
    } else {
      list = list.slice().sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl'))
    }
    return list
  }, [athletes, groupFilter, yearFilter, sortTestId, sortDir, testDates, results])

  function toggleSet<T>(set: Set<T>, setSet: (s: Set<T>) => void, value: T) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value); else next.add(value)
    setSet(next)
  }

  function handleSortClick(testId: number) {
    if (sortTestId === testId) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortTestId(testId); setSortDir('desc') }
  }

  return (
    <>
      <div className="coach-testy-filters">
        <FilterDropdown label="Grupy" summary={multiSummary(groupFilter, groups.map(g => g.id), id => groupName(id as number))}>
          <div className="coach-tfd-list">
            <div className={`coach-tfd-item coach-tfd-all ${groupFilter.size === groups.length ? 'coach-active' : ''}`} onClick={() => setGroupFilter(new Set(groups.map(g => g.id)))}>Wszystkie</div>
            {groups.map(g => (
              <div key={g.id} className={`coach-tfd-item ${groupFilter.has(g.id) ? 'coach-active' : ''}`} onClick={() => toggleSet(groupFilter, setGroupFilter, g.id)}>{g.name}</div>
            ))}
          </div>
        </FilterDropdown>

        <FilterDropdown label="Roczniki" summary={multiSummary(yearFilter, allYears, y => String(y))}>
          <div className="coach-tfd-list">
            <div className={`coach-tfd-item coach-tfd-all ${yearFilter.size === allYears.length ? 'coach-active' : ''}`} onClick={() => setYearFilter(new Set(allYears))}>Wszystkie</div>
            {allYears.map(y => (
              <div key={y} className={`coach-tfd-item ${yearFilter.has(y) ? 'coach-active' : ''}`} onClick={() => toggleSet(yearFilter, setYearFilter, y)}>{y}</div>
            ))}
          </div>
        </FilterDropdown>

        <FilterDropdown label="Widoczne testy" summary={multiSummary(visibleTests, catalog.map(t => t.id), id => catalog.find(t => t.id === id)?.name ?? '')}>
          <div className="coach-tfd-list">
            {catalog.map(t => (
              <div key={t.id} className={`coach-tfd-item ${visibleTests.has(t.id) ? 'coach-active' : ''}`} onClick={() => toggleSet(visibleTests, setVisibleTests, t.id)}>{t.name}</div>
            ))}
            {catalog.length === 0 && <div style={{ padding: '6px 8px', color: 'var(--muted-light)', fontSize: 12.5 }}>Katalog jest pusty.</div>}
          </div>
        </FilterDropdown>

        <FilterDropdown summary={(dateFrom || dateTo) ? `${dateFrom ? formatShort(dateFrom) : '…'} – ${dateTo ? formatShort(dateTo) : '…'}` : 'Najnowszy wynik'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="coach-tf-date-row">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button type="button" className="coach-tf-clear-btn" onClick={() => { setDateFrom(''); setDateTo('') }}>Wyczyść zakres</button>
            <span className="coach-tf-date-hint">
              {(dateFrom || dateTo) ? 'Pokazuje wszystkie pomiary w wybranym zakresie (ze strzałkami zmiany).' : 'Brak wybranego zakresu — pokazuje najnowszy wynik każdego testu.'}
            </span>
          </div>
        </FilterDropdown>
      </div>

      {sortTestId != null && (
        <div style={{ marginBottom: 8, fontSize: 12, fontFamily: 'var(--font-inter),sans-serif', color: 'var(--muted)' }}>
          Posortowano wg: <b>{catalog.find(t => t.id === sortTestId)?.name}</b> ({sortDir === 'desc' ? 'najwyższy → najniższy' : 'najniższy → najwyższy'}) ·{' '}
          <a href="#" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }} onClick={e => { e.preventDefault(); setSortTestId(null) }}>
            Wróć do sortowania alfabetycznego (A-Z)
          </a>
        </div>
      )}

      <div className="coach-results-table-wrap">
        {people.length === 0 || visibleTestList.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif', fontSize: 13 }}>Brak danych spełniających wybrane filtry.</div>
        ) : (
          <table className="coach-results-table">
            <thead>
              <tr>
                <th className="coach-rt-name-col" rowSpan={2}>Zawodniczka</th>
                {visibleTestList.map(t => {
                  const dates = testDates[t.id] || []
                  const isSorted = sortTestId === t.id
                  return (
                    <th key={t.id} className="coach-sortable" colSpan={Math.max(dates.length, 1)} onClick={() => handleSortClick(t.id)}>
                      {t.name} <span style={{ opacity: 0.6 }}>({t.unit})</span>
                      {isSorted && <span className="coach-sort-arrow">{sortDir === 'desc' ? '▼' : '▲'}</span>}
                    </th>
                  )
                })}
              </tr>
              <tr>
                {visibleTestList.map(t => {
                  const dates = testDates[t.id] || []
                  return dates.length === 0
                    ? <th key={t.id}>–</th>
                    : dates.map(d => <th key={t.id + d}>{formatShort(d)}</th>)
                })}
              </tr>
            </thead>
            <tbody>
              {people.map((p, idx) => (
                <tr key={p.id}>
                  <td className="coach-rt-name">
                    {p.full_name}
                    <div className="coach-rt-meta">{groupName(p.group_id)}{p.birth_year ? ` · ur. ${p.birth_year}` : ''}</div>
                  </td>
                  {visibleTestList.map(t => {
                    const dates = testDates[t.id] || []
                    if (dates.length === 0) return <td key={t.id} className="coach-rt-empty-val">–</td>
                    return dates.map((d, dIdx) => {
                      const val = valueOn(results, p.id, t.id, d)
                      let arrow: React.ReactNode = null
                      if (dIdx > 0) {
                        const prevVal = valueOn(results, p.id, t.id, dates[dIdx - 1])
                        if (val !== null && prevVal !== null && val !== prevVal) {
                          const up = val > prevVal
                          arrow = (
                            <span className={`coach-rt-arrow ${up ? 'coach-up' : 'coach-down'}`} title={`${up ? 'Wzrost' : 'Spadek'} względem ${formatShort(dates[dIdx - 1])}`}>
                              {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            </span>
                          )
                        }
                      }
                      return (
                        <td key={t.id + d}>
                          <div className="coach-rt-value-cell">
                            {arrow}
                            {val !== null ? val : <span className="coach-rt-empty-val">–</span>}
                          </div>
                        </td>
                      )
                    })
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ── Katalog testów ──────────────────────────────────────────────────────────
type CatalogFormData = {
  name: string; unit: string; general_desc: string; starting_position: string
  execution: string; end_position: string; measurement: string; goal: string
}
const EMPTY_FORM: CatalogFormData = { name: '', unit: '', general_desc: '', starting_position: '', execution: '', end_position: '', measurement: '', goal: '' }

function KatalogTab({ catalog }: { catalog: CatalogTest[] }) {
  const router = useRouter()
  const [formMode, setFormMode] = useState<'new' | { editId: number } | null>(null)
  const [form, setForm] = useState<CatalogFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  function openNew() {
    setForm(EMPTY_FORM)
    setFormMode('new')
  }
  function openEdit(t: CatalogTest) {
    setForm({
      name: t.name, unit: t.unit,
      general_desc: t.general_desc || '', starting_position: t.starting_position || '',
      execution: t.execution || '', end_position: t.end_position || '',
      measurement: t.measurement || '', goal: t.goal || '',
    })
    setFormMode({ editId: t.id })
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: form.name.trim(), unit: form.unit.trim(),
      general_desc: form.general_desc.trim() || null, starting_position: form.starting_position.trim() || null,
      execution: form.execution.trim() || null, end_position: form.end_position.trim() || null,
      measurement: form.measurement.trim() || null, goal: form.goal.trim() || null,
    }
    if (formMode && typeof formMode === 'object') {
      await supabase.from('test_catalog').update(payload).eq('id', formMode.editId)
    } else {
      const maxSort = Math.max(0, ...catalog.map(t => t.sort_order ?? 0))
      await supabase.from('test_catalog').insert({ ...payload, sort_order: maxSort + 1 })
    }
    setSaving(false)
    setFormMode(null)
    router.refresh()
  }

  async function handleDelete(t: CatalogTest) {
    if (!confirm(`Usunąć „${t.name}” z katalogu? Zapisane wyniki pozostaną w bazie, ale przestaną być widoczne.`)) return
    const supabase = createClient()
    await supabase.from('test_catalog').update({ is_archived: true }).eq('id', t.id)
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button variant="gold" onClick={openNew}>+ Nowy test</Button>
      </div>

      {formMode && (
        <div className="coach-catalog-form">
          <div className="coach-field-grid-2">
            <Field label="Nazwa testu">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. VERTICAL JUMP" autoFocus />
            </Field>
            <Field label="Miara">
              <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="np. cm, sek, powt." />
            </Field>
          </div>
          <Field label="Opis ogólny">
            <textarea value={form.general_desc} onChange={e => setForm(f => ({ ...f, general_desc: e.target.value }))} style={{ minHeight: 50 }} />
          </Field>
          <Field label="Pozycja początkowa (PP)">
            <textarea value={form.starting_position} onChange={e => setForm(f => ({ ...f, starting_position: e.target.value }))} style={{ minHeight: 44 }} />
          </Field>
          <Field label="Wykonanie">
            <textarea value={form.execution} onChange={e => setForm(f => ({ ...f, execution: e.target.value }))} style={{ minHeight: 44 }} />
          </Field>
          <Field label="Pozycja końcowa (PK)">
            <textarea value={form.end_position} onChange={e => setForm(f => ({ ...f, end_position: e.target.value }))} style={{ minHeight: 44 }} />
          </Field>
          <Field label="Sposób pomiaru">
            <textarea value={form.measurement} onChange={e => setForm(f => ({ ...f, measurement: e.target.value }))} style={{ minHeight: 44 }} />
          </Field>
          <Field label="Cel testu">
            <textarea value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} style={{ minHeight: 44 }} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={() => setFormMode(null)}>Anuluj</Button>
            <Button variant="gold" onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? 'Zapisuję...' : 'Zapisz'}</Button>
          </div>
        </div>
      )}

      <div className="coach-catalog-list">
        {catalog.length === 0 && !formMode && (
          <div className="coach-empty-list">Katalog jest pusty — dodaj pierwszy test przyciskiem „+ Nowy test”.</div>
        )}
        {catalog.map(t => (
          <div key={t.id} className="coach-catalog-card">
            <div className="coach-catalog-card-head">
              <h3>{t.name}</h3>
              <span className="coach-catalog-unit-tag">{t.unit}</span>
              <div className="coach-catalog-actions">
                <button className="coach-icon-btn" onClick={() => openEdit(t)} title="Edytuj"><Pencil size={14} /></button>
                <button className="coach-icon-btn coach-danger" onClick={() => handleDelete(t)} title="Usuń"><Trash2 size={14} /></button>
              </div>
            </div>
            {t.general_desc && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif' }}>{t.general_desc}</p>}
            <div className="coach-catalog-detail-grid">
              <div><div className="coach-cd-label">Pozycja początkowa</div><div className="coach-cd-val">{t.starting_position || '–'}</div></div>
              <div><div className="coach-cd-label">Wykonanie</div><div className="coach-cd-val">{t.execution || '–'}</div></div>
              <div><div className="coach-cd-label">Pozycja końcowa</div><div className="coach-cd-val">{t.end_position || '–'}</div></div>
              <div><div className="coach-cd-label">Sposób pomiaru</div><div className="coach-cd-val">{t.measurement || '–'}</div></div>
              <div><div className="coach-cd-label">Cel testu</div><div className="coach-cd-val">{t.goal || '–'}</div></div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Edytor wyników ──────────────────────────────────────────────────────────
function EdytorTab({ groups, athletes, catalog, results }: Props) {
  const router = useRouter()
  const [editorGroups, setEditorGroups] = useState<Set<number>>(new Set(groups.map(g => g.id)))
  const [testId, setTestId] = useState<number | null>(catalog[0]?.id ?? null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [values, setValues] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  function toggleGroup(id: number) {
    const next = new Set(editorGroups)
    if (next.has(id)) next.delete(id); else next.add(id)
    setEditorGroups(next)
  }

  const rosterByGroup = groups
    .filter(g => editorGroups.has(g.id))
    .map(g => ({
      group: g,
      people: athletes.filter(a => a.group_id === g.id).slice().sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl')),
    }))

  function valueFor(athleteId: number): string {
    if (athleteId in values) return values[athleteId]
    if (testId == null) return ''
    const existing = valueOn(results, athleteId, testId, date)
    return existing !== null ? String(existing) : ''
  }

  async function handleSaveAll() {
    if (testId == null) return
    setSaving(true)
    const supabase = createClient()
    let count = 0
    for (const { people } of rosterByGroup) {
      for (const p of people) {
        const raw = valueFor(p.id).trim()
        const existing = results.find(r => r.athlete_id === p.id && r.test_catalog_id === testId && r.test_date === date)
        if (raw === '') {
          if (existing) await supabase.from('benchmark_tests').delete().eq('id', existing.id)
          continue
        }
        const num = Number(raw)
        if (Number.isNaN(num)) continue
        if (existing) {
          await supabase.from('benchmark_tests').update({ value: num }).eq('id', existing.id)
        } else {
          await supabase.from('benchmark_tests').insert({ athlete_id: p.id, test_catalog_id: testId, value: num, test_date: date })
        }
        count++
      }
    }
    setSaving(false)
    setSavedMsg(`Zapisano ${count} wyników ✓`)
    setValues({})
    router.refresh()
    setTimeout(() => setSavedMsg(''), 2000)
  }

  if (catalog.length === 0) {
    return <div className="coach-empty-list">Najpierw dodaj test w zakładce „Katalog testów”.</div>
  }

  return (
    <>
      <div className="coach-editor-target-row">
        <div className="coach-tf-group">
          <span className="coach-tf-group-label">Grupa</span>
          <FilterDropdown summary={multiSummary(editorGroups, groups.map(g => g.id), id => groups.find(g => g.id === id)?.name ?? '')}>
            <div className="coach-tfd-list">
              <div className={`coach-tfd-item coach-tfd-all ${editorGroups.size === groups.length ? 'coach-active' : ''}`} onClick={() => setEditorGroups(new Set(groups.map(g => g.id)))}>Wszystkie</div>
              {groups.map(g => (
                <div key={g.id} className={`coach-tfd-item ${editorGroups.has(g.id) ? 'coach-active' : ''}`} onClick={() => toggleGroup(g.id)}>{g.name}</div>
              ))}
            </div>
          </FilterDropdown>
        </div>
        <div className="coach-tf-group">
          <span className="coach-tf-group-label">Test</span>
          <select className="coach-sort-select" value={testId ?? ''} onChange={e => { setTestId(Number(e.target.value)); setValues({}) }}>
            {catalog.map(t => <option key={t.id} value={t.id}>{t.name} ({t.unit})</option>)}
          </select>
        </div>
        <div className="coach-tf-group">
          <span className="coach-tf-group-label">Data pomiaru</span>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setValues({}) }} />
        </div>
        <div className="coach-tf-group" style={{ justifyContent: 'flex-end' }}>
          <Button variant="gold" onClick={handleSaveAll} disabled={saving}>
            {saving ? 'Zapisuję...' : savedMsg || 'Zapisz wyniki'}
          </Button>
        </div>
      </div>

      <div className="coach-editor-bulk-table-wrap">
        <table className="coach-editor-bulk-table">
          <thead>
            <tr><th>Zawodniczka</th><th>Wynik ({catalog.find(t => t.id === testId)?.unit || ''})</th></tr>
          </thead>
          <tbody>
            {rosterByGroup.map(({ group, people }) => (
              <Fragment key={group.id}>
                <tr className="coach-eb-group-row"><td colSpan={2}>{group.name}</td></tr>
                {people.map(p => (
                  <tr key={p.id}>
                    <td className="coach-eb-name">{p.full_name}</td>
                    <td>
                      <input
                        type="number" step="0.1" className="coach-eb-input"
                        value={valueFor(p.id)}
                        onChange={e => setValues(v => ({ ...v, [p.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
