'use client'
// src/app/coach/groups/[id]/stats/GroupStatsClient.tsx
// Statystyki grupy zorganizowanej:
//  • Statystyki — jeden wykres na metrykę, wszystkie zawodniczki osobno (linie),
//    wybór ćwiczenia i metryki osi Y; oś X = kolejne daty treningów.
//  • Obecność — tabela daty × zawodniczki + statystyki opuszczonych treningów.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDatePl } from '@/lib/groupTraining'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444', orange: '#F97316',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

// Paleta dla zawodniczek (linie wykresu / obecność). Powtarza się przy >16 osobach.
const PALETTE = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED', '#DB2777',
  '#0891B2', '#65A30D', '#EA580C', '#4F46E5', '#0D9488', '#BE123C',
  '#9333EA', '#CA8A04', '#0284C7', '#15803D',
]

type Group = { id: number; name: string }
type Athlete = { id: number; full_name: string }
type Training = { id: number; group_id: number; training_date: string; absent_athlete_ids?: number[] | null }
type SetRow = { reps?: string; tempo?: string; weight?: string; skipped?: boolean }
type Exercise = { id: number; training_id: number; name: string; reps?: string | null; tempo?: string | null; sets_planned?: number | null; bodyweight?: boolean | null }
type Entry = { training_id: number; exercise_id: number; athlete_id: number; sets: SetRow[]; variant?: string | null; bodyweight?: boolean | null; exercise_override?: string | null }

interface Props {
  group: Group
  athletes: Athlete[]
  trainings: Training[]
  exercises: Exercise[]
  entries: Entry[]
}

type Metric = 'weight_max' | 'reps_sum' | 'volume'
const METRICS: { id: Metric; label: string; unit: string; desc: string }[] = [
  { id: 'weight_max', label: 'Ciężar (kg)', unit: 'kg', desc: 'najcięższa seria danego dnia' },
  { id: 'reps_sum', label: 'Powtórzenia', unit: 'powt.', desc: 'suma powtórzeń danego dnia' },
  { id: 'volume', label: 'Objętość (kg)', unit: 'kg', desc: 'tonaż: Σ powtórzeń × ciężar' },
]

// Suma liczb w tekście („8”→8, „8-10”→18? nie — bierzemy pierwszą), tu: suma grup cyfr.
function sumNumbers(s?: string | null): number {
  const m = String(s ?? '').match(/\d+(?:[.,]\d+)?/g)
  return m ? m.reduce((a, x) => a + parseFloat(x.replace(',', '.')), 0) : 0
}
function firstNumber(s?: string | null): number {
  const m = String(s ?? '').match(/\d+(?:[.,]\d+)?/)
  return m ? parseFloat(m[0].replace(',', '.')) : 0
}

// Wartość metryki dla jednej zawodniczki w jednym treningu (null = brak danych).
function metricValue(entry: Entry | undefined, ex: Exercise | undefined, metric: Metric): number | null {
  if (!entry || !ex) return null
  if (entry.exercise_override) return null // robiła inne ćwiczenie — nie porównujemy
  const sets = (entry.sets || []).filter(s => !s.skipped)
  if (sets.length === 0) return null
  const prescReps = sumNumbers(ex.reps)
  if (metric === 'weight_max') {
    const ws = sets.map(s => firstNumber(s.weight)).filter(w => w > 0)
    return ws.length ? Math.max(...ws) : null
  }
  if (metric === 'reps_sum') {
    let total = 0, any = false
    for (const s of sets) {
      const r = sumNumbers(s.reps) || prescReps
      if (r > 0) { total += r; any = true }
    }
    return any ? total : null
  }
  // volume = Σ powt. × ciężar
  let vol = 0, any = false
  for (const s of sets) {
    const r = sumNumbers(s.reps) || prescReps
    const w = firstNumber(s.weight)
    if (r > 0 && w > 0) { vol += r * w; any = true }
  }
  return any ? vol : null
}

