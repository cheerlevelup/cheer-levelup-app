// src/lib/coach/dayFillPdf.ts
// Karta treningu grupy (plan grupy samodzielnej → trening → „PDF"): wiersze —
// zawodniczki, kolumny — ćwiczenia dnia, w komórce kratki serii (R = rozgrzewka,
// S = seria robocza) z już wpisanymi wartościami; puste kratki do wypełnienia
// ręcznie na treningu. Za szeroka tabela dzieli się na kolejne strony (kolumny).
import type { jsPDF as JsPDF } from 'jspdf'
import { registerPdfFonts, type PdfFonts } from './planPdf'

export type SheetBox = { label: string; value: string; hint: string; warm: boolean }
export type SheetItem = { title?: string; changed?: string; boxes: SheetBox[]; note?: string; pain?: string }
export type SheetCell = { items: SheetItem[] } | { text: string }
export type SheetColumn = {
  blockIndex: number; blockTitle: string; label: string; name: string; extra?: boolean
  details: string[]   // pod nazwą: serie×powt., rozgrzewka, komentarz, warianty
}
export type SheetRow = { name: string; status: 'done' | 'started' | 'new' | 'absent'; cells: SheetCell[] }

const NAVY: [number, number, number] = [13, 27, 42]
const GOLD: [number, number, number] = [245, 200, 66]
const INK: [number, number, number] = [20, 35, 55]
const MUTED: [number, number, number] = [120, 135, 155]
const FAINT: [number, number, number] = [175, 185, 200]
const LINE: [number, number, number] = [215, 223, 233]
const HEAD_BG: [number, number, number] = [244, 246, 250]
const PURPLE: [number, number, number] = [124, 58, 237]
const AMBER: [number, number, number] = [192, 127, 30]
const RED: [number, number, number] = [194, 59, 59]
const BLUE: [number, number, number] = [44, 90, 163]
const GREEN: [number, number, number] = [21, 128, 61]

const BOX_W = 8.4, BOX_H = 6.2, BOX_GAP = 1.2, PAD = 2
const PT = 0.3528 // mm na punkt

