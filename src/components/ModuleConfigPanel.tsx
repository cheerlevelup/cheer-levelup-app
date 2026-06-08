'use client'

/**
 * ModuleConfigPanel — konfiguracja wellness / diety dla grupy lub zawodniczki.
 * Działa na tabeli group_module_config (group_id XOR athlete_id, module).
 */

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

// ─── Katalogi ─────────────────────────────────────────────────────────────────

type Param = { id: string; label: string; desc: string; emoji: string }

const WELLNESS_DAILY: Param[] = [
  { id: 'sleep_hours',    label: 'Godziny snu',         desc: 'Ile godzin spała',                  emoji: '🌙' },
  { id: 'sleep_quality',  label: 'Jakość snu',           desc: 'Skala 1–10',                        emoji: '😴' },
  { id: 'readiness',      label: 'Poziom wypoczęcia',    desc: 'Skala 0–10',                        emoji: '💪' },
  { id: 'energy',         label: 'Poziom energii',       desc: 'Skala 0–10',                        emoji: '⚡' },
  { id: 'stress',         label: 'Obciążenie stresem',   desc: 'Skala 0–10',                        emoji: '🧠' },
  { id: 'muscle_soreness',label: 'Zakwasy',              desc: 'Ból mięśni po poprzednim',          emoji: '🔥' },
  { id: 'body_weight',    label: 'Masa ciała',           desc: 'Waga w kg',                         emoji: '⚖️' },
  { id: 'hydration',      label: 'Nawodnienie',          desc: 'Szklanki wody',                     emoji: '💧' },
  { id: 'resting_hr',     label: 'Tętno spoczynkowe',   desc: 'HR w spoczynku (bpm)',               emoji: '❤️' },
  { id: 'cycle',          label: 'Faza cyklu',           desc: 'Faza menstruacyjna',                emoji: '🌸' },
  { id: 'recovery_score', label: 'Regeneracja',          desc: 'Po ostatnim treningu',              emoji: '🔋' },
  { id: 'sitting_hours',  label: 'Godziny siedzenia',   desc: 'Czas siedzący',                     emoji: '🪑' },
  { id: 'activity',       label: 'Aktywność dnia',       desc: 'Typ, czas, opis i odczucia',        emoji: '🏃' },
  { id: 'pain_during',    label: 'Ból / dyskomfort',     desc: 'Skala 0–10 i opis',                 emoji: '🩹' },
  { id: 'menstrual_pain', label: 'Ból menstruacyjny',    desc: 'Skala 0–10',                        emoji: '🌹' },
  { id: 'headache',       label: 'Ból głowy',            desc: 'Skala 0–10',                        emoji: '🤕' },
  { id: 'stomachache',    label: 'Dolegliwości żołądkowe',desc: 'Skala 0–10',                       emoji: '😣' },
  { id: 'joint_stiffness',label: 'Sztywność stawów',     desc: 'Odczuwalna sztywność',              emoji: '🦴' },
  { id: 'anxiety',        label: 'Lęk / niepokój',       desc: 'Poziom 0–10',                       emoji: '😰' },
  { id: 'mental_overload',label: 'Przeciążenie mentalne',desc: 'Poziom 0–10',                       emoji: '🧩' },
  { id: 'supplements',    label: 'Suplementy',           desc: 'Co i ile wzięła',                   emoji: '💊' },
  { id: 'notes',          label: 'Notatki / uwagi',      desc: 'Wolny tekst',                       emoji: '📝' },
]

const DIET_PARAMS: Param[] = [
  { id: 'meal_count',     label: 'Liczba posiłków',      desc: 'Ile posiłków w ciągu dnia',         emoji: '🍽️' },
  { id: 'had_breakfast',  label: 'Śniadanie',            desc: 'Czy zjadła śniadanie',              emoji: '🌅' },
  { id: 'hunger_level',   label: 'Poziom głodu',         desc: 'Skala 1–10',                        emoji: '🔢' },
  { id: 'meals_log',      label: 'Dziennik posiłków',    desc: 'Co jadła (szczegółowy)',             emoji: '📖' },
  { id: 'water_ml',       label: 'Woda (ml)',            desc: 'Ilość wypitej wody',                emoji: '💧' },
  { id: 'coffee',         label: 'Kawa',                 desc: 'Ilość i pora picia',                emoji: '☕' },
  { id: 'other_drinks',   label: 'Inne napoje',          desc: 'Soki, herbaty, energetyki',         emoji: '🥤' },
]

