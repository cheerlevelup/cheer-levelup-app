'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', red: '#EF4444', green: '#22C55E',
}
const mono = "'Space Mono', monospace"
const sans = "'Space Grotesk', sans-serif"

type WarmupSet = { reps?: string; weight_kg?: string; note?: string }
type ExerciseLibraryItem = { id: number; name: string; category?: string | null }
type BlockExercise = {
  id?: number; block_id: number; exercise_id?: number | null; exercise_code?: string | null
  exercise_order: number; sets: number; reps?: string | null; tempo?: string | null
  weight_kg?: number | null; rir?: number | null; is_warmup: boolean
  warmup_sets?: WarmupSet[] | null; coach_comment?: string | null
  exercise_url?: string | null; exercise?: ExerciseLibraryItem | null
}
type Block = {
  id: number; day_id: number; block_name: string; block_order: number; rounds: number
  workout_block_exercises?: BlockExercise[]
}
type Day = { id: number; week_id: number; day_name: string; day_order: number }
type Week = { id: number; plan_id: number; week_number: number; name?: string | null }
type Plan = { id: number; name: string }

interface Props {
  plan: Plan
  weeks: Week[]
  days: Day[]
  blocks: Block[]
  onBlocksChange: (blocks: Block[]) => void
  onAddDay: (weekId: number) => Promise<void>
  onAddBlock: (dayId: number) => Promise<void>
  onAddExercise: (blockId: number) => void   // opens ExerciseModal in parent
  onAddWeek: () => Promise<void>
}

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
      style={{ width: '100%', border: 'none', background: '#FFFBEB', outline: `2px solid ${C.gold}`, borderRadius: 3,
        fontFamily: mono, fontSize: '0.72rem', color: C.navy, textAlign: align, padding: '2px 4px' }}
    />
  )
  return (
    <div onClick={start} title="Kliknij aby edytować"
      onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FA')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      style={{ cursor: 'text', minHeight: 22, display: 'flex', alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        fontFamily: mono, fontSize: '0.72rem', color: value ? C.navy : '#CBD5E1',
        padding: '2px 4px', borderRadius: 3, transition: 'background 0.1s' }}>
      {renderDisplay ? renderDisplay(value) : (value || <span style={{ fontStyle: 'italic', fontSize: '0.65rem' }}>{placeholder ?? '—'}</span>)}
    </div>
  )
}

