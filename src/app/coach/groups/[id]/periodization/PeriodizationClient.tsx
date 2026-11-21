'use client'
// src/app/coach/groups/[id]/periodization/PeriodizationClient.tsx
// Zakładka „Periodyzacja” w profilu drużyny.
// Program treningowy → Makrocykl → Mezocykl → Mikrocykl (tydzień planu) → Jednostka (trening planu).
// Ćwiczenia jednostek edytuje istniejący edytor planu, wyniki — „Uzupełnij” (DayFill),
// przypisania — athlete_workout_assignments, indywidualne zmiany — karta treningu zawodniczki.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  Plus, Pencil, Copy, Trash2, ChevronUp, ChevronDown, ChevronRight, Archive, ArchiveRestore,
  BookmarkPlus, Users, Dumbbell, ClipboardEdit, UserX, CalendarDays, RefreshCw, Layers, FolderInput,
} from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { TabsNav, TabsState, Card, Modal, Field, FieldGrid, Button, StatCard, Chip } from '@/components/coach/ui'
import GroupHero from '@/components/coach/GroupHero'
import { groupTabs } from '@/components/coach/groupTabs'
import { deactivateGroupAssignments, insertAssignments } from '@/lib/coach/planAssignments'
import { eventTypeInfo, EVENT_TYPES } from '@/lib/coach/calendar'
import {
  type Program, type Macrocycle, type Mesocycle, type Microcycle, type Unit, type SessionInfo, type UnitStatus, type Tally,
  MESO_GOALS, PHASE_LABEL, STATUS_INFO, programPhase, todayStr, addDays, diffDays, mondayOf, shiftDate, fmtShort, fmtRange, weekdayShort,
  copyProgram, copyMicrocycle, copyUnit, unitTemplateWeek, renumberPlanWeeks, syncMesocycle,
  unitStatusFor, emptyTally, addToTally, realization, progress,
} from '@/lib/coach/periodization'

type Athlete = { id: number; full_name: string }
type Assignment = { id: number; athlete_id: number; is_active: boolean; assignment_type?: string | null }
type CalEventLite = { id: number; title: string; event_type: string; start_date: string; end_date: string | null }

interface Props {
  group: any
  athletes: Athlete[]
  programs: Program[]
  selected: Program | null
  macros?: Macrocycle[]
  mesos?: Mesocycle[]
  weeks?: Microcycle[]
  units?: Unit[]
  assignments?: Assignment[]
  sessions?: SessionInfo[]
  unitTemplates?: { id: number; day_name: string | null; goal: string | null }[]
  events?: CalEventLite[]
  migrationMissing?: boolean
}

// ---------- formularz w modalu ----------
type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox' | 'weekdays' | 'athletes'
  options?: { value: string; label: string }[]
  suggestions?: string[]
  full?: boolean
  hint?: string
  min?: number
  max?: number
}
type FormModalState = {
  kind: 'form'
  title: string
  eyebrow?: string
  sub?: string
  fields: FieldDef[]
  initial: Record<string, any>
  submitLabel?: string
  onSubmit: (v: Record<string, any>) => Promise<void | string>
}
type ModalState = FormModalState | { kind: 'assign' }

const INTER = 'var(--font-inter), sans-serif'
const muted: React.CSSProperties = { fontFamily: INTER, fontSize: '0.74rem', color: 'var(--muted)' }
const eyebrow: React.CSSProperties = { fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }
const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: '#fff', color: 'var(--navy-900)', cursor: 'pointer', padding: 0 }
const WEEKDAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']
const GOAL_COLORS = ['#173763', '#b4761a', '#c23b3b', '#7c3aed', '#1f9d64', '#0e7490', '#be185d', '#5b6b8c', '#65a30d']
const goalColor = (goal: string | null | undefined) => {
  if (!goal) return '#5b6b8c'
  const i = MESO_GOALS.indexOf(goal)
  if (i >= 0) return GOAL_COLORS[i % GOAL_COLORS.length]
  let h = 0
  for (const c of goal) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return GOAL_COLORS[h % GOAL_COLORS.length]
}

function IconBtn({ title, onClick, children, disabled, danger }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} style={{ ...iconBtn, color: danger ? '#c23b3b' : iconBtn.color, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  )
}

function Bar({ pct, color = 'var(--gold)' }: { pct: number | null; color?: string }) {
  return (
    <div style={{ height: 6, background: 'var(--border)', borderRadius: 100, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, background: color, borderRadius: 100 }} />
    </div>
  )
}

function Pill({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <span style={{ fontFamily: INTER, fontSize: '0.62rem', fontWeight: 700, color, background: bg, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>{children}</span>
}

function FormModal({ state, athletes, onClose }: { state: FormModalState; athletes: Athlete[]; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, any>>(state.initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setValues(prev => ({ ...prev, [k]: v }))

  async function submit() {
    setBusy(true); setErr('')
    try {
      const res = await state.onSubmit(values)
      if (typeof res === 'string') { setErr(res); setBusy(false); return }
      onClose()
    } catch (e: any) {
      setErr(e?.message || String(e))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={state.title} eyebrow={state.eyebrow} sub={state.sub}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button variant="dark" onClick={submit} disabled={busy} style={{ color: 'var(--gold)' }}>{busy ? 'Zapisuję…' : (state.submitLabel || 'Zapisz')}</Button>
      </>}
    >
      <FieldGrid>
        {state.fields.map(f => {
          const v = values[f.key]
          let input: React.ReactNode
          if (f.type === 'textarea') input = <textarea rows={3} value={v ?? ''} onChange={e => set(f.key, e.target.value)} />
          else if (f.type === 'select') input = (
            <select value={v ?? ''} onChange={e => set(f.key, e.target.value)}>
              {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )
          else if (f.type === 'checkbox') input = (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: INTER, fontSize: '0.82rem', color: 'var(--ink)', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!v} onChange={e => set(f.key, e.target.checked)} style={{ width: 16, height: 16 }} />
              {f.hint}
            </label>
          )
          else if (f.type === 'weekdays') {
            const sel: number[] = v || []
            input = (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WEEKDAY_LABELS.map((l, i) => (
                  <Chip key={l} active={sel.includes(i)} onClick={() => set(f.key, sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i].sort())}>{l}</Chip>
                ))}
              </div>
            )
          } else if (f.type === 'athletes') {
            const sel: number[] = v || []
            input = (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
                {athletes.map(a => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: INTER, fontSize: '0.8rem', padding: '4px 2px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sel.includes(a.id)} onChange={e => set(f.key, e.target.checked ? [...sel, a.id] : sel.filter(x => x !== a.id))} />
                    {a.full_name}
                  </label>
                ))}
              </div>
            )
          } else input = (
            <>
              <input
                type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                min={f.min} max={f.max}
                value={v ?? ''}
                list={f.suggestions ? `dl-${f.key}` : undefined}
                onChange={e => set(f.key, e.target.value)}
              />
              {f.suggestions && <datalist id={`dl-${f.key}`}>{f.suggestions.map(s => <option key={s} value={s} />)}</datalist>}
            </>
          )
          return (
            <Field key={f.key} label={f.label} full={f.full || f.type === 'textarea' || f.type === 'checkbox' || f.type === 'athletes' || f.type === 'weekdays'}>
              {input}
              {f.hint && f.type !== 'checkbox' && <div style={{ ...muted, fontSize: '0.68rem', marginTop: 4 }}>{f.hint}</div>}
            </Field>
          )
        })}
      </FieldGrid>
      {err && <div style={{ marginTop: 12, color: '#c23b3b', fontFamily: INTER, fontSize: '0.8rem', fontWeight: 700 }}>{err}</div>}
    </Modal>
  )
}

  // ---------- przypisanie ----------
function AssignModal({ selected, athletes, activeAssigned, groupIds, planId, onClose }: { selected: Program; athletes: Athlete[]; activeAssigned: Set<number>; groupIds: Set<number>; planId: number | null; onClose: () => void }) {
const router = useRouter()
const supabase = createClient()
  const [mode, setMode] = useState<'all' | 'selected'>(activeAssigned.size && activeAssigned.size < athletes.length ? 'selected' : 'all')
  const [sel, setSel] = useState<number[]>(activeAssigned.size ? [...activeAssigned].filter(id => groupIds.has(id)) : athletes.map(a => a.id))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!planId) return
    setSaving(true); setErr('')
    try {
      const chosen = mode === 'all' ? athletes.map(a => a.id) : sel
      const toAdd = chosen.filter(id => !activeAssigned.has(id))
      const toRemove = [...activeAssigned].filter(id => groupIds.has(id) && !chosen.includes(id))
      if (toRemove.length) await supabase.from('athlete_workout_assignments').update({ is_active: false }).eq('plan_id', planId).in('athlete_id', toRemove).eq('is_active', true)
      if (toAdd.length) {
        await deactivateGroupAssignments(supabase, toAdd)
        await insertAssignments(supabase, toAdd.map(athlete_id => ({ athlete_id, plan_id: planId })), 'group')
      }
      onClose()
      router.refresh()
    } catch (e: any) { setErr(e?.message || String(e)); setSaving(false) }
  }
  return (
    <Modal open wide onClose={() => onClose()} title="Przypisanie programu" eyebrow={selected?.name}
      sub="Zawodniczki z przypisaniem widzą treningi programu u siebie. Wcześniejszy plan grupowy przestaje być aktywny (wpisy zostają), plany indywidualne zostają."
      footer={<>
        <Button variant="ghost" onClick={() => onClose()}>Anuluj</Button>
        <Button variant="dark" onClick={save} disabled={saving} style={{ color: 'var(--gold)' }}>{saving ? 'Zapisuję…' : 'Zapisz przypisanie'}</Button>
      </>}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Chip active={mode === 'all'} onClick={() => setMode('all')}>Cała drużyna ({athletes.length})</Chip>
        <Chip active={mode === 'selected'} onClick={() => setMode('selected')}>Wybrane zawodniczki</Chip>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2 }}>
        {athletes.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', borderBottom: '1px solid var(--border)' }}>
            <input type="checkbox" disabled={mode === 'all'} checked={mode === 'all' || sel.includes(a.id)} onChange={e => setSel(e.target.checked ? [...sel, a.id] : sel.filter(x => x !== a.id))} />
            <span style={{ flex: 1, fontFamily: INTER, fontSize: '0.82rem' }}>{a.full_name}</span>
            {activeAssigned.has(a.id) && <Pill color="#15803d" bg="#e3f6ea">aktywny</Pill>}
            <Link href={`/coach/athletes/${a.id}/training`} title="Indywidualne modyfikacje treningów tej zawodniczki" style={{ fontFamily: INTER, fontSize: '0.66rem', color: 'var(--muted)' }}>zmiany →</Link>
          </div>
        ))}
      </div>
      <div style={{ ...muted, fontSize: '0.7rem', marginTop: 12, lineHeight: 1.5 }}>
        <b>Indywidualne modyfikacje</b> („zmiany →” albo parametry zawodniczki w edytorze ćwiczeń) zapisują się tylko dla tej zawodniczki — bazowy program drużyny się nie zmienia.
        Wyłączenie zawodniczki z pojedynczej jednostki: ikona <UserX size={11} style={{ verticalAlign: 'middle' }} /> przy treningu.
      </div>
      {err && <div style={{ marginTop: 10, color: '#c23b3b', fontFamily: INTER, fontSize: '0.8rem', fontWeight: 700 }}>{err}</div>}
    </Modal>
  )
}


