// src/lib/coach/planPdf.ts
// Eksport planu treningowego do PDF (edytor planu → „PDF"). Strona na trening:
// blok = wiersz z literą i nazwą, pod nim ćwiczenia z tymi samymi wartościami,
// co w tabeli edytora (serie ISO / ECC / różne powtórzenia w seriach, warianty).
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
  variant_of?: number | null; variant_athlete_ids?: number[] | null
}
type PdfBlock = { id: number; day_id: number; block_name: string; block_order: number; workout_block_exercises?: PdfExercise[] }
type PdfDay = { id: number; day_name: string; day_order: number }

// Czcionki z polskimi znakami (TTF jako base64) — bez nich PDF używa Helvetiki bez ogonków
export type PdfFonts = { regular: string; bold: string }

const NAVY: [number, number, number] = [13, 27, 42]
const GOLD: [number, number, number] = [245, 200, 66]
const INK: [number, number, number] = [20, 35, 55]
const MUTED: [number, number, number] = [120, 135, 155]
const LINE: [number, number, number] = [215, 223, 233]
const BLOCK_BG: [number, number, number] = [236, 241, 248]
const WARM_HEAD: [number, number, number] = [22, 78, 52]
const WARM_BG: [number, number, number] = [240, 250, 244]
const SERIE_HEAD: [number, number, number] = [30, 58, 95]
const SERIE_BG: [number, number, number] = [239, 246, 255]
const VARIANT: [number, number, number] = [124, 58, 237]
const VARIANT_BG: [number, number, number] = [250, 247, 255]
const LINK: [number, number, number] = [30, 80, 200]

const BADGE: Record<string, { bg: [number, number, number]; fg: [number, number, number] }> = {
  ECC: { bg: [124, 45, 18], fg: [254, 215, 170] },
  HIMA: { bg: NAVY, fg: GOLD },
  PIMA: { bg: NAVY, fg: GOLD },
}

const blockLabel = (i: number) => String.fromCharCode(65 + i)
const dash = (v: string) => v || '—'

