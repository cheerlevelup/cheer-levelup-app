'use client'
// src/components/coach/StartPlanTrainingModal.tsx
// „Rozpocznij trening" w zarządzaniu grupą: 1) plan realizowany przez grupę,
// 2) konkretny trening z planu, 3) lista obecności → tabela wpisywania wyników.
// Start: plan staje się aktywny dla zawodniczek grupy, trening dostaje dzisiejszą
// datę (u zawodniczek pojawia się jako „Dzisiejszy trening" i mogą wpisywać ciężary),
// nieobecne trafiają do workout_days.absent_athlete_ids.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Modal, Button } from '@/components/coach/ui'
import { fillHref, rememberFillDay } from '@/components/coach/PlanModeSwitch'
import { deactivateGroupAssignments, insertAssignments } from '@/lib/coach/planAssignments'
import { localDateStr } from '@/lib/groupTraining'

export type StartPlanOption = { id: number; name: string; tag: 'active' | 'group' | 'library' }
type DayOpt = { id: number; day_name: string | null; day_order: number; week_number: number; training_date: string | null; done: number }

const INTER = 'var(--font-inter), sans-serif'
const label: React.CSSProperties = { fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }
const optBtn = (on: boolean): React.CSSProperties => ({
  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.85rem', borderRadius: 10, cursor: 'pointer',
  border: `1.5px solid ${on ? 'var(--gold)' : 'var(--border)'}`, background: on ? 'var(--navy-900)' : '#fff', color: on ? 'var(--gold)' : 'var(--navy-900)',
  fontFamily: INTER, fontSize: '0.84rem', fontWeight: 700,
})
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric' })

