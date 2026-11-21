'use client'
// src/app/coach/plans/CoachPlansClient.tsx
// Zakładka Plany:
//  • Grupy i zawodniczki — każda grupa z planami, jakie miała przypisane; wejście
//    w zawodniczkę pokazuje jej plany (grupowe i indywidualne), pozwala dodać plan
//    indywidualny (widoczny tylko jej) i usunąć dowolny plan, także grupowy.
//  • Biblioteka planów — plany ogólne (nie należą do grupy ani zawodniczki).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Plus, ChevronRight, ChevronLeft, Copy, Trash2, Pencil, User, Users, RotateCcw, Lock, Unlock } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Button, StatCard, SegmentedControl } from '@/components/coach/ui'
import { insertExercisesWithVariants, copyExerciseOverrides } from '@/lib/exerciseVariants'
import { createPlanSkeleton, deactivateGroupAssignments, insertAssignments, isIndividual, removeAssignment } from '@/lib/coach/planAssignments'

type Plan = { id: number; name: string; description?: string | null; created_at: string; group_id?: number | null; athlete_id?: number | null; is_archived?: boolean | null }
type Group = { id: number; name: string; group_type?: string | null }
type Athlete = { id: number; full_name: string; group_id: number | null }
type Assignment = { id: number; athlete_id: number; plan_id: number; is_active: boolean; created_at: string; assignment_type?: string | null; self_access?: boolean | null }
type GroupKey = number | 'none'