export async function buildPlanPdf(opts: {
  plan: { name: string }
  days: PdfDay[]
  blocks: PdfBlock[]
  athletes: { id: number; full_name: string }[]
  fonts?: PdfFonts | null
}): Promise<JsPDF> {
  const { plan, blocks, athletes, fonts } = opts
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
  const format = printable.some(d => warmCount(d.id) > 1) ? 'a3' : 'a4'

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format })
  let font = 'helvetica'
  if (fonts) {
    doc.addFileToVFS('Roboto-Regular.ttf', fonts.regular)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFileToVFS('Roboto-Bold.ttf', fonts.bold)
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
    font = 'Roboto'
  }
  // Helvetica nie ma polskich znaków — bez własnej czcionki zamieniamy je na ASCII
  const t = (s: string | number | null | undefined): string => {
    const v = s == null ? '' : String(s)
    return fonts ? v : v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
  }

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const m = 8
  const headerH = 16
  const available = pageW - 2 * m

  if (printable.length === 0) {
    doc.setFont(font, 'normal'); doc.setFontSize(11); doc.setTextColor(...MUTED)
    doc.text(t('Plan nie ma jeszcze żadnych ćwiczeń.'), m, 20)
  }

  printable.forEach((day, di) => {
    if (di > 0) doc.addPage()
    const wCols = warmCount(day.id)

    // ── kolumny: Blok | # | Ćwiczenie | Komentarz | [Warm-up: powt. ciężar uwagi]×n | Serie Powt. Ciężar Tempo RIR
    const wBlok = 9, wNr = 8
    const wWPowt = 13, wWKg = 13, wWNote = 22
    const serieW = [12, 20, 17, 28, 10]
    const fixed = wBlok + wNr + wCols * (wWPowt + wWKg + wWNote) + serieW.reduce((a, b) => a + b, 0)
    const flex = available - fixed
    const wName = Math.min(85, Math.max(55, flex * 0.45))
    const wComment = flex - wName
    const firstWarm = 4
    const firstSerie = 4 + wCols * 3
    const totalCols = firstSerie + 5

    const columnStyles: Record<number, any> = {
      0: { cellWidth: wBlok, halign: 'center' },
      1: { cellWidth: wNr, halign: 'center' },
      2: { cellWidth: wName, halign: 'left' },
      3: { cellWidth: wComment, halign: 'left' },
    }
    for (let r = 0; r < wCols; r++) {
      columnStyles[firstWarm + r * 3] = { cellWidth: wWPowt, halign: 'center' }
      columnStyles[firstWarm + r * 3 + 1] = { cellWidth: wWKg, halign: 'center' }
      columnStyles[firstWarm + r * 3 + 2] = { cellWidth: wWNote, halign: 'left' }
    }
    serieW.forEach((w, i) => { columnStyles[firstSerie + i] = { cellWidth: w, halign: 'center' } })

    // ── nagłówek tabeli
    const hBase = { valign: 'middle' as const }
    const serieHead = ['Serie', 'Powt.', 'Ciężar', 'Tempo', 'RIR'].map(c => ({
      content: t(c), rowSpan: wCols > 0 ? 2 : 1, styles: { ...hBase, halign: 'center', fillColor: SERIE_HEAD, textColor: [255, 255, 255] },
    }))
    const head1: any[] = [
      { content: t('Blok'), rowSpan: wCols > 0 ? 2 : 1, styles: { ...hBase, halign: 'center' } },
      { content: '#', rowSpan: wCols > 0 ? 2 : 1, styles: { ...hBase, halign: 'center' } },
      { content: t('Ćwiczenie'), rowSpan: wCols > 0 ? 2 : 1, styles: { ...hBase, halign: 'left' } },
      { content: t('Komentarz'), rowSpan: wCols > 0 ? 2 : 1, styles: { ...hBase, halign: 'left' } },
      ...Array.from({ length: wCols }, (_, r) => ({
        content: `Warm-up set ${r + 1}`, colSpan: 3, styles: { halign: 'center', fillColor: WARM_HEAD, textColor: [255, 255, 255] },
      })),
      ...serieHead,
    ]
    const head2: any[] = Array.from({ length: wCols }).flatMap(() => ['powt.', 'ciężar', 'uwagi'].map((c, i) => ({
      content: t(c), styles: { halign: i === 2 ? 'left' : 'center', fillColor: WARM_HEAD, textColor: [200, 240, 215], fontStyle: 'normal', fontSize: 6.5 },
    })))
    const head = wCols > 0 ? [head1, head2] : [head1]

    // ── wiersze
    type RowMeta = { kind: 'block' } | { kind: 'ex'; url?: string; badge?: string; variant: boolean; name: string; who: string }
    const meta: RowMeta[] = []
    const body: any[][] = []

    dayBlocks(day.id).forEach((block, bi) => {
      const exs = sortWithVariants(block.workout_block_exercises || [])
      const labels = variantLabels(exs)
      const assignedIn = (baseId?: number) => new Set(exs.filter(v => v.variant_of === baseId).flatMap(v => v.variant_athlete_ids || []))

      body.push([
        { content: blockLabel(bi), rowSpan: exs.length + 1 },
        { content: t(block.block_name || `Blok ${blockLabel(bi)}`), colSpan: totalCols - 1 },
      ])
      meta.push({ kind: 'block' })

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
          : repsLines(ex)?.join('\n') ?? (ws.length ? fmtRange(ws.map(s => s.reps)) : dash(ex.reps || ''))
        const kg = ws.length ? fmtRange(ws.map(s => s.weight_kg)) : dash(ex.weight_kg?.toString() || '')
        const tempo = ex.iso ? '—' : ex.ecc ? eccTempoLines(ex).join('\n') : ws.length ? fmtRange(ws.map(s => s.tempo)) : dash(ex.tempo || '')
        const rir = ws.length ? fmtRange(ws.map(s => s.rir)) : dash(ex.rir?.toString() || '')

        const warm = Array.from({ length: wCols }).flatMap((_, r) => {
          const w = ex.is_warmup ? ex.warmup_sets?.[r] : undefined
          return [t(w?.reps), t(w?.weight_kg), t(w?.note)]
        })

        body.push([
          labels.get(ex) ?? String(i + 1),
          who ? `${name}\n${t(who)}` : name,
          t(ex.coach_comment),
          ...warm,
          ex.sets ?? '',
          t(powt), t(kg), t(tempo), t(rir),
        ])
        meta.push({
          kind: 'ex', url: ex.exercise_url || undefined, variant: ex.variant_of != null, name, who: t(who),
          badge: ex.iso ? (ex.iso_type || 'ISO') : ex.ecc ? 'ECC' : undefined,
        })
      })
    })

    const badgeW = (b: string) => { doc.setFont(font, 'bold'); doc.setFontSize(6); return doc.getTextWidth(b) + 2.4 }

    autoTable(doc, {
      head, body,
      startY: headerH + 3,
      margin: { left: m, right: m, top: headerH + 3, bottom: 10 },
      tableWidth: available,
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: {
        font, fontSize: 8, textColor: INK, overflow: 'linebreak', valign: 'middle',
        cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
        lineColor: LINE, lineWidth: 0.15,
      },
      headStyles: { font, fillColor: NAVY, textColor: GOLD, fontStyle: 'bold', fontSize: 7, lineColor: NAVY, lineWidth: 0.15 },
      columnStyles,
      didParseCell: (data) => {
        if (data.section !== 'body') return
        const row = meta[data.row.index]
        const c = data.cell
        const isLetter = data.column.index === 0
        if (isLetter) {
          c.styles.fillColor = NAVY; c.styles.textColor = GOLD; c.styles.fontStyle = 'bold'; c.styles.fontSize = 11
          c.styles.halign = 'center'; c.styles.valign = 'middle'
          return
        }
        if (row?.kind === 'block') {
          c.styles.fillColor = BLOCK_BG; c.styles.fontStyle = 'bold'; c.styles.fontSize = 8.5; c.styles.halign = 'left'
          c.styles.cellPadding = { top: 2.2, bottom: 2.2, left: 3, right: 2 }
          return
        }
        if (row?.kind !== 'ex') return
        const col = data.column.index
        if (col === 1) { c.styles.textColor = row.variant ? VARIANT : MUTED; c.styles.fontStyle = /[a-z]/.test(String(c.raw)) ? 'bold' : 'normal' }
        if (col === 2) {
          c.styles.fontStyle = 'bold'
          if (row.url) c.styles.textColor = LINK
          // miejsce na plakietkę ECC / HIMA / PIMA przy prawej krawędzi
          if (row.badge) c.styles.cellPadding = { top: 1.8, bottom: 1.8, left: 2, right: 3 + badgeW(row.badge) }
        }
        if (col === 3) c.styles.textColor = [60, 75, 95]
        if (col === 2 && row.who) c.styles.valign = 'top'
        if (col >= firstWarm && col < firstSerie) c.styles.fillColor = WARM_BG
        if (col >= firstSerie) {
          c.styles.fillColor = SERIE_BG
          if (col === firstSerie) c.styles.fontStyle = 'bold'
          if (c.raw === '—') c.styles.textColor = [175, 185, 200]
        }
        if (row.variant && col < firstWarm) c.styles.fillColor = VARIANT_BG
      },
      willDrawCell: (data) => {
        // wariant: komórka nazwy ma dwie części — nazwa (pogrubiona) i „dla: …” (mniejsza, fioletowa,
        // dorysowana w didDrawCell); tu zostawiamy do narysowania tylko linie nazwy
        const row = meta[data.row.index]
        if (data.section !== 'body' || data.column.index !== 2 || row?.kind !== 'ex' || !row.who) return
        const c = data.cell
        doc.setFont(font, 'bold'); doc.setFontSize(8)
        const nameLines = doc.splitTextToSize(row.name, c.width - c.padding('left') - c.padding('right')).length
        c.text = c.text.slice(0, nameLines)
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return
        const row = meta[data.row.index]
        if (row?.kind !== 'ex' || data.column.index !== 2) return
        const c = data.cell
        if (row.url) doc.link(c.x, c.y, c.width, c.height, { url: row.url })
        if (row.who) {
          doc.setFont(font, 'bold'); doc.setFontSize(8)
          const nameLines = doc.splitTextToSize(row.name, c.width - c.padding('left') - c.padding('right')).length
          doc.setFont(font, 'normal'); doc.setFontSize(6.5); doc.setTextColor(...VARIANT)
          const whoLines = doc.splitTextToSize(row.who, c.width - c.padding('left') - 2)
          const y = c.y + c.padding('top') + nameLines * 3.25 + 0.6
          doc.text(whoLines, c.x + c.padding('left'), y, { baseline: 'top', lineHeightFactor: 1.2 })
        }
        // plakietka ECC / HIMA / PIMA w prawym górnym rogu komórki nazwy
        if (row.badge) {
          const b = row.badge
          const w = badgeW(b), h = 3.6
          const x = c.x + c.width - w - 1.8
          // na wysokości pierwszej linii nazwy (komórka wyśrodkowana w pionie, wariant — od góry)
          const textTop = row.who ? c.y + c.padding('top') : c.y + (c.height - c.text.length * 3.25) / 2
          const y = textTop + 3.25 / 2 - h / 2
          doc.setFillColor(...BADGE[b]?.bg ?? NAVY)
          doc.roundedRect(x, y, w, h, 0.8, 0.8, 'F')
          doc.setTextColor(...BADGE[b]?.fg ?? GOLD)
          doc.text(b, x + w / 2, y + h / 2 + 0.05, { align: 'center', baseline: 'middle' })
        }
      },
      didDrawPage: () => {
        // pasek z nazwą planu i treningu na każdej stronie
        doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, headerH, 'F')
        doc.setFillColor(...GOLD); doc.rect(0, 0, 3, headerH, 'F')
        doc.setFont(font, 'bold'); doc.setFontSize(13); doc.setTextColor(...GOLD)
        doc.text(t(day.day_name), m, 10.2)
        const dw = doc.getTextWidth(t(day.day_name))
        doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(170, 190, 215)
        doc.text(t(plan.name), m + dw + 4, 10.2)
        doc.setFontSize(7.5); doc.setTextColor(120, 145, 175)
        doc.text('Cheer LevelUP', pageW - m, 10.2, { align: 'right' })
      },
    })
  })

  // stopka: numer strony / liczba stron
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED)
    doc.text(t(plan.name), m, pageH - 4)
    doc.text(`${p} / ${pages}`, pageW - m, pageH - 4, { align: 'right' })
  }
  return doc
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
