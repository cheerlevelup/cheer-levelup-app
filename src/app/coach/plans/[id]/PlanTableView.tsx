'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { sortWithVariants, variantLabels } from '@/lib/exerciseVariants'

type WarmupSet = { reps?: string; weight_kg?: string; note?: string }
type WorkSet = { reps?: string; weight_kg?: string; tempo?: string; rir?: string; seconds?: string; intensity?: string; rest?: string; ecc?: string; hold?: string }
type ExerciseLibraryItem = { id: number; name: string; category?: string | null }
type BlockExercise = {
  id?: number; block_id: number; exercise_id?: number | null; exercise_code?: string | null
  exercise_order: number; sets: number; reps?: string | null; tempo?: string | null
  weight_kg?: number | null; rir?: number | null; is_warmup: boolean
  warmup_sets?: WarmupSet[] | null; coach_comment?: string | null
  exercise_url?: string | null; exercise?: ExerciseLibraryItem | null
  work_sets?: WorkSet[] | null; iso?: boolean | null; iso_type?: 'PIMA' | 'HIMA' | null
  // ćwiczenie ekscentryczne: w seriach czas fazy ekscentrycznej (ecc) i hold w rozciągnięciu (hold)
  ecc?: boolean | null
  // wariant ćwiczenia (1b, 1c...) — wskazuje na ćwiczenie bazowe (1a) i zawodniczki, które go robią
  variant_of?: number | null; variant_athlete_ids?: number[] | null
}

// Wartość, która może się różnić między seriami: jedna wspólna, albo (jeśli
// serie się różnią) wartości kolejnych serii po kolei — "90'' / 120''" znaczy
// seria 1 = 90'', seria 2 = 120'' (zakres "90–120" nie mówił, która jest która).
function fmtRange(values: (string | undefined)[], suffix = ''): string {
  const all = values.map(v => v?.trim() || '')
  if (all.every(v => !v)) return '—'
  const unique = Array.from(new Set(all))
  if (unique.length === 1) return `${unique[0]}${suffix}`
  return all.map(v => v ? `${v}${suffix}` : '—').join(' / ')
}

// Wartość do edytowalnej komórki — brak wartości to puste pole, nie „—"
const orBlank = (v: string) => (v === '—' ? '' : v)

// ISO w kolumnie Powt.: jedna linia, gdy serie są równe ("1× 90''"), inaczej
// linia na serię: "S1 90''", "S2 120''" (powtórzenia tylko, gdy któraś seria ma ich więcej niż 1)
function isoPowtLines(ex: BlockExercise): string[] {
  const sets = ex.work_sets || []
  const reps = sets.map(s => s.reps?.trim() || '')
  const secs = sets.map(s => s.seconds?.trim() || '')
  const one = (r: string, t: string) => `${r ? `${r}× ` : ''}${t ? `${t}''` : '—'}`
  if (new Set(reps).size <= 1 && new Set(secs).size <= 1) return [one(reps[0] || '', secs[0] || '')]
  const showReps = reps.some(r => r && r !== '1')
  return sets.map((_, i) => `S${i + 1} ${one(showReps ? reps[i] : '', secs[i])}`)
}

// Powtórzenia zwykłego ćwiczenia: linia na serię ("S1 8", "S2 6"), gdy serie się różnią
function repsLines(ex: BlockExercise): string[] | null {
  const reps = (ex.work_sets || []).map(s => s.reps?.trim() || '')
  if (new Set(reps).size <= 1) return null
  return reps.map((r, i) => `S${i + 1} ${r || '—'}`)
}

// Ekscentryczne w kolumnie Tempo: "ECC 5'' · hold 3''" — jedna linia, gdy serie równe,
// inaczej linia na serię ("S1 ECC 5''", "S2 ECC 6'' · hold 2''")
function eccTempoLines(ex: BlockExercise): string[] {
  const sets = ex.work_sets || []
  const one = (s?: WorkSet) => [s?.ecc ? `ECC ${s.ecc}''` : '', s?.hold ? `hold ${s.hold}''` : ''].filter(Boolean).join(' · ') || '—'
  const all = sets.map(one)
  if (new Set(all).size <= 1) return [all[0] || (ex.tempo || '—')]
  return all.map((l, i) => `S${i + 1} ${l}`)
}

// Wartości serii jedna pod drugą (kolumna Powt.)
function SeriesLines({ lines }: { lines: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.35, whiteSpace: 'nowrap', width: 'max-content', margin: '0 auto' }}>
      {lines.map((l, i) => <span key={i}>{l}</span>)}
    </div>
  )
}
type Block = {
  id: number; day_id: number; block_name: string; block_order: number; rounds: number
  workout_block_exercises?: BlockExercise[]
}
type Day = { id: number; week_id: number; day_name: string; day_order: number; coach_intro?: string | null; coach_closing?: string | null }
type Week = { id: number; plan_id: number; week_number: number; name?: string | null }
type Plan = { id: number; name: string }


function fmtName(s: string) { return s.replace(/-/g, ' ') }
function blockLabel(i: number) { return String.fromCharCode(65 + i) }

// ─── Inline editable cell ─────────────────────────────────────────────────────
function EditCell({ value, onCommit, align = 'center', placeholder, renderDisplay }: {
  value: string; onCommit: (v: string) => void; align?: 'left' | 'center'
  placeholder?: string; renderDisplay?: (val: string) => React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function start() { setDraft(value); setEditing(true) }
  function commit() { setEditing(false); if (draft !== value) onCommit(draft) }

  if (editing) return (
    <input autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ width: '100%', border: 'none', background: '#fffbeb', outline: '2px solid var(--gold)', borderRadius: 3,
        fontFamily: 'var(--font-inter),sans-serif', fontSize: '12px', color: 'var(--ink)', textAlign: align, padding: '2px 4px' }}
    />
  )
  return (
    <div onClick={start} title="Kliknij aby edytować"
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      style={{ cursor: 'text', minHeight: 22, display: 'flex', alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        fontFamily: 'var(--font-inter),sans-serif', fontSize: '12px', color: value ? 'var(--ink)' : 'var(--muted-light)',
        padding: '2px 4px', borderRadius: 3, transition: 'background 0.1s' }}>
      {renderDisplay ? renderDisplay(value) : (value || <span style={{ fontStyle: 'italic', fontSize: '11px' }}>{placeholder ?? '—'}</span>)}
    </div>
  )
}

