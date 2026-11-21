// src/lib/coach/calendar.ts
// Logika kalendarza sezonu: daty (bez stref czasowych — wszystko jako
// 'YYYY-MM-DD'), rozwijanie wydarzeń cyklicznych, przerwy bez treningów
// i liczenie treningów do wydarzenia (widżet odliczania).

export type EventType = 'competition' | 'show' | 'camp' | 'break' | 'training' | 'other'

export type CalGroup = { id: number; name: string; sort_order?: number | null }

export type CalEvent = {
  id: number
  title: string
  event_type: EventType
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
  group_ids: number[]
  all_groups: boolean
  recurrence_weekdays: number[] | null
  recurrence_until: string | null
  excluded_dates: string[]
  cancels_trainings: boolean
}

export type CalCountdown = {
  id: number
  event_id: number
  group_ids: number[]
  sort_order: number
}

export const EVENT_TYPES: { value: EventType; label: string; color: string; bg: string }[] = [
  { value: 'competition', label: 'Zawody', color: '#c23b3b', bg: '#fde8e8' },
  { value: 'show', label: 'Pokaz', color: '#7c3aed', bg: '#efe7fd' },
  { value: 'camp', label: 'Obóz', color: '#1f9d64', bg: '#e3f8ee' },
  { value: 'break', label: 'Ferie / przerwa', color: '#5b6b8c', bg: '#e8ecf3' },
  { value: 'training', label: 'Trening', color: '#b4761a', bg: '#fdf1de' },
  { value: 'other', label: 'Inne', color: '#173763', bg: '#e3e9f5' },
]

export function eventTypeInfo(t: string) {
  return EVENT_TYPES.find((e) => e.value === t) || EVENT_TYPES[EVENT_TYPES.length - 1]
}

// Priorytet przy kolorowaniu dnia w widoku sezonu (niższy = ważniejszy).
const TYPE_PRIORITY: Record<string, number> = { competition: 0, show: 1, camp: 2, break: 3, other: 4, training: 5 }
export function typePriority(t: string) {
  return TYPE_PRIORITY[t] ?? 9
}

export const WEEKDAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']
export const WEEKDAYS_LONG = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela']
export const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
export const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']

// ---------- daty ----------

export function parseISO(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysISO(s: string, n: number): string {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function todayISO(): string {
  return toISO(new Date())
}

/** Dzień tygodnia 1=pon ... 7=niedz */
export function weekdayISO(s: string): number {
  const w = parseISO(s).getDay()
  return w === 0 ? 7 : w
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  return Math.round((parseISO(toISOStr).getTime() - parseISO(fromISO).getTime()) / 86400000)
}

/** Sezon zaczyna się 1 września: listopad 2026 → 2026 (sezon 2026/27). */
export function seasonOfISO(s: string): number {
  const d = parseISO(s)
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
}

export function seasonRange(year: number): { start: string; end: string } {
  return { start: `${year}-09-01`, end: `${year + 1}-08-31` }
}

export function seasonLabel(year: number) {
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`
}

/** 12 miesięcy sezonu jako {year, month(0-11)} */
export function seasonMonths(year: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = []
  for (let i = 0; i < 12; i++) {
    const m = (8 + i) % 12
    out.push({ year: m >= 8 ? year : year + 1, month: m })
  }
  return out
}

export function formatDatePL(s: string, withWeekday = false): string {
  const d = parseISO(s)
  const base = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`
  return withWeekday ? `${WEEKDAYS_LONG[weekdayISO(s) - 1]}, ${base}` : base
}

export function formatShortPL(s: string): string {
  const d = parseISO(s)
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()].slice(0, 3)}`
}

export function formatTime(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

export function formatTimeRange(ev: Pick<CalEvent, 'start_time' | 'end_time'>): string {
  const a = formatTime(ev.start_time)
  const b = formatTime(ev.end_time)
  if (a && b) return `${a}–${b}`
  return a || ''
}

export function formatDateRange(ev: Pick<CalEvent, 'start_date' | 'end_date'>): string {
  if (!ev.end_date || ev.end_date === ev.start_date) return formatDatePL(ev.start_date)
  const a = parseISO(ev.start_date)
  const b = parseISO(ev.end_date)
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]} ${b.getFullYear()}`
  }
  return `${formatShortPL(ev.start_date)} – ${formatDatePL(ev.end_date)}`
}

/** "1 dzień", "2 dni", "5 dni" */
export function plDays(n: number) {
  return n === 1 ? '1 dzień' : `${n} dni`
}

/** "1 trening", "2 treningi", "5 treningów", "22 treningi" */
export function plTrainings(n: number) {
  if (n === 1) return '1 trening'
  const l = n % 10
  const t = n % 100
  if (l >= 2 && l <= 4 && (t < 12 || t > 14)) return `${n} treningi`
  return `${n} treningów`
}

// ---------- grupy ----------

export function eventGroupIds(ev: CalEvent, groups: CalGroup[]): number[] {
  return ev.all_groups ? groups.map((g) => g.id) : ev.group_ids
}

export function eventAppliesToGroup(ev: CalEvent, groupId: number) {
  return ev.all_groups || ev.group_ids.includes(groupId)
}

export function groupsLabel(ev: CalEvent, groups: CalGroup[]): string {
  if (ev.all_groups) return 'Wszystkie grupy'
  const names = ev.group_ids.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean)
  return names.length ? names.join(', ') : 'Brak grup'
}

// ---------- wystąpienia ----------

