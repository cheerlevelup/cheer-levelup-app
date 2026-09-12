'use client'
// src/app/coach/groups/[id]/ManagedGroupClient.tsx
// Panel grupy zorganizowanej — trener prowadzi grupę i wpisuje wszystko sam
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Dumbbell, Upload, X } from 'lucide-react'
import { localDateStr, formatDatePl, linkLogsToTraining } from '@/lib/groupTraining'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, Card, Modal, Field, Button } from '@/components/coach/ui'

type Group = { id: number; name: string; group_type?: string }
type Athlete = { id: number; full_name: string; birth_year?: number | null }
type Training = { id: number; group_id: number; training_date: string; created_at: string }

interface Props {
  group: Group
  athletes: Athlete[]
  trainings: Training[]
}

type SetCell = { weight?: string; skipped?: boolean }
type MatrixEntry = { athleteId: number; sets: SetCell[]; comment?: string }
type ParsedRow = { name: string; sets: string; reps: string; tempo: string; entries?: MatrixEntry[] }

function normName(s: any) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Format z arkusza: imię + nazwisko w 2 kolumnach, ćwiczenia w scalonym nagłówku,
// pod nimi I (kg) / II (kg) (serie), reps, tempo, kom. Ciężary w komórkach, „-” = nie zrobiła.
function detectMatrix(rows: any[][], athletes: Athlete[]):
  { exercises: ParsedRow[]; matched: number; unmatched: string[] } | null {
  let labelRow = -1
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const j = (rows[i] || []).map(x => String(x ?? '').toLowerCase()).join(' ')
    if (/rep/.test(j) && /tempo/.test(j)) { labelRow = i; break }
  }
  if (labelRow < 0) return null
  const presRow = labelRow + 1
  const labelArr = rows[labelRow] || []
  const presArr = rows[presRow] || []

  const nameArr = rows[Math.max(0, labelRow - 1)] || []
  const maxCol = Math.max((rows[labelRow] || []).length, (rows[presRow] || []).length, nameArr.length, 0)
  const colName: string[] = []
  let cur = '', started = false
  for (let c = 0; c < maxCol; c++) {
    let v = String(nameArr[c] ?? '').trim()
    if (/^\d{4,}$/.test(v)) v = ''
    if (v) { cur = v; started = true }
    colName[c] = started ? cur : ''
  }

  const order: string[] = []
  const colsByName = new Map<string, number[]>()
  for (let c = 2; c < maxCol; c++) {
    const nm = colName[c]
    if (!nm) continue
    if (!colsByName.has(nm)) { colsByName.set(nm, []); order.push(nm) }
    colsByName.get(nm)!.push(c)
  }

  type ExMeta = { name: string; weightCols: number[]; repsVal: string; tempoVal: string; komCol: number | null }
  const exMeta: ExMeta[] = []
  for (const nm of order) {
    const cols = colsByName.get(nm)!
    const weightCols = cols.filter(c => /kg/i.test(String(presArr[c] ?? '')))
    if (weightCols.length === 0) continue
    const repsCol = cols.find(c => /rep/i.test(String(labelArr[c] ?? '')))
    const tempoCol = cols.find(c => /tempo/i.test(String(labelArr[c] ?? '')))
    const komCol = cols.find(c => /kom/i.test(String(labelArr[c] ?? ''))) ?? null
    exMeta.push({
      name: nm,
      weightCols,
      repsVal: repsCol != null ? String(presArr[repsCol] ?? '').trim() : '',
      tempoVal: tempoCol != null ? String(presArr[tempoCol] ?? '').trim() : '',
      komCol,
    })
  }
  if (exMeta.length === 0) return null

  const dataRows: { first: string; last: string; cells: any[] }[] = []
  for (let i = presRow + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const first = String(r[0] ?? '').trim()
    const last = String(r[1] ?? '').trim()
    if (!first && !last) continue
    dataRows.push({ first, last, cells: r })
  }

  const pool = athletes.map(a => ({ id: a.id, full: normName(a.full_name), tokens: normName(a.full_name).split(' ').filter(Boolean) }))
  const consumed = new Set<number>()
  const assigned: (number | null)[] = dataRows.map(() => null)
  const tryAssign = (idx: number, id: number) => { assigned[idx] = id; consumed.add(id) }

  dataRows.forEach((d, idx) => {
    const full = normName(`${d.first} ${d.last}`)
    const a = pool.find(p => !consumed.has(p.id) && p.full === full)
    if (a) tryAssign(idx, a.id)
  })
  dataRows.forEach((d, idx) => {
    if (assigned[idx]) return
    const lastTokens = normName(d.last).split(' ').filter(Boolean)
    if (!lastTokens.length) return
    const cand = pool.filter(p => !consumed.has(p.id) && lastTokens.some(t => p.tokens.includes(t)))
    if (cand.length === 1) tryAssign(idx, cand[0].id)
  })
  dataRows.forEach((d, idx) => {
    if (assigned[idx]) return
    const toks = [...normName(d.first).split(' '), ...normName(d.last).split(' ')].filter(Boolean)
    if (!toks.length) return
    const cand = pool.filter(p => !consumed.has(p.id) && toks.some(t => p.tokens.includes(t)))
    if (cand.length === 1) tryAssign(idx, cand[0].id)
  })

  const unmatched: string[] = []
  dataRows.forEach((d, idx) => { if (!assigned[idx]) unmatched.push(`${d.first} ${d.last}`.trim()) })

  const exercises: ParsedRow[] = exMeta.map(ex => {
    const entries: MatrixEntry[] = []
    dataRows.forEach((d, idx) => {
      const aid = assigned[idx]
      if (!aid) return
      const sets: SetCell[] = []
      for (const c of ex.weightCols) {
        const raw = String(d.cells[c] ?? '').trim()
        if (raw === '') continue
        if (raw === '-' || raw === '–' || /^x$/i.test(raw)) sets.push({ skipped: true })
        else sets.push({ weight: raw })
      }
      const comment = ex.komCol != null ? String(d.cells[ex.komCol] ?? '').trim() : ''
      if (sets.length || comment) entries.push({ athleteId: aid, sets, comment: comment || undefined })
    })
    return { name: ex.name, sets: String(ex.weightCols.length), reps: ex.repsVal, tempo: ex.tempoVal, entries }
  })

  const matchedCount = assigned.filter(Boolean).length
  if (matchedCount === 0) return null
  return { exercises, matched: matchedCount, unmatched }
}

