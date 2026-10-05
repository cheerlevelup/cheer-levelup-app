'use client'
// src/app/coach/groups/[id]/plan/GroupPlansPanel.tsx
// Plany grupy samodzielnej: tworzenie planu tylko dla tej grupy (od razu
// przypisany jej zawodniczkom), edycja w edytorze planu i wejście w konkretny
// trening, żeby uzupełnić go za zawodniczki.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Card, Button } from '@/components/coach/ui'
import { Plus, Pencil, ClipboardEdit, Check } from 'lucide-react'

export type GroupPlanDay = { id: number; day_name: string | null; day_order: number; week_number: number; done: number }
export type GroupPlanItem = { id: number; name: string; is_archived: boolean; owned: boolean; days: GroupPlanDay[] }

const INTER = 'var(--font-inter), sans-serif'
const label: React.CSSProperties = { fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted-light)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }
const input: React.CSSProperties = { border: '1.5px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem', fontFamily: INTER, fontSize: '0.86rem', color: 'var(--navy-900)', background: '#ffffff', outline: 'none' }

export default function GroupPlansPanel({ groupId, athletes, plans, currentPlanId }: {
  groupId: number
  athletes: { id: number; full_name: string }[]
  plans: GroupPlanItem[]
  currentPlanId: number | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [weeksCount, setWeeksCount] = useState(1)
  const [perWeek, setPerWeek] = useState(4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Plan aktywny dla wszystkich zawodniczek grupy (jak „Przypisz plan" w Treningach)
  async function assignToGroup(planId: number) {
    const ids = athletes.map(a => a.id)
    if (ids.length) {
      await supabase.from('athlete_workout_assignments').update({ is_active: false }).in('athlete_id', ids).eq('is_active', true)
    }
    await supabase.from('athlete_workout_assignments').update({ is_active: false }).eq('group_id', groupId).eq('is_active', true)
    if (!ids.length) return
    const { error: err } = await supabase.from('athlete_workout_assignments').insert(ids.map(athleteId => ({
      athlete_id: athleteId, plan_id: planId, is_active: true, order_mode: 'sequential',
      start_date: new Date().toISOString().split('T')[0],
    })))
    if (err) throw err
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Podaj nazwę planu.'); return }
    setBusy(true); setError('')
    try {
      const { data: plan, error: planErr } = await supabase
        .from('workout_plans').insert({ name: name.trim(), group_id: groupId }).select().single()
      if (planErr || !plan) {
        throw new Error(/'group_id'/.test(planErr?.message || '')
          ? 'Aby tworzyć plany w grupie, uruchom migrację 202610050001.'
          : (planErr?.message || 'Błąd tworzenia planu'))
      }
      const { data: weeks, error: wErr } = await supabase.from('workout_weeks')
        .insert(Array.from({ length: weeksCount }, (_, i) => ({ plan_id: plan.id, week_number: i + 1, name: `Tydzień ${i + 1}` })))
        .select()
      if (wErr) throw wErr
      // Treningi numerowane w całym planie: Trening 1, 2, 3... (przez wszystkie tygodnie)
      const dayRows = (weeks || [])
        .sort((a: any, b: any) => a.week_number - b.week_number)
        .flatMap((w: any) => Array.from({ length: perWeek }, (_, di) => ({
          week_id: w.id, day_name: `Trening ${(w.week_number - 1) * perWeek + di + 1}`, day_order: di + 1,
        })))
      if (dayRows.length) {
        const { error: dErr } = await supabase.from('workout_days').insert(dayRows)
        if (dErr) throw dErr
      }
      await assignToGroup(plan.id)
      router.push(`/coach/groups/${groupId}/plan/${plan.id}`)
    } catch (e: any) {
      setError(e?.message || String(e))
      setBusy(false)
    }
  }

  async function handleActivate(planId: number) {
    if (!confirm('Ustawić ten plan jako aktywny dla wszystkich zawodniczek grupy? Obecny plan przestanie być aktywny (wpisy zostają).')) return
    setBusy(true); setError('')
    try {
      await assignToGroup(planId)
      router.refresh()
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const visible = plans.filter(p => !p.is_archived || p.id === currentPlanId)

  return (
    <Card>
      <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={label}>Plany grupy</div>
          <div style={{ fontWeight: 800, color: 'var(--navy-900)', marginTop: 2 }}>Twórz plan dla tej grupy i uzupełniaj treningi za zawodniczki</div>
        </div>
        {!creating && (
          <Button variant="dark" size="small" onClick={() => setCreating(true)} style={{ color: 'var(--gold)' }}>
            <Plus size={13} /> Nowy plan
          </Button>
        )}
      </div>

      {creating && (
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1.5px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px' }}>
            <span style={label}>Nazwa planu</span>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate() }} placeholder="np. Mezocykl październik" style={input} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={label}>Tygodnie</span>
            <input type="number" min={1} max={16} value={weeksCount} onChange={e => setWeeksCount(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))} style={{ ...input, width: 80 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={label}>Treningi / tydzień</span>
            <input type="number" min={1} max={7} value={perWeek} onChange={e => setPerWeek(Math.max(1, Math.min(7, parseInt(e.target.value) || 1)))} style={{ ...input, width: 80 }} />
          </label>
          <span style={{ fontFamily: INTER, fontSize: '0.72rem', color: 'var(--muted)', paddingBottom: 10 }}>= {weeksCount * perWeek} treningów</span>
          <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
            <Button variant="ghost" size="small" onClick={() => { setCreating(false); setError('') }}>Anuluj</Button>
            <Button variant="dark" size="small" onClick={handleCreate} disabled={busy} style={{ color: 'var(--gold)' }}>
              {busy ? 'Tworzę...' : 'Utwórz i przypisz grupie'}
            </Button>
          </div>
        </div>
      )}

      {error && <div style={{ padding: '0.6rem 1.25rem', color: '#c23b3b', fontFamily: INTER, fontSize: '0.8rem', fontWeight: 700 }}>❌ {error}</div>}

      {visible.length === 0 && !creating && (
        <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: INTER, fontSize: '0.8rem', color: 'var(--muted-light)' }}>
          Ta grupa nie ma jeszcze planu — kliknij „Nowy plan".
        </div>
      )}

      {visible.map(p => {
        const active = p.id === currentPlanId
        return (
          <div key={p.id} style={{ padding: '0.8rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: 'var(--navy-900)', fontSize: '0.95rem' }}>{p.name}</span>
              {active && <span style={{ fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, color: 'var(--gold)', background: 'var(--navy-900)', borderRadius: 5, padding: '2px 6px' }}>AKTYWNY</span>}
              {!p.owned && <span style={{ fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px' }}>plan ogólny</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {!active && (
                  <Button variant="ghost" size="small" onClick={() => handleActivate(p.id)} disabled={busy}>
                    <Check size={13} /> Ustaw jako aktywny
                  </Button>
                )}
                <Button variant="ghost" size="small" onClick={() => router.push(`/coach/groups/${groupId}/plan/${p.id}`)}>
                  <Pencil size={13} /> Edytuj plan
                </Button>
              </div>
            </div>
            {p.days.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {p.days.map((d, i) => {
                  const all = athletes.length > 0 && d.done >= athletes.length
                  return (
                    <button
                      key={d.id}
                      onClick={() => router.push(`/coach/groups/${groupId}/plan/${p.id}/day/${d.id}`)}
                      title="Uzupełnij ten trening za zawodniczki"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1.5px solid ${all ? '#86C9A0' : 'var(--border)'}`, background: all ? '#EEF8F1' : '#ffffff', borderRadius: 8, padding: '6px 10px', fontFamily: INTER, fontSize: '0.74rem', fontWeight: 700, color: 'var(--navy-900)', outline: 'none' }}
                    >
                      <ClipboardEdit size={13} style={{ color: 'var(--muted-light)' }} />
                      {d.day_name || `Trening ${i + 1}`}
                      <span style={{ fontWeight: 600, color: all ? '#15803d' : 'var(--muted-light)' }}>{d.done}/{athletes.length}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}
