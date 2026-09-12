'use client'
// src/app/coach/groups/CoachGroupsClient.tsx
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Plus, ChevronRight, ChevronDown, RotateCcw, Calendar, Trash2, Archive } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Chip, SegmentedControl, Modal, Field, Button } from '@/components/coach/ui'

type Group = {
  id: number
  name: string
  training_level?: string | null
  sort_order?: number | null
  group_type?: 'self' | 'managed' | null
  schedule?: string | null
}

type Athlete = {
  id: number
  full_name: string
  group_id?: number | null
  archived?: boolean | null
  group?: Group | null
}

interface Props {
  groups: Group[]
  athletes: Athlete[]
}

const CAT_DOT: Record<string, string> = {
  'Dzieci': 'coach-cat-dziecko',
  'Młodzik': 'coach-cat-mlodzik',
  'Youth': 'coach-cat-youth',
  'Junior': 'coach-cat-junior',
  'Kadra Senior': 'coach-cat-senior',
}

function NewGroupModal({ groups, onClose }: { groups: Group[]; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [groupType, setGroupType] = useState<'self' | 'managed'>('self')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true); setError('')
    const supabase = createClient()
    const maxSort = Math.max(0, ...groups.map(g => g.sort_order ?? 0))
    const { data, error: err } = await supabase
      .from('groups')
      .insert({ name: name.trim(), group_type: groupType, sort_order: maxSort + 1 })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    router.push(`/coach/groups/${data.id}`)
    router.refresh()
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Grupy"
      title="Nowa grupa"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? 'Tworzę...' : 'Utwórz grupę'}
          </Button>
        </>
      }
    >
      <Field label="Nazwa grupy">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="np. Ultra 2" autoFocus />
      </Field>
      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'block', fontSize: 10.5, letterSpacing: '.04em', color: 'var(--muted-light)', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
          Rodzaj grupy
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            { value: 'self' as const, label: 'Samodzielna', desc: 'Zawodniczki mają własne konta, trenują z planów i same wpisują wyniki.' },
            { value: 'managed' as const, label: 'Zorganizowana', desc: 'Trener prowadzi grupę i wpisuje wszystko sam (np. grupa dzieci). Zawodniczki dodaje się z widoku grupy, bez maila.' },
          ]).map(opt => (
            <div
              key={opt.value}
              onClick={() => setGroupType(opt.value)}
              style={{
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${groupType === opt.value ? 'var(--gold)' : 'var(--border)'}`,
                background: groupType === opt.value ? 'var(--navy-900)' : '#fff',
              }}
            >
              <div style={{ fontWeight: 700, color: groupType === opt.value ? 'var(--gold)' : 'var(--ink)', fontSize: 14 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: groupType === opt.value ? 'var(--muted-light)' : 'var(--muted)', marginTop: 3, lineHeight: 1.4, fontFamily: 'var(--font-inter),sans-serif' }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>
      {error && <div style={{ color: '#c23b3b', fontSize: 12.5, marginTop: 10 }}>Błąd: {error}</div>}
    </Modal>
  )
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

export default function CoachGroupsClient({ groups, athletes }: Props) {
  const router = useRouter()
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [tab, setTab] = useState<'groups' | 'archive'>('groups')
  const [filter, setFilter] = useState<'all' | 'managed' | 'self'>('all')
  const [search, setSearch] = useState('')
  const [openRows, setOpenRows] = useState<number[]>([])
  const [manageOpenRows, setManageOpenRows] = useState<number[]>([])
  const [pendingIds, setPendingIds] = useState<number[]>([])
  const [restoringAthlete, setRestoringAthlete] = useState<Athlete | null>(null)

  const activeAthletes = athletes.filter(a => !a.archived)
  const archivedAthletes = athletes
    .filter(a => a.archived)
    .slice()
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl'))

  const filteredGroups = useMemo(() => {
    let list = groups
    if (filter === 'managed') list = list.filter(g => g.group_type === 'managed')
    if (filter === 'self') list = list.filter(g => g.group_type !== 'managed')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q))
    }
    return list
  }, [groups, filter, search])

  const managedGroups = filteredGroups.filter(g => g.group_type === 'managed')
  const selfGroups = filteredGroups.filter(g => g.group_type !== 'managed')

  const catBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of activeAthletes) {
      const cat = a.group?.training_level || 'Bez kategorii'
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    const max = Math.max(1, ...Array.from(counts.values()))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count, pct: (count / max) * 100 }))
  }, [activeAthletes])

  function toggleRow(id: number) {
    setOpenRows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleManage(id: number) {
    setManageOpenRows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function setPending(id: number, on: boolean) {
    setPendingIds(prev => on ? [...prev, id] : prev.filter(x => x !== id))
  }

  async function archiveAthlete(athleteId: number) {
    setPending(athleteId, true)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: true, group_id: null }).eq('id', athleteId)
    router.refresh()
    setPending(athleteId, false)
  }

  async function restoreAthlete(athleteId: number, groupId: number) {
    setPending(athleteId, true)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: false, group_id: groupId }).eq('id', athleteId)
    router.refresh()
    setPending(athleteId, false)
  }

  async function archiveWholeGroup(group: Group) {
    const count = activeAthletes.filter(a => a.group_id === group.id).length
    if (count === 0) return
    if (!confirm(`Przenieść wszystkie zawodniczki (${count}) z grupy „${group.name}” do archiwum?`)) return
    setPending(group.id, true)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: true, group_id: null }).eq('group_id', group.id)
    router.refresh()
    setPending(group.id, false)
  }

  async function deleteGroup(group: Group) {
    setPending(group.id, true)
    const supabase = createClient()

    if (group.group_type === 'managed') {
      const { count } = await supabase
        .from('group_trainings')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', group.id)
      if ((count ?? 0) > 0) {
        alert(`Nie mogę usunąć grupy „${group.name}” — ma zapisaną historię ${count} treningów (serie, ciężary, ból). Usunięcie grupy nieodwracalnie skasowałoby te dane. Zostaw ją bez aktywnych zawodniczek zamiast usuwać.`)
        setPending(group.id, false)
        return
      }
    }

    if (!confirm(`Usunąć grupę „${group.name}”? Zawodniczki archiwalne, jeśli są, stracą tylko przypisanie do tej nazwy — ich profile, historia treningów i statystyki zostaną w całości zachowane.`)) {
      setPending(group.id, false)
      return
    }

    const { error: detachError } = await supabase.from('athletes').update({ group_id: null }).eq('group_id', group.id)
    if (detachError) {
      alert(`Błąd: ${detachError.message}`)
      setPending(group.id, false)
      return
    }

    const { error: deleteError } = await supabase.from('groups').delete().eq('id', group.id)
    if (deleteError) {
      alert(`Błąd: ${deleteError.message}`)
      setPending(group.id, false)
      return
    }

    router.refresh()
    setPending(group.id, false)
  }

  function GroupRow({ group }: { group: Group }) {
    const groupAthletes = activeAthletes.filter(a => a.group_id === group.id)
    const isManaged = group.group_type === 'managed'
    const open = openRows.includes(group.id)
    const manageOpen = manageOpenRows.includes(group.id)
    const groupPending = pendingIds.includes(group.id)

    return (
      <div className={`coach-group-row ${open ? 'coach-open' : ''}`}>
        <div className="coach-row-head" onClick={() => toggleRow(group.id)}>
          <div className="coach-row-chevron">
            <ChevronRight size={15} />
          </div>
          <span className={`coach-cat-dot ${CAT_DOT[group.training_level || ''] || 'coach-cat-dziecko'}`} />
          <div className="coach-row-titles">
            <span className="coach-row-name">{group.name}</span>
            {isManaged && <span className="coach-badge-organized">zorganizowana</span>}
            {group.training_level && <span className="coach-tag-category">{group.training_level}</span>}
          </div>
          <div className="coach-row-meta">
            <span className="coach-row-count">{groupAthletes.length} zawodniczek</span>
          </div>
          <Button
            variant="dark"
            size="small"
            onClick={(e) => { e.stopPropagation(); router.push(`/coach/groups/${group.id}`) }}
          >
            <ChevronRight size={13} /> Zarządzaj grupą
          </Button>
        </div>

        <div className="coach-row-detail">
          {group.schedule && (
            <div className="coach-training-info">
              <Calendar size={14} />
              {group.schedule}
            </div>
          )}

          <div className="coach-row-actions">
            <div className="coach-row-actions-links">
              <button className="coach-action-link coach-manage" onClick={() => toggleManage(group.id)}>
                {manageOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Zarządzaj zawodniczkami
              </button>
              <button
                className="coach-action-link coach-danger"
                onClick={() => archiveWholeGroup(group)}
                disabled={groupAthletes.length === 0 || groupPending}
              >
                <Archive size={13} /> {groupPending ? 'Przenoszę...' : 'Archiwizuj grupę'}
              </button>
              {groupAthletes.length === 0 && (
                <button className="coach-action-link coach-danger" onClick={() => deleteGroup(group)} disabled={groupPending}>
                  <Trash2 size={13} /> {groupPending ? 'Usuwam...' : 'Usuń grupę'}
                </button>
              )}
            </div>
          </div>

          {manageOpen && (
            groupAthletes.length === 0 ? (
              <div className="coach-empty-roster">Brak zawodniczek w tej grupie.</div>
            ) : (
              <div className="coach-member-manage-list">
                {groupAthletes.map(athlete => (
                  <div key={athlete.id} className="coach-mm-row">
                    <span className="coach-mm-name">{athlete.full_name}</span>
                    <div className="coach-mm-actions">
                      <button
                        className="coach-mm-btn coach-danger"
                        onClick={() => archiveAthlete(athlete.id)}
                        disabled={pendingIds.includes(athlete.id)}
                      >
                        {pendingIds.includes(athlete.id) ? '...' : '→ archiwum'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <SetPageMeta title="Grupy" />
      <div className="coach-content">
        <div className="coach-toolbar">
          <SegmentedControl
            options={[
              { value: 'groups', label: 'Grupy' },
              { value: 'archive', label: `Archiwum${archivedAthletes.length ? ` (${archivedAthletes.length})` : ''}` },
            ]}
            value={tab}
            onChange={(v) => setTab(v as 'groups' | 'archive')}
          />
          {tab === 'groups' && (
            <div className="coach-toolbar-right">
              <div className="coach-search-box" style={{ width: 220 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj grupy…" />
              </div>
              <Button variant="dark" onClick={() => setNewGroupOpen(true)}>
                <Plus size={15} /> Nowa grupa
              </Button>
            </div>
          )}
        </div>

        {tab === 'groups' ? (
          <>
            <div className="coach-filter-row">
              <div className="coach-chip-tabs">
                <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Wszystkie</Chip>
                <Chip active={filter === 'managed'} onClick={() => setFilter('managed')}>Zorganizowane</Chip>
                <Chip active={filter === 'self'} onClick={() => setFilter('self')}>Samodzielne</Chip>
              </div>
            </div>

            <section className="coach-grid-2">
              <Card className="coach-list-panel">
                {managedGroups.length > 0 && (
                  <>
                    <div className="coach-section-label">Grupy zorganizowane — prowadzi trener</div>
                    {managedGroups.map(group => <GroupRow key={group.id} group={group} />)}
                  </>
                )}
                {selfGroups.length > 0 && (
                  <>
                    <div className="coach-section-label">Grupy samodzielne</div>
                    {selfGroups.map(group => <GroupRow key={group.id} group={group} />)}
                  </>
                )}
                {filteredGroups.length === 0 && <div className="coach-empty-list">Brak grup pasujących do filtra.</div>}
              </Card>

              <Card title="Rozkład kategorii">
                <div className="coach-cat-breakdown">
                  {catBreakdown.map(row => (
                    <div key={row.label} className="coach-cat-breakdown-row">
                      <div className="coach-cat-breakdown-top">
                        <span className="name">
                          <span className={`coach-cat-dot ${CAT_DOT[row.label] || 'coach-cat-dziecko'}`} />
                          {row.label}
                        </span>
                        <span className="count">{row.count}</span>
                      </div>
                      <div className="coach-bar-track">
                        <div className="coach-bar-fill" style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  {catBreakdown.length === 0 && <div className="coach-empty-roster">Brak danych.</div>}
                </div>
              </Card>
            </section>

            <div className="coach-stats-mini">
              <div className="coach-stat-card">
                <div className="coach-stat-body">
                  <div className="coach-num">{groups.length}</div>
                  <div className="coach-stat-label">Grupy</div>
                </div>
              </div>
              <div className="coach-stat-card">
                <div className="coach-stat-body">
                  <div className="coach-num">{activeAthletes.filter(a => a.group_id).length}</div>
                  <div className="coach-stat-label">Zawodniczki w grupach</div>
                </div>
              </div>
            </div>
          </>
        ) : (
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
                      disabled={pendingIds.includes(athlete.id)}
                    >
                      <RotateCcw size={10} />
                      {pendingIds.includes(athlete.id) ? 'Przywracam...' : 'Przywróć'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {newGroupOpen && <NewGroupModal groups={groups} onClose={() => setNewGroupOpen(false)} />}
      {restoringAthlete && (
        <RestoreToGroupModal
          athlete={restoringAthlete}
          groups={groups}
          saving={pendingIds.includes(restoringAthlete.id)}
          onClose={() => setRestoringAthlete(null)}
          onConfirm={async groupId => { await restoreAthlete(restoringAthlete.id, groupId); setRestoringAthlete(null) }}
        />
      )}
    </>
  )
}
