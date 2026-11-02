'use client'
// src/app/coach/tests/TestImportModal.tsx
// Import wyników testów z pliku Excel/CSV: pobranie wzoru, odczyt pliku,
// dopasowanie kolumn do testów i wierszy do zawodniczek, podgląd ze zgłoszonymi
// błędami (nieznane osoby, złe wartości, duplikaty) i zapis po akceptacji.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Modal, Button, Field } from '@/components/coach/ui'

type Group = { id: number; name: string }
type Athlete = { id: number; full_name: string; birth_year: number | null; group_id: number }
type CatalogTest = { id: number; name: string; unit: string }
type Result = { id: number; athlete_id: number; test_catalog_id: number | null; value: number | null; test_date: string | null }

interface Props {
  groups: Group[]
  athletes: Athlete[]
  catalog: CatalogTest[]
  results: Result[]
  defaultDate: string
  templateTestIds: number[]
  templateGroupIds: number[]
  onClose: () => void
}

// ── Pomocnicze ───────────────────────────────────────────────────────────────

// "12,5" / " 12.5 " / "1 234" → liczba; pusty → '' ; niepoprawny → null
export function parseNum(raw: string): number | '' | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (s === '') return ''
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function norm(s: string) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
// klucz niezależny od kolejności "Imię Nazwisko" / "Nazwisko Imię"
function nameKey(s: string) {
  return norm(s).split(' ').filter(Boolean).sort().join(' ')
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

function pad(n: number) { return String(n).padStart(2, '0') }

// komórka daty z Excela (Date / numer seryjny / tekst) → 'YYYY-MM-DD' | null
function parseDateCell(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v.getTime())) {
    // xlsx z cellDates daje datę o północy czasu lokalnego (czasem z przesunięciem o sekundy)
    const d = new Date(v.getTime() + 12 * 3600 * 1000)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`
  }
  return null
}

function cellText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return parseDateCell(v) ?? ''
  return String(v).trim()
}

// ── Model odczytanego pliku ──────────────────────────────────────────────────
type ColRole = 'name' | 'first' | 'last' | 'group' | 'date' | 'ignore'
type FileCol = { index: number; header: string; role: ColRole; testId: number | null }
type FileRow = { rowNo: number; cells: unknown[] }

const NAME_RE = /^(zawodnicz|imie i nazwisko|nazwisko i imie|imie nazwisko|nazwisko imie|osoba|name|athlete)/
const FIRST_RE = /^(imie|first)/
const LAST_RE = /^(nazwisko|last|surname)/
const GROUP_RE = /^(grupa|group|druzyna|team)/
const DATE_RE = /^(data|date)/
const IGNORE_RE = /^(lp|nr|no|rocznik|rok urodzenia|uwagi|komentarz)$/

function matchTest(header: string, catalog: CatalogTest[]): number | null {
  const h = norm(header)
  if (!h) return null
  const hNoParen = norm(header.replace(/\s*[([][^)\]]*[)\]]\s*$/, ''))
  for (const t of catalog) {
    const cands = [norm(t.name), norm(`${t.name} (${t.unit})`), norm(`${t.name} [${t.unit}]`), norm(`${t.name} ${t.unit}`)]
    if (cands.includes(h) || cands.includes(hNoParen)) return t.id
  }
  // luźniej: nagłówek zaczyna się nazwą testu
  const loose = catalog.filter(t => norm(t.name).length >= 4 && h.startsWith(norm(t.name)))
  if (loose.length === 1) return loose[0].id
  return null
}

function detectHeaderRow(rows: unknown[][], catalog: CatalogTest[]) {
  let best = 0, bestScore = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] || []
    let score = 0
    for (const c of r) {
      const n = norm(cellText(c))
      if (!n) continue
      if (NAME_RE.test(n) || FIRST_RE.test(n) || LAST_RE.test(n) || DATE_RE.test(n) || GROUP_RE.test(n)) score += 2
      else if (matchTest(cellText(c), catalog) != null) score += 3
    }
    if (score > bestScore) { bestScore = score; best = i }
  }
  return best
}

function buildColumns(header: unknown[], catalog: CatalogTest[]): FileCol[] {
  const cols: FileCol[] = header.map((h, index) => {
    const text = cellText(h)
    const n = norm(text)
    let role: ColRole = 'ignore'
    let testId: number | null = null
    if (!n) role = 'ignore'
    else if (NAME_RE.test(n)) role = 'name'
    else if (FIRST_RE.test(n)) role = 'first'
    else if (LAST_RE.test(n)) role = 'last'
    else if (GROUP_RE.test(n)) role = 'group'
    else if (DATE_RE.test(n)) role = 'date'
    else if (IGNORE_RE.test(n)) role = 'ignore'
    else testId = matchTest(text, catalog)
    return { index, header: text, role, testId }
  })
  // brak kolumny z nazwiskiem → pierwsza kolumna
  if (!cols.some(c => c.role === 'name' || c.role === 'first' || c.role === 'last') && cols.length > 0) {
    cols[0] = { ...cols[0], role: 'name', testId: null }
  }
  return cols
}

// ── Komponent ────────────────────────────────────────────────────────────────
export default function TestImportModal({ groups, athletes, catalog, results, defaultDate, templateTestIds, templateGroupIds, onClose }: Props) {
  const router = useRouter()
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [cols, setCols] = useState<FileCol[]>([])
  const [rows, setRows] = useState<FileRow[]>([])
  const [date, setDate] = useState(defaultDate)
  // ręczne przypisania zawodniczek (rowNo → athleteId | 0 = pomiń)
  const [assign, setAssign] = useState<Record<number, number>>({})
  // wiersze odznaczone przez trenera
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'
  const testById = (id: number) => catalog.find(t => t.id === id)

  const byKey = useMemo(() => {
    const m = new Map<string, Athlete[]>()
    for (const a of athletes) {
      const k = nameKey(a.full_name)
      m.set(k, [...(m.get(k) || []), a])
    }
    return m
  }, [athletes])

  const athletesSorted = useMemo(() => athletes.slice().sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl')), [athletes])

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const tests = catalog.filter(t => templateTestIds.includes(t.id))
    const header = ['Zawodniczka', 'Grupa', ...tests.map(t => `${t.name} (${t.unit})`)]
    const data: (string | number)[][] = [header]
    for (const g of groups.filter(g => templateGroupIds.includes(g.id))) {
      for (const a of athletes.filter(a => a.group_id === g.id).sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl'))) {
        data.push([a.full_name, g.name, ...tests.map(() => '')])
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, ...tests.map(t => ({ wch: Math.max(14, t.name.length + t.unit.length + 4) }))]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Wyniki')
    XLSX.writeFile(wb, `wzor-wyniki-testow-${date}.xlsx`)
  }

  async function handleFile(file?: File | null) {
    if (!file) return
    setError(''); setParsing(true); setFileName(file.name); setAssign({}); setExcluded(new Set()); setDoneMsg('')
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const all = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', raw: true }) as unknown[][]
      if (all.length === 0) throw new Error('Plik jest pusty.')
      const h = detectHeaderRow(all, catalog)
      const c = buildColumns(all[h] || [], catalog)
      const r: FileRow[] = []
      for (let i = h + 1; i < all.length; i++) {
        const cells = all[i] || []
        if (cells.every(x => cellText(x) === '')) continue
        r.push({ rowNo: i + 1, cells })
      }
      if (!c.some(x => x.testId != null)) {
        setError('Nie rozpoznano żadnej kolumny z testem — przypisz kolumny ręcznie poniżej (nagłówki powinny mieć nazwy testów z katalogu).')
      }
      setCols(c); setRows(r)
    } catch (e) {
      setError(`Nie udało się odczytać pliku: ${e instanceof Error ? e.message : String(e)}`)
      setCols([]); setRows([])
    }
    setParsing(false)
  }

  function setColTarget(index: number, value: string) {
    setCols(prev => prev.map(c => {
      if (c.index !== index) return c
      if (value.startsWith('t:')) return { ...c, role: 'ignore', testId: Number(value.slice(2)) }
      return { ...c, role: value as ColRole, testId: null }
    }))
  }

  // ── Analiza wierszy ──
  const analysis = useMemo(() => {
    const nameCol = cols.find(c => c.role === 'name')
    const firstCol = cols.find(c => c.role === 'first')
    const lastCol = cols.find(c => c.role === 'last')
    const groupCol = cols.find(c => c.role === 'group')
    const dateCol = cols.find(c => c.role === 'date')
    const testCols = cols.filter(c => c.testId != null)

    // ten sam test w dwóch kolumnach
    const testColCount = new Map<number, number>()
    for (const c of testCols) testColCount.set(c.testId!, (testColCount.get(c.testId!) || 0) + 1)
    const dupTestCols = [...testColCount.entries()].filter(([, n]) => n > 1).map(([id]) => testById(id)?.name ?? '')

    const seen = new Map<string, number>() // athleteId|date → rowNo
    const out = rows.map(row => {
      const get = (c?: FileCol) => (c ? row.cells[c.index] : '')
      let rawName = nameCol ? cellText(get(nameCol)) : ''
      if (!rawName && (firstCol || lastCol)) rawName = `${cellText(get(firstCol))} ${cellText(get(lastCol))}`.trim()
      const rawGroup = cellText(get(groupCol))
      const issues: string[] = []
      const warnings: string[] = []

      // dopasowanie zawodniczki
      let athlete: Athlete | null = null
      let status: 'ok' | 'manual' | 'unknown' | 'ambiguous' | 'skip' = 'unknown'
      let suggestions: Athlete[] = []
      if (row.rowNo in assign) {
        const id = assign[row.rowNo]
        athlete = id ? athletes.find(a => a.id === id) ?? null : null
        status = id ? 'manual' : 'skip'
      } else {
        let cands = byKey.get(nameKey(rawName)) || []
        if (cands.length > 1 && rawGroup) {
          const narrowed = cands.filter(a => norm(groupName(a.group_id)) === norm(rawGroup))
          if (narrowed.length > 0) cands = narrowed
        }
        if (cands.length === 1) { athlete = cands[0]; status = 'ok' }
        else if (cands.length > 1) { status = 'ambiguous'; suggestions = cands }
        else {
          const k = nameKey(rawName)
          suggestions = athletes
            .map(a => ({ a, d: levenshtein(k, nameKey(a.full_name)) }))
            .filter(x => x.d <= Math.max(2, Math.floor(k.length / 5)))
            .sort((x, y) => x.d - y.d)
            .slice(0, 3)
            .map(x => x.a)
        }
      }
      if (!rawName) issues.push('Brak imienia i nazwiska')
      else if (status === 'unknown') issues.push(`Brak w aplikacji: „${rawName}”`)
      else if (status === 'ambiguous') issues.push(`Kilka zawodniczek o nazwisku „${rawName}” — wybierz właściwą`)
      if (athlete && rawGroup && norm(groupName(athlete.group_id)) !== norm(rawGroup)) {
        warnings.push(`Grupa w pliku „${rawGroup}”, w aplikacji „${groupName(athlete.group_id)}”`)
      }

      // data
      let rowDate = date
      if (dateCol) {
        const raw = get(dateCol)
        if (cellText(raw) !== '') {
          const d = parseDateCell(raw)
          if (d) rowDate = d
          else issues.push(`Nieczytelna data „${cellText(raw)}”`)
        }
      }

      // wartości
      const values = testCols.map(c => {
        const raw = cellText(get(c))
        const parsed = raw === '' ? '' : (typeof get(c) === 'number' ? (get(c) as number) : parseNum(raw))
        const existing = athlete ? results.find(r => r.athlete_id === athlete!.id && r.test_catalog_id === c.testId && r.test_date === rowDate) : undefined
        return { col: c, raw, parsed, existing }
      })
      const bad = values.filter(v => v.parsed === null)
      for (const v of bad) issues.push(`${testById(v.col.testId!)?.name}: „${v.raw}” to nie liczba`)
      const filled = values.filter(v => typeof v.parsed === 'number')
      if (filled.length === 0 && bad.length === 0) warnings.push('Brak wyników w wierszu')

      // duplikat zawodniczki w pliku
      if (athlete) {
        const k = `${athlete.id}|${rowDate}`
        if (seen.has(k)) issues.push(`Duplikat — ta zawodniczka jest już w wierszu ${seen.get(k)}`)
        else seen.set(k, row.rowNo)
      }

      const hasError = issues.length > 0 || !athlete
      const included = !hasError && filled.length > 0 && !excluded.has(row.rowNo)
      return { row, rawName, rawGroup, athlete, status, suggestions, rowDate, values, issues, warnings, hasError, included }
    })

    const toSave = out.filter(r => r.included).flatMap(r =>
      r.values.filter(v => typeof v.parsed === 'number').map(v => ({
        athlete_id: r.athlete!.id, test_catalog_id: v.col.testId!, value: v.parsed as number, test_date: r.rowDate, existing: v.existing,
      })),
    )
    return {
      rows: out, testCols, dupTestCols, toSave,
      unknownNames: out.filter(r => r.status === 'unknown' && r.rawName).map(r => r.rawName),
      errorRows: out.filter(r => r.hasError && r.status !== 'skip').length,
      overwrites: toSave.filter(s => s.existing && s.existing.value !== s.value).length,
      unchanged: toSave.filter(s => s.existing && s.existing.value === s.value).length,
      hasNameCol: !!(nameCol || firstCol || lastCol),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, assign, excluded, date, athletes, results, byKey])

  const unmappedCols = cols.filter(c => c.role === 'ignore' && c.testId == null && c.header && !IGNORE_RE.test(norm(c.header)))
  const writes = analysis.toSave.filter(s => !(s.existing && s.existing.value === s.value))

  async function handleSave() {
    if (writes.length === 0) return
    if (analysis.overwrites > 0 && !confirm(`${analysis.overwrites} istniejących wyników zostanie nadpisanych nowymi wartościami. Kontynuować?`)) return
    setSaving(true); setError('')
    const supabase = createClient()
    const inserts = writes.filter(w => !w.existing).map(w => ({ athlete_id: w.athlete_id, test_catalog_id: w.test_catalog_id, value: w.value, test_date: w.test_date }))
    const updates = writes.filter(w => w.existing)
    if (inserts.length) {
      const { error: e1 } = await supabase.from('benchmark_tests').insert(inserts)
      if (e1) { setSaving(false); setError(`Błąd zapisu: ${e1.message}`); return }
    }
    const res = await Promise.all(updates.map(u => supabase.from('benchmark_tests').update({ value: u.value }).eq('id', u.existing!.id)))
    const failed = res.filter(r => r.error)
    setSaving(false)
    if (failed.length) { setError(`Nie udało się zaktualizować ${failed.length} wyników: ${failed[0].error!.message}`); return }
    setDoneMsg(`Zapisano ${writes.length} wyników (${inserts.length} nowych, ${updates.length} nadpisanych) ✓`)
    router.refresh()
  }

  const loaded = rows.length > 0

  return (
    <Modal
      open
      xl
      onClose={onClose}
      eyebrow="Testy"
      title="Import wyników z pliku"
      sub="Excel (.xlsx) lub CSV. Sprawdź podgląd i zatwierdź — nic nie zapisze się bez akceptacji."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{doneMsg ? 'Zamknij' : 'Anuluj'}</Button>
          {!doneMsg && (
            <Button variant="gold" onClick={handleSave} disabled={saving || writes.length === 0 || analysis.dupTestCols.length > 0}>
              {saving ? 'Zapisuję...' : `Zatwierdź i zapisz (${writes.length})`}
            </Button>
          )}
        </>
      }
    >
      {doneMsg ? (
        <div className="coach-ti-alert" style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', color: '#15803D' }}>✅ {doneMsg}</div>
      ) : (
        <>
          <div className="coach-ti-help">
            <b>Jak przygotować plik:</b>
            <ul>
              <li>Pierwszy wiersz to nagłówki: <b>Zawodniczka</b> (imię i nazwisko, kolejność dowolna) lub osobno <b>Imię</b> i <b>Nazwisko</b>, opcjonalnie <b>Grupa</b> i <b>Data</b>.</li>
              <li>Pozostałe kolumny to testy — nazwa jak w katalogu (jednostka w nawiasie nie jest wymagana). Liczby z przecinkiem lub kropką.</li>
              <li>Brak kolumny <b>Data</b> → użyta zostanie data pomiaru wybrana poniżej. Puste komórki są pomijane.</li>
            </ul>
            <div style={{ marginTop: 8 }}>
              <Button size="small" onClick={downloadTemplate}>⬇ Pobierz wzór (wybrane grupy i testy)</Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
            <Field label="Data pomiaru (domyślna)">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
          </div>

          <label className="coach-ti-drop">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} style={{ display: 'none' }} />
            {parsing ? 'Analizuję plik...' : fileName ? `📄 ${fileName} — kliknij, by wgrać inny` : '⬆ Wybierz plik Excel / CSV'}
          </label>

          {error && <div className="coach-ti-alert coach-err">❌ {error}</div>}

          {loaded && (
            <>
              <div className="coach-ti-section">
                <h4>Kolumny w pliku</h4>
                <div className="coach-ti-colmap">
                  {cols.filter(c => c.header).map(c => (
                    <div key={c.index} className={`coach-ti-colmap-item ${unmappedCols.includes(c) ? 'coach-warn' : ''}`}>
                      <b>{c.header}</b>
                      <select value={c.testId != null ? `t:${c.testId}` : c.role} onChange={e => setColTarget(c.index, e.target.value)}>
                        <option value="ignore">— pomiń —</option>
                        <option value="name">Imię i nazwisko</option>
                        <option value="first">Imię</option>
                        <option value="last">Nazwisko</option>
                        <option value="group">Grupa</option>
                        <option value="date">Data</option>
                        <optgroup label="Test">
                          {catalog.map(t => <option key={t.id} value={`t:${t.id}`}>{t.name} ({t.unit})</option>)}
                        </optgroup>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {!analysis.hasNameCol && <div className="coach-ti-alert coach-err">❌ Nie wskazano kolumny z imieniem i nazwiskiem.</div>}
              {analysis.dupTestCols.length > 0 && (
                <div className="coach-ti-alert coach-err">❌ Ten sam test przypisany do kilku kolumn: {analysis.dupTestCols.join(', ')}. Zmień przypisanie jednej z nich.</div>
              )}
              {unmappedCols.length > 0 && (
                <div className="coach-ti-alert coach-warn">⚠ Kolumny niepasujące do żadnego testu (zostaną pominięte, chyba że je przypiszesz): {unmappedCols.map(c => `„${c.header}”`).join(', ')}</div>
              )}
              {analysis.unknownNames.length > 0 && (
                <div className="coach-ti-alert coach-err">
                  ❌ Zawodniczki z pliku, których nie ma w aplikacji ({analysis.unknownNames.length}) — przypisz je w tabeli albo zostaną pominięte:
                  <ul>{analysis.unknownNames.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </div>
              )}

              <div className="coach-ti-summary">
                <span className="coach-ti-pill coach-ok">✓ {analysis.rows.filter(r => r.included).length} wierszy do zapisu</span>
                <span className="coach-ti-pill coach-ok">{writes.length - analysis.overwrites} nowych wyników</span>
                {analysis.overwrites > 0 && <span className="coach-ti-pill coach-warn">{analysis.overwrites} nadpisze istniejące</span>}
                {analysis.unchanged > 0 && <span className="coach-ti-pill">{analysis.unchanged} bez zmian</span>}
                {analysis.errorRows > 0 && <span className="coach-ti-pill coach-err">{analysis.errorRows} wierszy z błędami (pominięte)</span>}
              </div>

              <div className="coach-ti-table-wrap">
                <table className="coach-ti-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Wiersz</th>
                      <th>Z pliku</th>
                      <th>Zawodniczka w aplikacji</th>
                      <th>Data</th>
                      {analysis.testCols.map(c => {
                        const t = testById(c.testId!)
                        return <th key={c.index}>{t?.name} ({t?.unit})</th>
                      })}
                      <th>Uwagi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.rows.map(r => {
                      const off = !r.hasError && !r.included
                      const cls = r.status === 'skip' || off ? 'coach-ti-row-off' : r.hasError ? 'coach-ti-row-err' : r.warnings.length ? 'coach-ti-row-warn' : ''
                      const selectVal = r.row.rowNo in assign ? String(assign[r.row.rowNo]) : r.athlete ? String(r.athlete.id) : ''
                      return (
                        <tr key={r.row.rowNo} className={cls}>
                          <td>
                            <input
                              type="checkbox"
                              checked={r.included}
                              disabled={r.hasError}
                              onChange={() => setExcluded(prev => { const n = new Set(prev); if (n.has(r.row.rowNo)) n.delete(r.row.rowNo); else n.add(r.row.rowNo); return n })}
                            />
                          </td>
                          <td className="coach-ti-src">{r.row.rowNo}</td>
                          <td>
                            {r.rawName || <span className="coach-ti-src">—</span>}
                            {r.rawGroup && <span className="coach-ti-src"> · {r.rawGroup}</span>}
                          </td>
                          <td>
                            <select
                              value={selectVal}
                              onChange={e => { const v = e.target.value; setAssign(a => { const n = { ...a }; if (v === '') delete n[r.row.rowNo]; else n[r.row.rowNo] = Number(v); return n }) }}
                              style={!r.athlete && r.status !== 'skip' ? { borderColor: '#c23b3b' } : undefined}
                            >
                              <option value="">— wybierz —</option>
                              <option value="0">✕ pomiń wiersz</option>
                              {r.suggestions.length > 0 && (
                                <optgroup label={r.status === 'ambiguous' ? 'Pasujące' : 'Czy chodziło o…'}>
                                  {r.suggestions.map(a => <option key={a.id} value={a.id}>{a.full_name} · {groupName(a.group_id)}</option>)}
                                </optgroup>
                              )}
                              <optgroup label="Wszystkie">
                                {athletesSorted.map(a => <option key={a.id} value={a.id}>{a.full_name} · {groupName(a.group_id)}</option>)}
                              </optgroup>
                            </select>
                          </td>
                          <td className="coach-ti-src">{r.rowDate}</td>
                          {r.values.map(v => (
                            <td key={v.col.index}>
                              {v.parsed === null
                                ? <span className="coach-ti-val coach-err">{v.raw}</span>
                                : v.parsed === '' ? <span className="coach-ti-src">–</span>
                                : <span className="coach-ti-val">{v.parsed}</span>}
                              {typeof v.parsed === 'number' && v.existing && (
                                v.existing.value === v.parsed
                                  ? <span className="coach-ti-same">bez zmian</span>
                                  : <span className="coach-ti-old">było: {v.existing.value ?? '–'}</span>
                              )}
                            </td>
                          ))}
                          <td style={{ fontSize: 11 }}>
                            {r.status === 'skip' ? <span className="coach-ti-src">pominięty</span> : (
                              <>
                                {r.issues.map((x, i) => <div key={i} style={{ color: '#c23b3b' }}>✕ {x}</div>)}
                                {r.warnings.map((x, i) => <div key={i} style={{ color: '#92600A' }}>⚠ {x}</div>)}
                                {r.status === 'manual' && <div className="coach-ti-src">przypisano ręcznie</div>}
                                {!r.issues.length && !r.warnings.length && r.status === 'ok' && <span style={{ color: '#15803D' }}>✓</span>}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
