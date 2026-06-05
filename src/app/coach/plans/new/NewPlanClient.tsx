'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { CSSProperties } from 'react'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', red: '#EF4444', green: '#22C55E',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

const DAY_TEMPLATES: Record<number, string[]> = {
  2: ['Trening A', 'Trening B'],
  3: ['Trening A', 'Trening B', 'Trening C'],
  4: ['Trening A', 'Trening B', 'Trening C', 'Trening D'],
  5: ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'],
  6: ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'],
}

const DAY_PRESETS: { label: string; days: string[] }[] = [
  { label: 'A / B', days: ['Trening A', 'Trening B'] },
  { label: 'A / B / C', days: ['Trening A', 'Trening B', 'Trening C'] },
  { label: 'Push / Pull / Legs', days: ['Push', 'Pull', 'Legs'] },
  { label: 'Góra / Dół', days: ['Góra ciała', 'Dół ciała'] },
  { label: 'Dni tygodnia ×5', days: ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'] },
  { label: 'Własne', days: [] },
]

function inp(extra?: CSSProperties): CSSProperties {
  return {
    width: '100%', minHeight: 44, border: `1.5px solid ${C.grayLight}`, borderRadius: 10,
    background: C.offWhite, color: C.navy, padding: '0 0.875rem',
    fontFamily: sans, fontSize: '0.95rem', outline: 'none', ...extra,
  }
}
function lbl(): CSSProperties {
  return {
    display: 'block', fontFamily: mono, fontSize: '0.62rem', color: C.gray,
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700,
  }
}
function card(extra?: CSSProperties): CSSProperties {
  return {
    background: C.white, border: `1.5px solid ${C.grayLight}`,
    borderRadius: 14, padding: '1.25rem', marginBottom: '1rem',
    boxShadow: '0 2px 12px rgba(13,27,42,0.05)', ...extra,
  }
}

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
      const dayRows = weeks.flatMap((w: any) =>
        dayNames.map((dn, di) => ({ week_id: w.id, day_name: dn, day_order: di + 1 }))
      )
      await supabase.from('workout_days').insert(dayRows)
    }

    setSaving(false)
    router.push(`/coach/plans/${plan.id}`)
  }

  const totalDays = weeksCount * daysPerWeek

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        input, textarea, button { font-family: inherit; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        {/* Header */}
        <header style={{ background: C.navy, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={() => router.push('/coach/plans')}
            style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 9, padding: '0.5rem 0.85rem', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}>
            ← Plany
          </button>
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Tworzenie planu</div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>Nowy plan treningowy</div>
          </div>
        </header>

        <main style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>

          {/* Plan details */}
          <div style={card()}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: 700 }}>
              Podstawowe informacje
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl()}>Nazwa planu *</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="np. Plan siłowy — wrzesień 2026"
                autoFocus
                style={inp()}
              />
            </div>

            <div>
              <label style={lbl()}>Notatki dla zawodniczek <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.7rem' }}>— widoczne pod przyciskiem ℹ️ w widoku treningu</span></label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Skróty, wskazówki, informacje dla zawodniczek..."
                rows={5}
                style={{ ...inp({ minHeight: 110, padding: '0.75rem 0.875rem', resize: 'vertical' }), display: 'block' }}
              />
            </div>
          </div>

          {/* Struktura */}
          <div style={card()}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: 700 }}>
              Struktura planu
            </div>

            {/* Liczba tygodni */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={lbl()}>Liczba tygodni</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[2, 3, 4, 6, 8, 10, 12].map(n => (
                  <button key={n} onClick={() => setWeeksCount(n)} style={{
                    width: 48, height: 44, borderRadius: 9,
                    border: `1.5px solid ${weeksCount === n ? C.gold : C.grayLight}`,
                    background: weeksCount === n ? C.navy : C.offWhite,
                    color: weeksCount === n ? C.gold : C.navy,
                    fontFamily: mono, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Dni na tydzień */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={lbl()}>Treningi na tydzień</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => setDayCount(n)} style={{
                    width: 48, height: 44, borderRadius: 9,
                    border: `1.5px solid ${daysPerWeek === n ? C.gold : C.grayLight}`,
                    background: daysPerWeek === n ? C.navy : C.offWhite,
                    color: daysPerWeek === n ? C.gold : C.navy,
                    fontFamily: mono, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Szablony nazw */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl()}>Schemat nazw treningów</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {DAY_PRESETS.filter(p => p.days.length === 0 || p.days.length === daysPerWeek || p.days.length === 0).map(preset => (
                  <button key={preset.label} onClick={() => applyPreset(preset)} style={{
                    borderRadius: 8, border: `1.5px solid ${C.grayLight}`,
                    background: C.offWhite, color: C.navy,
                    padding: '0.4rem 0.75rem', fontFamily: mono, fontSize: '0.65rem',
                    fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {preset.label}
                  </button>
                ))}
              </div>
              {/* Edycja nazw dni */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {dayNames.slice(0, daysPerWeek).map((dn, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, marginBottom: 3 }}>Dzień {i + 1}</div>
                    <input
                      value={dn}
                      onChange={e => {
                        setCustomDays(true)
                        setDayNames(prev => prev.map((d, j) => j === i ? e.target.value : d))
                      }}
                      style={{ ...inp({ minHeight: 36, fontSize: '0.82rem', padding: '0 0.6rem' }) }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Podsumowanie */}
            <div style={{ background: C.offWhite, borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', gap: 24 }}>
              {[
                { val: weeksCount, lbl: 'tygodni' },
                { val: daysPerWeek, lbl: 'treningów/tydz.' },
                { val: totalDays, lbl: 'treningów łącznie' },
              ].map(({ val, lbl: l }) => (
                <div key={l}>
                  <div style={{ fontFamily: mono, fontWeight: 800, fontSize: '1.2rem', color: C.navy }}>{val}</div>
                  <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', color: C.red, fontWeight: 700, fontSize: '0.88rem' }}>
              ❌ {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            style={{
              width: '100%', padding: '1rem',
              background: saving || !name.trim() ? C.grayLight : C.navy,
              color: saving || !name.trim() ? C.gray : C.gold,
              border: 'none', borderRadius: 12, fontWeight: 900, fontSize: '1rem',
              cursor: saving || !name.trim() ? 'default' : 'pointer',
              fontFamily: sans, letterSpacing: '0.02em',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Tworzę plan...' : `Utwórz plan i przejdź do edytora →`}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.75rem', fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>
            Możesz edytować wszystko po utworzeniu — dodawać tygodnie, dni i bloki
          </div>
        </main>
      </div>
    </>
  )
}
