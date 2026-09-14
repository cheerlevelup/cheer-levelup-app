'use client'
// src/app/coach/trainings/TrainingsLogClient.tsx
// Przekrojowy dziennik treningów wszystkich grup zorganizowanych — filtr po
// grupie i zakresie dat, frekwencja per trening.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Chip, Field } from '@/components/coach/ui'

type Row = {
  id: number
  groupId: number
  groupName: string
  date: string
  present: number
  total: number
  pct: number
}

interface Props {
  rows: Row[]
  groupNames: string[]
}

const WEEKDAYS = ['nd', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob']

function weekdayShort(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return WEEKDAYS[d.getDay()]
}

function barColor(pct: number) {
  if (pct >= 90) return 'var(--green)'
  if (pct >= 70) return '#e08a2b'
  return '#c23b3b'
}

export default function TrainingsLogClient({ rows, groupNames }: Props) {
  const router = useRouter()
  const [groupFilter, setGroupFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    return rows
      .filter(r => {
        if (groupFilter !== 'all' && r.groupName !== groupFilter) return false
        if (dateFrom && r.date < dateFrom) return false
        if (dateTo && r.date > dateTo) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [rows, groupFilter, dateFrom, dateTo])

  const avgPct = filtered.length
    ? Math.round(filtered.reduce((s, r) => s + r.pct, 0) / filtered.length)
    : 0

  return (
    <>
      <SetPageMeta title="Treningi" />
      <div className="coach-content">
        <div className="coach-filter-row">
          <div className="coach-chip-tabs" style={{ overflowX: 'auto' }}>
            <Chip active={groupFilter === 'all'} onClick={() => setGroupFilter('all')}>Wszystkie grupy</Chip>
            {groupNames.map(name => (
              <Chip key={name} active={groupFilter === name} onClick={() => setGroupFilter(name)}>{name}</Chip>
            ))}
          </div>
        </div>

        <div className="coach-plany-filters" style={{ marginBottom: 12 }}>
          <Field label="Utworzono od">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </Field>
          <Field label="do">
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </Field>
        </div>

        <Card>
          {filtered.length === 0 ? (
            <div className="coach-empty-list">Brak treningów spełniających kryteria.</div>
          ) : (
            <div>
              {filtered.map(r => (
                <div key={r.id} className="coach-tlog-row">
                  <div className="coach-tlog-date">
                    <b>{r.date}</b>
                    <span>{weekdayShort(r.date)}</span>
                  </div>
                  <div className="coach-tlog-group">
                    <span className="coach-tag-category">{r.groupName}</span>
                  </div>
                  <div className="coach-tlog-freq">
                    <span className="coach-tlog-freq-bar">
                      <span className="coach-tlog-freq-fill" style={{ width: `${Math.max(r.pct, 3)}%`, background: barColor(r.pct) }} />
                    </span>
                    <span className="coach-tlog-freq-pct" style={{ color: barColor(r.pct) }}>{r.pct}%</span>
                    <span className="coach-tlog-freq-frac">{r.present}/{r.total} obecnych</span>
                  </div>
                  <button className="coach-tlog-link" onClick={() => router.push(`/coach/groups/${r.groupId}`)}>
                    Zobacz grupę <ChevronRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <section className="coach-stats-mini" style={{ marginTop: 14 }}>
          <div className="coach-stat-card">
            <div className="coach-stat-body">
              <div className="coach-num">{filtered.length}</div>
              <div className="coach-stat-label">Treningów łącznie</div>
            </div>
          </div>
          <div className="coach-stat-card">
            <div className="coach-stat-body">
              <div className="coach-num">{avgPct}%</div>
              <div className="coach-stat-label">Średnia frekwencja</div>
            </div>
          </div>
        </section>

        <div className="coach-empty-list" style={{ textAlign: 'left', padding: '12px 2px 0' }}>
          Grupy samodzielne nie mają treningów z konkretną datą — realizują treningi wg planu. Zobacz zakładkę „Plan” w danej grupie.
        </div>
      </div>
    </>
  )
}
