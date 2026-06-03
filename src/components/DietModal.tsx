'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
  orange: '#F97316',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

const MEAL_TYPES = [
  { label: 'Śniadanie', emoji: '🌅', color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'II śniadanie', emoji: '🥪', color: '#84CC16', bg: '#F7FEE7' },
  { label: 'Obiad', emoji: '🍽️', color: '#22C55E', bg: '#F0FDF4' },
  { label: 'Podwieczorek', emoji: '🍎', color: '#F97316', bg: '#FFF7ED' },
  { label: 'Kolacja', emoji: '🌙', color: '#6366F1', bg: '#EEF2FF' },
  { label: 'Przekąska', emoji: '🍫', color: '#EC4899', bg: '#FDF2F8' },
  { label: 'Przed treningiem', emoji: '⚡', color: '#EAB308', bg: '#FEFCE8' },
  { label: 'Po treningu', emoji: '💪', color: '#14B8A6', bg: '#F0FDFA' },
]

const HUNGER_OPTIONS = [
  { v: 0, emoji: '😑', label: 'Wcale' },
  { v: 1, emoji: '😐', label: 'Trochę' },
  { v: 2, emoji: '😋', label: 'Normalnie' },
  { v: 3, emoji: '😤', label: 'Bardzo' },
  { v: 4, emoji: '🤤', label: 'Ciągle' },
]

const ENERGY_AFTER = [
  { v: 0, emoji: '😴', label: 'Senność' },
  { v: 1, emoji: '😕', label: 'Słabo' },
  { v: 2, emoji: '😐', label: 'OK' },
  { v: 3, emoji: '😊', label: 'Dobrze' },
  { v: 4, emoji: '⚡', label: 'Energia!' },
]

interface MealData {
  id: number
  mealType: string
  time: string
  description: string
  prepMethod: string
  weight: string
  calories: string
  energyAfter: number | null
  stomach: boolean
  stomachNote: string
}

interface DrinkData {
  id: number
  name: string
  amount: string
}

interface Props {
  athleteId: number
  onClose: () => void
  onSaved: () => void
}

function MealCard({
  index, meal, onRemove, canRemove, showDetails, onChange,
}: {
  index: number
  meal: MealData
  onRemove: () => void
  canRemove: boolean
  showDetails: boolean
  onChange: (updated: Partial<MealData>) => void
}) {
  const selected = MEAL_TYPES.find(m => m.label === meal.mealType)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem',
      border: `1.5px solid ${selected ? selected.color + '44' : C.grayLight}`,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {selected && <span style={{ fontSize: '1.1rem' }}>{selected.emoji}</span>}
          <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {selected ? selected.label : `Posiłek ${index + 1}`}
          </span>
        </div>
        {canRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: '1rem', padding: '2px 6px' }}>×</button>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 6 }}>Rodzaj</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {MEAL_TYPES.map(opt => (
            <button key={opt.label} onClick={() => onChange({ mealType: opt.label })}
              style={{ padding: '4px 10px', background: meal.mealType === opt.label ? opt.color : opt.bg, color: meal.mealType === opt.label ? '#fff' : opt.color, border: `1.5px solid ${opt.color}33`, borderRadius: 20, fontFamily: sans, fontSize: '0.72rem', cursor: 'pointer', fontWeight: meal.mealType === opt.label ? 700 : 500, transition: 'all 0.15s' }}>
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 4 }}>Godzina</div>
        <input type="time" value={meal.time} onChange={e => onChange({ time: e.target.value })}
          style={{ width: 110, padding: '0.5rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, background: '#fff', outline: 'none' }} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 4 }}>Co jadłaś?</div>
        <textarea value={meal.description} onChange={e => onChange({ description: e.target.value })}
          placeholder="np. ziemniaki, kurczak, surówka z marchewki..." rows={2}
          style={{ width: '100%', padding: '0.625rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', background: C.offWhite, boxSizing: 'border-box' }} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 4 }}>Sposób przyrządzenia</div>
        <input type="text" value={meal.prepMethod} onChange={e => onChange({ prepMethod: e.target.value })}
          placeholder="np. gotowane, pieczone, kupione gotowe..."
          style={{ width: '100%', padding: '0.625rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, outline: 'none', background: C.offWhite, boxSizing: 'border-box' }} />
      </div>

      {showDetails && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 4 }}>Gramatura (g)</div>
            <input type="number" value={meal.weight} onChange={e => onChange({ weight: e.target.value })} placeholder="np. 350"
              style={{ width: '100%', padding: '0.5rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: mono, fontSize: '0.9rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 4 }}>Kalorie (kcal)</div>
            <input type="number" value={meal.calories} onChange={e => onChange({ calories: e.target.value })} placeholder="np. 450"
              style={{ width: '100%', padding: '0.5rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: mono, fontSize: '0.9rem', color: C.navy, background: '#fff', outline: 'none', textAlign: 'center' }} />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 6 }}>Energia / samopoczucie po posiłku</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {ENERGY_AFTER.map(opt => (
            <button key={opt.v} onClick={() => onChange({ energyAfter: opt.v })}
              style={{ flex: 1, padding: '0.5rem 0.25rem', background: meal.energyAfter === opt.v ? C.navyLight : '#fff', border: `1.5px solid ${meal.energyAfter === opt.v ? C.gold : C.grayLight}`, borderRadius: 10, cursor: 'pointer', fontFamily: sans, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'all 0.15s' }}>
              <span style={{ fontSize: '1.1rem' }}>{opt.emoji}</span>
              <span style={{ fontSize: '0.55rem', color: meal.energyAfter === opt.v ? C.gold : C.gray, fontWeight: meal.energyAfter === opt.v ? 700 : 400 }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <button onClick={() => onChange({ stomach: !meal.stomach })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: meal.stomach ? '#FEF2F2' : C.offWhite, border: `1.5px solid ${meal.stomach ? '#FCA5A5' : C.grayLight}`, borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', fontFamily: sans, width: '100%', transition: 'all 0.15s' }}>
          <span style={{ fontSize: '1rem' }}>🫃</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: meal.stomach ? C.red : C.gray }}>Dolegliwości żołądkowe po posiłku</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: C.gray }}>{meal.stomach ? '▲' : '▼'}</span>
        </button>
        {meal.stomach && (
          <textarea value={meal.stomachNote} onChange={e => onChange({ stomachNote: e.target.value })}
            placeholder="Opisz co się działo..." rows={2}
            style={{ marginTop: 6, width: '100%', padding: '0.625rem', border: '1.5px solid #FCA5A5', borderRadius: 8, fontFamily: sans, fontSize: '0.85rem', color: C.navy, resize: 'none', outline: 'none', background: '#FEF2F2', boxSizing: 'border-box' }} />
        )}
      </div>
    </div>
  )
}

