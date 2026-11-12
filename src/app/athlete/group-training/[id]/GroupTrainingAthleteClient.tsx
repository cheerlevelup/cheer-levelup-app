'use client'
// src/app/athlete/group-training/[id]/GroupTrainingAthleteClient.tsx
// Zawodniczka uzupełnia trening grupy: przy każdym ćwiczeniu serie z rozpiski
// trenera i pole na ciężar (albo powtórzenia — masa własna / „max"), komentarz
// i ból. Zapis do group_training_entries — ten sam wpis widzi trener w tabeli grupy.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { C, sans, display, shadow, radius } from '@/lib/athleteTheme'
import { isMaxReps, type GroupEntry, type GroupExercise, type GroupSetRow, type GroupTrainingInfo } from '@/lib/athleteGroupTrainingShared'

interface Props {
  athleteId: number
  training: GroupTrainingInfo
  groupName: string
  exercises: GroupExercise[]
  initialEntries: GroupEntry[]
}

const blockLetter = (pos: number): string =>
  pos < 26 ? String.fromCharCode(65 + pos) : blockLetter(Math.floor(pos / 26) - 1) + String.fromCharCode(65 + (pos % 26))

// Rozpiska serii z nagłówka ćwiczenia (wartość serii albo wspólna z pola bazowego) — jak w panelu trenera
const planCount = (ex: GroupExercise) => Math.max(ex.sets_planned ?? 0, 1)
function planAt(ex: GroupExercise, i: number) {
  const n = planCount(ex)
  const k = Math.min(i, n - 1)
  const reps = ex.reps_sets?.[k] ?? ex.reps ?? ''
  const tempo = ex.tempo_sets?.[k] ?? ex.tempo ?? ''
  const secs = ex.iso_seconds_sets?.[k] ?? ex.iso_seconds ?? null
  const intensity = ex.iso_intensity_sets?.[k] ?? ex.iso_intensity ?? null
  return { reps: String(reps || ''), tempo: String(tempo || ''), secs, intensity }
}
// Serie do wypełnienia: zapisane serie wpisu albo tyle, ile zakłada rozpiska
function initialSets(ex: GroupExercise, entry?: GroupEntry): GroupSetRow[] {
  if (entry?.sets?.length) return entry.sets.map(s => ({ ...s }))
  return Array.from({ length: planCount(ex) }, (_, i) => { const p = planAt(ex, i); return { reps: p.reps, tempo: p.tempo, weight: '' } })
}
function planSummary(ex: GroupExercise): string {
  const n = ex.sets_planned ?? null
  if (ex.iso) {
    const t = Array.from({ length: planCount(ex) }, (_, i) => planAt(ex, i).secs).filter(v => v != null)
    const uniq = [...new Set(t)]
    return [ex.iso_type || 'ISO', n ? `${n}×` : '', uniq.length ? `${uniq.join('/')}s` : ''].filter(Boolean).join(' ')
  }
  const reps = [...new Set(Array.from({ length: planCount(ex) }, (_, i) => planAt(ex, i).reps).filter(Boolean))]
  const tempo = [...new Set(Array.from({ length: planCount(ex) }, (_, i) => planAt(ex, i).tempo).filter(Boolean))]
  return [n ? `${n}×${reps.join('/') || '?'}` : reps.join('/'), tempo.length ? `tempo ${tempo.join('/')}` : ''].filter(Boolean).join(' · ')
}

const inputStyle = (done: boolean, disabled: boolean): React.CSSProperties => ({
  width: '100%', height: 34, padding: '0 6px', border: `1px solid ${done ? '#9fdcbc' : '#d9dfe9'}`, borderRadius: 8,
  fontFamily: sans, fontSize: 16, fontWeight: 600, color: C.navy, background: disabled ? C.offWhite : '#fff', outline: 'none', textAlign: 'center',
})

