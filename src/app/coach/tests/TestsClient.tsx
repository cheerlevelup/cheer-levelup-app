'use client'
// src/app/coach/tests/TestsClient.tsx
// "Testy" — trzy podzakładki: Wyniki (tabela z filtrami, trendem i sortowaniem),
// Katalog testów (definicje testów, edytowalne przez trenera) i Edytor wyników
// (masowe wpisywanie wyników dla wybranej grupy/testu/daty).
import { Fragment, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ChevronDown, ArrowUp, ArrowDown, Pencil, Trash2, Flag } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Field, Button } from '@/components/coach/ui'
import TestImportModal, { parseNum } from './TestImportModal'

type Group = { id: number; name: string }
type Athlete = { id: number; full_name: string; birth_year: number | null; group_id: number }
type CatalogTest = {
  id: number; name: string; unit: string
  general_desc: string | null; starting_position: string | null; execution: string | null
  end_position: string | null; measurement: string | null; goal: string | null
  sort_order: number
  // warianty wykonania (np. Chwyt: podchwyt / nachwyt / …) — puste = brak
  variant_label?: string | null; variant_options?: string[] | null
}
type Result = { id: number; athlete_id: number; test_catalog_id: number | null; value: number | null; test_date: string | null; flagged?: boolean; variant?: string | null }

function hasVariants(t: CatalogTest) {
  return (t.variant_options?.length ?? 0) > 0
}

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

function resultOn(results: Result[], athleteId: number, testId: number, date: string) {
  return results.find(x => x.athlete_id === athleteId && x.test_catalog_id === testId && x.test_date === date)
}

