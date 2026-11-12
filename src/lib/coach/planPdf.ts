// src/lib/coach/planPdf.ts
// Eksport planu treningowego do PDF (edytor planu → „PDF"). Strona na trening:
// jasny nagłówek, bloki jako sekcje (litera w kółku + nazwa), ćwiczenia A1, A2…
// z tymi samymi wartościami co w tabeli edytora (serie ISO / ECC / różne powtórzenia
// w seriach, warianty). Tabela jest skalowana tak, żeby trening wypełniał stronę.
/* eslint-disable @typescript-eslint/no-explicit-any -- opcje i komórki jspdf-autotable */
import type { jsPDF as JsPDF } from 'jspdf'
import { sortWithVariants, variantLabels } from '../exerciseVariants'
import { fmtRange, isoPowtLines, repsLines, eccTempoLines, type PlanWorkSet } from './planFormat'

type PdfExercise = {
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
type PdfBlock = { id: number; day_id: number; block_name: string; block_order: number; workout_block_exercises?: PdfExercise[] }
type PdfDay = { id: number; day_name: string; day_order: number }

// Czcionki z polskimi znakami (TTF jako base64) — bez nich PDF używa Helvetiki bez ogonków
export type PdfFonts = { regular: string; bold: string }

type RGB = [number, number, number]

// Motywy wyglądu PDF — kolory + układ nagłówka strony, sekcji bloków i pasków wierszy
export type PdfTheme = 'jasny' | 'sportowy' | 'minimalny' | 'swiezy'
type ThemeDef = {
  navy: RGB; gold: RGB; ink: RGB; body: RGB; muted: RGB; faint: RGB; rule: RGB
  sectionBg: RGB; valueBg: RGB | null; zebra: RGB | null
  headerBand: RGB | null            // pełny pasek nagłówka strony (null = jasny nagłówek z akcentem)
  section: 'light' | 'solid' | 'line'
  sectionSolid: RGB                 // tło sekcji bloku przy 'solid'
  circleBg: RGB; circleFg: RGB
  headRule: RGB
}
const THEMES: Record<PdfTheme, ThemeDef> = {
  jasny: {
    navy: [13, 27, 42], gold: [232, 168, 56], ink: [24, 36, 52], body: [70, 84, 104], muted: [138, 150, 168], faint: [196, 204, 216], rule: [228, 233, 240],
    sectionBg: [246, 248, 251], valueBg: [250, 251, 253], zebra: null, headerBand: null, section: 'light', sectionSolid: [13, 27, 42],
    circleBg: [13, 27, 42], circleFg: [232, 168, 56], headRule: [13, 27, 42],
  },
  sportowy: {
    navy: [15, 30, 54], gold: [242, 183, 5], ink: [22, 32, 48], body: [72, 84, 102], muted: [130, 143, 162], faint: [190, 199, 212], rule: [224, 229, 237],
    sectionBg: [240, 243, 248], valueBg: null, zebra: [246, 248, 251], headerBand: [15, 30, 54], section: 'solid', sectionSolid: [28, 47, 79],
    circleBg: [242, 183, 5], circleFg: [15, 30, 54], headRule: [242, 183, 5],
  },
  minimalny: {
    navy: [28, 28, 32], gold: [28, 28, 32], ink: [24, 24, 28], body: [88, 88, 96], muted: [140, 140, 148], faint: [205, 205, 210], rule: [232, 232, 236],
    sectionBg: [255, 255, 255], valueBg: null, zebra: [249, 249, 250], headerBand: null, section: 'line', sectionSolid: [28, 28, 32],
    circleBg: [28, 28, 32], circleFg: [255, 255, 255], headRule: [28, 28, 32],
  },
  swiezy: {
    navy: [15, 52, 67], gold: [13, 148, 136], ink: [20, 42, 52], body: [70, 92, 102], muted: [126, 148, 158], faint: [190, 208, 214], rule: [222, 234, 238],
    sectionBg: [236, 247, 246], valueBg: [247, 251, 251], zebra: null, headerBand: null, section: 'light', sectionSolid: [15, 52, 67],
    circleBg: [13, 148, 136], circleFg: [255, 255, 255], headRule: [13, 148, 136],
  },
}
let TH: ThemeDef = THEMES.jasny
let NAVY: RGB = TH.navy
let GOLD: RGB = TH.gold
let INK: RGB = TH.ink
let BODY: RGB = TH.body
let MUTED: RGB = TH.muted
let FAINT: RGB = TH.faint
let RULE: RGB = TH.rule
let SECTION_BG: RGB = TH.sectionBg
const VARIANT: RGB = [124, 58, 237]
const VARIANT_BG: RGB = [251, 249, 255]
const LINK: RGB = [30, 90, 200]
const WARM: RGB = [168, 106, 18]
function applyTheme(name: PdfTheme) {
  TH = THEMES[name] || THEMES.jasny
  ;({ navy: NAVY, gold: GOLD, ink: INK, body: BODY, muted: MUTED, faint: FAINT, rule: RULE, sectionBg: SECTION_BG } = TH)
}

const BADGE: Record<string, { bg: RGB; fg: RGB }> = {
  ECC: { bg: [253, 236, 222], fg: [154, 52, 18] },
  HIMA: { bg: [232, 236, 243], fg: [13, 27, 42] },
  PIMA: { bg: [232, 236, 243], fg: [13, 27, 42] },
  INDYW: { bg: [224, 247, 250], fg: [14, 116, 144] },
}

const blockLabel = (i: number) => String.fromCharCode(65 + i)
const dash = (v: string) => v || '—'

type DayCtx = {
  font: string
  t: (s: string | number | null | undefined) => string
  plan: { name: string }
  athletes: { id: number; full_name: string }[]
  blocks: PdfBlock[]
  logo?: string | null   // logo Cheer LevelUP (PNG jako data URL) w nagłówku
}

export async function buildPlanPdf(opts: {
  plan: { name: string }
  days: PdfDay[]
  blocks: PdfBlock[]
  athletes: { id: number; full_name: string }[]
  fonts?: PdfFonts | null
  theme?: PdfTheme
  logo?: string | null
}): Promise<JsPDF> {
  const { plan, blocks, athletes, fonts } = opts
  applyTheme(opts.theme ?? 'sportowy')
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const days = [...opts.days].sort((a, b) => a.day_order - b.day_order)
  const dayBlocks = (dayId: number) => blocks
    .filter(b => b.day_id === dayId && (b.workout_block_exercises?.length ?? 0) > 0)
    .sort((a, b) => a.block_order - b.block_order)
  const printable = days.filter(d => dayBlocks(d.id).length > 0)
  // serie rozgrzewkowe liczą się tylko z is_warmup (tak jak w tabeli edytora)
  const warmCount = (dayId: number) => Math.max(0, ...dayBlocks(dayId).flatMap(b =>
    (b.workout_block_exercises || []).map(e => (e.is_warmup ? e.warmup_sets?.length ?? 0 : 0))))
  const format = printable.some(d => warmCount(d.id) > 2) ? 'a3' : 'a4'
  const newDoc = () => new jsPDF({ orientation: 'landscape', unit: 'mm', format })

  const doc = newDoc()
  const { font, t } = registerPdfFonts(doc, fonts)
  const ctx: DayCtx = { font, t, plan, athletes, blocks, logo: opts.logo }
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  if (printable.length === 0) {
    doc.setFont(font, 'normal'); doc.setFontSize(11); doc.setTextColor(...MUTED)
    doc.text(t('Plan nie ma jeszcze żadnych ćwiczeń.'), 12, 20)
    return doc
  }

  // Skala treningu: największa, przy której mieści się na jednej stronie (sprawdzane na
  // roboczym dokumencie); długi trening — skala minimalna i podział na strony
  const MIN_S = 0.82, MAX_S = 1.7
  const fits = (day: PdfDay, s: number) => {
    const scratch = newDoc()
    registerPdfFonts(scratch, fonts)
    const r = drawDay(scratch, autoTable, ctx, day, dayBlocks(day.id), warmCount(day.id), s)
    return scratch.getNumberOfPages() === 1 && r.finalY <= r.limitY
  }
  const scaleFor = (day: PdfDay) => {
    if (!fits(day, MIN_S)) return MIN_S
    if (fits(day, MAX_S)) return MAX_S
    let lo = MIN_S, hi = MAX_S
    for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (fits(day, mid)) lo = mid; else hi = mid }
    return lo
  }

  printable.forEach((day, di) => {
    if (di > 0) doc.addPage()
    drawDay(doc, autoTable, ctx, day, dayBlocks(day.id), warmCount(day.id), scaleFor(day))
  })

  // stopka: plan · numer strony
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(12, pageH - 8, pageW - 12, pageH - 8)
    doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED)
    doc.text(t(`${plan.name} · Cheer Level Up — Cheer Body Training Programs`), 12, pageH - 4.5)
    doc.text(`${p} / ${pages}`, pageW - 12, pageH - 4.5, { align: 'right' })
  }
  return doc
}

