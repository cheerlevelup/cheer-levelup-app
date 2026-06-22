// src/lib/groupPdf.ts
// Wspólne narzędzia do eksportu PDF dla grupy zorganizowanej (statystyki,
// obecność, podsumowanie treningu). Czcionki jsPDF nie mają polskich znaków —
// dlatego pl() zamienia diakrytyki na ASCII.

export function pl(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/ą/g, 'a').replace(/Ą/g, 'A')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/ę/g, 'e').replace(/Ę/g, 'E')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ń/g, 'n').replace(/Ń/g, 'N')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ś/g, 's').replace(/Ś/g, 'S')
    .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
    .replace(/ż/g, 'z').replace(/Ż/g, 'Z')
    .replace(/·/g, '-').replace(/–/g, '-').replace(/—/g, '-')
    .replace(/„|”|“/g, '"').replace(/»|«/g, '>')
}

export async function loadPdf() {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  return { jsPDF, autoTable }
}

// Granatowy pasek nagłówka z nazwą grupy + tytułem; zwraca Y pod nagłówkiem (mm).
export function drawHeaderBar(doc: any, group: string, title: string, subtitle?: string): number {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(13, 27, 42)
  doc.rect(0, 0, pageW, 20, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(245, 200, 66)
  doc.setFontSize(7.5)
  doc.text(pl(group).toUpperCase(), 10, 8)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text(pl(title), 10, 15.5)
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(170, 180, 200)
    doc.setFontSize(8)
    doc.text(pl(subtitle), pageW - 10, 15.5, { align: 'right' })
  }
  doc.setTextColor(0, 0, 0)
  return 26
}

// Stopka z datą wygenerowania — wołaj w didDrawPage autoTable.
export function drawFooter(doc: any) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const d = new Date().toLocaleDateString('pl-PL')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 160)
  doc.text(`Cheer LevelUP - wygenerowano ${d}`, pageW / 2, pageH - 6, { align: 'center' })
  doc.setTextColor(0, 0, 0)
}

// Renderuje element <svg> ze strony do PNG (data URL) — do wstawienia w PDF.
// Zwraca też proporcje, by zachować skalę przy addImage.
export async function svgToPng(svgEl: SVGSVGElement, scale = 2): Promise<{ dataUrl: string; w: number; h: number }> {
  const vb = svgEl.viewBox?.baseVal
  const w = vb && vb.width ? vb.width : (svgEl.clientWidth || 760)
  const h = vb && vb.height ? vb.height : (svgEl.clientHeight || 340)
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  const xml = new XMLSerializer().serializeToString(clone)
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  const img = new Image()
  img.width = w; img.height = h
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('svg render'))
    img.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { dataUrl: canvas.toDataURL('image/png'), w, h }
}

// Wspólny styl tabel autoTable (granatowy nagłówek, drobna czcionka).
export const TABLE_STYLES = {
  styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, lineColor: [232, 236, 242] as [number, number, number], lineWidth: 0.1, textColor: [13, 27, 42] as [number, number, number] },
  headStyles: { fillColor: [13, 27, 42] as [number, number, number], textColor: [245, 200, 66] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8 },
  alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
}
