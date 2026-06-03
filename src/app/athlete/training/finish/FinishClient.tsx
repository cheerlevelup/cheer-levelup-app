'use client'
// src/app/athlete/training/finish/FinishClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

const FEELING_OPTIONS = [
  { value: 'swietnie', label: '💪 Świetnie' },
  { value: 'dobrze', label: '😊 Dobrze' },
  { value: 'srednie', label: '😐 Średnio' },
  { value: 'zmeczona', label: '😓 Zmęczona' },
  { value: 'slabo', label: '😞 Słabo' },
]

export default function FinishClient({ athlete, session, setLogs, wellness, painLogs }: any) {
  const router = useRouter()
  const supabase = createClient()

  const [rpe, setRpe] = useState<number>(6)
  const [feeling, setFeeling] = useState<string>('')
  const [whatWentWell, setWhatWentWell] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const [painComment, setPainComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const day = session.workout_day
  const plan = day?.week?.plan

  async function handleFinish() {
    setSaving(true)

    // 1. Zapisz feedback
    await supabase.from('post_session_feedback').insert({
      session_id: session.id,
      workout_session_id: session.id,
      athlete_id: athlete.id,
      session_rpe: rpe,
      feeling_after: feeling,
      what_went_well: whatWentWell,
      general_notes: generalNotes,
      pain_after_comment: painComment,
    })

    // 2. Oznacz sesję jako ukończoną
    await supabase
      .from('workout_sessions')
      .update({
        completed: true,
        date_completed: new Date().toISOString(),
      })
      .eq('id', session.id)

    // 3. Wyślij raport przez API
    try {
      await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          athleteId: athlete.id,
          athleteName: athlete.full_name,
          dayName: day?.day_name,
          planName: plan?.name,
          weekNumber: day?.week?.week_number,
          rpe,
          feeling,
          whatWentWell,
          generalNotes,
          painComment,
          setLogs,
          wellness,
          painLogs,
          blocks: day?.workout_day_blocks || [],
        }),
      })

      // 4. Oznacz raport jako wysłany
      await supabase
        .from('workout_sessions')
        .update({ report_sent: true })
        .eq('id', session.id)
    } catch (e) {
      console.error('Email error:', e)
    }

    setSaving(false)
    setDone(true)
  }

  if (done) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        <div style={{
          minHeight: '100vh', background: '#F0EEE9',
          fontFamily: sans, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem', textAlign: 'center',
        }}>
          <div style={{
            fontSize: '4rem', marginBottom: '1.5rem', lineHeight: 1,
          }}>✓</div>
          <h1 style={{
            fontSize: '2rem', fontWeight: 700,
            letterSpacing: '-0.02em', color: '#111',
            marginBottom: '0.75rem',
          }}>
            Trening zakończony!
          </h1>
          <p style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem' }}>
            Raport został wysłany do trenera.
          </p>
          <p style={{
            fontFamily: mono, fontSize: '0.7rem',
            color: '#888', letterSpacing: '0.06em',
            marginBottom: '2.5rem',
          }}>
            {day?.day_name} · {plan?.name}
          </p>
          <button
            onClick={() => router.push('/athlete')}
            style={{
              padding: '1rem 2rem',
              background: '#111', color: '#F0EEE9',
              fontFamily: sans, fontSize: '0.95rem',
              fontWeight: 700, border: 'none', cursor: 'pointer',
            }}
          >
            Wróć do panelu →
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F0EEE9; }`}</style>
      <div style={{ minHeight: '100vh', background: '#F0EEE9', fontFamily: sans, color: '#111' }}>

        {/* Header */}
        <header style={{
          borderBottom: '1px solid #D5D2CB',
          padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: '#F0EEE9', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button
            onClick={() => router.back()}
            style={{ fontFamily: mono, fontSize: '0.75rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            ← Wróć
          </button>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>
            Zakończ trening
          </h1>
        </header>

        <main style={{ maxWidth: 520, margin: '0 auto', padding: '1.5rem 1.5rem 8rem' }}>

          {/* Tytuł */}
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontFamily: mono, fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              {plan?.name} · Tydz. {day?.week?.week_number}
            </p>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#111' }}>
              {day?.day_name}
            </h2>
          </div>

          {/* RPE */}
          <section style={{ marginBottom: '2rem' }}>
            <label style={{
              fontFamily: mono, fontSize: '0.68rem', color: '#888',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '0.75rem',
            }}>
              Jak ciężki był trening? (RPE 0–10)
            </label>
            <div style={{
              fontFamily: mono, fontSize: '3rem', fontWeight: 700,
              color: '#111', textAlign: 'center', marginBottom: '0.75rem',
            }}>
              {rpe}
            </div>
            <input
              type="range" min={0} max={10} step={1}
              value={rpe}
              onChange={e => setRpe(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#F5C842' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: '0.65rem', color: '#888', marginTop: 4 }}>
              <span>0 — brak wysiłku</span>
              <span>10 — maksimum</span>
            </div>
            <div style={{
              marginTop: '0.75rem', textAlign: 'center',
              fontFamily: mono, fontSize: '0.75rem', color: '#888',
            }}>
              {rpe <= 3 ? 'Lekki' : rpe <= 5 ? 'Umiarkowany' : rpe <= 7 ? 'Ciężki' : rpe <= 9 ? 'Bardzo ciężki' : 'Maksymalny'}
            </div>
          </section>

          <div style={{ borderTop: '1px solid #D5D2CB', marginBottom: '2rem' }} />

          {/* Samopoczucie */}
          <section style={{ marginBottom: '2rem' }}>
            <label style={{
              fontFamily: mono, fontSize: '0.68rem', color: '#888',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '0.75rem',
            }}>
              Jak się czujesz po treningu?
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FEELING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFeeling(opt.value)}
                  style={{
                    padding: '0.625rem 1rem',
                    background: feeling === opt.value ? '#111' : '#E8E6E0',
                    color: feeling === opt.value ? '#F0EEE9' : '#111',
                    border: 'none', cursor: 'pointer',
                    fontFamily: sans, fontSize: '0.85rem',
                    fontWeight: feeling === opt.value ? 700 : 400,
                    transition: 'background 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <div style={{ borderTop: '1px solid #D5D2CB', marginBottom: '2rem' }} />

          {/* Co poszło dobrze */}
          <section style={{ marginBottom: '1.5rem' }}>
            <label style={{
              fontFamily: mono, fontSize: '0.68rem', color: '#888',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '0.625rem',
            }}>
              Co poszło dobrze?
            </label>
            <textarea
              value={whatWentWell}
              onChange={e => setWhatWentWell(e.target.value)}
              placeholder="Np. lepsza technika w RDL, więcej energii..."
              rows={3}
              style={{
                width: '100%', fontFamily: sans, fontSize: '0.9rem',
                padding: '0.75rem', background: '#E8E6E0',
                border: 'none', color: '#111', resize: 'none', outline: 'none',
              }}
            />
          </section>

          {/* Ból / uwagi */}
          <section style={{ marginBottom: '1.5rem' }}>
            <label style={{
              fontFamily: mono, fontSize: '0.68rem', color: '#888',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '0.625rem',
            }}>
              Ból lub dyskomfort po treningu?
            </label>
            <textarea
              value={painComment}
              onChange={e => setPainComment(e.target.value)}
              placeholder="Opisz jeśli coś boli lub jest niepokojące..."
              rows={2}
              style={{
                width: '100%', fontFamily: sans, fontSize: '0.9rem',
                padding: '0.75rem', background: '#E8E6E0',
                border: 'none', color: '#111', resize: 'none', outline: 'none',
              }}
            />
          </section>

          {/* Dodatkowe notatki */}
          <section style={{ marginBottom: '1.5rem' }}>
            <label style={{
              fontFamily: mono, fontSize: '0.68rem', color: '#888',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '0.625rem',
            }}>
              Coś jeszcze dla trenera? (opcjonalnie)
            </label>
            <textarea
              value={generalNotes}
              onChange={e => setGeneralNotes(e.target.value)}
              placeholder="Pytania, uwagi, przemyślenia..."
              rows={2}
              style={{
                width: '100%', fontFamily: sans, fontSize: '0.9rem',
                padding: '0.75rem', background: '#E8E6E0',
                border: 'none', color: '#111', resize: 'none', outline: 'none',
              }}
            />
          </section>

        </main>

        {/* Bottom CTA */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#F0EEE9', borderTop: '1px solid #D5D2CB',
          padding: '1rem 1.5rem',
        }}>
          <button
            onClick={handleFinish}
            disabled={saving || !feeling}
            style={{
              width: '100%', padding: '1rem',
              background: saving || !feeling ? '#888' : '#111',
              color: '#F0EEE9',
              fontFamily: sans, fontSize: '0.95rem', fontWeight: 700,
              border: 'none', cursor: saving || !feeling ? 'default' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {saving ? 'Zapisuję i wysyłam raport...' : !feeling ? 'Wybierz samopoczucie ↑' : 'Zakończ i wyślij raport →'}
          </button>
        </div>
      </div>
    </>
  )
}
