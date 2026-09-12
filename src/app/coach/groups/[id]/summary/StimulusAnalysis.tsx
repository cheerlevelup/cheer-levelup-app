'use client'
// src/app/coach/groups/[id]/summary/StimulusAnalysis.tsx
// Warstwa analityczna bodźca treningowego — szacuje, JAKI BODZIEC trener
// zaprogramował (na podstawie powtórzeń, tempa i TUT). Renderuje:
//  • StimulusBadge   — kompaktowo w nagłówku kolumny ćwiczenia,
//  • StimulusSection — pełna analiza per ćwiczenie + profil całego treningu.
import {
  analyzeWorkout,
  CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_SHORT, CATEGORY_COLOR,
  CHARACTER_LABEL, CONFIDENCE_LABEL,
  fmtSeconds, pct,
  type ExerciseInput, type ExerciseAnalysis, type StimulusProfile, type Confidence,
  type VariantBreakdown, type AthleteBreakdown,
} from '@/lib/stimulus'

const INTER = 'var(--font-inter),sans-serif'

const PATTERN_LABEL: Record<string, string> = {
  squat: 'squat', hinge: 'hinge', push: 'push', pull: 'pull',
  lunge: 'lunge', carry: 'carry', rotation: 'rotacja', locomotion: 'lokomocja',
}
const CHAR_LABEL: Record<string, string> = {
  unilateral: 'unilateralne', bodyweight: 'masa własna',
  eccentric: 'ekscentryczne', isometric: 'izometryczne', plyometric: 'plyometryczne',
}

// Semantyczne kolory spójne z resztą panelu (StatusPill / coach-theme.css)
const SEM = {
  red: '#c23b3b', redBg: '#fdecec',
  amber: '#c07f1e', amberBg: '#fdf1de',
  green: '#1f9d64', greenBg: '#e3f8ee',
}
const CONF_COLOR: Record<Confidence, string> = {
  wysoka: SEM.green, srednia: SEM.amber, niska: SEM.red,
}

// Pasek profilu — proporcje 5 kategorii w jednej linii.
function ProfileBar({ profile, height = 8 }: { profile: StimulusProfile; height?: number }) {
  const segs = CATEGORY_ORDER.filter(c => profile[c] > 0.005)
  if (segs.length === 0) {
    return <div style={{ height, borderRadius: 999, background: 'var(--border)' }} />
  }
  return (
    <div style={{ display: 'flex', height, borderRadius: 999, overflow: 'hidden', background: 'var(--border)' }}>
      {segs.map(c => (
        <div key={c} title={`${CATEGORY_LABEL[c]} ${pct(profile[c])}%`}
          style={{ width: `${profile[c] * 100}%`, background: CATEGORY_COLOR[c] }} />
      ))}
    </div>
  )
}

// Rozkład kategorii jako pionowa lista wierszy (nazwa + mini pasek + %) —
// zgodnie z układem .coach-stat-bar-row używanym gdzie indziej w panelu.
function CategoryBars({ profile, short }: { profile: StimulusProfile; short?: boolean }) {
  const segs = CATEGORY_ORDER.filter(c => profile[c] > 0.005)
  if (segs.length === 0) return null
  return (
    <div>
      {segs.map(c => (
        <div key={c} className="coach-stat-bar-row">
          <span className="coach-stat-bar-name" style={{ display: 'flex', alignItems: 'center', gap: 6, width: short ? 110 : 150 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: CATEGORY_COLOR[c], flexShrink: 0 }} />
            {short ? CATEGORY_SHORT[c] : CATEGORY_LABEL[c]}
          </span>
          <div className="coach-bar-track" style={{ flex: 1 }}>
            <div className="coach-bar-fill" style={{ width: `${profile[c] * 100}%`, background: CATEGORY_COLOR[c] }} />
          </div>
          <span className="coach-stat-bar-pct">{pct(profile[c])}%</span>
        </div>
      ))}
    </div>
  )
}

