'use client'
// src/components/coach/PlanExerciseTable.tsx
// Tabela "Obciążenia z planu" — ćwiczenia z aktywnego planu × zawodniczki, z
// modyfikacjami trenera i faktycznymi danymi z treningu (set_logs).
import { useState } from 'react'

export type ActualSet = { num: number; weight: number | null; reps: number | null; note?: string | null }
export type ActualEntry = { sets: ActualSet[] }
export type PainEntry = { vas: number; comment: string | null }

export default function PlanExerciseTable({ rows, athletes, overrides, actual, uniqueDays, painByAthleteDay, painByAthleteEx }: {
  rows: { exId: number; name: string; block: string; day: string; dayId: number; sets: number; reps: string; tempo: string; weight: number | null }[]
  athletes: any[]
  overrides: Record<number, Record<number, any>>
  actual: Record<number, Record<number, ActualEntry>>
  uniqueDays: { id: number; label: string }[]
  painByAthleteDay?: Record<number, Set<number>>
  painByAthleteEx?: Record<number, Record<string, PainEntry>>
}) {
  const [selDayId, setSelDayId] = useState(uniqueDays[0]?.id ?? 0)
  const filtered = rows.filter(r => r.dayId === selDayId)

  function effectiveWeight(exId: number, athleteId: number, planWeight: number | null) {
    const o = overrides[exId]?.[athleteId]
    if (!o || o.skip) return planWeight
    return o.weight_override ?? planWeight
  }
  function effectiveSets(exId: number, athleteId: number, planSets: number) {
    const o = overrides[exId]?.[athleteId]
    if (!o || o.skip) return planSets
    return o.sets_override ?? planSets
  }
  function effectiveReps(exId: number, athleteId: number, planReps: string) {
    const o = overrides[exId]?.[athleteId]
    if (!o || o.skip) return planReps
    return o.reps_override ?? planReps
  }
  function effectiveTempo(exId: number, athleteId: number, planTempo: string) {
    const o = overrides[exId]?.[athleteId]
    if (!o || o.skip) return planTempo
    return o.tempo_override ?? planTempo
  }
  function isSkipped(exId: number, athleteId: number) {
    return overrides[exId]?.[athleteId]?.skip === true
  }
  function hasOverride(exId: number, athleteId: number) {
    const o = overrides[exId]?.[athleteId]
    return !!o && !o.skip
  }

  return (
    <div>
      {/* Day tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1.5px solid var(--border)`, background: 'var(--bg)' }}>
        {uniqueDays.map(d => (
          <button key={d.id} onClick={() => setSelDayId(d.id)}
            style={{ flexShrink: 0, padding: '0.55rem 1rem', border: 'none', background: selDayId === d.id ? '#fff' : 'transparent', color: selDayId === d.id ? 'var(--navy-900)' : 'var(--muted-light)', fontWeight: selDayId === d.id ? 800 : 500, fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.68rem', borderBottom: selDayId === d.id ? `2px solid var(--gold)` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {d.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', color: 'var(--muted-light)' }}>Brak ćwiczeń w tym treningu.</div>
      )}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--navy-900)' }}>
                {/* sticky first col: athlete name */}
                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid var(--navy-600)`, position: 'sticky', left: 0, zIndex: 2, background: 'var(--navy-900)' }}>Zawodniczka</th>
                {filtered.map((row, ci) => (
                  <th key={`${row.exId}-${ci}`} style={{ padding: '0.5rem 0.65rem', textAlign: 'center', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.56rem', color: 'var(--gold)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid var(--navy-600)`, minWidth: 100, verticalAlign: 'bottom' }}>
                    <div style={{ color: '#fff', fontWeight: 700, marginBottom: 2 }}>{row.name}</div>
                    <div style={{ color: 'var(--muted-light)', fontSize: '0.52rem' }}>{row.block}</div>
                    <div style={{ color: 'var(--muted-light)', fontSize: '0.52rem' }}>{row.sets}×{row.reps || '—'}{row.weight !== null ? ` · ${row.weight}kg` : ''}{row.tempo ? ` · ${row.tempo}` : ''}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {athletes.map((a: any, ri: number) => {
                const rowBg = ri % 2 === 0 ? '#fff' : '#FAFBFC'
                return (
                  <tr key={a.id} style={{ background: rowBg }}>
                    <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: 'var(--navy-900)', borderBottom: `1px solid var(--border)`, fontSize: '0.88rem', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: rowBg }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {a.full_name}
                        {painByAthleteDay?.[a.id]?.has(selDayId) && (
                          <span title="Zawodniczka zgłosiła ból w tym treningu" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: '0.6rem', fontWeight: 900, flexShrink: 0 }}>!</span>
                        )}
                      </div>
                    </td>
                    {filtered.map((row, ci) => {
                      const skip = isSkipped(row.exId, a.id)
                      const mod = hasOverride(row.exId, a.id)
                      const planW = effectiveWeight(row.exId, a.id, row.weight)
                      const planS = effectiveSets(row.exId, a.id, row.sets)
                      const planR = effectiveReps(row.exId, a.id, row.reps)
                      const planT = effectiveTempo(row.exId, a.id, row.tempo)
                      const act = actual[row.exId]?.[a.id] ?? null
                      const hasAct = act !== null && act.sets.length > 0

                      // Dopasowanie bólu po nazwie ćwiczenia
                      const exNameKey = row.name.toLowerCase().replace(/-/g, ' ').trim()
                      const painEntry = painByAthleteEx?.[a.id]
                        ? Object.entries(painByAthleteEx[a.id]).find(([k]) => k.includes(exNameKey) || exNameKey.includes(k))?.[1] ?? null
                        : null

                      // Kolory tła: priorytet: pominięte > faktyczne > modyfikacja > brak
                      const bgColor = skip ? '#FEF2F2' : hasAct ? '#F0FDF4' : mod ? '#1A2E4520' : undefined

                      return (
                        <td key={`${row.exId}-${ci}`} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', borderBottom: `1px solid var(--border)`, verticalAlign: 'middle', background: bgColor, position: 'relative' }}>
                          {skip ? (
                            // CZERWONY — pominięte przez trenera
                            <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: '#EF4444', fontWeight: 700 }}>pominięte</span>
                          ) : hasAct ? (
                            // ZIELONY — faktyczne dane z set_logs
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              {act.sets.map((s, si) => (
                                <div key={si} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.55rem', color: '#16A34A', minWidth: 14 }}>S{s.num}</span>
                                  <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', fontWeight: 800, color: '#16A34A' }}>
                                    {s.weight !== null ? `${s.weight} kg` : '—'}
                                  </span>
                                  {s.reps !== null && (
                                    <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.55rem', color: '#4ADE80' }}>{s.reps}p</span>
                                  )}
                                  </div>
                                  {s.note && <div style={{ fontSize: '0.55rem', color: '#15803D', fontStyle: 'italic', maxWidth: 120, whiteSpace: 'normal', lineHeight: 1.25 }}>&ldquo;{s.note}&rdquo;</div>}
                                </div>
                              ))}
                              {mod && (
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.5rem', color: 'var(--gold)', marginTop: 1 }}>✎ mod.</span>
                              )}
                            </div>
                          ) : mod ? (
                            // ZŁOTY — modyfikacja trenera, brak danych treningowych
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              {planW !== null && (
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', fontWeight: 800, color: 'var(--gold)' }}>{planW} kg</span>
                              )}
                              <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.55rem', color: 'var(--gold)' }}>
                                {planS}×{planR || '—'}{planT ? ` ${planT}` : ''}
                              </span>
                              <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.5rem', color: 'var(--gold)' }}>✎ mod.</span>
                            </div>
                          ) : (
                            // SZARY — plan bazowy, brak danych
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              {planW !== null ? (
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-light)' }}>{planW} kg</span>
                              ) : (
                                <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', color: 'var(--border)' }}>—</span>
                              )}
                              <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.55rem', color: 'var(--border)', whiteSpace: 'nowrap' }}>
                                {planS}×{planR || '—'}{planT ? ` ${planT}` : ''}
                              </span>
                            </div>
                          )}
                          {painEntry && (
                            <div title={`VAS ${painEntry.vas}/10${painEntry.comment ? ` · ${painEntry.comment}` : ''}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3, padding: '1px 6px', background: '#FEF2F2', border: `1px solid #FCA5A5`, borderRadius: 6, cursor: 'default' }}>
                              <span style={{ color: '#EF4444', fontWeight: 900, fontSize: '0.62rem' }}>!</span>
                              <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.58rem', color: '#EF4444', fontWeight: 700 }}>VAS {painEntry.vas}</span>
                              {painEntry.comment && <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.55rem', color: '#EF4444', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{painEntry.comment}</span>}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ padding: '0.6rem 1rem', borderTop: `1.5px solid var(--border)`, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#16A34A' }} />
          <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)' }}>Faktyczne (z treningu)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--gold)' }} />
          <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)' }}>Zmodyfikowane przez trenera</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#EF4444' + '55', border: `1px solid #EF4444` }} />
          <span style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)' }}>Pominięte</span>
        </div>
      </div>
    </div>
  )
}
