'use client'
// Dodawanie / edycja wydarzenia w kalendarzu sezonu (zawody, pokaz, ferie,
// obóz, inne) oraz cyklicznego treningu drużyn.
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Modal, Field, FieldGrid, Button, Chip } from '../ui'
import {
  CalEvent,
  CalGroup,
  EVENT_TYPES,
  EventType,
  WEEKDAYS_SHORT,
  normalizeEvent,
  seasonOfISO,
  seasonRange,
  weekdayISO,
} from '@/lib/coach/calendar'

interface Props {
  event: CalEvent | null
  defaultDate: string
  defaultType?: EventType
  groups: CalGroup[]
  onClose: () => void
  onSaved: (ev: CalEvent) => void
  onDeleted: (id: number) => void
}

const TITLE_PLACEHOLDER: Record<EventType, string> = {
  competition: 'np. Mistrzostwa Polski',
  show: 'np. Pokaz na festynie',
  camp: 'np. Obóz letni',
  break: 'np. Ferie zimowe',
  training: 'Trening',
  other: 'np. Zebranie z rodzicami',
}

export default function EventModal({ event, defaultDate, defaultType, groups, onClose, onSaved, onDeleted }: Props) {
  const isEdit = !!event
  const [type, setType] = useState<EventType>(event?.event_type || defaultType || 'competition')
  const [title, setTitle] = useState(event?.title || '')
  const [startDate, setStartDate] = useState(event?.start_date || defaultDate)
  const [endDate, setEndDate] = useState(event?.end_date || '')
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) || '')
  const [endTime, setEndTime] = useState(event?.end_time?.slice(0, 5) || '')
  const [location, setLocation] = useState(event?.location || '')
  const [notes, setNotes] = useState(event?.notes || '')
  const [allGroups, setAllGroups] = useState(event ? event.all_groups : false)
  const [groupIds, setGroupIds] = useState<number[]>(event?.group_ids || [])
  const [recurring, setRecurring] = useState(
    event ? !!event.recurrence_weekdays?.length : (defaultType || 'competition') === 'training'
  )
  const [weekdays, setWeekdays] = useState<number[]>(
    event?.recurrence_weekdays?.length ? event.recurrence_weekdays : [weekdayISO(defaultDate)]
  )
  const [until, setUntil] = useState(event?.recurrence_until || seasonRange(seasonOfISO(defaultDate)).end)
  const [cancelsTrainings, setCancelsTrainings] = useState(event ? event.cancels_trainings : true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isTraining = type === 'training'
  const isRecurring = isTraining && recurring
  const hasGroups = allGroups || groupIds.length > 0

  function changeType(t: EventType) {
    setType(t)
    if (t === 'training' && !isEdit) setRecurring(true)
  }

  function toggleGroup(id: number) {
    setAllGroups(false)
    setGroupIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function toggleWeekday(d: number) {
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))
  }

  async function handleSave() {
    setError('')
    const finalTitle = title.trim() || (isTraining ? 'Trening' : '')
    if (!finalTitle) { setError('Wpisz nazwę wydarzenia.'); return }
    if (!startDate) { setError('Wybierz datę.'); return }
    if (!hasGroups) { setError('Wybierz przynajmniej jedną grupę.'); return }
    if (isRecurring && weekdays.length === 0) { setError('Wybierz dni tygodnia treningu.'); return }
    if (!isRecurring && endDate && endDate < startDate) { setError('Data końca jest wcześniejsza niż początek.'); return }
    if (isRecurring && until && until < startDate) { setError('Data „do” jest wcześniejsza niż „od”.'); return }

    const payload = {
      title: finalTitle,
      event_type: type,
      start_date: startDate,
      end_date: !isRecurring && endDate && endDate !== startDate ? endDate : null,
      start_time: startTime || null,
      end_time: endTime || null,
      location: type === 'break' ? null : location.trim() || null,
      notes: notes.trim() || null,
      all_groups: allGroups,
      group_ids: allGroups ? [] : groups.map((g) => g.id).filter((id) => groupIds.includes(id)),
      recurrence_weekdays: isRecurring ? weekdays : null,
      recurrence_until: isRecurring ? until || null : null,
      excluded_dates: isRecurring ? event?.excluded_dates || [] : [],
      cancels_trainings: type === 'break' ? cancelsTrainings : false,
    }

    setSaving(true)
    const supabase = createClient()
    const q = isEdit
      ? supabase.from('calendar_events').update(payload).eq('id', event!.id).select().single()
      : supabase.from('calendar_events').insert(payload).select().single()
    const { data, error: err } = await q
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(normalizeEvent(data))
  }

  async function handleDelete() {
    if (!event) return
    const msg = event.recurrence_weekdays?.length
      ? 'Usunąć całą serię treningów z kalendarza?'
      : `Usunąć wydarzenie „${event.title}”?`
    if (!confirm(msg)) return
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('calendar_events').delete().eq('id', event.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onDeleted(event.id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      eyebrow="Kalendarz"
      title={isEdit ? (isRecurring ? 'Edytuj serię treningów' : 'Edytuj wydarzenie') : isTraining ? 'Nowy trening' : 'Nowe wydarzenie'}
      footer={
        <>
          {isEdit ? (
            <Button variant="ghost" onClick={handleDelete} disabled={saving} style={{ color: '#c23b3b' }}>
              <Trash2 size={13} /> Usuń
            </Button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            <Button variant="dark" onClick={handleSave} disabled={saving}>
              {saving ? 'Zapisuję...' : 'Zapisz'}
            </Button>
          </div>
        </>
      }
    >
      <div className="coach-cal-label">Rodzaj</div>
      <div className="coach-chip-tabs" style={{ marginBottom: 14 }}>
        {EVENT_TYPES.map((t) => (
          <Chip key={t.value} active={type === t.value} onClick={() => changeType(t.value)}>
            <span className="coach-cal-dot" style={{ background: t.color }} />
            {t.label}
          </Chip>
        ))}
      </div>

      <FieldGrid>
        <Field label="Nazwa" full>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={TITLE_PLACEHOLDER[type]} autoFocus={!isEdit} />
        </Field>

        {isTraining && (
          <div className="coach-field-full">
            <label className="coach-cal-check">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              Powtarzaj co tydzień (stały trening drużyny)
            </label>
          </div>
        )}

        {isRecurring ? (
          <>
            <div className="coach-field-full">
              <div className="coach-cal-label">Dni tygodnia</div>
              <div className="coach-chip-tabs">
                {WEEKDAYS_SHORT.map((d, i) => (
                  <Chip key={d} active={weekdays.includes(i + 1)} onClick={() => toggleWeekday(i + 1)}>{d}</Chip>
                ))}
              </div>
            </div>
            <Field label="Od">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Do (koniec sezonu)">
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label={type === 'break' || type === 'camp' ? 'Od' : 'Data'}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Do (opcjonalnie, kilka dni)">
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </>
        )}

        {type !== 'break' && (
          <>
            <Field label="Godzina od">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="Godzina do">
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
            <Field label="Miejsce" full>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="np. Hala MOSiR, Warszawa" />
            </Field>
          </>
        )}

        <div className="coach-field-full">
          <div className="coach-cal-label">Dotyczy grup</div>
          <div className="coach-chip-tabs">
            <Chip active={allGroups} onClick={() => { setAllGroups(!allGroups); setGroupIds([]) }}>Wszystkie grupy</Chip>
            {groups.map((g) => (
              <Chip key={g.id} active={!allGroups && groupIds.includes(g.id)} onClick={() => toggleGroup(g.id)}>{g.name}</Chip>
            ))}
          </div>
        </div>

        {type === 'break' && (
          <div className="coach-field-full">
            <label className="coach-cal-check">
              <input type="checkbox" checked={cancelsTrainings} onChange={(e) => setCancelsTrainings(e.target.checked)} />
              W tym czasie nie ma treningów tych grup (nie liczą się do odliczania)
            </label>
          </div>
        )}

        <Field label="Notatki" full>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcjonalnie" />
        </Field>
      </FieldGrid>

      {error && <div style={{ color: '#c23b3b', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
    </Modal>
  )
}