export default function DietModal({ athleteId, onClose, onSaved }: Props) {
  const [page, setPage] = useState(0)
  const [meals, setMeals] = useState<MealData[]>([{ id: 1, mealType: '', time: '', description: '', prepMethod: '', weight: '', calories: '', energyAfter: null, stomach: false, stomachNote: '' }])
  const [showMealDetails, setShowMealDetails] = useState(false)

  const [mealCount, setMealCount] = useState(0)
  const [hunger, setHunger] = useState<number | null>(null)
  const [hadBreakfast, setHadBreakfast] = useState<boolean | null>(null)

  const [waterMl, setWaterMl] = useState('')
  const [coffeeCount, setCoffeeCount] = useState(0)
  const [coffeeEmpty, setCoffeeEmpty] = useState<boolean | null>(null)
  const [coffeeTimes, setCoffeeTimes] = useState<string[]>([])
  const [otherDrinks, setOtherDrinks] = useState<DrinkData[]>([])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [existingId, setExistingId] = useState<string | null>(null)

  const todayLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayIso = new Date().toISOString().split('T')[0]
  const pages = ['Podstawy', 'Posiłki', 'Napoje']

  useEffect(() => {
    const supabase = createClient()
    supabase.from('diet_logs').select('*').eq('athlete_id', athleteId).eq('date', todayIso).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setLoading(false); return }
        if (data) {
          setExistingId(data.id)
          setMealCount(data.meal_count ?? 0)
          setHadBreakfast(data.had_breakfast ?? null)
          setHunger(data.hunger_level ?? null)
          if (Array.isArray(data.meals) && data.meals.length > 0) {
            setMeals(data.meals.map((m: MealData & { id?: number }, i: number) => ({
              id: Date.now() + i,
              mealType: m.mealType ?? '',
              time: m.time ?? '',
              description: m.description ?? '',
              prepMethod: m.prepMethod ?? '',
              weight: m.weight?.toString() ?? '',
              calories: m.calories?.toString() ?? '',
              energyAfter: m.energyAfter ?? null,
              stomach: m.stomach ?? false,
              stomachNote: m.stomachNote ?? '',
            })))
          }
          setWaterMl(data.water_ml?.toString() ?? '')
          setCoffeeCount(data.coffee_count ?? 0)
          setCoffeeEmpty(data.coffee_empty ?? null)
          setCoffeeTimes(Array.isArray(data.coffee_times) ? data.coffee_times : [])
          setOtherDrinks(
            Array.isArray(data.other_drinks)
              ? data.other_drinks.map((d: { name: string; amount: string }, i: number) => ({ id: Date.now() + i, name: d.name, amount: d.amount }))
              : []
          )
          setSaved(true)
        }
        setLoading(false)
      })
  }, [])

  function updateMeal(id: number, updated: Partial<MealData>) {
    setMeals(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const supabase = createClient()

      const payload = {
        athlete_id: athleteId,
        date: todayIso,
        meal_count: mealCount,
        had_breakfast: hadBreakfast,
        hunger_level: hunger,
        meals: meals.map(m => ({
          mealType: m.mealType,
          time: m.time,
          description: m.description,
          prepMethod: m.prepMethod,
          weight: m.weight ? Number(m.weight) : null,
          calories: m.calories ? Number(m.calories) : null,
          energyAfter: m.energyAfter,
          stomach: m.stomach,
          stomachNote: m.stomachNote,
        })),
        water_ml: waterMl ? Number(waterMl) : null,
        coffee_count: coffeeCount,
        coffee_empty: coffeeEmpty,
        coffee_times: coffeeTimes,
        other_drinks: otherDrinks.map(d => ({ name: d.name, amount: d.amount })),
      }

      const { error } = await supabase
        .from('diet_logs')
        .upsert(payload, { onConflict: 'athlete_id,date' })

      if (error) throw error

      setSaved(true)
      setTimeout(() => {
        onSaved()
        onClose()
      }, 1200)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(msg)
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: sans }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 480, background: C.offWhite, borderRadius: '20px 20px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderTop: `4px solid ${C.gold}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.25rem 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 1rem' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: C.navy }}>Dieta 🥗</h2>
              <p style={{ fontSize: '0.75rem', color: C.gray, marginTop: 2 }}>{todayLabel}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: '1.3rem', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 1, marginBottom: '0.875rem' }}>
            {pages.map((p, i) => (
              <button key={i} onClick={() => setPage(i)}
                style={{ flex: 1, padding: '0.5rem 0.25rem', background: page === i ? C.navy : 'transparent', color: page === i ? C.gold : C.gray, border: 'none', borderRadius: page === i ? 8 : 0, cursor: 'pointer', fontFamily: sans, fontWeight: page === i ? 700 : 500, fontSize: '0.75rem', borderBottom: page !== i ? `2px solid ${C.grayLight}` : 'none' }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.25rem 1rem' }}>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: C.gray, fontWeight: 700 }}>Ładowanie...</div>
          )}

          {saveError && (
            <div style={{ margin: '0.75rem 0', padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, fontSize: '0.8rem', color: C.red, fontWeight: 700 }}>
              ❌ Błąd zapisu: {saveError}
            </div>
          )}

          {!loading && <>

          {/* PODSTAWY */}
          {page === 0 && (
            <div>
              <div style={{ marginBottom: '1rem', background: '#fff', borderRadius: 12, padding: '0.875rem', border: `1.5px solid ${C.grayLight}` }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.navy, marginBottom: '0.75rem' }}>Ile posiłków zjadłaś dziś?</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  <button onClick={() => setMealCount(c => Math.max(0, c - 1))}
                    style={{ width: 40, height: 40, borderRadius: 10, background: C.grayLight, border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700, color: C.navy }}>−</button>
                  <span style={{ fontFamily: mono, fontSize: '2rem', fontWeight: 800, color: C.navy, minWidth: 48, textAlign: 'center' }}>{mealCount}</span>
                  <button onClick={() => setMealCount(c => Math.min(10, c + 1))}
                    style={{ width: 40, height: 40, borderRadius: 10, background: C.navy, border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700, color: C.gold }}>+</button>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.navy, marginBottom: 8 }}>Czy zjadłaś śniadanie?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { v: true, label: '✅ Tak', color: C.green, bg: '#F0FDF4' },
                    { v: false, label: '❌ Nie', color: C.red, bg: '#FEF2F2' },
                  ].map(opt => (
                    <button key={String(opt.v)} onClick={() => setHadBreakfast(opt.v)}
                      style={{ flex: 1, padding: '0.625rem', background: hadBreakfast === opt.v ? opt.color : opt.bg, color: hadBreakfast === opt.v ? '#fff' : opt.color, border: `1.5px solid ${opt.color}44`, borderRadius: 10, fontFamily: sans, fontWeight: hadBreakfast === opt.v ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.navy, marginBottom: 8 }}>Poziom głodu przez cały dzień</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {HUNGER_OPTIONS.map(opt => (
                    <button key={opt.v} onClick={() => setHunger(opt.v)}
                      style={{ flex: 1, padding: '0.625rem 0.25rem', background: hunger === opt.v ? C.navyLight : '#fff', border: `1.5px solid ${hunger === opt.v ? C.gold : C.grayLight}`, borderRadius: 10, cursor: 'pointer', fontFamily: sans, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}>
                      <span style={{ fontSize: '1.2rem' }}>{opt.emoji}</span>
                      <span style={{ fontSize: '0.55rem', color: hunger === opt.v ? C.gold : C.gray, fontWeight: hunger === opt.v ? 700 : 400, textAlign: 'center' }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* POSIŁKI */}
          {page === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <span style={{ fontSize: '0.72rem', color: C.gray, lineHeight: 1.5 }}>Dodaj posiłki i przekąski z dzisiejszego dnia.</span>
                <button onClick={() => setShowMealDetails(!showMealDetails)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: showMealDetails ? C.navy : C.grayLight, border: 'none', borderRadius: 20, cursor: 'pointer', fontFamily: sans, fontSize: '0.68rem', fontWeight: 700, color: showMealDetails ? C.gold : C.gray, flexShrink: 0, transition: 'all 0.2s' }}>
                  ✏️ {showMealDetails ? 'Gramatura włączona' : '+ Gramatura / kcal'}
                </button>
              </div>
              {showMealDetails && (
                <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '0.625rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.72rem', color: '#92400E', lineHeight: 1.5 }}>
                  Pola gramatura i kcal są teraz widoczne przy każdym posiłku.
                </div>
              )}
              {meals.map((meal, idx) => (
                <MealCard
                  key={meal.id} index={idx} meal={meal}
                  canRemove={meals.length > 1} showDetails={showMealDetails}
                  onRemove={() => setMeals(prev => prev.filter(m => m.id !== meal.id))}
                  onChange={updated => updateMeal(meal.id, updated)}
                />
              ))}
              <button onClick={() => setMeals(prev => [...prev, { id: Date.now(), mealType: '', time: '', description: '', prepMethod: '', weight: '', calories: '', energyAfter: null, stomach: false, stomachNote: '' }])}
                style={{ width: '100%', padding: '0.75rem', background: '#fff', border: `1.5px dashed ${C.grayLight}`, borderRadius: 12, fontFamily: sans, fontWeight: 600, fontSize: '0.85rem', color: C.gray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span>＋</span> Dodaj posiłek / przekąskę
              </button>
            </div>
          )}

          {/* NAPOJE */}
          {page === 2 && (
            <div>
              {/* WODA */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem', border: '1.5px solid #BAE6FD' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>💧</span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>Woda</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 4 }}>Ilość wypitej wody (ml)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" value={waterMl} onChange={e => setWaterMl(e.target.value)} placeholder="0"
                      style={{ width: 110, padding: '0.625rem', border: '1.5px solid #BAE6FD', borderRadius: 8, fontFamily: mono, fontSize: '1.1rem', fontWeight: 700, color: C.navy, background: '#F0F9FF', outline: 'none', textAlign: 'center' }} />
                    <span style={{ fontFamily: mono, fontSize: '0.85rem', color: C.gray }}>ml</span>
                    <span style={{ fontSize: '0.72rem', color: '#0369A1', marginLeft: 4 }}>
                      {Number(waterMl) >= 2000 ? '✅ Świetnie!' : Number(waterMl) >= 1500 ? '👍 Dobrze' : Number(waterMl) >= 1000 ? '⚡ Wystarczy' : Number(waterMl) > 0 ? '❌ Za mało' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                    {[500, 750, 1000, 1500, 2000, 2500, 3000].map(ml => (
                      <button key={ml} onClick={() => setWaterMl(String(ml))}
                        style={{ padding: '3px 10px', background: waterMl === String(ml) ? '#0369A1' : '#EFF6FF', color: waterMl === String(ml) ? '#fff' : '#0369A1', border: '1.5px solid #BAE6FD', borderRadius: 20, fontFamily: mono, fontSize: '0.68rem', cursor: 'pointer', fontWeight: waterMl === String(ml) ? 700 : 400 }}>
                        {ml < 1000 ? `${ml}ml` : `${ml / 1000}L`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* KAWA */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem', border: '1.5px solid #D6B896' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>☕</span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>Kawa</span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 8 }}>Ile kaw dziś?</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setCoffeeCount(c => Math.max(0, c - 1))}
                      style={{ width: 36, height: 36, borderRadius: 8, background: C.grayLight, border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: C.navy }}>−</button>
                    <span style={{ fontFamily: mono, fontSize: '1.8rem', fontWeight: 800, color: C.navy, minWidth: 40, textAlign: 'center' }}>{coffeeCount}</span>
                    <button onClick={() => setCoffeeCount(c => c + 1)}
                      style={{ width: 36, height: 36, borderRadius: 8, background: C.navy, border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: C.gold }}>+</button>
                  </div>
                </div>

                {coffeeCount > 0 && (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 6 }}>Pierwsza kawa była na czczo?</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[{ v: true, label: '☕ Tak, na czczo', color: C.orange, bg: '#FFF7ED' }, { v: false, label: '🍳 Nie, po posiłku', color: C.green, bg: '#F0FDF4' }].map(opt => (
                          <button key={String(opt.v)} onClick={() => setCoffeeEmpty(opt.v)}
                            style={{ flex: 1, padding: '0.5rem 6px', background: coffeeEmpty === opt.v ? opt.color : opt.bg, color: coffeeEmpty === opt.v ? '#fff' : opt.color, border: `1.5px solid ${opt.color}44`, borderRadius: 10, fontFamily: sans, fontSize: '0.75rem', cursor: 'pointer', fontWeight: coffeeEmpty === opt.v ? 700 : 500, textAlign: 'center', transition: 'all 0.15s' }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 6 }}>Godziny picia kawy</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Array.from({ length: Math.min(coffeeCount, 5) }, (_, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray, minWidth: 56 }}>Kawa {i + 1}</span>
                            <input type="time" value={coffeeTimes[i] || ''} onChange={e => {
                              const updated = [...coffeeTimes]
                              updated[i] = e.target.value
                              setCoffeeTimes(updated)
                            }}
                              style={{ width: 110, padding: '0.4rem 0.5rem', border: '1.5px solid #D6B896', borderRadius: 8, fontFamily: sans, fontSize: '0.82rem', color: C.navy, background: '#FDFAF7', outline: 'none' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* INNE NAPOJE */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem', border: `1.5px solid ${C.grayLight}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🥤</span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>Inne napoje</span>
                  <span style={{ fontSize: '0.68rem', color: C.gray }}>herbata, soki, energetyki, napoje słodzone...</span>
                </div>
                {otherDrinks.map((drink, idx) => (
                  <div key={drink.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input type="text" value={drink.name} placeholder="np. herbata zielona"
                      onChange={e => setOtherDrinks(prev => prev.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))}
                      style={{ flex: 2, padding: '0.5rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: '0.82rem', color: C.navy, outline: 'none' }} />
                    <input type="text" value={drink.amount} placeholder="ml / szt."
                      onChange={e => setOtherDrinks(prev => prev.map((d, i) => i === idx ? { ...d, amount: e.target.value } : d))}
                      style={{ flex: 1, padding: '0.5rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 8, fontFamily: mono, fontSize: '0.82rem', color: C.navy, outline: 'none', textAlign: 'center' }} />
                    <button onClick={() => setOtherDrinks(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: '1rem', padding: '4px', flexShrink: 0 }}>×</button>
                  </div>
                ))}
                <button onClick={() => setOtherDrinks(prev => [...prev, { id: Date.now(), name: '', amount: '' }])}
                  style={{ width: '100%', padding: '0.625rem', background: '#fff', border: `1.5px dashed ${C.grayLight}`, borderRadius: 10, fontFamily: sans, fontSize: '0.78rem', color: C.gray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  ＋ Dodaj napój
                </button>
              </div>
            </div>
          )}
          </>}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, flexShrink: 0, display: 'flex', gap: 8 }}>
          {page > 0 && (
            <button onClick={() => setPage(p => p - 1)}
              style={{ flex: 0, padding: '0.875rem 1.25rem', background: C.grayLight, color: C.navy, border: 'none', borderRadius: 12, fontFamily: sans, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              ← Wstecz
            </button>
          )}
          {page < pages.length - 1 ? (
            <button onClick={() => setPage(p => p + 1)}
              style={{ flex: 1, padding: '0.875rem', background: C.navy, color: C.gold, border: 'none', borderRadius: 12, fontFamily: sans, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
              Dalej →
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: '0.875rem', background: saved ? C.green : C.navy, color: saved ? '#fff' : C.gold, border: 'none', borderRadius: 12, fontFamily: sans, fontWeight: 800, fontSize: '0.9rem', cursor: saving ? 'default' : 'pointer', opacity: saving && !saved ? 0.7 : 1 }}>
              {saved ? '✓ Zapisano!' : saving ? 'Zapisywanie...' : 'Zapisz dietę 🥗'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
