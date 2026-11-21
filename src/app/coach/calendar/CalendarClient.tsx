'use client'
// src/app/coach/calendar/CalendarClient.tsx
// Kalendarz sezonu (wrzesień–sierpień): widok miesiąca, całego sezonu i listy.
// Wydarzenia przypisane do grup + cykliczne treningi drużyn + widżety odliczania.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Users, Repeat, Pencil, Ban, RotateCcw } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Chip, Button, Modal } from '@/components/coach/ui'
import CountdownPanel from '@/components/coach/calendar/CountdownPanel'
import EventModal from '@/components/coach/calendar/EventModal'
import { createClient } from '@/utils/supabase/client'
import {
  CalCountdown,
  CalEvent,
  CalGroup,
  EventType,
  EVENT_TYPES,
  MONTHS,
  Occurrence,
  WEEKDAYS_SHORT,
  eventAppliesToGroup,
  eventTypeInfo,
  expandOccurrences,
  formatDatePL,
  formatDateRange,
  formatTimeRange,
  groupsLabel,
  monthGrid,
  normalizeEvent,
  parseISO,
  seasonLabel,
  seasonMonths,
  seasonOfISO,
  seasonRange,
  todayISO,
  typePriority,
  WEEKDAYS_LONG,
} from '@/lib/coach/calendar'

type View = 'month' | 'season' | 'list'

interface Props {
  groups: CalGroup[]
  initialEvents: CalEvent[]
  initialCountdowns: CalCountdown[]
  loadError: string | null
}

