'use client'
// src/app/coach/groups/[id]/summary/GroupSummaryClient.tsx
// Podsumowanie treningu grupy zorganizowanej — wybór po dacie, domyślnie ostatni
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatDatePl, dayRangeIso } from '@/lib/groupTraining'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444', orange: '#F97316',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = { id: number; name: string }
type Athlete = { id: number; full_name: string }
type Training = { id: number; group_id: number; training_date: string }
type SetRow = { reps?: string; tempo?: string; weight?: string }
type Exercise = { id: number; name: string; exercise_order: number; sets_planned?: number | null; reps?: string | null; tempo?: string | null }
type Entry = {
  exercise_id: number
  athlete_id: number
  sets: SetRow[]
  pain_vas?: number | null
  pain_comment?: string | null
  comment?: string | null
  exercise_override?: string | null
}
type WellnessRow = {
  athlete_id: number
  sleep_hours?: number | null
  sleep_quality?: number | null
  energy?: number | null
  stress?: number | null
  muscle_sorness?: number | null
  readiness?: number | null
  concerns?: string | null
  created_at: string
}
type FeedbackRow = {
  athlete_id: number
  session_rpe?: number | null
  feeling_after?: string | null
  what_went_well?: string | null
  pain_after_comment?: string | null
  general_notes?: string | null
  created_at: string
}

interface Props {
  group: Group
  athletes: Athlete[]
  trainings: Training[]
}

const FEELING_LABELS: Record<string, string> = {
  swietnie: '💪 Świetnie', dobrze: '😊 Dobrze', srednie: '😐 Średnio',
  zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
}

const entryKey = (exerciseId: number, athleteId: number) => `${exerciseId}_${athleteId}`

