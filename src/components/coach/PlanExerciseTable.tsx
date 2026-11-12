'use client'
// src/components/coach/PlanExerciseTable.tsx
// Tabela "Obciążenia z planu" — ćwiczenia z aktywnego planu × zawodniczki, z
// modyfikacjami trenera i faktycznymi danymi z treningu (set_logs).
import { useState } from 'react'

export type ActualSet = { num: number; weight: number | null; reps: number | null; note?: string | null }
// inProgress — wpisy z treningu jeszcze nieoznaczonego jako zakończony
export type ActualEntry = { sets: ActualSet[]; inProgress?: boolean }
export type PainEntry = { vas: number; comment: string | null }

// nagłówek kolumny — przyklejony u góry tabeli przy przewijaniu
const TH: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 2, background: 'var(--navy-900)', padding: '4px 6px', textAlign: 'center',
  fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.56rem', color: 'var(--gold)', letterSpacing: '0.04em',
  textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '1.5px solid var(--navy-600)', verticalAlign: 'bottom',
}

export default function PlanExerciseTable({ rows, athletes, overrides, actual, uniqueDays, painByAthleteDay, painByAthleteEx, absentByDay }: {
  rows: { exId: number; name: string; block: string; day: string; dayId: number; sets: number; reps: string; tempo: string; weight: number | null }[]
  athletes: any[]
  overrides: Record<number, Record<number, any>>
  actual: Record<number, Record<number, ActualEntry>>
  uniqueDays: { id: number; label: string }[]
  painByAthleteDay?: Record<number, Set<number>>
  painByAthleteEx?: Record<number, Record<string, PainEntry>>
  // nieobecne na danym treningu planu (id dnia → id zawodniczek)
  absentByDay?: Record<number, number[]>
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
        // kompaktowo: wpisy serii w jednej linii, nagłówek przyklejony przy przewijaniu
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content' }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: 'left', left: 0, zIndex: 3, padding: '5px 10px' }}>Zawodniczka</th>
                {filtered.map((row, ci) => (
                  <th key={`${row.exId}-${ci}`} title={`${row.block} · ${row.name}`} style={{ ...TH, minWidth: 70, maxWidth: 170 }}>
                    <div style={{ color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
                    <div style={{ color: 'var(--muted-light)', fontSize: '0.5rem', fontWeight: 600, textTransform: 'none', letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.sets}×{row.reps || '—'}{row.weight !== null ? ` · ${row.weight}kg` : ''}{row.tempo ? ` · ${row.tempo}` : ''}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {athletes.map((a: any, ri: number) => {
                const rowBg = ri % 2 === 0 ? '#fff' : '#FAFBFC'
                return (
                  <tr key={a.id} style={{ background: rowBg }}>
                    <td style={{ padding: '3px 10px', fontWeight: 700, color: 'var(--navy-900)', borderBottom: `1px solid var(--border)`, fontSize: '0.74rem', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: rowBg }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {(absentByDay?.[selDayId] || []).includes(a.id)
                          ? <span style={{ textDecoration: 'line-through', color: 'var(--muted-light)' }}>{a.full_name}</span>
                          : a.full_name}
                        {painByAthleteDay?.[a.id]?.has(selDayId) && (
                          <span title="Zawodniczka zgłosiła ból w tym treningu" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: '0.52rem', fontWeight: 900, flexShrink: 0 }}>!</span>
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
                      const absent = (absentByDay?.[row.dayId] || []).includes(a.id)
                      const td: React.CSSProperties = { padding: '3px 6px', textAlign: 'center', borderBottom: `1px solid var(--border)`, verticalAlign: 'middle', fontFamily: 'var(--font-inter),sans-serif', whiteSpace: 'nowrap' }
                      if (absent) {
                        return <td key={`${row.exId}-${ci}`} style={{ ...td, background: '#F6F7F9', fontSize: '0.58rem', fontWeight: 700, color: '#c23b3b' }}>nieob.</td>
                      }
                      const act = actual[row.exId]?.[a.id] ?? null
                      const hasAct = act !== null && act.sets.length > 0

                      // Dopasowanie bólu po nazwie ćwiczenia
                      const exNameKey = row.name.toLowerCase().replace(/-/g, ' ').trim()
                      const painEntry = painByAthleteEx?.[a.id]
                        ? Object.entries(painByAthleteEx[a.id]).find(([k]) => k.includes(exNameKey) || exNameKey.includes(k))?.[1] ?? null
                        : null
                      const pain = painEntry && (
                        <span title={`Ból: VAS ${painEntry.vas}/10${painEntry.comment ? ` · ${painEntry.comment}` : ''}`}
                          style={{ marginLeft: 4, padding: '0 4px', borderRadius: 4, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#EF4444', fontSize: '0.56rem', fontWeight: 800 }}>!{painEntry.vas}</span>
                      )

                      // Kolory tła: priorytet: pominięte > faktyczne > modyfikacja > brak
                      const bgColor = skip ? '#FEF2F2' : hasAct ? '#F0FDF4' : mod ? '#1A2E4520' : undefined

                      if (skip) return <td key={`${row.exId}-${ci}`} style={{ ...td, background: bgColor, fontSize: '0.58rem', color: '#EF4444', fontWeight: 700 }}>pominięte{pain}</td>

                      if (hasAct) {
                        // ZIELONY — faktyczne dane z set_logs, wszystkie serie w jednej linii
                        const weights = act.sets.map(x => x.weight)
                        const reps = act.sets.map(x => x.reps)
                        const hasW = weights.some(w => w !== null)
                        const hasR = reps.some(r => r !== null)
                        const notes = act.sets.map(x => x.note).filter(Boolean)
                        const detail = act.sets.map(x => `S${x.num}: ${x.weight !== null ? `${x.weight} kg` : '—'}${x.reps !== null ? ` × ${x.reps}` : ''}${x.note ? ` „${x.note}”` : ''}`).join('\n')
                        return (
                          <td key={`${row.exId}-${ci}`} title={detail} style={{ ...td, background: bgColor }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#16A34A' }}>
                              {hasW ? `${weights.map(w => w ?? '—').join('/')} kg` : ''}
                            </span>
                            {hasR && <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#15803D', marginLeft: hasW ? 3 : 0 }}>×{reps.map(r => r ?? '—').join('/')}</span>}
                            {notes.length > 0 && <span style={{ marginLeft: 3, fontSize: '0.6rem' }}>💬</span>}
                            {mod && <span title="Zmodyfikowane przez trenera" style={{ marginLeft: 3, fontSize: '0.56rem', color: 'var(--gold)' }}>✎</span>}
                            {pain}
                          </td>
                        )
                      }
                      // ZŁOTY (modyfikacja trenera) / SZARY (plan bazowy) — jedna linia
                      return (
                        <td key={`${row.exId}-${ci}`} title={mod ? 'Zmodyfikowane przez trenera' : undefined} style={{ ...td, background: bgColor }}>
                          {planW !== null && <span style={{ fontSize: '0.66rem', fontWeight: mod ? 800 : 600, color: mod ? 'var(--gold)' : 'var(--muted-light)', marginRight: 3 }}>{planW} kg</span>}
                          <span style={{ fontSize: '0.56rem', color: mod ? 'var(--gold)' : '#c9cfda' }}>{planS}×{planR || '—'}{planT ? ` ${planT}` : ''}</span>
                          {mod && <span style={{ marginLeft: 3, fontSize: '0.56rem', color: 'var(--gold)' }}>✎</span>}
                          {pain}
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