// Jeden trening na stronie (albo kilku, gdy się nie mieści). s — skala czcionek i odstępów.
function drawDay(
  doc: JsPDF,
  autoTable: (doc: JsPDF, options: any) => void,
  ctx: DayCtx,
  day: PdfDay,
  blocks: PdfBlock[],
  wCols: number,
  s: number,
): { finalY: number; limitY: number } {
  const { font, t, plan, athletes } = ctx
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const m = 12
  const headerH = TH.headerBand ? 28 : 21
  const bottom = 12
  const available = pageW - 2 * m
  const fs = 8 * s                     // podstawowy rozmiar tekstu
  const lineH = fs * 0.3528 * 1.15     // wysokość linii w mm
  const padV = 1.5 * s

  // ── kolumny: # | Ćwiczenie | Komentarz | [R: powt. ciężar uwagi]×n | Serie Powt. Ciężar Tempo RIR
  const wNr = 11 * Math.min(s, 1.3)
  const wWPowt = 12, wWKg = 13, wWNote = 20
  const serieW = [13, 22, 20, 26, 11].map(w => w * Math.min(s, 1.25))
  const fixed = wNr + wCols * (wWPowt + wWKg + wWNote) + serieW.reduce((a, b) => a + b, 0)
  const flex = available - fixed
  const wName = Math.min(95, Math.max(58, flex * 0.46))
  const wComment = flex - wName
  const firstWarm = 3
  const firstSerie = 3 + wCols * 3
  const totalCols = firstSerie + 5

  const columnStyles: Record<number, any> = {
    0: { cellWidth: wNr, halign: 'left' },
    1: { cellWidth: wName, halign: 'left' },
    2: { cellWidth: wComment, halign: 'left' },
  }
  for (let r = 0; r < wCols; r++) {
    columnStyles[firstWarm + r * 3] = { cellWidth: wWPowt, halign: 'center' }
    columnStyles[firstWarm + r * 3 + 1] = { cellWidth: wWKg, halign: 'center' }
    columnStyles[firstWarm + r * 3 + 2] = { cellWidth: wWNote, halign: 'left' }
  }
  serieW.forEach((w, i) => { columnStyles[firstSerie + i] = { cellWidth: w, halign: 'center' } })

  // ── nagłówek tabeli: małe, wersalikowe etykiety bez tła
  const hc = (content: string, halign: 'left' | 'center', extra: Record<string, unknown> = {}) => ({ content: t(content).toUpperCase(), styles: { halign, ...extra } })
  const head1: any[] = [
    hc('#', 'left', wCols > 0 ? { valign: 'bottom' } : {}),
    hc('Ćwiczenie', 'left', wCols > 0 ? { valign: 'bottom' } : {}),
    hc('Komentarz', 'left', wCols > 0 ? { valign: 'bottom' } : {}),
    ...Array.from({ length: wCols }, (_, r) => ({ content: t(`Rozgrzewka ${r + 1}`).toUpperCase(), colSpan: 3, styles: { halign: 'center', textColor: WARM } })),
    ...['Serie', 'Powt.', 'Ciężar', 'Tempo', 'RIR'].map(c => hc(c, 'center', wCols > 0 ? { valign: 'bottom' } : {})),
  ]
  if (wCols > 0) head1.forEach((c, i) => { if (i < 3 || i >= 3 + wCols) c.rowSpan = 2 })
  const head2: any[] = Array.from({ length: wCols }).flatMap(() => ['powt.', 'ciężar', 'uwagi'].map((c, i) => ({
    content: t(c), styles: { halign: i === 2 ? 'left' : 'center', textColor: WARM, fontStyle: 'normal', fontSize: fs * 0.78 },
  })))
  const head = wCols > 0 ? [head1, head2] : [head1]

  // ── wiersze
  type RowMeta = { kind: 'block'; letter: string; name: string } | { kind: 'ex'; url?: string; badges: string[]; variant: boolean; name: string; who: string; last: boolean; odd: boolean }
  const meta: RowMeta[] = []
  const body: any[][] = []

  blocks.forEach((block, bi) => {
    const exs = sortWithVariants(block.workout_block_exercises || [])
    const labels = variantLabels(exs)
    const assignedIn = (baseId?: number) => new Set(exs.filter(v => v.variant_of === baseId).flatMap(v => v.variant_athlete_ids || []))
    const letter = blockLabel(bi)
    const blockName = t(block.block_name && block.block_name.trim() !== `Blok ${letter}` ? block.block_name : '')

    body.push([{ content: '', colSpan: totalCols }])
    meta.push({ kind: 'block', letter, name: blockName })

    exs.forEach((ex, i) => {
      const name = t((ex.exercise?.name || ex.exercise_code || '').replace(/-/g, ' '))
      // warianty: kto robi który (baza = wszyscy nieprzypisani do innego wariantu)
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

      const ws = ex.work_sets || []
      const powt = ex.iso ? isoPowtLines(ex).join('\n')
        : repsLines(ex)?.join('\n') ?? (ws.length ? fmtRange(ws.map(w => w.reps)) : dash(ex.reps || ''))
      const kg = ws.length ? fmtRange(ws.map(w => w.weight_kg)) : dash(ex.weight_kg?.toString() || '')
      const tempo = ex.iso ? '—' : ex.ecc ? eccTempoLines(ex).join('\n') : ws.length ? fmtRange(ws.map(w => w.tempo)) : dash(ex.tempo || '')
      const rir = ws.length ? fmtRange(ws.map(w => w.rir)) : dash(ex.rir?.toString() || '')

      const warm = Array.from({ length: wCols }).flatMap((_, r) => {
        const w = ex.is_warmup ? ex.warmup_sets?.[r] : undefined
        return [t(w?.reps) || '—', t(w?.weight_kg) || '—', t(w?.note)]
      })

      body.push([
        `${letter}${labels.get(ex) ?? String(i + 1)}`,
        who ? `${name}\n${t(who)}` : name,
        t(ex.coach_comment),
        ...warm,
        ex.sets ?? '',
        t(powt), t(kg), t(tempo), t(rir),
      ])
      const badges = [ex.iso ? (ex.iso_type || 'ISO') : ex.ecc ? 'ECC' : '', ex.is_individual ? 'INDYW' : ''].filter(Boolean)
      meta.push({ kind: 'ex', url: ex.exercise_url || undefined, variant: ex.variant_of != null, name, who: t(who), badges, last: i === exs.length - 1, odd: i % 2 === 1 })
    })
  })

  const badgeFs = fs * 0.72
  const spaced = (str: string, x: number, y: number, cs: number, opt: Record<string, unknown> = {}) => {
    doc.text(str, x, y, { charSpace: cs, ...opt })
    return doc.getTextWidth(str) + cs * Math.max(0, str.length - 1)
  }
  const badgeW = (b: string) => { doc.setFont(font, 'bold'); doc.setFontSize(badgeFs); return doc.getTextWidth(b) + 2.6 * s }
  const badgesW = (bs: string[]) => bs.reduce((a, b) => a + badgeW(b) + 1.2, 0)
  const sectionPadTop = 3.2 * s

  autoTable(doc, {
    head, body,
    startY: headerH + 4,
    margin: { left: m, right: m, top: headerH + 4, bottom },
    tableWidth: available,
    theme: 'plain',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: {
      font, fontSize: fs, textColor: INK, overflow: 'linebreak', valign: 'middle',
      cellPadding: { top: padV, bottom: padV, left: 2, right: 2 },
      lineWidth: 0,
    },
    headStyles: {
      font, fontStyle: 'bold', fontSize: fs * 0.72, textColor: MUTED, fillColor: false,
      cellPadding: { top: 1.2, bottom: 1.6, left: 2, right: 2 }, valign: 'bottom',
    },
    columnStyles,
    didParseCell: (data: any) => {
      const c = data.cell
      if (data.section === 'head') return
      const row = meta[data.row.index]
      if (row?.kind === 'block') {
        c.styles.minCellHeight = 7.5 * s + sectionPadTop
        c.styles.fillColor = false
        return
      }
      if (row?.kind !== 'ex') return
      const col = data.column.index
      if (TH.zebra && row.odd) c.styles.fillColor = TH.zebra
      if (row.variant) c.styles.fillColor = VARIANT_BG
      if (col === 0) { c.styles.textColor = row.variant ? VARIANT : MUTED; c.styles.fontStyle = 'bold'; c.styles.fontSize = fs * 0.9 }
      if (col === 1) {
        c.styles.fontStyle = 'bold'
        if (row.url) c.styles.textColor = LINK
        if (row.badges.length) c.styles.cellPadding = { top: padV, bottom: padV, left: 2, right: 3 + badgesW(row.badges) }
        if (row.who) c.styles.valign = 'top'
      }
      if (col === 2) { c.styles.textColor = BODY; c.styles.fontSize = fs * 0.92 }
      if (col >= firstWarm && col < firstSerie) { c.styles.textColor = WARM; c.styles.fontSize = fs * 0.92 }
      if (col >= firstSerie) {
        if (!row.variant && TH.valueBg && !(TH.zebra && row.odd)) c.styles.fillColor = TH.valueBg
        c.styles.fontStyle = col === firstSerie || col === firstSerie + 1 ? 'bold' : 'normal'
        if (c.raw === '—') { c.styles.textColor = FAINT; c.styles.fontStyle = 'normal' }
      }
      if (c.raw === '—' && col >= firstWarm && col < firstSerie) c.styles.textColor = FAINT
    },
    willDrawCell: (data: any) => {
      // wariant: w komórce nazwy rysujemy tylko linie nazwy, „dla: …” dorysowujemy niżej mniejszą czcionką
      const row = meta[data.row.index]
      if (data.section !== 'body' || data.column.index !== 1 || row?.kind !== 'ex' || !row.who) return
      const c = data.cell
      doc.setFont(font, 'bold'); doc.setFontSize(fs)
      const nameLines = doc.splitTextToSize(row.name, c.width - c.padding('left') - c.padding('right')).length
      c.text = c.text.slice(0, nameLines)
    },
    didDrawCell: (data: any) => {
      const c = data.cell
      if (data.section === 'head') {
        // jedna linia pod nagłówkiem tabeli
        if (data.row.index === head.length - 1 || c.rowSpan > 1) { doc.setDrawColor(...TH.headRule); doc.setLineWidth(0.5); doc.line(c.x, c.y + c.height, c.x + c.width, c.y + c.height) }
        return
      }
      const row = meta[data.row.index]
      if (row?.kind === 'block') {
        // sekcja bloku: litera w złotym kółku + nazwa, pod spodem cienka linia
        const y = c.y + sectionPadTop
        const h = c.height - sectionPadTop
        const solid = TH.section === 'solid'
        if (TH.section !== 'line') { doc.setFillColor(...(solid ? TH.sectionSolid : SECTION_BG)); doc.rect(c.x, y, c.width, h, 'F') }
        const r = 2.7 * s
        const cx = c.x + 2 + r, cy = y + h / 2
        doc.setFillColor(...TH.circleBg); doc.circle(cx, cy, r, 'F')
        doc.setFont(font, 'bold'); doc.setFontSize(fs * 1.05); doc.setTextColor(...TH.circleFg)
        doc.text(row.letter, cx, cy + 0.1, { align: 'center', baseline: 'middle' })
        doc.setTextColor(...(solid ? [255, 255, 255] as RGB : NAVY))
        const tw = spaced(`BLOK ${row.letter}`, cx + r + 2.8, cy + 0.1, 0.55 * s, { baseline: 'middle' })
        if (row.name) {
          doc.setFont(font, 'normal'); doc.setFontSize(fs * 0.95); doc.setTextColor(...(solid ? GOLD : MUTED))
          spaced(row.name.toUpperCase(), cx + r + 2.8 + tw + 3.5, cy + 0.1, 0.45 * s, { baseline: 'middle' })
        }
        if (!solid) { doc.setDrawColor(...(TH.section === 'line' ? NAVY : GOLD)); doc.setLineWidth(TH.section === 'line' ? 0.6 : 0.5); doc.line(c.x, y + h, c.x + c.width, y + h) }
        return
      }
      if (row?.kind !== 'ex') return
      // cienka linia między ćwiczeniami (bez ostatniego w bloku)
      if (!row.last) { doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(c.x, c.y + c.height, c.x + c.width, c.y + c.height) }
      if (data.column.index !== 1) return
      if (row.url) doc.link(c.x, c.y, c.width, c.height, { url: row.url })
      if (row.who) {
        doc.setFont(font, 'bold'); doc.setFontSize(fs)
        const nameLines = doc.splitTextToSize(row.name, c.width - c.padding('left') - c.padding('right')).length
        doc.setFont(font, 'normal'); doc.setFontSize(fs * 0.8); doc.setTextColor(...VARIANT)
        const whoLines = doc.splitTextToSize(row.who, c.width - c.padding('left') - 2)
        const y = c.y + c.padding('top') + nameLines * lineH + 0.5
        doc.text(whoLines, c.x + c.padding('left'), y, { baseline: 'top', lineHeightFactor: 1.2 })
      }
      // plakietki ECC / HIMA / PIMA / INDYW przy prawej krawędzi, na wysokości pierwszej linii nazwy
      if (row.badges.length) {
        const h = 3.4 * s
        const textTop = row.who ? c.y + c.padding('top') : c.y + (c.height - c.text.length * lineH) / 2
        const y = textTop + lineH / 2 - h / 2
        let x = c.x + c.width - 1.8
        for (const b of [...row.badges].reverse()) {
          const w = badgeW(b)
          x -= w
          doc.setFillColor(...(BADGE[b]?.bg ?? BADGE.HIMA.bg))
          doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
          doc.setFont(font, 'bold'); doc.setFontSize(badgeFs); doc.setTextColor(...(BADGE[b]?.fg ?? NAVY))
          doc.text(b, x + w / 2, y + h / 2 + 0.05, { align: 'center', baseline: 'middle' })
          x -= 1.2
        }
      }
    },
    didDrawPage: () => {
      // nagłówek strony: nazwa treningu i plan — pełny pasek albo jasny z akcentem
      if (TH.headerBand) {
        const bandH = headerH - 4
        doc.setFillColor(...TH.headerBand); doc.rect(0, 0, pageW, bandH, 'F')
        // ukośne pasy z prawej: jaśniejszy granat + złota linia
        const sx = pageW * 0.64, sk = bandH * 0.55
        doc.setFillColor(28, 50, 86); doc.lines([[pageW - sx + sk, 0], [0, bandH], [-(pageW - sx), 0]], sx, 0, [1, 1], 'F', true)
        doc.setFillColor(...GOLD); doc.lines([[2.2, 0], [-sk, bandH], [-2.2, 0]], sx - 1.4, 0, [1, 1], 'F', true)
        doc.lines([[1, 0], [-sk, bandH], [-1, 0]], sx - 5, 0, [1, 1], 'F', true)
        doc.setFillColor(...GOLD); doc.rect(0, bandH, pageW, 1.1, 'F')
        // logo w białym kółku
        let x = m
        if (ctx.logo) {
          const d = bandH - 4.5
          // białe kafelki z zaokrąglonymi rogami — plik logo ma białe tło
          doc.setFillColor(255, 255, 255); doc.roundedRect(x - 0.8, bandH / 2 - d / 2 - 0.8, d + 1.6, d + 1.6, 2, 2, 'F')
          try { doc.addImage(ctx.logo, 'PNG', x, bandH / 2 - d / 2, d, d, 'cheer-logo', 'FAST') } catch { /* brak logo — sam tekst */ }
          x += d + 5
        }
        doc.setFont(font, 'bold'); doc.setFontSize(19); doc.setTextColor(255, 255, 255)
        spaced(t(day.day_name).toUpperCase(), x, bandH / 2 - 0.4, 0.5)
        doc.setFont(font, 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GOLD)
        spaced(t(`PLAN TRENINGOWY  ·  ${plan.name}`).toUpperCase(), x, bandH / 2 + 5.2, 0.9)
        const rx = pageW - m
        doc.setFont(font, 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
        const w1 = doc.getTextWidth('CHEER LEVEL UP') + 1.2 * 13
        doc.text('CHEER LEVEL UP', rx - w1, bandH / 2 - 0.2, { charSpace: 1.2 })
        doc.setFont(font, 'normal'); doc.setFontSize(6.3); doc.setTextColor(165, 182, 208)
        const w2 = doc.getTextWidth('CHEER BODY TRAINING PROGRAMS') + 0.55 * 27
        doc.text('CHEER BODY TRAINING PROGRAMS', rx - w2, bandH / 2 + 4.4, { charSpace: 0.55 })
        return
      }
      doc.setFillColor(...GOLD); doc.rect(m, 9.5, 1.4, 8, 'F')
      doc.setFont(font, 'bold'); doc.setFontSize(17); doc.setTextColor(...NAVY)
      doc.text(t(day.day_name), m + 4, 15.6)
      const dw = doc.getTextWidth(t(day.day_name))
      doc.setFont(font, 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED)
      doc.text(t(plan.name), m + 4 + dw + 4, 15.6)
      doc.setFont(font, 'bold'); doc.setFontSize(8); doc.setTextColor(...NAVY)
      doc.text('CHEER LEVELUP', pageW - m, 13.2, { align: 'right' })
      doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED)
      doc.text(t('plan treningowy'), pageW - m, 16.8, { align: 'right' })
      doc.setDrawColor(...RULE); doc.setLineWidth(0.3); doc.line(m, headerH, pageW - m, headerH)
    },
  })
  const finalY = (doc as any).lastAutoTable?.finalY ?? 0
  return { finalY, limitY: pageH - bottom }
}

