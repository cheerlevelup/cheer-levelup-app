'use client'
// src/app/coach/athletes/AthletesListClient.tsx
// "Zawodniczki" — jedna wspólna, przeszukiwalna lista wszystkich zawodniczek ze
// wszystkich grup, z filtrem grupy i kontuzji oraz tym samym rozwijanym profilem
// co w zakładce "Zawodniczki" wewnątrz grupy.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ChevronRight, ArrowRightLeft, Archive, AlertTriangle, RotateCcw } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Chip, SegmentedControl, Modal, Button } from '@/components/coach/ui'
import AthleteProfileCard, { type AthleteRow } from '@/components/coach/AthleteProfileCard'
import MoveToGroupModal from '@/components/coach/MoveToGroupModal'

type Group = { id: number; name: string; group_type?: string | null; sort_order?: number | null }
type Athlete = AthleteRow & { group_id?: number | null; group?: Group | null }

interface Props {
  athletes: Athlete[]
  archivedAthletes: Athlete[]
  allGroups: Group[]
  injuredIds: number[]
}

function RestoreToGroupModal({ athlete, groups, saving, onClose, onConfirm }: {
  athlete: Athlete; groups: Group[]; saving: boolean; onClose: () => void; onConfirm: (groupId: number) => void
}) {
  const [targetGroupId, setTargetGroupId] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Archiwum"
      title={`Przywróć ${athlete.full_name}`}
      sub="Wybierz grupę, do której wraca zawodniczka."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={() => targetGroupId && onConfirm(parseInt(targetGroupId))} disabled={!targetGroupId || saving}>
            {saving ? 'Przywracam...' : 'Przywróć'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '45vh', overflowY: 'auto' }}>
        {groups.map(g => (
          <div
            key={g.id}
            onClick={() => setTargetGroupId(String(g.id))}
            style={{
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${targetGroupId === String(g.id) ? 'var(--gold)' : 'var(--border)'}`,
              background: targetGroupId === String(g.id) ? 'var(--navy-900)' : '#fff',
              color: targetGroupId === String(g.id) ? 'var(--gold)' : 'var(--ink)',
              fontWeight: 600, fontFamily: 'var(--font-inter),sans-serif', fontSize: 13.5,
            }}
          >
            {g.name}
            {g.group_type === 'managed' && (
              <span style={{ fontSize: 10, marginLeft: 8, textTransform: 'uppercase', letterSpacing: '.05em', opacity: 0.7 }}>zorganizowana</span>
            )}
          </div>
        ))}
        {groups.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>Brak grup — najpierw utwórz grupę.</div>}
      </div>
    </Modal>
  )
}

export default function AthletesListClient({ athletes, archivedAthletes, allGroups, injuredIds }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'active' | 'archive'>('active')
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<number | 'all' | 'none'>('all')
  const [injuredOnly, setInjuredOnly] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [movingAthlete, setMovingAthlete] = useState<Athlete | null>(null)
  const [archivingId, setArchivingId] = useState<number | null>(null)
  const [restoringAthlete, setRestoringAthlete] = useState<Athlete | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)

  const injuredSet = useMemo(() => new Set(injuredIds), [injuredIds])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return athletes.filter(a => {
      // Dopasowanie na początku imienia lub nazwiska, nie gdziekolwiek w
      // środku (np. "am" ma znaleźć "Amelia", nie "Kamila" czy "Jamróz").
      if (q && !a.full_name.toLowerCase().split(' ').some(word => word.startsWith(q))) return false
      if (groupFilter === 'none' && a.group_id) return false
      if (typeof groupFilter === 'number' && a.group_id !== groupFilter) return false
      if (injuredOnly && !injuredSet.has(a.id)) return false
      return true
    })
  }, [athletes, search, groupFilter, injuredOnly, injuredSet])

  async function archiveAthlete(athlete: Athlete) {
    if (!confirm(`Przenieść „${athlete.full_name}” do archiwum?`)) return
    setArchivingId(athlete.id)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: true, group_id: null }).eq('id', athlete.id)
    router.refresh()
    setArchivingId(null)
  }

  async function restoreAthlete(athleteId: number, groupId: number) {
    setRestoringId(athleteId)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: false, group_id: groupId }).eq('id', athleteId)
    router.refresh()
    setRestoringId(null)
  }

  return (
    <>
      <SetPageMeta title="Zawodniczki" />
      <div className="coach-content" style={{ paddingTop: 4 }}>
        <div className="coach-toolbar">
          <SegmentedControl
            options={[
              { value: 'active', label: 'Zawodniczki' },
              { value: 'archive', label: `Archiwum${archivedAthletes.length ? ` (${archivedAthletes.length})` : ''}` },
            ]}
            value={view}
            onChange={(v) => setView(v as 'active' | 'archive')}
          />
          {view === 'active' && (
            <div className="coach-search-box" style={{ width: 220, flexShrink: 0 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj zawodniczki…" />
            </div>
          )}
        </div>

        {view === 'archive' ? (
          <Card>
            <div className="coach-archive-count-card">
              <span className="eyebrow">Zarchiwizowane</span>
              <span className="num">{archivedAthletes.length}</span>
            </div>
            {archivedAthletes.length === 0 ? (
              <div className="coach-empty-list">Archiwum jest puste.</div>
            ) : (
              <div className="coach-member-list">
                {archivedAthletes.map(athlete => (
                  <div key={athlete.id} className="coach-member-card">
                    <div
                      className="coach-member-info"
                      style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                      onClick={() => router.push(`/coach/athletes/${athlete.id}`)}
                    >
                      <div className="coach-member-name">{athlete.full_name}</div>
                      <div className="coach-member-group">{athlete.group?.name ? `grupa: ${athlete.group.name}` : 'bez przypisanej grupy'}</div>
                    </div>
                    <button
                      className="coach-btn-restore"
                      onClick={() => setRestoringAthlete(athlete)}
                      disabled={restoringId === athlete.id}
                    >
                      <RotateCcw size={10} />
                      {restoringId === athlete.id ? 'Przywracam...' : 'Przywróć'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
        <>
        <div className="coach-filter-row">
          <div className="coach-chip-tabs" style={{ overflowX: 'auto' }}>
            <Chip active={groupFilter === 'all'} onClick={() => setGroupFilter('all')}>Wszystkie</Chip>
            {allGroups.map(g => (
              <Chip key={g.id} active={groupFilter === g.id} onClick={() => setGroupFilter(g.id)}>{g.name}</Chip>
            ))}
            <Chip active={groupFilter === 'none'} onClick={() => setGroupFilter('none')}>Bez grupy</Chip>
            <Chip active={injuredOnly} onClick={() => setInjuredOnly(o => !o)}>
              <AlertTriangle size={12} style={{ marginRight: 4 }} /> Z kontuzją
            </Chip>
          </div>
        </div>

        <Card>
          {filtered.length === 0 ? (
            <div className="coach-empty-list">Brak zawodniczek pasujących do filtra.</div>
          ) : (
            <div className="coach-comp-list">
              {filtered.map(a => {
                const open = openId === a.id
                return (
                  <div key={a.id} className={`coach-comp-row ${open ? 'coach-open' : ''}`}>
                    <div className="coach-comp-row-head" onClick={() => setOpenId(open ? null : a.id)}>
                      <div className="coach-comp-avatar">{a.full_name.charAt(0).toUpperCase()}</div>
                      <div className="coach-comp-titles">
                        <span className="coach-comp-name">{a.full_name}</span>
                        {a.birth_year && <span className="coach-comp-year">{a.birth_year}</span>}
                        {injuredSet.has(a.id) && (
                          <span title="Aktywna kontuzja"><AlertTriangle size={13} color="#EF4444" /></span>
                        )}
                      </div>
                      {a.group?.name && (
                        <span className="coach-tag-category" style={{ flexShrink: 0 }}>{a.group.name}</span>
                      )}
                      <button
                        className="coach-action-link coach-manage"
                        onClick={e => { e.stopPropagation(); setMovingAthlete(a) }}
                        style={{ flexShrink: 0 }}
                      >
                        <ArrowRightLeft size={13} /> Przenieś
                      </button>
                      <button
                        className="coach-action-link coach-danger"
                        onClick={e => { e.stopPropagation(); archiveAthlete(a) }}
                        disabled={archivingId === a.id}
                        style={{ flexShrink: 0 }}
                      >
                        <Archive size={13} /> {archivingId === a.id ? 'Przenoszę...' : 'Archiwizuj'}
                      </button>
                      <ChevronRight size={16} style={{ color: 'var(--muted-light)', flexShrink: 0 }} />
                    </div>
                    <div className="coach-comp-detail">
                      {open && (
                        <AthleteProfileCard
                          athlete={{ ...a, group_name: a.group?.name }}
                          onClose={() => setOpenId(null)}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
        </>
        )}
      </div>

      {movingAthlete && (
        <MoveToGroupModal
          athlete={movingAthlete}
          allGroups={allGroups}
          onClose={() => setMovingAthlete(null)}
          onMoved={() => router.refresh()}
        />
      )}
      {restoringAthlete && (
        <RestoreToGroupModal
          athlete={restoringAthlete}
          groups={allGroups}
          saving={restoringId === restoringAthlete.id}
          onClose={() => setRestoringAthlete(null)}
          onConfirm={async groupId => { await restoreAthlete(restoringAthlete.id, groupId); setRestoringAthlete(null) }}
        />
      )}
    </>
  )
}
