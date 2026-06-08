'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', gold: '#F5C842',
  white: '#FFFFFF', offWhite: '#F4F6F9', gray: '#8A9BB0',
  grayLight: '#E8ECF2', red: '#EF4444', green: '#22C55E',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

// ─── Katalog parametrów ───────────────────────────────────────────────────────

type Param = { id: string; label: string; desc: string; emoji: string }

const PRE_CATALOG: Param[] = [
  { id: 'sleep_hours',   label: 'Godziny snu',           desc: 'Ile godzin spała',                     emoji: '🌙' },
  { id: 'sleep_quality', label: 'Jakość snu',             desc: 'Skala 1–10',                           emoji: '😴' },
  { id: 'energy',        label: 'Poziom energii',         desc: 'Skala 1–10',                           emoji: '⚡' },
  { id: 'stress',        label: 'Stres',                  desc: 'Skala 1–10',                           emoji: '🧠' },
  { id: 'mood',          label: 'Nastrój',                desc: 'Skala 1–10',                           emoji: '😊' },
  { id: 'readiness',     label: 'Gotowość do treningu',   desc: 'Skala 1–10',                           emoji: '💪' },
  { id: 'muscle_soreness', label: 'Zakwasy',              desc: 'Ból mięśni po poprzednim treningu',    emoji: '🔥' },
  { id: 'body_weight',   label: 'Masa ciała',             desc: 'Waga w kg',                            emoji: '⚖️' },
  { id: 'cycle',         label: 'Faza cyklu',             desc: 'Faza menstruacyjna',                   emoji: '🌸' },
  { id: 'motivation_pre', label: 'Motywacja przed',       desc: 'Chęć do treningu przed wejściem',      emoji: '🎯' },
]

const POST_CATALOG: Param[] = [
  { id: 'activity_type', label: 'Typ aktywności',         desc: 'Rest / trening / inne',                emoji: '🏃' },
  { id: 'motivation',    label: 'Motywacja',              desc: 'Chęć do treningu przed',               emoji: '🎯' },
  { id: 'rpe',           label: 'RPE (intensywność)',     desc: 'Skala wysiłku 1–10',                   emoji: '📊' },
  { id: 'feeling_after', label: 'Samopoczucie po',        desc: 'Jak się czuje po treningu',            emoji: '🤩' },
  { id: 'goal',          label: 'Realizacja celu',        desc: 'Czy wykonała plan',                    emoji: '✅' },
  { id: 'recovery_score',label: 'Regeneracja',            desc: 'Ocena regeneracji 1–10',               emoji: '🔋' },
  { id: 'pain_during',   label: 'Ból podczas treningu',   desc: 'Skala 0–10',                           emoji: '🩹' },
  { id: 'menstrual_pain',label: 'Ból menstruacyjny',      desc: 'Skala 0–10',                           emoji: '🌹' },
  { id: 'headache',      label: 'Ból głowy',              desc: 'Skala 0–10',                           emoji: '🤕' },
  { id: 'stomachache',   label: 'Dolegliwości żołądkowe', desc: 'Skala 0–10',                           emoji: '😣' },
  { id: 'joint_stiffness',label: 'Sztywność stawów',      desc: 'Odczuwalna sztywność',                 emoji: '🦴' },
  { id: 'anxiety',       label: 'Lęk / niepokój',         desc: 'Poziom 0–10',                          emoji: '😰' },
  { id: 'mental_overload',label: 'Przeciążenie mentalne', desc: 'Poziom 0–10',                          emoji: '🧩' },
  { id: 'supplements',   label: 'Suplementy',             desc: 'Co i ile wzięła',                      emoji: '💊' },
  { id: 'notes',         label: 'Notatki / uwagi',        desc: 'Wolny tekst',                          emoji: '📝' },
]