export async function buildDayFillPdf(opts: {
  title: string; subtitle: string
  columns: SheetColumn[]; rows: SheetRow[]
  fonts?: PdfFonts | null
}): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const { font, t } = registerPdfFonts(doc, opts.fonts)
  const { columns, rows } = opts

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const m = 8, headerH = 16
  const nameW = 40
  const lineH = (pt: number) => pt * PT * 1.18
  const wrap = (s: string, w: number, pt: number, bold = false) => {
    doc.setFont(font, bold ? 'bold' : 'normal'); doc.setFontSize(pt)
    return doc.splitTextToSize(t(s), w) as string[]
  }

  // ── szerokość kolumny: tyle, by zmieściły się kratki najdłuższej komórki
  const boxesW = (boxes: SheetBox[]) => {
    const warm = boxes.filter(b => b.warm).length
    return boxes.length * (BOX_W + BOX_GAP) - BOX_GAP + (warm && warm < boxes.length ? 2.4 : 0)
  }
  const colW = columns.map((_, ci) => Math.max(40, Math.min(90, PAD * 2 + Math.max(0, ...rows.map(r => {
    const c = r.cells[ci]
    return c && 'items' in c ? Math.max(0, ...c.items.map(i => boxesW(i.boxes))) : 0
  })))))

  // ── komórka ćwiczenia w nagłówku (rysowana ręcznie: etykieta, nazwa, szczegóły)
  const headLayout = (col: SheetColumn, w: number, x: number, y: number, draw: boolean) => {
    let cy = y + 1.8
    const inner = w - PAD * 2
    const labelW = (() => { doc.setFont(font, 'bold'); doc.setFontSize(7); return doc.getTextWidth(col.label) + 2.6 })()
    const nameLines = wrap(col.name, inner - labelW - 1.5, 8, true)
    if (draw) {
      doc.setFillColor(...(col.extra ? PURPLE : NAVY)); doc.roundedRect(x + PAD, cy, labelW, 3.8, 0.8, 0.8, 'F')
      doc.setFont(font, 'bold'); doc.setFontSize(7); doc.setTextColor(...(col.extra ? [255, 255, 255] as [number, number, number] : GOLD))
      doc.text(col.label, x + PAD + labelW / 2, cy + 1.9, { align: 'center', baseline: 'middle' })
      doc.setFontSize(8); doc.setTextColor(...(col.extra ? PURPLE : NAVY))
      doc.text(nameLines, x + PAD + labelW + 1.5, cy + 0.15, { baseline: 'top', lineHeightFactor: 1.18 })
    }
    cy += Math.max(3.8, nameLines.length * lineH(8)) + 0.8
    col.details.forEach((d, i) => {
      const lines = wrap(d, inner, 6.3, i === 0)
      if (draw) {
        doc.setTextColor(...(d.startsWith('+ rozgrzewka') ? AMBER : d.startsWith('a: ') ? PURPLE : i === 0 ? INK : MUTED))
        doc.text(lines, x + PAD, cy, { baseline: 'top', lineHeightFactor: 1.18 })
      }
      cy += lines.length * lineH(6.3) + 0.4
    })
    return cy - y + 1.2
  }

  // ── komórka zawodniczki: ćwiczenia (wariant / dodatkowe), kratki serii, ból, notatka
  const cellLayout = (cell: SheetCell, w: number, x: number, y: number, draw: boolean) => {
    const inner = w - PAD * 2
    let cy = y + 1.5
    if (!('items' in cell)) {
      const lines = wrap(cell.text, inner, 6.5)
      if (draw) { doc.setTextColor(...FAINT); doc.text(lines, x + PAD, cy + 0.5, { baseline: 'top', lineHeightFactor: 1.18 }) }
      return lines.length * lineH(6.5) + 4
    }
    cell.items.forEach((item, ii) => {
      if (ii > 0) {
        cy += 1.2
        if (draw) { doc.setDrawColor(...LINE); doc.setLineDashPattern([0.8, 0.6], 0); doc.line(x + PAD, cy, x + w - PAD, cy); doc.setLineDashPattern([], 0) }
        cy += 1.2
      }
      for (const [text, color, bold] of [[item.title, PURPLE, true], [item.changed, PURPLE, false]] as const) {
        if (!text) continue
        const lines = wrap(text, inner, 6.3, bold)
        if (draw) { doc.setTextColor(...color); doc.text(lines, x + PAD, cy, { baseline: 'top', lineHeightFactor: 1.18 }) }
        cy += lines.length * lineH(6.3) + 0.4
      }
      if (item.boxes.length) {
        let bx = x + PAD
        let prevWarm: boolean | null = null
        for (const b of item.boxes) {
          if (prevWarm && !b.warm) bx += 2.4
          prevWarm = b.warm
          if (draw) {
            doc.setFont(font, 'normal'); doc.setFontSize(5.2); doc.setTextColor(...(b.warm ? AMBER : MUTED))
            doc.text(b.label, bx + BOX_W / 2, cy + 0.9, { align: 'center', baseline: 'middle' })
            const by = cy + 2
            doc.setLineWidth(0.25)
            doc.setDrawColor(...(b.value ? [150, 165, 185] as [number, number, number] : [195, 205, 218] as [number, number, number]))
            if (b.warm) doc.setLineDashPattern([0.7, 0.5], 0)
            doc.setFillColor(255, 255, 255)
            doc.roundedRect(bx, by, BOX_W, BOX_H, 0.9, 0.9, 'FD')
            doc.setLineDashPattern([], 0)
            if (b.value) {
              doc.setFont(font, 'bold'); doc.setFontSize(7.5); doc.setTextColor(...NAVY)
              doc.text(t(b.value), bx + BOX_W / 2, by + BOX_H / 2, { align: 'center', baseline: 'middle', maxWidth: BOX_W - 0.6 })
            } else if (b.hint) {
              doc.setFont(font, 'normal'); doc.setFontSize(5.5); doc.setTextColor(...FAINT)
              doc.text(t(b.hint), bx + BOX_W / 2, by + BOX_H / 2, { align: 'center', baseline: 'middle', maxWidth: BOX_W - 0.6 })
            }
          }
          bx += BOX_W + BOX_GAP
        }
        cy += 2 + BOX_H + 0.8
      }
      for (const [text, color] of [[item.pain, RED], [item.note, BLUE]] as const) {
        if (!text) continue
        const lines = wrap(text, inner, 6.2, true)
        if (draw) { doc.setTextColor(...color); doc.text(lines, x + PAD, cy + 0.3, { baseline: 'top', lineHeightFactor: 1.18 }) }
        cy += lines.length * lineH(6.2) + 0.6
      }
    })
    return cy - y + 1.4
  }

  const STATUS: Record<SheetRow['status'], { text: string; color: [number, number, number] }> = {
    done: { text: 'zakończony', color: GREEN },
    started: { text: 'w trakcie', color: AMBER },
    new: { text: '', color: MUTED },
    absent: { text: 'nieobecna', color: RED },
  }

  // ── kolumny na strony: ile się zmieści obok kolumny z nazwiskami
  const avail = pageW - 2 * m - nameW
  const chunks: number[][] = []
  columns.forEach((_, ci) => {
    const last = chunks[chunks.length - 1]
    const used = last ? last.reduce((s, i) => s + colW[i], 0) : Infinity
    if (!last || used + colW[ci] > avail) chunks.push([ci]); else last.push(ci)
  })
  if (chunks.length === 0) chunks.push([])

  chunks.forEach((chunk, pi) => {
    if (pi > 0) doc.addPage()
    // rozciągnij kolumny strony na całą szerokość
    const used = chunk.reduce((s, i) => s + colW[i], 0)
    const scale = chunk.length ? Math.min(1.5, Math.max(1, avail / used)) : 1
    const w = chunk.map(i => colW[i] * scale)

    // nagłówek: wiersz bloków + wiersz ćwiczeń
    const blockRow: any[] = [{ content: '', rowSpan: 2 }]
    chunk.forEach((ci, k) => {
      const prev = k > 0 ? columns[chunk[k - 1]] : null
      if (prev && prev.blockIndex === columns[ci].blockIndex) { blockRow[blockRow.length - 1].colSpan++; return }
      const continued = k === 0 && ci > 0 && columns[ci - 1].blockIndex === columns[ci].blockIndex
      blockRow.push({ content: t(`${columns[ci].blockTitle}${continued ? ' (cd.)' : ''}`), colSpan: 1 })
    })
    const exRow = chunk.map((ci, k) => ({ content: '', styles: { minCellHeight: headLayout(columns[ci], w[k], 0, 0, false) } }))

    const body = rows.map(r => [
      { content: '', styles: { minCellHeight: 10 } },
      ...chunk.map((ci, k) => ({ content: '', styles: { minCellHeight: cellLayout(r.cells[ci], w[k], 0, 0, false) } })),
    ])

    autoTable(doc, {
      head: [blockRow, exRow], body,
      startY: headerH + 3,
      margin: { left: m, right: m, top: headerH + 3, bottom: 10 },
      tableWidth: nameW + w.reduce((a, b) => a + b, 0),
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { font, fontSize: 7, cellPadding: 0, lineColor: LINE, lineWidth: 0.15, textColor: INK },
      headStyles: { font, fillColor: HEAD_BG, textColor: INK, lineColor: LINE, lineWidth: 0.15 },
      columnStyles: Object.fromEntries([[0, { cellWidth: nameW }], ...w.map((cw, k) => [k + 1, { cellWidth: cw }])]),
      didParseCell: (data) => {
        if (data.section === 'head' && data.row.index === 0) {
          const c = data.cell
          c.styles.fillColor = NAVY; c.styles.textColor = GOLD; c.styles.fontStyle = 'bold'; c.styles.fontSize = 7.5
          c.styles.cellPadding = { top: 1.8, bottom: 1.8, left: 2.5, right: 2 }
          if (data.column.index === 0) c.styles.fillColor = NAVY
        }
        if (data.section === 'body') {
          const r = rows[data.row.index]
          if (r.status === 'absent') data.cell.styles.fillColor = [248, 248, 250]
          else if (r.status === 'done') data.cell.styles.fillColor = [244, 251, 246]
        }
      },
      didDrawCell: (data) => {
        const c = data.cell
        if (data.section === 'head' && data.row.index === 1 && data.column.index > 0) {
          const k = data.column.index - 1
          headLayout(columns[chunk[k]], c.width, c.x, c.y, true)
        }
        if (data.section === 'head' && data.row.index === 0 && data.column.index === 0) {
          doc.setFont(font, 'bold'); doc.setFontSize(6.5); doc.setTextColor(...GOLD)
          doc.text(t('ZAWODNICZKA'), c.x + 2.5, c.y + c.height - 3)
        }
        if (data.section !== 'body') return
        const r = rows[data.row.index]
        if (data.column.index === 0) {
          const lines = wrap(r.name, c.width - 4, 8, true)
          doc.setTextColor(...(r.status === 'absent' ? FAINT : NAVY))
          doc.text(lines, c.x + 2, c.y + 2, { baseline: 'top', lineHeightFactor: 1.18 })
          const st = STATUS[r.status]
          if (st.text) {
            doc.setFont(font, 'bold'); doc.setFontSize(6); doc.setTextColor(...st.color)
            doc.text(t(st.text), c.x + 2, c.y + 2.6 + lines.length * lineH(8), { baseline: 'top' })
          }
          return
        }
        if (r.status === 'absent') return
        cellLayout(r.cells[chunk[data.column.index - 1]], c.width, c.x, c.y, true)
      },
      didDrawPage: () => {
        doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, headerH, 'F')
        doc.setFillColor(...GOLD); doc.rect(0, 0, 3, headerH, 'F')
        doc.setFont(font, 'bold'); doc.setFontSize(13); doc.setTextColor(...GOLD)
        doc.text(t(opts.title), m, 10.2)
        const tw = doc.getTextWidth(t(opts.title))
        doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(170, 190, 215)
        doc.text(t(opts.subtitle), m + tw + 4, 10.2)
        doc.setFontSize(8); doc.setTextColor(170, 190, 215)
        doc.text(t('Data: ____________'), pageW - m, 10.2, { align: 'right' })
      },
    })
  })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont(font, 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED)
    doc.text(t('R = seria rozgrzewkowa (warm-up set) · S = seria robocza · szara liczba w kratce = ciężar z planu'), m, pageH - 4)
    doc.text(`${p} / ${pages}`, pageW - m, pageH - 4, { align: 'right' })
  }
  return doc
}
