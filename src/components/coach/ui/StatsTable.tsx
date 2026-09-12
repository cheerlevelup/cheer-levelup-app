'use client'
// src/components/coach/ui/StatsTable.tsx
// Tabela statystyk per zawodniczka z przełącznikiem okresu (7/14/30 dni) — używana
// w kilku miejscach (statystyki treningowe, statystyki wellness).

export type StatCell = { v: string | number | null; color?: string }
export type StatRow = { id: number; name: string; cells: StatCell[] }
export type ColDef = { key: string; left?: boolean; emoji?: string }

const PERIODS = [
  { label: '7 dni', days: 7 },
  { label: '14 dni', days: 14 },
  { label: '30 dni', days: 30 },
]

function PeriodSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg)', border: `1.5px solid var(--border)`, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
      {PERIODS.map(p => (
        <button key={p.days} onClick={() => onChange(p.days)} style={{
          padding: '0.22rem 0.55rem', border: 'none', cursor: 'pointer',
          background: value === p.days ? 'var(--navy-900)' : 'transparent',
          color: value === p.days ? 'var(--gold)' : 'var(--muted-light)',
          fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', fontWeight: value === p.days ? 800 : 600,
          transition: 'all 0.15s',
        }}>{p.label}</button>
      ))}
    </div>
  )
}

export default function StatsTable({ title, period, onPeriodChange, cols, rows, onAthleteClick, style }: {
  title: string; period: number; onPeriodChange: (v: number) => void
  cols: ColDef[]; rows: StatRow[]; onAthleteClick: (id: number) => void
  style?: React.CSSProperties
}) {
  return (
    <div style={{ background: '#fff', border: `1.5px solid var(--border)`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 12px rgba(13,27,42,0.06)', ...style }}>
      {/* header */}
      <div style={{ padding: '0.45rem 0.7rem', borderBottom: `1.5px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.56rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--navy-900)' }}>
              {cols.map((col, i) => (
                <th key={col.key} style={{
                  padding: i === 0 ? '0.3rem 0.6rem' : '0.3rem 0.45rem',
                  textAlign: col.left ? 'left' : 'center',
                  fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.52rem', color: 'var(--gold)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  borderBottom: `1.5px solid var(--navy-600)`,
                  whiteSpace: 'nowrap', fontWeight: 700,
                }}>
                  {col.emoji && <span style={{ marginRight: 3 }}>{col.emoji}</span>}{col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const rowBg = ri % 2 === 0 ? '#fff' : '#FAFBFC'
              return (
                <tr key={row.id} style={{ background: rowBg, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                  <td style={{ padding: '0.28rem 0.6rem', borderBottom: `1px solid var(--border)` }}>
                    <button onClick={() => onAthleteClick(row.id)} style={{ background: 'none', border: 'none', color: 'var(--navy-900)', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.72rem', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {row.name}
                    </button>
                  </td>
                  {row.cells.map((cell, ci) => (
                    <td key={ci} style={{ padding: '0.22rem 0.45rem', textAlign: 'center', borderBottom: `1px solid var(--border)` }}>
                      {cell.v === null || cell.v === undefined
                        ? <span style={{ color: 'var(--border)', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.62rem' }}>—</span>
                        : <span style={{
                            display: 'inline-block',
                            background: cell.color ? cell.color + '1A' : 'var(--bg)',
                            color: cell.color ?? 'var(--navy-900)',
                            borderRadius: 5, padding: '1px 6px',
                            fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.66rem', fontWeight: 800,
                          }}>{cell.v}</span>
                      }
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