const INTER = 'var(--font-inter), sans-serif'
const label: React.CSSProperties = { fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }
const input: React.CSSProperties = { border: '1.5px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem', fontFamily: INTER, fontSize: '0.86rem', color: 'var(--navy-900)', background: '#ffffff', outline: 'none' }
const rowStyle: React.CSSProperties = { padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }
const headStyle: React.CSSProperties = { padding: '0.875rem 1.25rem', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }
const emptyStyle: React.CSSProperties = { padding: '1.25rem', textAlign: 'center', fontFamily: INTER, fontSize: '0.8rem', color: 'var(--muted-light)' }

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'active' | 'group' | 'individual' | 'muted' }) {
  const s: Record<string, React.CSSProperties> = {
    active: { color: 'var(--gold)', background: 'var(--navy-900)' },
    group: { color: 'var(--navy-800)', background: '#eef2f8', border: '1px solid #d5deeb' },
    individual: { color: '#a8650f', background: '#fdf3e2', border: '1px solid #f3d9a8' },
    muted: { color: 'var(--muted)', border: '1px solid var(--border)' },
  }
  return <span style={{ fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap', ...s[tone] }}>{children}</span>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Gdzie edytować plan: plan grupy samodzielnej w zakładce Plan grupy, reszta w edytorze planów
const planHref = (p: Plan) => p.group_id ? `/coach/groups/${p.group_id}/plan/${p.id}` : `/coach/plans/${p.id}`

export default function CoachPlansClient({ plans, groups, athletes, assignments, initialGroupId, initialAthleteId, initialView }: {
  plans: Plan[]
  groups: Group[]
  athletes: Athlete[]
  assignments: Assignment[]
  initialGroupId: GroupKey | null
  initialAthleteId: number | null
  initialView: 'groups' | 'library'
}) {
  const [view, setView] = useState<'groups' | 'library'>(initialView)
  const [groupId, setGroupId] = useState<GroupKey | null>(initialGroupId)
  const [athleteId, setAthleteId] = useState<number | null>(initialAthleteId)

  // stan w adresie — odświeżenie strony / powrót z edytora planu wraca w to samo miejsce
  function navigate(next: { view?: 'groups' | 'library'; g?: GroupKey | null; a?: number | null }) {
    const v = next.view ?? view
    const g = next.g !== undefined ? next.g : groupId
    const a = next.a !== undefined ? next.a : athleteId
    setView(v); setGroupId(g); setAthleteId(a)
    const q = new URLSearchParams()
    if (v === 'library') q.set('view', 'library')
    else {
      if (g != null) q.set('g', String(g))
      if (a != null) q.set('a', String(a))
    }
    window.history.replaceState(null, '', `/coach/plans${q.toString() ? `?${q}` : ''}`)
  }

  const libraryPlans = plans.filter(p => !p.group_id && !p.athlete_id)
  const athlete = athleteId != null ? athletes.find(a => a.id === athleteId) || null : null

  return (
    <>
      <SetPageMeta title="Plany" />
      <div className="coach-content">
        <div className="coach-plany-toolbar">
          <SegmentedControl
            options={[{ value: 'groups', label: 'Grupy i zawodniczki' }, { value: 'library', label: `Biblioteka planów (${libraryPlans.length})` }]}
            value={view}
            onChange={v => navigate({ view: v as 'groups' | 'library' })}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          {view === 'library' ? (
            <PlanLibrary initialPlans={libraryPlans} />
          ) : athlete ? (
            <AthletePlans
              athlete={athlete}
              group={groups.find(g => g.id === athlete.group_id) || null}
              groupAthletes={athletes.filter(a => a.group_id === athlete.group_id)}
              plans={plans}
              assignments={assignments}
              onBack={() => navigate({ g: athlete.group_id ?? 'none', a: null })}
            />
          ) : groupId != null ? (
            <GroupPlans
              groupKey={groupId}
              group={groupId === 'none' ? null : groups.find(g => g.id === groupId) || null}
              athletes={athletes.filter(a => (groupId === 'none' ? a.group_id == null : a.group_id === groupId))}
              plans={plans}
              assignments={assignments}
              onBack={() => navigate({ g: null, a: null })}
              onOpenAthlete={id => navigate({ a: id })}
            />
          ) : (
            <GroupList groups={groups} athletes={athletes} plans={plans} assignments={assignments} onOpen={g => navigate({ g, a: null })} />
          )}
        </div>
      </div>
    </>
  )
}

// ── Plan grupowy aktywny w grupie: najczęstszy aktywny plan grupowy jej zawodniczek ──
function activeGroupPlanId(groupAthletes: Athlete[], assignments: Assignment[]): number | null {
  const ids = new Set(groupAthletes.map(a => a.id))
  const counts = new Map<number, number>()
  for (const as of assignments) {
    if (as.is_active && !isIndividual(as) && ids.has(as.athlete_id)) counts.set(as.plan_id, (counts.get(as.plan_id) || 0) + 1)
  }
  let best: number | null = null
  for (const [pid, c] of counts) if (best == null || c > (counts.get(best) || 0)) best = pid
  return best
}

// ── Lista grup ────────────────────────────────────────────────────────────────
function GroupList({ groups, athletes, plans, assignments, onOpen }: {
  groups: Group[]; athletes: Athlete[]; plans: Plan[]; assignments: Assignment[]; onOpen: (g: GroupKey) => void
}) {
  const planById = new Map(plans.map(p => [p.id, p]))
  const noGroup = athletes.filter(a => a.group_id == null)
  const items: { key: GroupKey; name: string; managed: boolean; members: Athlete[] }[] = [
    ...groups.map(g => ({ key: g.id as GroupKey, name: g.name, managed: g.group_type === 'managed', members: athletes.filter(a => a.group_id === g.id) })),
    ...(noGroup.length ? [{ key: 'none' as GroupKey, name: 'Bez grupy', managed: false, members: noGroup }] : []),
  ]

  return (
    <Card className="coach-list-panel">
      <div style={headStyle}>
        <div>
          <div style={label}>Grupy</div>
          <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>Wybierz grupę, aby zobaczyć jej plany i zawodniczki</div>
        </div>
      </div>
      {items.length === 0 && <div style={emptyStyle}>Brak grup.</div>}
      {items.map(it => {
        const ids = new Set(it.members.map(m => m.id))
        const activePid = activeGroupPlanId(it.members, assignments)
        const groupPlanCount = new Set([
          ...assignments.filter(a => ids.has(a.athlete_id) && !isIndividual(a)).map(a => a.plan_id),
          ...(typeof it.key === 'number' ? plans.filter(p => p.group_id === it.key).map(p => p.id) : []),
        ]).size
        const individualCount = assignments.filter(a => ids.has(a.athlete_id) && a.is_active && isIndividual(a)).length
        return (
          <div key={String(it.key)} className="coach-plan-card-row" onClick={() => onOpen(it.key)}>
            <div className="coach-plan-card-main">
              <div className="coach-plan-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {it.name}
                {it.managed && <Badge>grupa zorganizowana</Badge>}
              </div>
              <div className="coach-plan-card-tagline">
                {activePid ? <>Aktywny plan: <b>{planById.get(activePid)?.name || '—'}</b></> : 'Brak aktywnego planu grupowego'}
              </div>
              <div className="coach-plan-card-meta">
                <span>{it.members.length} zawodniczek</span>
                <span>· {groupPlanCount} {groupPlanCount === 1 ? 'plan grupy' : 'planów grupy'}</span>
                {individualCount > 0 && <span>· {individualCount} indywidualnych</span>}
              </div>
            </div>
            <div className="coach-plan-card-chevron"><ChevronRight /></div>
          </div>
        )
      })}
    </Card>
  )
}

// ── Grupa: plany grupy + zawodniczki ─────────────────────────────────────────
function GroupPlans({ groupKey, group, athletes, plans, assignments, onBack, onOpenAthlete }: {
  groupKey: GroupKey; group: Group | null; athletes: Athlete[]; plans: Plan[]; assignments: Assignment[]
  onBack: () => void; onOpenAthlete: (id: number) => void
}) {
  const router = useRouter()
  const planById = new Map(plans.map(p => [p.id, p]))
  const ids = new Set(athletes.map(a => a.id))
  const groupAssignments = assignments.filter(a => ids.has(a.athlete_id) && !isIndividual(a))
  const activePid = activeGroupPlanId(athletes, assignments)

  // wszystkie plany, jakie grupa miała: z przypisań grupowych + plany utworzone w grupie
  const planIds = [...new Set([
    ...groupAssignments.map(a => a.plan_id),
    ...(typeof groupKey === 'number' ? plans.filter(p => p.group_id === groupKey).map(p => p.id) : []),
  ])]
  const firstAssigned = (pid: number) => groupAssignments.filter(a => a.plan_id === pid).map(a => a.created_at).sort()[0] || planById.get(pid)?.created_at || ''
  planIds.sort((x, y) => (x === activePid ? -1 : y === activePid ? 1 : firstAssigned(y).localeCompare(firstAssigned(x))))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="small" onClick={onBack}><ChevronLeft size={13} /> Wszystkie grupy</Button>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--navy-900)' }}>{group?.name || 'Bez grupy'}</div>
        {group && (
          <Button variant="ghost" size="small" style={{ marginLeft: 'auto' }} onClick={() => router.push(`/coach/groups/${group.id}/plan`)}>
            <Plus size={13} /> Nowy plan grupy
          </Button>
        )}
      </div>

      <Card>
        <div style={headStyle}>
          <div>
            <div style={label}>Plany grupy</div>
            <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>Wszystkie plany, jakie grupa miała przypisane</div>
          </div>
        </div>
        {planIds.length === 0 && <div style={emptyStyle}>Ta grupa nie miała jeszcze żadnego planu.</div>}
        {planIds.map(pid => {
          const p = planById.get(pid)
          if (!p) return null
          const activeFor = new Set(groupAssignments.filter(a => a.plan_id === pid && a.is_active).map(a => a.athlete_id)).size
          const since = firstAssigned(pid)
          return (
            <div key={pid} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontSize: '0.92rem' }}>{p.name}</span>
                  {pid === activePid && <Badge tone="active">AKTYWNY</Badge>}
                  {p.is_archived && <Badge>archiwum</Badge>}
                  {!p.group_id && <Badge>plan ogólny</Badge>}
                </div>
                <div style={{ fontFamily: INTER, fontSize: '0.7rem', color: 'var(--muted-light)', marginTop: 3 }}>
                  {activeFor > 0 ? `aktywny u ${activeFor}/${athletes.length} zawodniczek` : 'nieaktywny'}
                  {since && ` · od ${formatDate(since)}`}
                </div>
              </div>
              <Button variant="ghost" size="small" onClick={() => router.push(planHref(p))}><Pencil size={13} /> Edytuj</Button>
            </div>
          )
        })}
      </Card>

      <Card>
        <div style={headStyle}>
          <div>
            <div style={label}>Zawodniczki</div>
            <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>Kliknij zawodniczkę, aby zobaczyć jej plany lub dodać plan indywidualny</div>
          </div>
        </div>
        {athletes.length === 0 && <div style={emptyStyle}>Brak zawodniczek w tej grupie.</div>}
        {athletes.map(a => {
          const active = assignments.filter(x => x.athlete_id === a.id && x.is_active)
          const grp = active.filter(x => !isIndividual(x))
          const ind = active.filter(isIndividual)
          const missingGroupPlan = activePid != null && !grp.some(x => x.plan_id === activePid)
          return (
            <div key={a.id} className="coach-plan-card-row" onClick={() => onOpenAthlete(a.id)}>
              <div className="coach-plan-card-main">
                <div className="coach-plan-card-title">{a.full_name}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                  {grp.map(x => <Badge key={x.id} tone="group">{planById.get(x.plan_id)?.name || 'plan'}</Badge>)}
                  {ind.map(x => <Badge key={x.id} tone="individual">indywidualny: {planById.get(x.plan_id)?.name || 'plan'}</Badge>)}
                  {missingGroupPlan && <Badge>bez planu grupy</Badge>}
                  {active.length === 0 && !missingGroupPlan && <Badge>brak planów</Badge>}
                </div>
              </div>
              <div className="coach-plan-card-chevron"><ChevronRight /></div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

// ── Zawodniczka: jej plany ────────────────────────────────────────────────────
function AthletePlans({ athlete, group, groupAthletes, plans, assignments, onBack }: {
  athlete: Athlete; group: Group | null; groupAthletes: Athlete[]; plans: Plan[]; assignments: Assignment[]; onBack: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const planById = new Map(plans.map(p => [p.id, p]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'none' | 'existing' | 'new'>('none')
  const [existingId, setExistingId] = useState('')
  const [name, setName] = useState('')
  const [weeksCount, setWeeksCount] = useState(1)
  const [perWeek, setPerWeek] = useState(3)

  const mine = assignments.filter(a => a.athlete_id === athlete.id)
  const active = mine.filter(a => a.is_active)
  const activeGroup = active.filter(a => !isIndividual(a))
  const activeInd = active.filter(isIndividual)
  const history = mine.filter(a => !a.is_active)
  const groupPid = activeGroupPlanId(groupAthletes, assignments)
  const missingGroupPlan = groupPid != null && !activeGroup.some(a => a.plan_id === groupPid)
  // plany utworzone dla tej zawodniczki, które nie są teraz aktywne
  const orphanOwn = plans.filter(p => p.athlete_id === athlete.id && !active.some(a => a.plan_id === p.id))

  const assignable = plans
    .filter(p => !p.group_id && (!p.athlete_id || p.athlete_id === athlete.id) && !p.is_archived && !active.some(a => a.plan_id === p.id))

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError('')
    try { await fn(); router.refresh() }
    catch (e: any) { setError(e?.message || String(e)) }
    finally { setBusy(false) }
  }

  const remove = (a: Assignment) => {
    const p = planById.get(a.plan_id)
    const msg = isIndividual(a)
      ? `Usunąć plan indywidualny „${p?.name}" zawodniczce ${athlete.full_name}? Przestanie go widzieć (wykonane treningi zostają w historii).`
      : `Usunąć plan grupowy „${p?.name}" zawodniczce ${athlete.full_name}? Pozostałe zawodniczki grupy nadal go mają; ona przestanie go widzieć (wykonane treningi zostają w historii).`
    if (!confirm(msg)) return
    run(() => removeAssignment(supabase, a.id))
  }

  const restoreGroupPlan = () => run(async () => {
    if (groupPid == null) return
    await deactivateGroupAssignments(supabase, [athlete.id])
    await insertAssignments(supabase, [{ athlete_id: athlete.id, plan_id: groupPid }], 'group')
  })

  const assignIndividual = (planId: number) => run(async () => {
    await insertAssignments(supabase, [{ athlete_id: athlete.id, plan_id: planId }], 'individual')
    setMode('none'); setExistingId('')
  })

  async function createIndividual() {
    if (!name.trim()) { setError('Podaj nazwę planu.'); return }
    setBusy(true); setError('')
    try {
      const plan = await createPlanSkeleton(supabase, { name: name.trim(), weeksCount, perWeek, athleteId: athlete.id })
      await insertAssignments(supabase, [{ athlete_id: athlete.id, plan_id: plan.id }], 'individual')
      router.push(`/coach/plans/${plan.id}`)
    } catch (e: any) {
      setError(e?.message || String(e))
      setBusy(false)
    }
  }

  const deleteOwnPlan = (p: Plan) => {
    if (!confirm(`Usunąć całkowicie plan „${p.name}"? Tej operacji nie można cofnąć.`)) return
    run(async () => {
      for (const a of mine.filter(x => x.plan_id === p.id)) await removeAssignment(supabase, a.id)
      const { error: err } = await supabase.from('workout_plans').delete().eq('id', p.id)
      if (err) throw err
    })
  }

  // samodzielna praca: null = domyślnie (grupa samodzielna tak, zorganizowana nie)
  const selfAccessOf = (a: Assignment) => a.self_access ?? (group?.group_type !== 'managed')
  const toggleSelfAccess = (a: Assignment) => run(async () => {
    const { error: err } = await supabase.from('athlete_workout_assignments').update({ self_access: !selfAccessOf(a) }).eq('id', a.id)
    if (err) throw new Error(/self_access/.test(err.message) ? 'Aby włączać samodzielną pracę, uruchom w Supabase migrację 202611160001_plan_self_access.sql.' : err.message)
  })

  const assignmentRow = (a: Assignment) => {
    const p = planById.get(a.plan_id)
    const selfAccess = selfAccessOf(a)
    return (
      <div key={a.id} style={rowStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontSize: '0.92rem' }}>{p?.name || `Plan #${a.plan_id}`}</span>
            {isIndividual(a) ? <Badge tone="individual">indywidualny</Badge> : <Badge tone="group">z grupy</Badge>}
            {selfAccess ? <Badge tone="active">SAMODZIELNA PRACA</Badge> : <Badge>tylko treningi rozpoczęte przez trenera</Badge>}
          </div>
          <div style={{ fontFamily: INTER, fontSize: '0.7rem', color: 'var(--muted-light)', marginTop: 3 }}>
            przypisany {formatDate(a.created_at)}
            {selfAccess ? ' · zawodniczka widzi wszystkie treningi planu i uzupełnia je kiedy chce' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {selfAccess ? (
            <Button variant="ghost" size="small" onClick={() => toggleSelfAccess(a)} disabled={busy} title="Zawodniczka zobaczy tylko trening rozpoczęty przez Ciebie (i już rozpoczęte)">
              <Lock size={13} /> Wyłącz samodzielną pracę
            </Button>
          ) : (
            <Button variant="dark" size="small" onClick={() => toggleSelfAccess(a)} disabled={busy} style={{ color: 'var(--gold)' }} title="Zawodniczka dostanie wszystkie treningi planu i może je uzupełniać w dowolnym czasie">
              <Unlock size={13} /> Aktywuj plan do samodzielnej pracy
            </Button>
          )}
          {p && <Button variant="ghost" size="small" onClick={() => router.push(planHref(p))}><Pencil size={13} /> Edytuj</Button>}
          <Button variant="ghost" size="small" onClick={() => remove(a)} disabled={busy} style={{ color: '#c23b3b' }}><Trash2 size={13} /> Usuń</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="small" onClick={onBack}><ChevronLeft size={13} /> {group?.name || 'Bez grupy'}</Button>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--navy-900)' }}>{athlete.full_name}</div>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#fdecec', border: '1px solid #f0b4b4', borderRadius: 10, color: '#c23b3b', fontWeight: 600, fontSize: 13, fontFamily: INTER }}>{error}</div>}

      <Card>
        <div style={headStyle}>
          <div>
            <div style={label}><Users size={10} style={{ verticalAlign: '-1px' }} /> Plany z grupy</div>
            <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>Narzucone przez grupę {group?.name || ''}</div>
          </div>
        </div>
        {activeGroup.map(assignmentRow)}
        {missingGroupPlan && (
          <div style={{ ...rowStyle, background: 'var(--bg)' }}>
            <div style={{ flex: 1, fontFamily: INTER, fontSize: '0.78rem', color: 'var(--muted)' }}>
              Plan grupy <b>{planById.get(groupPid!)?.name}</b> nie jest przypisany tej zawodniczce.
            </div>
            <Button variant="ghost" size="small" onClick={restoreGroupPlan} disabled={busy}><RotateCcw size={13} /> Przywróć plan grupy</Button>
          </div>
        )}
        {activeGroup.length === 0 && !missingGroupPlan && <div style={emptyStyle}>Brak planu grupowego.</div>}
      </Card>

      <Card>
        <div style={headStyle}>
          <div>
            <div style={label}><User size={10} style={{ verticalAlign: '-1px' }} /> Plany indywidualne</div>
            <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>Widoczne tylko dla {athlete.full_name}</div>
          </div>
          {mode === 'none' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="ghost" size="small" onClick={() => setMode('existing')}>Przypisz istniejący</Button>
              <Button variant="dark" size="small" onClick={() => { setMode('new'); setName(`Plan indywidualny — ${athlete.full_name}`) }} style={{ color: 'var(--gold)' }}>
                <Plus size={13} /> Nowy plan indywidualny
              </Button>
            </div>
          )}
        </div>

        {mode === 'existing' && (
          <div style={{ ...rowStyle, background: 'var(--bg)', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px' }}>
              <span style={label}>Plan z biblioteki</span>
              <select value={existingId} onChange={e => setExistingId(e.target.value)} style={input}>
                <option value="">Wybierz plan...</option>
                {assignable.map(p => <option key={p.id} value={p.id}>{p.name}{p.athlete_id ? ' (utworzony dla niej)' : ''}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
              <Button variant="ghost" size="small" onClick={() => { setMode('none'); setError('') }}>Anuluj</Button>
              <Button variant="dark" size="small" disabled={!existingId || busy} onClick={() => assignIndividual(parseInt(existingId))} style={{ color: 'var(--gold)' }}>
                {busy ? 'Przypisuję...' : 'Przypisz indywidualnie'}
              </Button>
            </div>
          </div>
        )}

        {mode === 'new' && (
          <div style={{ ...rowStyle, background: 'var(--bg)', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px' }}>
              <span style={label}>Nazwa planu</span>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createIndividual() }} style={input} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={label}>Tygodnie</span>
              <input type="number" min={1} max={16} value={weeksCount} onChange={e => setWeeksCount(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))} style={{ ...input, width: 80 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={label}>Treningi / tydzień</span>
              <input type="number" min={1} max={7} value={perWeek} onChange={e => setPerWeek(Math.max(1, Math.min(7, parseInt(e.target.value) || 1)))} style={{ ...input, width: 80 }} />
            </label>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
              <Button variant="ghost" size="small" onClick={() => { setMode('none'); setError('') }}>Anuluj</Button>
              <Button variant="dark" size="small" onClick={createIndividual} disabled={busy} style={{ color: 'var(--gold)' }}>
                {busy ? 'Tworzę...' : 'Utwórz i przypisz'}
              </Button>
            </div>
          </div>
        )}

        {activeInd.map(assignmentRow)}
        {activeInd.length === 0 && mode === 'none' && <div style={emptyStyle}>Brak planów indywidualnych.</div>}

        {orphanOwn.map(p => (
          <div key={p.id} style={{ ...rowStyle, opacity: 0.8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: 'var(--navy-900)', fontSize: '0.88rem' }}>{p.name}</span>
                <Badge>nieprzypisany</Badge>
              </div>
              <div style={{ fontFamily: INTER, fontSize: '0.7rem', color: 'var(--muted-light)', marginTop: 3 }}>plan utworzony dla tej zawodniczki</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="ghost" size="small" onClick={() => assignIndividual(p.id)} disabled={busy}><RotateCcw size={13} /> Przypisz ponownie</Button>
              <Button variant="ghost" size="small" onClick={() => router.push(planHref(p))}><Pencil size={13} /> Edytuj</Button>
              <Button variant="ghost" size="small" onClick={() => deleteOwnPlan(p)} disabled={busy} style={{ color: '#c23b3b' }}><Trash2 size={13} /> Usuń plan</Button>
            </div>
          </div>
        ))}
      </Card>

      {history.length > 0 && (
        <Card>
          <div style={headStyle}>
            <div>
              <div style={label}>Historia</div>
              <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>Wcześniejsze plany</div>
            </div>
          </div>
          {history.map(a => {
            const p = planById.get(a.plan_id)
            return (
              <div key={a.id} style={{ ...rowStyle, padding: '0.55rem 1.25rem' }}>
                <span style={{ flex: 1, fontFamily: INTER, fontSize: '0.8rem', color: 'var(--navy-900)', fontWeight: 600 }}>{p?.name || `Plan #${a.plan_id}`}</span>
                {isIndividual(a) ? <Badge tone="individual">indywidualny</Badge> : <Badge tone="group">z grupy</Badge>}
                <span style={{ fontFamily: INTER, fontSize: '0.7rem', color: 'var(--muted-light)' }}>{formatDate(a.created_at)}</span>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

// ── Biblioteka planów ogólnych (dotychczasowa lista) ─────────────────────────
function PlanLibrary({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [plans, setPlans] = useState(initialPlans)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function deletePlan(plan: Plan) {
    if (!confirm(`Usunąć plan "${plan.name}"? Ta operacja jest nieodwracalna.`)) return
    setDeletingId(plan.id)
    setError('')
    try {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('athlete_workout_assignments')
        .select('id')
        .eq('plan_id', plan.id)
      if (assignmentsError) throw assignmentsError

      const assignmentIds = (assignments || []).map(a => a.id)
      if (assignmentIds.length > 0) {
        const { error: sessionsError } = await supabase
          .from('workout_sessions')
          .update({ assignment_id: null })
          .in('assignment_id', assignmentIds)
        if (sessionsError) console.warn('Nie udało się odpiąć sesji przed usunięciem przypisania:', sessionsError.message)

        const { error: deleteAssignmentsError } = await supabase
          .from('athlete_workout_assignments')
          .delete()
          .in('id', assignmentIds)
        if (deleteAssignmentsError) throw deleteAssignmentsError
      }

      const { error: err } = await supabase.from('workout_plans').delete().eq('id', plan.id)
      if (err) throw err

      setPlans(prev => prev.filter(p => p.id !== plan.id))
    } catch (e: any) {
      setError(`Błąd: ${e?.message || e}`)
    } finally {
      setDeletingId(null)
    }
  }

  async function duplicatePlan(plan: Plan) {
    setDuplicatingId(plan.id)
    setError('')
    try {
      const { data: newPlan, error: e1 } = await supabase
        .from('workout_plans')
        .insert({ name: `Kopia "${plan.name}"`, description: plan.description || null })
        .select()
        .single()
      if (e1 || !newPlan) throw e1 || new Error('Błąd tworzenia planu')

      const { data: weeks } = await supabase
        .from('workout_weeks')
        .select('id, week_number, name')
        .eq('plan_id', plan.id)
        .order('week_number')

      for (const week of (weeks || [])) {
        const { data: newWeek, error: e2 } = await supabase
          .from('workout_weeks')
          .insert({ plan_id: newPlan.id, week_number: week.week_number, name: week.name || null })
          .select()
          .single()
        if (e2 || !newWeek) continue

        const { data: days } = await supabase
          .from('workout_days')
          .select('id, day_name, day_order')
          .eq('week_id', week.id)
          .order('day_order')

        for (const day of (days || [])) {
          const { data: newDay, error: e3 } = await supabase
            .from('workout_days')
            .insert({ week_id: newWeek.id, day_name: day.day_name, day_order: day.day_order })
            .select()
            .single()
          if (e3 || !newDay) continue

          const { data: blocks } = await supabase
            .from('workout_day_blocks')
            .select('id, block_name, block_order, rounds')
            .eq('day_id', day.id)
            .order('block_order')

          for (const block of (blocks || [])) {
            const { data: newBlock, error: e4 } = await supabase
              .from('workout_day_blocks')
              .insert({ day_id: newDay.id, block_name: block.block_name, block_order: block.block_order, rounds: block.rounds })
              .select()
              .single()
            if (e4 || !newBlock) continue

            const { data: exercises } = await supabase
              .from('workout_block_exercises')
              .select('*')
              .eq('block_id', block.id)
              .order('exercise_order')

            if (exercises && exercises.length > 0) {
              // wszystkie kolumny (serie, ISO, rozgrzewka...), warianty 1b/1c przepięte na nowe ćwiczenia bazowe
              const { idMap } = await insertExercisesWithVariants(supabase, exercises, ({ id, block_id, created_at, variant_of, variant_athlete_ids, ...rest }: any) => ({ ...rest, block_id: newBlock.id }), 'id')
              await copyExerciseOverrides(supabase, idMap)
            }
          }
        }
      }

      setPlans(prev => [{ id: newPlan.id, name: newPlan.name, description: newPlan.description, created_at: newPlan.created_at }, ...prev])
      router.push(`/coach/plans/${newPlan.id}`)
    } catch (e: any) {
      setError(`Błąd duplikowania: ${e?.message || e}`)
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <>
      <div className="coach-plany-toolbar">
        <div className="coach-stats-mini">
          <StatCard label="Plany ogólne" value={plans.length} />
        </div>
        <Button variant="dark" id="coach-newPlanBtn" onClick={() => router.push('/coach/plans/new')}>
          <Plus size={15} /> Nowy plan
        </Button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fdecec', border: '1px solid #f0b4b4', borderRadius: 10, color: '#c23b3b', fontWeight: 600, fontSize: 13, fontFamily: INTER, marginTop: 12 }}>
          {error}
        </div>
      )}

      {plans.length === 0 ? (
        <Card>
          <div className="coach-empty-list">
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>Brak planów treningowych</div>
            <div style={{ marginBottom: 14 }}>Utwórz pierwszy plan dla swoich zawodniczek.</div>
            <Button variant="dark" onClick={() => router.push('/coach/plans/new')}>Utwórz pierwszy plan</Button>
          </div>
        </Card>
      ) : (
        <Card className="coach-list-panel">
          {plans.map(plan => (
            <div key={plan.id} className="coach-plan-card-row">
              <div className="coach-plan-card-main" onClick={() => router.push(`/coach/plans/${plan.id}`)}>
                <div className="coach-plan-card-title">{plan.name}</div>
                {plan.description && <div className="coach-plan-card-tagline">{plan.description}</div>}
                <div className="coach-plan-card-meta">Utworzony {formatDate(plan.created_at)}</div>
              </div>
              <div className="coach-plan-card-actions">
                <button type="button" className="coach-plan-card-action coach-dup" onClick={() => duplicatePlan(plan)} disabled={duplicatingId === plan.id} title="Duplikuj plan">
                  {duplicatingId === plan.id ? <span>...</span> : (<><Copy size={11} /><span>Duplikuj</span></>)}
                </button>
                <button type="button" className="coach-plan-card-action coach-del" onClick={() => deletePlan(plan)} disabled={deletingId === plan.id} title="Usuń plan">
                  {deletingId === plan.id ? <span>...</span> : (<><Trash2 size={11} /><span>Usuń</span></>)}
                </button>
              </div>
              <div className="coach-plan-card-chevron" onClick={() => router.push(`/coach/plans/${plan.id}`)}>
                <ChevronRight />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