// Rejestruje Roboto w dokumencie; zwraca nazwę czcionki i funkcję tekstu —
// Helvetica nie ma polskich znaków, więc bez własnej czcionki zamienia je na ASCII
export function registerPdfFonts(doc: JsPDF, fonts?: PdfFonts | null) {
  if (fonts) {
    doc.addFileToVFS('Roboto-Regular.ttf', fonts.regular)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFileToVFS('Roboto-Bold.ttf', fonts.bold)
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  }
  const t = (s: string | number | null | undefined): string => {
    const v = s == null ? '' : String(s)
    return fonts ? v : v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
  }
  return { font: fonts ? 'Roboto' : 'helvetica', t }
}

// Czcionki z /public/fonts (pobierane tylko przy eksporcie); błąd → PDF bez ogonków
export async function loadPdfFonts(): Promise<PdfFonts | null> {
  try {
    const toB64 = async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(url)
      const bytes = new Uint8Array(await res.arrayBuffer())
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(bin)
    }
    const [regular, bold] = await Promise.all([toB64('/fonts/Roboto-Regular.ttf'), toB64('/fonts/Roboto-Bold.ttf')])
    return { regular, bold }
  } catch (e) {
    console.error('Nie udało się wczytać czcionek PDF', e)
    return null
  }
}

// Logo Cheer LevelUP do nagłówka PDF (public/pdf-logo.png); błąd → PDF bez logo
export async function loadPdfLogo(): Promise<string | null> {
  try {
    const res = await fetch('/pdf-logo.png')
    if (!res.ok) throw new Error('pdf-logo.png')
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  } catch (e) {
    console.error('Nie udało się wczytać logo PDF', e)
    return null
  }
}
