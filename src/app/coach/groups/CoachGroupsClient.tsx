'use client'
// src/app/coach/groups/CoachGroupsClient.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A',
  navyLight: '#1A2E45',
  navyBorder: '#243652',
  gold: '#F5C842',
  white: '#FFFFFF',
  offWhite: '#F4F6F9',
  gray: '#8A9BB0',
  grayLight: '#E8ECF2',
  red: '#EF4444',
  green: '#22C55E',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = {
  id: number
  name: string
  training_level?: string | null
  sort_order?: number | null
  group_type?: 'self' | 'managed' | null
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

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>
      {children}
    </div>
  )
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 440, background: C.white, borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.grayLight}` }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Grupy</div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: C.white }}>Nowa grupa</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Nazwa grupy</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="np. Ultra 2"
            autoFocus
            style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.95rem', outline: 'none', marginBottom: '1.1rem' }}
          />
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Rodzaj grupy</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
            {([
              { value: 'self' as const, label: 'Samodzielna', desc: 'Zawodniczki mają własne konta, trenują z planów i same wpisują wyniki.' },
              { value: 'managed' as const, label: 'Zorganizowana', desc: 'Trener prowadzi grupę i wpisuje wszystko sam (np. grupa dzieci). Zawodniczki dodaje się z widoku grupy, bez maila.' },
            ]).map(opt => (
              <button key={opt.value} onClick={() => setGroupType(opt.value)}
                style={{ padding: '0.75rem 1rem', borderRadius: 10, border: `1.5px solid ${groupType === opt.value ? C.gold : C.grayLight}`, background: groupType === opt.value ? C.navy : C.offWhite, textAlign: 'left', cursor: 'pointer', fontFamily: sans }}>
                <div style={{ fontWeight: 800, color: groupType === opt.value ? C.gold : C.navy, fontSize: '0.92rem' }}>{opt.label}</div>
                <div style={{ fontSize: '0.76rem', color: groupType === opt.value ? C.gray : '#6B7A8E', marginTop: 3, lineHeight: 1.4 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          {error && <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: '0.75rem' }}>Błąd: {error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '0.8rem 1.1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>
              Anuluj
            </button>
            <button onClick={handleCreate} disabled={saving || !name.trim()}
              style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: 12, background: !name.trim() ? C.grayLight : C.navy, color: !name.trim() ? C.gray : C.gold, fontWeight: 900, fontSize: '0.92rem' }}>
              {saving ? 'Tworzę...' : 'Utwórz grupę'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CoachGroupsClient({ groups, athletes }: Props) {
  const router = useRouter()
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [tab, setTab] = useState<'groups' | 'archive'>('groups')
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null)
  const [pendingIds, setPendingIds] = useState<number[]>([])

  const activeAthletes = athletes.filter(a => !a.archived)
  const archivedAthletes = athletes
    .filter(a => a.archived)
    .slice()
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl'))

  const managedGroups = groups.filter(g => g.group_type === 'managed')
  const selfGroups = groups.filter(g => g.group_type !== 'managed')

  function setPending(id: number, on: boolean) {
    setPendingIds(prev => on ? [...prev, id] : prev.filter(x => x !== id))
  }

  async function archiveAthlete(athleteId: number) {
    setPending(athleteId, true)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: true }).eq('id', athleteId)
    router.refresh()
    setPending(athleteId, false)
  }

  async function restoreAthlete(athleteId: number) {
    setPending(athleteId, true)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: false }).eq('id', athleteId)
    router.refresh()
    setPending(athleteId, false)
  }

  async function archiveWholeGroup(group: Group) {
    const count = activeAthletes.filter(a => a.group_id === group.id).length
    if (count === 0) return
    if (!confirm(`Przenieść wszystkie zawodniczki (${count}) z grupy „${group.name}” do archiwum?`)) return
    setPending(group.id, true)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: true }).eq('group_id', group.id)
    router.refresh()
    setPending(group.id, false)
  }

  function GroupCard({ group }: { group: Group }) {
    const groupAthletes = activeAthletes.filter(a => a.group_id === group.id)
    const isManaged = group.group_type === 'managed'
    const expanded = expandedGroupId === group.id
    const groupPending = pendingIds.includes(group.id)

    return (
      <Card key={group.id}>
        <button onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ width: '100%', background: 'none', border: 'none', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: C.navy }}>{group.name}</div>
              {isManaged && (
                <span style={{ fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, color: C.navy, background: C.gold, borderRadius: 6, padding: '2px 7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  zorganizowana
                </span>
              )}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 4 }}>
              {groupAthletes.length} zawodniczek{group.training_level ? ` · ${group.training_level}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {groupAthletes.slice(0, 5).map(athlete => (
                <span key={athlete.id} style={{ fontFamily: mono, fontSize: '0.65rem', color: C.navy, background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, padding: '3px 8px' }}>
                  {athlete.full_name.split(' ')[0]}
                </span>
              ))}
              {groupAthletes.length > 5 && <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, padding: '3px 0' }}>+{groupAthletes.length - 5}</span>}
            </div>
          </div>
          <span style={{ color: C.gray, marginLeft: 12 }}>›</span>
        </button>

        <div style={{ borderTop: `1.5px solid ${C.grayLight}`, display: 'flex' }}>
          <button
            onClick={() => setExpandedGroupId(expanded ? null : group.id)}
            style={{ flex: 1, border: 'none', background: 'none', padding: '0.6rem', fontFamily: mono, fontSize: '0.64rem', fontWeight: 700, color: C.gray, letterSpacing: '0.04em', borderRight: `1.5px solid ${C.grayLight}` }}
          >
            {expanded ? '▲ Ukryj zawodniczki' : '▾ Zarządzaj zawodniczkami'}
          </button>
          <button
            onClick={() => archiveWholeGroup(group)}
            disabled={groupAthletes.length === 0 || groupPending}
            style={{ flex: 1, border: 'none', background: 'none', padding: '0.6rem', fontFamily: mono, fontSize: '0.64rem', fontWeight: 700, color: groupAthletes.length === 0 ? C.grayLight : C.red }}
          >
            {groupPending ? 'Przenoszę...' : '🗄 Archiwizuj grupę'}
          </button>
        </div>

        {expanded && (
          <div style={{ borderTop: `1.5px solid ${C.grayLight}`, padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 6, background: C.offWhite }}>
            {groupAthletes.length === 0 && (
              <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, padding: '0.4rem 0' }}>Brak zawodniczek w tej grupie.</div>
            )}
            {groupAthletes.map(athlete => (
              <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, padding: '0.45rem 0.6rem' }}>
                <span style={{ fontSize: '0.85rem', color: C.navy, fontWeight: 600 }}>{athlete.full_name}</span>
                <button
                  onClick={() => archiveAthlete(athlete.id)}
                  disabled={pendingIds.includes(athlete.id)}
                  style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.red, borderRadius: 6, padding: '3px 8px', fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {pendingIds.includes(athlete.id) ? '...' : '→ archiwum'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
        button:disabled { cursor: default; opacity: 0.55; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button onClick={() => router.push('/coach')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← Panel
            </button>
            <h1 style={{ color: C.white, fontSize: '1.45rem', fontWeight: 800, marginTop: '1rem' }}>Grupy</h1>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>Zarzadzanie zawodniczkami w grupach.</p>

            <div style={{ display: 'flex', gap: 6, marginTop: '1.1rem' }}>
              {([
                { id: 'groups' as const, label: 'Grupy' },
                { id: 'archive' as const, label: `Archiwum${archivedAthletes.length ? ` (${archivedAthletes.length})` : ''}` },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: 10, border: `1.5px solid ${tab === t.id ? C.gold : C.navyBorder}`,
                    background: tab === t.id ? C.gold : C.navyLight, color: tab === t.id ? C.navy : C.gray,
                    fontWeight: 800, fontFamily: mono, fontSize: '0.7rem', letterSpacing: '0.04em',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {tab === 'groups' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                <Card>
                  <div style={{ padding: '0.875rem' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Grupy</div>
                    <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 800, color: C.gold, lineHeight: 1 }}>{groups.length}</div>
                  </div>
                </Card>
                <Card>
                  <div style={{ padding: '0.875rem' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Zawodniczki</div>
                    <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 800, color: C.navy, lineHeight: 1 }}>{activeAthletes.length}</div>
                  </div>
                </Card>
              </div>

              <button
                onClick={() => setNewGroupOpen(true)}
                style={{ width: '100%', padding: '0.875rem', borderRadius: 14, border: `1.5px dashed ${C.gray}`, background: C.white, color: C.navy, fontWeight: 800, fontSize: '0.9rem', marginBottom: '1.25rem', fontFamily: sans }}
              >
                ＋ Nowa grupa
              </button>

              {managedGroups.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
                    Grupy zorganizowane — prowadzi trener
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {managedGroups.map(group => <GroupCard key={group.id} group={group} />)}
                  </div>
                </div>
              )}

              <div>
                {managedGroups.length > 0 && (
                  <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
                    Grupy samodzielne
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selfGroups.map(group => <GroupCard key={group.id} group={group} />)}
                </div>
              </div>
            </>
          ) : (
            <>
              <Card style={{ marginBottom: '1.25rem' }}>
                <div style={{ padding: '0.875rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Zarchiwizowane</div>
                  <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 800, color: C.navy, lineHeight: 1 }}>{archivedAthletes.length}</div>
                </div>
              </Card>

              {archivedAthletes.length === 0 ? (
                <Card>
                  <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.78rem', color: C.gray }}>
                    Archiwum jest puste.
                  </div>
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {archivedAthletes.map(athlete => (
                    <Card key={athlete.id}>
                      <div style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: C.navy }}>{athlete.full_name}</div>
                          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 3 }}>
                            {athlete.group?.name ? `grupa: ${athlete.group.name}` : 'bez przypisanej grupy'}
                          </div>
                        </div>
                        <button
                          onClick={() => restoreAthlete(athlete.id)}
                          disabled={pendingIds.includes(athlete.id)}
                          style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.55rem 0.9rem', fontFamily: mono, fontSize: '0.66rem', fontWeight: 800, whiteSpace: 'nowrap' }}
                        >
                          {pendingIds.includes(athlete.id) ? 'Przywracam...' : '↩ Przywróć'}
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {newGroupOpen && <NewGroupModal groups={groups} onClose={() => setNewGroupOpen(false)} />}
    </>
  )
}
