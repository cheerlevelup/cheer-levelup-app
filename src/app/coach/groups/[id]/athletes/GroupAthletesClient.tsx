'use client'
// src/app/coach/groups/[id]/athletes/GroupAthletesClient.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, Card, Modal, Field, Button } from '@/components/coach/ui'
import AthleteProfileCard, { type AthleteRow } from '@/components/coach/AthleteProfileCard'

type Group = { id: number; name: string; group_type?: string }
type Athlete = AthleteRow

interface Props {
  group: Group
  athletes: Athlete[]
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function AddAthleteModal({ group, onClose, onAdded }: { group: Group; onClose: () => void; onAdded: () => void }) {
  const [fullName, setFullName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!fullName.trim()) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/athletes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          birth_year: birthYear || null,
          group_id: group.id,
          password: generatePassword(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json?.error || `Błąd serwera (${res.status})`); setSaving(false); return }
      onAdded()
      onClose()
    } catch (e: any) {
      setError(`Błąd połączenia: ${e?.message || e}`)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={group.name}
      title="Dodaj zawodniczkę"
      sub="Bez maila — konto tworzy się automatycznie, mail można podpiąć później."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleCreate} disabled={saving || !fullName.trim()}>
            {saving ? 'Dodaję...' : 'Dodaj zawodniczkę'}
          </Button>
        </>
      }
    >
      <Field label="Imię i nazwisko *">
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="np. Anna Kowalska" autoFocus />
      </Field>
      <div style={{ marginTop: 12 }}>
        <Field label="Rok urodzenia">
          <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="np. 2014" min={1990} max={2025} />
        </Field>
      </div>
      {error && <div style={{ color: '#c23b3b', fontSize: 12.5, marginTop: 10 }}>❌ {error}</div>}
    </Modal>
  )
}

export default function GroupAthletesClient({ group, athletes }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  return (
    <>
      <SetPageMeta title={group.name} backHref="/coach/groups" backLabel="Grupy" />
      <div className="coach-content">
        <div className="coach-group-hero">
          <div className="coach-group-hero-title">
            <h2>{group.name}</h2>
            <span className="coach-badge-organized">{group.group_type === 'managed' ? 'zorganizowana' : 'samodzielna'}</span>
          </div>
          <div className="coach-group-hero-sub">
            {athletes.length} zawodniczek <span className="coach-dot-sep">·</span> {group.group_type === 'managed' ? 'grupa prowadzona przez trenera' : 'grupa samodzielna'}
          </div>
        </div>

        <TabsNav
          items={[
            { key: 'treningi', label: 'Treningi', href: `/coach/groups/${group.id}` },
            { key: 'plan', label: 'Plan', href: `/coach/groups/${group.id}/plan` },
            { key: 'statystyki', label: 'Statystyki', href: `/coach/groups/${group.id}/stats` },
            { key: 'obecnosc', label: 'Obecność', href: `/coach/groups/${group.id}/attendance` },
            { key: 'zawodniczki', label: 'Zawodniczki', href: `/coach/groups/${group.id}/athletes` },
            { key: 'testy', label: 'Testy', href: `/coach/groups/${group.id}/tests` },
          ]}
        />

        <div className="coach-group-tab-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 8px' }}>
            <div className="coach-section-label" style={{ padding: 0 }}>Zawodniczki ({athletes.length})</div>
            <Button variant="dark" size="small" onClick={() => setAddOpen(true)}>
              <Plus size={13} /> Dodaj
            </Button>
          </div>
          <Card>
            {athletes.length === 0 ? (
              <div className="coach-empty-list">Brak zawodniczek — dodaj pierwszą przyciskiem „+ Dodaj”.</div>
            ) : (
              <div className="coach-comp-list">
                {athletes.map(a => {
                  const open = openId === a.id
                  return (
                    <div key={a.id} className={`coach-comp-row ${open ? 'coach-open' : ''}`}>
                      <div className="coach-comp-row-head" onClick={() => setOpenId(open ? null : a.id)}>
                        <div className="coach-comp-avatar">{a.full_name.charAt(0).toUpperCase()}</div>
                        <div className="coach-comp-titles">
                          <span className="coach-comp-name">{a.full_name}</span>
                          {a.birth_year && <span className="coach-comp-year">{a.birth_year}</span>}
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--muted-light)', flexShrink: 0 }} />
                      </div>
                      <div className="coach-comp-detail">
                        {open && (
                          <AthleteProfileCard
                            athlete={{ ...a, group_name: group.name }}
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
        </div>
      </div>

      {addOpen && (
        <AddAthleteModal group={group} onClose={() => setAddOpen(false)} onAdded={() => router.refresh()} />
      )}
    </>
  )
}