// Kompaktowy znacznik pod nazwą ćwiczenia (w nagłówku kolumny).
export function StimulusBadge({ ex }: { ex: ExerciseInput }) {
  const a = analyzeWorkout([ex]).exercises[0]
  if (!a.dominant) {
    return (
      <div style={{ marginTop: 5, fontFamily: INTER, fontSize: '0.58rem', color: 'var(--muted)' }}>
        bodziec: nieokreślony{a.isMax ? ' (na maksa)' : ''}
      </div>
    )
  }
  const col = CATEGORY_COLOR[a.dominant]
  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink)', background: `${col}22`, border: `1px solid ${col}`, borderRadius: 999, padding: '1px 7px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: col }} />
          {CATEGORY_SHORT[a.dominant]}
        </span>
        <span style={{ fontFamily: INTER, fontSize: '0.54rem', color: 'var(--muted)' }}>{CHARACTER_LABEL[a.character]}</span>
        {a.explosive && <span style={{ fontFamily: INTER, fontSize: '0.54rem', fontWeight: 700, color: SEM.amber, background: SEM.amberBg, borderRadius: 4, padding: '0 4px' }}>⚡ explo</span>}
      </div>
      <div style={{ marginTop: 4 }}><ProfileBar profile={a.profile} height={5} /></div>
      <div style={{ fontFamily: INTER, fontSize: '0.54rem', color: 'var(--muted)', marginTop: 3 }}>
        TUT {fmtSeconds(a.tutPerSet)}/seria · pewność {CONFIDENCE_LABEL[a.confidence]}
      </div>
      {(a.mode === 'individual' || a.variantsDefined.length > 0) && (
        <div style={{ fontFamily: INTER, fontSize: '0.54rem', fontWeight: 700, color: SEM.amber, marginTop: 2 }}>
          {a.mode === 'individual' ? 'tryb indyw.' : ''}
          {a.variantsDefined.length > 0 ? `${a.mode === 'individual' ? ' · ' : ''}${a.variantsDefined.length} war.` : ''}
        </div>
      )}
    </div>
  )
}

function TagPills({ items, map, color }: { items: string[]; map: Record<string, string>; color: string }) {
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
      {items.map(t => (
        <span key={t} style={{ fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, color, background: `${color}14`, border: `1px solid ${color}40`, borderRadius: 6, padding: '1px 6px' }}>
          {map[t] || t}
        </span>
      ))}
    </div>
  )
}