export default function GroupSummaryClient({ group, athletes, trainings }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedId, setSelectedId] = useState<number | null>(trainings[0]?.id ?? null)
  const [loading, setLoading] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [entryMap, setEntryMap] = useState<Map<string, Entry>>(new Map())
  const [wellnessByAthlete, setWellnessByAthlete] = useState<Map<number, WellnessRow>>(new Map())
  const [feedbackByAthlete, setFeedbackByAthlete] = useState<Map<number, FeedbackRow>>(new Map())

  const selected = trainings.find(t => t.id === selectedId) || null

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const athleteIds = athletes.map(a => a.id)
      const { startIso, endIso } = dayRangeIso(selected!.training_date)

      const [{ data: ex }, { data: ent }, wellnessLinked, wellnessSameDay, feedbackLinked, feedbackSameDay] = await Promise.all([
        supabase.from('group_training_exercises').select('*').eq('training_id', selected!.id).order('exercise_order'),
        supabase.from('group_training_entries').select('*').eq('training_id', selected!.id),
        supabase.from('wellness_logs').select('*').eq('group_training_id', selected!.id),
        athleteIds.length
          ? supabase.from('wellness_logs').select('*').in('athlete_id', athleteIds).gte('created_at', startIso).lt('created_at', endIso)
          : Promise.resolve({ data: [] }),
        supabase.from('post_session_feedback').select('*').eq('group_training_id', selected!.id),
        athleteIds.length
          ? supabase.from('post_session_feedback').select('*').in('athlete_id', athleteIds).gte('created_at', startIso).lt('created_at', endIso)
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return

      const wMap = new Map<number, WellnessRow>()
      for (const w of [...(wellnessSameDay.data || []), ...(wellnessLinked.data || [])] as WellnessRow[]) {
        wMap.set(w.athlete_id, w)
      }
      const fMap = new Map<number, FeedbackRow>()
      for (const f of [...(feedbackSameDay.data || []), ...(feedbackLinked.data || [])] as FeedbackRow[]) {
        fMap.set(f.athlete_id, f)
      }

      setExercises((ex || []) as Exercise[])
      setEntryMap(new Map(((ent || []) as Entry[]).map(e => [entryKey(e.exercise_id, e.athlete_id), e])))
      setWellnessByAthlete(wMap)
      setFeedbackByAthlete(fMap)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const sectionLabel: React.CSSProperties = {
    fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em',
    textTransform: 'uppercase', fontWeight: 700, marginBottom: 8,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
        .gs-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; }
        .gs-table th, .gs-table td { border-bottom: 1.5px solid ${C.grayLight}; border-right: 1.5px solid ${C.grayLight}; vertical-align: top; }
        .gs-sticky { position: sticky; left: 0; z-index: 2; background: ${C.white}; box-shadow: 2px 0 0 ${C.grayLight}; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.2rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
                ← {group.name}
              </button>
              {trainings.length > 0 && (
                <select
                  value={selectedId ?? ''}
                  onChange={e => setSelectedId(parseInt(e.target.value))}
                  style={{ border: `1.5px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, borderRadius: 8, padding: '0.45rem 0.6rem', fontFamily: mono, fontSize: '0.78rem', outline: 'none' }}
                >
                  {trainings.map(t => (
                    <option key={t.id} value={t.id}>{t.training_date}</option>
                  ))}
                </select>
              )}
            </div>
            <h1 style={{ color: C.white, fontSize: '1.25rem', fontWeight: 800, marginTop: '0.8rem' }}>
              Podsumowanie treningu
            </h1>
            {selected && (
              <p style={{ color: C.gray, fontSize: '0.8rem', marginTop: 3 }}>{formatDatePl(selected.training_date)}</p>
            )}
          </div>
        </header>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {trainings.length === 0 ? (
            <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: C.gray }}>
              Jeszcze nie było żadnego treningu.
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', color: C.gray, padding: '2rem', fontFamily: mono, fontSize: '0.8rem' }}>
              Wczytuję dane treningu...
            </div>
          ) : (
            <>
              {/* ── TABELA: ZAWODNICZKI × ĆWICZENIA ── */}
              <div style={sectionLabel}>Ćwiczenia i ciężary</div>
              {exercises.length === 0 ? (
                <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1.25rem', textAlign: 'center', color: C.gray, marginBottom: '1.5rem' }}>
                  Ten trening nie ma jeszcze wpisanych ćwiczeń.
                </div>
              ) : (
                <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'auto', maxHeight: '65vh', marginBottom: '1.5rem' }}>
                  <table className="gs-table">
                    <thead>
                      <tr>
                        <th className="gs-sticky" style={{ minWidth: 150, padding: '0.7rem 0.8rem', textAlign: 'left', fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', background: C.offWhite, zIndex: 3 }}>
                          Zawodniczka
                        </th>
                        {exercises.map(ex => (
                          <th key={ex.id} style={{ minWidth: 150, padding: '0.6rem 0.7rem', fontWeight: 800, fontSize: '0.8rem', color: C.navy, background: C.offWhite, textAlign: 'left' }}>
                            {ex.name}
                            {(ex.sets_planned || ex.reps || ex.tempo) && (
                              <div style={{ fontFamily: mono, fontSize: '0.62rem', fontWeight: 400, color: C.gray, marginTop: 2 }}>
                                {ex.sets_planned ? `${ex.sets_planned} serie` : ''}
                                {ex.reps ? ` × ${ex.reps}` : ''}
                                {ex.tempo ? ` @${ex.tempo}` : ''}
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {athletes.map(athlete => (
                        <tr key={athlete.id}>
                          <td className="gs-sticky" style={{ padding: '0.7rem 0.8rem', fontWeight: 700, fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                            {athlete.full_name}
                          </td>
                          {exercises.map(ex => {
                            const entry = entryMap.get(entryKey(ex.id, athlete.id))
                            const hasContent = entry && (entry.sets?.length || entry.pain_vas != null || entry.comment || entry.exercise_override)
                            return (
                              <td key={ex.id} style={{ padding: '0.5rem 0.7rem' }}>
                                {hasContent ? (
                                  <>
                                    {entry!.exercise_override && (
                                      <div style={{ fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, color: '#92600A', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '2px 6px', marginBottom: 4, display: 'inline-block' }}>
                                        ↷ {entry!.exercise_override}
                                      </div>
                                    )}
                                    {(entry!.sets || []).map((s, i) => (
                                      <div key={i} style={{ fontFamily: mono, fontSize: '0.7rem', color: C.navy, whiteSpace: 'nowrap' }}>
                                        <span style={{ color: C.gray }}>{i + 1}:</span>{' '}
                                        {s.reps || '—'}
                                        {s.weight ? ` × ${s.weight}${/[a-zA-Z%]/.test(s.weight) ? '' : ' kg'}` : ''}
                                        {s.tempo ? ` @${s.tempo}` : ''}
                                      </div>
                                    ))}
                                    {entry!.pain_vas != null && (
                                      <div style={{ marginTop: 4 }}>
                                        <span style={{ fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, color: C.white, background: entry!.pain_vas! >= 5 ? C.red : C.orange, borderRadius: 6, padding: '1px 6px' }}>
                                          ból VAS {entry!.pain_vas}
                                        </span>
                                        {entry!.pain_comment && (
                                          <div style={{ fontSize: '0.72rem', color: C.red, marginTop: 2 }}>{entry!.pain_comment}</div>
                                        )}
                                      </div>
                                    )}
                                    {entry!.comment && (
                                      <div style={{ fontSize: '0.72rem', color: C.gray, marginTop: 4, fontStyle: 'italic' }}>💬 {entry!.comment}</div>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ fontFamily: mono, fontSize: '0.72rem', color: C.grayLight }}>—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── GOTOWOŚĆ ── */}
              <div style={sectionLabel}>Gotowość treningowa</div>
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', marginBottom: '1.5rem' }}>
                {athletes.map((a, i) => {
                  const w = wellnessByAthlete.get(a.id)
                  return (
                    <div key={a.id} style={{ padding: '0.7rem 1rem', borderTop: i > 0 ? `1.5px solid ${C.grayLight}` : 'none', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', minWidth: 140 }}>{a.full_name}</span>
                      {w ? (
                        <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.navy, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {w.sleep_hours != null && <span>😴 {w.sleep_hours}h</span>}
                          {w.readiness != null && <span>✅ gotowość {w.readiness}/10</span>}
                          {w.energy != null && <span>⚡ energia {w.energy}/10</span>}
                          {w.stress != null && <span>😬 stres {w.stress}/10</span>}
                          {w.muscle_sorness != null && <span>💪 zakwasy {w.muscle_sorness}/10</span>}
                          {w.concerns && <span style={{ color: C.gray, fontFamily: sans, fontStyle: 'italic' }}>„{w.concerns}”</span>}
                        </span>
                      ) : (
                        <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>nie uzupełniono</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── FEEDBACK ── */}
              <div style={sectionLabel}>Feedback po treningu</div>
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden' }}>
                {athletes.map((a, i) => {
                  const f = feedbackByAthlete.get(a.id)
                  return (
                    <div key={a.id} style={{ padding: '0.7rem 1rem', borderTop: i > 0 ? `1.5px solid ${C.grayLight}` : 'none', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', minWidth: 140 }}>{a.full_name}</span>
                      {f ? (
                        <span style={{ fontSize: '0.78rem', color: C.navy, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          {f.session_rpe != null && <span style={{ fontFamily: mono, fontSize: '0.7rem' }}>RPE {f.session_rpe}/10</span>}
                          {f.feeling_after && <span>{FEELING_LABELS[f.feeling_after] || f.feeling_after}</span>}
                          {f.what_went_well && <span style={{ color: C.green }}>✓ {f.what_went_well}</span>}
                          {f.pain_after_comment && <span style={{ color: C.red }}>⚠ {f.pain_after_comment}</span>}
                          {f.general_notes && <span style={{ color: C.gray, fontStyle: 'italic' }}>„{f.general_notes}”</span>}
                        </span>
                      ) : (
                        <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>nie uzupełniono</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {selected && (
                <button
                  onClick={() => router.push(`/coach/groups/${group.id}/training/${selected.id}`)}
                  style={{ marginTop: '1.25rem', width: '100%', padding: '0.875rem', borderRadius: 12, border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, fontWeight: 800, fontSize: '0.9rem' }}
                >
                  ✏️ Edytuj ten trening
                </button>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
