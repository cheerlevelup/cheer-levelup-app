// src/lib/coach/planXlsx.ts
// Eksport planu treningowego do Excela (edytor planu → „Excel"). Arkusz na trening,
// wygląd spójny z PDF (motyw „sportowy"): granatowy pasek z nazwą treningu i logo,
// bloki jako sekcje (litera + nazwa), ćwiczenia A1, A2… z tymi samymi wartościami
// co tabela edytora (serie ISO / ECC / różne powtórzenia w seriach, warianty).
// Bez siatki Excela, wysokości wierszy liczone z długości tekstu (nic nie jest ucięte).
/* eslint-disable @typescript-eslint/no-explicit-any -- komórki i style exceljs */
import { sortWithVariants, variantLabels } from '../exerciseVariants'
import { fmtRange, isoPowtLines, repsLines, eccTempoLines, type PlanWorkSet } from './planFormat'

type XlsxExercise = {
  id?: number; exercise_code?: string | null; exercise_order: number
  sets: number; reps?: string | null; tempo?: string | null
  weight_kg?: number | null; rir?: number | null; is_warmup: boolean
  warmup_sets?: { reps?: string; weight_kg?: string; note?: string }[] | null
  coach_comment?: string | null; exercise_url?: string | null
  exercise?: { name: string } | null
  work_sets?: PlanWorkSet[] | null; iso?: boolean | null; iso_type?: 'PIMA' | 'HIMA' | null
  ecc?: boolean | null
  is_individual?: boolean | null
  variant_of?: number | null; variant_athlete_ids?: number[] | null
}
type XlsxBlock = { id: number; day_id: number; block_name: string; block_order: number; workout_block_exercises?: XlsxExercise[] }
type XlsxDay = { id: number; day_name: string; day_order: number; coach_intro?: string | null; coach_closing?: string | null }

// ── paleta (jak PDF „sportowy")
const NAVY = '0F1E36'
const NAVY_2 = '1C2F4F'
const GOLD = 'F2B705'
const INK = '16202F'
const BODY = '485466'
const MUTED = '828FA2'
const FAINT = 'BEC7D4'
const RULE = 'E0E5ED'
const SECTION_BG = 'F0F3F8'
const VALUE_BG = 'F7F9FC'
const WARM = 'A86A12'
const WARM_BG = 'FFF8EC'
const VARIANT = '7C3AED'
const VARIANT_BG = 'FBF9FF'
const LINK = '1E5AC8'
const WHITE = 'FFFFFF'
const BADGE: Record<string, string> = { ECC: '9A3412', HIMA: '0F1E36', PIMA: '0F1E36', ISO: '0F1E36', INDYW: '0E7490' }

const FONT = 'Calibri'
const argb = (hex: string) => ({ argb: `FF${hex}` })
const fill = (hex: string): any => ({ type: 'pattern', pattern: 'solid', fgColor: argb(hex) })
const line = (hex: string, style: 'thin' | 'medium' | 'hair' = 'thin') => ({ style, color: argb(hex) })
const blockLabel = (i: number) => String.fromCharCode(65 + i)
const dash = (v: string) => v || '—'
// liczby jako liczby (bez zielonych trójkątów „liczba zapisana jako tekst" w Excelu)
const num = (v: string): string | number => (/^\d+([.,]\d+)?$/.test(v) ? Number(v.replace(',', '.')) : v)

// Ile linii zajmie tekst w kolumnie o szerokości w (znaki Excela) — do wysokości wiersza
function linesFor(text: string, width: number, fontScale = 1) {
  if (!text) return 1
  const perLine = Math.max(4, Math.floor((width - 1.5) / fontScale))
  return text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0)
}

