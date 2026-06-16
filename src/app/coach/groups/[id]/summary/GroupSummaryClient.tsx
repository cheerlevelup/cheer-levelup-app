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

// Czytelne podsumowanie serii w jednej komórce:
// – ciężar 0 / pusty traktujemy jak masę ciała (bez „× 0 kg”),
// – serie identyczne zwijamy w jedną linię (np. „3 ser. · 5 × 10 kg”),
// – tempo wspólne dla wszystkich serii pokazujemy raz, nie przy każdej.
function SetsSummary({ sets }: { sets: SetRow[] }) {
  const ss = (sets || [])
    .map(s => ({ reps: (s.reps || '').trim(), tempo: (s.tempo || '').trim(), weight: (s.weight || '').trim() }))
    .filter(s => s.reps || s.tempo || s.weight)
  if (ss.length === 0) return <span style={{ fontFamily: mono, fontSize: '0.72rem', color: C.grayLight }}>—</span>

  const hasWeight = (w: string) => !!w && w !== '0'
  const fmtWeight = (w: string) => (/[a-zA-Z%]/.test(w) ? w : `${w} kg`)
  const sameTempo = ss.every(s => s.tempo === ss[0].tempo) ? ss[0].tempo : ''
  const allSame = ss.every(s => s.reps === ss[0].reps && s.weight === ss[0].weight && s.tempo === ss[0].tempo)

  const line = (label: string, reps: string, weight: string, tempo: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, lineHeight: 1.5 }}>
      <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.gray, minWidth: 24, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: '0.74rem', color: C.navy, whiteSpace: 'nowrap' }}>
        {reps || '—'}
        {hasWeight(weight) ? <> × <strong style={{ fontWeight: 700 }}>{fmtWeight(weight)}</strong></> : null}
        {tempo ? <span style={{ color: C.gray }}> · {tempo}</span> : null}
      </span>
    </div>
  )

  if (allSame) return line(`${ss.length} ser.`, ss[0].reps, ss[0].weight, ss[0].tempo)

  return (
    <div>
      {ss.map((s, i) => line(`S${i + 1}`, s.reps, s.weight, sameTempo ? '' : s.tempo))}
      {sameTempo ? (
        <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, marginTop: 3 }}>tempo {sameTempo}</div>
      ) : null}
    </div>
  )
}

// Kolumny siatki gotowości (nazwa + 5 metryk)
const WELLNESS_COLS = 'minmax(140px, 1.4fr) repeat(5, minmax(66px, 1fr))'

// Kolor wartości wg progów — od razu widać słabe wyniki.
// 'good-high': im więcej tym lepiej (gotowość, energia)
// 'good-low':  im mniej tym lepiej (stres, zakwasy)
function scoreColor(v: number, kind: 'good-high' | 'good-low' | 'sleep') {
  const green = { bg: '#E9F7EF', fg: '#15803D' }
  const amber = { bg: '#FEF3E2', fg: '#B45309' }
  const red = { bg: '#FDEDED', fg: '#C81E1E' }
  if (kind === 'sleep') return v >= 7.5 ? green : v >= 6 ? amber : red
  if (kind === 'good-high') return v >= 7 ? green : v >= 4 ? amber : red
  return v <= 3 ? green : v <= 6 ? amber : red
}