export default function PeriodizationClient(props: Props) {
  const {
    group, athletes, programs, selected, macros = [], mesos = [], weeks = [], units = [], assignments = [],
    sessions = [], unitTemplates = [], events = [], migrationMissing,
  } = props
  const router = useRouter()
  const supabase = createClient()
  const gid = group.id as number
  const today = todayStr()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'structure' | 'timeline' | 'stats'>('structure')
  const [listFilter, setListFilter] = useState<'current' | 'history' | 'templates'>(selected?.is_template ? 'templates' : selected && (selected.archived || programPhase(selected) === 'finished') ? 'history' : 'current')
  const [modal, setModal] = useState<ModalState | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setCollapsed(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  const openForm = (s: Omit<FormModalState, 'kind'>) => setModal({ kind: 'form', ...s })
  const goProgram = (id: number) => router.push(`/coach/groups/${gid}/periodization?p=${id}`)

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError('')
    try { await fn(); router.refresh() } catch (e: any) { setError(e?.message || String(e)) } finally { setBusy(false) }
  }

  // ---------- dane pochodne ----------
  const planId = selected?.plan_id ?? null
  const sortedMacros = useMemo(() => [...macros].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id), [macros])
  const sortedMesos = useMemo(() => [...mesos].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id), [mesos])
  const sortedWeeks = useMemo(() => [...weeks].sort((a, b) => a.week_number - b.week_number), [weeks])
  const mesoIds = new Set(mesos.map(m => m.id))
  const macroIds = new Set(macros.map(m => m.id))
  const unitsByWeek = useMemo(() => {
    const m = new Map<number, Unit[]>()
    for (const u of units) { if (!m.has(u.week_id)) m.set(u.week_id, []); m.get(u.week_id)!.push(u) }
    for (const list of m.values()) list.sort((a, b) => (a.training_date || '9999').localeCompare(b.training_date || '9999') || a.day_order - b.day_order)
    return m
  }, [units])
  const weeksOfMeso = (mesoId: number | null) => sortedWeeks.filter(w => mesoId == null ? (w.mesocycle_id == null || !mesoIds.has(w.mesocycle_id)) : w.mesocycle_id === mesoId)
  const mesosOfMacro = (macroId: number | null) => sortedMesos.filter(m => macroId == null ? (m.macrocycle_id == null || !macroIds.has(m.macrocycle_id)) : m.macrocycle_id === macroId)

  const sessionByKey = useMemo(() => new Map(sessions.map(s => [`${s.workout_day_id}_${s.athlete_id}`, s])), [sessions])
  const sessionDays = useMemo(() => new Set(sessions.map(s => s.workout_day_id)), [sessions])
  const activeAssigned = useMemo(() => new Set(assignments.filter(a => a.is_active).map(a => a.athlete_id)), [assignments])
  const groupIds = new Set(athletes.map(a => a.id))
  // do realizacji: zawodniczki z przypisaniem do planu programu (także archiwalnym) lub z sesją
  const statsAthletes = useMemo(() => {
    const ids = new Set<number>([...assignments.map(a => a.athlete_id), ...sessions.map(s => s.athlete_id)])
    const list = athletes.filter(a => ids.has(a.id))
    return list.length ? list : athletes
  }, [assignments, sessions, athletes])
  const noAssignments = assignments.length === 0

  function tally(unitList: Unit[], athleteList: Athlete[] = statsAthletes): Tally {
    const t = emptyTally()
    for (const u of unitList) for (const a of athleteList) {
      const s = sessionByKey.get(`${u.id}_${a.id}`)
      addToTally(t, unitStatusFor(u, a.id, s, today), s)
    }
    return t
  }
  const unitsOfWeeks = (ws: Microcycle[]) => ws.flatMap(w => unitsByWeek.get(w.id) || [])
  const unitsOfMeso = (m: Mesocycle) => unitsOfWeeks(sortedWeeks.filter(w => w.mesocycle_id === m.id))
  const unitsOfMacro = (m: Macrocycle) => sortedMesos.filter(x => x.macrocycle_id === m.id).flatMap(unitsOfMeso)

  const weekLabel = (w: Microcycle) => {
    const meso = mesos.find(m => m.id === w.mesocycle_id)
    return `Tydz. ${w.week_number}${w.start_date ? ` (${fmtShort(w.start_date)})` : ''}${meso ? ` · ${meso.name}` : ''}`
  }
  const weekOptions = sortedWeeks.map(w => ({ value: String(w.id), label: weekLabel(w) }))
  const mesoOptions = [{ value: '', label: '— poza mezocyklem —' }, ...sortedMesos.map(m => ({ value: String(m.id), label: m.name }))]
  const macroOptions = [{ value: '', label: '— bez makrocyklu —' }, ...sortedMacros.map(m => ({ value: String(m.id), label: m.name }))]

  // pierwszy wolny poniedziałek po ostatnim tygodniu programu
  function nextFreeMonday(): string | '' {
    const ends = [
      ...weeks.map(w => w.end_date || (w.start_date ? addDays(w.start_date, 6) : null)),
      ...mesos.map(m => m.end_date),
    ].filter(Boolean) as string[]
    if (ends.length) return mondayOf(addDays(ends.sort().pop()!, 1))
    if (selected?.start_date) return mondayOf(selected.start_date)
    return mondayOf(today)
  }
  const maxWeekNumber = () => Math.max(0, ...weeks.map(w => w.week_number))
  const unitHasResults = (u: Unit) => sessionDays.has(u.id)

  // ---------- program ----------
  async function assignWholeGroup(pid: number) {
    const ids = athletes.map(a => a.id)
    if (!ids.length) return
    await deactivateGroupAssignments(supabase, ids)
    await supabase.from('athlete_workout_assignments').update({ is_active: false }).eq('group_id', gid).eq('is_active', true)
    await insertAssignments(supabase, ids.map(athlete_id => ({ athlete_id, plan_id: pid })), 'group')
  }

  function openNewProgram() {
    const sources = programs.filter(p => p.is_template || p.group_id === gid)
    openForm({
      title: 'Nowy program treningowy',
      eyebrow: group.name,
      fields: [
        { key: 'name', label: 'Nazwa programu', full: true },
        {
          key: 'source', label: 'Utwórz', full: true, type: 'select',
          options: [
            { value: '', label: 'Od podstaw (pusty program)' },
            ...sources.filter(p => p.is_template).map(p => ({ value: String(p.id), label: `Z szablonu: ${p.name}` })),
            ...sources.filter(p => !p.is_template).map(p => ({ value: String(p.id), label: `Na podstawie programu: ${p.name}` })),
          ],
          hint: 'Kopia zachowuje całą strukturę, treningi i ćwiczenia — daty przesuną się do nowej daty rozpoczęcia. Wyniki zawodniczek nie są kopiowane.',
        },
        { key: 'start_date', label: 'Data rozpoczęcia', type: 'date' },
        { key: 'end_date', label: 'Data zakończenia', type: 'date', hint: 'Przy kopii — puste = jak w źródle.' },
        { key: 'goal', label: 'Główny cel programu', full: true },
        { key: 'description', label: 'Opis', type: 'textarea' },
        { key: 'assign', label: 'Przypisanie', type: 'checkbox', hint: 'Przypisz program całej drużynie (zastąpi obecny aktywny plan grupowy; plany indywidualne zostają)' },
      ],
      initial: { name: '', source: '', start_date: mondayOf(today), end_date: '', goal: '', description: '', assign: true },
      submitLabel: 'Utwórz program',
      onSubmit: async v => {
        if (!String(v.name || '').trim()) return 'Podaj nazwę programu.'
        let prog: Program
        if (v.source) {
          prog = await copyProgram(supabase, parseInt(v.source), { groupId: gid, name: v.name.trim(), newStart: v.start_date || null, asTemplate: false })
          const patch: any = {}
          if (v.end_date) patch.end_date = v.end_date
          if (v.goal) patch.goal = v.goal
          if (v.description) patch.description = v.description
          if (Object.keys(patch).length) await supabase.from('periodization_programs').update(patch).eq('id', prog.id)
        } else {
          const { data: plan, error: pErr } = await supabase.from('workout_plans').insert({ name: v.name.trim(), group_id: gid }).select().single()
          if (pErr || !plan) throw pErr || new Error('Nie udało się utworzyć planu')
          const { data, error: e } = await supabase.from('periodization_programs').insert({
            group_id: gid, plan_id: plan.id, name: v.name.trim(), goal: v.goal || null, description: v.description || null,
            start_date: v.start_date || null, end_date: v.end_date || null,
          }).select().single()
          if (e || !data) throw e || new Error('Nie udało się utworzyć programu')
          prog = data
        }
        if (v.assign && prog.plan_id) await assignWholeGroup(prog.plan_id)
        goProgram(prog.id)
      },
    })
  }

  function openEditProgram(p: Program) {
    openForm({
      title: 'Edytuj program',
      eyebrow: p.is_template ? 'Szablon' : group.name,
      fields: [
        { key: 'name', label: 'Nazwa', full: true },
        { key: 'start_date', label: 'Data rozpoczęcia', type: 'date' },
        { key: 'end_date', label: 'Data zakończenia', type: 'date' },
        { key: 'goal', label: 'Główny cel', full: true },
        { key: 'description', label: 'Opis', type: 'textarea' },
      ],
      initial: { name: p.name, start_date: p.start_date || '', end_date: p.end_date || '', goal: p.goal || '', description: p.description || '' },
      onSubmit: async v => {
        if (!String(v.name || '').trim()) return 'Podaj nazwę.'
        const { error: e } = await supabase.from('periodization_programs').update({
          name: v.name.trim(), start_date: v.start_date || null, end_date: v.end_date || null, goal: v.goal || null, description: v.description || null,
        }).eq('id', p.id)
        if (e) throw e
        if (p.plan_id) await supabase.from('workout_plans').update({ name: v.name.trim() }).eq('id', p.plan_id)
        router.refresh()
      },
    })
  }

  function openCopyProgram(p: Program, asTemplate: boolean) {
    openForm({
      title: asTemplate ? 'Zapisz jako szablon' : p.is_template ? 'Użyj szablonu' : 'Kopiuj program',
      sub: asTemplate
        ? 'Szablon zachowuje strukturę, treningi i ćwiczenia (bez wyników) — możesz go użyć w każdej drużynie.'
        : 'Kopia całej struktury z treningami i ćwiczeniami. Wyniki zawodniczek zostają przy oryginale.',
      fields: [
        { key: 'name', label: 'Nazwa', full: true },
        ...(!asTemplate ? [{ key: 'start_date', label: 'Data rozpoczęcia kopii', type: 'date' as const, hint: 'Wszystkie daty przesuną się o tę samą liczbę dni.' }] : []),
        ...(!asTemplate ? [{ key: 'assign', label: 'Przypisanie', type: 'checkbox' as const, hint: 'Przypisz kopię całej drużynie' }] : []),
      ],
      initial: { name: asTemplate ? p.name : p.is_template ? p.name : `${p.name} (kopia)`, start_date: p.is_template ? mondayOf(today) : (p.start_date || ''), assign: false },
      submitLabel: asTemplate ? 'Zapisz szablon' : 'Utwórz kopię',
      onSubmit: async v => {
        if (!String(v.name || '').trim()) return 'Podaj nazwę.'
        const np = await copyProgram(supabase, p.id, { groupId: asTemplate ? null : gid, name: v.name.trim(), newStart: asTemplate ? null : (v.start_date || null), asTemplate })
        if (!asTemplate && v.assign && np.plan_id) await assignWholeGroup(np.plan_id)
        if (asTemplate) setListFilter('templates')
        goProgram(np.id)
      },
    })
  }

  async function toggleArchive(p: Program) {
    if (!p.archived && !confirm('Zarchiwizować program? Przypisania planu zostaną wyłączone, a cała historia treningów i wyników zostaje.')) return
    await run(async () => {
      const { error: e } = await supabase.from('periodization_programs').update({ archived: !p.archived }).eq('id', p.id)
      if (e) throw e
      if (!p.archived && p.plan_id) {
        await supabase.from('athlete_workout_assignments').update({ is_active: false }).eq('plan_id', p.plan_id).eq('is_active', true)
        setListFilter('history')
      }
    })
  }

  async function deleteProgram(p: Program) {
    if (sessions.length > 0) { setError('Ten program ma zapisane treningi zawodniczek — zamiast usuwać, zarchiwizuj go (historia zostanie zachowana).'); return }
    if (!confirm(`Usunąć program „${p.name}” razem z cyklami, treningami i ćwiczeniami? Tej operacji nie można cofnąć.`)) return
    await run(async () => {
      const { error: e } = await supabase.from('periodization_programs').delete().eq('id', p.id)
      if (e) throw e
      if (p.plan_id) {
        const weekIds = weeks.map(w => w.id)
        if (weekIds.length) await supabase.from('workout_days').delete().in('week_id', weekIds)
        await supabase.from('workout_weeks').delete().eq('plan_id', p.plan_id)
        await supabase.from('athlete_workout_assignments').delete().eq('plan_id', p.plan_id)
        await supabase.from('workout_plans').delete().eq('id', p.plan_id)
      }
      router.push(`/coach/groups/${gid}/periodization`)
    })
  }

  // ---------- makrocykle ----------
  function openMacro(m?: Macrocycle) {
    openForm({
      title: m ? 'Edytuj makrocykl' : 'Nowy makrocykl',
      eyebrow: selected?.name,
      fields: [
        { key: 'name', label: 'Nazwa', full: true },
        { key: 'goal', label: 'Cel', full: true },
        { key: 'start_date', label: 'Początek', type: 'date' },
        { key: 'end_date', label: 'Koniec', type: 'date' },
        { key: 'notes', label: 'Uwagi', type: 'textarea' },
      ],
      initial: m
        ? { name: m.name, goal: m.goal || '', start_date: m.start_date || '', end_date: m.end_date || '', notes: m.notes || '' }
        : { name: `Makrocykl ${macros.length + 1}`, goal: '', start_date: macros.length ? nextFreeMonday() : (selected?.start_date || ''), end_date: macros.length ? '' : (selected?.end_date || ''), notes: '' },
      onSubmit: async v => {
        if (!String(v.name || '').trim()) return 'Podaj nazwę.'
        const row = { name: v.name.trim(), goal: v.goal || null, start_date: v.start_date || null, end_date: v.end_date || null, notes: v.notes || null }
        const { error: e } = m
          ? await supabase.from('periodization_macrocycles').update(row).eq('id', m.id)
          : await supabase.from('periodization_macrocycles').insert({ ...row, program_id: selected!.id, sort_order: Math.max(0, ...macros.map(x => x.sort_order)) + 1 })
        if (e) throw e
        router.refresh()
      },
    })
  }

  async function moveSorted(table: 'periodization_macrocycles' | 'periodization_mesocycles', list: { id: number; sort_order: number }[], id: number, dir: -1 | 1) {
    const i = list.findIndex(x => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    await run(async () => {
      // pełna renumeracja — działa też, gdy sort_order się powtarza
      const reordered = [...list]
      ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
      for (const [k, x] of reordered.entries()) await supabase.from(table).update({ sort_order: k + 1 }).eq('id', x.id)
    })
  }

  async function deleteMacro(m: Macrocycle) {
    if (!confirm(`Usunąć makrocykl „${m.name}”? Jego mezocykle i treningi zostaną w programie (bez makrocyklu).`)) return
    await run(async () => { const { error: e } = await supabase.from('periodization_macrocycles').delete().eq('id', m.id); if (e) throw e })
  }

  // ---------- mezocykle ----------
  async function addWeeksToMeso(mesoId: number | null, startFrom: string | null, count: number, weekdays: number[] = []) {
    let num = maxWeekNumber()
    for (let i = 0; i < count; i++) {
      num++
      const start = startFrom ? addDays(startFrom, i * 7) : null
      const { data: w, error: e } = await supabase.from('workout_weeks').insert({
        plan_id: planId, week_number: num, name: `Tydzień ${num}`, mesocycle_id: mesoId, start_date: start, end_date: start ? addDays(start, 6) : null,
      }).select().single()
      if (e || !w) throw e || new Error('Nie udało się dodać tygodnia')
      if (weekdays.length) {
        const rows = weekdays.map((wd, k) => ({ week_id: w.id, day_name: `Trening ${k + 1}`, day_order: k + 1, training_date: start ? addDays(start, wd) : null }))
        const { error: dErr } = await supabase.from('workout_days').insert(rows)
        if (dErr) throw dErr
      }
    }
  }

  function openMeso(m?: Mesocycle, presetMacro?: number | null) {
    const actualWeeks = m ? weeksOfMeso(m.id).length : 0
    openForm({
      title: m ? 'Edytuj mezocykl' : 'Nowy mezocykl',
      eyebrow: selected?.name,
      fields: [
        { key: 'name', label: 'Nazwa', full: true },
        { key: 'goal', label: 'Cel treningowy', suggestions: MESO_GOALS, hint: 'Wybierz z listy albo wpisz własny.' },
        { key: 'macrocycle_id', label: 'Makrocykl', type: 'select', options: macroOptions },
        { key: 'start_date', label: 'Data rozpoczęcia', type: 'date', hint: m ? 'Zmiana przesuwa tygodnie i treningi bez zapisanych wyników.' : 'Tygodnie dodadzą się od tej daty.' },
        { key: 'weeks_count', label: 'Liczba tygodni (mikrocykli)', type: 'number', min: 1, max: 26, hint: m ? `Teraz: ${actualWeeks}. Więcej = dodane puste tygodnie na końcu, mniej = usunięte ostatnie tygodnie (tylko bez wyników).` : undefined },
        ...(!m ? [{ key: 'weekdays', label: 'Dni treningowe w tygodniu', type: 'weekdays' as const, hint: 'Opcjonalnie — w każdym tygodniu powstaną puste jednostki w te dni (ćwiczenia dodasz w edytorze albo skopiujesz).' }] : []),
        { key: 'notes', label: 'Opis i uwagi trenera', type: 'textarea' },
      ],
      initial: m
        ? { name: m.name, goal: m.goal || '', macrocycle_id: m.macrocycle_id ? String(m.macrocycle_id) : '', start_date: m.start_date || '', weeks_count: String(actualWeeks || m.weeks_count), notes: m.notes || '' }
        : { name: `Mezocykl ${mesos.length + 1}`, goal: '', macrocycle_id: presetMacro ? String(presetMacro) : '', start_date: nextFreeMonday(), weeks_count: '4', weekdays: [], notes: '' },
      onSubmit: async v => {
        if (!String(v.name || '').trim()) return 'Podaj nazwę.'
        if (!planId) return 'Program nie ma planu treningowego.'
        const count = Math.max(1, Math.min(26, parseInt(v.weeks_count) || 1))
        const start = v.start_date ? mondayOf(v.start_date) : null
        const row = { name: v.name.trim(), goal: v.goal || null, macrocycle_id: v.macrocycle_id ? parseInt(v.macrocycle_id) : null, notes: v.notes || null }
        if (!m) {
          const { data: nm, error: e } = await supabase.from('periodization_mesocycles').insert({
            ...row, program_id: selected!.id, weeks_count: count, start_date: start, end_date: start ? addDays(start, count * 7 - 1) : null,
            sort_order: Math.max(0, ...mesos.map(x => x.sort_order)) + 1,
          }).select().single()
          if (e || !nm) throw e || new Error('Nie udało się utworzyć mezocyklu')
          await addWeeksToMeso(nm.id, start, count, v.weekdays || [])
          await renumberPlanWeeks(supabase, planId)
        } else {
          const { error: e } = await supabase.from('periodization_mesocycles').update(row).eq('id', m.id)
          if (e) throw e
          const mw = weeksOfMeso(m.id)
          // przesunięcie dat
          const oldStart = mw.find(w => w.start_date)?.start_date || m.start_date
          if (start && oldStart && start !== oldStart) {
            const delta = diffDays(oldStart, start)
            for (const w of mw) {
              await supabase.from('workout_weeks').update({ start_date: shiftDate(w.start_date, delta), end_date: shiftDate(w.end_date, delta) }).eq('id', w.id)
              for (const u of unitsByWeek.get(w.id) || []) if (u.training_date && !unitHasResults(u)) await supabase.from('workout_days').update({ training_date: addDays(u.training_date, delta) }).eq('id', u.id)
            }
          } else if (start && !oldStart) {
            for (const [i, w] of mw.entries()) await supabase.from('workout_weeks').update({ start_date: addDays(start, i * 7), end_date: addDays(start, i * 7 + 6) }).eq('id', w.id)
          }
          // długość
          if (count > mw.length) {
            const last = mw[mw.length - 1]
            const lastStart = last?.start_date ? (start && oldStart ? addDays(last.start_date, diffDays(oldStart, start)) : last.start_date) : null
            const from = lastStart ? addDays(lastStart, 7) : (start ? addDays(start, mw.length * 7) : null)
            await addWeeksToMeso(m.id, from, count - mw.length)
          } else if (count < mw.length) {
            const remove = mw.slice(count)
            const removeUnits = remove.flatMap(w => unitsByWeek.get(w.id) || [])
            if (removeUnits.some(unitHasResults)) return 'Ostatnie tygodnie mają zapisane wyniki zawodniczek — nie można ich usunąć. Skróć mezocykl, przenosząc tygodnie do innego bloku.'
            if (removeUnits.length && !confirm(`Usunąć ${remove.length} ost. tydz. razem z ${removeUnits.length} jednostkami?`)) return 'Anulowano.'
            if (removeUnits.length) await supabase.from('workout_days').delete().in('id', removeUnits.map(u => u.id))
            await supabase.from('workout_weeks').delete().in('id', remove.map(w => w.id))
          }
          if (count !== mw.length || mw.length) await syncMesocycle(supabase, m.id)
          await renumberPlanWeeks(supabase, planId)
        }
        router.refresh()
      },
    })
  }

  async function copyMeso(m: Mesocycle) {
    if (!planId) return
    await run(async () => {
      const mw = weeksOfMeso(m.id)
      const newStart = nextFreeMonday() || null
      const srcStart = mw.find(w => w.start_date)?.start_date || m.start_date
      const shift = newStart && srcStart ? diffDays(srcStart, newStart) : 0
      const { data: nm, error: e } = await supabase.from('periodization_mesocycles').insert({
        program_id: m.program_id, macrocycle_id: m.macrocycle_id, name: `${m.name} (kopia)`, goal: m.goal, notes: m.notes,
        weeks_count: m.weeks_count, start_date: shiftDate(m.start_date, shift), end_date: shiftDate(m.end_date, shift),
        sort_order: Math.max(0, ...mesos.map(x => x.sort_order)) + 1,
      }).select().single()
      if (e || !nm) throw e || new Error('Nie udało się skopiować mezocyklu')
      let num = maxWeekNumber()
      for (const w of mw) {
        num++
        await copyMicrocycle(supabase, w.id, { plan_id: planId, mesocycle_id: nm.id, week_number: num, shiftDays: shift })
      }
      await syncMesocycle(supabase, nm.id)
      await renumberPlanWeeks(supabase, planId)
    })
  }

  async function deleteMeso(m: Mesocycle) {
    if (!confirm(`Usunąć mezocykl „${m.name}”? Jego tygodnie i treningi zostaną w programie jako mikrocykle poza mezocyklem (możesz je usunąć lub przenieść).`)) return
    await run(async () => { const { error: e } = await supabase.from('periodization_mesocycles').delete().eq('id', m.id); if (e) throw e })
  }

  // ---------- mikrocykle ----------
  async function addWeek(mesoId: number | null) {
    if (!planId) return
    await run(async () => {
      const mw = weeksOfMeso(mesoId)
      const last = [...mw].reverse().find(w => w.start_date)
      const meso = mesos.find(m => m.id === mesoId)
      const start = last?.start_date ? addDays(last.start_date, 7) : (meso?.start_date || nextFreeMonday() || null)
      await addWeeksToMeso(mesoId, start, 1)
      if (mesoId) await syncMesocycle(supabase, mesoId)
      await renumberPlanWeeks(supabase, planId)
    })
  }

  function openWeek(w: Microcycle) {
    openForm({
      title: `Mikrocykl — Tydzień ${w.week_number}`,
      eyebrow: selected?.name,
      fields: [
        { key: 'start_date', label: 'Początek tygodnia', type: 'date' },
        { key: 'end_date', label: 'Koniec tygodnia', type: 'date' },
        { key: 'goal', label: 'Cel tygodnia', full: true },
        { key: 'mesocycle_id', label: 'Mezocykl', type: 'select', options: mesoOptions, full: true, hint: 'Zmiana przenosi tydzień (z treningami) do innego bloku.' },
        { key: 'shift', label: 'Treningi', type: 'checkbox', hint: 'Przesuń daty treningów razem z początkiem tygodnia (treningi z wynikami zostają na miejscu)' },
      ],
      initial: { start_date: w.start_date || '', end_date: w.end_date || '', goal: w.goal || '', mesocycle_id: w.mesocycle_id && mesoIds.has(w.mesocycle_id) ? String(w.mesocycle_id) : '', shift: true },
      onSubmit: async v => {
        const start = v.start_date || null
        const end = v.end_date || (start ? addDays(start, 6) : null)
        const newMeso = v.mesocycle_id ? parseInt(v.mesocycle_id) : null
        const { error: e } = await supabase.from('workout_weeks').update({ start_date: start, end_date: end, goal: v.goal || null, mesocycle_id: newMeso }).eq('id', w.id)
        if (e) throw e
        if (v.shift && start && w.start_date && start !== w.start_date) {
          const delta = diffDays(w.start_date, start)
          for (const u of unitsByWeek.get(w.id) || []) if (u.training_date && !unitHasResults(u)) await supabase.from('workout_days').update({ training_date: addDays(u.training_date, delta) }).eq('id', u.id)
        }
        for (const mid of new Set([w.mesocycle_id, newMeso])) if (mid && mesoIds.has(mid)) await syncMesocycle(supabase, mid)
        if (planId) await renumberPlanWeeks(supabase, planId)
        router.refresh()
      },
    })
  }

  function openDuplicateWeek(w: Microcycle) {
    openForm({
      title: `Duplikuj Tydzień ${w.week_number}`,
      sub: 'Kopia tygodnia z jednostkami, ćwiczeniami i indywidualnymi parametrami — gotowa do wprowadzenia progresji. Daty przesuwają się o kolejne tygodnie.',
      fields: [
        { key: 'count', label: 'Ile kopii', type: 'number', min: 1, max: 12 },
        { key: 'mesocycle_id', label: 'Do mezocyklu', type: 'select', options: mesoOptions },
      ],
      initial: { count: '1', mesocycle_id: w.mesocycle_id && mesoIds.has(w.mesocycle_id) ? String(w.mesocycle_id) : '' },
      submitLabel: 'Duplikuj',
      onSubmit: async v => {
        if (!planId) return
        const count = Math.max(1, Math.min(12, parseInt(v.count) || 1))
        const target = v.mesocycle_id ? parseInt(v.mesocycle_id) : null
        const tw = weeksOfMeso(target)
        const lastStart = [...tw].reverse().find(x => x.start_date)?.start_date || null
        let num = maxWeekNumber()
        for (let i = 0; i < count; i++) {
          num++
          const newStart = lastStart ? addDays(lastStart, 7 * (i + 1)) : null
          const shift = newStart && w.start_date ? diffDays(w.start_date, newStart) : 7 * (i + 1)
          await copyMicrocycle(supabase, w.id, { plan_id: planId, mesocycle_id: target, week_number: num, shiftDays: shift })
        }
        if (target) await syncMesocycle(supabase, target)
        await renumberPlanWeeks(supabase, planId)
        router.refresh()
      },
    })
  }

  async function deleteWeek(w: Microcycle) {
    const wu = unitsByWeek.get(w.id) || []
    if (wu.some(unitHasResults)) { setError(`Tydzień ${w.week_number} ma zapisane wyniki zawodniczek — nie można go usunąć (historia musi zostać). Możesz go przenieść lub zmienić przyszłe treningi.`); return }
    if (!confirm(wu.length ? `Usunąć Tydzień ${w.week_number} razem z ${wu.length} jednostkami?` : `Usunąć pusty Tydzień ${w.week_number}?`)) return
    await run(async () => {
      if (wu.length) await supabase.from('workout_days').delete().in('id', wu.map(u => u.id))
      const { error: e } = await supabase.from('workout_weeks').delete().eq('id', w.id)
      if (e) throw e
      if (w.mesocycle_id && mesoIds.has(w.mesocycle_id)) await syncMesocycle(supabase, w.mesocycle_id)
      if (planId) await renumberPlanWeeks(supabase, planId)
    })
  }

  // Ułożenie dat kolejno od startu programu wg kolejności makro → mezo → tygodnie
  async function relayoutDates() {
    if (!selected?.start_date || !planId) { setError('Ustaw datę rozpoczęcia programu, żeby przeliczyć daty.'); return }
    if (!confirm('Ułożyć wszystkie mikrocykle kolejno od daty rozpoczęcia programu, w kolejności makro- i mezocykli? Daty treningów przesuną się razem z tygodniami (treningi z zapisanymi wynikami zostają na swoich datach).')) return
    await run(async () => {
      let cursor = mondayOf(selected.start_date!)
      const orderedMesos = [...sortedMacros.flatMap(mc => mesosOfMacro(mc.id)), ...mesosOfMacro(null)]
      const orderedWeeks = [...orderedMesos.flatMap(m => weeksOfMeso(m.id)), ...weeksOfMeso(null)]
      for (const w of orderedWeeks) {
        const delta = w.start_date ? diffDays(w.start_date, cursor) : 0
        await supabase.from('workout_weeks').update({ start_date: cursor, end_date: addDays(cursor, 6) }).eq('id', w.id)
        for (const u of unitsByWeek.get(w.id) || []) {
          if (unitHasResults(u)) continue
          if (u.training_date && delta) await supabase.from('workout_days').update({ training_date: addDays(u.training_date, delta) }).eq('id', u.id)
        }
        cursor = addDays(cursor, 7)
      }
      for (const m of orderedMesos) await syncMesocycle(supabase, m.id)
      // makrocykle obejmują swoje mezocykle
      const { data: fresh } = await supabase.from('periodization_mesocycles').select('id, macrocycle_id, start_date, end_date').eq('program_id', selected.id)
      for (const mc of sortedMacros) {
        const ms = ((fresh || []) as any[]).filter(x => x.macrocycle_id === mc.id)
        const s = ms.map(x => x.start_date).filter(Boolean).sort()[0]
        const e = ms.map(x => x.end_date).filter(Boolean).sort().pop()
        if (s && e) await supabase.from('periodization_macrocycles').update({ start_date: s, end_date: e }).eq('id', mc.id)
      }
      if (orderedWeeks.length) await supabase.from('periodization_programs').update({ end_date: addDays(cursor, -1) }).eq('id', selected.id)
      await renumberPlanWeeks(supabase, planId)
    })
  }

  // ---------- jednostki ----------
  const templateOptions = [{ value: '', label: '— pusta jednostka —' }, ...unitTemplates.map(t => ({ value: String(t.id), label: `Szablon: ${t.day_name || 'Trening'}` }))]

  function openAddUnit(w: Microcycle) {
    const wu = unitsByWeek.get(w.id) || []
    openForm({
      title: 'Nowa jednostka treningowa',
      eyebrow: weekLabel(w),
      fields: [
        { key: 'day_name', label: 'Nazwa', full: true },
        { key: 'training_date', label: 'Data', type: 'date' },
        { key: 'template', label: 'Na podstawie', type: 'select', options: templateOptions },
        { key: 'goal', label: 'Cel jednostki', full: true },
      ],
      initial: { day_name: `Trening ${wu.length + 1}`, training_date: w.start_date || '', template: '', goal: '' },
      submitLabel: 'Dodaj',
      onSubmit: async v => {
        const patch = { day_name: v.day_name || `Trening ${wu.length + 1}`, training_date: v.training_date || null, goal: v.goal || null }
        if (v.template) {
          const nd = await copyUnit(supabase, parseInt(v.template), w.id, { day_name: patch.day_name, training_date: patch.training_date })
          if (v.goal) await supabase.from('workout_days').update({ goal: v.goal }).eq('id', nd.id)
        } else {
          const { error: e } = await supabase.from('workout_days').insert({ ...patch, week_id: w.id, day_order: Math.max(0, ...wu.map(u => u.day_order)) + 1 })
          if (e) throw e
        }
        router.refresh()
      },
    })
  }

  function openEditUnit(u: Unit) {
    openForm({
      title: 'Edytuj jednostkę',
      eyebrow: u.day_name || 'Trening',
      fields: [
        { key: 'day_name', label: 'Nazwa', full: true },
        { key: 'training_date', label: 'Data', type: 'date', hint: 'Przesunięcie treningu na inny dzień.' },
        { key: 'week_id', label: 'Mikrocykl', type: 'select', options: weekOptions },
        { key: 'goal', label: 'Cel jednostki', full: true },
      ],
      initial: { day_name: u.day_name || '', training_date: u.training_date || '', week_id: String(u.week_id), goal: u.goal || '' },
      onSubmit: async v => {
        const row: any = { day_name: v.day_name || null, training_date: v.training_date || null, goal: v.goal || null }
        const wk = parseInt(v.week_id)
        if (wk && wk !== u.week_id) {
          row.week_id = wk
          row.day_order = Math.max(0, ...(unitsByWeek.get(wk) || []).map(x => x.day_order)) + 1
        }
        const { error: e } = await supabase.from('workout_days').update(row).eq('id', u.id)
        if (e) throw e
        router.refresh()
      },
    })
  }

  function openCopyUnit(u: Unit) {
    const w = weeks.find(x => x.id === u.week_id)
    openForm({
      title: 'Kopiuj jednostkę',
      sub: 'Kopia z blokami, ćwiczeniami i indywidualnymi parametrami — do innego dnia lub tygodnia.',
      fields: [
        { key: 'week_id', label: 'Do mikrocyklu', type: 'select', options: weekOptions, full: true },
        { key: 'training_date', label: 'Data', type: 'date' },
        { key: 'day_name', label: 'Nazwa', full: true },
      ],
      initial: { week_id: String(u.week_id), training_date: u.training_date ? addDays(u.training_date, 7) : (w?.start_date || ''), day_name: u.day_name || 'Trening' },
      submitLabel: 'Kopiuj',
      onSubmit: async v => {
        await copyUnit(supabase, u.id, parseInt(v.week_id), { day_name: v.day_name || u.day_name, training_date: v.training_date || null })
        router.refresh()
      },
    })
  }

  function openUnitTemplate(u: Unit) {
    openForm({
      title: 'Zapisz jednostkę jako szablon',
      sub: 'Szablon (z ćwiczeniami) będzie do wyboru przy dodawaniu jednostki w każdym programie.',
      fields: [{ key: 'day_name', label: 'Nazwa szablonu', full: true }],
      initial: { day_name: u.day_name || 'Trening' },
      submitLabel: 'Zapisz szablon',
      onSubmit: async v => {
        const tw = await unitTemplateWeek(supabase)
        await copyUnit(supabase, u.id, tw, { day_name: v.day_name || u.day_name, training_date: null })
        router.refresh()
      },
    })
  }

  function openExclude(u: Unit) {
    openForm({
      title: 'Wyłącz zawodniczki z jednostki',
      eyebrow: `${u.day_name || 'Trening'}${u.training_date ? ` · ${fmtShort(u.training_date)}` : ''}`,
      sub: 'Zaznaczone zawodniczki nie mają tego treningu w planie (nie liczy się do realizacji). Program drużyny się nie zmienia.',
      fields: [{ key: 'ids', label: 'Wyłączone zawodniczki', type: 'athletes' }],
      initial: { ids: (u.absent_athlete_ids || []).filter(id => groupIds.has(id)) },
      onSubmit: async v => {
        const other = (u.absent_athlete_ids || []).filter(id => !groupIds.has(id))
        const { error: e } = await supabase.from('workout_days').update({ absent_athlete_ids: [...other, ...(v.ids || [])] }).eq('id', u.id)
        if (e) throw e
        router.refresh()
      },
    })
  }

  async function deleteUnit(u: Unit) {
    if (unitHasResults(u)) { setError(`„${u.day_name || 'Trening'}” ma zapisane wyniki zawodniczek — nie można go usunąć. Możesz zmienić datę albo wyłączyć zawodniczki.`); return }
    if (!confirm(`Usunąć jednostkę „${u.day_name || 'Trening'}” razem z ćwiczeniami?`)) return
    await run(async () => { const { error: e } = await supabase.from('workout_days').delete().eq('id', u.id); if (e) throw e })
  }

  // ---------- wydarzenia (kalendarz sezonu) ----------
  function openEvent() {
    openForm({
      title: 'Nowe wydarzenie drużyny',
      sub: 'Wydarzenie zapisze się w kalendarzu sezonu dla tej drużyny.',
      fields: [
        { key: 'title', label: 'Nazwa', full: true },
        { key: 'event_type', label: 'Rodzaj', type: 'select', options: EVENT_TYPES.filter(t => t.value !== 'training').map(t => ({ value: t.value, label: t.label })) },
        { key: 'start_date', label: 'Od', type: 'date' },
        { key: 'end_date', label: 'Do', type: 'date' },
      ],
      initial: { title: '', event_type: 'competition', start_date: today, end_date: '' },
      submitLabel: 'Dodaj',
      onSubmit: async v => {
        if (!String(v.title || '').trim() || !v.start_date) return 'Podaj nazwę i datę.'
        const { error: e } = await supabase.from('calendar_events').insert({
          title: v.title.trim(), event_type: v.event_type, start_date: v.start_date, end_date: v.end_date || null, group_ids: [gid],
          cancels_trainings: v.event_type === 'break',
        })
        if (e) throw e
        router.refresh()
      },
    })
  }
  const eventsIn = (s: string | null, e: string | null) => (s && e) ? events.filter(ev => ev.start_date <= e && (ev.end_date || ev.start_date) >= s) : []

  // ---------- render ----------
  const own = programs.filter(p => !p.is_template && p.group_id === gid)
  const listed = listFilter === 'templates'
    ? programs.filter(p => p.is_template)
    : listFilter === 'history'
      ? own.filter(p => p.archived || programPhase(p) === 'finished')
      : own.filter(p => !p.archived && programPhase(p) !== 'finished')
  const editorHref = (dayId?: number) => planId ? `/coach/groups/${gid}/plan/${planId}${dayId ? `#day-${dayId}` : ''}` : '#'

  if (migrationMissing) {
    return (
      <>
        <SetPageMeta title="Periodyzacja" backHref={`/coach/groups/${gid}`} backLabel={group.name} />
        <div className="coach-content">
          <GroupHero group={group} athletesCount={athletes.length} />
          <TabsNav items={groupTabs(gid)} />
          <Card><div style={{ padding: '2rem', textAlign: 'center', ...muted }}>
            Aby korzystać z periodyzacji, uruchom w Supabase SQL Editor migrację <b>202611210003_periodization.sql</b>.
          </div></Card>
        </div>
      </>
    )
  }

  const programTally = selected && !selected.is_template ? tally(units) : null
  const unitsTotal = units.length
  const unitsDone = units.filter(u => unitHasResults(u) || (u.training_date && u.training_date < today)).length

  function renderUnit(u: Unit) {
    const counts: Record<UnitStatus, number> = { done: 0, partial: 0, skipped: 0, planned: 0, excluded: 0 }
    for (const a of statsAthletes) counts[unitStatusFor(u, a.id, sessionByKey.get(`${u.id}_${a.id}`), today)]++
    const expected = statsAthletes.length - counts.excluded
    const excluded = (u.absent_athlete_ids || []).filter(id => groupIds.has(id)).length
    return (
      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', background: '#fff' }}>
        <div style={{ width: 70, fontFamily: INTER, fontSize: '0.72rem', fontWeight: 700, color: u.training_date === today ? 'var(--gold)' : 'var(--navy-900)' }}>
          {u.training_date ? <>{weekdayShort(u.training_date)} {u.training_date.slice(8, 10)}.{u.training_date.slice(5, 7)}</> : <span style={{ color: 'var(--muted-light)' }}>bez daty</span>}
        </div>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--navy-900)' }}>{u.day_name || 'Trening'}</div>
          <div style={{ ...muted, fontSize: '0.68rem' }}>
            {u.exercise_count ? `${u.exercise_count} ćw.` : 'brak ćwiczeń'}{u.goal ? ` · ${u.goal}` : ''}{excluded ? ` · wyłączone: ${excluded}` : ''}
          </div>
        </div>
        {!selected?.is_template && expected > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {counts.done > 0 && <Pill {...STATUS_INFO.done}>✓ {counts.done}/{expected}</Pill>}
            {counts.partial > 0 && <Pill {...STATUS_INFO.partial}>½ {counts.partial}</Pill>}
            {counts.skipped > 0 && <Pill {...STATUS_INFO.skipped}>✕ {counts.skipped}</Pill>}
            {counts.planned > 0 && counts.planned === expected && <Pill {...STATUS_INFO.planned}>zaplanowany</Pill>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <Link href={editorHref(u.id)} title="Ćwiczenia i parametry (edytor planu)" style={{ ...iconBtn, textDecoration: 'none' }}><Dumbbell size={14} /></Link>
          {!selected?.is_template && <Link href={`/coach/groups/${gid}/plan/${planId}/day/${u.id}`} title="Uzupełnij wyniki za zawodniczki" style={{ ...iconBtn, textDecoration: 'none' }}><ClipboardEdit size={14} /></Link>}
          {!selected?.is_template && <IconBtn title="Wyłącz zawodniczki" onClick={() => openExclude(u)}><UserX size={14} /></IconBtn>}
          <IconBtn title="Edytuj / przesuń" onClick={() => openEditUnit(u)}><Pencil size={14} /></IconBtn>
          <IconBtn title="Kopiuj do innego dnia / tygodnia" onClick={() => openCopyUnit(u)}><Copy size={14} /></IconBtn>
          <IconBtn title="Zapisz jako szablon" onClick={() => openUnitTemplate(u)}><BookmarkPlus size={14} /></IconBtn>
          <IconBtn title="Usuń" danger onClick={() => deleteUnit(u)}><Trash2 size={14} /></IconBtn>
        </div>
      </div>
    )
  }

  function renderWeek(w: Microcycle, idx: number) {
    const wu = unitsByWeek.get(w.id) || []
    const k = `w${w.id}`
    const open = !collapsed.has(k)
    const t = !selected?.is_template ? tally(wu) : null
    const current = w.start_date && w.start_date <= today && (w.end_date || addDays(w.start_date, 6)) >= today
    return (
      <div key={w.id} style={{ border: `1.5px solid ${current ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', marginTop: 8, background: '#fafbfc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => toggle(k)} style={{ ...iconBtn, border: 'none', background: 'transparent' }} aria-label="Zwiń / rozwiń">
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--navy-900)' }}>
              Mikrocykl {idx + 1} <span style={{ fontWeight: 600, color: 'var(--muted)' }}>· Tydzień {w.week_number}</span>
              {current && <span style={{ marginLeft: 6 }}><Pill color="var(--navy-900)" bg="var(--gold-light)">ten tydzień</Pill></span>}
            </div>
            <div style={{ ...muted, fontSize: '0.68rem' }}>{fmtRange(w.start_date, w.end_date || (w.start_date ? addDays(w.start_date, 6) : null))} · {wu.length} {wu.length === 1 ? 'jednostka' : 'jedn.'}{w.goal ? ` · cel: ${w.goal}` : ''}</div>
          </div>
          {t && t.planned > 0 && <div style={{ width: 90 }} title={`Realizacja ${realization(t) ?? '—'}%`}><Bar pct={progress(t)} color="#86C9A0" /></div>}
          <div style={{ display: 'flex', gap: 4 }}>
            <IconBtn title="Dodaj jednostkę" onClick={() => openAddUnit(w)}><Plus size={14} /></IconBtn>
            <IconBtn title="Edytuj / przenieś tydzień" onClick={() => openWeek(w)}><Pencil size={14} /></IconBtn>
            <IconBtn title="Duplikuj tydzień (progresja)" onClick={() => openDuplicateWeek(w)}><Copy size={14} /></IconBtn>
            <IconBtn title="Usuń tydzień" danger onClick={() => deleteWeek(w)}><Trash2 size={14} /></IconBtn>
          </div>
        </div>
        {open && (wu.length
          ? wu.map(u => renderUnit(u))
          : <div style={{ padding: '8px 12px 10px 44px', ...muted, fontSize: '0.72rem', borderTop: '1px solid var(--border)', background: '#fff' }}>Brak jednostek — dodaj (+) lub skopiuj z innego tygodnia.</div>)}
      </div>
    )
  }

  let microIdx = 0
  const weekIndex = new Map<number, number>()
  for (const w of [...[...sortedMacros.flatMap(mc => mesosOfMacro(mc.id)), ...mesosOfMacro(null)].flatMap(m => weeksOfMeso(m.id)), ...weeksOfMeso(null)]) weekIndex.set(w.id, microIdx++)

  function renderMeso(m: Mesocycle, siblings: Mesocycle[]) {
    const mw = weeksOfMeso(m.id)
    const k = `m${m.id}`
    const open = !collapsed.has(k)
    const t = !selected?.is_template ? tally(unitsOfMeso(m)) : null
    const color = goalColor(m.goal)
    const pos = siblings.findIndex(x => x.id === m.id)
    return (
      <div key={m.id} style={{ border: '1.5px solid var(--border)', borderLeft: `5px solid ${color}`, borderRadius: 12, padding: '10px 12px', marginTop: 10, background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => toggle(k)} style={{ ...iconBtn, border: 'none', background: 'transparent' }} aria-label="Zwiń / rozwiń">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={eyebrow}>Mezocykl</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontSize: '0.95rem' }}>{m.name}</span>
              {m.goal && <Pill color="#fff" bg={color}>{m.goal}</Pill>}
            </div>
            <div style={{ ...muted, fontSize: '0.7rem' }}>{mw.length} tyg. · {fmtRange(m.start_date, m.end_date)}{m.notes ? ` · ${m.notes}` : ''}</div>
          </div>
          {t && t.planned > 0 && (
            <div style={{ width: 120 }}>
              <div style={{ ...muted, fontSize: '0.62rem', textAlign: 'right' }}>realizacja {realization(t) ?? '—'}%</div>
              <Bar pct={progress(t)} color={color} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <IconBtn title="Dodaj mikrocykl" onClick={() => addWeek(m.id)} disabled={busy}><Plus size={14} /></IconBtn>
            <IconBtn title="W górę" onClick={() => moveSorted('periodization_mesocycles', siblings, m.id, -1)} disabled={busy || pos <= 0}><ChevronUp size={14} /></IconBtn>
            <IconBtn title="W dół" onClick={() => moveSorted('periodization_mesocycles', siblings, m.id, 1)} disabled={busy || pos >= siblings.length - 1}><ChevronDown size={14} /></IconBtn>
            <IconBtn title="Edytuj (cel, długość, daty)" onClick={() => openMeso(m)}><Pencil size={14} /></IconBtn>
            <IconBtn title="Kopiuj mezocykl" onClick={() => copyMeso(m)} disabled={busy}><Copy size={14} /></IconBtn>
            <IconBtn title="Usuń mezocykl" danger onClick={() => deleteMeso(m)}><Trash2 size={14} /></IconBtn>
          </div>
        </div>
        {open && (
          <div style={{ paddingLeft: 8 }}>
            {mw.map(w => renderWeek(w, weekIndex.get(w.id) ?? 0))}
            {mw.length === 0 && <div style={{ ...muted, padding: '8px 4px' }}>Brak tygodni — dodaj mikrocykl (+).</div>}
          </div>
        )}
      </div>
    )
  }

  function renderMacro(mc: Macrocycle) {
    const k = `M${mc.id}`
    const open = !collapsed.has(k)
    const ms = mesosOfMacro(mc.id)
    const t = !selected?.is_template ? tally(unitsOfMacro(mc)) : null
    const evs = eventsIn(mc.start_date, mc.end_date)
    const pos = sortedMacros.findIndex(x => x.id === mc.id)
    return (
      <Card key={mc.id} style={{ marginTop: 12 }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: open ? '1.5px solid var(--border)' : 'none', background: 'var(--navy-900)', borderRadius: open ? '12px 12px 0 0' : 12 }}>
          <button type="button" onClick={() => toggle(k)} style={{ ...iconBtn, border: 'none', background: 'transparent', color: '#fff' }} aria-label="Zwiń / rozwiń">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ ...eyebrow, color: 'var(--gold-light)' }}>Makrocykl</div>
            <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.02rem' }}>{mc.name}</div>
            <div style={{ fontFamily: INTER, fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>{fmtRange(mc.start_date, mc.end_date)} · {ms.length} mezocykli{mc.goal ? ` · cel: ${mc.goal}` : ''}</div>
          </div>
          {t && t.planned > 0 && (
            <div style={{ width: 130 }}>
              <div style={{ fontFamily: INTER, fontSize: '0.62rem', color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>realizacja {realization(t) ?? '—'}%</div>
              <Bar pct={progress(t)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <IconBtn title="Dodaj mezocykl" onClick={() => openMeso(undefined, mc.id)}><Plus size={14} /></IconBtn>
            <IconBtn title="W górę" onClick={() => moveSorted('periodization_macrocycles', sortedMacros, mc.id, -1)} disabled={busy || pos <= 0}><ChevronUp size={14} /></IconBtn>
            <IconBtn title="W dół" onClick={() => moveSorted('periodization_macrocycles', sortedMacros, mc.id, 1)} disabled={busy || pos >= sortedMacros.length - 1}><ChevronDown size={14} /></IconBtn>
            <IconBtn title="Edytuj makrocykl" onClick={() => openMacro(mc)}><Pencil size={14} /></IconBtn>
            <IconBtn title="Usuń makrocykl" danger onClick={() => deleteMacro(mc)}><Trash2 size={14} /></IconBtn>
          </div>
        </div>
        {open && (
          <div style={{ padding: '6px 14px 14px' }}>
            {(evs.length > 0 || mc.notes) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                {evs.map(ev => { const ti = eventTypeInfo(ev.event_type); return <Pill key={ev.id} color={ti.color} bg={ti.bg}>{ti.label}: {ev.title} · {fmtShort(ev.start_date)}</Pill> })}
                {mc.notes && <span style={{ ...muted, fontSize: '0.7rem' }}>{mc.notes}</span>}
              </div>
            )}
            {ms.map(m => renderMeso(m, ms))}
            {ms.length === 0 && <div style={{ ...muted, padding: '10px 4px' }}>Brak mezocykli — dodaj pierwszy (+).</div>}
          </div>
        )}
      </Card>
    )
  }

  // ---------- oś czasu ----------
  function renderTimeline() {
    const dates = [
      selected?.start_date, selected?.end_date,
      ...macros.flatMap(m => [m.start_date, m.end_date]),
      ...mesos.flatMap(m => [m.start_date, m.end_date]),
      ...weeks.flatMap(w => [w.start_date, w.end_date]),
    ].filter(Boolean) as string[]
    if (!dates.length) return <Card><div style={{ padding: '2rem', textAlign: 'center', ...muted }}>Ustaw daty programu i cykli, żeby zobaczyć oś czasu.</div></Card>
    const start = mondayOf(dates.sort()[0])
    const end = dates.sort().pop()!
    const nWeeks = Math.max(1, Math.ceil((diffDays(start, end) + 1) / 7))
    const W = 34
    const LABEL = 120
    const x = (d: string) => (diffDays(start, d) / 7) * W
    const width = (s: string, e: string) => Math.max(W / 7, ((diffDays(s, e) + 1) / 7) * W)
    const rangeEvents = eventsIn(start, addDays(start, nWeeks * 7 - 1))
    const rowStyle: React.CSSProperties = { position: 'relative', height: 30, borderTop: '1px solid var(--border)' }
    const labelStyle: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, width: LABEL, height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 10, background: '#fff', ...eyebrow }
    const bar = (s: string | null, e: string | null, color: string, text: string, key: string, light = false) => s ? (
      <div key={key} title={`${text} · ${fmtRange(s, e)}`} style={{
        position: 'absolute', top: 4, height: 22, left: LABEL + x(s), width: width(s, e || addDays(s, 6)) - 2, background: light ? `${color}22` : color,
        border: `1px solid ${color}`, borderRadius: 6, color: light ? color : '#fff', fontFamily: INTER, fontSize: '0.64rem', fontWeight: 700,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '3px 6px', boxSizing: 'border-box',
      }}>{text}</div>
    ) : null
    const months: { label: string; left: number }[] = []
    for (let i = 0; i < nWeeks; i++) {
      const d = addDays(start, i * 7)
      const prev = i ? addDays(start, (i - 1) * 7) : null
      if (!prev || prev.slice(5, 7) !== d.slice(5, 7)) months.push({ label: `${['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'][parseInt(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`, left: i * W })
    }
    const totalW = LABEL + nWeeks * W
    return (
      <Card>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottom: '1.5px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={eyebrow}>Przegląd okresu przygotowań</div>
            <div style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{fmtRange(start, end)} · {nWeeks} tygodni</div>
          </div>
          <Button variant="ghost" size="small" onClick={openEvent}><CalendarDays size={13} /> Dodaj wydarzenie</Button>
          <Link href="/coach/calendar" className="coach-btn coach-btn-ghost coach-btn-small" style={{ textDecoration: 'none' }}>Kalendarz sezonu</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ position: 'relative', width: totalW, minWidth: '100%' }}>
            <div style={{ ...rowStyle, borderTop: 'none', height: 24 }}>
              <div style={labelStyle} />
              {months.map(mo => <div key={mo.left} style={{ position: 'absolute', left: LABEL + mo.left, top: 5, fontFamily: INTER, fontSize: '0.64rem', fontWeight: 700, color: 'var(--muted)' }}>{mo.label}</div>)}
            </div>
            <div style={rowStyle}><div style={labelStyle}>Makrocykle</div>{sortedMacros.map(m => bar(m.start_date, m.end_date, '#0b1220', m.name, `M${m.id}`))}</div>
            <div style={rowStyle}><div style={labelStyle}>Mezocykle</div>{sortedMesos.map(m => bar(m.start_date, m.end_date, goalColor(m.goal), `${m.name}${m.goal ? ` · ${m.goal}` : ''}`, `m${m.id}`))}</div>
            <div style={rowStyle}>
              <div style={labelStyle}>Mikrocykle</div>
              {sortedWeeks.filter(w => w.start_date).map(w => {
                const wu = unitsByWeek.get(w.id) || []
                const t = !selected?.is_template ? tally(wu) : null
                const r = t ? realization(t) : null
                const color = r == null ? '#5b6b8c' : r >= 80 ? '#15803d' : r >= 50 ? '#b4761a' : '#c23b3b'
                return bar(w.start_date, w.end_date, color, `${wu.length}`, `w${w.id}`, true)
              })}
            </div>
            <div style={{ ...rowStyle, height: 34 }}>
              <div style={labelStyle}>Wydarzenia</div>
              {rangeEvents.map(ev => { const ti = eventTypeInfo(ev.event_type); return bar(ev.start_date, ev.end_date || ev.start_date, ti.color, ev.title, `e${ev.id}`) })}
            </div>
            {today >= start && today <= addDays(start, nWeeks * 7) && (
              <div title="Dziś" style={{ position: 'absolute', top: 20, bottom: 0, left: LABEL + x(today), width: 2, background: 'var(--gold)', zIndex: 1 }} />
            )}
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', ...muted, fontSize: '0.68rem' }}>
          <span>Mikrocykle: liczba jednostek, kolor = realizacja (zielony ≥ 80%, pomarańczowy ≥ 50%, czerwony &lt; 50%, szary = jeszcze przed nami).</span>
        </div>
        {rangeEvents.length > 0 && (
          <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rangeEvents.map(ev => { const ti = eventTypeInfo(ev.event_type); return <Pill key={ev.id} color={ti.color} bg={ti.bg}>{ti.label}: {ev.title} · {fmtRange(ev.start_date, ev.end_date || ev.start_date)}</Pill> })}
          </div>
        )}
      </Card>
    )
  }

  // ---------- realizacja ----------
  function renderStats() {
    if (!programTally) return null
    const t = programTally
    const rows = statsAthletes.map(a => ({ a, t: tally(units, [a]) })).sort((x, y) => (realization(y.t) ?? -1) - (realization(x.t) ?? -1))
    const th: React.CSSProperties = { ...eyebrow, textAlign: 'left', padding: '8px 10px', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }
    const td: React.CSSProperties = { fontFamily: INTER, fontSize: '0.8rem', padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--navy-900)', whiteSpace: 'nowrap' }
    const hierarchy: { key: string; level: number; label: string; t: Tally; color?: string }[] = []
    for (const mc of sortedMacros) {
      hierarchy.push({ key: `M${mc.id}`, level: 0, label: `Makrocykl: ${mc.name}`, t: tally(unitsOfMacro(mc)) })
      for (const m of mesosOfMacro(mc.id)) {
        hierarchy.push({ key: `m${m.id}`, level: 1, label: `Mezocykl: ${m.name}`, t: tally(unitsOfMeso(m)), color: goalColor(m.goal) })
        for (const w of weeksOfMeso(m.id)) hierarchy.push({ key: `w${w.id}`, level: 2, label: `Tydzień ${w.week_number} · ${fmtShort(w.start_date)}`, t: tally(unitsByWeek.get(w.id) || []) })
      }
    }
    for (const m of mesosOfMacro(null)) {
      hierarchy.push({ key: `m${m.id}`, level: 0, label: `Mezocykl: ${m.name}`, t: tally(unitsOfMeso(m)), color: goalColor(m.goal) })
      for (const w of weeksOfMeso(m.id)) hierarchy.push({ key: `w${w.id}`, level: 1, label: `Tydzień ${w.week_number} · ${fmtShort(w.start_date)}`, t: tally(unitsByWeek.get(w.id) || []) })
    }
    for (const w of weeksOfMeso(null)) hierarchy.push({ key: `w${w.id}`, level: 0, label: `Tydzień ${w.week_number} · ${fmtShort(w.start_date)}`, t: tally(unitsByWeek.get(w.id) || []) })

    return (
      <>
        {noAssignments && (
          <Card><div style={{ padding: '0.8rem 1.2rem', ...muted, color: '#b4761a' }}>Program nie jest przypisany zawodniczkom — realizacja liczona dla całej drużyny. Przypisz go w „Przypisanie”.</div></Card>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, margin: '12px 0' }}>
          <StatCard label={`Jednostki: ${unitsDone} z ${unitsTotal} za nami`} value={`${unitsTotal}`} tone="blue" />
          <StatCard label="Treningi zawodniczek zaplanowane" value={t.planned} tone="blue" />
          <StatCard label="Ukończone" value={t.done} tone="green" />
          <StatCard label="Częściowo wykonane" value={t.partial} />
          <StatCard label="Pominięte" value={t.skipped} />
          <StatCard label="Realizacja (termin minął)" value={realization(t) == null ? '—' : `${realization(t)}%`} tone="green" />
          <StatCard label="Średnie RPE (zgłoszone)" value={t.rpeN ? (t.rpeSum / t.rpeN).toFixed(1) : '—'} />
          <StatCard label={`Obciążenie sRPE (${t.loadN} sesji z czasem)`} value={t.loadN ? `${Math.round(t.load / t.loadN)} AU/sesję` : '—'} />
        </div>

        <Card title="Realizacja zawodniczek" sub="Ukończone · częściowo · pominięte · przed nami — RPE z ankiet po treningu, obciążenie = RPE × czas sesji">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Zawodniczka</th><th style={th}>Plan</th><th style={th}>✓</th><th style={th}>½</th><th style={th}>✕</th><th style={th}>Przed nami</th><th style={th}>Realizacja</th><th style={th}>Śr. RPE</th><th style={th}>sRPE suma</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {rows.map(({ a, t: at }) => {
                  const r = realization(at)
                  return (
                    <tr key={a.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{a.full_name}{!activeAssigned.has(a.id) && !noAssignments && <span style={{ ...muted, fontSize: '0.62rem', marginLeft: 6 }}>(nieprzypisana)</span>}</td>
                      <td style={td}>{at.planned}</td>
                      <td style={{ ...td, color: STATUS_INFO.done.color }}>{at.done}</td>
                      <td style={{ ...td, color: STATUS_INFO.partial.color }}>{at.partial}</td>
                      <td style={{ ...td, color: STATUS_INFO.skipped.color }}>{at.skipped}</td>
                      <td style={td}>{at.upcoming}</td>
                      <td style={{ ...td, minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1 }}><Bar pct={r} color={r == null ? undefined : r >= 80 ? '#15803d' : r >= 50 ? '#e8a33d' : '#c23b3b'} /></div>
                          <span style={{ width: 36, textAlign: 'right', fontWeight: 700 }}>{r == null ? '—' : `${r}%`}</span>
                        </div>
                      </td>
                      <td style={td}>{at.rpeN ? (at.rpeSum / at.rpeN).toFixed(1) : '—'}</td>
                      <td style={td}>{at.loadN ? at.load : '—'}</td>
                      <td style={td}><Link href={`/coach/athletes/${a.id}`} style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>profil →</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {hierarchy.length > 0 && (
          <Card title="Postęp cykli" sub="Pasek = część zaplanowanych treningów już wykonanych; % = realizacja treningów, których termin minął" style={{ marginTop: 12 }}>
            <div style={{ padding: '6px 0' }}>
              {hierarchy.map(h => (
                <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', paddingLeft: 16 + h.level * 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', fontFamily: INTER, fontSize: h.level === 0 ? '0.84rem' : '0.78rem', fontWeight: h.level < 2 ? 700 : 500, color: 'var(--navy-900)' }}>{h.label}</div>
                  <div style={{ width: 160 }}><Bar pct={progress(h.t)} color={h.color} /></div>
                  <div style={{ width: 170, ...muted, fontSize: '0.7rem', textAlign: 'right' }}>
                    ✓{h.t.done} ½{h.t.partial} ✕{h.t.skipped} / {h.t.planned} · <b style={{ color: 'var(--navy-900)' }}>{realization(h.t) == null ? '—' : `${realization(h.t)}%`}</b>
                    {h.t.rpeN ? ` · RPE ${(h.t.rpeSum / h.t.rpeN).toFixed(1)}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </>
    )
  }

  const phase = selected ? programPhase(selected) : null
  const phaseColors: Record<string, [string, string]> = { active: ['#15803d', '#e3f6ea'], planned: ['#173763', '#e3e9f5'], finished: ['#5b6b8c', '#e8ecf3'], archived: ['#5b6b8c', '#e8ecf3'], template: ['#7c3aed', '#efe7fd'] }

  return (
    <>
      <SetPageMeta title="Periodyzacja" backHref={`/coach/groups/${gid}`} backLabel={group.name} />
      <div className="coach-content">
        <GroupHero group={group} athletesCount={athletes.length} />
        <TabsNav items={groupTabs(gid)} />

        <div className="coach-group-tab-panel">
          {/* Lista programów */}
          <Card>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}>
                <div style={eyebrow}>Programy treningowe</div>
                <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>Planowanie sezonu: makro → mezo → mikrocykle → jednostki</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip active={listFilter === 'current'} onClick={() => setListFilter('current')}>Aktywne i zaplanowane</Chip>
                <Chip active={listFilter === 'history'} onClick={() => setListFilter('history')}>Historia</Chip>
                <Chip active={listFilter === 'templates'} onClick={() => setListFilter('templates')}>Szablony</Chip>
              </div>
              <Button variant="dark" size="small" onClick={openNewProgram} style={{ color: 'var(--gold)' }}><Plus size={13} /> Nowy program</Button>
            </div>
            <div style={{ padding: '0.75rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
              {listed.length === 0 && (
                <div style={{ ...muted, padding: '0.5rem 0' }}>
                  {listFilter === 'templates' ? 'Brak szablonów — zapisz program jako szablon przyciskiem przy programie.' : listFilter === 'history' ? 'Brak zakończonych ani zarchiwizowanych programów.' : 'Brak programów — kliknij „Nowy program”.'}
                </div>
              )}
              {listed.map(p => {
                const ph = programPhase(p)
                const [c, bg] = phaseColors[ph]
                const active = selected?.id === p.id
                return (
                  <button key={p.id} type="button" onClick={() => goProgram(p.id)} style={{
                    textAlign: 'left', border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`, background: active ? '#fffaf1' : '#fff',
                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontSize: '0.9rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <Pill color={c} bg={bg}>{PHASE_LABEL[ph]}</Pill>
                    </div>
                    <div style={{ ...muted, fontSize: '0.68rem', marginTop: 3 }}>{fmtRange(p.start_date, p.end_date)}</div>
                    {p.goal && <div style={{ ...muted, fontSize: '0.68rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Cel: {p.goal}</div>}
                  </button>
                )
              })}
            </div>
          </Card>

          {error && (
            <div style={{ padding: '0.75rem', background: '#FEF2F2', border: '1.5px solid #c23b3b', borderRadius: 10, color: '#c23b3b', fontWeight: 700, fontSize: '0.84rem', margin: '12px 0', display: 'flex', gap: 8 }}>
              <span style={{ flex: 1 }}>{error}</span>
              <button type="button" onClick={() => setError('')} style={{ border: 'none', background: 'transparent', color: '#c23b3b', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>
          )}

          {!selected ? (
            <Card style={{ marginTop: 12 }}>
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                <Layers size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
                <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginBottom: 4 }}>Zaplanuj proces przygotowania motorycznego drużyny</div>
                <div style={{ ...muted, maxWidth: 520, margin: '0 auto 14px', lineHeight: 1.5 }}>
                  Utwórz program (cały sezon albo kilka tygodni), podziel go na makro- i mezocykle albo od razu dodaj tygodnie.
                  Treningi korzystają z istniejącego edytora planu, biblioteki ćwiczeń i statystyk.
                </div>
                <Button variant="dark" onClick={openNewProgram} style={{ color: 'var(--gold)' }}><Plus size={14} /> Nowy program</Button>
              </div>
            </Card>
          ) : (
            <>
              {/* Nagłówek programu */}
              <Card style={{ marginTop: 12 }}>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--navy-900)' }}>{selected.name}</span>
                      {phase && <Pill color={phaseColors[phase][0]} bg={phaseColors[phase][1]}>{PHASE_LABEL[phase]}</Pill>}
                    </div>
                    <div style={{ ...muted, marginTop: 4 }}>
                      {fmtRange(selected.start_date, selected.end_date)} · {macros.length} makro · {mesos.length} mezo · {weeks.length} mikrocykli · {units.length} jednostek
                    </div>
                    {selected.goal && <div style={{ fontFamily: INTER, fontSize: '0.82rem', marginTop: 6, color: 'var(--ink)' }}><b>Cel:</b> {selected.goal}</div>}
                    {selected.description && <div style={{ ...muted, marginTop: 4, whiteSpace: 'pre-wrap' }}>{selected.description}</div>}
                    {!selected.is_template && programTally && programTally.planned > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, maxWidth: 420 }}>
                        <div style={{ flex: 1 }}><Bar pct={progress(programTally)} /></div>
                        <span style={{ ...muted, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>wykonano {progress(programTally)}% planu · realizacja {realization(programTally) ?? '—'}%</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {selected.is_template ? (
                      <Button variant="dark" size="small" onClick={() => openCopyProgram(selected, false)} style={{ color: 'var(--gold)' }}><FolderInput size={13} /> Użyj w drużynie</Button>
                    ) : (
                      <Button variant="ghost" size="small" onClick={() => setModal({ kind: 'assign' })}>
                        <Users size={13} /> Przypisanie {activeAssigned.size ? `(${[...activeAssigned].filter(id => groupIds.has(id)).length}/${athletes.length})` : '(brak)'}
                      </Button>
                    )}
                    <Link href={editorHref()} className="coach-btn coach-btn-ghost coach-btn-small" style={{ textDecoration: 'none' }}><Dumbbell size={13} /> Edytor planu</Link>
                    <IconBtn title="Edytuj program" onClick={() => openEditProgram(selected)}><Pencil size={14} /></IconBtn>
                    {!selected.is_template && <IconBtn title="Kopiuj program" onClick={() => openCopyProgram(selected, false)}><Copy size={14} /></IconBtn>}
                    {!selected.is_template && <IconBtn title="Zapisz jako szablon" onClick={() => openCopyProgram(selected, true)}><BookmarkPlus size={14} /></IconBtn>}
                    {!selected.is_template && <IconBtn title={selected.archived ? 'Przywróć z archiwum' : 'Archiwizuj'} onClick={() => toggleArchive(selected)} disabled={busy}>{selected.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}</IconBtn>}
                    <IconBtn title="Usuń program" danger onClick={() => deleteProgram(selected)} disabled={busy}><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
              </Card>

              <div style={{ marginTop: 12 }}>
                <TabsState
                  items={[
                    { key: 'structure', label: 'Struktura' },
                    { key: 'timeline', label: 'Oś czasu' },
                    ...(!selected.is_template ? [{ key: 'stats', label: 'Realizacja' }] : []),
                  ]}
                  active={view}
                  onChange={k => setView(k as any)}
                />
              </div>

              {busy && <div style={{ ...muted, margin: '8px 0' }}>Zapisuję zmiany…</div>}

              {view === 'structure' && (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 4px' }}>
                    <Button variant="ghost" size="small" onClick={() => openMacro()}><Plus size={13} /> Makrocykl</Button>
                    <Button variant="ghost" size="small" onClick={() => openMeso()}><Plus size={13} /> Mezocykl</Button>
                    <Button variant="ghost" size="small" onClick={() => addWeek(null)} disabled={busy}><Plus size={13} /> Mikrocykl (bez mezocyklu)</Button>
                    <Button variant="ghost" size="small" onClick={relayoutDates} disabled={busy} title="Ułóż tygodnie kolejno od startu programu wg kolejności bloków"><RefreshCw size={13} /> Przelicz daty</Button>
                    <span style={{ flex: 1 }} />
                    <Button variant="ghost" size="small" onClick={() => setCollapsed(new Set(weeks.map(w => `w${w.id}`)))}>Zwiń tygodnie</Button>
                    <Button variant="ghost" size="small" onClick={() => setCollapsed(new Set())}>Rozwiń</Button>
                  </div>

                  {macros.length === 0 && mesos.length === 0 && weeks.length === 0 && (
                    <Card><div style={{ padding: '1.5rem', textAlign: 'center', ...muted, lineHeight: 1.6 }}>
                      Program jest pusty. Możesz zacząć od <b>makrocyklu</b> (np. „Przygotowanie do Mistrzostw”), od <b>mezocyklu</b> (blok kilku tygodni z celem)
                      albo po prostu dodać <b>mikrocykl</b> i zaplanować kilka tygodni bez pełnej struktury.
                    </div></Card>
                  )}

                  {sortedMacros.map(mc => renderMacro(mc))}

                  {mesosOfMacro(null).length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      {macros.length > 0 && <div style={{ ...eyebrow, margin: '0 0 2px 4px' }}>Mezocykle bez makrocyklu</div>}
                      {mesosOfMacro(null).map(m => renderMeso(m, mesosOfMacro(null)))}
                    </div>
                  )}

                  {weeksOfMeso(null).length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ ...eyebrow, margin: '0 0 2px 4px' }}>{mesos.length ? 'Mikrocykle poza mezocyklem' : 'Mikrocykle'}</div>
                      {weeksOfMeso(null).map(w => renderWeek(w, weekIndex.get(w.id) ?? 0))}
                    </div>
                  )}

                  {unitTemplates.length > 0 && (
                    <div style={{ ...muted, fontSize: '0.68rem', marginTop: 14 }}>
                      Szablony jednostek: {unitTemplates.map(t => t.day_name || 'Trening').join(', ')} — do wyboru przy dodawaniu jednostki.
                    </div>
                  )}
                </>
              )}

              {view === 'timeline' && <div style={{ marginTop: 12 }}>{renderTimeline()}</div>}
              {view === 'stats' && renderStats()}
            </>
          )}
        </div>
      </div>

      {modal?.kind === 'form' && <FormModal key={modal.title} state={modal} athletes={athletes} onClose={() => setModal(null)} />}
      {modal?.kind === 'assign' && selected && <AssignModal selected={selected} athletes={athletes} activeAssigned={activeAssigned} groupIds={groupIds} planId={planId} onClose={() => setModal(null)} />}
    </>
  )
}
