'use client'
// src/components/coach/ui/StatsTable.tsx
// Tabela statystyk per zawodniczka z przełącznikiem okresu (7/14/30 dni) — używana
// w kilku miejscach (statystyki treningowe, statystyki wellness).
// Jasny styl (jak „Realizacja planu” / testy zawodniczki), kompaktowe kolumny.

export type StatCell = { v: string | number | null; color?: string }
export type StatRow = { id: number; name: string; cells: StatCell[] }
// emoji zostaje w typie dla zgodności wywołań, ale nie jest już wyświetlane
export type ColDef = { key: string; left?: boolean; emoji?: string }

const PERIODS = [
  { label: '7 dni', days: 7 },
  { label: '14 dni', days: 14 },
  { label: '30 dni', days: 30 },
]

export default function StatsTable({ title, period, onPeriodChange, cols, rows, onAthleteClick, style }: {
  title: string; period: number; onPeriodChange: (v: number) => void
  cols: ColDef[]; rows: StatRow[]; onAthleteClick: (id: number) => void
  style?: React.CSSProperties
}) {
  return (
    <div className="coach-statstable" style={style}>
      <div className="coach-statstable-head">
        <div className="coach-statstable-title">{title}</div>
        <div className="coach-statstable-periods">
          {PERIODS.map(p => (
            <button key={p.days} type="button" onClick={() => onPeriodChange(p.days)}
              className={period === p.days ? 'coach-active' : undefined}>{p.label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {cols.map((col, i) => (
                <th key={col.key} className={i === 0 || col.left ? 'coach-st-left' : undefined}>{col.key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td className="coach-st-left">
                  <button className="coach-st-name" onClick={() => onAthleteClick(row.id)}>{row.name}</button>
                </td>
                {row.cells.map((cell, ci) => (
                  <td key={ci}>
                    {cell.v === null || cell.v === undefined
                      ? <span className="coach-st-empty">—</span>
                      : <span className="coach-st-val" style={cell.color ? { color: cell.color, background: `color-mix(in srgb, ${cell.color} 12%, transparent)` } : undefined}>{cell.v}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