const colorOf = (i: number) => PALETTE[i % PALETTE.length]

// ── Wykres liniowy (SVG) — wiele serii (zawodniczek) na jednej osi ──────────────
function LineChart({ dates, series, unit }: {
  dates: string[]
  series: { id: number; name: string; color: string; points: (number | null)[] }[]
  unit: string
}) {
  const W = 760, H = 340
  const padL = 46, padR = 16, padT = 16, padB = 52
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const allVals = series.flatMap(s => s.points.filter((v): v is number => v != null))
  if (dates.length === 0 || allVals.length === 0) {
    return (
      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', fontFamily: mono, fontSize: '0.78rem', color: C.gray }}>
        Brak danych dla tego ćwiczenia i metryki — wybierz inne albo wpisz wyniki w treningach.
      </div>
    )
  }
  const maxV = Math.max(...allVals)
  const minV = Math.min(0, ...allVals)
  const span = maxV - minV || 1
  // „ładne” linie siatki (5 poziomów)
  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (span * i) / ticks)

  const x = (i: number) => dates.length === 1 ? padL + innerW / 2 : padL + (innerW * i) / (dates.length - 1)
  const y = (v: number) => padT + innerH - ((v - minV) / span) * innerH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: dates.length > 6 ? 520 : undefined }}>
      {/* siatka pozioma + etykiety osi Y */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke={C.grayLight} strokeWidth={1} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontFamily={mono} fontSize={9} fill={C.gray}>
            {Math.round(t * 10) / 10}
          </text>
        </g>
      ))}
      {/* etykiety osi X (daty) */}
      {dates.map((d, i) => {
        const show = dates.length <= 8 || i % Math.ceil(dates.length / 8) === 0 || i === dates.length - 1
        if (!show) return null
        const label = d.slice(5) // MM-DD
        return (
          <text key={i} x={x(i)} y={H - padB + 16} textAnchor="middle" fontFamily={mono} fontSize={9} fill={C.gray}
            transform={dates.length > 8 ? `rotate(35 ${x(i)} ${H - padB + 16})` : undefined}>
            {label}
          </text>
        )
      })}
      {/* linie zawodniczek */}
      {series.map(s => {
        // łączymy tylko kolejne punkty z danymi (pomijamy luki w wynikach)
        const path = s.points.map((v, i) => v == null ? '' : `${i > 0 && s.points[i - 1] != null ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
        return (
          <g key={s.id}>
            <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((v, i) => v == null ? null : (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color}>
                <title>{s.name} · {dates[i]} · {Math.round(v * 10) / 10} {unit}</title>
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export default function GroupStatsClient({ group, athletes, trainings, exercises, entries }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'stats' | 'attendance'>('stats')

  // Indeksy pomocnicze
  const exById = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises])
  const entryByKey = useMemo(() => {
    const m = new Map<string, Entry>()
    for (const e of entries) m.set(`${e.exercise_id}_${e.athlete_id}`, e)
    return m
  }, [entries])

  // Lista treningów rosnąco po dacie (oś X)
  const sortedTrainings = useMemo(
    () => [...trainings].sort((a, b) => a.training_date.localeCompare(b.training_date)),
    [trainings]
  )

  // Unikalne nazwy ćwiczeń (po częstości występowania)
  const exerciseNames = useMemo(() => {
    const count = new Map<string, number>()
    for (const e of exercises) {
      const n = (e.name || '').trim()
      if (!n) continue
      count.set(n, (count.get(n) || 0) + 1)
    }
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n)
  }, [exercises])

  const [selectedName, setSelectedName] = useState<string>('')
  const [metric, setMetric] = useState<Metric>('weight_max')
  const [hidden, setHidden] = useState<Set<number>>(new Set())

  const effName = selectedName || exerciseNames[0] || ''

  // Dla wybranego ćwiczenia: dla każdego treningu znajdź exercise.id o tej nazwie,
  // a potem wartość metryki per zawodniczka.
  const chart = useMemo(() => {
    const dates: string[] = []
    const exIdByTraining: (number | undefined)[] = []
    for (const t of sortedTrainings) {
      const ex = exercises.find(e => e.training_id === t.id && (e.name || '').trim() === effName)
      // pokazujemy tylko treningi, które miały to ćwiczenie
      if (!ex) continue
      dates.push(t.training_date)
      exIdByTraining.push(ex.id)
    }
    const series = athletes.map((a, i) => ({
      id: a.id,
      name: a.full_name,
      color: colorOf(i),
      points: exIdByTraining.map(exId => {
        const ex = exId != null ? exById.get(exId) : undefined
        const entry = exId != null ? entryByKey.get(`${exId}_${a.id}`) : undefined
        return metricValue(entry, ex, metric)
      }),
    }))
    return { dates, series }
  }, [sortedTrainings, exercises, exById, entryByKey, athletes, effName, metric])

  const visibleSeries = chart.series.filter(s => !hidden.has(s.id) && s.points.some(v => v != null))
  const metricMeta = METRICS.find(m => m.id === metric)!

  function toggleAthlete(id: number) {
    setHidden(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── Obecność: zakres dat ─────────────────────────────────────────────────────
  const allDates = sortedTrainings.map(t => t.training_date)
  const [from, setFrom] = useState<string>(allDates[0] || '')
  const [to, setTo] = useState<string>(allDates[allDates.length - 1] || '')

  const rangeTrainings = useMemo(
    () => sortedTrainings.filter(t => (!from || t.training_date >= from) && (!to || t.training_date <= to)),
    [sortedTrainings, from, to]
  )

  const absentSet = (t: Training) => new Set<number>((t.absent_athlete_ids || []).map(Number))

  const attendance = useMemo(() => {
    const total = rangeTrainings.length
    return athletes.map(a => {
      let absences = 0
      for (const t of rangeTrainings) if (absentSet(t).has(a.id)) absences++
      const present = total - absences
      return { athlete: a, absences, present, total, pct: total ? Math.round((present / total) * 100) : null }
    })
  }, [athletes, rangeTrainings])

  const topAbsent = useMemo(
    () => [...attendance].filter(r => r.total > 0).sort((a, b) => b.absences - a.absences),
    [attendance]
  )
  const maxAbsences = topAbsent[0]?.absences ?? 0

  const pctColor = (pct: number | null) => pct == null ? C.gray : pct >= 90 ? C.green : pct >= 75 ? C.orange : C.red

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
        .at-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; }
        .at-table th, .at-table td { border-bottom: 1px solid ${C.grayLight}; border-right: 1px solid ${C.grayLight}; }
        .at-sticky { position: sticky; left: 0; z-index: 2; background: ${C.white}; box-shadow: 3px 0 8px rgba(13,27,42,0.05); }
        .at-table thead th { position: sticky; top: 0; z-index: 3; background: ${C.offWhite}; }
        .at-table thead th.at-sticky { z-index: 4; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <button onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← {group.name}
            </button>
            <h1 style={{ color: C.white, fontSize: '1.3rem', fontWeight: 800, marginTop: '0.7rem' }}>Statystyki grupy</h1>
            {/* Zakładki */}
            <div style={{ display: 'flex', gap: 4, marginTop: '0.9rem' }}>
              {([{ id: 'stats', label: '📈 Statystyki' }, { id: 'attendance', label: '📋 Obecność' }] as const).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ padding: '0.6rem 1rem', border: 'none', background: tab === t.id ? C.offWhite : 'transparent', color: tab === t.id ? C.navy : C.gray, fontWeight: 800, fontSize: '0.84rem', borderRadius: '10px 10px 0 0' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 880, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {athletes.length === 0 ? (
            <Card><div style={{ padding: '1.5rem', textAlign: 'center', color: C.gray }}>Brak zawodniczek w grupie.</div></Card>
          ) : trainings.length === 0 ? (
            <Card><div style={{ padding: '1.5rem', textAlign: 'center', color: C.gray }}>Brak treningów — najpierw przeprowadź lub wgraj trening.</div></Card>
          ) : tab === 'stats' ? (
            <>
              {/* Wybór ćwiczenia + metryki */}
              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <Label>Ćwiczenie</Label>
                    {exerciseNames.length === 0 ? (
                      <div style={{ fontFamily: mono, fontSize: '0.78rem', color: C.gray }}>Brak ćwiczeń w treningach.</div>
                    ) : (
                      <select value={effName} onChange={e => { setSelectedName(e.target.value); setHidden(new Set()) }}
                        style={selectStyle}>
                        {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <Label>Oś Y — co pokazać</Label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {METRICS.map(m => (
                        <button key={m.id} onClick={() => setMetric(m.id)} title={m.desc}
                          style={{ padding: '0.5rem 0.8rem', borderRadius: 9, border: `1.5px solid ${metric === m.id ? C.gold : C.grayLight}`, background: metric === m.id ? C.navy : C.white, color: metric === m.id ? C.gold : C.navy, fontWeight: 700, fontSize: '0.8rem' }}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 6 }}>
                      oś X = kolejne daty treningów · {metricMeta.desc}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Wykres */}
              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '0.5rem 0.75rem 0.25rem', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{effName || '—'}</span>
                  <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>{metricMeta.label} · {chart.dates.length} {chart.dates.length === 1 ? 'trening' : 'treningi/-ów'}</span>
                </div>
                <div style={{ overflowX: 'auto', padding: '0 0.25rem' }}>
                  <LineChart dates={chart.dates} series={visibleSeries} unit={metricMeta.unit} />
                </div>
              </Card>

              {/* Legenda — klik włącza/wyłącza zawodniczkę */}
              <Card>
                <div style={{ padding: '0.75rem 1rem' }}>
                  <Label>Zawodniczki (kliknij, by ukryć/pokazać)</Label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {chart.series.map(s => {
                      const off = hidden.has(s.id)
                      const hasData = s.points.some(v => v != null)
                      return (
                        <button key={s.id} onClick={() => toggleAthlete(s.id)} disabled={!hasData}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.32rem 0.6rem', borderRadius: 999, border: `1.5px solid ${off || !hasData ? C.grayLight : s.color}`, background: off || !hasData ? C.offWhite : C.white, color: !hasData ? C.grayLight : off ? C.gray : C.navy, fontWeight: 700, fontSize: '0.74rem', opacity: hasData ? 1 : 0.6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: hasData && !off ? s.color : C.grayLight }} />
                          {s.name}{!hasData ? ' (brak)' : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              {/* Zakres dat */}
              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '1rem', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <Label>Od</Label>
                    <input type="date" value={from} min={allDates[0]} max={to} onChange={e => setFrom(e.target.value)} style={selectStyle} />
                  </div>
                  <div>
                    <Label>Do</Label>
                    <input type="date" value={to} min={from} max={allDates[allDates.length - 1]} onChange={e => setTo(e.target.value)} style={selectStyle} />
                  </div>
                  <button onClick={() => { setFrom(allDates[0] || ''); setTo(allDates[allDates.length - 1] || '') }}
                    style={{ padding: '0.6rem 0.9rem', borderRadius: 9, border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.8rem' }}>
                    Cały okres
                  </button>
                  <span style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gray }}>{rangeTrainings.length} treningów w zakresie</span>
                </div>
              </Card>

              {/* Krótkie statystyki */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: '1rem' }}>
                <Card>
                  <div style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>Najwięcej opuszczonych</div>
                    {maxAbsences > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {topAbsent.filter(r => r.absences === maxAbsences).map(r => (
                          <div key={r.athlete.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: C.navy }}>{r.athlete.full_name}</span>
                            <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 700, color: C.red }}>{r.absences}× nieob.</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontFamily: mono, fontSize: '0.78rem', color: C.green, fontWeight: 700 }}>Komplet — nikt nie opuścił treningu 🎉</div>
                    )}
                  </div>
                </Card>
                <Card>
                  <div style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>Frekwencja grupy</div>
                    {(() => {
                      const tot = attendance.reduce((a, r) => a + r.total, 0)
                      const pres = attendance.reduce((a, r) => a + r.present, 0)
                      const pct = tot ? Math.round((pres / tot) * 100) : null
                      return (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontFamily: mono, fontWeight: 800, fontSize: '1.5rem', color: pctColor(pct) }}>{pct == null ? '—' : `${pct}%`}</span>
                          <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>{pres}/{tot} obecności</span>
                        </div>
                      )
                    })()}
                  </div>
                </Card>
              </div>

              {/* Tabela: zawodniczki × statystyki obecności */}
              <Card style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.grayLight}`, fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Frekwencja per zawodniczka
                </div>
                {attendance.map((r, i) => (
                  <div key={r.athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1rem', borderTop: i > 0 ? `1px solid ${C.grayLight}` : 'none', background: r.absences === maxAbsences && maxAbsences > 0 ? '#FEF2F2' : undefined }}>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem', color: C.navy }}>{r.athlete.full_name}</span>
                    <span style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>nieob. <strong style={{ color: r.absences > 0 ? C.red : C.gray }}>{r.absences}</strong>/{r.total}</span>
                    <span style={{ minWidth: 92 }}>
                      <span style={{ display: 'block', height: 7, background: C.grayLight, borderRadius: 4, overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${r.pct ?? 0}%`, background: pctColor(r.pct), borderRadius: 4 }} />
                      </span>
                    </span>
                    <span style={{ fontFamily: mono, fontSize: '0.8rem', fontWeight: 800, color: pctColor(r.pct), minWidth: 42, textAlign: 'right' }}>{r.pct == null ? '—' : `${r.pct}%`}</span>
                  </div>
                ))}
              </Card>

              {/* Siatka obecności: daty × zawodniczki */}
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>
                Siatka obecności
              </div>
              <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'auto', maxHeight: '60vh', boxShadow: '0 4px 20px rgba(13,27,42,0.05)' }}>
                <table className="at-table">
                  <thead>
                    <tr>
                      <th className="at-sticky" style={{ minWidth: 150, padding: '0.6rem 0.85rem', textAlign: 'left', fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Zawodniczka
                      </th>
                      {rangeTrainings.map(t => (
                        <th key={t.id} title={formatDatePl(t.training_date)} style={{ minWidth: 50, padding: '0.5rem 0.4rem', fontFamily: mono, fontSize: '0.58rem', color: C.navy, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {t.training_date.slice(5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {athletes.map(a => (
                      <tr key={a.id}>
                        <td className="at-sticky" style={{ padding: '0.5rem 0.85rem', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{a.full_name}</td>
                        {rangeTrainings.map(t => {
                          const absent = absentSet(t).has(a.id)
                          return (
                            <td key={t.id} style={{ textAlign: 'center', padding: '0.4rem', background: absent ? '#FDEDED' : '#F0FDF4' }}>
                              <span style={{ fontFamily: mono, fontSize: '0.82rem', fontWeight: 800, color: absent ? C.red : C.green }}>{absent ? '✕' : '✓'}</span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span><span style={{ color: C.green, fontWeight: 800 }}>✓</span> obecna</span>
                <span><span style={{ color: C.red, fontWeight: 800 }}>✕</span> nieobecna</span>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>{children}</div>
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 6 }}>{children}</div>
}
const selectStyle: React.CSSProperties = {
  padding: '0.6rem 0.7rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10,
  background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.88rem', fontWeight: 600, outline: 'none', minWidth: 180,
}
