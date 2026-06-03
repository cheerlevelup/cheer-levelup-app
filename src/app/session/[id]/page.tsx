'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type SetLog = {
  set_number: number
  is_warmup: boolean
  weight_kg: number | null
  completed: boolean
  previous_weight: number | null
}

type Exercise = {
  id: number
  exercise_code: string
  exercise_order: number
  accessories: string | null
  default_tempo: string | null
  coach_comment: string | null
  name: string
  sets: SetLog[]
}

type Block = {
  id: number
  block_name: string
  block_order: number
  rounds: number
  exercises: Exercise[]
}

type Template = {
  id: number
  name: string
  blocks: Block[]
}

type WeightModal = {
  exerciseIdx: number
  setNumber: number
  isWarmup: boolean
} | null

type PainModal = {
  exerciseIdx: number
  step: 1 | 2 | 3 | 4
  hasPain: boolean | null
  location: string | null
  vas: number
  description: string
} | null

type WellnessData = {
  sleep_hours: number
  sleep_quality: number
  energy: number
  muscle_soreness: number
  life_stress: number
  motivation: number
  mood: number
  energy_source: string
  concerns: string
}

const PAIN_LOCATIONS = [
  'Szyja', 'Bark lewy', 'Bark prawy', 'Łokieć lewy', 'Łokieć prawy',
  'Nadgarstek lewy', 'Nadgarstek prawy', 'Kręgosłup piersiowy',
  'Kręgosłup lędźwiowy', 'Biodro lewe', 'Biodro prawe',
  'Kolano lewe', 'Kolano prawe', 'Kostka lewa', 'Kostka prawa',
]

const WELLNESS_METRICS = [
  { key: 'sleep_quality', label: 'Jakość snu', emoji: ['😴','😟','😐','🙂','😊'], low: 'fatalna', high: 'świetna' },
  { key: 'energy', label: 'Energia / Zmęczenie', emoji: ['😩','😟','😐','🙂','🤩'], low: 'wypompowana', high: 'pełna mocy' },
  { key: 'muscle_soreness', label: 'Bolesność mięśni', emoji: ['✅','🙂','😐','😟','😣'], low: 'brak', high: 'bardzo silna' },
  { key: 'life_stress', label: 'Stres życiowy', emoji: ['😌','🙂','😐','😟','😰'], low: 'spokój', high: 'bardzo wysoki' },
  { key: 'motivation', label: 'Motywacja do treningu', emoji: ['😴','😐','🤔','😁','🔥'], low: 'żadna', high: 'bardzo wysoka' },
  { key: 'mood', label: 'Nastrój ogólny', emoji: ['😢','😟','😐','🙂','😄'], low: 'fatalny', high: 'świetny' },
]