function VariantBlock({ a }: { a: ExerciseAnalysis }) {
  const hasVariants = a.variantsDefined.length > 0 || a.variantUsage.length > 0
  if (a.mode !== 'individual' && !hasVariants) return null
  return (
    <div style={{ margin: '7px 0 2px', padding: '7px 9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tryb</span>
        <span style={{ fontFamily: INTER, fontSize: '0.68rem', fontWeight: 700, color: a.mode === 'individual' ? SEM.amber : 'var(--ink)', background: a.mode === 'individual' ? SEM.amberBg : '#fff', border: `1px solid ${a.mode === 'individual' ? '#f0d9ae' : 'var(--border)'}`, borderRadius: 6, padding: '1px 7px' }}>
          {a.mode === 'individual' ? 'indywidualny — analiza z danych zawodniczek' : 'grupowy — analiza z nagłówka'}
        </span>
      </div>
      {hasVariants && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
            Warianty{a.variantUsage.length > 0 ? ' użyte' : ''}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {a.variantUsage.length > 0
              ? a.variantUsage.map(v => (
                <span key={v.variant} style={{ fontFamily: INTER, fontSize: '0.68rem', color: 'var(--ink)', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 7px' }}>
                  {v.variant} <strong>· {v.count} {v.count === 1 ? 'zawodniczka' : 'zawodniczki'}</strong>
                </span>
              ))
              : a.variantsDefined.map(v => (
                <span key={v} style={{ fontFamily: INTER, fontSize: '0.68rem', color: 'var(--muted)', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 7px' }}>
                  {v}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Bodziec per wariant — każdy wariant (i grupa bazowa) jak osobne mini-ćwiczenie,
// z liczbą zawodniczek, które go wykonały. Pokazujemy tylko gdy jest realny podział.
function VariantBreakdownBlock({ rows }: { rows: VariantBreakdown[] }) {
  if (rows.length < 2) return null
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Bodziec per wariant
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: INTER, fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink)' }}>
              {r.dominant && <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLOR[r.dominant] }} />}
              {r.variant ?? 'podstawa (bez wariantu)'}
              <span style={{ fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, color: SEM.amber, background: SEM.amberBg, border: '1px solid #f0d9ae', borderRadius: 5, padding: '0 5px' }}>
                {r.athleteCount} {r.athleteCount === 1 ? 'zawodniczka' : 'zawodniczki'}
              </span>
            </span>
            <span style={{ fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted)' }}>
              {r.dominant ? CATEGORY_SHORT[r.dominant] : (r.isMax ? 'na maksa' : '—')}
              {r.dominant ? ` · ${CHARACTER_LABEL[r.character]}` : ''}
              {r.explosive ? ' · ⚡' : ''}
            </span>
          </div>
          <ProfileBar profile={r.profile} height={6} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 5, fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted)' }}>
            <span>TUT/seria <strong style={{ color: 'var(--ink)' }}>{fmtSeconds(r.tutPerSet)}</strong></span>
            {r.repsPerSet != null && <span>powt./seria <strong style={{ color: 'var(--ink)' }}>{r.repsPerSet % 1 === 0 ? r.repsPerSet : r.repsPerSet.toFixed(1)}</strong></span>}
            <span>powt. całk. <strong style={{ color: 'var(--ink)' }}>{r.totalReps || '—'}</strong></span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Bodziec każdej zawodniczki z osobna (tryb indywidualny) — z jej własnych serii,
// z tagiem wykonanego wariantu.
function AthleteBreakdownBlock({ rows }: { rows: AthleteBreakdown[] }) {
  if (rows.length === 0) return null
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Bodziec per zawodniczka
      </div>
      {rows.map(r => (
        <div key={r.athleteId} style={{ padding: '6px 8px', background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: INTER, fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink)' }}>
              {r.dominant && <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLOR[r.dominant] }} />}
              {r.name}
              {r.variant && (
                <span style={{ fontFamily: INTER, fontSize: '0.6rem', fontWeight: 700, color: SEM.amber, background: SEM.amberBg, border: '1px solid #f0d9ae', borderRadius: 5, padding: '0 5px' }}>
                  {r.variant}
                </span>
              )}
            </span>
            <span style={{ fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted)' }}>
              {r.dominant ? CATEGORY_SHORT[r.dominant] : (r.isMax ? 'na maksa' : '—')}
              {r.dominant ? ` · ${CHARACTER_LABEL[r.character]}` : ''}
              {r.explosive ? ' · ⚡' : ''}
            </span>
          </div>
          <ProfileBar profile={r.profile} height={6} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 5, fontFamily: INTER, fontSize: '0.6rem', color: 'var(--muted)' }}>
            <span>TUT/seria <strong style={{ color: 'var(--ink)' }}>{fmtSeconds(r.tutPerSet)}</strong></span>
            {r.repsPerSet != null && <span>powt./seria <strong style={{ color: 'var(--ink)' }}>{r.repsPerSet % 1 === 0 ? r.repsPerSet : r.repsPerSet.toFixed(1)}</strong></span>}
            <span>powt. całk. <strong style={{ color: 'var(--ink)' }}>{r.totalReps || '—'}</strong></span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ExerciseCard({ a }: { a: ExerciseAnalysis }) {
  const repsLabel = a.repsPerSet != null
    ? `${a.repsPerSet % 1 === 0 ? a.repsPerSet : a.repsPerSet.toFixed(1)} powt.${a.mode === 'individual' ? '/seria (śr.)' : ''}`
    : a.isMax ? 'na maksa' : '—'
  return (
    <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--ink)' }}>{a.name}</span>
        <span style={{ fontFamily: INTER, fontSize: '0.64rem', color: 'var(--muted)' }}>
          {a.mode === 'individual'
            ? `${a.athleteCount} ${a.athleteCount === 1 ? 'zawodniczka' : 'zawodniczek'} · ${repsLabel}`
            : `${a.sets ? `${a.sets} ser. · ` : ''}${repsLabel}${a.perRepSeconds > 0 ? ` · ${a.perRepSeconds}s/powt.` : ''}`}
        </span>
      </div>

      <VariantBlock a={a} />

      {a.dominant ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '8px 0 4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: INTER, fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: CATEGORY_COLOR[a.dominant] }} />
              {CATEGORY_LABEL[a.dominant]}
            </span>
            <span style={{ fontFamily: INTER, fontSize: '0.64rem', color: 'var(--muted)' }}>charakter: <strong style={{ color: 'var(--ink)' }}>{CHARACTER_LABEL[a.character]}</strong></span>
            {a.explosive && <span style={{ fontFamily: INTER, fontSize: '0.62rem', fontWeight: 700, color: SEM.amber, background: SEM.amberBg, borderRadius: 5, padding: '1px 6px' }}>⚡ eksplozywne</span>}
            <span style={{ fontFamily: INTER, fontSize: '0.62rem', fontWeight: 700, color: CONF_COLOR[a.confidence] }}>pewność: {CONFIDENCE_LABEL[a.confidence]}</span>
          </div>

          <ProfileBar profile={a.profile} />
          <CategoryBars profile={a.profile} short />

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontFamily: INTER, fontSize: '0.64rem', color: 'var(--muted)' }}>
            <span>TUT/seria <strong style={{ color: 'var(--ink)' }}>{fmtSeconds(a.tutPerSet)}</strong></span>
            <span>TUT całk. <strong style={{ color: 'var(--ink)' }}>{fmtSeconds(a.totalTut)}</strong></span>
            <span>powt. całk. <strong style={{ color: 'var(--ink)' }}>{a.totalReps || '—'}</strong></span>
          </div>
        </>
      ) : (
        <div style={{ fontFamily: INTER, fontSize: '0.68rem', color: 'var(--muted)', marginTop: 6 }}>
          Bodziec nieokreślony{
            a.mode === 'individual' ? ' — brak danych indywidualnych zawodniczek.'
            : a.isMax ? ' — ćwiczenie „na maksa” (liczba powtórzeń zależy od zawodniczki).'
            : ' — brak liczby powtórzeń.'
          }
        </div>
      )}

      <VariantBreakdownBlock rows={a.variantBreakdown} />
      <AthleteBreakdownBlock rows={a.athleteBreakdown} />

      <TagPills items={a.patterns} map={PATTERN_LABEL} color="var(--navy-900)" />
      <TagPills items={a.characteristics} map={CHAR_LABEL} color={SEM.amber} />
    </div>
  )
}

// Pełna sekcja: profil treningu + analiza każdego ćwiczenia.
export function StimulusSection({ exercises }: { exercises: ExerciseInput[] }) {
  if (exercises.length === 0) return null
  const w = analyzeWorkout(exercises)

  const patternEntries = Object.entries(w.patternShare).sort((a, b) => b[1] - a[1])
  const charEntries = Object.entries(w.characteristicShare).sort((a, b) => b[1] - a[1])

  return (
    <div className="coach-panel" style={{ marginBottom: '0.75rem' }}>
      {/* Profil całego treningu */}
      <div style={{ padding: '1rem', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontFamily: INTER, fontSize: '0.66rem', color: 'var(--muted-light)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>Profil treningu</span>
          {w.dominant && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.92rem', color: 'var(--ink)' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: CATEGORY_COLOR[w.dominant] }} />
              {CATEGORY_LABEL[w.dominant]}
            </span>
          )}
        </div>
        <ProfileBar profile={w.profile} height={12} />
        <CategoryBars profile={w.profile} />
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 4, fontFamily: INTER, fontSize: '0.66rem', color: 'var(--muted)' }}>
          <span>TUT treningu <strong style={{ color: 'var(--ink)' }}>{fmtSeconds(w.totalTut)}</strong></span>
          <span>powt. razem <strong style={{ color: 'var(--ink)' }}>{w.totalReps || '—'}</strong></span>
          <span>ćwiczeń sklasyfikowanych <strong style={{ color: 'var(--ink)' }}>{w.classified}/{w.exercises.length}</strong></span>
        </div>

        {(patternEntries.length > 0 || charEntries.length > 0) && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 10 }}>
            {patternEntries.length > 0 && (
              <div>
                <div style={{ fontFamily: INTER, fontSize: '0.58rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Wzorce ruchu</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {patternEntries.map(([k, v]) => (
                    <span key={k} style={{ fontFamily: INTER, fontSize: '0.62rem', color: 'var(--ink)', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 7px' }}>
                      {PATTERN_LABEL[k] || k} <strong>{pct(v)}%</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {charEntries.length > 0 && (
              <div>
                <div style={{ fontFamily: INTER, fontSize: '0.58rem', color: 'var(--muted-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Charakterystyka</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {charEntries.map(([k, v]) => (
                    <span key={k} style={{ fontFamily: INTER, fontSize: '0.62rem', color: 'var(--ink)', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 7px' }}>
                      {CHAR_LABEL[k] || k} <strong>{pct(v)}%</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Analiza per ćwiczenie */}
      {w.exercises.map((a, i) => <ExerciseCard key={i} a={a} />)}
    </div>
  )
}