function valueOn(results: Result[], athleteId: number, testId: number, date: string) {
  const r = resultOn(results, athleteId, testId, date)
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
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  // optymistyczne oznaczenia (id wyniku → flagged) zanim odświeży się strona
  const [flagOverride, setFlagOverride] = useState<Record<number, boolean>>({})

  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'
  const isFlagged = (r: Result) => (r.id in flagOverride ? flagOverride[r.id] : !!r.flagged)

  async function toggleFlag(r: Result) {
    const next = !isFlagged(r)
    setFlagOverride(f => ({ ...f, [r.id]: next }))
    const { error } = await createClient().from('benchmark_tests').update({ flagged: next }).eq('id', r.id)
    if (error) {
      setFlagOverride(f => ({ ...f, [r.id]: !next }))
      alert(`Nie udało się zapisać oznaczenia: ${error.message}\n\nCzy migracja 202611020001_benchmark_flagged.sql została uruchomiona w Supabase?`)
      return
    }
    router.refresh()
  }

  const visibleTestList = catalog.filter(t => visibleTests.has(t.id))
  const flaggedResults = results.filter(r => isFlagged(r) && r.test_catalog_id != null && visibleTests.has(r.test_catalog_id))
  const flaggedAthleteIds = new Set(flaggedResults.map(r => r.athlete_id))
  const testDates = useMemo(() => {
    const map: Record<number, string[]> = {}
    for (const t of visibleTestList) {
      let dates = datesForTest(results, t.id, dateFrom, dateTo)
      // w trybie „do sprawdzenia” pokaż też daty oznaczonych wyników (mogą być starsze niż najnowszy pomiar)
      if (onlyFlagged) {
        const extra = flaggedResults.filter(r => r.test_catalog_id === t.id && r.test_date).map(r => r.test_date!)
        dates = [...new Set([...dates, ...extra])].sort()
      }
      map[t.id] = dates
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, dateFrom, dateTo, visibleTests, catalog, onlyFlagged, flagOverride])

  const people = useMemo(() => {
    let list = athletes.filter(a => groupFilter.has(a.group_id) && a.birth_year != null && yearFilter.has(a.birth_year))
    if (onlyFlagged) list = list.filter(a => flaggedAthleteIds.has(a.id))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletes, groupFilter, yearFilter, sortTestId, sortDir, testDates, results, onlyFlagged, flagOverride])

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

        <button
          type="button"
          className={`coach-rt-flag-filter${onlyFlagged ? ' coach-active' : ''}`}
          onClick={() => setOnlyFlagged(v => !v)}
          title="Pokaż tylko zawodniczki z wynikami oznaczonymi do sprawdzenia"
        >
          <Flag size={12} /> Do sprawdzenia ({flaggedResults.length})
        </button>
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
              {people.map(p => (
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
                      const rec = resultOn(results, p.id, t.id, d)
                      const flagged = rec ? isFlagged(rec) : false
                      return (
                        <td key={t.id + d} className={flagged ? 'coach-rt-flagged' : undefined}>
                          <div className="coach-rt-value-cell">
                            {arrow}
                            {val !== null ? val : <span className="coach-rt-empty-val">–</span>}
                            {rec?.variant && <span className="coach-rt-variant" title={t.variant_label || 'Wariant'}>{rec.variant}</span>}
                            {rec && (
                              <button
                                type="button"
                                className={`coach-rt-flag-btn${flagged ? ' coach-on' : ''}`}
                                title={flagged ? 'Wynik oznaczony do sprawdzenia — kliknij, by zdjąć oznaczenie' : 'Oznacz wynik do sprawdzenia / powtórzenia'}
                                onClick={() => toggleFlag(rec)}
                              >
                                <Flag size={11} />
                              </button>
                            )}
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
  variant_label: string; variant_options: string
}
const EMPTY_FORM: CatalogFormData = { name: '', unit: '', general_desc: '', starting_position: '', execution: '', end_position: '', measurement: '', goal: '', variant_label: '', variant_options: '' }

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
      variant_label: t.variant_label || '', variant_options: (t.variant_options || []).join(', '),
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
      variant_label: form.variant_label.trim() || null,
      variant_options: [...new Set(form.variant_options.split(/[,;\n]/).map(s => s.trim()).filter(Boolean))],
    }
    const { error } = formMode && typeof formMode === 'object'
      ? await supabase.from('test_catalog').update(payload).eq('id', formMode.editId)
      : await supabase.from('test_catalog').insert({ ...payload, sort_order: Math.max(0, ...catalog.map(t => t.sort_order ?? 0)) + 1 })
    setSaving(false)
    if (error) {
      alert(`Nie udało się zapisać testu: ${error.message}\n\nCzy migracja 202611020002_test_variants.sql została uruchomiona w Supabase?`)
      return
    }
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
          <div className="coach-field-grid-2">
            <Field label="Wariant wykonania (opcjonalnie)">
              <input value={form.variant_label} onChange={e => setForm(f => ({ ...f, variant_label: e.target.value }))} placeholder="np. Chwyt" />
            </Field>
            <Field label="Opcje wariantu (po przecinku)">
              <input value={form.variant_options} onChange={e => setForm(f => ({ ...f, variant_options: e.target.value }))} placeholder="np. podchwyt, nachwyt, neutralny, mieszany" />
            </Field>
          </div>
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
              {hasVariants(t) && (
                <div><div className="coach-cd-label">{t.variant_label || 'Wariant'}</div><div className="coach-cd-val">{t.variant_options!.join(', ')}</div></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Edytor wyników ──────────────────────────────────────────────────────────
// Wiele testów naraz (kolumna na test). Enter / ↓ przechodzi do kolejnej
// zawodniczki w tej samej kolumnie, Shift+Enter / ↑ do poprzedniej — strzałki
// nie zmieniają wartości (pole tekstowe zamiast number).
function EdytorTab({ groups, athletes, catalog, results }: Props) {
  const router = useRouter()
  const [editorGroups, setEditorGroups] = useState<Set<number>>(new Set(groups.map(g => g.id)))
  const [testIds, setTestIds] = useState<Set<number>>(new Set(catalog[0] ? [catalog[0].id] : []))
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  // klucz: `${athleteId}:${testId}`
  const [values, setValues] = useState<Record<string, string>>({})
  // zmienione oznaczenia „do sprawdzenia” (ten sam klucz), zapisywane razem z wynikami
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  // zmienione warianty wykonania (np. chwyt w pull up), ten sam klucz
  const [variants, setVariants] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  function toggleGroup(id: number) {
    const next = new Set(editorGroups)
    if (next.has(id)) next.delete(id); else next.add(id)
    setEditorGroups(next)
  }
  function toggleTest(id: number) {
    const next = new Set(testIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setTestIds(next)
  }

  const tests = catalog.filter(t => testIds.has(t.id))

  const rosterByGroup = groups
    .filter(g => editorGroups.has(g.id))
    .map(g => ({
      group: g,
      people: athletes.filter(a => a.group_id === g.id).slice().sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl')),
    }))
  const flatPeople = rosterByGroup.flatMap(r => r.people)

  function existingValue(athleteId: number, testId: number): string {
    const existing = valueOn(results, athleteId, testId, date)
    return existing !== null ? String(existing) : ''
  }
  function valueFor(athleteId: number, testId: number): string {
    const k = `${athleteId}:${testId}`
    return k in values ? values[k] : existingValue(athleteId, testId)
  }
  function flagFor(athleteId: number, testId: number): boolean {
    const k = `${athleteId}:${testId}`
    return k in flags ? flags[k] : !!resultOn(results, athleteId, testId, date)?.flagged
  }
  function existingVariant(athleteId: number, testId: number): string {
    return resultOn(results, athleteId, testId, date)?.variant || ''
  }
  function variantFor(athleteId: number, testId: number): string {
    const k = `${athleteId}:${testId}`
    return k in variants ? variants[k] : existingVariant(athleteId, testId)
  }
  function setVariant(athleteId: number, testId: number, v: string) {
    const k = `${athleteId}:${testId}`
    setVariants(prev => {
      const n = { ...prev }
      if (v === existingVariant(athleteId, testId)) delete n[k]; else n[k] = v
      return n
    })
  }
  function toggleFlag(athleteId: number, testId: number) {
    const k = `${athleteId}:${testId}`
    const next = !flagFor(athleteId, testId)
    setFlags(f => {
      const n = { ...f }
      if (next === !!resultOn(results, athleteId, testId, date)?.flagged) delete n[k]; else n[k] = next
      return n
    })
  }

  function focusCell(row: number, testId: number) {
    const p = flatPeople[row]
    if (!p) return
    const el = inputRefs.current.get(`${p.id}:${testId}`)
    if (el) { el.focus(); el.select() }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, row: number, testId: number) {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const up = e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)
      focusCell(up ? row - 1 : row + 1, testId)
      return
    }
    // ← / → między kolumnami testów — jak w arkuszu: gdy kursor jest na brzegu
    // tekstu (albo całe pole jest zaznaczone), inaczej strzałka przesuwa kursor
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.currentTarget instanceof HTMLInputElement) {
      const el = e.currentTarget
      const len = el.value.length
      const start = el.selectionStart ?? 0
      const end = el.selectionEnd ?? 0
      const allSelected = start === 0 && end === len
      const atEdge = e.key === 'ArrowLeft' ? start === 0 && end === 0 : start === len && end === len
      if (!allSelected && !atEdge) return
      const idx = tests.findIndex(t => t.id === testId)
      const next = tests[idx + (e.key === 'ArrowLeft' ? -1 : 1)]
      if (!next) return
      e.preventDefault()
      focusCell(row, next.id)
    }
  }

  const invalidCount = flatPeople.reduce((n, p) => n + tests.filter(t => parseNum(valueFor(p.id, t.id)) === null).length, 0)

  async function handleSaveAll() {
    if (tests.length === 0) return
    if (invalidCount > 0 && !confirm(`${invalidCount} pól ma niepoprawną wartość (zaznaczone na czerwono) i zostanie pominiętych. Zapisać resztę?`)) return
    setSaving(true)
    const supabase = createClient()
    const inserts: { athlete_id: number; test_catalog_id: number; value: number; test_date: string; flagged?: boolean; variant?: string }[] = []
    const ops: PromiseLike<{ error: { message: string } | null }>[] = []
    let count = 0
    for (const p of flatPeople) {
      for (const t of tests) {
        const k = `${p.id}:${t.id}`
        if (!(k in values) && !(k in flags) && !(k in variants)) continue
        const parsed = parseNum(valueFor(p.id, t.id))
        if (parsed === null) continue
        const existing = resultOn(results, p.id, t.id, date)
        const flagged = flagFor(p.id, t.id)
        const variant = hasVariants(t) ? variantFor(p.id, t.id) : ''
        if (parsed === '') {
          if (existing) { ops.push(supabase.from('benchmark_tests').delete().eq('id', existing.id)); count++ }
          continue
        }
        if (existing) {
          const patch: { value?: number; flagged?: boolean; variant?: string | null } = {}
          if (existing.value !== parsed) patch.value = parsed
          if (!!existing.flagged !== flagged) patch.flagged = flagged
          if ((existing.variant || '') !== variant) patch.variant = variant || null
          if (Object.keys(patch).length === 0) continue
          ops.push(supabase.from('benchmark_tests').update(patch).eq('id', existing.id))
        } else {
          inserts.push({ athlete_id: p.id, test_catalog_id: t.id, value: parsed, test_date: date, ...(flagged ? { flagged: true } : {}), ...(variant ? { variant } : {}) })
        }
        count++
      }
    }
    if (inserts.length) ops.push(supabase.from('benchmark_tests').insert(inserts))
    const res = await Promise.all(ops)
    setSaving(false)
    const failed = res.filter(r => r.error)
    if (failed.length) {
      alert(`Nie udało się zapisać ${failed.length} zmian: ${failed[0].error!.message}`)
    } else {
      setSavedMsg(`Zapisano ${count} zmian ✓`)
      setTimeout(() => setSavedMsg(''), 2000)
    }
    setValues(v => Object.fromEntries(Object.entries(v).filter(([, raw]) => parseNum(raw) === null)))
    setFlags({})
    setVariants({})
    router.refresh()
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
          <span className="coach-tf-group-label">Testy</span>
          <FilterDropdown summary={multiSummary(testIds, catalog.map(t => t.id), id => catalog.find(t => t.id === id)?.name ?? '')}>
            <div className="coach-tfd-list">
              <div className={`coach-tfd-item coach-tfd-all ${testIds.size === catalog.length ? 'coach-active' : ''}`} onClick={() => setTestIds(new Set(catalog.map(t => t.id)))}>Wszystkie</div>
              {catalog.map(t => (
                <div key={t.id} className={`coach-tfd-item ${testIds.has(t.id) ? 'coach-active' : ''}`} onClick={() => toggleTest(t.id)}>{t.name} ({t.unit})</div>
              ))}
            </div>
          </FilterDropdown>
        </div>
        <div className="coach-tf-group">
          <span className="coach-tf-group-label">Data pomiaru</span>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setValues({}); setFlags({}); setVariants({}) }} />
        </div>
        <div className="coach-tf-group" style={{ justifyContent: 'flex-end', flexDirection: 'row', gap: 8 }}>
          <Button variant="gold" onClick={handleSaveAll} disabled={saving || tests.length === 0}>
            {saving ? 'Zapisuję...' : savedMsg || 'Zapisz wyniki'}
          </Button>
          <Button onClick={() => setImportOpen(true)}>⬆ Import z pliku</Button>
        </div>
      </div>

      <div className="coach-eb-hint">Enter / ↓ — następna zawodniczka · Shift+Enter / ↑ — poprzednia · ← / → — sąsiedni test · flaga — oznacz wynik do sprawdzenia · chwyt/wariant wybierz z listy obok wyniku (zapisuje się przyciskiem „Zapisz wyniki”)</div>

      {tests.length === 0 ? (
        <div className="coach-empty-list">Wybierz co najmniej jeden test.</div>
      ) : (
        <div className="coach-editor-bulk-table-wrap">
          <table className="coach-editor-bulk-table">
            <thead>
              <tr>
                <th>Zawodniczka</th>
                {tests.map(t => (
                  <th key={t.id}>
                    {t.name} ({t.unit})
                    {hasVariants(t) && (
                      <select
                        className="coach-eb-variant-all"
                        value=""
                        title={`Ustaw ${(t.variant_label || 'wariant').toLowerCase()} wszystkim widocznym zawodniczkom`}
                        onChange={e => { const v = e.target.value; if (v) flatPeople.forEach(p => setVariant(p.id, t.id, v === '-' ? '' : v)) }}
                      >
                        <option value="">{t.variant_label || 'Wariant'}: ustaw wszystkim…</option>
                        {t.variant_options!.map(o => <option key={o} value={o}>{o}</option>)}
                        <option value="-">— wyczyść —</option>
                      </select>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rosterByGroup.map(({ group, people }) => (
                <Fragment key={group.id}>
                  <tr className="coach-eb-group-row"><td colSpan={tests.length + 1}>{group.name}</td></tr>
                  {people.map(p => {
                    const row = flatPeople.indexOf(p)
                    return (
                      <tr key={p.id}>
                        <td className="coach-eb-name">{p.full_name}</td>
                        {tests.map(t => {
                          const k = `${p.id}:${t.id}`
                          const val = valueFor(p.id, t.id)
                          const invalid = parseNum(val) === null
                          const dirty = (k in values && values[k] !== existingValue(p.id, t.id)) || k in flags || k in variants
                          const flagged = flagFor(p.id, t.id)
                          return (
                            <td key={t.id}>
                              <div className="coach-eb-cell">
                              <input
                                ref={el => { if (el) inputRefs.current.set(k, el); else inputRefs.current.delete(k) }}
                                type="text" inputMode="decimal" autoComplete="off"
                                className={`coach-eb-input${invalid ? ' coach-invalid' : flagged ? ' coach-flagged' : dirty ? ' coach-dirty' : ''}`}
                                title={invalid ? 'Niepoprawna liczba' : undefined}
                                value={val}
                                onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))}
                                onKeyDown={e => handleKeyDown(e, row, t.id)}
                                onFocus={e => e.target.select()}
                              />
                              {hasVariants(t) && (
                                <select
                                  className={`coach-eb-variant${k in variants ? ' coach-dirty' : ''}${!variantFor(p.id, t.id) && val.trim() !== '' ? ' coach-missing' : ''}`}
                                  value={variantFor(p.id, t.id)}
                                  title={t.variant_label || 'Wariant'}
                                  onChange={e => setVariant(p.id, t.id, e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleKeyDown(e, row, t.id) }}
                                >
                                  <option value="">{(t.variant_label || 'wariant').toLowerCase()}…</option>
                                  {t.variant_options!.map(o => <option key={o} value={o}>{o}</option>)}
                                  {variantFor(p.id, t.id) && !t.variant_options!.includes(variantFor(p.id, t.id)) && (
                                    <option value={variantFor(p.id, t.id)}>{variantFor(p.id, t.id)}</option>
                                  )}
                                </select>
                              )}
                              <button
                                type="button" tabIndex={-1}
                                className={`coach-rt-flag-btn coach-eb-flag${flagged ? ' coach-on' : ''}`}
                                title={flagged ? 'Oznaczony do sprawdzenia — kliknij, by zdjąć' : 'Oznacz wynik do sprawdzenia / powtórzenia'}
                                disabled={val.trim() === '' && !flagged}
                                onClick={() => toggleFlag(p.id, t.id)}
                              >
                                <Flag size={11} />
                              </button>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importOpen && (
        <TestImportModal
          groups={groups}
          athletes={athletes}
          catalog={catalog}
          results={results}
          defaultDate={date}
          templateTestIds={tests.map(t => t.id)}
          templateGroupIds={[...editorGroups]}
          onClose={() => setImportOpen(false)}
        />
      )}
    </>
  )
}