export default function CalendarClient({ groups, initialEvents, initialCountdowns, loadError }: Props) {
  const router = useRouter()
  const today = todayISO()
  const [events, setEvents] = useState<CalEvent[]>(initialEvents)
  const [countdowns, setCountdowns] = useState<CalCountdown[]>(initialCountdowns)
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(today)
  const [groupFilter, setGroupFilter] = useState<number | 'all'>('all')
  const [showTrainings, setShowTrainings] = useState(true)
  const [editor, setEditor] = useState<{ event: CalEvent | null; date: string; type?: EventType } | null>(null)
  const [detail, setDetail] = useState<Occurrence | null>(null)

  const season = seasonOfISO(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-01`)
  const { start: rangeStart, end: rangeEnd } = seasonRange(season)

  // wystąpienia całego sezonu — wyliczane z pełnej listy wydarzeń (żeby przerwy
  // innych grup dalej odwoływały treningi), potem filtrowane do widocznych.
  // (memoizację robi React Compiler)
  const visibleIds = new Set(
    events
      .filter((e) =>
        (showTrainings || e.event_type !== 'training') &&
        (groupFilter === 'all' || eventAppliesToGroup(e, groupFilter))
      )
      .map((e) => e.id)
  )
  const seasonOcc = expandOccurrences(events, groups, rangeStart, rangeEnd).filter((o) => visibleIds.has(o.event.id))
  const occByDate = new Map<string, Occurrence[]>()
  for (const o of seasonOcc) {
    const arr = occByDate.get(o.date) || []
    arr.push(o)
    occByDate.set(o.date, arr)
  }

  function moveMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function moveSeason(delta: number) {
    setCursor((c) => ({ year: c.year + delta, month: c.month }))
  }

  function goToday() {
    const d = new Date()
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
    setSelectedDate(today)
  }

  function openDay(date: string) {
    const d = parseISO(date)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
    setSelectedDate(date)
    setView('month')
  }

  function handleSaved(ev: CalEvent) {
    setEvents((cur) => {
      const exists = cur.some((e) => e.id === ev.id)
      return exists ? cur.map((e) => (e.id === ev.id ? ev : e)) : [...cur, ev]
    })
    setEditor(null)
    setDetail(null)
    router.refresh()
  }

  function handleDeleted(id: number) {
    setEvents((cur) => cur.filter((e) => e.id !== id))
    setCountdowns((cur) => cur.filter((c) => c.event_id !== id))
    setEditor(null)
    setDetail(null)
    router.refresh()
  }

  async function toggleExcluded(occ: Occurrence) {
    const ev = occ.event
    const set = new Set(ev.excluded_dates)
    if (set.has(occ.date)) set.delete(occ.date)
    else set.add(occ.date)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ excluded_dates: Array.from(set).sort() })
      .eq('id', ev.id)
      .select()
      .single()
    if (error) { alert('Błąd: ' + error.message); return }
    handleSaved(normalizeEvent(data))
  }

  const selectedOcc = occByDate.get(selectedDate) || []

  return (
    <>
      <SetPageMeta title="Kalendarz" />
      <div className="coach-content">
        {loadError && (
          <Card>
            <div className="coach-empty-state">
              <div className="coach-empty-title">Kalendarz nie jest jeszcze gotowy w bazie</div>
              <div className="coach-empty-sub">
                Uruchom migrację <code>202611210002_calendar.sql</code> w Supabase SQL Editor. ({loadError})
              </div>
            </div>
          </Card>
        )}

        <CountdownPanel
          events={events}
          groups={groups}
          countdowns={countdowns}
          onCountdownsChange={setCountdowns}
        />

        <Card>
          <div className="coach-cal-toolbar">
            <div className="coach-cal-season">
              <button className="coach-cal-nav" onClick={() => moveSeason(-1)} title="Poprzedni sezon"><ChevronLeft size={16} /></button>
              <div>
                <div className="coach-cal-season-label">Sezon {seasonLabel(season)}</div>
                <div className="coach-sub">1 września {season} – 31 sierpnia {season + 1}</div>
              </div>
              <button className="coach-cal-nav" onClick={() => moveSeason(1)} title="Następny sezon"><ChevronRight size={16} /></button>
            </div>
            <div className="coach-cal-toolbar-right">
              <div className="coach-chip-tabs">
                <Chip active={view === 'month'} onClick={() => setView('month')}>Miesiąc</Chip>
                <Chip active={view === 'season'} onClick={() => setView('season')}>Cały sezon</Chip>
                <Chip active={view === 'list'} onClick={() => setView('list')}>Lista</Chip>
              </div>
              <Button size="small" variant="ghost" onClick={() => setEditor({ event: null, date: selectedDate, type: 'training' })}>
                <Repeat size={13} /> Trening
              </Button>
              <Button size="small" variant="dark" onClick={() => setEditor({ event: null, date: selectedDate })}>
                <Plus size={13} /> Wydarzenie
              </Button>
            </div>
          </div>

          <div className="coach-cal-filters">
            <div className="coach-chip-tabs">
              <Chip active={groupFilter === 'all'} onClick={() => setGroupFilter('all')}>Wszystkie grupy</Chip>
              {groups.map((g) => (
                <Chip key={g.id} active={groupFilter === g.id} onClick={() => setGroupFilter(g.id)}>{g.name}</Chip>
              ))}
            </div>
            <label className="coach-cal-check">
              <input type="checkbox" checked={showTrainings} onChange={(e) => setShowTrainings(e.target.checked)} />
              Pokaż treningi
            </label>
          </div>

          <div className="coach-cal-legend">
            {EVENT_TYPES.map((t) => (
              <span key={t.value}><span className="coach-cal-dot" style={{ background: t.color }} />{t.label}</span>
            ))}
          </div>

          {view === 'month' && (
            <MonthView
              year={cursor.year}
              month={cursor.month}
              occByDate={occByDate}
              groups={groups}
              today={today}
              selectedDate={selectedDate}
              onPrev={() => moveMonth(-1)}
              onNext={() => moveMonth(1)}
              onToday={goToday}
              onSelectDate={setSelectedDate}
              onOpenOcc={setDetail}
            />
          )}

          {view === 'season' && (
            <SeasonView season={season} occByDate={occByDate} today={today} onOpenDay={openDay} />
          )}

          {view === 'list' && (
            <ListView occurrences={seasonOcc} groups={groups} today={today} onOpen={setDetail} />
          )}
        </Card>

        {view === 'month' && (
          <Card
            title={formatDatePL(selectedDate, true)}
            sub={selectedOcc.length ? `${selectedOcc.length} w kalendarzu` : 'Brak wydarzeń'}
            headerAction={
              <Button size="small" variant="ghost" onClick={() => setEditor({ event: null, date: selectedDate })}>
                <Plus size={13} /> Dodaj
              </Button>
            }
          >
            <div className="coach-cal-agenda">
              {selectedOcc.length === 0 ? (
                <div className="coach-empty-sub" style={{ padding: '0 18px 16px' }}>Nic tego dnia. Kliknij „Dodaj”, żeby wpisać wydarzenie.</div>
              ) : (
                selectedOcc.map((o) => (
                  <OccRow key={`${o.event.id}-${o.date}`} occ={o} groups={groups} onClick={() => setDetail(o)} />
                ))
              )}
            </div>
          </Card>
        )}
      </div>

      {detail && (
        <DetailModal
          occ={detail}
          groups={groups}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditor({ event: detail.event, date: detail.date }); setDetail(null) }}
          onToggleExcluded={() => toggleExcluded(detail)}
        />
      )}

      {editor && (
        <EventModal
          event={editor.event}
          defaultDate={editor.date}
          defaultType={editor.type}
          groups={groups}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </>
  )
}

// ---------- Miesiąc ----------

function MonthView({
  year, month, occByDate, groups, today, selectedDate, onPrev, onNext, onToday, onSelectDate, onOpenOcc,
}: {
  year: number
  month: number
  occByDate: Map<string, Occurrence[]>
  groups: CalGroup[]
  today: string
  selectedDate: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onSelectDate: (d: string) => void
  onOpenOcc: (o: Occurrence) => void
}) {
  const weeks = monthGrid(year, month)
  return (
    <div className="coach-cal-month">
      <div className="coach-cal-month-head">
        <button className="coach-cal-nav" onClick={onPrev}><ChevronLeft size={16} /></button>
        <div className="coach-cal-month-title">{MONTHS[month]} {year}</div>
        <button className="coach-cal-nav" onClick={onNext}><ChevronRight size={16} /></button>
        <Button size="small" variant="ghost" onClick={onToday} style={{ marginLeft: 8 }}>Dziś</Button>
      </div>
      <div className="coach-cal-grid">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="coach-cal-wd">{d}</div>
        ))}
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`e${i}`} className="coach-cal-cell coach-cal-cell-empty" />
          const occ = occByDate.get(date) || []
          const cls = [
            'coach-cal-cell',
            date === today ? 'coach-cal-today' : '',
            date === selectedDate ? 'coach-cal-selected' : '',
            date < today ? 'coach-cal-past' : '',
          ].filter(Boolean).join(' ')
          return (
            <div key={date} className={cls} onClick={() => onSelectDate(date)}>
              <div className="coach-cal-daynum">{parseISO(date).getDate()}</div>
              <div className="coach-cal-pills">
                {occ.slice(0, 4).map((o) => {
                  const info = eventTypeInfo(o.event.event_type)
                  const isTr = o.event.event_type === 'training'
                  const label = isTr ? shortGroups(o.event, groups) || o.event.title : o.event.title
                  return (
                    <div
                      key={o.event.id}
                      className={`coach-cal-pill${o.cancelled ? ' coach-cal-cancelled' : ''}`}
                      style={{ background: info.bg, color: info.color, borderLeftColor: info.color }}
                      title={`${o.event.title}${formatTimeRange(o.event) ? ' · ' + formatTimeRange(o.event) : ''}`}
                      onClick={(e) => { e.stopPropagation(); onSelectDate(date); onOpenOcc(o) }}
                    >
                      {isTr && o.event.start_time ? <b>{o.event.start_time.slice(0, 5)} </b> : null}
                      {label}
                    </div>
                  )
                })}
                {occ.length > 4 && <div className="coach-cal-more">+{occ.length - 4}</div>}
              </div>
              <div className="coach-cal-dots">
                {occ.slice(0, 4).map((o) => (
                  <span key={o.event.id} className="coach-cal-dot" style={{ background: eventTypeInfo(o.event.event_type).color, opacity: o.cancelled ? 0.3 : 1 }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function shortGroups(ev: CalEvent, groups: CalGroup[]) {
  if (ev.all_groups) return 'Wszystkie'
  return ev.group_ids.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ')
}

// ---------- Sezon ----------

function SeasonView({
  season, occByDate, today, onOpenDay,
}: {
  season: number
  occByDate: Map<string, Occurrence[]>
  today: string
  onOpenDay: (d: string) => void
}) {
  return (
    <div className="coach-cal-season-grid">
      {seasonMonths(season).map(({ year, month }) => {
        const weeks = monthGrid(year, month)
        const monthEvents = new Map<number, Occurrence>()
        for (const w of weeks) for (const d of w) {
          if (!d) continue
          for (const o of occByDate.get(d) || []) {
            if (o.event.event_type !== 'training' && !monthEvents.has(o.event.id)) monthEvents.set(o.event.id, o)
          }
        }
        return (
          <div key={`${year}-${month}`} className="coach-cal-mini">
            <div className="coach-cal-mini-title" onClick={() => onOpenDay(`${year}-${String(month + 1).padStart(2, '0')}-01`)}>
              {MONTHS[month]} <span>{year}</span>
            </div>
            <div className="coach-cal-mini-grid">
              {WEEKDAYS_SHORT.map((d) => <div key={d} className="coach-cal-mini-wd">{d[0]}</div>)}
              {weeks.flat().map((date, i) => {
                if (!date) return <div key={`e${i}`} />
                const occ = (occByDate.get(date) || []).filter((o) => !o.cancelled)
                const main = occ
                  .filter((o) => o.event.event_type !== 'training')
                  .sort((a, b) => typePriority(a.event.event_type) - typePriority(b.event.event_type))[0]
                const hasTraining = occ.some((o) => o.event.event_type === 'training')
                const info = main ? eventTypeInfo(main.event.event_type) : null
                return (
                  <div
                    key={date}
                    className={`coach-cal-mini-day${date === today ? ' coach-cal-today' : ''}${date < today ? ' coach-cal-past' : ''}`}
                    style={info ? { background: info.color, color: '#fff' } : undefined}
                    title={occ.map((o) => o.event.title).join(', ')}
                    onClick={() => onOpenDay(date)}
                  >
                    {parseISO(date).getDate()}
                    {hasTraining && !info && <span className="coach-cal-mini-tr" />}
                  </div>
                )
              })}
            </div>
            {monthEvents.size > 0 && (
              <div className="coach-cal-mini-list">
                {Array.from(monthEvents.values()).map((o) => (
                  <div key={o.event.id} onClick={() => onOpenDay(o.date)}>
                    <span className="coach-cal-dot" style={{ background: eventTypeInfo(o.event.event_type).color }} />
                    <b>{parseISO(o.event.start_date).getDate()}.</b> {o.event.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Lista ----------

function ListView({
  occurrences, groups, today, onOpen,
}: {
  occurrences: Occurrence[]
  groups: CalGroup[]
  today: string
  onOpen: (o: Occurrence) => void
}) {
  // jedno wystąpienie na wydarzenie (pierwszy dzień), bez treningów
  const items = useMemo(() => {
    const seen = new Set<number>()
    const out: Occurrence[] = []
    for (const o of occurrences) {
      if (o.event.event_type === 'training' || seen.has(o.event.id)) continue
      seen.add(o.event.id)
      out.push(o)
    }
    return out
  }, [occurrences])

  if (items.length === 0) {
    return <div className="coach-empty-sub" style={{ padding: '6px 18px 18px' }}>Brak wydarzeń w tym sezonie.</div>
  }

  let lastMonth = ''
  return (
    <div className="coach-cal-list">
      {items.map((o) => {
        const d = parseISO(o.event.start_date)
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`
        const header = monthKey !== lastMonth ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : null
        lastMonth = monthKey
        return (
          <div key={o.event.id}>
            {header && <div className="coach-cal-list-month">{header}</div>}
            <OccRow occ={o} groups={groups} onClick={() => onOpen(o)} showDate dim={(o.event.end_date || o.event.start_date) < today} />
          </div>
        )
      })}
    </div>
  )
}

