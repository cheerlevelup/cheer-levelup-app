'use client'
// src/app/coach/plans/CoachPlansClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Plus, ChevronRight, Copy, Trash2 } from 'lucide-react'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Button, StatCard } from '@/components/coach/ui'

type Plan = { id: number; name: string; description?: string | null; created_at: string }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
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
      <SetPageMeta title="Plany" />
      <div className="coach-content">
        <div className="coach-plany-toolbar">
          <div className="coach-stats-mini">
            <StatCard label="Plany treningowe" value={plans.length} />
          </div>
          <Button variant="dark" id="coach-newPlanBtn" onClick={() => router.push('/coach/plans/new')}>
            <Plus size={15} /> Nowy plan
          </Button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fdecec', border: '1px solid #f0b4b4', borderRadius: 10, color: '#c23b3b', fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-inter),sans-serif', marginTop: 12 }}>
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
                  <button
                    type="button"
                    className="coach-plan-card-action coach-dup"
                    onClick={() => duplicatePlan(plan)}
                    disabled={duplicatingId === plan.id}
                    title="Duplikuj plan"
                  >
                    {duplicatingId === plan.id ? <span>...</span> : (<><Copy size={11} /><span>Duplikuj</span></>)}
                  </button>
                  <button
                    type="button"
                    className="coach-plan-card-action coach-del"
                    onClick={() => deletePlan(plan)}
                    disabled={deletingId === plan.id}
                    title="Usuń plan"
                  >
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
      </div>
    </>
  )
}
