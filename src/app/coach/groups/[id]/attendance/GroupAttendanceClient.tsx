'use client'
// src/app/coach/groups/[id]/attendance/GroupAttendanceClient.tsx
// Obecność — daty × zawodniczki, statystyki opuszczonych treningów, eksport PDF.
import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { formatDatePl } from '@/lib/groupTraining'
import { loadPdf, pl, drawHeaderBar, drawFooter, TABLE_STYLES } from '@/lib/groupPdf'
import { coachTheme } from '@/lib/coach-theme'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, Card, Button, Field } from '@/components/coach/ui'

// coachTheme nie definiuje kolorów danger/success — to są ustalone w całym
// coach-theme.css literały (.coach-att-cell, .coach-missed-count itp.), więc
// trzymamy je tu jako lokalne stałe zamiast zgadywać nazwę tokenu.
const DANGER = '#c23b3b'
const SUCCESS = '#1f9d64'
const WARN = '#c07f1e'
const DANGER_BG: [number, number, number] = [253, 237, 236]
const DANGER_RGB: [number, number, number] = [194, 59, 59]
const SUCCESS_BG: [number, number, number] = [233, 249, 240]
const SUCCESS_RGB: [number, number, number] = [31, 157, 100]

type Group = { id: number; name: string }
type Athlete = { id: number; full_name: string }
type Training = { id: number; group_id: number; training_date: string; absent_athlete_ids?: number[] | null }

interface Props {
  group: Group
  athletes: Athlete[]
  trainings: Training[]
}