// ---------- wspólne ----------

function OccRow({
  occ, groups, onClick, showDate, dim,
}: {
  occ: Occurrence
  groups: CalGroup[]
  onClick: () => void
  showDate?: boolean
  dim?: boolean
}) {
  const ev = occ.event
  const info = eventTypeInfo(ev.event_type)
  const time = formatTimeRange(ev)
  return (
    <div className={`coach-cal-row${dim ? ' coach-cal-past' : ''}${occ.cancelled ? ' coach-cal-cancelled' : ''}`} onClick={onClick}>
      <div className="coach-cal-row-bar" style={{ background: info.color }} />
      <div className="coach-cal-row-body">
        <div className="coach-cal-row-top">
          <span className="coach-cal-row-type" style={{ color: info.color, background: info.bg }}>{info.label}</span>
          <span className="coach-cal-row-title">{ev.title}</span>
          {occ.cancelled && <span className="coach-cal-row-type" style={{ color: '#c23b3b', background: '#fde8e8' }}>Odwołany</span>}
        </div>
        <div className="coach-cal-row-meta">
          {showDate && <span>{formatDateRange(ev)}</span>}
          {time && <span><Clock size={11} /> {time}</span>}
          {ev.location && <span><MapPin size={11} /> {ev.location}</span>}
          <span><Users size={11} /> {groupsLabel(ev, groups)}</span>
        </div>
      </div>
      <ChevronRight size={15} className="coach-cal-row-chev" />
    </div>
  )
}

