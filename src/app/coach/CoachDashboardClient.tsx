'use client'
// src/app/coach/CoachDashboardClient.tsx

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Layers, CalendarCheck, Plus, Calendar, ChevronRight } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Chip, StatCard } from '@/components/coach/ui'

type CoachGroup = {
  id: number
  name: string
  training_level?: string | null
}

type CoachAthlete = {
  id: number
  group_id?: number | null
}

type RecentSession = {
  id: number
  athlete_id: number
  date_completed?: string | null
  report_sent?: boolean | null
  athlete?: { full_name?: string | null } | null
  workout_day?: { day_name?: string | null } | null
}

interface Props {
  groups: CoachGroup[]
  athletes: CoachAthlete[]
  recentSessions: RecentSession[]
}

const CATEGORIES = ['Wszystkie', 'Dzieci', 'Młodzik', 'Youth', 'Junior', 'Kadra Senior']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CoachDashboardClient({ groups, athletes, recentSessions }: Props) {
  const router = useRouter()
  const [category, setCategory] = useState('Wszystkie')

  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const a of athletes) {
      if (a.group_id == null) continue
      map.set(a.group_id, (map.get(a.group_id) || 0) + 1)
    }
    return map
  }, [athletes])

  const maxCount = Math.max(1, ...groups.map((g) => counts.get(g.id) || 0))

  const visibleGroups = useMemo(
    () => (category === 'Wszystkie' ? groups : groups.filter((g) => g.training_level === category)),
    [groups, category]
  )

  return (
    <>
      <SetPageMeta title="Pulpit" />
      <div className="coach-content">
        <section className="coach-grid-2">
          <Card>
            <div className="coach-panel-head">
              <div>
                <h2>Grupy</h2>
                <div className="coach-sub">{groups.length} zespołów · {athletes.length} zawodniczek łącznie</div>
              </div>
              <div className="coach-chip-tabs">
                {CATEGORIES.map((c) => (
                  <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                    {c}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="coach-groups-grid">
              {visibleGroups.map((group) => {
                const count = counts.get(group.id) || 0
                const empty = count === 0
                const pct = empty ? 100 : Math.max(6, (count / maxCount) * 100)
                return (
                  <div
                    key={group.id}
                    className={`coach-group-card ${empty ? 'coach-group-empty' : ''}`}
                    onClick={() => router.push(`/coach/groups/${group.id}`)}
                  >
                    <div className="coach-group-top">
                      <div>
                        <div className="coach-group-name">{group.name}</div>
                        <div className="coach-group-count">{count} zawodniczek</div>
                      </div>
                      <div className="coach-group-chevron">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                    <div className="coach-bar-track">
                      <div className="coach-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="coach-side-stack">
            <Card title="Ostatnie treningi">
              {recentSessions.length === 0 ? (
                <div className="coach-empty-state">
                  <div className="coach-empty-icon">
                    <Calendar size={18} />
                  </div>
                  <div className="coach-empty-title">Brak treningów w ostatnich 7 dniach</div>
                  <div className="coach-empty-sub">Zaplanuj trening, żeby zobaczyć go tutaj.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 18px 18px' }}>
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="coach-group-card"
                      onClick={() => router.push(`/coach/athletes/${session.athlete_id}`)}
                    >
                      <div className="coach-group-top">
                        <div>
                          <div className="coach-group-name">{session.athlete?.full_name || 'Zawodniczka'}</div>
                          <div className="coach-group-count">
                            {session.workout_day?.day_name || 'Trening'} · {session.date_completed ? formatDate(session.date_completed) : '—'}
                          </div>
                        </div>
                        <div className="coach-group-chevron">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Zarządzanie">
              <div className="coach-quick-actions">
                <div className="coach-quick-btn coach-primary" onClick={() => router.push('/coach/athletes/new')}>
                  <span className="coach-qi">
                    <Plus size={15} />
                  </span>
                  Dodaj zawodniczkę
                </div>
                <div className="coach-quick-btn" onClick={() => router.push('/coach/groups')}>
                  <span className="coach-qi">
                    <Layers size={15} />
                  </span>
                  Zarządzaj grupami
                </div>
                <div className="coach-quick-btn" onClick={() => router.push('/coach/plans')}>
                  <span className="coach-qi">
                    <Calendar size={15} />
                  </span>
                  Plany treningowe
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="coach-stats">
          <StatCard label="Zawodniczki · aktywnych profili" value={athletes.length} icon={<Users size={15} />} tone="amber" />
          <StatCard label="Grupy · zespołów" value={groups.length} icon={<Layers size={15} />} tone="blue" />
          <StatCard label="7 dni · treningów" value={recentSessions.length} icon={<CalendarCheck size={15} />} tone="green" />
        </section>
      </div>
    </>
  )
}