// Heurystyka: znajdź ćwiczenia w arkuszu (wiersz = ćwiczenie, kolumny:
// nazwa / serie / powtórzenia / tempo). Wynik i tak jest edytowalny.
function extractExercises(rows: any[][]): ParsedRow[] {
  const norm = (s: any) => String(s ?? '').trim()
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if ((rows[i] || []).some(c => /ćwicz|cwicz|exercise|nazwa/i.test(norm(c)))) { headerIdx = i; break }
  }
  let nameCol = 0, setsCol = 1, repsCol = 2, tempoCol = 3
  if (headerIdx >= 0) {
    const h = (rows[headerIdx] || []).map(norm)
    const find = (re: RegExp, def: number) => { const idx = h.findIndex(c => re.test(c)); return idx >= 0 ? idx : def }
    nameCol = find(/ćwicz|cwicz|exercise|nazwa/i, 0)
    setsCol = find(/seri|sets/i, 1)
    repsCol = find(/powt|reps|rep/i, 2)
    tempoCol = find(/tempo/i, 3)
  }
  const start = headerIdx >= 0 ? headerIdx + 1 : 0
  const out: ParsedRow[] = []
  for (let i = start; i < rows.length; i++) {
    const r = rows[i] || []
    const name = norm(r[nameCol])
    if (!name) continue
    if (headerIdx < 0 && i === start && /ćwicz|nazwa|serie|powt|tempo/i.test(name)) continue
    out.push({
      name,
      sets: norm(r[setsCol]).replace(/[^\d]/g, ''),
      reps: norm(r[repsCol]),
      tempo: norm(r[tempoCol]),
    })
  }
  return out
}

