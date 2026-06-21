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
} from '@/lib/stimulus'

const C = {
  navy: '#0D1B2A', gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

const PATTERN_LABEL: Record<string, string> = {
  squat: 'squat', hinge: 'hinge', push: 'push', pull: 'pull',
  lunge: 'lunge', carry: 'carry', rotation: 'rotacja', locomotion: 'lokomocja',
}
const CHAR_LABEL: Record<string, string> = {
  unilateral: 'unilateralne', bodyweight: 'masa własna',
  eccentric: 'ekscentryczne', isometric: 'izometryczne', plyometric: 'plyometryczne',
}

const CONF_COLOR: Record<Confidence, string> = {
  wysoka: '#15803D', srednia: '#B45309', niska: '#C81E1E',
}

// Pasek profilu — proporcje 5 kategorii w jednej linii.
function ProfileBar({ profile, height = 8 }: { profile: StimulusProfile; height?: number }) {
  const segs = CATEGORY_ORDER.filter(c => profile[c] > 0.005)
  if (segs.length === 0) {
    return <div style={{ height, borderRadius: 999, background: C.grayLight }} />
  }
  return (
    <div style={{ display: 'flex', height, borderRadius: 999, overflow: 'hidden', background: C.grayLight }}>
      {segs.map(c => (
        <div key={c} title={`${CATEGORY_LABEL[c]} ${pct(profile[c])}%`}
          style={{ width: `${profile[c] * 100}%`, background: CATEGORY_COLOR[c] }} />
      ))}
    </div>
  )
}

// Kompaktowy znacznik pod nazwą ćwiczenia (w nagłówku kolumny).
export function StimulusBadge({ ex }: { ex: ExerciseInput }) {
  const a = analyzeWorkout([ex]).exercises[0]
  if (!a.dominant) {
    return (
      <div style={{ marginTop: 5, fontFamily: mono, fontSize: '0.54rem', color: C.gray }}>
        bodziec: nieokreślony{a.isMax ? ' (na maksa)' : ''}
      </div>
    )
  }
  const col = CATEGORY_COLOR[a.dominant]
  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: sans, fontSize: '0.56rem', fontWeight: 700, color: C.navy, background: `${col}22`, border: `1px solid ${col}`, borderRadius: 999, padding: '1px 7px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: col }} />
          {CATEGORY_SHORT[a.dominant]}
        </span>
        <span style={{ fontFamily: mono, fontSize: '0.5rem', color: C.gray }}>{CHARACTER_LABEL[a.character]}</span>
        {a.explosive && <span style={{ fontFamily: mono, fontSize: '0.5rem', fontWeight: 700, color: '#92600A', background: '#FEF6E0', borderRadius: 4, padding: '0 4px' }}>⚡ explo</span>}
      </div>
      <div style={{ marginTop: 4 }}><ProfileBar profile={a.profile} height={5} /></div>
      <div style={{ fontFamily: mono, fontSize: '0.5rem', color: C.gray, marginTop: 3 }}>
        TUT {fmtSeconds(a.tutPerSet)}/seria · pewność {CONFIDENCE_LABEL[a.confidence]}
      </div>
      {(a.mode === 'individual' || a.variantsDefined.length > 0) && (
        <div style={{ fontFamily: mono, fontSize: '0.5rem', fontWeight: 700, color: '#92600A', marginTop: 2 }}>
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
        <span key={t} style={{ fontFamily: mono, fontSize: '0.56rem', fontWeight: 700, color, background: `${color}14`, border: `1px solid ${color}40`, borderRadius: 6, padding: '1px 6px' }}>
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
    <div style={{ margin: '7px 0 2px', padding: '7px 9px', background: C.offWhite, border: `1px solid ${C.grayLight}`, borderRadius: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tryb</span>
        <span style={{ fontFamily: sans, fontSize: '0.66rem', fontWeight: 700, color: a.mode === 'individual' ? '#6B4E0B' : C.navy, background: a.mode === 'individual' ? '#FEF6E0' : C.white, border: `1px solid ${a.mode === 'individual' ? '#F7D27A' : C.grayLight}`, borderRadius: 6, padding: '1px 7px' }}>
          {a.mode === 'individual' ? 'indywidualny — analiza z danych zawodniczek' : 'grupowy — analiza z nagłówka'}
        </span>
      </div>
      {hasVariants && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
            Warianty{a.variantUsage.length > 0 ? ' użyte' : ''}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {a.variantUsage.length > 0
              ? a.variantUsage.map(v => (
                <span key={v.variant} style={{ fontFamily: sans, fontSize: '0.66rem', color: C.navy, background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 6, padding: '1px 7px' }}>
                  {v.variant} <strong>· {v.count} {v.count === 1 ? 'zawodniczka' : 'zawodniczki'}</strong>
                </span>
              ))
              : a.variantsDefined.map(v => (
                <span key={v} style={{ fontFamily: sans, fontSize: '0.66rem', color: C.gray, background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 6, padding: '1px 7px' }}>
                  {v}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExerciseCard({ a }: { a: ExerciseAnalysis }) {
  const repsLabel = a.repsPerSet != null
    ? `${a.repsPerSet % 1 === 0 ? a.repsPerSet : a.repsPerSet.toFixed(1)} powt.${a.mode === 'individual' ? '/seria (śr.)' : ''}`
    : a.isMax ? 'na maksa' : '—'
  return (
    <div style={{ padding: '0.85rem 1rem', borderTop: `1px solid ${C.grayLight}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: C.navy }}>{a.name}</span>
        <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>
          {a.mode === 'individual'
            ? `${a.athleteCount} ${a.athleteCount === 1 ? 'zawodniczka' : 'zawodniczek'} · ${repsLabel}`
            : `${a.sets ? `${a.sets} ser. · ` : ''}${repsLabel}${a.perRepSeconds > 0 ? ` · ${a.perRepSeconds}s/powt.` : ''}`}
        </span>
      </div>

      <VariantBlock a={a} />

      {a.dominant ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '8px 0 4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: sans, fontSize: '0.72rem', fontWeight: 700, color: C.navy }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: CATEGORY_COLOR[a.dominant] }} />
              {CATEGORY_LABEL[a.dominant]}
            </span>
            <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>charakter: <strong style={{ color: C.navy }}>{CHARACTER_LABEL[a.character]}</strong></span>
            {a.explosive && <span style={{ fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, color: '#92600A', background: '#FEF6E0', borderRadius: 5, padding: '1px 6px' }}>⚡ eksplozywne</span>}
            <span style={{ fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, color: CONF_COLOR[a.confidence] }}>pewność: {CONFIDENCE_LABEL[a.confidence]}</span>
          </div>

          <ProfileBar profile={a.profile} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            {CATEGORY_ORDER.filter(c => a.profile[c] > 0.005).map(c => (
              <span key={c} style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: CATEGORY_COLOR[c], marginRight: 4, verticalAlign: 'middle' }} />
                {CATEGORY_SHORT[c]} <strong style={{ color: C.navy }}>{pct(a.profile[c])}%</strong>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>
            <span>TUT/seria <strong style={{ color: C.navy }}>{fmtSeconds(a.tutPerSet)}</strong></span>
            <span>TUT całk. <strong style={{ color: C.navy }}>{fmtSeconds(a.totalTut)}</strong></span>
            <span>powt. całk. <strong style={{ color: C.navy }}>{a.totalReps || '—'}</strong></span>
          </div>
        </>
      ) : (
        <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gray, marginTop: 6 }}>
          Bodziec nieokreślony{
            a.mode === 'individual' ? ' — brak danych indywidualnych zawodniczek.'
            : a.isMax ? ' — ćwiczenie „na maksa” (liczba powtórzeń zależy od zawodniczki).'
            : ' — brak liczby powtórzeń.'
          }
        </div>
      )}

      <TagPills items={a.patterns} map={PATTERN_LABEL} color="#1A2E45" />
      <TagPills items={a.characteristics} map={CHAR_LABEL} color="#6B4E0B" />
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
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', marginBottom: '0.75rem', boxShadow: '0 4px 20px rgba(13,27,42,0.06)' }}>
      {/* Profil całego treningu */}
      <div style={{ padding: '1rem', background: C.offWhite, borderBottom: `1px solid ${C.grayLight}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>Profil treningu</span>
          {w.dominant && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.92rem', color: C.navy }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: CATEGORY_COLOR[w.dominant] }} />
              {CATEGORY_LABEL[w.dominant]}
            </span>
          )}
        </div>
        <ProfileBar profile={w.profile} height={12} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          {CATEGORY_ORDER.filter(c => w.profile[c] > 0.005).map(c => (
            <span key={c} style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLOR[c], marginRight: 5, verticalAlign: 'middle' }} />
              {CATEGORY_LABEL[c]} <strong style={{ color: C.navy }}>{pct(w.profile[c])}%</strong>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontFamily: mono, fontSize: '0.64rem', color: C.gray }}>
          <span>TUT treningu <strong style={{ color: C.navy }}>{fmtSeconds(w.totalTut)}</strong></span>
          <span>powt. razem <strong style={{ color: C.navy }}>{w.totalReps || '—'}</strong></span>
          <span>ćwiczeń sklasyfikowanych <strong style={{ color: C.navy }}>{w.classified}/{w.exercises.length}</strong></span>
        </div>

        {(patternEntries.length > 0 || charEntries.length > 0) && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 10 }}>
            {patternEntries.length > 0 && (
              <div>
                <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Wzorce ruchu</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {patternEntries.map(([k, v]) => (
                    <span key={k} style={{ fontFamily: mono, fontSize: '0.6rem', color: C.navy, background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 6, padding: '1px 7px' }}>
                      {PATTERN_LABEL[k] || k} <strong>{pct(v)}%</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {charEntries.length > 0 && (
              <div>
                <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Charakterystyka</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {charEntries.map(([k, v]) => (
                    <span key={k} style={{ fontFamily: mono, fontSize: '0.6rem', color: C.navy, background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 6, padding: '1px 7px' }}>
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
