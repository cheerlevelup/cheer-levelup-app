'use client'
// src/app/coach/groups/[id]/athletes/GroupAthletesClient.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Plus, ChevronRight, ArrowRightLeft, Archive, ClipboardList } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, Card, Modal, Field, Button } from '@/components/coach/ui'
import AthleteProfileCard, { type AthleteRow } from '@/components/coach/AthleteProfileCard'
import GroupHero from '@/components/coach/GroupHero'
import MoveToGroupModal from '@/components/coach/MoveToGroupModal'

type Group = { id: number; name: string; group_type?: string }
type Athlete = AthleteRow

interface Props {
  group: Group
  athletes: Athlete[]
  allGroups: any[]
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

type ParsedRow = { fullName: string; birthYear: string; skip: boolean }

function parseBulkText(text: string, existingNames: Set<string>): ParsedRow[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const cells = line.split('\t').map(c => c.trim()).filter(c => c !== '')
      let fullName = ''
      let birthYear = ''
      if (cells.length >= 2) {
        // Ostatnia komórka to rok (jeśli wygląda jak rok) — imię i nazwisko to
        // komórka bezpośrednio przed nim (pozwala pominąć wcześniejszą kolumnę
        // z nazwą grupy wklejoną z Excela, np. "FORCE  Agata Kowalczyk  2012").
        const last = cells[cells.length - 1]
        if (/^\d{4}$/.test(last)) {
          birthYear = last
          fullName = cells[cells.length - 2] || ''
        } else {
          fullName = last
        }
      } else {
        fullName = cells[0] || ''
      }
      fullName = fullName.trim()
      const skip = existingNames.has(fullName.toLowerCase())
      return { fullName, birthYear, skip }
    })
    .filter(r => r.fullName)
}

type RowResult = { fullName: string; status: 'pending' | 'done' | 'skipped' | 'error'; message?: string }

function BulkAddAthletesModal({ group, existingNames, onClose, onAdded }: {
  group: Group; existingNames: Set<string>; onClose: () => void; onAdded: () => void
}) {
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)

  const preview = parseBulkText(text, existingNames)

  async function handleAddAll() {
    const rows = parseBulkText(text, existingNames)
    if (rows.length === 0) return
    setRunning(true)
    const initial: RowResult[] = rows.map(r => ({ fullName: r.fullName, status: r.skip ? 'skipped' : 'pending' }))
    setResults(initial)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.skip) continue
      try {
        const res = await fetch('/api/athletes/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: row.fullName,
            birth_year: row.birthYear || null,
            group_id: group.id,
            password: generatePassword(),
          }),
        })
        const json = await res.json().catch(() => ({}))
        setResults(prev => prev!.map((r, j) => j === i ? { ...r, status: res.ok ? 'done' : 'error', message: res.ok ? undefined : (json?.error || `Błąd (${res.status})`) } : r))
      } catch (e: any) {
        setResults(prev => prev!.map((r, j) => j === i ? { ...r, status: 'error', message: e?.message || 'Błąd połączenia' } : r))
      }
    }
    setRunning(false)
    onAdded()
  }

  const doneCount = results?.filter(r => r.status === 'done').length ?? 0
  const allFinished = results && results.every(r => r.status !== 'pending')

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={group.name}
      title="Dodaj wiele zawodniczek"
      sub="Wklej listę — jedna zawodniczka na wiersz. Zawodniczki już w grupie zostaną pominięte."
      footer={
        results ? (
          <Button variant="dark" onClick={onClose} disabled={!allFinished}>
            {allFinished ? `Gotowe (${doneCount})` : 'Dodaję...'}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            <Button variant="dark" onClick={handleAddAll} disabled={running || preview.length === 0}>
              Dodaj {preview.filter(r => !r.skip).length || ''} zawodniczek
            </Button>
          </>
        )
      }
    >
      {!results ? (
        <>
          <Field label="Imię i nazwisko + rok urodzenia (jedna osoba na wiersz)">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'Agata Kowalczyk\t2012\nAleksandra Gonet\t2014\n...'}
              rows={8}
              autoFocus
            />
          </Field>
          {preview.length > 0 && (
            <div style={{ marginTop: 10, maxHeight: '30vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {preview.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-inter),sans-serif', fontSize: 12.5, padding: '3px 0' }}>
                  <span style={{ color: r.skip ? 'var(--muted-light)' : 'var(--ink)', textDecoration: r.skip ? 'line-through' : 'none' }}>{r.fullName}</span>
                  {r.birthYear && <span style={{ color: 'var(--muted-light)' }}>{r.birthYear}</span>}
                  {r.skip && <span style={{ color: 'var(--muted-light)', fontSize: 11 }}>— już w grupie</span>}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '45vh', overflowY: 'auto' }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-inter),sans-serif', fontSize: 12.5, padding: '3px 0' }}>
              <span style={{ flexShrink: 0, width: 16 }}>
                {r.status === 'done' ? '✅' : r.status === 'skipped' ? '⏭️' : r.status === 'error' ? '❌' : '…'}
              </span>
              <span style={{ color: 'var(--ink)' }}>{r.fullName}</span>
              {r.message && <span style={{ color: '#c23b3b', fontSize: 11 }}>{r.message}</span>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default function GroupAthletesClient({ group, athletes, allGroups }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [movingAthlete, setMovingAthlete] = useState<Athlete | null>(null)
  const [archivingId, setArchivingId] = useState<number | null>(null)

  async function archiveAthlete(athlete: Athlete) {
    if (!confirm(`Przenieść „${athlete.full_name}” do archiwum?`)) return
    setArchivingId(athlete.id)
    const supabase = createClient()
    await supabase.from('athletes').update({ archived: true, group_id: null }).eq('id', athlete.id)
    router.refresh()
    setArchivingId(null)
  }

  return (
    <>
      <SetPageMeta title={group.name} backHref="/coach/groups" backLabel="Grupy" />
      <div className="coach-content">
        <GroupHero group={group} athletesCount={athletes.length} />

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
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="small" onClick={() => setBulkAddOpen(true)}>
                <ClipboardList size={13} /> Dodaj wiele
              </Button>
              <Button variant="dark" size="small" onClick={() => setAddOpen(true)}>
                <Plus size={13} /> Dodaj
              </Button>
            </div>
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
      {bulkAddOpen && (
        <BulkAddAthletesModal
          group={group}
          existingNames={new Set(athletes.map(a => a.full_name.toLowerCase()))}
          onClose={() => { setBulkAddOpen(false); router.refresh() }}
          onAdded={() => router.refresh()}
        />
      )}
      {movingAthlete && (
        <MoveToGroupModal
          athlete={movingAthlete}
          allGroups={allGroups}
          onClose={() => setMovingAthlete(null)}
          onMoved={() => router.refresh()}
        />
      )}
    </>
  )
}
