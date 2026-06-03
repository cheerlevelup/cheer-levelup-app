'use client'
// src/app/coach/plans/new/NewPlanClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

export default function NewPlanClient({ exercises }: any) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weeksCount, setWeeksCount] = useState(4)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('Podaj nazwę planu.'); return }
    setSaving(true)
    setError('')

    // 1. Utwórz plan
    const { data: plan, error: planErr } = await supabase
      .from('workout_plans')
      .insert({ name: name.trim(), description: description.trim() || null })
      .select()
      .single()

    if (planErr || !plan) {
      setError('Błąd tworzenia planu.')
      setSaving(false)
      return
    }

    // 2. Utwórz tygodnie
    const weekRows = Array.from({ length: weeksCount }, (_, i) => ({
      plan_id: plan.id,
      week_number: i + 1,
      name: `Tydzień ${i + 1}`,
    }))

    const { data: weeks } = await supabase
      .from('workout_weeks')
      .insert(weekRows)
      .select()

    // 3. Utwórz po 2 dni w każdym tygodniu (Dzień A, Dzień B)
    if (weeks && weeks.length > 0) {
      const dayRows = weeks.flatMap((w: any) => [
        { week_id: w.id, day_name: 'Dzień A', day_order: 1 },
        { week_id: w.id, day_name: 'Dzień B', day_order: 2 },
      ])
      await supabase.from('workout_days').insert(dayRows)
    }

    setSaving(false)
    router.push(`/coach/plans/${plan.id}`)
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F0EEE9; }`}</style>
      <div style={{ minHeight: '100vh', background: '#F0EEE9', fontFamily: sans, color: '#111' }}>
        <header style={{
          borderBottom: '1px solid #D5D2CB', padding: '1.25rem 2rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: '#F0EEE9', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button onClick={() => router.push('/coach/plans')} style={{ fontFamily: mono, fontSize: '0.75rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}>
            ← Plany
          </button>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Nowy plan</h1>
        </header>

        <main style={{ maxWidth: 520, margin: '0 auto', padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Nazwa planu *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="np. Plan 7 — wrzesień 2026"
              autoFocus
              style={{ width: '100%', padding: '0.875rem', fontFamily: sans, fontSize: '1rem', background: '#E8E6E0', border: 'none', color: '#111', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Opis (opcjonalnie)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Krótki opis planu..."
              rows={3}
              style={{ width: '100%', padding: '0.875rem', fontFamily: sans, fontSize: '0.9rem', background: '#E8E6E0', border: 'none', color: '#111', outline: 'none', resize: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Liczba tygodni
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[2, 3, 4, 6, 8].map(n => (
                <button
                  key={n}
                  onClick={() => setWeeksCount(n)}
                  style={{
                    width: 48, height: 48,
                    background: weeksCount === n ? '#111' : '#E8E6E0',
                    color: weeksCount === n ? '#F0EEE9' : '#111',
                    fontFamily: mono, fontSize: '0.9rem', fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', marginTop: 6, letterSpacing: '0.04em' }}>
              Każdy tydzień będzie miał Dzień A i Dzień B (możesz dodać więcej po utworzeniu).
            </p>
          </div>

          {error && (
            <div style={{ background: '#FEF0EF', borderLeft: '3px solid #E74C3C', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.88rem', color: '#c0392b' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            style={{
              width: '100%', padding: '1rem',
              background: saving || !name.trim() ? '#888' : '#111',
              color: '#F0EEE9', fontFamily: sans, fontSize: '0.95rem', fontWeight: 700,
              border: 'none', cursor: saving || !name.trim() ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Tworzę plan...' : 'Utwórz plan i przejdź do edytora →'}
          </button>
        </main>
      </div>
    </>
  )
}
