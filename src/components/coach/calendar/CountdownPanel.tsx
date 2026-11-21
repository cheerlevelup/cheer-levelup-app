'use client'
// Widżety "Odliczanie do..." — liczba dni do wydarzenia i liczba treningów
// wybranych drużyn (z cyklicznych treningów w kalendarzu, bez ferii/odwołanych).
// Używane na Pulpicie i w zakładce Kalendarz.
import { useMemo, useState } from 'react'
import { Plus, X, Hourglass, MapPin } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Modal, Field, Button, Chip } from '../ui'
import {
  CalCountdown,
  CalEvent,
  CalGroup,
  countTrainings,
  countdownGroupIds,
  daysBetween,
  eventGroupIds,
  eventTypeInfo,
  formatDateRange,
  formatDatePL,
  normalizeCountdown,
  plDays,
  plTrainings,
  todayISO,
} from '@/lib/coach/calendar'

interface Props {
  events: CalEvent[]
  groups: CalGroup[]
  countdowns: CalCountdown[]
  onCountdownsChange: (next: CalCountdown[]) => void
  /** na Pulpicie: link do kalendarza, gdy brak wydarzeń */
  emptyHint?: React.ReactNode
}

export default function CountdownPanel({ events, groups, countdowns, onCountdownsChange, emptyHint }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const today = todayISO()

  const items = useMemo(() => {
    return countdowns
      .map((cd) => ({ cd, ev: events.find((e) => e.id === cd.event_id) }))
      .filter((x): x is { cd: CalCountdown; ev: CalEvent } => !!x.ev)
      .sort((a, b) => (a.ev.start_date < b.ev.start_date ? -1 : a.ev.start_date > b.ev.start_date ? 1 : a.cd.sort_order - b.cd.sort_order))
  }, [countdowns, events])

  async function handleDelete(id: number) {
    if (!confirm('Usunąć to odliczanie? (Wydarzenie zostaje w kalendarzu.)')) return
    const supabase = createClient()
    const { error } = await supabase.from('calendar_countdowns').delete().eq('id', id)
    if (error) { alert('Błąd: ' + error.message); return }
    onCountdownsChange(countdowns.filter((c) => c.id !== id))
  }

  return (
    <div className="coach-cd-wrap">
      <div className="coach-cd-head">
        <div className="coach-cd-title"><Hourglass size={15} /> Odliczanie</div>
        <Button size="small" variant="ghost" onClick={() => setAddOpen(true)}>
          <Plus size={13} /> Dodaj odliczanie
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="coach-cd-empty">
          Dodaj widżet odliczania do zawodów lub pokazu — zobaczysz, ile zostało dni i treningów dla każdej drużyny.
          {emptyHint}
        </div>
      ) : (
        <div className="coach-cd-grid">
          {items.map(({ cd, ev }) => {
            const info = eventTypeInfo(ev.event_type)
            const days = daysBetween(today, ev.start_date)
            const past = (ev.end_date || ev.start_date) < today
            const gids = countdownGroupIds(cd, ev, groups)
            return (
              <div key={cd.id} className={`coach-cd-card${past ? ' coach-cd-past' : ''}`} style={{ borderTopColor: info.color }}>
                <button className="coach-cd-del" title="Usuń odliczanie" onClick={() => handleDelete(cd.id)}>
                  <X size={13} />
                </button>
                <div className="coach-cd-type" style={{ color: info.color }}>{info.label}</div>
                <div className="coach-cd-name">{ev.title}</div>
                <div className="coach-cd-date">
                  {formatDateRange(ev)}
                  {ev.location && <><span> · </span><MapPin size={11} /> {ev.location}</>}
                </div>
                <div className="coach-cd-days">
                  {past ? (
                    <span className="coach-cd-days-label">Zakończone</span>
                  ) : days <= 0 ? (
                    <span className="coach-cd-days-num" style={{ color: info.color }}>Dziś!</span>
                  ) : (
                    <>
                      <span className="coach-cd-days-num">{days}</span>
                      <span className="coach-cd-days-label">{days === 1 ? 'dzień' : 'dni'}</span>
                    </>
                  )}
                </div>
                {!past && days > 0 && gids.length > 0 && (
                  <div className="coach-cd-groups">
                    {gids.map((gid) => {
                      const g = groups.find((x) => x.id === gid)
                      if (!g) return null
                      const n = countTrainings(events, gid, today, ev.start_date)
                      return (
                        <div key={gid} className="coach-cd-group-row">
                          <span>{g.name}</span>
                          <strong>{plTrainings(n)}</strong>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {addOpen && (
        <AddCountdownModal
          events={events}
          groups={groups}
          onClose={() => setAddOpen(false)}
          onAdded={(cd) => { onCountdownsChange([...countdowns, cd]); setAddOpen(false) }}
          nextSort={Math.max(0, ...countdowns.map((c) => c.sort_order)) + 1}
        />
      )}
    </div>
  )
}

function AddCountdownModal({
  events, groups, onClose, onAdded, nextSort,
}: {
  events: CalEvent[]
  groups: CalGroup[]
  onClose: () => void
  onAdded: (cd: CalCountdown) => void
  nextSort: number
}) {
  const today = todayISO()
  const candidates = useMemo(
    () => events
      .filter((e) => e.event_type !== 'training' && e.event_type !== 'break' && e.start_date >= today)
      .sort((a, b) => (a.start_date < b.start_date ? -1 : 1)),
    [events, today]
  )
  const [eventId, setEventId] = useState<number | null>(candidates[0]?.id ?? null)
  const ev = candidates.find((e) => e.id === eventId)
  const [groupIds, setGroupIds] = useState<number[] | null>(null) // null = jak w wydarzeniu
  const selected = groupIds ?? (ev ? eventGroupIds(ev, groups) : [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggle(id: number) {
    const cur = new Set(selected)
    if (cur.has(id)) cur.delete(id)
    else cur.add(id)
    setGroupIds(groups.map((g) => g.id).filter((g) => cur.has(g)))
  }

  async function handleSave() {
    if (!ev) return
    setSaving(true); setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('calendar_countdowns')
      .insert({ event_id: ev.id, group_ids: selected, sort_order: nextSort })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onAdded(normalizeCountdown(data))
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Widżet"
      title="Odliczanie do wydarzenia"
      sub="Pokaże liczbę dni i liczbę treningów wybranych drużyn do dnia wydarzenia."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleSave} disabled={saving || !ev || selected.length === 0}>
            {saving ? 'Zapisuję...' : 'Dodaj odliczanie'}
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <div className="coach-empty-sub">
          Brak nadchodzących wydarzeń. Najpierw dodaj zawody lub pokaz w zakładce Kalendarz.
        </div>
      ) : (
        <>
          <Field label="Wydarzenie">
            <select
              value={eventId ?? ''}
              onChange={(e) => { setEventId(Number(e.target.value)); setGroupIds(null) }}
            >
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {formatDatePL(e.start_date)} ({eventTypeInfo(e.event_type).label})
                </option>
              ))}
            </select>
          </Field>
          {ev && (
            <div className="coach-empty-sub" style={{ marginTop: 6 }}>
              Za {plDays(Math.max(0, daysBetween(today, ev.start_date)))}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <div className="coach-cal-label">Licz treningi dla drużyn</div>
            <div className="coach-chip-tabs">
              {groups.map((g) => (
                <Chip key={g.id} active={selected.includes(g.id)} onClick={() => toggle(g.id)}>{g.name}</Chip>
              ))}
            </div>
          </div>
        </>
      )}
      {error && <div style={{ color: '#c23b3b', fontSize: 12.5, marginTop: 10 }}>Błąd: {error}</div>}
    </Modal>
  )
}