export async function buildPlanXlsx(opts: {
  plan: { name: string }
  days: XlsxDay[]
  blocks: XlsxBlock[]
  athletes: { id: number; full_name: string }[]
  logo?: string | null   // PNG jako data URL (public/pdf-logo.png)
}): Promise<ArrayBuffer> {
  const { plan, blocks, athletes } = opts
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cheer LevelUP'
  wb.created = new Date()
  const logoId = opts.logo ? wb.addImage({ base64: opts.logo, extension: 'png' }) : null

  const days = [...opts.days].sort((a, b) => a.day_order - b.day_order)
  const dayBlocks = (dayId: number) => blocks
    .filter(b => b.day_id === dayId && (b.workout_block_exercises?.length ?? 0) > 0)
    .sort((a, b) => a.block_order - b.block_order)
  // kolumny rozgrzewki w arkuszu: tyle, ile ma ćwiczenie z największą liczbą niepustych serii
  const warmCount = (dayId: number) => Math.min(6, Math.max(0, ...dayBlocks(dayId).flatMap(b =>
    (b.workout_block_exercises || []).map(e => {
      if (!e.is_warmup) return 0
      const sets = e.warmup_sets || []
      let last = 0
      sets.forEach((s, i) => { if (s.reps?.trim() || s.weight_kg?.trim() || s.note?.trim()) last = i + 1 })
      return last
    }))))

  const usedNames = new Set<string>()
  const sheetName = (name: string) => {
    const base = (name.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Trening').slice(0, 31)
    let n = base, i = 2
    while (usedNames.has(n.toLowerCase())) n = `${base.slice(0, 27)} (${i++})`
    usedNames.add(n.toLowerCase())
    return n
  }

  const printable = days.filter(d => dayBlocks(d.id).length > 0)
  if (printable.length === 0) {
    const ws = wb.addWorksheet('Plan')
    ws.getCell('A1').value = 'Plan nie ma jeszcze żadnych ćwiczeń.'
    return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>
  }

  printable.forEach(day => {
    const wCols = warmCount(day.id)
    const sheet = wb.addWorksheet(sheetName(day.day_name), {
      properties: { tabColor: argb(GOLD) },
      views: [{ state: 'frozen', ySplit: 0, xSplit: 0, showGridLines: false }],
      pageSetup: {
        orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.35, right: 0.35, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.25 },
      },
    })
    sheet.headerFooter.oddFooter = `&L&8&K828FA2${plan.name.replace(/&/g, '&&')} · Cheer Level Up — Cheer Body Training Programs&R&8&K828FA2&P / &N`

    // ── kolumny: margines | # | Ćwiczenie | Komentarz | [powt. ciężar uwagi]×n | Serie Powt. Ciężar Tempo RIR | margines
    const C_PAD = 1, C_NR = 2, C_NAME = 3, C_KOM = 4, C_WARM = 5
    const C_SERIE = C_WARM + wCols * 3
    const C_LAST = C_SERIE + 4
    const C_END = C_LAST + 1
    const widths: Record<number, number> = { [C_PAD]: 2, [C_NR]: 6, [C_NAME]: 32, [C_KOM]: wCols > 2 ? 34 : 44, [C_END]: 2 }
    for (let r = 0; r < wCols; r++) { widths[C_WARM + r * 3] = 8; widths[C_WARM + r * 3 + 1] = 9; widths[C_WARM + r * 3 + 2] = 16 }
    ;[8, 13, 11, 15, 7].forEach((w, i) => { widths[C_SERIE + i] = w })
    for (let c = 1; c <= C_END; c++) sheet.getColumn(c).width = widths[c]

    const cellAt = (r: number, c: number) => sheet.getCell(r, c)
    const paintRow = (r: number, hex: string, from = C_PAD, to = C_END) => { for (let c = from; c <= to; c++) cellAt(r, c).fill = fill(hex) }

    // ── nagłówek: granatowy pasek (2 wiersze) + złota linia
    sheet.getRow(1).height = 30
    sheet.getRow(2).height = 18
    sheet.getRow(3).height = 4
    paintRow(1, NAVY); paintRow(2, NAVY); paintRow(3, GOLD)
    const textCol = logoId != null ? C_NAME : C_NR
    if (logoId != null) {
      sheet.addImage(logoId, { tl: { col: C_PAD - 1 + 0.5, row: 0.22 }, ext: { width: 46, height: 46 }, editAs: 'absolute' } as any)
    }
    const brandFrom = Math.max(C_KOM + 1, C_SERIE + 1)
    sheet.mergeCells(1, textCol, 1, brandFrom - 1)
    sheet.mergeCells(2, textCol, 2, brandFrom - 1)
    Object.assign(cellAt(1, textCol), {
      value: day.day_name.toUpperCase(),
      font: { name: FONT, size: 20, bold: true, color: argb(WHITE) },
      alignment: { vertical: 'bottom', horizontal: 'left', indent: logoId != null ? 1 : 0 },
    })
    Object.assign(cellAt(2, textCol), {
      value: `PLAN TRENINGOWY  ·  ${plan.name.toUpperCase()}`,
      font: { name: FONT, size: 9, bold: true, color: argb(GOLD) },
      alignment: { vertical: 'top', horizontal: 'left', indent: logoId != null ? 1 : 0 },
    })
    sheet.mergeCells(1, brandFrom, 1, C_LAST)
    sheet.mergeCells(2, brandFrom, 2, C_LAST)
    Object.assign(cellAt(1, brandFrom), {
      value: 'CHEER LEVEL UP',
      font: { name: FONT, size: 13, bold: true, color: argb(WHITE) },
      alignment: { vertical: 'bottom', horizontal: 'right' },
    })
    Object.assign(cellAt(2, brandFrom), {
      value: 'CHEER BODY TRAINING PROGRAMS',
      font: { name: FONT, size: 7.5, color: argb('A5B6D0') },
      alignment: { vertical: 'top', horizontal: 'right' },
    })
    for (let c = brandFrom; c <= C_END; c++) { cellAt(1, c).fill = fill(NAVY_2); cellAt(2, c).fill = fill(NAVY_2) }

    let row = 4
    sheet.getRow(row).height = 8
    row++

    // ── przemowa trenera przed treningiem
    const note = (label: string, text: string) => {
      const width = Object.entries(widths).filter(([c]) => +c >= C_NR && +c <= C_LAST).reduce((a, [, w]) => a + w, 0)
      sheet.mergeCells(row, C_NR, row, C_LAST)
      const c = cellAt(row, C_NR)
      c.value = { richText: [
        { text: `${label}   `, font: { name: FONT, size: 8, bold: true, color: argb(WARM) } },
        { text, font: { name: FONT, size: 10, italic: true, color: argb(BODY) } },
      ] }
      c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }
      c.fill = fill(WARM_BG)
      c.border = { left: line(GOLD, 'medium') } as any
      sheet.getRow(row).height = Math.max(22, linesFor(`${label}   ${text}`, width) * 14 + 8)
      row++
      sheet.getRow(row).height = 8
      row++
    }
    if (day.coach_intro?.trim()) note('PRZED TRENINGIEM', day.coach_intro.trim())

    // ── nagłówek tabeli: małe wersaliki bez tła, granatowa linia pod spodem
    const headTop = row
    const headRows = wCols > 0 ? 2 : 1
    const hc = (r: number, c: number, text: string, align: 'left' | 'center', color = MUTED, size = 8, bold = true) => {
      const cell = cellAt(r, c)
      cell.value = text
      cell.font = { name: FONT, size, bold, color: argb(color) }
      cell.alignment = { horizontal: align, vertical: 'bottom', wrapText: false, indent: align === 'left' ? 1 : 0 }
    }
    sheet.getRow(headTop).height = 18
    if (wCols > 0) sheet.getRow(headTop + 1).height = 14
    const span = (c: number) => { if (headRows > 1) sheet.mergeCells(headTop, c, headTop + 1, c) }
    hc(headTop, C_NR, '#', 'left'); span(C_NR)
    hc(headTop, C_NAME, 'ĆWICZENIE', 'left'); span(C_NAME)
    hc(headTop, C_KOM, 'KOMENTARZ', 'left'); span(C_KOM)
    for (let r = 0; r < wCols; r++) {
      const c = C_WARM + r * 3
      sheet.mergeCells(headTop, c, headTop, c + 2)
      hc(headTop, c, `ROZGRZEWKA ${r + 1}`, 'center', WARM)
      cellAt(headTop, c).border = { bottom: line('E9D3AE', 'hair') } as any
      ;['powt.', 'ciężar', 'uwagi'].forEach((t, i) => hc(headTop + 1, c + i, t, i === 2 ? 'left' : 'center', WARM, 7.5, false))
    }
    ;['SERIE', 'POWT.', 'CIĘŻAR', 'TEMPO', 'RIR'].forEach((t, i) => { hc(headTop, C_SERIE + i, t, 'center'); span(C_SERIE + i) })
    for (let c = C_NR; c <= C_LAST; c++) {
      const b = cellAt(headTop + headRows - 1, c)
      b.border = { ...(b.border || {}), bottom: line(NAVY, 'medium') } as any
    }
    row += headRows
    sheet.views = [{ state: 'frozen', ySplit: row - 1, xSplit: 0, showGridLines: false, topLeftCell: `A${row}` } as any]
    sheet.pageSetup.printTitlesRow = `${headTop}:${headTop + headRows - 1}`

    // ── bloki i ćwiczenia
    dayBlocks(day.id).forEach((block, bi) => {
      const exs = sortWithVariants(block.workout_block_exercises || [])
      const labels = variantLabels(exs)
      const assignedIn = (baseId?: number) => new Set(exs.filter(v => v.variant_of === baseId).flatMap(v => v.variant_athlete_ids || []))
      const letter = blockLabel(bi)
      const blockName = block.block_name && block.block_name.trim() !== `Blok ${letter}` ? block.block_name.trim() : ''

      // odstęp + sekcja bloku: litera w granatowym polu, „BLOK A · NAZWA", złota linia
      sheet.getRow(row).height = 10
      row++
      sheet.getRow(row).height = 24
      paintRow(row, SECTION_BG, C_NR, C_LAST)
      const lc = cellAt(row, C_NR)
      lc.value = letter
      lc.font = { name: FONT, size: 13, bold: true, color: argb(GOLD) }
      lc.fill = fill(NAVY)
      lc.alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.mergeCells(row, C_NAME, row, C_LAST)
      const nc = cellAt(row, C_NAME)
      nc.value = { richText: [
        { text: `BLOK ${letter}`, font: { name: FONT, size: 11, bold: true, color: argb(NAVY) } },
        ...(blockName ? [{ text: `   ·   ${blockName.toUpperCase()}`, font: { name: FONT, size: 10, color: argb(MUTED) } }] : []),
      ] }
      nc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      for (let c = C_NR; c <= C_LAST; c++) cellAt(row, c).border = { bottom: line(GOLD, 'medium') } as any
      row++

      exs.forEach((ex, i) => {
        const name = (ex.exercise?.name || ex.exercise_code || '').replace(/-/g, ' ')
        const baseId = ex.variant_of ?? ex.id
        const hasVariants = baseId != null && exs.some(v => v.variant_of != null && v.variant_of === baseId)
        let who = ''
        if (hasVariants) {
          const names = ex.variant_of != null
            ? athletes.filter(a => (ex.variant_athlete_ids || []).includes(a.id))
            : athletes.filter(a => !assignedIn(ex.id).has(a.id))
          who = ex.variant_of != null
            ? `dla: ${names.map(a => a.full_name).join(', ') || '—'}`
            : `dla: pozostałe (${names.length})`
        }
        const variant = ex.variant_of != null
        const badges = [ex.iso ? (ex.iso_type || 'ISO') : ex.ecc ? 'ECC' : '', ex.is_individual ? 'INDYW' : ''].filter(Boolean)

        const ws = ex.work_sets || []
        const powt = ex.iso ? isoPowtLines(ex).join('\n')
          : repsLines(ex)?.join('\n') ?? (ws.length ? fmtRange(ws.map(w => w.reps)) : dash(ex.reps || ''))
        const kg = ws.length ? fmtRange(ws.map(w => w.weight_kg)) : dash(ex.weight_kg?.toString() || '')
        const tempo = ex.iso ? '—' : ex.ecc ? eccTempoLines(ex).join('\n') : ws.length ? fmtRange(ws.map(w => w.tempo)) : dash(ex.tempo || '')
        const rir = ws.length ? fmtRange(ws.map(w => w.rir)) : dash(ex.rir?.toString() || '')
        const values = [String(ex.sets ?? '—'), powt, kg, tempo, rir]

        const rowBg = variant ? VARIANT_BG : WHITE
        const last = i === exs.length - 1
        const base = (c: number, bg = rowBg) => {
          const cell = cellAt(row, c)
          cell.fill = fill(bg)
          if (!last) cell.border = { bottom: line(RULE, 'thin') } as any
          return cell
        }

        // # (A1, A2a…)
        const nr = base(C_NR)
        nr.value = `${letter}${labels.get(ex) ?? String(i + 1)}`
        nr.font = { name: FONT, size: 9, bold: true, color: argb(variant ? VARIANT : MUTED) }
        nr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

        // nazwa (link) + plakietki + „dla: …" przy wariantach
        const nm = base(C_NAME)
        const nameFont = ex.exercise_url
          ? { name: FONT, size: 10, bold: true, color: argb(LINK), underline: true }
          : { name: FONT, size: 10, bold: true, color: argb(INK) }
        const rich: any[] = [{ text: name.toUpperCase(), font: nameFont }]
        badges.forEach(b => rich.push({ text: `  ${b}`, font: { name: FONT, size: 8, bold: true, color: argb(BADGE[b] ?? NAVY) } }))
        if (who) rich.push({ text: `\n${who}`, font: { name: FONT, size: 8.5, italic: true, color: argb(VARIANT) } })
        // hiperłącze: cała komórka klikalna, tekst z formatowaniem (plakietki, „dla: …")
        nm.value = ex.exercise_url
          ? { text: { richText: rich }, hyperlink: ex.exercise_url, tooltip: 'Otwórz film / opis ćwiczenia' } as any
          : { richText: rich }
        nm.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }

        // komentarz trenera
        const km = base(C_KOM)
        km.value = ex.coach_comment?.trim() || ''
        km.font = { name: FONT, size: 9.5, color: argb(BODY) }
        km.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }

        // rozgrzewka
        for (let r = 0; r < wCols; r++) {
          const w = ex.is_warmup ? ex.warmup_sets?.[r] : undefined
          const vals = [w?.reps?.trim() || '—', w?.weight_kg?.trim() || '—', w?.note?.trim() || '']
          vals.forEach((v, k) => {
            const cell = base(C_WARM + r * 3 + k, variant ? VARIANT_BG : WARM_BG)
            cell.value = num(v)
            cell.font = { name: FONT, size: 9.5, color: argb(v === '—' ? 'E3CFA8' : WARM) }
            cell.alignment = { horizontal: k === 2 ? 'left' : 'center', vertical: 'middle', wrapText: true }
            if (k === 0) cell.border = { ...(cell.border || {}), left: line('F1E2C6', 'thin') } as any
          })
        }

        // serie właściwe
        values.forEach((v, k) => {
          const cell = base(C_SERIE + k, variant ? VARIANT_BG : VALUE_BG)
          cell.value = num(v)
          const empty = v === '—'
          cell.font = { name: FONT, size: k === 0 ? 11 : 10, bold: !empty && k <= 1, color: argb(empty ? FAINT : INK) }
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          if (k === 0) cell.border = { ...(cell.border || {}), left: line(RULE, 'thin') } as any
        })
        base(C_PAD, WHITE).border = {}

        // wysokość wiersza: najdłuższa komórka
        const nameText = name.toUpperCase() + badges.map(b => `  ${b}`).join('') + (who ? `\n${who}` : '')
        let lines = Math.max(
          linesFor(nameText, widths[C_NAME], 1.12),
          linesFor(ex.coach_comment?.trim() || '', widths[C_KOM], 1.05),
          ...values.map((v, k) => linesFor(v, widths[C_SERIE + k])),
        )
        for (let r = 0; r < wCols; r++) {
          const w = ex.is_warmup ? ex.warmup_sets?.[r] : undefined
          lines = Math.max(lines, linesFor(w?.note?.trim() || '', widths[C_WARM + r * 3 + 2]))
        }
        sheet.getRow(row).height = Math.max(24, lines * 13.5 + 9)
        row++
      })
    })

    // ── wiadomość po treningu
    sheet.getRow(row).height = 12
    row++
    if (day.coach_closing?.trim()) note('PO TRENINGU', day.coach_closing.trim())

    sheet.pageSetup.printArea = `A1:${sheet.getColumn(C_END).letter}${row - 1}`
  })

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>
}
