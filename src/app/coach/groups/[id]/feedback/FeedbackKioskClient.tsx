'use client'
// src/app/coach/groups/[id]/feedback/FeedbackKioskClient.tsx
// Kiosk feedbacku po treningu — tablet na sali, zawodniczki wybierają siebie
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { localDateStr, dayRangeIso, findTrainingForDate } from '@/lib/groupTraining'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = { id: number; name: string }
type Athlete = { id: number; full_name: string }

const FEELING_OPTIONS = [
  { value: 'swietnie', label: '💪 Świetnie' },
  { value: 'dobrze', label: '😊 Dobrze' },
  { value: 'srednie', label: '😐 Średnio' },
  { value: 'zmeczona', label: '😓 Zmęczona' },
  { value: 'slabo', label: '😞 Słabo' },
]

interface Props {
  group: Group
  athletes: Athlete[]
}

// ── Arkusz feedbacku jednej zawodniczki ─────────────────────────────────────
function FeedbackModal({ group, athlete, onClose, onSaved }: {
  group: Group
  athlete: Athlete
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [existingId, setExistingId] = useState<number | null>(null)
  const [rpe, setRpe] = useState<number>(6)
  const [feeling, setFeeling] = useState('')
  const [whatWentWell, setWhatWentWell] = useState('')
  const [painComment, setPainComment] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Wczytaj dzisiejszy feedback jeśli już istnieje (można poprawić)
  useEffect(() => {
    const { startIso, endIso } = dayRangeIso(localDateStr())
    supabase
      .from('post_session_feedback')
      .select('*')
      .eq('athlete_id', athlete.id)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id)
          if (data.session_rpe != null) setRpe(data.session_rpe)
          if (data.feeling_after) setFeeling(data.feeling_after)
          setWhatWentWell(data.what_went_well || '')
          setPainComment(data.pain_after_comment || '')
          setGeneralNotes(data.general_notes || '')
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete.id])

  async function handleSave() {
    setSaving(true); setError('')
    const today = localDateStr()
    const training = await findTrainingForDate(supabase, group.id, today)
    const payload = {
      athlete_id: athlete.id,
      session_rpe: rpe,
      feeling_after: feeling || null,
      what_went_well: whatWentWell.trim() || null,
      pain_after_comment: painComment.trim() || null,
      general_notes: generalNotes.trim() || null,
      group_training_id: training?.id ?? null,
    }
    const { error: err } = existingId
      ? await supabase.from('post_session_feedback').update(payload).eq('id', existingId)
      : await supabase.from('post_session_feedback').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  const label: React.CSSProperties = {
    fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em',
    textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 8,
  }
  const textareaStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10,
    background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem',
    outline: 'none', resize: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: C.white, borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.grayLight}` }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            Feedback po treningu
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: C.white }}>{athlete.full_name}</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem' }}>
          <section style={{ marginBottom: '1.5rem' }}>
            <label style={label}>Jak ciężki był trening? (RPE 0–10)</label>
            <div style={{ fontFamily: mono, fontSize: '2.4rem', fontWeight: 700, color: C.navy, textAlign: 'center', marginBottom: '0.5rem' }}>{rpe}</div>
            <input type="range" min={0} max={10} step={1} value={rpe} onChange={e => setRpe(parseInt(e.target.value))} style={{ width: '100%', accentColor: C.gold }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 4 }}>
              <span>0 — brak wysiłku</span>
              <span>10 — maksimum</span>
            </div>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <label style={label}>Jak się czujesz po treningu?</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FEELING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFeeling(opt.value)}
                  style={{
                    padding: '0.6rem 0.9rem', borderRadius: 10,
                    border: `1.5px solid ${feeling === opt.value ? C.gold : C.grayLight}`,
                    background: feeling === opt.value ? C.navy : C.offWhite,
                    color: feeling === opt.value ? C.gold : C.navy,
                    fontFamily: sans, fontSize: '0.85rem', fontWeight: feeling === opt.value ? 800 : 500,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: '1.25rem' }}>
            <label style={label}>Co poszło dobrze?</label>
            <textarea value={whatWentWell} onChange={e => setWhatWentWell(e.target.value)} placeholder="Np. lepsza technika, więcej energii..." rows={2} style={textareaStyle} />
          </section>

          <section style={{ marginBottom: '1.25rem' }}>
            <label style={label}>Ból lub dyskomfort po treningu?</label>
            <textarea value={painComment} onChange={e => setPainComment(e.target.value)} placeholder="Opisz jeśli coś boli..." rows={2} style={textareaStyle} />
          </section>

          <section>
            <label style={label}>Coś jeszcze dla trenera? (opcjonalnie)</label>
            <textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} placeholder="Pytania, uwagi..." rows={2} style={textareaStyle} />
          </section>

          {error && <div style={{ color: C.red, fontSize: '0.82rem', marginTop: '0.75rem' }}>❌ {error}</div>}
        </div>

        <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '0.8rem 1.1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !feeling}
            style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: 12, background: !feeling ? C.grayLight : C.navy, color: !feeling ? C.gray : C.gold, fontWeight: 900, fontSize: '0.92rem' }}
          >
            {saving ? 'Zapisuję...' : !feeling ? 'Wybierz samopoczucie ↑' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FeedbackKioskClient({ group, athletes }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [doneIds, setDoneIds] = useState<Set<number>>(new Set())
  const [active, setActive] = useState<Athlete | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDone = useCallback(async () => {
    if (athletes.length === 0) { setLoading(false); return }
    const { startIso, endIso } = dayRangeIso(localDateStr())
    const { data } = await supabase
      .from('post_session_feedback')
      .select('athlete_id')
      .in('athlete_id', athletes.map(a => a.id))
      .gte('created_at', startIso)
      .lt('created_at', endIso)
    setDoneIds(new Set((data || []).map((f: any) => f.athlete_id)))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadDone() }, [loadDone])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← {group.name}
            </button>
            <h1 style={{ color: C.white, fontSize: '1.4rem', fontWeight: 800, marginTop: '1rem' }}>
              💬 Feedback po treningu
            </h1>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>
              Wybierz siebie z listy i wypełnij arkusz. Po zapisaniu wracasz do listy.
            </p>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: C.gray, padding: '2rem', fontFamily: mono, fontSize: '0.8rem' }}>
              Wczytuję...
            </div>
          ) : athletes.length === 0 ? (
            <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: C.gray }}>
              Brak zawodniczek w grupie.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {athletes.map(a => {
                const done = doneIds.has(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => setActive(a)}
                    style={{
                      width: '100%', padding: '1.1rem 1.25rem', borderRadius: 14,
                      border: `2px solid ${done ? '#86EFAC' : C.grayLight}`,
                      background: done ? '#F0FDF4' : C.white,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      textAlign: 'left', boxShadow: '0 4px 20px rgba(13,27,42,0.05)',
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: C.navy }}>{a.full_name}</span>
                    {done ? (
                      <span style={{ fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, color: '#15803D' }}>
                        ✅ uzupełnione
                      </span>
                    ) : (
                      <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>wypełnij →</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {active && (
        <FeedbackModal
          group={group}
          athlete={active}
          onClose={() => setActive(null)}
          onSaved={() => setDoneIds(prev => new Set(prev).add(active.id))}
        />
      )}
    </>
  )
}