// ─── Export XLSX ──────────────────────────────────────────────────────────────
async function exportXlsx(plan: Plan, days: Day[], blocks: Block[], wCols: number) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cheer LevelUP'
  wb.created = new Date()

  const NAVY  = '0D1B2A'
  const GOLD  = 'F5C842'
  const GREEN_HDR = '166534'
  const GREEN_LIGHT = 'DCFCE7'
  const GREEN_ALT   = 'BBF7D0'
  const BLUE_HDR  = '1E3A5F'
  const BLUE_LIGHT = 'DBEAFE'
  const BLUE_ALT   = 'BFDBFE'
  const WHITE = 'FFFFFF'
  const GRAY_ALT = 'F4F6F9'
  const GRAY_SEP = 'E2E8F0'
  const TEXT  = '0D1B2A'

  function border(style: 'thin'|'medium'|'hair' = 'thin', color = 'D1D5DB'): any {
    const s = { style, color: { argb: `FF${color}` } }
    return { top: s, bottom: s, left: s, right: s }
  }

  function applyHdr(cell: any, bg: string, fg: string, text: string, sz = 9, bold = true, align: string = 'center') {
    cell.value = text
    cell.font = { name: 'Calibri', size: sz, bold, color: { argb: `FF${fg}` } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } }
    cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true }
    cell.border = border('thin', bg === NAVY ? '1A3050' : 'CCCCCC')
  }

  function applyData(cell: any, value: string | number, bg: string, opts?: {
    bold?: boolean; align?: string; link?: string; color?: string
  }) {
    cell.value = value
    cell.font = { name: 'Calibri', size: 9, bold: opts?.bold, color: { argb: `FF${opts?.color ?? TEXT}` } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } }
    cell.alignment = { horizontal: opts?.align ?? 'left', vertical: 'middle', wrapText: true }
    cell.border = border('hair', 'E2E8F0')
    if (opts?.link) {
      cell.value = { text: value as string, hyperlink: opts.link }
      cell.font = { name: 'Calibri', size: 9, bold: opts.bold, color: { argb: 'FF1D4ED8' }, underline: true }
    }
  }

  days.forEach(day => {
    const sheet = wb.addWorksheet(day.day_name.slice(0, 31), {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })

    const dayBlocks = blocks.filter(b => b.day_id === day.id).sort((a, b) => a.block_order - b.block_order)

    // col layout: Blok(1) + #(2) + Nazwa+Link(3) + Kom(4) + R*3 + serie*6
    const C_BLOK = 1, C_NR = 2, C_NAZWA = 3, C_KOM = 4
    const C_WARMUP_START = 5
    const C_SERIE_START = C_WARMUP_START + wCols * 3
    const TOTAL_COLS = C_SERIE_START + 5  // Serie Powt Ciezar Tempo RIR Kom = 6 cols

    // ── Column widths ──────────────────────────────────────────────────────
    sheet.getColumn(C_BLOK).width  = 6
    sheet.getColumn(C_NR).width    = 4
    sheet.getColumn(C_NAZWA).width = 26
    sheet.getColumn(C_KOM).width   = 34
    for (let r = 0; r < wCols; r++) {
      sheet.getColumn(C_WARMUP_START + r * 3).width     = 9    // powt
      sheet.getColumn(C_WARMUP_START + r * 3 + 1).width = 11   // ciezar
      sheet.getColumn(C_WARMUP_START + r * 3 + 2).width = 22   // kom
    }
    sheet.getColumn(C_SERIE_START).width     = 7   // Serie
    sheet.getColumn(C_SERIE_START + 1).width = 9   // Powt
    sheet.getColumn(C_SERIE_START + 2).width = 10  // Ciezar
    sheet.getColumn(C_SERIE_START + 3).width = 10  // Tempo
    sheet.getColumn(C_SERIE_START + 4).width = 7   // RIR
    sheet.getColumn(C_SERIE_START + 5).width = 20  // Kom

    // ── Row 1: Title ───────────────────────────────────────────────────────
    sheet.getRow(1).height = 22
    const titleCell = sheet.getCell(1, C_BLOK)
    titleCell.value = `${plan.name}  —  ${day.day_name}`
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: `FF${GOLD}` } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    sheet.mergeCells(1, C_BLOK, 1, TOTAL_COLS)
    // gold left accent — simulate with thick left border on title
    titleCell.border = { left: { style: 'medium', color: { argb: `FF${GOLD}` } } }

    // ── Row 2: Section labels ──────────────────────────────────────────────
    sheet.getRow(2).height = 16
    for (let c = C_BLOK; c <= C_KOM; c++) applyHdr(sheet.getCell(2, c), NAVY, GOLD, '', 9)
    if (wCols > 0) {
      applyHdr(sheet.getCell(2, C_WARMUP_START), GREEN_HDR, 'FFFFFF', 'SERIE ROZGRZEWKOWE', 9, true, 'center')
      sheet.mergeCells(2, C_WARMUP_START, 2, C_SERIE_START - 1)
      for (let c = C_WARMUP_START + 1; c < C_SERIE_START; c++) sheet.getCell(2, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN_HDR}` } }
    }
    applyHdr(sheet.getCell(2, C_SERIE_START), BLUE_HDR, 'FFFFFF', 'SERIE WŁAŚCIWE', 9, true, 'center')
    sheet.mergeCells(2, C_SERIE_START, 2, TOTAL_COLS)

    // ── Row 3: R1/R2 + serie col names ────────────────────────────────────
    sheet.getRow(3).height = 15
    applyHdr(sheet.getCell(3, C_BLOK), NAVY, GOLD, 'Blok')
    applyHdr(sheet.getCell(3, C_NR), NAVY, GOLD, '#')
    applyHdr(sheet.getCell(3, C_NAZWA), NAVY, GOLD, 'Nazwa', 9, true, 'left')
    applyHdr(sheet.getCell(3, C_KOM), NAVY, GOLD, 'Komentarz', 9, true, 'left')
    sheet.mergeCells(2, C_BLOK, 3, C_BLOK)
    sheet.mergeCells(2, C_NR, 3, C_NR)
    sheet.mergeCells(2, C_NAZWA, 3, C_NAZWA)
    sheet.mergeCells(2, C_KOM, 3, C_KOM)
    for (let r = 0; r < wCols; r++) {
      const col = C_WARMUP_START + r * 3
      applyHdr(sheet.getCell(3, col), GREEN_HDR, 'FFFFFF', `R${r + 1}`, 9, true, 'center')
      sheet.mergeCells(3, col, 3, col + 2)
    }
    const serieLabels = ['Serie', 'Powt.', 'Ciężar', 'Tempo', 'RIR', 'Kom.']
    serieLabels.forEach((lbl, i) => applyHdr(sheet.getCell(3, C_SERIE_START + i), BLUE_HDR, 'FFFFFF', lbl))

    // ── Row 4: Sub-col labels ──────────────────────────────────────────────
    sheet.getRow(4).height = 13
    for (let c = C_BLOK; c <= C_KOM; c++) {
      const cell = sheet.getCell(4, c)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } }
      cell.border = border('thin', '1A3050')
    }
    for (let r = 0; r < wCols; r++) {
      const col = C_WARMUP_START + r * 3
      applyHdr(sheet.getCell(4, col),     '1A4D2E', 'A7F3D0', 'powt.',  8, false)
      applyHdr(sheet.getCell(4, col + 1), '1A4D2E', 'A7F3D0', 'ciężar', 8, false)
      applyHdr(sheet.getCell(4, col + 2), '1A4D2E', 'A7F3D0', 'kom.',   8, false, 'left')
    }
    for (let i = 0; i < 6; i++) {
      const cell = sheet.getCell(4, C_SERIE_START + i)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BLUE_HDR}` } }
      cell.border = border('thin', '162E4A')
    }

    // ── Data ──────────────────────────────────────────────────────────────
    let rowIdx = 5
    dayBlocks.forEach((block, bi) => {
      const exs = sortWithVariants(block.workout_block_exercises || [])
      const labels = variantLabels(exs)
      if (exs.length === 0) return

      const blockStartRow = rowIdx

      exs.forEach((ex, i) => {
        const isAlt = i % 2 === 1
        const bg    = isAlt ? GRAY_ALT : WHITE
        const wBg   = isAlt ? GREEN_ALT : GREEN_LIGHT
        const sBg   = isAlt ? BLUE_ALT : BLUE_LIGHT
        const row   = sheet.getRow(rowIdx)
        row.height  = 18

        // Blok label
        const blokCell = sheet.getCell(rowIdx, C_BLOK)
        blokCell.value = i === 0 ? blockLabel(bi) : ''
        blokCell.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${GOLD}` } }
        blokCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } }
        blokCell.alignment = { horizontal: 'center', vertical: 'middle' }
        blokCell.border = { right: { style: 'medium', color: { argb: `FF${GOLD}` } } }

        applyData(sheet.getCell(rowIdx, C_NR), labels.get(ex) ?? String(i + 1), bg, { align: 'center', color: '64748B' })
        applyData(sheet.getCell(rowIdx, C_NAZWA),
          fmtName(ex.exercise?.name || ex.exercise_code || ''), bg,
          { bold: true, align: 'left', link: ex.exercise_url || undefined })
        applyData(sheet.getCell(rowIdx, C_KOM), ex.coach_comment || '', bg, { align: 'left' })

        for (let r = 0; r < wCols; r++) {
          const ws = ex.warmup_sets?.[r]
          const col = C_WARMUP_START + r * 3
          applyData(sheet.getCell(rowIdx, col),     ws?.reps      || '', wBg, { align: 'center' })
          applyData(sheet.getCell(rowIdx, col + 1), ws?.weight_kg || '', wBg, { align: 'center' })
          applyData(sheet.getCell(rowIdx, col + 2), ws?.note      || '', wBg, { align: 'left' })
        }

        applyData(sheet.getCell(rowIdx, C_SERIE_START),     ex.sets ?? '',                  sBg, { bold: true, align: 'center' })
        applyData(sheet.getCell(rowIdx, C_SERIE_START + 1), ex.reps || '',                  sBg, { align: 'center' })
        applyData(sheet.getCell(rowIdx, C_SERIE_START + 2), ex.weight_kg != null ? String(ex.weight_kg) : '', sBg, { align: 'center' })
        applyData(sheet.getCell(rowIdx, C_SERIE_START + 3), ex.tempo || '',                 sBg, { align: 'center' })
        applyData(sheet.getCell(rowIdx, C_SERIE_START + 4), ex.rir != null ? String(ex.rir) : '', sBg, { align: 'center' })
        applyData(sheet.getCell(rowIdx, C_SERIE_START + 5), '',                             sBg, { align: 'left' })

        rowIdx++
      })

      // merge Blok cell vertically
      if (exs.length > 1) sheet.mergeCells(blockStartRow, C_BLOK, blockStartRow + exs.length - 1, C_BLOK)

      // separator between blocks
      const sepRow = sheet.getRow(rowIdx)
      sepRow.height = 6
      for (let c = C_BLOK; c <= TOTAL_COLS; c++) {
        const cell = sheet.getCell(rowIdx, c)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GRAY_SEP}` } }
        cell.border = {}
      }
      rowIdx++
    })

    // ── Tab colour ─────────────────────────────────────────────────────────
    sheet.properties = { ...sheet.properties, tabColor: { argb: `FF${GOLD}` } }
  })

  // Download
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${plan.name}.xlsx`; a.click()
  URL.revokeObjectURL(url)
}

// Polish diacritics → ASCII for PDF (jsPDF default fonts don't support Unicode)
function pl(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/ą/g, 'a').replace(/Ą/g, 'A')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/ę/g, 'e').replace(/Ę/g, 'E')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ń/g, 'n').replace(/Ń/g, 'N')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ś/g, 's').replace(/Ś/g, 'S')
    .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
    .replace(/ż/g, 'z').replace(/Ż/g, 'Z')
}

async function exportPdf(plan: Plan, days: Day[], blocks: Block[], wCols: number) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const format = wCols > 1 ? 'a3' : 'a4'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mL = 5, mR = 5   // tiny side margins — full-width table
  const headerH = 10
  const available = pageW - mL - mR

  // Column widths (mm) — distribute to fill full page width
  const wBlok = 11, wNr = 5, wNazwa = 38
  const wRPowt = 14, wRCiezar = 14, wRKom = 20
  const wSerie = 11, wPowt = 13, wCiezar = 14, wTempo = 14, wRir = 9, wKomW = 22
  const warmupTotal = wCols * (wRPowt + wRCiezar + wRKom)
  const serieTotal  = wSerie + wPowt + wCiezar + wTempo + wRir + wKomW
  const wKom = Math.max(22, available - wBlok - wNr - wNazwa - warmupTotal - serieTotal)

  // col indices: 0=Blok 1=# 2=Nazwa 3=Kom 4..4+wCols*3-1=warmup 4+wCols*3..=serie
  const firstWarmupCol = 4
  const firstSerieCol  = 4 + wCols * 3   // ← FIX: was 3 + wCols * 3
  const totalCols = firstSerieCol + 6

  const colStyles: Record<number, any> = {
    0: { cellWidth: wBlok,  halign: 'center' },
    1: { cellWidth: wNr,    halign: 'center' },
    2: { cellWidth: wNazwa, halign: 'left'   },
    3: { cellWidth: wKom,   halign: 'left'   },
  }
  let ci = 4
  for (let r = 0; r < wCols; r++) {
    colStyles[ci++] = { cellWidth: wRPowt,  halign: 'center' }
    colStyles[ci++] = { cellWidth: wRCiezar, halign: 'center' }
    colStyles[ci++] = { cellWidth: wRKom,   halign: 'left'   }
  }
  colStyles[ci++] = { cellWidth: wSerie,  halign: 'center' }
  colStyles[ci++] = { cellWidth: wPowt,   halign: 'center' }
  colStyles[ci++] = { cellWidth: wCiezar, halign: 'center' }
  colStyles[ci++] = { cellWidth: wTempo,  halign: 'center' }
  colStyles[ci++] = { cellWidth: wRir,    halign: 'center' }
  colStyles[ci++] = { cellWidth: wKomW,   halign: 'left'   }

  // Two-row header: row 1 = section labels (merged), row 2 = column labels
  // jspdf-autotable supports multi-row head via array of arrays
  // Row 1: section labels
  const headRow1: any[] = [
    { content: 'Blok',      rowSpan: 3, styles: { valign: 'middle', halign: 'center', fontSize: 6.5, fontStyle: 'bold' } },
    { content: '#',         rowSpan: 3, styles: { valign: 'middle', halign: 'center' } },
    { content: 'Nazwa',     rowSpan: 3, styles: { valign: 'middle', halign: 'left'   } },
    { content: 'Komentarz', rowSpan: 3, styles: { valign: 'middle', halign: 'left'   } },
  ]
  if (wCols > 0) {
    headRow1.push({
      content: 'SERIE ROZGRZEWKOWE',
      colSpan: wCols * 3,
      styles: { halign: 'center', fillColor: [19, 45, 30], textColor: [134, 239, 172] },
    })
  }
  headRow1.push({
    content: 'SERIE WLASCIWE',
    colSpan: 6,
    styles: { halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] },
  })

  // Row 2: R1 / R2 / ... labels + serie właściwe col names
  const headRow2: any[] = []
  for (let r = 1; r <= wCols; r++) {
    headRow2.push({
      content: `R${r}`, colSpan: 3,
      styles: { halign: 'center', fillColor: [19, 45, 30], textColor: [134, 239, 172], fontStyle: 'bold' },
    })
  }
  headRow2.push(
    { content: 'Ser.', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
    { content: 'Powt.', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
    { content: 'Ciezar', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
    { content: 'Tempo', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
    { content: 'RIR',  rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
    { content: 'Kom.',  rowSpan: 2, styles: { valign: 'middle', halign: 'left',   fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
  )

  // Row 3: powt / ciezar / kom per warmup set
  const headRow3: any[] = []
  for (let r = 0; r < wCols; r++) {
    headRow3.push(
      { content: 'powt',  styles: { halign: 'center', fillColor: [19, 45, 30], textColor: [134, 239, 172], fontSize: 6 } },
      { content: 'ciezar', styles: { halign: 'center', fillColor: [19, 45, 30], textColor: [134, 239, 172], fontSize: 6 } },
      { content: 'kom',   styles: { halign: 'left',   fillColor: [19, 45, 30], textColor: [134, 239, 172], fontSize: 6 } },
    )
  }

  // per-row metadata for links
  type RowMeta = { url?: string; isBlockStart?: boolean; isSep?: boolean }
  const rowMeta: RowMeta[] = []

  days.forEach((day, di) => {
    if (di > 0) doc.addPage()

    // ── Full-width header bar (edge to edge) ─────────────────────────────────
    doc.setFillColor(13, 27, 42)
    doc.rect(0, 0, pageW, headerH, 'F')
    // gold left accent
    doc.setFillColor(245, 200, 66)
    doc.rect(0, 0, 4, headerH, 'F')
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 200, 66)
    doc.text(pl(plan.name), 7, 6.5)
    const planNameW = doc.getTextWidth(pl(plan.name))
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 185, 215)
    doc.text(`  —  ${pl(day.day_name)}`, 7 + planNameW, 6.5)
    doc.setTextColor(13, 27, 42)

    const dayBlocks = blocks.filter(b => b.day_id === day.id).sort((a, b) => a.block_order - b.block_order)
    const body: any[][] = []
    rowMeta.length = 0

    dayBlocks.forEach((block, bi) => {
      const exs = sortWithVariants(block.workout_block_exercises || [])
      const labels = variantLabels(exs)
      if (exs.length === 0) return

      exs.forEach((ex, i) => {
        const wd = Array.from({ length: wCols }, (_, r) => {
          const ws = ex.warmup_sets?.[r]
          return [pl(ws?.reps), pl(ws?.weight_kg), pl(ws?.note)]
        }).flat()
        body.push([
          i === 0 ? blockLabel(bi) : '',  // 0: blok
          labels.get(ex) ?? String(i + 1), // 1: # (1, 2a, 2b...)
          pl(fmtName(ex.exercise?.name || ex.exercise_code || '')),  // 2: nazwa (clickable)
          pl(ex.coach_comment),            // 3: komentarz
          ...wd,                           // 4..: warmup
          ex.sets ?? '',                   // serie właściwe
          pl(ex.reps),
          ex.weight_kg ?? '',
          pl(ex.tempo),
          ex.rir ?? '',
          '',
        ])
        rowMeta.push({ url: ex.exercise_url || undefined, isBlockStart: i === 0 })
      })

      // Separator row between blocks — styled distinctly
      body.push(Array(totalCols).fill(''))
      rowMeta.push({ isSep: true })
    })

    autoTable(doc, {
      head: wCols > 0 ? [headRow1, headRow2, headRow3] : [[
        { content: 'Blok', styles: { valign: 'middle', halign: 'center', fontSize: 6.5, fontStyle: 'bold' } },
        { content: '#', styles: { halign: 'center' } },
        { content: 'Nazwa', styles: { halign: 'left' } },
        { content: 'Komentarz', styles: { halign: 'left' } },
        { content: 'Ser.', styles: { halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
        { content: 'Powt.', styles: { halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
        { content: 'Ciezar', styles: { halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
        { content: 'Tempo', styles: { halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
        { content: 'RIR', styles: { halign: 'center', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
        { content: 'Kom.', styles: { halign: 'left', fillColor: [30, 58, 95], textColor: [147, 197, 253] } },
      ]],
      body,
      startY: headerH,
      margin: { left: mL, right: mR, bottom: 6 },
      tableWidth: available,
      styles: {
        fontSize: 7,
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
        overflow: 'linebreak',
        lineColor: [220, 228, 238],
        lineWidth: 0.2,
        textColor: [20, 35, 55],
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [20, 40, 65],
        textColor: [245, 200, 66],
        fontStyle: 'bold',
        fontSize: 6,
        cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
        lineColor: [30, 55, 90],
        lineWidth: 0.3,
      },
      alternateRowStyles: { fillColor: [244, 247, 252] },
      columnStyles: colStyles,
      didParseCell: (data) => {
        if (data.section !== 'body') return
        const meta = rowMeta[data.row.index]

        if (meta?.isSep) {
          data.cell.styles.fillColor = [232, 238, 248]
          data.cell.styles.minCellHeight = 2.5
          data.cell.styles.fontSize = 1
          return
        }

        // Block label
        if (data.column.index === 0 && data.cell.raw) {
          data.cell.styles.fillColor = [13, 27, 42]
          data.cell.styles.textColor = [245, 200, 66]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 9
          data.cell.styles.valign = 'middle'
          data.cell.styles.halign = 'center'
        }

        // Linked exercise name
        if (data.column.index === 2 && meta?.url) {
          data.cell.styles.textColor = [30, 80, 200]
        }

        // Green — warmup cols (firstWarmupCol..firstSerieCol-1)
        if (data.column.index >= firstWarmupCol && data.column.index < firstSerieCol) {
          data.cell.styles.fillColor = data.row.index % 2 === 0 ? [237, 253, 243] : [224, 248, 233]
        }
        // Blue — serie właściwe (firstSerieCol+)
        if (data.column.index >= firstSerieCol) {
          data.cell.styles.fillColor = data.row.index % 2 === 0 ? [235, 245, 255] : [222, 236, 252]
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return
        const meta = rowMeta[data.row.index]

        // Clickable link
        if (data.column.index === 2 && meta?.url) {
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: meta.url })
        }

        // Block separator line
        if (meta?.isBlockStart) {
          doc.setDrawColor(100, 130, 170)
          doc.setLineWidth(0.5)
          doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y)
          doc.setLineWidth(0.2)
          doc.setDrawColor(220, 228, 238)
        }
      },
      didDrawPage: () => {
        // Footer: page number
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(170, 185, 205)
        doc.text(pl(plan.name), mL, pageH - 3)
        doc.text(`${di + 1}`, pageW - mR, pageH - 3, { align: 'right' })
      },
    })
  })
  doc.save(`${pl(plan.name)}.pdf`)
}

// ─── Main component ───────────────────────────────────────────────────────────
// Jedyny widok edytora planu (dawny widok „Bloki" usunięty) — wszystko edytuje
// się tutaj: komórki tabeli zapisują się od razu, pełna edycja ćwiczenia
// (biblioteka, ISO, osobne wartości serii) otwiera okno z formularzem.
export type ExercisePatch = Partial<Pick<BlockExercise, 'exercise_id' | 'exercise_code' | 'exercise' | 'sets' | 'reps' | 'tempo' | 'weight_kg' | 'rir' | 'coach_comment' | 'exercise_url' | 'warmup_sets' | 'is_warmup' | 'work_sets'>>

interface Props {
  plan: Plan
  weeks: Week[]
  days: Day[]
  blocks: Block[]
  onUpdateExercise: (blockId: number, exercise: BlockExercise, patch: ExercisePatch) => void
  onAddWeek: () => Promise<void>
  onAddDay: (weekId: number) => Promise<void>
  onRenameDay: (dayId: number, name: string) => void
  onDeleteDay: (dayId: number) => void
  onMoveDay: (day: Day) => void
  onSaveDayMessage: (dayId: number, field: 'coach_intro' | 'coach_closing', value: string) => void
  onAddBlock: (dayId: number) => Promise<void>
  onRenameBlock: (blockId: number, name: string) => void
  onCopyBlock: (block: Block) => void
  onMoveBlock: (block: Block) => void
  onDeleteBlock: (blockId: number) => void
  onAddExercise: (blockId: number) => void          // otwiera formularz ćwiczenia w oknie
  onAddVariant: (blockId: number, base: BlockExercise) => void
  onAssignVariants: (blockId: number, baseId: number) => void
  athletes: { id: number; full_name: string }[]
  onEditExercise: (blockId: number, exercise: BlockExercise) => void
  onMoveExercise: (blockId: number, exercise: BlockExercise) => void
  onDeleteExercise: (blockId: number, exerciseId?: number) => void
}

const iconBtn: CSSProperties = {
  border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px',
  padding: '2px 4px', borderRadius: 4, lineHeight: 1,
}

// Notatka trenera do treningu (przemowa przed / wiadomość po) — zapis po wyjściu z pola
function DayMessage({ label, icon, value, placeholder, onSave }: {
  label: string; icon: string; value: string; placeholder: string; onSave: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(!!value)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="coach-btn coach-btn-ghost coach-btn-small">
        {icon} {label}
      </button>
    )
  }
  return (
    <div style={{ flex: '1 1 320px', minWidth: 260 }}>
      <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{icon} {label}</div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onSave(draft) }}
        placeholder={placeholder}
        rows={2}
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontFamily: 'var(--font-inter),sans-serif', fontSize: 12, color: 'var(--ink)', resize: 'vertical', outline: 'none', background: '#fff' }}
      />
    </div>
  )
}

// Wartość przepisana na wszystkie serie (work_sets) — żeby tabela i formularz
// ćwiczenia pokazywały to samo po edycji komórki
function syncWorkSets(ex: BlockExercise, field: 'reps' | 'weight_kg' | 'tempo' | 'rir', value: string): WorkSet[] | undefined {
  if (!Array.isArray(ex.work_sets) || ex.work_sets.length === 0) return undefined
  return ex.work_sets.map(s => ({ ...s, [field]: value }))
}
function resizeWorkSets(ex: BlockExercise, n: number): WorkSet[] | undefined {
  if (!Array.isArray(ex.work_sets) || ex.work_sets.length === 0) return undefined
  const sets = ex.work_sets.slice(0, n)
  while (sets.length < n) sets.push({ ...(sets[sets.length - 1] || {}) })
  return sets
}

export default function PlanTableView(props: Props) {
  const { plan, weeks, days, blocks, onUpdateExercise, onAddWeek, onAddDay, onAddBlock, onAddExercise } = props
  // Kolumny rozgrzewki: tyle, ile ma ćwiczenie z największą liczbą serii rozgrzewkowych
  const [warmupCols, setWarmupCols] = useState(() =>
    Math.min(6, Math.max(0, ...blocks.flatMap(b => (b.workout_block_exercises || []).map(ex =>
      ex.is_warmup ? (ex.warmup_sets || []).filter(s => s.reps || s.weight_kg || s.note).length : 0)))))
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)

  const allDays = [...days].sort((a, b) => a.day_order - b.day_order)

  function updateWarmupSet(blockId: number, ex: BlockExercise, rIdx: number, field: 'reps' | 'weight_kg' | 'note', value: string) {
    const sets = [...(ex.warmup_sets || [])]
    while (sets.length <= rIdx) sets.push({ reps: '', weight_kg: '', note: '' })
    sets[rIdx] = { ...sets[rIdx], [field]: value }
    // serie rozgrzewkowe liczą się tylko z włączonym is_warmup (tak zapisuje formularz)
    const hasAny = sets.some(s => s.reps?.trim() || s.weight_kg?.trim() || s.note?.trim())
    onUpdateExercise(blockId, ex, { warmup_sets: sets, is_warmup: hasAny })
  }

  async function doExport(type: 'xlsx' | 'pdf') {
    setExporting(type)
    try {
      if (type === 'xlsx') await exportXlsx(plan, allDays, blocks, warmupCols)
      else await exportPdf(plan, allDays, blocks, warmupCols)
    } catch (e) { console.error(e) }
    setExporting(null)
  }

  const th = (extra?: CSSProperties): CSSProperties => ({
    padding: '5px 8px', whiteSpace: 'nowrap', textAlign: 'center', ...extra,
  })
  const td = (extra?: CSSProperties): CSSProperties => ({
    padding: '3px 5px', fontFamily: 'var(--font-inter),sans-serif', fontSize: '12px',
    verticalAlign: 'middle', textAlign: 'center', ...extra,
  })
  const warmHeadStyle: CSSProperties = { background: 'var(--navy-600)', color: 'var(--gold-light)' }
  const serieHeadStyle: CSSProperties = { background: 'var(--navy-800)', color: '#fff' }

  // Blok + # + Nazwa + 🔗 + Komentarz = 5; potem rozgrzewka (3 na serię), 5 kolumn serii, akcje
  const fixedCols = 5
  const totalCols = fixedCols + warmupCols * 3 + 5 + 1

  return (
    <div>
      {/* toolbar */}
      <div className="coach-tabelka-toolbar">
        <div className="coach-warmup-counter">
          <span>Rozgrzewka (R):</span>
          <button onClick={() => setWarmupCols(v => Math.max(0, v - 1))}>−</button>
          <b>{warmupCols}</b>
          <button onClick={() => setWarmupCols(v => Math.min(6, v + 1))}>+</button>
        </div>
        <button className="coach-btn coach-btn-dark coach-btn-small" onClick={onAddWeek}>+ Tydzień</button>
        <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: 11, color: 'var(--muted)' }}>
          Kliknij komórkę, by edytować (zapisuje się od razu) · ✏️ pełna edycja ćwiczenia (biblioteka, ISO, różne serie)
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="coach-btn coach-btn-excel" onClick={() => doExport('xlsx')} disabled={exporting !== null}>
            {exporting === 'xlsx' ? '...' : '⬇ Excel'}
          </button>
          <button className="coach-btn" style={{ background: '#b91c1c', color: '#fff' }} onClick={() => doExport('pdf')} disabled={exporting !== null}>
            {exporting === 'pdf' ? '...' : '⬇ PDF'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {[...weeks].sort((a, b) => a.week_number - b.week_number).map(week => {
          const weekDays = allDays.filter(d => d.week_id === week.id)
          return (
            <div key={week.id}>
              {/* week header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
                <div className="coach-week-label">Tydzień {week.week_number}</div>
                <button className="coach-btn coach-btn-ghost coach-btn-small" onClick={() => onAddDay(week.id)}>+ Trening</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {weekDays.map(day => {
                  const dayBlocks = blocks.filter(b => b.day_id === day.id).sort((a, b) => a.block_order - b.block_order)

                  return (
                    <div key={day.id}>
                      {/* day header: nazwa (edytowalna), akcje treningu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <div className="coach-training-pill-name" style={{ minWidth: 160 }}>
                          <EditCell value={day.day_name} onCommit={v => props.onRenameDay(day.id, v)} align="left" placeholder="nazwa treningu" />
                        </div>
                        <button className="coach-btn coach-btn-ghost coach-btn-small" onClick={() => onAddBlock(day.id)}>+ Blok</button>
                        <button style={iconBtn} title="Przenieś trening do innego tygodnia" onClick={() => props.onMoveDay(day)}>↔ przenieś</button>
                        <button style={{ ...iconBtn, color: '#c23b3b' }} title="Usuń trening" onClick={() => props.onDeleteDay(day.id)}>✕ usuń</button>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <DayMessage
                          key={`intro-${day.id}`} icon="📣" label="Przemowa przed treningiem" value={day.coach_intro || ''}
                          placeholder="Motywacja, wskazówki… zawodniczki zobaczą to zanim zaczną ćwiczyć."
                          onSave={v => props.onSaveDayMessage(day.id, 'coach_intro', v)}
                        />
                        <DayMessage
                          key={`closing-${day.id}`} icon="💙" label="Wiadomość po treningu" value={day.coach_closing || ''}
                          placeholder="Gratulacje, recovery, co dalej… widoczne na końcu, po raporcie."
                          onSave={v => props.onSaveDayMessage(day.id, 'coach_closing', v)}
                        />
                      </div>

                      <div className="coach-plan-table-wrap">
                        <table className="coach-plan-table">
                          <thead>
                            <tr>
                              <th style={th({ width: 32 })}>Blok</th>
                              <th style={th({ width: 22 })}>#</th>
                              <th style={th({ minWidth: 150, textAlign: 'left' })}>Nazwa</th>
                              <th style={th({ width: 20, padding: '5px 2px' })}>🔗</th>
                              <th style={th({ minWidth: 130, textAlign: 'left' })}>Komentarz</th>
                              {Array.from({ length: warmupCols }, (_, i) => (
                                <th key={i} colSpan={3} className="coach-warm-group" style={th({ minWidth: 180, ...warmHeadStyle })}>R{i + 1}</th>
                              ))}
                              <th style={th({ width: 38, ...serieHeadStyle })}>Serie</th>
                              <th style={th({ width: 52, ...serieHeadStyle })}>Powt.</th>
                              <th style={th({ minWidth: 75, ...serieHeadStyle })}>Ciężar</th>
                              <th style={th({ width: 72, ...serieHeadStyle })}>Tempo</th>
                              <th style={th({ width: 38, ...serieHeadStyle })}>RIR</th>
                              <th style={th({ width: 130 })}></th>
                            </tr>
                            {warmupCols > 0 && (
                              <tr>
                                {[...Array(fixedCols)].map((_, i) => <td key={i} style={{ ...td(), padding: 0 }} />)}
                                {Array.from({ length: warmupCols }).flatMap((_, i) => [
                                  <td key={`sh${i}a`} className="coach-pt-warm" style={td({ fontSize: '10px', fontWeight: 700 })}>powt.</td>,
                                  <td key={`sh${i}b`} className="coach-pt-warm" style={td({ fontSize: '10px', fontWeight: 700 })}>ciężar</td>,
                                  <td key={`sh${i}c`} className="coach-pt-warm" style={td({ fontSize: '10px', fontWeight: 700, textAlign: 'left' })}>komentarz</td>,
                                ])}
                                {[...Array(6)].map((_, i) => <td key={`s${i}`} style={{ ...td(), background: '#eff6ff', padding: 0 }} />)}
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            {dayBlocks.map((block, bi) => {
                              const exs = sortWithVariants(block.workout_block_exercises || [])
                              const labels = variantLabels(exs)
                              // kto robi który wariant: baza = wszyscy nieprzypisani do innego wariantu
                              const assignedIn = (baseId?: number) => new Set(exs.filter(v => v.variant_of === baseId).flatMap(v => v.variant_athlete_ids || []))

                              // wiersz bloku: nazwa (edytowalna) + kopiuj / przenieś / usuń
                              const blockHeadRow = (
                                <tr key={`head-${block.id}`}>
                                  <td className="coach-pt-block" style={td()}>{blockLabel(bi)}</td>
                                  <td colSpan={totalCols - 1} style={td({ textAlign: 'left', background: 'var(--bg)', padding: '3px 8px' })}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ minWidth: 140, fontWeight: 700 }}>
                                        <EditCell value={block.block_name} onCommit={v => props.onRenameBlock(block.id, v)} align="left" placeholder="nazwa bloku" />
                                      </div>
                                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                                        <button style={iconBtn} title="Kopiuj blok do wszystkich pozostałych treningów" onClick={() => props.onCopyBlock(block)}>⧉ kopiuj do treningów</button>
                                        <button style={iconBtn} title="Przenieś blok do innego treningu" onClick={() => props.onMoveBlock(block)}>↔ przenieś</button>
                                        <button style={{ ...iconBtn, color: '#c23b3b' }} title="Usuń blok z ćwiczeniami" onClick={() => props.onDeleteBlock(block.id)}>✕ usuń</button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )

                              const addExRow = (
                                <tr key={`add-ex-${block.id}`}>
                                  {exs.length === 0 && <td className="coach-pt-block" style={td()}></td>}
                                  <td colSpan={totalCols - 1} style={td({ padding: '3px 8px', textAlign: 'left' })}>
                                    <button onClick={() => onAddExercise(block.id)}
                                      style={{ border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', borderRadius: 5, padding: '2px 10px', fontFamily: 'var(--font-inter),sans-serif', fontSize: '10px', cursor: 'pointer' }}>
                                      + ćwiczenie w bloku {blockLabel(bi)}
                                    </button>
                                  </td>
                                </tr>
                              )

                              if (exs.length === 0) return [blockHeadRow, addExRow]

                              return [
                                blockHeadRow,
                                ...exs.map((ex, i) => {
                                  const name = fmtName(ex.exercise?.name || ex.exercise_code || '')
                                  const isoReps = !!ex.iso
                                  return (
                                    <tr key={ex.id ?? `${block.id}-${i}`} style={ex.variant_of != null ? { background: '#faf7ff' } : undefined}>
                                      {i === 0 && (
                                        <td rowSpan={exs.length + 1} className="coach-pt-block" style={td()}>
                                          {blockLabel(bi)}
                                        </td>
                                      )}
                                      <td style={td({ color: ex.variant_of != null ? '#7c3aed' : 'var(--muted-light)', fontWeight: labels.get(ex)?.match(/[a-z]/) ? 700 : 400, whiteSpace: 'nowrap' })}>{labels.get(ex) ?? i + 1}</td>
                                      <td style={td({ textAlign: 'left', minWidth: 150 })}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            {/* wpisana nazwa = własna nazwa (odpina od biblioteki); zmiana z biblioteki — przez ✏️ */}
                                            <EditCell value={name} onCommit={v => onUpdateExercise(block.id, ex, { exercise_code: v.trim() || name, exercise_id: null, exercise: null })} align="left" placeholder="nazwa" />
                                          </div>
                                          {ex.ecc && !ex.iso && (
                                            <span title="Ćwiczenie ekscentryczne" style={{ flexShrink: 0, background: '#7c2d12', color: '#fed7aa', fontFamily: 'var(--font-inter),sans-serif', fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 5px', letterSpacing: '.02em' }}>
                                              ECC
                                            </span>
                                          )}
                                          {ex.iso && (
                                            <span title={`Ćwiczenie izometryczne (${ex.iso_type})`} style={{ flexShrink: 0, background: 'var(--navy-900)', color: 'var(--gold)', fontFamily: 'var(--font-inter),sans-serif', fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 5px', letterSpacing: '.02em' }}>
                                              {ex.iso_type}
                                            </span>
                                          )}
                                          {(() => {
                                            // ćwiczenie z wariantami — ile zawodniczek robi ten wariant (klik: przydział)
                                            const baseId = ex.variant_of ?? ex.id
                                            const hasVariants = exs.some(v => v.variant_of != null && v.variant_of === baseId)
                                            if (!hasVariants || baseId == null) return null
                                            const count = ex.variant_of != null
                                              ? (ex.variant_athlete_ids || []).filter(id => props.athletes.some(a => a.id === id)).length
                                              : props.athletes.filter(a => !assignedIn(ex.id).has(a.id)).length
                                            const names = ex.variant_of != null
                                              ? props.athletes.filter(a => (ex.variant_athlete_ids || []).includes(a.id))
                                              : props.athletes.filter(a => !assignedIn(ex.id).has(a.id))
                                            return (
                                              <button
                                                onClick={() => props.onAssignVariants(block.id, baseId)}
                                                title={`Kto robi ${labels.get(ex)}: ${names.map(a => a.full_name).join(', ') || 'nikt'} — kliknij, by zmienić przydział`}
                                                style={{ flexShrink: 0, border: `1px solid ${count ? '#7c3aed' : '#c23b3b'}`, background: count ? '#f3ecfd' : '#FDEDED', color: count ? '#7c3aed' : '#c23b3b', fontFamily: 'var(--font-inter),sans-serif', fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 5px', cursor: 'pointer' }}
                                              >
                                                👥 {count}{ex.variant_of == null ? ' (reszta)' : ''}
                                              </button>
                                            )
                                          })()}
                                        </div>
                                      </td>
                                      <td style={td({ width: 20, padding: '2px', textAlign: 'center' })}>
                                        <EditCell
                                          value={ex.exercise_url || ''}
                                          onCommit={v => onUpdateExercise(block.id, ex, { exercise_url: v.trim() || null })}
                                          placeholder="+"
                                          renderDisplay={val => val
                                            ? <span title={val} style={{ cursor: 'text', fontSize: '14px' }}>🔗</span>
                                            : <span style={{ color: 'var(--border)', fontSize: '12px', cursor: 'text' }}>+</span>}
                                        />
                                      </td>
                                      <td className="coach-pt-comment" style={td({ textAlign: 'left' })}>
                                        <EditCell value={ex.coach_comment || ''} onCommit={v => onUpdateExercise(block.id, ex, { coach_comment: v.trim() || null })} align="left" placeholder="komentarz" />
                                      </td>
                                      {Array.from({ length: warmupCols }).flatMap((_, r) => {
                                        const ws = ex.is_warmup ? ex.warmup_sets?.[r] : undefined
                                        return [
                                          <td key={`w${ex.id}-${r}-reps`} className="coach-pt-warm" style={td()}>
                                            <EditCell value={ws?.reps || ''} onCommit={v => updateWarmupSet(block.id, ex, r, 'reps', v)} placeholder="powt." />
                                          </td>,
                                          <td key={`w${ex.id}-${r}-kg`} className="coach-pt-warm" style={td()}>
                                            <EditCell value={ws?.weight_kg || ''} onCommit={v => updateWarmupSet(block.id, ex, r, 'weight_kg', v)} placeholder="ciężar" />
                                          </td>,
                                          <td key={`w${ex.id}-${r}-note`} className="coach-pt-warm" style={td({ textAlign: 'left' })}>
                                            <EditCell value={ws?.note || ''} onCommit={v => updateWarmupSet(block.id, ex, r, 'note', v)} align="left" placeholder="komentarz" />
                                          </td>,
                                        ]
                                      })}
                                      <td style={td({ background: '#eff6ff', fontWeight: 700 })}>
                                        <EditCell value={ex.sets?.toString() || ''} onCommit={v => {
                                          const n = Math.max(1, Math.min(20, parseInt(v) || 1))
                                          onUpdateExercise(block.id, ex, { sets: n, ...(resizeWorkSets(ex, n) ? { work_sets: resizeWorkSets(ex, n) } : {}) })
                                        }} />
                                      </td>
                                      <td style={td({ background: '#eff6ff' })}>
                                        {isoReps ? (
                                          <div onClick={() => props.onEditExercise(block.id, ex)} title={`Ćwiczenie ${ex.iso_type} — kliknij, by edytować czas i powtórzenia serii`} style={{ cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif', fontSize: '12px', fontWeight: 700, textAlign: 'center', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                                            <SeriesLines lines={isoPowtLines(ex)} />
                                          </div>
                                        ) : repsLines(ex) ? (
                                          // różne powtórzenia w seriach — edycja serii w oknie (✏️), żeby nie nadpisać wszystkich jedną wartością
                                          <div onClick={() => props.onEditExercise(block.id, ex)} title="Serie mają różne powtórzenia — kliknij, by edytować serie" style={{ cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif', fontSize: '12px', padding: '2px 4px' }}>
                                            <SeriesLines lines={repsLines(ex)!} />
                                          </div>
                                        ) : (
                                          <EditCell
                                            value={ex.work_sets?.length ? orBlank(fmtRange(ex.work_sets.map(s => s.reps))) : (ex.reps || '')}
                                            onCommit={v => onUpdateExercise(block.id, ex, { reps: v.trim() || null, ...(syncWorkSets(ex, 'reps', v.trim()) ? { work_sets: syncWorkSets(ex, 'reps', v.trim()) } : {}) })}
                                            placeholder="powt."
                                          />
                                        )}
                                      </td>
                                      <td style={td({ background: '#eff6ff' })}>
                                        <EditCell
                                          value={ex.work_sets?.length ? orBlank(fmtRange(ex.work_sets.map(s => s.weight_kg))) : (ex.weight_kg?.toString() || '')}
                                          onCommit={v => {
                                            const num = v.trim() ? parseFloat(v.replace(',', '.')) : null
                                            onUpdateExercise(block.id, ex, { weight_kg: num != null && !isNaN(num) ? num : null, ...(syncWorkSets(ex, 'weight_kg', v.trim()) ? { work_sets: syncWorkSets(ex, 'weight_kg', v.trim()) } : {}) })
                                          }}
                                          placeholder="—"
                                        />
                                      </td>
                                      <td style={td({ background: '#eff6ff' })}>
                                        {ex.iso ? <span style={{ color: 'var(--muted-light)' }}>—</span> : ex.ecc ? (
                                          // ekscentryczne — czas fazy ekscentrycznej i hold edytuje się w oknie serii
                                          <div onClick={() => props.onEditExercise(block.id, ex)} title="Ćwiczenie ekscentryczne — kliknij, by edytować czas ekscentryki i hold w seriach" style={{ cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif', fontSize: '12px', padding: '2px 4px' }}>
                                            <SeriesLines lines={eccTempoLines(ex)} />
                                          </div>
                                        ) : (
                                          <EditCell
                                            value={ex.work_sets?.length ? orBlank(fmtRange(ex.work_sets.map(s => s.tempo))) : (ex.tempo || '')}
                                            onCommit={v => onUpdateExercise(block.id, ex, { tempo: v.trim() || null, ...(syncWorkSets(ex, 'tempo', v.trim()) ? { work_sets: syncWorkSets(ex, 'tempo', v.trim()) } : {}) })}
                                            placeholder="—"
                                          />
                                        )}
                                      </td>
                                      <td style={td({ background: '#eff6ff' })}>
                                        <EditCell
                                          value={ex.work_sets?.length ? orBlank(fmtRange(ex.work_sets.map(s => s.rir))) : (ex.rir?.toString() || '')}
                                          onCommit={v => {
                                            const num = v.trim() ? parseInt(v) : null
                                            onUpdateExercise(block.id, ex, { rir: num != null && !isNaN(num) ? num : null, ...(syncWorkSets(ex, 'rir', v.trim()) ? { work_sets: syncWorkSets(ex, 'rir', v.trim()) } : {}) })
                                          }}
                                          placeholder="—"
                                        />
                                      </td>
                                      <td style={td({ padding: '2px', whiteSpace: 'nowrap' })}>
                                        <button onClick={() => props.onEditExercise(block.id, ex)} title="Pełna edycja ćwiczenia" style={iconBtn}>✏️</button>
                                        {ex.variant_of == null && (
                                          <button onClick={() => props.onAddVariant(block.id, ex)} title="Dodaj wariant tego ćwiczenia (1a → 1b) dla części zawodniczek" style={{ ...iconBtn, color: '#7c3aed', fontWeight: 700 }}>+wariant</button>
                                        )}
                                        {/* wariant przenosi się razem ze swoim ćwiczeniem bazowym */}
                                        {ex.variant_of == null && (
                                          <button onClick={() => props.onMoveExercise(block.id, ex)} title="Przenieś do innego bloku (z wariantami)" style={iconBtn}>↔</button>
                                        )}
                                        <button onClick={() => props.onDeleteExercise(block.id, ex.id)} title="Usuń ćwiczenie" style={{ ...iconBtn, color: '#c23b3b' }}>✕</button>
                                      </td>
                                    </tr>
                                  )
                                }),
                                addExRow,
                              ]
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* add block button below table */}
                      <div style={{ marginTop: 6 }}>
                        <button className="coach-btn coach-btn-ghost coach-btn-small" onClick={() => onAddBlock(day.id)}>+ Blok do {day.day_name}</button>
                      </div>
                    </div>
                  )
                })}

                {weekDays.length === 0 && (
                  <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-inter),sans-serif', fontSize: 12, padding: '0.5rem 0' }}>
                    Brak treningów — <button onClick={() => onAddDay(week.id)} style={{ border: 'none', background: 'none', color: 'var(--gold)', cursor: 'pointer', fontFamily: 'var(--font-inter),sans-serif', fontSize: 12, fontWeight: 700 }}>dodaj pierwszy</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {weeks.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
            Brak tygodni — <button onClick={onAddWeek} style={{ border: 'none', background: 'none', color: 'var(--gold)', cursor: 'pointer', fontWeight: 700 }}>dodaj tydzień</button>
          </div>
        )}
      </div>
    </div>
  )
}