function DetailModal({
  occ, groups, onClose, onEdit, onToggleExcluded,
}: {
  occ: Occurrence
  groups: CalGroup[]
  onClose: () => void
  onEdit: () => void
  onToggleExcluded: () => void
}) {
  const ev = occ.event
  const info = eventTypeInfo(ev.event_type)
  const recurring = !!ev.recurrence_weekdays?.length
  const time = formatTimeRange(ev)
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={info.label}
      title={ev.title}
      sub={recurring ? formatDatePL(occ.date, true) : formatDateRange(ev)}
      footer={
        <>
          {recurring ? (
            <Button variant="ghost" onClick={onToggleExcluded} style={occ.excluded ? undefined : { color: '#c23b3b' }}>
              {occ.excluded ? <><RotateCcw size={13} /> Przywróć ten trening</> : <><Ban size={13} /> Odwołaj ten dzień</>}
            </Button>
          ) : <span />}
          <Button variant="dark" onClick={onEdit}>
            <Pencil size={13} /> {recurring ? 'Edytuj serię' : 'Edytuj'}
          </Button>
        </>
      }
    >
      <div className="coach-cal-detail">
        {recurring && (
          <div><Repeat size={13} /> Co tydzień: {ev.recurrence_weekdays!.map((d) => WEEKDAYS_LONG[d - 1]).join(', ')}
            {ev.recurrence_until ? ` (do ${formatDatePL(ev.recurrence_until)})` : ''}
          </div>
        )}
        {time && <div><Clock size={13} /> {time}</div>}
        {ev.location && <div><MapPin size={13} /> {ev.location}</div>}
        <div><Users size={13} /> {groupsLabel(ev, groups)}</div>
        {ev.event_type === 'break' && ev.cancels_trainings && <div><Ban size={13} /> Bez treningów w tym czasie</div>}
        {occ.cancelled && !occ.excluded && <div style={{ color: '#c23b3b' }}><Ban size={13} /> Trening nie odbywa się (przerwa w kalendarzu)</div>}
        {occ.excluded && <div style={{ color: '#c23b3b' }}><Ban size={13} /> Ten trening jest odwołany</div>}
        {ev.notes && <div className="coach-cal-detail-notes">{ev.notes}</div>}
      </div>
    </Modal>
  )
}