export type Occurrence = {
  event: CalEvent
  date: string
  /** trening odwołany (pojedynczo albo przez przerwę obejmującą wszystkie jego grupy) */
  cancelled: boolean
  /** odwołany ręcznie (excluded_dates) — można przywrócić */
  excluded: boolean
}

function isRecurring(ev: CalEvent) {
  return !!ev.recurrence_weekdays && ev.recurrence_weekdays.length > 0
}

/** Czy przerwa (cancels_trainings) obejmuje dany dzień dla grupy. */
function breakCoversGroup(breaks: CalEvent[], date: string, groupId: number) {
  return breaks.some(
    (b) => date >= b.start_date && date <= (b.end_date || b.start_date) && eventAppliesToGroup(b, groupId)
  )
}

/** Wszystkie wystąpienia wydarzeń w przedziale [from, to] (włącznie). */
export function expandOccurrences(events: CalEvent[], groups: CalGroup[], from: string, to: string): Occurrence[] {
  const breaks = events.filter((e) => e.event_type === 'break' && e.cancels_trainings)
  const out: Occurrence[] = []
  for (const ev of events) {
    if (isRecurring(ev)) {
      const first = ev.start_date > from ? ev.start_date : from
      const until = ev.recurrence_until && ev.recurrence_until < to ? ev.recurrence_until : to
      if (first > until) continue
      const days = new Set(ev.recurrence_weekdays)
      const excluded = new Set(ev.excluded_dates || [])
      for (let d = first; d <= until; d = addDaysISO(d, 1)) {
        if (!days.has(weekdayISO(d))) continue
        const isExcluded = excluded.has(d)
        let cancelled = isExcluded
        if (!cancelled && ev.event_type === 'training') {
          const gids = eventGroupIds(ev, groups)
          cancelled = gids.length > 0 && gids.every((g) => breakCoversGroup(breaks, d, g))
        }
        out.push({ event: ev, date: d, cancelled, excluded: isExcluded })
      }
    } else {
      const end = ev.end_date && ev.end_date > ev.start_date ? ev.end_date : ev.start_date
      const first = ev.start_date > from ? ev.start_date : from
      const last = end < to ? end : to
      for (let d = first; d <= last; d = addDaysISO(d, 1)) {
        out.push({ event: ev, date: d, cancelled: false, excluded: false })
      }
    }
  }
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const pa = typePriority(a.event.event_type)
    const pb = typePriority(b.event.event_type)
    if (pa !== pb) return pa - pb
    return (a.event.start_time || '').localeCompare(b.event.start_time || '')
  })
  return out
}

/** Liczba treningów grupy w przedziale [from, toExclusive). */
export function countTrainings(events: CalEvent[], groupId: number, from: string, toExclusive: string): number {
  if (from >= toExclusive) return 0
  const breaks = events.filter((e) => e.event_type === 'break' && e.cancels_trainings)
  const to = addDaysISO(toExclusive, -1)
  let n = 0
  for (const ev of events) {
    if (ev.event_type !== 'training' || !eventAppliesToGroup(ev, groupId)) continue
    if (!isRecurring(ev)) {
      // pojedynczy (niecykliczny) trening też się liczy
      if (ev.start_date >= from && ev.start_date <= to && !breakCoversGroup(breaks, ev.start_date, groupId)) n++
      continue
    }
    const first = ev.start_date > from ? ev.start_date : from
    const until = ev.recurrence_until && ev.recurrence_until < to ? ev.recurrence_until : to
    const days = new Set(ev.recurrence_weekdays)
    const excluded = new Set(ev.excluded_dates || [])
    for (let d = first; d <= until; d = addDaysISO(d, 1)) {
      if (!days.has(weekdayISO(d)) || excluded.has(d)) continue
      if (breakCoversGroup(breaks, d, groupId)) continue
      n++
    }
  }
  return n
}

/** Grupy, dla których widżet liczy treningi. */
export function countdownGroupIds(cd: CalCountdown, ev: CalEvent | undefined, groups: CalGroup[]): number[] {
  if (cd.group_ids.length) return cd.group_ids
  if (!ev) return []
  return eventGroupIds(ev, groups)
}

/** Siatka miesiąca: tygodnie od poniedziałku, null = dzień spoza miesiąca. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(year, month, d)))
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function normalizeEvent(row: Record<string, unknown>): CalEvent {
  const r = row as Partial<CalEvent> & { id: number }
  return {
    id: Number(r.id),
    title: r.title || '',
    event_type: (r.event_type as EventType) || 'other',
    start_date: String(r.start_date).slice(0, 10),
    end_date: r.end_date ? String(r.end_date).slice(0, 10) : null,
    start_time: r.start_time || null,
    end_time: r.end_time || null,
    location: r.location || null,
    notes: r.notes || null,
    group_ids: (r.group_ids || []).map(Number),
    all_groups: !!r.all_groups,
    recurrence_weekdays: r.recurrence_weekdays ? r.recurrence_weekdays.map(Number) : null,
    recurrence_until: r.recurrence_until ? String(r.recurrence_until).slice(0, 10) : null,
    excluded_dates: (r.excluded_dates || []).map((d) => String(d).slice(0, 10)),
    cancels_trainings: !!r.cancels_trainings,
  }
}

export function normalizeCountdown(row: Record<string, unknown>): CalCountdown {
  const r = row as Partial<CalCountdown> & { id: number }
  return {
    id: Number(r.id),
    event_id: Number(r.event_id),
    group_ids: (r.group_ids || []).map(Number),
    sort_order: Number(r.sort_order || 0),
  }
}