export default function GroupTrainingAthleteClient({ athleteId, training, groupName, exercises, initialEntries }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [entries, setEntries] = useState<Map<number, GroupEntry>>(() => new Map(initialEntries.map(e => [e.exercise_id, e])))
  const [error, setError] = useState('')
  const [savingCount, setSavingCount] = useState(0)
  const chainRef = useRef<Map<number, Promise<void>>>(new Map())
  // aktualne wpisy dla kolejki zapisów (stan Reacta mógłby być jeszcze nieaktualny)
  const entriesRef = useRef<Map<number, GroupEntry>>(new Map(initialEntries.map(e => [e.exercise_id, e])))

  const date = new Date(`${training.training_date}T12:00:00`)
  const blocks = [...new Set(exercises.map(e => e.block_index ?? 0))].sort((a, b) => a - b)

  // Zapis wpisu: zmiana tylko podanych kolumn (update), a gdy wpisu jeszcze nie ma — nowy wiersz.
  // Zapisy jednego ćwiczenia idą po kolei, żeby nie powstały dwa wiersze naraz.
  function saveEntry(ex: GroupExercise, patch: Partial<GroupEntry>) {
    const run = async () => {
      setSavingCount(n => n + 1)
      setError('')
      try {
        const current = entriesRef.current.get(ex.id)
        let res
        if (current?.id) {
          res = await supabase.from('group_training_entries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', current.id).select().single()
        } else {
          res = await supabase.from('group_training_entries').insert({
            training_id: training.id, exercise_id: ex.id, athlete_id: athleteId, sets: [], ...patch,
          }).select().single()
          if (res.error) {
            // trener mógł właśnie utworzyć ten wpis — odszukaj i zaktualizuj
            const { data: found } = await supabase.from('group_training_entries').select('id').eq('exercise_id', ex.id).eq('athlete_id', athleteId).maybeSingle()
            if (found?.id) res = await supabase.from('group_training_entries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', found.id).select().single()
          }
        }
        if (res.error || !res.data) {
          setError(/row-level|policy|permission/i.test(res.error?.message || '')
            ? 'Nie można zapisać — wpis jest zablokowany przez trenera albo brak uprawnień (migracja 202611120002).'
            : (res.error?.message || 'Błąd zapisu'))
          return
        }
        const saved = res.data as GroupEntry
        entriesRef.current.set(ex.id, saved)
        setEntries(prev => new Map(prev).set(ex.id, saved))
      } finally {
        setSavingCount(n => n - 1)
      }
    }
    const prev = chainRef.current.get(ex.id) ?? Promise.resolve()
    const next = prev.then(run, run)
    chainRef.current.set(ex.id, next)
    return next
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.ink }}>
        {/* nagłówek */}
        <header style={{ background: C.navy, padding: 'calc(env(safe-area-inset-top) + 12px) 16px 14px', position: 'sticky', top: 0, zIndex: 10, borderBottom: `2px solid ${C.gold}` }}>
          <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/athlete')} aria-label="Powrót do panelu"
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.navyBorder}`, background: C.navyLight, color: C.white, fontSize: 18, flexShrink: 0 }}>←</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.goldLight }}>Trening grupy · {groupName}</div>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: 22, color: C.white, marginTop: 2, textTransform: 'capitalize' }}>
                {date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: savingCount > 0 ? C.goldLight : C.gray, flexShrink: 0 }}>{savingCount > 0 ? 'zapisuję…' : 'zapisano'}</span>
          </div>
        </header>

        <main style={{ maxWidth: 520, margin: '0 auto', padding: '12px 12px calc(env(safe-area-inset-bottom) + 28px)' }}>
          {error && <div style={{ marginBottom: 10, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, color: C.red, fontSize: 13, fontWeight: 600 }}>❌ {error}</div>}
          {training.notes && (
            <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fffbf0', borderLeft: `3px solid ${C.gold}`, borderRadius: '0 10px 10px 0', fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-line' }}>
              <span style={{ fontWeight: 700, color: '#92660A' }}>📣 </span>{training.notes}
            </div>
          )}
          {exercises.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 14 }}>Trener nie dodał jeszcze ćwiczeń.</div>}

          {blocks.map((b, bi) => {
            const list = exercises.filter(e => (e.block_index ?? 0) === b)
            return (
              <section key={b} style={{ marginBottom: 12 }}>
                {blocks.length > 1 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '3px 10px', borderRadius: 999, background: C.navy, color: C.gold, fontFamily: display, fontWeight: 700, fontSize: 14 }}>Blok {blockLetter(bi)}</div>
                )}
                {list.map((ex, i) => (
                  <ExerciseCard key={ex.id} ex={ex} label={`${blockLetter(bi)}${i + 1}`} entry={entries.get(ex.id)} onSave={patch => saveEntry(ex, patch)} />
                ))}
              </section>
            )
          })}

          <button onClick={() => router.push('/athlete')}
            style={{ width: '100%', height: 48, marginTop: 4, borderRadius: 12, border: 'none', background: C.navy, color: C.gold, fontFamily: display, fontWeight: 700, fontSize: 18 }}>
            Gotowe — wróć do panelu
          </button>
        </main>
      </div>
    </>
  )
}

function ExerciseCard({ ex, label, entry, onSave }: {
  ex: GroupExercise; label: string; entry?: GroupEntry
  onSave: (patch: Partial<GroupEntry>) => Promise<void>
}) {
  const locked = !!entry?.locked
  const excluded = !!entry?.excluded
  const repsMode = isMaxReps(planAt(ex, 0).reps) || !!entry?.bodyweight || !!ex.bodyweight
  const field: 'reps' | 'weight' = repsMode ? 'reps' : 'weight'
  const [sets, setSets] = useState<GroupSetRow[]>(() => initialSets(ex, entry))
  // w trybie powtórzeń pole startuje puste, jeśli w serii jest tylko rozpiska (np. „max")
  const valueOf = (s: GroupSetRow, i: number) => {
    const v = (s[field] ?? '').toString()
    if (field === 'reps' && (isMaxReps(v) || v === planAt(ex, i).reps) && !entry?.sets?.[i]?.reps) return ''
    return v
  }
  const [comment, setComment] = useState(entry?.comment || '')
  const [painOpen, setPainOpen] = useState(false)
  const [vas, setVas] = useState<number>(entry?.pain_vas ?? 0)
  const [painNote, setPainNote] = useState(entry?.pain_comment || '')
  const hasPain = !!entry?.pain || entry?.pain_vas != null || !!entry?.pain_comment
  const done = sets.some((s, i) => valueOf(s, i).trim() !== '')
  const name = entry?.exercise_override || ex.name || 'Ćwiczenie'

  function commitSet(i: number, raw: string) {
    const v = raw.trim().replace(',', '.')
    const next = sets.map((s, k) => {
      if (k !== i) return s
      const p = planAt(ex, k)
      return { reps: s.reps ?? p.reps, tempo: s.tempo ?? p.tempo, ...s, [field]: v }
    })
    if ((sets[i]?.[field] ?? '') === v) return
    setSets(next)
    onSave({ sets: next })
  }

  return (
    <div style={{ background: '#fff', borderRadius: radius, border: `1px solid ${done ? '#bfe9d3' : C.grayLight}`, boxShadow: shadow, marginBottom: 8, padding: '10px 12px', opacity: excluded ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.navy, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{label}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, lineHeight: 1.2 }}>
            {name}
            {ex.athlete_id != null && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#0e7490', background: '#ecfeff', border: '1px solid #a5e3ef', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle' }}>TYLKO DLA CIEBIE</span>}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {planSummary(ex)}{repsMode ? ' · wpisz powtórzenia' : ''}
          </div>
        </div>
        {ex.link_url && (
          <a href={ex.link_url} target="_blank" rel="noopener noreferrer" aria-label="Film z techniką"
            style={{ width: 34, height: 34, borderRadius: 8, background: C.navy, border: `1.5px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none', fontSize: 13 }}>▶️</a>
        )}
      </div>

      {ex.coach_comment && (
        <p style={{ margin: '8px 0 0', padding: '6px 10px', background: '#fffbf0', borderLeft: `3px solid ${C.gold}`, borderRadius: '0 8px 8px 0', fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-line' }}>
          <span style={{ fontWeight: 700, color: '#92660A' }}>💬 </span>{ex.coach_comment}
        </p>
      )}

      {excluded ? (
        <div style={{ marginTop: 8, fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Trener wyłączył Ci to ćwiczenie w tym treningu.</div>
      ) : (
        <>
          {locked && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: '#a8650f' }}>🔒 Wpis zablokowany przez trenera</div>}
          <div style={{ marginTop: 8 }}>
            {sets.map((s, i) => {
              const p = planAt(ex, i)
              const val = valueOf(s, i)
              const filled = val.trim() !== ''
              const planText = ex.iso
                ? [p.secs != null ? `${p.secs}s` : '', p.intensity != null && ex.iso_type !== 'HIMA' ? `${p.intensity}%` : ''].filter(Boolean).join(' · ')
                : [s.reps && !repsMode ? `${s.reps} powt.` : p.reps ? `${p.reps}${repsMode ? '' : ' powt.'}` : '', (s.tempo || p.tempo) ? `tempo ${s.tempo || p.tempo}` : ''].filter(Boolean).join(' · ')
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 4px 10px', marginBottom: 4, borderRadius: 10, border: `1px solid ${filled ? '#bfe9d3' : C.grayLight}`, background: s.skipped ? C.offWhite : filled ? '#effaf4' : '#fff' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: filled ? C.green : C.gold, minWidth: 22 }}>S{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: s.skipped ? C.muted : C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.skipped ? 'seria pominięta' : planText || '—'}
                  </div>
                  <div style={{ width: 76, flexShrink: 0 }}>
                    <input
                      key={`${i}-${val}`}
                      defaultValue={val}
                      disabled={locked || !!s.skipped}
                      inputMode={repsMode ? 'numeric' : 'decimal'}
                      placeholder={repsMode ? 'powt.' : 'kg'}
                      onBlur={e => commitSet(i, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      style={inputStyle(filled, locked || !!s.skipped)}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <textarea
              value={comment} disabled={locked}
              onChange={e => setComment(e.target.value)}
              onBlur={() => { if (comment.trim() !== (entry?.comment || '')) onSave({ comment: comment.trim() || null }) }}
              placeholder="📝 Komentarz: jak poszło…" rows={comment ? 2 : 1}
              style={{ flex: 1, minWidth: 0, minHeight: 36, padding: '8px 10px', border: `1px solid ${C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: 16, color: C.navy, resize: 'none', outline: 'none', background: '#fafbfc', lineHeight: 1.35 }}
            />
            <button onClick={() => setPainOpen(v => !v)} disabled={locked}
              style={{ flexShrink: 0, height: 36, padding: '0 10px', borderRadius: 8, border: `1px solid ${hasPain || painOpen ? '#FED7AA' : C.grayLight}`, background: hasPain ? '#fff4ec' : '#fafbfc', color: hasPain ? '#c2410c' : C.navy, fontWeight: 600, fontSize: 13 }}>
              🩹 {hasPain && entry?.pain_vas ? `Ból ${entry.pain_vas}/10` : 'Ból'}
            </button>
          </div>

          {painOpen && !locked && (
            <div style={{ marginTop: 6, padding: '10px 12px', background: '#FAFBFC', borderRadius: 10, border: `1px solid ${C.grayLight}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Skala bólu: {vas}/10</div>
              <input type="range" min={0} max={10} step={1} value={vas} onChange={e => setVas(parseInt(e.target.value))} style={{ width: '100%', accentColor: vas >= 7 ? C.red : vas >= 4 ? C.orange : C.green }} />
              <textarea value={painNote} onChange={e => setPainNote(e.target.value)} placeholder="Gdzie boli? Opis odczuć…" rows={2}
                style={{ width: '100%', marginTop: 6, padding: '8px 10px', border: `1px solid ${C.grayLight}`, borderRadius: 8, fontFamily: sans, fontSize: 16, color: C.navy, resize: 'none', outline: 'none', background: '#fff' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => { onSave({ pain: vas > 0 || !!painNote.trim(), pain_vas: vas > 0 ? vas : null, pain_comment: painNote.trim() || null }); setPainOpen(false) }}
                  style={{ flex: 1, height: 38, borderRadius: 8, border: 'none', background: C.navy, color: C.gold, fontWeight: 700, fontSize: 14 }}>Zapisz</button>
                {hasPain && (
                  <button onClick={() => { setVas(0); setPainNote(''); onSave({ pain: false, pain_vas: null, pain_comment: null }); setPainOpen(false) }}
                    style={{ height: 38, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.grayLight}`, background: '#fff', color: C.muted, fontWeight: 600, fontSize: 13 }}>Usuń</button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