function ImportTrainingModal({ group, athletes, onClose }: { group: Group; athletes: Athlete[]; onClose: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [date, setDate] = useState(localDateStr())
  const [rowsData, setRowsData] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [matchReport, setMatchReport] = useState<{ matched: number; unmatched: string[] } | null>(null)
  const [rawRows, setRawRows] = useState<any[][]>([])
  const [showRaw, setShowRaw] = useState(false)

  async function handleFile(file?: File | null) {
    if (!file) return
    setError(''); setParsing(true); setFileName(file.name); setMatchReport(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }) as any[][]
      setRawRows(rows.slice(0, 6).map(r => (r || []).slice(0, 14)))
      const matrix = detectMatrix(rows, athletes)
      if (matrix) {
        setRowsData(matrix.exercises)
        setMatchReport({ matched: matrix.matched, unmatched: matrix.unmatched })
      } else {
        const parsed = extractExercises(rows)
        if (parsed.length === 0) setError('Nie rozpoznałem układu pliku. Oczekiwany: imiona w 1. kolumnie, ćwiczenia w nagłówku, ciężary w komórkach — albo lista ćwiczeń (Ćwiczenie / Serie / Powt. / Tempo).')
        setRowsData(parsed)
      }
    } catch (e: any) {
      setError(`Nie udało się odczytać pliku: ${e?.message || e}`)
    }
    setParsing(false)
  }

  function updateRow(i: number, field: keyof ParsedRow, val: string) {
    setRowsData(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }
  function removeRow(i: number) { setRowsData(prev => prev.filter((_, idx) => idx !== i)) }
  function addRow() { setRowsData(prev => [...prev, { name: '', sets: '3', reps: '', tempo: '' }]) }

  async function handleCreate() {
    const valid = rowsData.filter(r => r.name.trim())
    if (!date) { setError('Wybierz datę treningu.'); return }
    if (valid.length === 0) { setError('Brak ćwiczeń do zapisania — wgraj plik albo dodaj wiersz.'); return }
    setCreating(true); setError('')
    const { data: tr, error: e1 } = await supabase
      .from('group_trainings')
      .insert({ group_id: group.id, training_date: date, roster_athlete_ids: athletes.map(a => a.id) })
      .select()
      .single()
    if (e1 || !tr) {
      setCreating(false)
      const dup = (e1?.message || '').includes('duplicate') || (e1?.message || '').includes('unique')
      setError(dup ? 'Istnieje już trening z tą datą — wybierz inną.' : (e1?.message || 'Błąd tworzenia treningu'))
      return
    }
    const exRows = valid.map((r, i) => ({
      training_id: tr.id,
      name: r.name.trim(),
      exercise_order: i + 1,
      sets_planned: r.sets ? parseInt(r.sets) : 3,
      reps: r.reps.trim() || null,
      tempo: r.tempo.trim() || null,
    }))
    const { data: insertedEx, error: e2 } = await supabase
      .from('group_training_exercises')
      .insert(exRows)
      .select()
    if (e2 || !insertedEx) { setCreating(false); setError(e2?.message || 'Błąd zapisu ćwiczeń'); return }

    const idByOrder = new Map<number, number>(insertedEx.map((x: any) => [x.exercise_order, x.id]))
    const entryRows: any[] = []
    valid.forEach((r, i) => {
      const exId = idByOrder.get(i + 1)
      if (!exId || !r.entries) return
      for (const e of r.entries) {
        if (!e.sets.length && !e.comment) continue
        entryRows.push({
          training_id: tr.id,
          exercise_id: exId,
          athlete_id: e.athleteId,
          sets: e.sets,
          comment: e.comment || null,
        })
      }
    })
    if (entryRows.length) {
      const { error: e3 } = await supabase.from('group_training_entries').insert(entryRows)
      if (e3) { setCreating(false); setError(`Trening utworzony, ale ciężary się nie zapisały: ${e3.message}`); return }
    }
    router.push(`/coach/groups/${group.id}/training/${tr.id}`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={group.name}
      title="Wgraj trening z archiwum"
      sub="Plik Excel (.xlsx/.csv). Rozpozna siatkę (imiona w wierszach × ćwiczenia w nagłówku, ciężary w komórkach) albo listę ćwiczeń."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleCreate} disabled={creating || rowsData.filter(r => r.name.trim()).length === 0}>
            {creating ? 'Tworzę trening...' : `Utwórz trening (${rowsData.filter(r => r.name.trim()).length} ćw.)`}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Field label="Data treningu">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
      </div>

      <label style={{ display: 'block', cursor: 'pointer', marginBottom: 14 }}>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
        <div style={{ padding: '0.9rem', borderRadius: 12, border: '1.5px dashed var(--muted-light)', background: 'var(--bg)', textAlign: 'center', color: 'var(--ink)', fontWeight: 700, fontSize: '0.86rem' }}>
          {parsing ? 'Analizuję plik...' : fileName ? `📄 ${fileName} — kliknij, by wgrać inny` : '⬆ Wgraj plik Excel / CSV'}
        </div>
      </label>

      {error && <div style={{ color: '#c23b3b', fontSize: '0.82rem', marginBottom: '0.9rem', background: '#FEF2F2', border: '1.5px solid #c23b3b', borderRadius: 10, padding: '0.6rem 0.75rem' }}>❌ {error}</div>}

      {matchReport && (
        <div style={{ marginBottom: '0.9rem', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 10, padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#15803D' }}>
          ✅ Wykryto siatkę z ciężarami — dopasowano <strong>{matchReport.matched}</strong> zawodniczek do grupy.
          {matchReport.unmatched.length > 0 && (
            <div style={{ marginTop: 5, color: '#92600A' }}>
              ⚠ Nie dopasowano (sprawdź pisownię lub dodaj do grupy): {matchReport.unmatched.join(', ')}
            </div>
          )}
        </div>
      )}

      {rawRows.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <button onClick={() => setShowRaw(v => !v)} style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, padding: 0, cursor: 'pointer' }}>
            {showRaw ? '▾' : '▸'} Podgląd odczytu z pliku (pierwsze wiersze)
          </button>
          {showRaw && (
            <div style={{ marginTop: 6, overflowX: 'auto', border: '1.5px solid var(--border)', borderRadius: 8 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.68rem' }}>
                <tbody>
                  {rawRows.map((r, ri) => (
                    <tr key={ri}>
                      <td style={{ padding: '2px 6px', color: 'var(--muted)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>{ri}</td>
                      {r.map((c, ci) => (
                        <td key={ci} style={{ padding: '2px 6px', color: 'var(--ink)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(c ?? '')}>{String(c ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {rowsData.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 70px 80px 28px', gap: 6, marginBottom: 5 }}>
            {['Ćwiczenie', 'Serie', 'Powt.', 'Tempo', ''].map((h, i) => (
              <span key={i} style={{ fontSize: '0.6rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 0 ? 'left' : 'center' }}>{h}</span>
            ))}
          </div>
          {rowsData.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 70px 80px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input value={r.name} onChange={e => updateRow(i, 'name', e.target.value)} placeholder="nazwa ćwiczenia" />
              <input value={r.sets} onChange={e => updateRow(i, 'sets', e.target.value.replace(/[^\d]/g, ''))} placeholder="3" inputMode="numeric" style={{ textAlign: 'center' }} />
              <input value={r.reps} onChange={e => updateRow(i, 'reps', e.target.value)} placeholder="8" style={{ textAlign: 'center' }} />
              <input value={r.tempo} onChange={e => updateRow(i, 'tempo', e.target.value)} placeholder="3010" style={{ textAlign: 'center' }} />
              <button onClick={() => removeRow(i)} title="Usuń" style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: '0.9rem', padding: 2, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </>
      )}
      <button onClick={addRow} className="coach-add-injury-btn" style={{ marginTop: 4 }}>
        ＋ Dodaj ćwiczenie ręcznie
      </button>
    </Modal>
  )
}

export default function ManagedGroupClient({ group, athletes, trainings }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [importOpen, setImportOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const today = localDateStr()
  const todayTraining = trainings.find(t => t.training_date === today)

  async function handleStartTraining() {
    setStarting(true); setError('')
    if (todayTraining) {
      router.push(`/coach/groups/${group.id}/training/${todayTraining.id}`)
      return
    }
    const { data, error: err } = await supabase
      .from('group_trainings')
      .insert({ group_id: group.id, training_date: today, roster_athlete_ids: athletes.map(a => a.id) })
      .select()
      .single()
    if (err || !data) {
      setError(err?.message || 'Nie udało się utworzyć treningu')
      setStarting(false)
      return
    }
    await linkLogsToTraining(supabase, athletes.map(a => a.id), data.id, today)
    router.push(`/coach/groups/${group.id}/training/${data.id}`)
  }

  async function handleDeleteTraining(t: Training) {
    if (!confirm(`Usunąć trening z dnia ${t.training_date}? Wszystkie wpisane serie i ciężary z tego treningu zostaną usunięte.`)) return
    setDeletingId(t.id)
    const { error: err } = await supabase.from('group_trainings').delete().eq('id', t.id)
    setDeletingId(null)
    if (err) { setError(err.message); return }
    router.refresh()
  }

  const actionTiles = [
    {
      label: todayTraining ? 'Kontynuuj dzisiejszy trening' : 'Rozpocznij trening',
      desc: 'Zapisz nową sesję treningową dla całej grupy',
      icon: <Dumbbell size={16} />,
      onClick: handleStartTraining,
      primary: true,
    },
    {
      label: 'Wgraj trening z archiwum',
      desc: 'Import z pliku Excel/CSV',
      icon: <Upload size={16} />,
      onClick: () => setImportOpen(true),
    },
  ]

  return (
    <>
      <SetPageMeta title={group.name} backHref="/coach/groups" backLabel="Grupy" />
      <div className="coach-content">
        <div className="coach-group-hero">
          <div className="coach-group-hero-title">
            <h2>{group.name}</h2>
            <span className="coach-badge-organized">zorganizowana</span>
          </div>
          <div className="coach-group-hero-sub">
            {athletes.length} zawodniczek <span className="coach-dot-sep">·</span> grupa prowadzona przez trenera
          </div>
        </div>

        <TabsNav
          items={[
            { key: 'treningi', label: 'Treningi', href: `/coach/groups/${group.id}` },
            { key: 'plan', label: 'Plan', href: `/coach/groups/${group.id}/plan` },
            { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${group.id}/stats` },
            { key: 'obecnosc', label: 'Obecność', href: `/coach/groups/${group.id}/attendance` },
            { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${group.id}/athletes` },
            { key: 'testy', label: 'Testy', href: `/coach/groups/${group.id}/tests` },
          ]}
        />

        <div className="coach-group-tab-panel">
          {error && (
            <div style={{ padding: '0.75rem', background: '#FEF2F2', border: '1.5px solid #c23b3b', borderRadius: 10, color: '#c23b3b', fontWeight: 700, fontSize: '0.86rem', marginBottom: '1rem' }}>
              ❌ {error}
            </div>
          )}

          <div className="coach-group-actions">
            {actionTiles.map(tile => (
              <button
                key={tile.label}
                onClick={tile.onClick}
                disabled={tile.primary && starting}
                className={`coach-group-action-btn ${tile.primary ? 'coach-primary' : ''}`}
              >
                <span className="coach-gab-icon">{tile.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="coach-gab-title">{tile.primary && starting ? 'Otwieram...' : tile.label}</div>
                  <div className="coach-gab-sub">{tile.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="coach-section-label" style={{ padding: '4px 0 8px' }}>Treningi ({trainings.length})</div>
          <Card>
            {trainings.length === 0 ? (
              <div className="coach-empty-list">Jeszcze nie było żadnego treningu. Kliknij „Rozpocznij trening”.</div>
            ) : (
              <div style={{ padding: '10px 14px' }}>
                {trainings.map(t => (
                  <div key={t.id} className="coach-training-list-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }} onClick={() => router.push(`/coach/groups/${group.id}/training/${t.id}`)}>
                      <span className="coach-training-date">{t.training_date}</span>
                      <span className="coach-training-weekday">{formatDatePl(t.training_date)}</span>
                      {t.training_date === today && (
                        <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 6, padding: '2px 7px' }}>
                          dziś
                        </span>
                      )}
                    </div>
                    <button className="coach-training-remove" onClick={() => handleDeleteTraining(t)} disabled={deletingId === t.id} title="Usuń trening">
                      {deletingId === t.id ? '...' : <X size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {importOpen && (
        <ImportTrainingModal group={group} athletes={athletes} onClose={() => setImportOpen(false)} />
      )}
    </>
  )
}