// ─── tiny action button ───────────────────────────────────────────────────────
function Btn({ children, onClick, color = C.navy, bg = C.offWhite, title }: {
  children: React.ReactNode; onClick: () => void; color?: string; bg?: string; title?: string
}) {
  return (
    <button onClick={onClick} title={title}
      style={{ border: `1px solid ${C.grayLight}`, background: bg, color, borderRadius: 6,
        padding: '3px 8px', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {children}
    </button>
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
      const exs = (block.workout_block_exercises || []).sort((a, b) => a.exercise_order - b.exercise_order)
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

        applyData(sheet.getCell(rowIdx, C_NR), i + 1, bg, { align: 'center', color: '64748B' })
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
      const exs = (block.workout_block_exercises || []).sort((a, b) => a.exercise_order - b.exercise_order)
      if (exs.length === 0) return

      exs.forEach((ex, i) => {
        const wd = Array.from({ length: wCols }, (_, r) => {
          const ws = ex.warmup_sets?.[r]
          return [pl(ws?.reps), pl(ws?.weight_kg), pl(ws?.note)]
        }).flat()
        body.push([
          i === 0 ? blockLabel(bi) : '',  // 0: blok
          i + 1,                           // 1: #
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
export default function PlanTableView({ plan, weeks, days, blocks, onBlocksChange, onAddDay, onAddBlock, onAddExercise, onAddWeek }: Props) {
  const [warmupCols, setWarmupCols] = useState(0)
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)

  const allDays = [...days].sort((a, b) => a.day_order - b.day_order)

  function updateExercise(blockId: number, exId: number | undefined, field: keyof BlockExercise, value: any) {
    onBlocksChange(blocks.map(b => b.id !== blockId ? b : {
      ...b,
      workout_block_exercises: (b.workout_block_exercises || []).map(ex =>
        ex.id === exId ? { ...ex, [field]: value } : ex
      ),
    }))
  }

  function updateWarmupSet(blockId: number, exId: number | undefined, rIdx: number, field: 'reps' | 'weight_kg' | 'note', value: string) {
    onBlocksChange(blocks.map(b => b.id !== blockId ? b : {
      ...b,
      workout_block_exercises: (b.workout_block_exercises || []).map(ex => {
        if (ex.id !== exId) return ex
        const sets = [...(ex.warmup_sets || [])]
        while (sets.length <= rIdx) sets.push({ reps: '', weight_kg: '', note: '' })
        sets[rIdx] = { ...sets[rIdx], [field]: value }
        return { ...ex, warmup_sets: sets }
      }),
    }))
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
    padding: '5px 8px', background: C.navy, color: C.gold,
    fontFamily: mono, fontSize: '0.57rem', fontWeight: 700,
    letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    border: `1px solid ${C.navyLight}`, textAlign: 'center', ...extra,
  })
  const td = (extra?: CSSProperties): CSSProperties => ({
    padding: '3px 5px', border: `1px solid ${C.grayLight}`,
    fontFamily: mono, fontSize: '0.72rem', color: C.navy,
    verticalAlign: 'middle', textAlign: 'center', ...extra,
  })

  // fixed col count before warmup: Blok + # + Nazwa + 🔗 + Komentarz = 5
  const fixedCols = 5

  return (
    <div style={{ fontFamily: sans }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 9, padding: '0.35rem 0.65rem' }}>
          <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray }}>Rozgrzewka (R):</span>
          <button onClick={() => setWarmupCols(v => Math.max(0, v - 1))} style={{ border: `1px solid ${C.grayLight}`, background: C.offWhite, borderRadius: 4, width: 20, height: 20, fontWeight: 800, cursor: 'pointer', color: C.navy, lineHeight: 1 }}>−</button>
          <span style={{ fontFamily: mono, fontWeight: 800, minWidth: 14, textAlign: 'center', fontSize: '0.82rem' }}>{warmupCols}</span>
          <button onClick={() => setWarmupCols(v => Math.min(6, v + 1))} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 4, width: 20, height: 20, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>+</button>
        </div>
        <Btn onClick={onAddWeek} bg={C.navy} color={C.gold}>+ Tydzień</Btn>
        <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.grayLight }}>|</span>
        <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray }}>Kliknij komórkę aby edytować · Enter zatwierdza</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => doExport('xlsx')} disabled={exporting !== null}
            style={{ border: 'none', background: '#217346', color: C.white, borderRadius: 8, padding: '0.4rem 0.8rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
            {exporting === 'xlsx' ? '...' : '⬇ Excel'}
          </button>
          <button onClick={() => doExport('pdf')} disabled={exporting !== null}
            style={{ border: 'none', background: '#B91C1C', color: C.white, borderRadius: 8, padding: '0.4rem 0.8rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
            {exporting === 'pdf' ? '...' : '⬇ PDF'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {weeks.sort((a, b) => a.week_number - b.week_number).map(week => {
          const weekDays = allDays.filter(d => d.week_id === week.id)
          return (
            <div key={week.id}>
              {/* week header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Tydzień {week.week_number}
                </div>
                <Btn onClick={() => onAddDay(week.id)}>+ Trening</Btn>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {weekDays.map(day => {
                  const dayBlocks = blocks.filter(b => b.day_id === day.id).sort((a, b) => a.block_order - b.block_order)

                  return (
                    <div key={day.id}>
                      {/* day header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.35rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: C.navy }}>{day.day_name}</div>
                        <Btn onClick={() => onAddBlock(day.id)}>+ Blok</Btn>
                      </div>

                      <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 10px rgba(13,27,42,0.06)', border: `1.5px solid ${C.grayLight}` }}>
                        <table style={{ borderCollapse: 'collapse', minWidth: '100%', background: C.white }}>
                          <thead>
                            <tr>
                              <th style={th({ width: 32 })}>Blok</th>
                              <th style={th({ width: 22 })}>#</th>
                              <th style={th({ minWidth: 150, textAlign: 'left' })}>Nazwa</th>
                              <th style={th({ width: 20, padding: '5px 2px' })}>🔗</th>
                              <th style={th({ minWidth: 130, textAlign: 'left' })}>Komentarz</th>
                              {Array.from({ length: warmupCols }, (_, i) => (
                                <th key={i} colSpan={3} style={th({ minWidth: 180, background: '#132D1E', color: '#86EFAC' })}>R{i + 1}</th>
                              ))}
                              <th style={th({ width: 38, background: '#1E3A5F', color: '#93C5FD' })}>Serie</th>
                              <th style={th({ width: 52, background: '#1E3A5F', color: '#93C5FD' })}>Powt.</th>
                              <th style={th({ minWidth: 75, background: '#1E3A5F', color: '#93C5FD' })}>Ciężar</th>
                              <th style={th({ width: 72, background: '#1E3A5F', color: '#93C5FD' })}>Tempo</th>
                              <th style={th({ width: 38, background: '#1E3A5F', color: '#93C5FD' })}>RIR</th>
                              <th style={th({ minWidth: 110, background: '#1E3A5F', color: '#93C5FD', textAlign: 'left' })}>Kom.</th>
                              <th style={th({ width: 36, background: C.navyLight })}></th>
                            </tr>
                            {warmupCols > 0 && (
                              <tr>
                                {[...Array(fixedCols)].map((_, i) => <td key={i} style={{ ...td(), background: C.offWhite, padding: 0, border: `1px solid ${C.grayLight}` }} />)}
                                {Array.from({ length: warmupCols }).flatMap((_, i) => [
                                  <td key={`sh${i}a`} style={td({ background: '#F0FDF4', fontSize: '0.57rem', color: '#16A34A', fontWeight: 700 })}>powt.</td>,
                                  <td key={`sh${i}b`} style={td({ background: '#F0FDF4', fontSize: '0.57rem', color: '#16A34A', fontWeight: 700 })}>ciężar</td>,
                                  <td key={`sh${i}c`} style={td({ background: '#F0FDF4', fontSize: '0.57rem', color: '#16A34A', fontWeight: 700, textAlign: 'left' })}>komentarz</td>,
                                ])}
                                {[...Array(7)].map((_, i) => <td key={`s${i}`} style={{ ...td(), background: '#EFF6FF', padding: 0 }} />)}
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            {dayBlocks.map((block, bi) => {
                              const exs = (block.workout_block_exercises || []).sort((a, b) => a.exercise_order - b.exercise_order)
                              const rowBg = bi % 2 === 0 ? C.white : '#FAFBFC'

                              const addExRow = (
                                <tr key={`add-${block.id}`}>
                                  {bi === 0 || true ? null : null}
                                  <td style={td({ background: C.navy, color: C.gold, fontWeight: 800, fontSize: '0.82rem', verticalAlign: 'middle', borderRight: `2px solid ${C.gold}` })}>{blockLabel(bi)}</td>
                                  <td colSpan={fixedCols - 1 + warmupCols * 3 + 7} style={td({ background: rowBg })}>
                                    <button onClick={() => onAddExercise(block.id)}
                                      style={{ border: `1px dashed ${C.grayLight}`, background: 'transparent', color: C.gray, borderRadius: 5, padding: '2px 12px', fontFamily: mono, fontSize: '0.6rem', cursor: 'pointer' }}>
                                      + ćwiczenie
                                    </button>
                                  </td>
                                  <td style={td({ background: rowBg })}></td>
                                </tr>
                              )

                              if (exs.length === 0) return addExRow

                              return [
                                ...exs.map((ex, i) => {
                                  const name = fmtName(ex.exercise?.name || ex.exercise_code || '')
                                  return (
                                    <tr key={ex.id ?? `${block.id}-${i}`} style={{ background: rowBg }}>
                                      {i === 0 && (
                                        <td rowSpan={exs.length + 1} style={td({ background: C.navy, color: C.gold, fontWeight: 800, fontSize: '0.82rem', verticalAlign: 'middle', borderRight: `2px solid ${C.gold}` })}>
                                          {blockLabel(bi)}
                                        </td>
                                      )}
                                      <td style={td({ color: C.gray })}>{i + 1}</td>
                                      <td style={td({ textAlign: 'left', minWidth: 150 })}>
                                        <EditCell value={name} onCommit={v => updateExercise(block.id, ex.id, 'exercise_code', v)} align="left" placeholder="nazwa" />
                                      </td>
                                      <td style={td({ width: 20, padding: '2px', textAlign: 'center' })}>
                                        <EditCell
                                          value={ex.exercise_url || ''}
                                          onCommit={v => updateExercise(block.id, ex.id, 'exercise_url', v || null)}
                                          placeholder="+"
                                          renderDisplay={val => val
                                            ? <span title={val} style={{ cursor: 'text', fontSize: '0.9rem' }}>🔗</span>
                                            : <span style={{ color: C.grayLight, fontSize: '0.75rem', cursor: 'text' }}>+</span>}
                                        />
                                      </td>
                                      <td style={td({ textAlign: 'left' })}>
                                        <EditCell value={ex.coach_comment || ''} onCommit={v => updateExercise(block.id, ex.id, 'coach_comment', v || null)} align="left" placeholder="komentarz" />
                                      </td>
                                      {Array.from({ length: warmupCols }).flatMap((_, r) => {
                                        const ws = ex.warmup_sets?.[r]
                                        const bg = '#F0FDF4'
                                        return [
                                          <td key={`w${ex.id}-${r}-reps`} style={td({ background: bg })}>
                                            <EditCell value={ws?.reps || ''} onCommit={v => updateWarmupSet(block.id, ex.id, r, 'reps', v)} placeholder="powt." />
                                          </td>,
                                          <td key={`w${ex.id}-${r}-kg`} style={td({ background: bg })}>
                                            <EditCell value={ws?.weight_kg || ''} onCommit={v => updateWarmupSet(block.id, ex.id, r, 'weight_kg', v)} placeholder="ciężar" />
                                          </td>,
                                          <td key={`w${ex.id}-${r}-note`} style={td({ background: bg, textAlign: 'left' })}>
                                            <EditCell value={ws?.note || ''} onCommit={v => updateWarmupSet(block.id, ex.id, r, 'note', v)} align="left" placeholder="komentarz" />
                                          </td>,
                                        ]
                                      })}
                                      <td style={td({ background: '#EFF6FF', fontWeight: 800 })}>
                                        <EditCell value={ex.sets?.toString() || ''} onCommit={v => updateExercise(block.id, ex.id, 'sets', parseInt(v) || 1)} />
                                      </td>
                                      <td style={td({ background: '#EFF6FF' })}>
                                        <EditCell value={ex.reps || ''} onCommit={v => updateExercise(block.id, ex.id, 'reps', v || null)} placeholder="powt." />
                                      </td>
                                      <td style={td({ background: '#EFF6FF' })}>
                                        <EditCell value={ex.weight_kg?.toString() || ''} onCommit={v => updateExercise(block.id, ex.id, 'weight_kg', v ? parseFloat(v) : null)} placeholder="—" />
                                      </td>
                                      <td style={td({ background: '#EFF6FF' })}>
                                        <EditCell value={ex.tempo || ''} onCommit={v => updateExercise(block.id, ex.id, 'tempo', v || null)} placeholder="—" />
                                      </td>
                                      <td style={td({ background: '#EFF6FF' })}>
                                        <EditCell value={ex.rir?.toString() || ''} onCommit={v => updateExercise(block.id, ex.id, 'rir', v ? parseInt(v) : null)} placeholder="—" />
                                      </td>
                                      <td style={td({ background: '#EFF6FF', textAlign: 'left' })}>
                                        <EditCell value={''} onCommit={() => {}} align="left" placeholder="notatka" />
                                      </td>
                                      <td style={td({ background: C.offWhite, padding: '2px' })}>
                                        <button onClick={() => onAddExercise(block.id)} title="Edytuj w oknie"
                                          style={{ border: 'none', background: 'transparent', color: C.gray, cursor: 'pointer', fontSize: '0.75rem', padding: '2px 4px' }}>✏️</button>
                                      </td>
                                    </tr>
                                  )
                                }),
                                // + ćwiczenie row at bottom of block
                                <tr key={`add-ex-${block.id}`} style={{ background: rowBg }}>
                                  <td colSpan={fixedCols + warmupCols * 3 + 6} style={td({ background: rowBg, padding: '3px 8px' })}>
                                    <button onClick={() => onAddExercise(block.id)}
                                      style={{ border: `1px dashed ${C.grayLight}`, background: 'transparent', color: C.gray, borderRadius: 5, padding: '2px 10px', fontFamily: mono, fontSize: '0.6rem', cursor: 'pointer' }}>
                                      + ćwiczenie w bloku {blockLabel(bi)}
                                    </button>
                                  </td>
                                  <td style={td({ background: C.offWhite })}></td>
                                </tr>,
                              ]
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* add block button below table */}
                      <div style={{ marginTop: 6 }}>
                        <Btn onClick={() => onAddBlock(day.id)}>+ Blok do {day.day_name}</Btn>
                      </div>
                    </div>
                  )
                })}

                {weekDays.length === 0 && (
                  <div style={{ color: C.gray, fontFamily: mono, fontSize: '0.72rem', padding: '0.5rem 0' }}>
                    Brak treningów — <button onClick={() => onAddDay(week.id)} style={{ border: 'none', background: 'none', color: C.gold, cursor: 'pointer', fontFamily: mono, fontSize: '0.72rem', fontWeight: 700 }}>dodaj pierwszy</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {weeks.length === 0 && (
          <div style={{ textAlign: 'center', color: C.gray, padding: '2rem' }}>
            Brak tygodni — <button onClick={onAddWeek} style={{ border: 'none', background: 'none', color: C.gold, cursor: 'pointer', fontWeight: 700 }}>dodaj tydzień</button>
          </div>
        )}
      </div>
    </div>
  )
}
