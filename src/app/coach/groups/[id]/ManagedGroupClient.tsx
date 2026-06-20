'use client'
// src/app/coach/groups/[id]/ManagedGroupClient.tsx
// Panel grupy zorganizowanej — trener prowadzi grupę i wpisuje wszystko sam
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { localDateStr, formatDatePl, linkLogsToTraining } from '@/lib/groupTraining'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = { id: number; name: string; group_type?: string }
type Athlete = { id: number; full_name: string; birth_year?: number | null }
type Training = { id: number; group_id: number; training_date: string; created_at: string }

interface Props {
  group: Group
  athletes: Athlete[]
  trainings: Training[]
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>
      {children}
    </div>
  )
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function AddAthleteModal({ group, onClose, onAdded }: { group: Group; onClose: () => void; onAdded: () => void }) {
  const [fullName, setFullName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!fullName.trim()) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/athletes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          birth_year: birthYear || null,
          group_id: group.id,
          password: generatePassword(),
          // bez maila — konto powstaje z mailem technicznym,
          // można później podpiąć prawdziwy mail zawodniczki lub rodzica
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json?.error || `Błąd serwera (${res.status})`); setSaving(false); return }
      onAdded()
      onClose()
    } catch (e: any) {
      setError(`Błąd połączenia: ${e?.message || e}`)
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`,
    borderRadius: 10, background: C.offWhite, color: C.navy,
    fontFamily: sans, fontSize: '0.95rem', outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 440, background: C.white, borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.grayLight}` }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{group.name}</div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: C.white }}>Dodaj zawodniczkę</div>
          <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 4 }}>Bez maila — konto tworzy się automatycznie, mail można podpiąć później.</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Imię i nazwisko *</div>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="np. Anna Kowalska" autoFocus style={{ ...inputStyle, marginBottom: '1rem' }} />
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Rok urodzenia</div>
          <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="np. 2014" min={1990} max={2025} style={{ ...inputStyle, marginBottom: '1.1rem' }} />
          {error && <div style={{ color: C.red, fontSize: '0.82rem', marginBottom: '0.75rem' }}>❌ {error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '0.8rem 1.1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700, cursor: 'pointer' }}>
              Anuluj
            </button>
            <button onClick={handleCreate} disabled={saving || !fullName.trim()}
              style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: 12, background: !fullName.trim() ? C.grayLight : C.navy, color: !fullName.trim() ? C.gray : C.gold, fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer' }}>
              {saving ? 'Dodaję...' : 'Dodaj zawodniczkę'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type MatrixEntry = { athleteId: number; weights: string[] }
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

// Komórka z ciężarami → tablica ciężarów serii: „10/12/15”, „10 12 15”, „10, 12” → [10,12,15]
function parseWeights(cell: any): string[] {
  const s = String(cell ?? '').trim()
  if (!s) return []
  return s.split(/[,;/|\s]+/).map(t => t.trim()).filter(Boolean)
}

// Wiersz nagłówka = w kolumnach (od 2.) są nazwy ćwiczeń (tekst), nie liczby
function isHeaderRow(r: any[]) {
  const cells = (r || []).slice(1).map(c => String(c ?? '').trim()).filter(Boolean)
  if (cells.length < 2) return false
  const textCells = cells.filter(c => /[a-ząćęłńóśźż]/i.test(c))
  return textCells.length >= Math.ceil(cells.length * 0.6)
}

// Format siatki: imiona w wierszach × ćwiczenia w kolumnach, ciężary w komórkach
function detectMatrix(rows: any[][], athletes: Athlete[]):
  { exercises: ParsedRow[]; matched: string[]; unmatched: string[] } | null {
  const athleteMap = new Map<string, number>()
  for (const a of athletes) athleteMap.set(normName(a.full_name), a.id)

  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if (isHeaderRow(rows[i])) { headerIdx = i; break }
  }
  if (headerIdx < 0) return null

  const header = rows[headerIdx] || []
  const exCols: { col: number; name: string }[] = []
  for (let c = 1; c < header.length; c++) {
    const nm = String(header[c] ?? '').trim()
    if (nm) exCols.push({ col: c, name: nm })
  }
  if (exCols.length === 0) return null

  const perEx: MatrixEntry[][] = exCols.map(() => [])
  const matched: string[] = []
  const unmatched: string[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const rawName = String(r[0] ?? '').trim()
    if (!rawName) continue
    const id = athleteMap.get(normName(rawName))
    if (!id) { unmatched.push(rawName); continue }
    matched.push(rawName)
    exCols.forEach((ec, ei) => {
      const weights = parseWeights(r[ec.col])
      if (weights.length) perEx[ei].push({ athleteId: id, weights })
    })
  }
  if (matched.length === 0) return null

  const exercises: ParsedRow[] = exCols.map((ec, ei) => {
    const maxSets = Math.max(1, ...perEx[ei].map(e => e.weights.length))
    return { name: ec.name, sets: String(maxSets), reps: '', tempo: '', entries: perEx[ei] }
  })
  return { exercises, matched, unmatched }
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
  // Raport dopasowania imion (format siatki: imiona × ćwiczenia)
  const [matchReport, setMatchReport] = useState<{ matched: number; unmatched: string[] } | null>(null)

  async function handleFile(file?: File | null) {
    if (!file) return
    setError(''); setParsing(true); setFileName(file.name); setMatchReport(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }) as any[][]
      // Najpierw spróbuj siatki (imiona × ćwiczenia z ciężarami), potem listy ćwiczeń
      const matrix = detectMatrix(rows, athletes)
      if (matrix) {
        setRowsData(matrix.exercises)
        setMatchReport({ matched: matrix.matched.length, unmatched: matrix.unmatched })
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
      .insert({ group_id: group.id, training_date: date })
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

    // Ciężary zawodniczek (gdy plik był siatką imiona × ćwiczenia)
    const idByOrder = new Map<number, number>(insertedEx.map((x: any) => [x.exercise_order, x.id]))
    const entryRows: any[] = []
    valid.forEach((r, i) => {
      const exId = idByOrder.get(i + 1)
      if (!exId || !r.entries) return
      for (const e of r.entries) {
        if (!e.weights.length) continue
        entryRows.push({
          training_id: tr.id,
          exercise_id: exId,
          athlete_id: e.athleteId,
          sets: e.weights.map(w => ({ weight: w })),
        })
      }
    })
    if (entryRows.length) {
      const { error: e3 } = await supabase.from('group_training_entries').insert(entryRows)
      if (e3) { setCreating(false); setError(`Trening utworzony, ale ciężary się nie zapisały: ${e3.message}`); return }
    }
    router.push(`/coach/groups/${group.id}/training/${tr.id}`)
  }

  const cellInput: React.CSSProperties = {
    width: '100%', padding: '0.5rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8,
    background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.84rem', outline: 'none',
  }
  const monoInput: React.CSSProperties = { ...cellInput, fontFamily: mono, fontSize: '0.78rem', textAlign: 'center' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: C.white, borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.grayLight}` }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{group.name}</div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: C.white }}>Wgraj trening z archiwum</div>
          <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 4 }}>Plik Excel (.xlsx/.csv). Rozpozna siatkę (imiona w wierszach × ćwiczenia w nagłówku, ciężary w komórkach) albo listę ćwiczeń.</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '1.1rem 1.25rem' }}>
          {/* Data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Data treningu</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...monoInput, width: 'auto', textAlign: 'left' }} />
          </div>

          {/* Plik */}
          <label style={{ display: 'block', cursor: 'pointer', marginBottom: '1.1rem' }}>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
            <div style={{ padding: '0.9rem', borderRadius: 12, border: `1.5px dashed ${C.gray}`, background: C.offWhite, textAlign: 'center', color: C.navy, fontWeight: 700, fontSize: '0.86rem' }}>
              {parsing ? 'Analizuję plik...' : fileName ? `📄 ${fileName} — kliknij, by wgrać inny` : '⬆ Wgraj plik Excel / CSV'}
            </div>
          </label>

          {error && <div style={{ color: C.red, fontSize: '0.82rem', marginBottom: '0.9rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, padding: '0.6rem 0.75rem' }}>❌ {error}</div>}

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

          {/* Edytowalna lista ćwiczeń */}
          {rowsData.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 70px 80px 28px', gap: 6, marginBottom: 5 }}>
                {['Ćwiczenie', 'Serie', 'Powt.', 'Tempo', ''].map((h, i) => (
                  <span key={i} style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 0 ? 'left' : 'center' }}>{h}</span>
                ))}
              </div>
              {rowsData.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 70px 80px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <input value={r.name} onChange={e => updateRow(i, 'name', e.target.value)} placeholder="nazwa ćwiczenia" style={cellInput} />
                  <input value={r.sets} onChange={e => updateRow(i, 'sets', e.target.value.replace(/[^\d]/g, ''))} placeholder="3" style={monoInput} inputMode="numeric" />
                  <input value={r.reps} onChange={e => updateRow(i, 'reps', e.target.value)} placeholder="8" style={monoInput} />
                  <input value={r.tempo} onChange={e => updateRow(i, 'tempo', e.target.value)} placeholder="3010" style={monoInput} />
                  <button onClick={() => removeRow(i)} title="Usuń" style={{ border: 'none', background: 'none', color: C.gray, fontSize: '0.9rem', padding: 2 }}>✕</button>
                </div>
              ))}
            </>
          )}
          <button onClick={addRow} style={{ width: '100%', padding: '0.6rem', borderRadius: 10, border: `1.5px dashed ${C.gray}`, background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.82rem', marginTop: 4 }}>
            ＋ Dodaj ćwiczenie ręcznie
          </button>
        </div>

        <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '0.8rem 1.1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
          <button onClick={handleCreate} disabled={creating || rowsData.filter(r => r.name.trim()).length === 0}
            style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: 12, background: rowsData.some(r => r.name.trim()) ? C.navy : C.grayLight, color: rowsData.some(r => r.name.trim()) ? C.gold : C.gray, fontWeight: 900, fontSize: '0.92rem' }}>
            {creating ? 'Tworzę trening...' : `Utwórz trening (${rowsData.filter(r => r.name.trim()).length} ćw.)`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ManagedGroupClient({ group, athletes, trainings }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [addOpen, setAddOpen] = useState(false)
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
      .insert({ group_id: group.id, training_date: today })
      .select()
      .single()
    if (err || !data) {
      setError(err?.message || 'Nie udało się utworzyć treningu')
      setStarting(false)
      return
    }
    // Gotowość i feedback wpisane dziś podpinają się pod ten trening
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
      desc: 'Tabela: zawodniczki × ćwiczenia — serie, powtórzenia, tempo, ciężar, ból',
      icon: '🏋️',
      onClick: handleStartTraining,
      primary: true,
    },
    {
      label: 'Wgraj trening z archiwum',
      desc: 'Wgraj plik Excel/CSV — system rozpisze ćwiczenia do edytowalnej tabeli i utworzy trening z wybraną datą',
      icon: '📥',
      onClick: () => setImportOpen(true),
    },
    {
      label: 'Podsumowanie',
      desc: 'Tabela treningu — ciężary i ból, wybór po dacie',
      icon: '📊',
      onClick: () => router.push(`/coach/groups/${group.id}/summary`),
    },
    {
      label: 'Uzupełnij gotowość treningową',
      desc: 'Zawodniczki podchodzą do tabletu i wypełniają arkusz przed treningiem',
      icon: '✅',
      onClick: () => router.push(`/coach/groups/${group.id}/readiness`),
    },
    {
      label: 'Feedback po treningu',
      desc: 'Zawodniczki wypełniają RPE i samopoczucie po treningu',
      icon: '💬',
      onClick: () => router.push(`/coach/groups/${group.id}/feedback`),
    },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button onClick={() => router.push('/coach/groups')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← Grupy
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '1rem', flexWrap: 'wrap' }}>
              <h1 style={{ color: C.white, fontSize: '1.45rem', fontWeight: 800 }}>{group.name}</h1>
              <span style={{ fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, color: C.navy, background: C.gold, borderRadius: 6, padding: '2px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                zorganizowana
              </span>
            </div>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>
              {athletes.length} zawodniczek · grupa prowadzona przez trenera
            </p>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.86rem', marginBottom: '1rem' }}>
              ❌ {error}
            </div>
          )}

          {/* ── AKCJE ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
            {actionTiles.map(tile => (
              <Card key={tile.label} style={tile.primary ? { border: `2px solid ${C.gold}` } : undefined}>
                <button
                  onClick={tile.onClick}
                  disabled={tile.primary && starting}
                  style={{ width: '100%', background: tile.primary ? C.navy : 'none', border: 'none', padding: '1rem', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}
                >
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{tile.icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: tile.primary ? C.gold : C.navy }}>
                      {tile.primary && starting ? 'Otwieram...' : tile.label}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 3, lineHeight: 1.4 }}>{tile.desc}</div>
                  </div>
                  <span style={{ color: C.gray }}>›</span>
                </button>
              </Card>
            ))}
          </div>

          {/* ── ZAWODNICZKI ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
              Zawodniczki ({athletes.length})
            </div>
            <button onClick={() => setAddOpen(true)} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.5rem 0.9rem', fontWeight: 800, fontSize: '0.8rem' }}>
              ＋ Dodaj
            </button>
          </div>
          <Card style={{ marginBottom: '1.5rem' }}>
            {athletes.length === 0 ? (
              <div style={{ padding: '1.25rem', color: C.gray, fontSize: '0.88rem', textAlign: 'center' }}>
                Brak zawodniczek — dodaj pierwszą przyciskiem „＋ Dodaj”.
              </div>
            ) : (
              athletes.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => router.push(`/coach/athletes/${a.id}`)}
                  style={{ width: '100%', background: 'none', border: 'none', borderTop: i > 0 ? `1.5px solid ${C.grayLight}` : 'none', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.navy }}>{a.full_name}</span>
                    {a.birth_year && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginLeft: 8 }}>{a.birth_year}</span>}
                  </div>
                  <span style={{ color: C.gray }}>›</span>
                </button>
              ))
            )}
          </Card>

          {/* ── HISTORIA TRENINGÓW ── */}
          <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
            Treningi ({trainings.length})
          </div>
          <Card>
            {trainings.length === 0 ? (
              <div style={{ padding: '1.25rem', color: C.gray, fontSize: '0.88rem', textAlign: 'center' }}>
                Jeszcze nie było żadnego treningu. Kliknij „Rozpocznij trening”.
              </div>
            ) : (
              trainings.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', borderTop: i > 0 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                  <button
                    onClick={() => router.push(`/coach/groups/${group.id}/training/${t.id}`)}
                    style={{ flex: 1, background: 'none', border: 'none', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                  >
                    <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 700, color: C.navy }}>{t.training_date}</span>
                    <span style={{ fontSize: '0.78rem', color: C.gray }}>{formatDatePl(t.training_date)}</span>
                    {t.training_date === today && (
                      <span style={{ fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 6, padding: '2px 7px' }}>
                        dziś
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteTraining(t)}
                    disabled={deletingId === t.id}
                    title="Usuń trening"
                    style={{ border: 'none', background: 'none', color: C.gray, padding: '0.8rem', fontSize: '0.85rem' }}
                  >
                    {deletingId === t.id ? '...' : '✕'}
                  </button>
                </div>
              ))
            )}
          </Card>
        </main>
      </div>

      {addOpen && (
        <AddAthleteModal
          group={group}
          onClose={() => setAddOpen(false)}
          onAdded={() => router.refresh()}
        />
      )}

      {importOpen && (
        <ImportTrainingModal
          group={group}
          athletes={athletes}
          onClose={() => setImportOpen(false)}
        />
      )}
    </>
  )
}