export default function StartPlanTrainingModal({ groupId, athletes, plans, onClose }: {
  groupId: number
  athletes: { id: number; full_name: string }[]
  plans: StartPlanOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [planId, setPlanId] = useState<number | null>(plans.find(p => p.tag === 'active')?.id ?? null)
  const [days, setDays] = useState<DayOpt[] | null>(null)
  const [dayId, setDayId] = useState<number | null>(null)
  const [present, setPresent] = useState<Set<number>>(() => new Set(athletes.map(a => a.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = localDateStr()

  // treningi wybranego planu + ile zawodniczek grupy już je zakończyło
  useEffect(() => {
    if (planId == null) return
    let alive = true
    ;(async () => {
      setDays(null); setDayId(null)
      const { data: weeks } = await supabase.from('workout_weeks').select('id, week_number').eq('plan_id', planId)
      const weekNum = new Map((weeks || []).map((w: any) => [w.id, w.week_number as number]))
      const { data: rows } = weekNum.size
        ? await supabase.from('workout_days').select('*').in('week_id', [...weekNum.keys()])
        : { data: [] as any[] }
      const dayIds = (rows || []).map((d: any) => d.id)
      const ids = athletes.map(a => a.id)
      const { data: done } = dayIds.length && ids.length
        ? await supabase.from('workout_sessions').select('athlete_id, workout_day_id').in('workout_day_id', dayIds).in('athlete_id', ids).eq('completed', true)
        : { data: [] as any[] }
      const doneBy = new Map<number, Set<number>>()
      for (const s of (done || []) as any[]) {
        if (!doneBy.has(s.workout_day_id)) doneBy.set(s.workout_day_id, new Set())
        doneBy.get(s.workout_day_id)!.add(s.athlete_id)
      }
      const list: DayOpt[] = ((rows || []) as any[]).map(d => ({
        id: d.id, day_name: d.day_name, day_order: d.day_order, week_number: weekNum.get(d.week_id) ?? 1,
        training_date: d.training_date ?? null, done: doneBy.get(d.id)?.size ?? 0,
      })).sort((a, b) => a.week_number - b.week_number || a.day_order - b.day_order)
      if (!alive) return
      setDays(list)
      // podpowiedź: trening z dzisiejszą datą, inaczej pierwszy, którego grupa jeszcze nie zrobiła
      setDayId((list.find(d => d.training_date === today) || list.find(d => d.done === 0) || list[0])?.id ?? null)
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  async function start() {
    if (planId == null || dayId == null) return
    setBusy(true); setError('')
    try {
      const ids = athletes.map(a => a.id)
      // 1. plan aktywny dla zawodniczek grupy (zawodniczka zobaczy go w swoim panelu)
      if (ids.length) {
        const { data: act } = await supabase.from('athlete_workout_assignments').select('*').in('athlete_id', ids).eq('is_active', true)
        const have = new Set(((act || []) as any[]).filter(a => a.plan_id === planId).map(a => a.athlete_id))
        const need = ids.filter(id => !have.has(id))
        if (need.length) {
          await deactivateGroupAssignments(supabase, need)
          await insertAssignments(supabase, need.map(athleteId => ({ athlete_id: athleteId, plan_id: planId })), 'group')
        }
      }
      // 2. dzisiejsza data treningu + nieobecne
      const absent = ids.filter(id => !present.has(id))
      let { error: dErr } = await supabase.from('workout_days').update({ training_date: today, absent_athlete_ids: absent }).eq('id', dayId)
      if (dErr && /training_date/.test(dErr.message)) {
        ;({ error: dErr } = await supabase.from('workout_days').update({ absent_athlete_ids: absent }).eq('id', dayId))
      }
      if (dErr) throw new Error(/absent_athlete_ids/.test(dErr.message) ? 'Aby zapisać obecność, uruchom migrację 202610050005.' : dErr.message)
      // 3. tabela wpisywania wyników
      rememberFillDay(planId, dayId)
      router.push(fillHref(groupId, planId, dayId))
    } catch (e: any) {
      setError(e?.message || String(e))
      setBusy(false)
    }
  }

  const plan = plans.find(p => p.id === planId)
  const day = days?.find(d => d.id === dayId)
  const multiWeek = new Set((days || []).map(d => d.week_number)).size > 1

  const footer = (
    <>
      {step > 1 && <Button variant="ghost" onClick={() => setStep((step - 1) as 1 | 2)} disabled={busy}>← Wstecz</Button>}
      <Button variant="ghost" onClick={onClose} disabled={busy}>Anuluj</Button>
      {step === 1 && <Button variant="dark" disabled={planId == null} onClick={() => setStep(2)}>Dalej: wybierz trening →</Button>}
      {step === 2 && <Button variant="dark" disabled={dayId == null} onClick={() => setStep(3)}>Dalej: obecność →</Button>}
      {step === 3 && (
        <Button variant="dark" disabled={busy} onClick={start} style={{ color: 'var(--gold)' }}>
          {busy ? 'Rozpoczynam…' : `Rozpocznij trening (${present.size}/${athletes.length})`}
        </Button>
      )}
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={`Rozpocznij trening · krok ${step}/3`}
      title={step === 1 ? 'Który plan realizuje grupa?' : step === 2 ? `Który trening z planu „${plan?.name}”?` : `Obecność · ${day?.day_name || 'Trening'}`}
      footer={footer}
    >
      {error && <div style={{ color: '#c23b3b', fontSize: '0.82rem', marginBottom: 10, background: '#FEF2F2', border: '1.5px solid #c23b3b', borderRadius: 10, padding: '0.6rem 0.75rem', fontFamily: INTER }}>❌ {error}</div>}

      {step === 1 && (
        plans.length === 0 ? (
          <div style={{ fontFamily: INTER, fontSize: '0.84rem', color: 'var(--muted)' }}>Brak planów. Utwórz plan w zakładce Plany (biblioteka) i wróć tutaj.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '55vh', overflowY: 'auto' }}>
            {(['active', 'group', 'library'] as const).map(tag => {
              const list = plans.filter(p => p.tag === tag)
              if (!list.length) return null
              return (
                <div key={tag} style={{ marginBottom: 6 }}>
                  <div style={label}>{tag === 'active' ? 'Aktywny plan grupy' : tag === 'group' ? 'Wcześniejsze plany grupy' : 'Biblioteka planów'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {list.map(p => (
                      <button key={p.id} type="button" style={optBtn(p.id === planId)} onClick={() => setPlanId(p.id)}>{p.name}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {step === 2 && (
        days == null ? (
          <div style={{ fontFamily: INTER, fontSize: '0.84rem', color: 'var(--muted)' }}>Wczytuję treningi planu…</div>
        ) : days.length === 0 ? (
          <div style={{ fontFamily: INTER, fontSize: '0.84rem', color: 'var(--muted)' }}>Ten plan nie ma jeszcze treningów — dodaj je w edytorze planu.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '55vh', overflowY: 'auto' }}>
            {days.map(d => (
              <button key={d.id} type="button" style={optBtn(d.id === dayId)} onClick={() => setDayId(d.id)}>
                <span style={{ flex: 1 }}>
                  {d.day_name || 'Trening'}
                  {multiWeek && <span style={{ fontWeight: 600, opacity: 0.7 }}> · tydzień {d.week_number}</span>}
                </span>
                {d.training_date && <span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8 }}>{d.training_date === today ? 'dziś' : shortDate(d.training_date)}</span>}
                <span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8 }}>zakończone {d.done}/{athletes.length}</span>
              </button>
            ))}
          </div>
        )
      )}

      {step === 3 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ ...label, marginBottom: 0 }}>Odznacz nieobecne</span>
            <button type="button" onClick={() => setPresent(present.size === athletes.length ? new Set() : new Set(athletes.map(a => a.id)))}
              style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
              {present.size === athletes.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '50vh', overflowY: 'auto' }}>
            {athletes.map(a => {
              const on = present.has(a.id)
              return (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.85rem', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--gold)' : 'var(--border)'}`, background: on ? '#fffaf0' : 'var(--bg)', fontFamily: INTER, fontSize: '0.84rem', fontWeight: 700, color: on ? 'var(--navy-900)' : 'var(--muted-light)', textDecoration: on ? 'none' : 'line-through' }}>
                  <input type="checkbox" checked={on} onChange={() => setPresent(prev => { const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n })} />
                  {a.full_name}
                  {!on && <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#b42318', textDecoration: 'none' }}>nieobecna</span>}
                </label>
              )
            })}
          </div>
          <div style={{ marginTop: 10, fontFamily: INTER, fontSize: '0.72rem', color: 'var(--muted)' }}>
            Po rozpoczęciu trening „{day?.day_name}” pojawi się zawodniczkom jako dzisiejszy — mogą od razu wpisywać ciężary. Obecność możesz jeszcze zmienić w tabeli.
          </div>
        </>
      )}
    </Modal>
  )
}