function Score({ value, kind }: { value?: number | null; kind: 'good-high' | 'good-low' | 'sleep' }) {
  if (value == null) return <span style={{ justifySelf: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.grayLight }}>–</span>
  const c = scoreColor(value, kind)
  return (
    <span style={{ justifySelf: 'center', fontFamily: mono, fontSize: '0.74rem', fontWeight: 700, color: c.fg, background: c.bg, borderRadius: 7, padding: '2px 8px', minWidth: 44, textAlign: 'center' }}>
      {value}{kind === 'sleep' ? 'h' : '/10'}
    </span>
  )
}

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
        .gs-table th, .gs-table td { border-bottom: 1px solid ${C.grayLight}; border-right: 1px solid ${C.grayLight}; vertical-align: top; }
        .gs-table tbody tr:last-child td { border-bottom: none; }
        .gs-sticky { position: sticky; left: 0; z-index: 2; background: ${C.white}; box-shadow: 3px 0 8px rgba(13,27,42,0.05); }
        .gs-table thead th { position: sticky; top: 0; z-index: 4; box-shadow: 0 2px 6px rgba(13,27,42,0.05); }
        .gs-table thead th.gs-sticky { z-index: 5; }
        .gs-row td { transition: background 0.12s ease; }
        .gs-row:nth-child(even) td, .gs-row:nth-child(even) .gs-sticky { background: #FBFCFE; }
        .gs-row:hover td, .gs-row:hover .gs-sticky { background: #EFF4FB; }
        .gs-wrow { transition: background 0.12s ease; }
        .gs-wrow:hover { background: #F7FAFD; }
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
                <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'auto', maxHeight: '65vh', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(13,27,42,0.06)' }}>
                  <table className="gs-table">
                    <thead>
                      <tr>
                        <th className="gs-sticky" style={{ minWidth: 150, padding: '0.7rem 0.85rem', textAlign: 'left', fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', background: C.offWhite, zIndex: 5 }}>
                          Zawodniczka
                        </th>
                        {exercises.map(ex => (
                          <th key={ex.id} style={{ minWidth: 150, padding: '0.6rem 0.75rem', fontWeight: 800, fontSize: '0.82rem', color: C.navy, background: C.offWhite, textAlign: 'left' }}>
                            {ex.name}
                            {(ex.sets_planned || ex.reps || ex.tempo) && (
                              <div style={{ fontFamily: mono, fontSize: '0.6rem', fontWeight: 400, color: C.gray, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {ex.sets_planned ? <span>{ex.sets_planned} serie</span> : null}
                                {ex.reps ? <span>{ex.reps} powt.</span> : null}
                                {ex.tempo ? <span>tempo {ex.tempo}</span> : null}
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {athletes.map(athlete => (
                        <tr key={athlete.id} className="gs-row">
                          <td className="gs-sticky" style={{ padding: '0.6rem 0.85rem', fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
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
                                      <div title={`Zamiana ćwiczenia: ${entry!.exercise_override}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', fontFamily: sans, fontSize: '0.64rem', fontWeight: 700, color: '#854F0B', background: '#FEF6E0', border: '1px solid #F7D27A', borderRadius: 999, padding: '2px 9px 2px 2px', marginBottom: 5 }}>
                                        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: C.gold, color: C.navy, fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, lineHeight: 1 }}>⇄</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry!.exercise_override}</span>
                                      </div>
                                    )}
                                    <SetsSummary sets={entry!.sets || []} />
                                    {entry!.pain_vas != null && (
                                      <div style={{ marginTop: 5 }}>
                                        <span style={{ fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, color: C.white, background: entry!.pain_vas! >= 5 ? C.red : C.orange, borderRadius: 6, padding: '1px 6px' }}>
                                          ból VAS {entry!.pain_vas}
                                        </span>
                                        {entry!.pain_comment && (
                                          <div style={{ fontSize: '0.72rem', color: C.red, marginTop: 2 }}>{entry!.pain_comment}</div>
                                        )}
                                      </div>
                                    )}
                                    {entry!.comment && (
                                      <div style={{ fontSize: '0.72rem', color: C.gray, marginTop: 5, fontStyle: 'italic' }}>💬 {entry!.comment}</div>
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
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'auto', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(13,27,42,0.06)' }}>
                <div style={{ minWidth: 560 }}>
                  {/* Nagłówek kolumn — pozwala porównywać metryki w pionie */}
                  <div style={{ display: 'grid', gridTemplateColumns: WELLNESS_COLS, gap: 8, alignItems: 'center', padding: '0.6rem 1rem', background: C.offWhite, borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.55rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    <span>Zawodniczka</span>
                    <span style={{ justifySelf: 'center' }}>😴 Sen</span>
                    <span style={{ justifySelf: 'center' }}>✅ Gotow.</span>
                    <span style={{ justifySelf: 'center' }}>⚡ Energia</span>
                    <span style={{ justifySelf: 'center' }}>😬 Stres</span>
                    <span style={{ justifySelf: 'center' }}>💪 Zakwasy</span>
                  </div>
                  {athletes.map((a, i) => {
                    const w = wellnessByAthlete.get(a.id)
                    return (
                      <div key={a.id} className="gs-wrow" style={{ borderTop: i > 0 ? `1px solid ${C.grayLight}` : 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: WELLNESS_COLS, gap: 8, alignItems: 'center', padding: '0.5rem 1rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>{a.full_name}</span>
                          {w ? (
                            <>
                              <Score value={w.sleep_hours} kind="sleep" />
                              <Score value={w.readiness} kind="good-high" />
                              <Score value={w.energy} kind="good-high" />
                              <Score value={w.stress} kind="good-low" />
                              <Score value={w.muscle_sorness} kind="good-low" />
                            </>
                          ) : (
                            <span style={{ gridColumn: '2 / -1', justifySelf: 'start', fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>nie uzupełniono</span>
                          )}
                        </div>
                        {w?.concerns && (
                          <div style={{ padding: '0 1rem 0.55rem', fontSize: '0.76rem', color: C.gray, fontStyle: 'italic' }}>„{w.concerns}”</div>
                        )}
                      </div>
                    )
                  })}
                </div>
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