const WELLNESS_PRESETS = [
  { label: 'Minimalne',    pre: ['sleep_hours', 'sleep_quality', 'readiness', 'energy', 'stress'], post: [] },
  { label: 'Standardowe', pre: ['sleep_hours', 'sleep_quality', 'readiness', 'energy', 'stress', 'muscle_soreness', 'hydration', 'recovery_score'], post: [] },
  { label: 'Pełne',       pre: WELLNESS_DAILY.map(p => p.id), post: [] },
  { label: 'Wyczyść',     pre: [], post: [] },
]

const DIET_PRESETS = [
  { label: 'Podstawowe', pre: ['had_breakfast', 'meal_count', 'water_ml'], post: [] },
  { label: 'Standardowe', pre: DIET_PARAMS.map(p => p.id), post: [] },
  { label: 'Wyczyść',    pre: [], post: [] },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** ID grupy LUB zawodniczki */
  groupId?: number
  athleteId?: number
  module: 'wellness' | 'diet'
  /** Jeśli athleteId — pokaż inherited config z grupy jako podpowiedź */
  groupConfig?: { enabled: boolean; pre: string[]; post: string[] } | null
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModuleConfigPanel({ groupId, athleteId, module, groupConfig, onClose }: Props) {
  const supabase = createClient()
  const isAthlete = !!athleteId

  const [enabled, setEnabled] = useState(true)
  const [pre, setPre] = useState<string[]>([])
  const [post, setPost] = useState<string[]>([])
  const [tab, setTab] = useState<'pre' | 'post'>('pre')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const isDiet = module === 'diet'
  const preCatalog  = isDiet ? DIET_PARAMS : WELLNESS_DAILY
  const postCatalog: Param[] = []
  const presets     = isDiet ? DIET_PRESETS : WELLNESS_PRESETS
  const moduleLabel = isDiet ? '🥗 Dieta' : '🩺 Wellness'

  useEffect(() => {
    const query = supabase.from('group_module_config').select('*').eq('module', module)
    if (groupId)   query.eq('group_id', groupId)
    if (athleteId) query.eq('athlete_id', athleteId)

    query.maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(data.enabled ?? true)
        setPre(data.pre_params || [])
        setPost(isDiet ? (data.post_params || []) : [])
      } else if (groupConfig) {
        // inherit from group as default
        setEnabled(groupConfig.enabled)
        setPre(groupConfig.pre)
        setPost(isDiet ? groupConfig.post : [])
      }
      setLoading(false)
    })
  }, [groupId, athleteId, module])

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setSaved(false)
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  function applyPreset(p: { label: string; pre: string[]; post: string[] }) {
    setPre(p.pre); setPost(isDiet ? p.post : []); setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const payload: any = {
      module, enabled, pre_params: pre, post_params: isDiet ? post : [],
      updated_at: new Date().toISOString(),
    }
    if (groupId)   payload.group_id   = groupId
    if (athleteId) payload.athlete_id = athleteId

    const conflictCol = groupId ? 'group_id,module' : 'athlete_id,module'
    const { error: saveError } = await supabase.from('group_module_config').upsert(payload, { onConflict: conflictCol })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  const catalog = tab === 'pre' ? preCatalog : postCatalog
  const active   = tab === 'pre' ? pre : post
  const setActive = tab === 'pre' ? setPre : setPost

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(13,27,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 620, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: C.navy, padding: '1rem 1.25rem', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {isAthlete ? 'Zawodniczka' : 'Grupa'} · {moduleLabel}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: C.white, fontWeight: 800, fontSize: '1.05rem' }}>
              Konfiguracja {isDiet ? 'diety' : 'wellness'}
            </h2>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: C.gray, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
          </div>
          {isAthlete && groupConfig && (
            <p style={{ color: C.gray, fontSize: '0.75rem', marginTop: 4 }}>
              Ustawienia zawodniczki nadpisują konfigurację grupy.
            </p>
          )}
        </div>

        {/* Enable toggle */}
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.navy }}>
              {enabled ? `✅ ${isDiet ? 'Dieta' : 'Monitoring wellness'} włączone` : `🚫 ${isDiet ? 'Dieta' : 'Monitoring wellness'} wyłączone`}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 2 }}>
              {enabled ? 'Zawodniczka widzi i uzupełnia formularz' : 'Arkusz ukryty — zawodniczka nie ma dostępu'}
            </div>
          </div>
          <button onClick={() => { setEnabled(v => !v); setSaved(false) }} style={{
            padding: '0.5rem 1rem', borderRadius: 9, border: 'none',
            background: enabled ? C.green : C.red, color: C.white,
            fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
          }}>
            {enabled ? 'Wyłącz' : 'Włącz'}
          </button>
        </div>
        {error && (
          <div style={{ padding: '0.65rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, background: '#FEF2F2', color: C.red, fontSize: '0.78rem', fontWeight: 700 }}>
            Błąd zapisu: {error}
          </div>
        )}

        {enabled && (
          <>
            {/* Presets */}
            <div style={{ padding: '0.65rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
              <div style={{ fontFamily: mono, fontSize: '0.58rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Szybkie ustawienia</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {presets.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p)} style={{ borderRadius: 8, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, padding: '0.3rem 0.65rem', fontFamily: mono, fontSize: '0.63rem', fontWeight: 700, cursor: 'pointer' }}>
                    {p.label}
                  </button>
                ))}
                {isAthlete && groupConfig && (
                  <button onClick={() => { setPre(groupConfig.pre); setPost(isDiet ? groupConfig.post : []); setSaved(false) }}
                    style={{ borderRadius: 8, border: `1.5px solid ${C.gold}`, background: `${C.navy}10`, color: C.navy, padding: '0.3rem 0.65rem', fontFamily: mono, fontSize: '0.63rem', fontWeight: 700, cursor: 'pointer' }}>
                    ↩ Jak grupa
                  </button>
                )}
              </div>
            </div>

            {(isDiet || module === 'wellness') && (
              <div style={{ padding: '0.5rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, flexShrink: 0 }}>
                <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray }}>
                  {isDiet ? `${pre.length} parametrów aktywnych` : `${pre.length} pól dziennego wellness`}
                </span>
              </div>
            )}

            {/* Param list */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0.65rem 1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {catalog.map(param => {
                  const on = active.includes(param.id)
                  const inheritedOn = groupConfig?.pre.includes(param.id)
                  return (
                    <button key={param.id} onClick={() => toggle(active, setActive, param.id)} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'center', gap: 10, padding: '0.55rem 0.75rem', borderRadius: 10, border: `1.5px solid ${on ? C.gold : C.grayLight}`, background: on ? `${C.navy}08` : C.offWhite, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <span style={{ fontSize: '1.1rem', textAlign: 'center' }}>{param.emoji}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: C.navy }}>{param.label}</span>
                          {isAthlete && inheritedOn !== undefined && (
                            <span style={{ fontFamily: mono, fontSize: '0.55rem', color: inheritedOn ? C.green : C.gray, background: inheritedOn ? '#F0FDF4' : C.offWhite, padding: '1px 5px', borderRadius: 4 }}>
                              {inheritedOn ? 'w grupie ✓' : 'brak w grupie'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, marginTop: 1 }}>{param.desc}</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: on ? C.gold : C.grayLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {on && <span style={{ fontSize: '0.7rem', color: C.navy, fontWeight: 900 }}>✓</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: `1.5px solid ${C.grayLight}`, display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, flex: 1 }}>
            {enabled ? (isDiet ? `${pre.length} param.` : `${pre.length} pól dziennego wellness`) : 'Arkusz wyłączony'}
          </div>
          <button onClick={onClose} style={{ padding: '0.6rem 0.875rem', borderRadius: 9, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, fontWeight: 700, cursor: 'pointer' }}>Anuluj</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.6rem 1.1rem', borderRadius: 9, border: 'none', background: saved ? C.green : C.navy, color: saved ? C.white : C.gold, fontWeight: 800, cursor: 'pointer', minWidth: 90 }}>
            {saving ? 'Zapisuję...' : saved ? '✓ Zapisano' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  )
}