const QUICK_PRESETS = [
  { label: 'Minimalne',    pre: ['sleep_hours', 'energy', 'readiness'], post: ['rpe', 'feeling_after'] },
  { label: 'Standardowe', pre: ['sleep_hours', 'sleep_quality', 'energy', 'stress', 'readiness', 'muscle_soreness'], post: ['motivation', 'rpe', 'feeling_after', 'goal', 'recovery_score', 'notes'] },
  { label: 'Rozszerzone', pre: PRE_CATALOG.map(p => p.id), post: POST_CATALOG.map(p => p.id) },
  { label: 'Wyczyść',     pre: [], post: [] },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  planId: number
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanWellnessConfig({ planId, onClose }: Props) {
  const supabase = createClient()
  const [pre, setPre] = useState<string[]>([])
  const [post, setPost] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'pre' | 'post'>('pre')

  useEffect(() => {
    supabase.from('plan_wellness_config').select('*').eq('plan_id', planId).maybeSingle()
      .then(({ data }) => {
        if (data) { setPre(data.pre_params || []); setPost(data.post_params || []) }
        else { setPre([]); setPost([]) }
        setLoading(false)
      })
  }, [planId])

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setSaved(false)
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('plan_wellness_config').upsert(
      { plan_id: planId, pre_params: pre, post_params: post, updated_at: new Date().toISOString() },
      { onConflict: 'plan_id' }
    )
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function applyPreset(p: typeof QUICK_PRESETS[0]) {
    setPre(p.pre); setPost(p.post); setSaved(false)
  }

  const catalog = tab === 'pre' ? PRE_CATALOG : POST_CATALOG
  const active   = tab === 'pre' ? pre : post
  const setActive = tab === 'pre' ? setPre : setPost

  if (loading) return null

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(13,27,42,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', fontFamily: sans,
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 640, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: C.navy, padding: '1rem 1.25rem', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Konfiguracja planu</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: C.white, fontWeight: 800, fontSize: '1.1rem' }}>🩺 Gotowość do treningu — wybierz pola</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: C.gray, fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <p style={{ color: C.gray, fontSize: '0.78rem', marginTop: 4 }}>
            Wybierz które pola będą wyświetlane zawodniczce — przed i po treningu.
          </p>
        </div>

        {/* Quick presets */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Szybkie ustawienia</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)} style={{
                borderRadius: 8, border: `1.5px solid ${C.grayLight}`,
                background: C.offWhite, color: C.navy,
                padding: '0.35rem 0.7rem', fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
          {(['pre', 'post'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '0.75rem', border: 'none',
              background: tab === t ? C.white : C.offWhite,
              color: tab === t ? C.navy : C.gray,
              fontWeight: tab === t ? 800 : 600,
              fontFamily: mono, fontSize: '0.72rem',
              borderBottom: tab === t ? `2px solid ${C.gold}` : '2px solid transparent',
              cursor: 'pointer',
            }}>
              {t === 'pre' ? `🌅 Przed treningiem (${pre.length})` : `🏁 Po treningu (${post.length})`}
            </button>
          ))}
        </div>

        {/* Param list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {catalog.map(param => {
              const on = active.includes(param.id)
              return (
                <button key={param.id} onClick={() => toggle(active, setActive, param.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr auto',
                    alignItems: 'center', gap: 10,
                    padding: '0.65rem 0.875rem', borderRadius: 10,
                    border: `1.5px solid ${on ? C.gold : C.grayLight}`,
                    background: on ? `${C.navy}08` : C.offWhite,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}>
                  <span style={{ fontSize: '1.25rem', textAlign: 'center' }}>{param.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: C.navy }}>{param.label}</div>
                    <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 1 }}>{param.desc}</div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: on ? C.gold : C.grayLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {on && <span style={{ fontSize: '0.75rem', color: C.navy, fontWeight: 900 }}>✓</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, flex: 1 }}>
            Przed: {pre.length} param. · Po: {post.length} param.
          </div>
          <button onClick={onClose} style={{ padding: '0.65rem 1rem', borderRadius: 9, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, fontWeight: 700, cursor: 'pointer' }}>
            Anuluj
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '0.65rem 1.25rem', borderRadius: 9, border: 'none',
            background: saved ? C.green : C.navy,
            color: saved ? C.white : C.gold,
            fontWeight: 800, cursor: 'pointer', minWidth: 100,
            transition: 'background 0.2s',
          }}>
            {saving ? 'Zapisuję...' : saved ? '✓ Zapisano' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  )
}