export default function SessionPage() {
  const [template, setTemplate] = useState<Template | null>(null)
  const [activeBlock, setActiveBlock] = useState(0)
  const [loading, setLoading] = useState(true)
  const [weightModal, setWeightModal] = useState<WeightModal>(null)
  const [weightInput, setWeightInput] = useState('')
  const [painModal, setPainModal] = useState<PainModal>(null)
  const [showWellness, setShowWellness] = useState(false)
  const [wellnessDone, setWellnessDone] = useState(false)
  const [wellnessStep, setWellnessStep] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState({ rpe: 5, feeling: 3, what_went_well: '', general_notes: '' })
  const [wellness, setWellness] = useState<WellnessData>({
    sleep_hours: 7,
    sleep_quality: 3,
    energy: 3,
    muscle_soreness: 1,
    life_stress: 2,
    motivation: 4,
    mood: 3,
    energy_source: '',
    concerns: '',
  })

  useEffect(() => {
    async function fetchData() {
      const { data: templateData } = await supabase
        .from('workout_templates')
        .select('id, name')
        .order('id')
        .limit(1)
        .single()

      if (!templateData) { setLoading(false); return }

      const { data: blocksData } = await supabase
        .from('workout_blocks')
        .select('id, block_name, block_order, rounds')
        .eq('template_id', templateData.id)
        .order('block_order')

      if (!blocksData) { setLoading(false); return }

      const blocksWithExercises = await Promise.all(
        blocksData.map(async (block) => {
          const { data: templateExercises } = await supabase
            .from('workout_template_exercises')
            .select('id, exercise_code, exercise_order, accessories, default_tempo, coach_comment')
            .eq('block_id', block.id)
            .order('exercise_order')

          const exercises: Exercise[] = await Promise.all((templateExercises || []).map(async (te) => {
            const name = te.exercise_code
              .split('-')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')

            // Pobierz poprzednie ciężary dla tego ćwiczenia
            const { data: prevLogs } = await supabase
              .from('set_logs')
              .select('set_number, is_warmup, weight')
              .eq('exercise_log_id', te.id)
              .eq('completed', true)
              .order('created_at', { ascending: false })
              .limit(10)

            const getPrevWeight = (setNum: number, isWarmup: boolean) => {
              const match = (prevLogs || []).find(
                (l: any) => l.set_number === setNum && l.is_warmup === isWarmup
              )
              return match?.weight ?? null
            }

            const sets: SetLog[] = [
              { set_number: 0, is_warmup: true, weight_kg: null, completed: false, previous_weight: getPrevWeight(0, true) },
              ...Array.from({ length: block.rounds }, (_, i) => ({
                set_number: i + 1,
                is_warmup: false,
                weight_kg: null,
                completed: false,
                previous_weight: getPrevWeight(i + 1, false),
              })),
            ]

            return { id: te.id, exercise_code: te.exercise_code, exercise_order: te.exercise_order, accessories: te.accessories, default_tempo: te.default_tempo, coach_comment: te.coach_comment, name, sets }
          }))

          return { ...block, exercises }
        })
      )

      setTemplate({ ...templateData, blocks: blocksWithExercises })
      setLoading(false)
      // Pokaż wellness automatycznie po załadowaniu
      setShowWellness(true)
    }

    fetchData()
  }, [])

  // WEIGHT MODAL
  function openWeightModal(exerciseIdx: number, setNumber: number, isWarmup: boolean) {
    setWeightModal({ exerciseIdx, setNumber, isWarmup })
    setWeightInput('')
  }

  function closeWeightModal() {
    setWeightModal(null)
    setWeightInput('')
  }

  async function confirmSet() {
    if (!weightModal || !template) return
    const weight = weightInput ? parseFloat(weightInput) : null
    const block = template.blocks[activeBlock]
    const exercise = block.exercises[weightModal.exerciseIdx]

    const updatedBlocks = template.blocks.map((b, bi) => {
      if (bi !== activeBlock) return b
      return {
        ...b,
        exercises: b.exercises.map((ex, ei) => {
          if (ei !== weightModal.exerciseIdx) return ex
          return {
            ...ex,
            sets: ex.sets.map((s) => {
              if (s.set_number === weightModal.setNumber && s.is_warmup === weightModal.isWarmup) {
                return { ...s, weight_kg: weight, completed: true }
              }
              return s
            }),
          }
        }),
      }
    })

    setTemplate({ ...template, blocks: updatedBlocks })
    await supabase.from('set_logs').insert({
      exercise_log_id: exercise.id,
      set_number: weightModal.setNumber,
      is_warmup: weightModal.isWarmup,
      weight: weight,
      reps_completed: null,
      completed: true,
    })
    closeWeightModal()
  }

  // PAIN MODAL
  function openPainModal(exerciseIdx: number) {
    setPainModal({ exerciseIdx, step: 1, hasPain: null, location: null, vas: 5, description: '' })
  }

  function closePainModal() { setPainModal(null) }

  async function submitPain() {
    if (!painModal || !template) return
    const block = template.blocks[activeBlock]
    const exercise = block.exercises[painModal.exerciseIdx]

    if (painModal.hasPain && painModal.location) {
      await supabase.from('pain_logs').insert({
        exercise_log_id: exercise.id,
        location: painModal.location,
        vas_score: painModal.vas,
        description: painModal.description || null,
      })
    }
    closePainModal()
  }

  // WELLNESS
  async function submitWellness() {
    await supabase.from('wellness_logs').insert({
      sleep_hours: wellness.sleep_hours,
      sleep_quality: wellness.sleep_quality,
      energy: wellness.energy,
      muscle_sorness: wellness.muscle_soreness,
      stress: wellness.life_stress,
      motivationa: wellness.motivation,
      mood: wellness.mood,
      energy_source: wellness.energy_source || null,
      concerns: wellness.concerns || null,
    })
    setWellnessDone(true)
    setShowWellness(false)
  }

  async function submitFeedback() {
    await supabase.from('post_session_feedback').insert({
      session_rpe: feedback.rpe,
      feeling_after: feedback.feeling,
      what_went_well: feedback.what_went_well || null,
      general_notes: feedback.general_notes || null,
    })
    setShowFeedback(false)
  }

  function wellnessAvg() {
    const vals = [wellness.sleep_quality, wellness.energy, wellness.motivation, wellness.mood]
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }

  function wellnessLabel(avg: number) {
    if (avg >= 4) return 'Świetne samopoczucie'
    if (avg >= 3) return 'Dobre samopoczucie'
    if (avg >= 2) return 'Przeciętne samopoczucie'
    return 'Słabe samopoczucie'
  }

  function wellnessColor(avg: number) {
    if (avg >= 4) return '#4CAF50'
    if (avg >= 3) return '#F5C842'
    if (avg >= 2) return '#FF9800'
    return '#E74C3C'
  }

  const mono = "'Space Mono', monospace"
  const sans = "'Space Grotesk', sans-serif"

  if (loading) {
    return (
      <main style={{ fontFamily: sans, background: '#F0EEE9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <div style={{ fontSize: 13, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ładowanie treningu...</div>
      </main>
    )
  }

  if (!template) {
    return (
      <main style={{ fontFamily: sans, background: '#F0EEE9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <div style={{ fontSize: 13, color: '#aaa' }}>Nie znaleziono treningu.</div>
      </main>
    )
  }

  const currentBlock = template.blocks[activeBlock]
  const totalSets = currentBlock?.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => !s.is_warmup).length, 0) || 0
  const completedSets = currentBlock?.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => !s.is_warmup && s.completed).length, 0) || 0
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0
  const avg = parseFloat(wellnessAvg())

  return (
    <main style={{ fontFamily: sans, background: '#F0EEE9', minHeight: '100vh', color: '#111' }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" rel="stylesheet" />

      <div style={{ maxWidth: 390, margin: '0 auto', paddingBottom: 90 }}>

        <div style={{ padding: '28px 24px 20px' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#aaa', marginBottom: 6 }}>
            Cheer LevelUP · {template.name}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: '#111' }}>Alicja<br />Gruca</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Trener: Urszula Papka</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: '#111', background: '#E3E1DB', padding: '5px 12px', borderRadius: 4 }}>
              {new Date().toLocaleDateString('pl-PL')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setShowWellness(true)}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: wellnessDone ? wellnessColor(avg) : '#aaa' }} />
              {wellnessDone ? wellnessLabel(avg) : 'Wypełnij wellness'}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: '#D9D7D1', margin: '0 24px' }} />
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 2, background: '#D9D7D1', borderRadius: 2 }}>
            <div style={{ height: 2, background: '#111', width: `${progressPct}%`, borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: '#999' }}>{completedSets} / {totalSets}</div>
        </div>
        <div style={{ height: 1, background: '#D9D7D1', margin: '0 24px' }} />

        <div style={{ display: 'flex', padding: '20px 24px 0' }}>
          {template.blocks.map((block, i) => (
            <div key={block.id} onClick={() => setActiveBlock(i)} style={{
              flex: 1, textAlign: 'center', padding: '10px 0',
              borderBottom: i === activeBlock ? '2px solid #111' : '2px solid #D9D7D1',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: i === activeBlock ? '#111' : '#aaa', cursor: 'pointer'
            }}>
              {block.block_name.replace('Blok ', '')}
            </div>
          ))}
        </div>

        {currentBlock && (
          <div style={{ padding: '24px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', fontWeight: 600 }}>Runda</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: currentBlock.rounds }).map((_, i) => (
                  <div key={i} style={{ width: 20, height: 3, borderRadius: 2, background: i === 0 ? '#111' : '#D9D7D1' }} />
                ))}
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, color: '#aaa' }}>1 / {currentBlock.rounds}</span>
            </div>

            {currentBlock.exercises.map((ex, idx) => {
              const completedCount = ex.sets.filter(s => !s.is_warmup && s.completed).length
              const allDone = completedCount === currentBlock.rounds

              return (
                <div key={ex.id}>
                  <div style={{ marginBottom: 32, opacity: allDone ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.06em' }}>
                        {currentBlock.block_name.replace('Blok ', '')}{idx + 1}
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 700, color: '#111', lineHeight: 1.1, flex: 1 }}>{ex.name}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: allDone ? 'white' : '#111', background: allDone ? '#111' : '#E3E1DB', padding: '3px 8px', borderRadius: 3, transition: 'all 0.3s' }}>
                        {completedCount}/{currentBlock.rounds}
                      </span>
                    </div>

                    {ex.default_tempo && (
                      <div style={{ paddingLeft: 21, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: '#888' }}>tempo {ex.default_tempo}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, paddingLeft: 21, flexWrap: 'wrap', marginBottom: 10 }}>
                      {ex.sets.map((s) => (
                        <div key={`${s.is_warmup ? 'w' : 's'}-${s.set_number}`}
                          onClick={() => !s.completed && openWeightModal(idx, s.set_number, s.is_warmup)}
                          style={{
                            width: 52, height: 52,
                            border: s.completed ? 'none' : s.is_warmup ? '1px dashed #CCC' : '1px solid #D9D7D1',
                            background: s.completed ? '#111' : 'transparent',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', cursor: s.completed ? 'default' : 'pointer',
                            position: 'relative', gap: 2, transition: 'all 0.2s'
                          }}>
                          {s.is_warmup && !s.completed && (
                            <span style={{ fontSize: 8, fontWeight: 700, color: '#CCC', position: 'absolute', top: -7, left: 0, right: 0, textAlign: 'center', background: '#F0EEE9', padding: '0 2px' }}>ROZGR</span>
                          )}
                          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: s.completed ? 'white' : s.is_warmup ? '#BBB' : '#111' }}>
                            {s.completed ? '✓' : s.is_warmup ? 'R0' : `S${s.set_number}`}
                          </span>
                          <span style={{ fontSize: 9, color: s.completed ? 'rgba(255,255,255,0.6)' : '#aaa' }}>
                            {s.completed && s.weight_kg ? `${s.weight_kg}kg` : s.completed ? 'BW' : s.previous_weight ? `${s.previous_weight}kg` : '— kg'}
                          </span>
                          {!s.completed && s.previous_weight && (
                            <span style={{ fontSize: 7, color: '#bbb', marginTop: 1 }}>poprzednio</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {ex.coach_comment && (
                      <div style={{ fontSize: 12, color: '#888', borderLeft: '2px solid #F5C842', marginLeft: 21, paddingLeft: 10, lineHeight: 1.6, marginBottom: 10 }}>
                        {ex.coach_comment}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, paddingLeft: 21 }}>
                      <button onClick={() => openPainModal(idx)} style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#888', border: '1px solid #D9D7D1', background: 'transparent', padding: '6px 12px', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: sans }}>
                        <i className="ti ti-activity-heartbeat" aria-hidden="true" /> BÓL
                      </button>
                      <button style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#888', border: '1px solid #D9D7D1', background: 'transparent', padding: '6px 12px', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: sans }}>
                        <i className="ti ti-message-circle" aria-hidden="true" /> UWAGA
                      </button>
                      <button style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#888', border: '1px solid #D9D7D1', background: 'transparent', padding: '6px 12px', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: sans }}>
                        <i className="ti ti-player-play" aria-hidden="true" /> FILM
                      </button>
                    </div>
                  </div>

                  {idx < currentBlock.exercises.length - 1 && (
                    <div style={{ height: 1, background: '#E3E1DB', marginBottom: 32, marginLeft: 21 }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 390, margin: '0 auto', padding: '14px 24px 24px', background: '#F0EEE9', borderTop: '1px solid #D9D7D1', display: 'flex', gap: 8 }}>
        <button style={{ background: 'transparent', border: '1px solid #D9D7D1', padding: '15px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <i className="ti ti-file-description" aria-hidden="true" style={{ fontSize: 18, color: '#111' }} />
        </button>
        <button onClick={() => setShowFeedback(true)} style={{ flex: 1, background: '#111', color: 'white', border: 'none', padding: 15, fontFamily: sans, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase' }}>
          Zakończ {currentBlock?.block_name} →
        </button>
      </div>

      {/* WELLNESS MODAL */}
      {showWellness && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#F0EEE9', width: '100%', maxWidth: 390, borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '32px 24px 40px' }}>

              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>Przed treningiem</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#111', marginBottom: 4 }}>Jak się dziś czujesz?</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 28 }}>{new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>

              {/* SEN */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888', marginBottom: 12 }}>😴 Sen</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>Czas snu:</span>
                  <button onClick={() => setWellness(w => ({ ...w, sleep_hours: Math.max(0, w.sleep_hours - 0.5) }))}
                    style={{ width: 36, height: 36, border: '1px solid #D9D7D1', background: 'white', fontSize: 18, cursor: 'pointer', borderRadius: 6 }}>−</button>
                  <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, minWidth: 48, textAlign: 'center' }}>{wellness.sleep_hours}</span>
                  <button onClick={() => setWellness(w => ({ ...w, sleep_hours: Math.min(12, w.sleep_hours + 0.5) }))}
                    style={{ width: 36, height: 36, border: '1px solid #D9D7D1', background: 'white', fontSize: 18, cursor: 'pointer', borderRadius: 6 }}>+</button>
                  <span style={{ fontSize: 12, color: '#888' }}>godz.</span>
                </div>
              </div>

              {/* METRYKI */}
              {WELLNESS_METRICS.map((metric) => {
                const val = wellness[metric.key as keyof WellnessData] as number
                return (
                  <div key={metric.key} style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888' }}>{metric.label}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      {metric.emoji.map((e, i) => (
                        <div key={i} onClick={() => setWellness(w => ({ ...w, [metric.key]: i + 1 }))}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <span style={{ fontSize: 24, opacity: val === i + 1 ? 1 : 0.3, transition: 'opacity 0.15s' }}>{e}</span>
                          <span style={{ fontSize: 10, color: '#aaa', fontFamily: mono }}>{i + 1}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ position: 'relative', height: 4, background: '#D9D7D1', borderRadius: 2, marginBottom: 4 }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, background: '#111', width: `${(val - 1) / 4 * 100}%`, transition: 'width 0.2s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa' }}>
                      <span>{metric.low}</span>
                      <span style={{ fontFamily: mono, fontWeight: 700, color: '#111', fontSize: 13 }}>{val}</span>
                      <span>{metric.high}</span>
                    </div>
                  </div>
                )
              })}

              {/* POLA TEKSTOWE */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>✨ Co dziś dało Ci energię? (opcjonalnie)</div>
                <textarea value={wellness.energy_source} onChange={e => setWellness(w => ({ ...w, energy_source: e.target.value }))}
                  placeholder="np. dobry sen, smaczne śniadanie, słoneczna pogoda..."
                  style={{ width: '100%', height: 72, padding: 12, border: '1px solid #D9D7D1', borderRadius: 8, fontSize: 13, fontFamily: sans, background: 'white', outline: 'none', resize: 'none', color: '#111', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>⚠️ Co Cię ogranicza / niepokoi? (opcjonalnie)</div>
                <textarea value={wellness.concerns} onChange={e => setWellness(w => ({ ...w, concerns: e.target.value }))}
                  placeholder="np. ból kolana, krótki sen, stres w pracy..."
                  style={{ width: '100%', height: 72, padding: 12, border: '1px solid #D9D7D1', borderRadius: 8, fontSize: 13, fontFamily: sans, background: 'white', outline: 'none', resize: 'none', color: '#111', boxSizing: 'border-box' }} />
              </div>

              {/* PODSUMOWANIE */}
              <div style={{ background: 'white', border: '1px solid #D9D7D1', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>Podsumowanie</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, fontFamily: mono, color: wellnessColor(avg) }}>{avg}</span>
                  <span style={{ fontSize: 13, color: '#888' }}>/ 5 — {wellnessLabel(avg)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {wellnessDone && (
                  <button onClick={() => setShowWellness(false)} style={{ flex: 1, padding: 16, border: '1px solid #D9D7D1', background: 'white', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sans }}>Anuluj</button>
                )}
                <button onClick={submitWellness} style={{ flex: 2, padding: 16, border: 'none', background: '#111', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: sans }}>
                  ✓ Wstaw i zacznij trening
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEIGHT MODAL */}
      {weightModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={closeWeightModal}>
          <div style={{ background: '#F0EEE9', width: '100%', maxWidth: 390, padding: '32px 24px 40px', borderRadius: '20px 20px 0 0' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>
              {weightModal.isWarmup ? 'Seria rozgrzewkowa' : `Seria ${weightModal.setNumber}`}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 24 }}>
              {currentBlock?.exercises[weightModal.exerciseIdx]?.name}
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Ciężar (kg)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setWeightInput(w => String(Math.max(0, parseFloat(w || '0') - 2.5)))}
                  style={{ width: 44, height: 44, border: '1px solid #D9D7D1', background: 'white', fontSize: 20, cursor: 'pointer', borderRadius: 8 }}>−</button>
                <input type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)} placeholder="0"
                  style={{ flex: 1, height: 56, textAlign: 'center', fontSize: 28, fontWeight: 700, fontFamily: mono, border: '1px solid #D9D7D1', background: 'white', borderRadius: 8, outline: 'none', color: '#111' }} />
                <button onClick={() => setWeightInput(w => String(parseFloat(w || '0') + 2.5))}
                  style={{ width: 44, height: 44, border: '1px solid #D9D7D1', background: 'white', fontSize: 20, cursor: 'pointer', borderRadius: 8 }}>+</button>
              </div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 8, textAlign: 'center' }}>Zostaw puste jeśli ćwiczenie z masą ciała (BW)</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={closeWeightModal} style={{ flex: 1, padding: 16, border: '1px solid #D9D7D1', background: 'white', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sans }}>Anuluj</button>
              <button onClick={confirmSet} style={{ flex: 2, padding: 16, border: 'none', background: '#111', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: sans }}>✓ Seria wykonana</button>
            </div>
          </div>
        </div>
      )}

      {/* PAIN MODAL */}
      {painModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={closePainModal}>
          <div style={{ background: '#F0EEE9', width: '100%', maxWidth: 390, padding: '32px 24px 40px', borderRadius: '20px 20px 0 0', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
              {[1, 2, 3, 4].map(step => (
                <div key={step} style={{ flex: 1, height: 3, borderRadius: 2, background: painModal.step >= step ? '#111' : '#D9D7D1' }} />
              ))}
            </div>

            {painModal.step === 1 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>Raport bólu</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 8 }}>Czy coś boli?</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 32 }}>{currentBlock?.exercises[painModal.exerciseIdx]?.name}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  <button onClick={() => setPainModal({ ...painModal, hasPain: false, step: 4 })}
                    style={{ flex: 1, padding: '20px 0', border: '1px solid #D9D7D1', background: 'white', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: sans }}>Nie 👍</button>
                  <button onClick={() => setPainModal({ ...painModal, hasPain: true, step: 2 })}
                    style={{ flex: 1, padding: '20px 0', border: '2px solid #E74C3C', background: '#FEF0EF', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: sans, color: '#c0392b' }}>Tak 🤕</button>
                </div>
              </>
            )}

            {painModal.step === 2 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>Krok 1 z 3</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 24 }}>Gdzie boli?</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {PAIN_LOCATIONS.map(loc => (
                    <button key={loc} onClick={() => setPainModal({ ...painModal, location: loc })}
                      style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: sans, border: painModal.location === loc ? '2px solid #111' : '1px solid #D9D7D1', background: painModal.location === loc ? '#111' : 'white', color: painModal.location === loc ? 'white' : '#111', transition: 'all 0.15s' }}>
                      {loc}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPainModal({ ...painModal, step: 1 })} style={{ flex: 1, padding: 16, border: '1px solid #D9D7D1', background: 'white', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sans }}>Wstecz</button>
                  <button onClick={() => painModal.location && setPainModal({ ...painModal, step: 3 })}
                    style={{ flex: 2, padding: 16, border: 'none', background: painModal.location ? '#111' : '#D9D7D1', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: painModal.location ? 'pointer' : 'default', fontFamily: sans }}>Dalej →</button>
                </div>
              </>
            )}

            {painModal.step === 3 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>Krok 2 z 3</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 8 }}>Jak bardzo boli?</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 32 }}>{painModal.location}</div>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 56, fontWeight: 700, fontFamily: mono, color: painModal.vas <= 3 ? '#4CAF50' : painModal.vas <= 6 ? '#F5C842' : '#E74C3C' }}>{painModal.vas}</span>
                  <span style={{ fontSize: 16, color: '#aaa', fontFamily: mono }}>/10</span>
                </div>
                <input type="range" min={0} max={10} value={painModal.vas} onChange={e => setPainModal({ ...painModal, vas: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#111', marginBottom: 4 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginBottom: 24 }}>
                  <span>Brak bólu</span><span>Najgorszy ból</span>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Opis (opcjonalnie)</div>
                  <textarea value={painModal.description} onChange={e => setPainModal({ ...painModal, description: e.target.value })}
                    placeholder="np. ostry ból przy ruchu..."
                    style={{ width: '100%', height: 80, padding: 12, border: '1px solid #D9D7D1', borderRadius: 8, fontSize: 13, fontFamily: sans, background: 'white', outline: 'none', resize: 'none', color: '#111', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPainModal({ ...painModal, step: 2 })} style={{ flex: 1, padding: 16, border: '1px solid #D9D7D1', background: 'white', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sans }}>Wstecz</button>
                  <button onClick={() => setPainModal({ ...painModal, step: 4 })} style={{ flex: 2, padding: 16, border: 'none', background: '#111', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: sans }}>Dalej →</button>
                </div>
              </>
            )}

            {painModal.step === 4 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>{painModal.hasPain ? 'Krok 3 z 3' : 'Gotowe'}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 24 }}>{painModal.hasPain ? 'Podsumowanie' : 'Brak bólu — super!'}</div>
                {painModal.hasPain && (
                  <div style={{ background: 'white', border: '1px solid #D9D7D1', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#888' }}>Lokalizacja</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{painModal.location}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#888' }}>VAS</span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: painModal.vas <= 3 ? '#4CAF50' : painModal.vas <= 6 ? '#F5C842' : '#E74C3C' }}>{painModal.vas}/10</span>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  {painModal.hasPain && (
                    <button onClick={() => setPainModal({ ...painModal, step: 3 })} style={{ flex: 1, padding: 16, border: '1px solid #D9D7D1', background: 'white', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sans }}>Wstecz</button>
                  )}
                  <button onClick={submitPain} style={{ flex: 2, padding: 16, border: 'none', background: '#111', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: sans }}>
                    {painModal.hasPain ? '✓ Zapisz raport' : '✓ Zamknij'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* FEEDBACK MODAL */}
      {showFeedback && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#F0EEE9', width: '100%', maxWidth: 390, padding: '32px 24px 40px', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>Po treningu</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#111', marginBottom: 4 }}>Jak poszło?</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 28 }}>{currentBlock?.block_name}</div>

            {/* SAMOPOCZUCIE */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888', marginBottom: 14 }}>Samopoczucie po sesji</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { val: 1, emoji: '😴', label: 'Padam' },
                  { val: 2, emoji: '😐', label: 'OK' },
                  { val: 3, emoji: '🙂', label: 'Dobrze' },
                  { val: 4, emoji: '💪', label: 'Super' },
                  { val: 5, emoji: '🔥', label: 'Ogień!' },
                ].map(opt => (
                  <div key={opt.val} onClick={() => setFeedback(f => ({ ...f, feeling: opt.val }))}
                    style={{ flex: 1, padding: '12px 4px', border: feedback.feeling === opt.val ? '2px solid #111' : '1px solid #D9D7D1', borderRadius: 10, textAlign: 'center', cursor: 'pointer', background: feedback.feeling === opt.val ? '#111' : 'white', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: feedback.feeling === opt.val ? 'white' : '#888' }}>{opt.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RPE */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>Jak ciężki był trening? (RPE)</div>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 52, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: feedback.rpe <= 4 ? '#4CAF50' : feedback.rpe <= 7 ? '#F5C842' : '#E74C3C' }}>{feedback.rpe}</span>
                <span style={{ fontSize: 16, color: '#aaa', fontFamily: "'Space Mono', monospace" }}>/10</span>
              </div>
              <input type="range" min={0} max={10} value={feedback.rpe} onChange={e => setFeedback(f => ({ ...f, rpe: parseInt(e.target.value) }))} style={{ width: '100%', accentColor: '#111', marginBottom: 4 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa' }}>
                <span>0 - NIC</span><span>10 - MAKS</span>
              </div>
            </div>

            {/* CO POSZLO DOBRZE */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Co najbardziej Ci się podobało? (opcjonalnie)</div>
              <textarea value={feedback.what_went_well} onChange={e => setFeedback(f => ({ ...f, what_went_well: e.target.value }))}
                placeholder="Twoja odpowiedź..."
                style={{ width: '100%', height: 80, padding: 12, border: '1px solid #D9D7D1', borderRadius: 8, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", background: 'white', outline: 'none', resize: 'none', color: '#111', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Coś jeszcze? (opcjonalnie)</div>
              <textarea value={feedback.general_notes} onChange={e => setFeedback(f => ({ ...f, general_notes: e.target.value }))}
                placeholder="Uwagi ogólne..."
                style={{ width: '100%', height: 80, padding: 12, border: '1px solid #D9D7D1', borderRadius: 8, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", background: 'white', outline: 'none', resize: 'none', color: '#111', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowFeedback(false)} style={{ flex: 1, padding: 16, border: '1px solid #D9D7D1', background: 'white', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>Anuluj</button>
              <button onClick={submitFeedback} style={{ flex: 2, padding: 16, border: 'none', background: '#111', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
                📋 Wyślij raport trenerowi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}