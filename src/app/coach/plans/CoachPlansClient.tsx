'use client'
// src/app/coach/plans/CoachPlansClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', gold: '#F5C842',
  white: '#FFFFFF', offWhite: '#F4F6F9', gray: '#8A9BB0',
  grayLight: '#E8ECF2', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Plan = { id: number; name: string; description?: string | null; created_at: string }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>
      {children}
    </div>
  )
}

export default function CoachPlansClient({ plans: initialPlans }: { plans: Plan[] }) {
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
      // 1. Nowy plan
      const { data: newPlan, error: e1 } = await supabase
        .from('workout_plans')
        .insert({ name: `Kopia "${plan.name}"`, description: (plan as any).description || null })
        .select()
        .single()
      if (e1 || !newPlan) throw e1 || new Error('Błąd tworzenia planu')

      // 2. Pobierz pełną strukturę oryginału
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
              .select('exercise_id, exercise_code, exercise_order, sets, reps, tempo, weight_kg, rir, is_warmup, warmup_sets, coach_comment, exercise_url')
              .eq('block_id', block.id)
              .order('exercise_order')

            if (exercises && exercises.length > 0) {
              await supabase.from('workout_block_exercises').insert(
                exercises.map((ex: any) => ({ ...ex, block_id: newBlock.id }))
              )
            }
          }
        }
      }

      // Dodaj nowy plan do listy i przejdź do edycji
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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} body{background:${C.offWhite};} button{cursor:pointer;font-family:inherit;}`}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => router.push('/coach')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>← Panel</button>
              <button onClick={() => router.push('/coach/plans/new')} style={{ border: 'none', background: C.gold, color: C.navy, borderRadius: 10, padding: '0.65rem 0.85rem', fontWeight: 800, fontSize: '0.82rem' }}>+ Nowy plan</button>
            </div>
            <h1 style={{ color: C.white, fontSize: '1.45rem', fontWeight: 800, marginTop: '1rem' }}>Plany treningowe</h1>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>Biblioteka planów i edycja tygodni.</p>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {error && <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.86rem', marginBottom: '1rem' }}>❌ {error}</div>}

          {plans.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 6 }}>Brak planów treningowych</div>
                <div style={{ color: C.gray, fontSize: '0.85rem', marginBottom: '1rem' }}>Utwórz pierwszy plan dla swoich zawodniczek.</div>
                <button onClick={() => router.push('/coach/plans/new')} style={{ padding: '0.85rem 1rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 10, fontWeight: 800 }}>Utwórz pierwszy plan</button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plans.map(plan => (
                <Card key={plan.id}>
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <button onClick={() => router.push(`/coach/plans/${plan.id}`)} style={{ flex: 1, background: 'none', border: 'none', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.02rem', color: C.navy }}>{plan.name}</div>
                        {plan.description && <div style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>{plan.description}</div>}
                        <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 7 }}>Utworzony {formatDate(plan.created_at)}</div>
                      </div>
                      <span style={{ color: C.gray, marginLeft: 12, flexShrink: 0 }}>›</span>
                    </button>
                    <button
                      onClick={() => duplicatePlan(plan)}
                      disabled={duplicatingId === plan.id}
                      title="Duplikuj plan"
                      style={{ padding: '0 0.9rem', background: 'none', border: 'none', borderLeft: `1.5px solid ${C.grayLight}`, color: duplicatingId === plan.id ? C.gray : C.navy, fontWeight: 700, fontSize: '0.82rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {duplicatingId === plan.id
                        ? <span style={{ fontFamily: mono, fontSize: '0.7rem' }}>...</span>
                        : <><span style={{ fontSize: '0.85rem' }}>⎘</span><span>Duplikuj</span></>}
                    </button>
                    <button
                      onClick={() => deletePlan(plan)}
                      disabled={deletingId === plan.id}
                      title="Usuń plan"
                      style={{ padding: '0 1rem', background: 'none', border: 'none', borderLeft: `1.5px solid ${C.grayLight}`, color: deletingId === plan.id ? C.gray : C.red, fontWeight: 700, fontSize: '0.82rem', flexShrink: 0 }}
                    >
                      {deletingId === plan.id ? '...' : 'Usuń'}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
