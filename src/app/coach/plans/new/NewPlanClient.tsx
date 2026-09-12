'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Field } from '@/components/coach/ui'

const DAY_TEMPLATES: Record<number, string[]> = {
  1: ['Trening 1'],
  2: ['Trening A', 'Trening B'],
  3: ['Trening A', 'Trening B', 'Trening C'],
  4: ['Trening A', 'Trening B', 'Trening C', 'Trening D'],
  5: ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'],
  6: ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'],
}

const DAY_PRESETS: { label: string; days: string[] }[] = [
  { label: '1 trening', days: ['Trening 1'] },
  { label: 'A / B', days: ['Trening A', 'Trening B'] },
  { label: 'A / B / C', days: ['Trening A', 'Trening B', 'Trening C'] },
  { label: 'Push / Pull / Legs', days: ['Push', 'Pull', 'Legs'] },
  { label: 'Góra / Dół', days: ['Góra ciała', 'Dół ciała'] },
  { label: 'Dni tygodnia ×5', days: ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'] },
  { label: 'Własne', days: [] },
]

export default function NewPlanClient(_props?: any) {
  const router = useRouter()
  const supabase = createClient()

  const DEFAULT_NOTES = `Skróty:
iso = izometria, bb = barbell/sztanga, ssb = safety squat bar, kb = kettlebell, db = dumbbell/hantle, sl = single leg/jednonóż, BW = body weight (ciężar ciała), 1RM = max ciężar na 1 powtórzenie, 50% 1RM = 50% maksimum
rampa = stopniowo zwiększaj ciężar w kolejnych seriach (np. 35/37,5/40 kg)
30" = 30 sekund
5" ecc = faza ekscentryczna trwa 5 sek (np. w przysiadzie = schodzenie w dół)
RIR = powtórzenia w zapasie (kliknij RIR w ćwiczeniu po wyjaśnienie)`

  const [name, setName] = useState('')
  const [description, setDescription] = useState(DEFAULT_NOTES)
  const [weeksCount, setWeeksCount] = useState(4)
  const [daysPerWeek, setDaysPerWeek] = useState(2)
  const [dayNames, setDayNames] = useState<string[]>(['Trening A', 'Trening B'])
  const [customDays, setCustomDays] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function applyPreset(preset: typeof DAY_PRESETS[0]) {
    if (preset.days.length === 0) {
      setCustomDays(true)
      setDayNames(Array.from({ length: daysPerWeek }, (_, i) => `Trening ${i + 1}`))
    } else {
      setCustomDays(false)
      setDayNames(preset.days)
      setDaysPerWeek(preset.days.length)
    }
  }

  function setDayCount(n: number) {
    setDaysPerWeek(n)
    if (!customDays) {
      setDayNames(DAY_TEMPLATES[n] || Array.from({ length: n }, (_, i) => `Trening ${i + 1}`))
    } else {
      setDayNames(prev => {
        const next = [...prev]
        while (next.length < n) next.push(`Trening ${next.length + 1}`)
        return next.slice(0, n)
      })
    }
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Podaj nazwę planu.'); return }
    setSaving(true); setError('')

    const { data: plan, error: planErr } = await supabase
      .from('workout_plans')
      .insert({ name: name.trim(), description: description.trim() || null })
      .select().single()

    if (planErr || !plan) { setError('Błąd tworzenia planu.'); setSaving(false); return }

    const weekRows = Array.from({ length: weeksCount }, (_, i) => ({
      plan_id: plan.id, week_number: i + 1, name: `Tydzień ${i + 1}`,
    }))
    const { data: weeks } = await supabase.from('workout_weeks').insert(weekRows).select()

    if (weeks && weeks.length > 0) {
      const activeDayNames = dayNames.slice(0, daysPerWeek)
      const dayRows = weeks.flatMap((w: any) =>
        activeDayNames.map((dn, di) => ({ week_id: w.id, day_name: dn, day_order: di + 1 }))
      )
      await supabase.from('workout_days').insert(dayRows)
    }

    setSaving(false)
    router.push(`/coach/plans/${plan.id}`)
  }

  const totalDays = weeksCount * daysPerWeek

  return (
    <>
      <SetPageMeta title="Nowy plan" backHref="/coach/plans" backLabel="Plany" />
      <div className="coach-content">
        <div className="coach-wizard-hero">
          <span className="coach-eyebrow">Tworzenie planu</span>
          <h2>Nowy plan treningowy</h2>
        </div>

        <Card className="coach-wizard-card">
          <span className="coach-eyebrow">Podstawowe informacje</span>

          <Field label="Nazwa planu *">
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="np. Plan siłowy — wrzesień 2026"
              autoFocus
            />
          </Field>

          <Field label="Notatki dla zawodniczek — widoczne pod przyciskiem ℹ️ w widoku treningu">
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Skróty, wskazówki, informacje dla zawodniczek..."
              rows={5}
            />
          </Field>
        </Card>

        <Card className="coach-wizard-card">
          <span className="coach-eyebrow">Struktura planu</span>

          <Field label="Liczba tygodni">
            <div className="coach-chip-select-row">
              {[2, 3, 4, 6, 8, 10, 12].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`coach-chip-select ${weeksCount === n ? 'coach-active' : ''}`}
                  onClick={() => setWeeksCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Treningi na tydzień">
            <div className="coach-chip-select-row">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`coach-chip-select ${daysPerWeek === n ? 'coach-active' : ''}`}
                  onClick={() => setDayCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Schemat nazw treningów">
            <div className="coach-scheme-row" style={{ flexWrap: 'wrap' }}>
              {DAY_PRESETS.filter(p => p.days.length === 0 || p.days.length === daysPerWeek).map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  className="coach-scheme-btn"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="coach-day-name-grid">
              {dayNames.slice(0, daysPerWeek).map((dn, i) => (
                <Field key={i} label={`Dzień ${i + 1}`}>
                  <input
                    value={dn}
                    onChange={e => {
                      setCustomDays(true)
                      setDayNames(prev => prev.map((d, j) => j === i ? e.target.value : d))
                    }}
                  />
                </Field>
              ))}
            </div>
          </Field>

          <div className="coach-wizard-summary">
            {[
              { val: weeksCount, lbl: 'tygodni' },
              { val: daysPerWeek, lbl: 'treningów/tydz.' },
              { val: totalDays, lbl: 'treningów łącznie' },
            ].map(({ val, lbl: l }) => (
              <div key={l} className="coach-wizard-summary-item">
                <div className="coach-num">{val}</div>
                <div className="coach-lbl">{l}</div>
              </div>
            ))}
          </div>
        </Card>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1.5px solid #EF4444', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#EF4444', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'var(--font-inter),sans-serif' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          className="coach-wizard-submit"
          onClick={handleCreate}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Tworzę plan...' : 'Utwórz plan i przejdź do edytora →'}
        </button>

        <div className="coach-wizard-hint">
          Możesz edytować wszystko po utworzeniu — dodawać tygodnie, dni i bloki
        </div>
      </div>
    </>
  )
}