export default function GroupAttendanceClient({ group, athletes, trainings }: Props) {
  const sortedTrainings = useMemo(
    () => [...trainings].sort((a, b) => a.training_date.localeCompare(b.training_date)),
    [trainings]
  )
  const allDates = sortedTrainings.map(t => t.training_date)
  const [from, setFrom] = useState<string>(allDates[0] || '')
  const [to, setTo] = useState<string>(allDates[allDates.length - 1] || '')

  const rangeTrainings = useMemo(
    () => sortedTrainings.filter(t => (!from || t.training_date >= from) && (!to || t.training_date <= to)),
    [sortedTrainings, from, to]
  )

  const absentSet = (t: Training) => new Set<number>((t.absent_athlete_ids || []).map(Number))

  const attendance = useMemo(() => {
    const total = rangeTrainings.length
    return athletes.map(a => {
      let absences = 0
      for (const t of rangeTrainings) if (absentSet(t).has(a.id)) absences++
      const present = total - absences
      return { athlete: a, absences, present, total, pct: total ? Math.round((present / total) * 100) : null }
    })
  }, [athletes, rangeTrainings])

  const topAbsent = useMemo(
    () => [...attendance].filter(r => r.total > 0).sort((a, b) => b.absences - a.absences),
    [attendance]
  )
  const maxAbsences = topAbsent[0]?.absences ?? 0

  const pctColor = (pct: number | null) => pct == null ? coachTheme.mutedLight : pct >= 90 ? coachTheme.green : pct >= 75 ? WARN : DANGER

  const [exporting, setExporting] = useState(false)

  async function exportAttendancePdf() {
    if (exporting) return
    setExporting(true)
    try {
      const { jsPDF, autoTable } = await loadPdf()
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const tot = attendance.reduce((a, r) => a + r.total, 0)
      const pres = attendance.reduce((a, r) => a + r.present, 0)
      const groupPct = tot ? Math.round((pres / tot) * 100) : null
      let y = drawHeaderBar(doc, group.name, 'Obecnosc',
        `${from || '—'} - ${to || '—'} · ${rangeTrainings.length} treningow`)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
      const top = maxAbsences > 0 ? topAbsent.filter(r => r.absences === maxAbsences).map(r => r.athlete.full_name).join(', ') : 'brak'
      doc.text(pl(`Frekwencja grupy: ${groupPct == null ? '—' : groupPct + '%'} (${pres}/${tot})   |   Najwiecej opuszczonych: ${top}${maxAbsences > 0 ? ` (${maxAbsences}x)` : ''}`), 14, y)
      y += 6
      autoTable(doc, {
        startY: y,
        head: [['Zawodniczka', 'Nieobecnosci', 'Treningi', 'Frekwencja']],
        body: attendance.map(r => [pl(r.athlete.full_name), String(r.absences), String(r.total), r.pct == null ? '—' : `${r.pct}%`]),
        ...TABLE_STYLES,
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
        didDrawPage: () => drawFooter(doc),
      })
      y = (doc as any).lastAutoTable.finalY + 8
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
      doc.text('Siatka obecnosci ( . obecna / X nieobecna )', 14, y)
      y += 3
      const absentByCell: boolean[][] = athletes.map(a => rangeTrainings.map(t => absentSet(t).has(a.id)))
      autoTable(doc, {
        startY: y,
        head: [['Zawodniczka', ...rangeTrainings.map(t => t.training_date.slice(5))]],
        body: athletes.map((a, ai) => [pl(a.full_name), ...rangeTrainings.map((_, ti) => absentByCell[ai][ti] ? 'X' : '.')]),
        ...TABLE_STYLES,
        styles: { ...TABLE_STYLES.styles, fontSize: 7, halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 38 } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index > 0) {
            const absent = absentByCell[data.row.index][data.column.index - 1]
            data.cell.styles.fillColor = absent ? DANGER_BG : SUCCESS_BG
            data.cell.styles.textColor = absent ? DANGER_RGB : SUCCESS_RGB
            data.cell.styles.fontStyle = 'bold'
          }
        },
        didDrawPage: () => drawFooter(doc),
      })
      doc.save(`obecnosc_${(from || '').replace(/-/g, '')}_${(to || '').replace(/-/g, '')}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <SetPageMeta title="Obecność" backHref={`/coach/groups/${group.id}`} backLabel={group.name} />
      <TabsNav items={[
        { key: 'treningi', label: 'Treningi', href: `/coach/groups/${group.id}` },
        { key: 'plan', label: 'Plan', href: `/coach/groups/${group.id}/plan` },
        { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${group.id}/stats` },
        { key: 'obecnosc', label: 'Obecność', href: `/coach/groups/${group.id}/attendance` },
        { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${group.id}/athletes` },
        { key: 'testy', label: 'Testy', href: `/coach/groups/${group.id}/tests` },
      ]} />
      <div className="coach-content">
        {athletes.length === 0 ? (
          <Card><div className="coach-empty-list">Brak zawodniczek w grupie.</div></Card>
        ) : trainings.length === 0 ? (
          <Card><div className="coach-empty-list">Brak treningów — najpierw przeprowadź lub wgraj trening.</div></Card>
        ) : (
          <>
            <div className="coach-toolbar">
              <div className="coach-toolbar-right" style={{ marginLeft: 'auto' }}>
                <button className="coach-btn-pdf" onClick={exportAttendancePdf} disabled={exporting}>
                  <Download /> {exporting ? 'Generuję PDF...' : 'Pobierz PDF'}
                </button>
              </div>
            </div>

            <div className="coach-date-filter-card">
              <Field label="Od">
                <input type="date" value={from} min={allDates[0]} max={to} onChange={e => setFrom(e.target.value)} />
              </Field>
              <Field label="Do">
                <input type="date" value={to} min={from} max={allDates[allDates.length - 1]} onChange={e => setTo(e.target.value)} />
              </Field>
              <Button variant="ghost" size="small" onClick={() => { setFrom(allDates[0] || ''); setTo(allDates[allDates.length - 1] || '') }}>
                Cały okres
              </Button>
              <span className="coach-date-filter-info">{rangeTrainings.length} treningów w zakresie</span>
            </div>

            <div className="coach-stats-summary-grid">
              <div className="coach-stats-summary-card">
                <div className="coach-section-label" style={{ padding: 0, marginBottom: 6 }}>Najwięcej opuszczonych</div>
                {maxAbsences > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {topAbsent.filter(r => r.absences === maxAbsences).map(r => (
                      <div key={r.athlete.id} className="coach-missed-row">
                        <span>{r.athlete.full_name}</span>
                        <span className="coach-missed-count">{r.absences}× nieob.</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: SUCCESS, fontWeight: 700 }}>Komplet — nikt nie opuścił treningu 🎉</div>
                )}
              </div>
              <div className="coach-stats-summary-card">
                <div className="coach-section-label" style={{ padding: 0, marginBottom: 6 }}>Frekwencja grupy</div>
                {(() => {
                  const tot = attendance.reduce((a, r) => a + r.total, 0)
                  const pres = attendance.reduce((a, r) => a + r.present, 0)
                  const pct = tot ? Math.round((pres / tot) * 100) : null
                  return (
                    <div className="coach-freq-big">
                      <span className="coach-freq-big-pct" style={{ color: pctColor(pct) }}>{pct == null ? '—' : `${pct}%`}</span>
                      <span className="coach-freq-big-sub">{pres}/{tot} obecności</span>
                    </div>
                  )
                })()}
              </div>
            </div>

            <Card title="Frekwencja per zawodniczka">
              <div style={{ padding: '0 18px 12px' }}>
                {attendance.map(r => (
                  <div key={r.athlete.id} className="coach-freq-list-row"
                    style={r.absences === maxAbsences && maxAbsences > 0 ? { background: 'rgba(194,59,59,0.06)', borderRadius: 8 } : undefined}>
                    <span className="coach-freq-name" style={{ width: 'auto', flex: 1 }}>{r.athlete.full_name}</span>
                    <span className="coach-freq-nieob">nieob. <b>{r.absences}</b>/{r.total}</span>
                    <span className="coach-freq-bar-track" style={{ maxWidth: 92 }}>
                      <span className="coach-freq-bar-fill" style={{ width: `${r.pct ?? 0}%`, background: pctColor(r.pct) }} />
                    </span>
                    <span className="coach-freq-pct" style={{ color: pctColor(r.pct) }}>{r.pct == null ? '—' : `${r.pct}%`}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="coach-section-label" style={{ padding: '0 0 2px' }}>
              Siatka obecności
            </div>
            <div className="coach-attendance-grid-wrap" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table className="coach-attendance-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Zawodniczka</th>
                    {rangeTrainings.map(t => (
                      <th key={t.id} title={formatDatePl(t.training_date)}>{t.training_date.slice(5)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {athletes.map(a => (
                    <tr key={a.id}>
                      <td className="coach-att-name">{a.full_name}</td>
                      {rangeTrainings.map(t => {
                        const absent = absentSet(t).has(a.id)
                        return (
                          <td key={t.id}>
                            <span className={`coach-att-cell ${absent ? 'coach-no' : 'coach-yes'}`}>{absent ? '✕' : '✓'}</span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="coach-att-legend">
              <span><span className="coach-att-cell coach-yes">✓</span> obecna</span>
              <span><span className="coach-att-cell coach-no">✕</span> nieobecna</span>
            </div>
          </>
        )}
      </div>
    </>
  )
}
