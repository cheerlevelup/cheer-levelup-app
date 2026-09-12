'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

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
  { id: 'rpe',           label: 'RPE — ciężkość treningu', desc: 'Skala wysiłku 1–10',                 emoji: '📊' },
  { id: 'feeling_after', label: 'Samopoczucie po treningu',desc: 'Jak się czuje po treningu',          emoji: '🤩' },
  { id: 'what_went_well',label: 'Co poszło dobrze',        desc: 'Pozytywny feedback',                 emoji: '✅' },
  { id: 'pain_comment',  label: 'Ból / dyskomfort',        desc: 'Opis bólu po treningu',              emoji: '🩹' },
  { id: 'general_notes', label: 'Uwagi dla trenera',       desc: 'Pytania, komentarze',                emoji: '💬' },
  { id: 'goal',          label: 'Realizacja planu',        desc: 'Czy wykonała założony plan',         emoji: '🎯' },
]

const QUICK_PRESETS = [
  { label: 'Minimalne',    pre: ['sleep_hours', 'energy', 'readiness'], post: ['rpe', 'feeling_after'] },
  { label: 'Standardowe', pre: ['sleep_hours', 'sleep_quality', 'energy', 'stress', 'readiness', 'muscle_soreness'], post: ['rpe', 'feeling_after', 'what_went_well', 'pain_comment', 'general_notes'] },
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

  return (
    <div className="coach-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="coach-modal-box" style={{ maxWidth: 640 }}>

        {/* Header */}
        <div className="coach-modal-head">
          <div className="coach-eyebrow">Konfiguracja planu</div>
          <h3>📋 Feedback treningowy — wybierz pola</h3>
          <p>Wybierz które pola będą wyświetlane zawodniczce — przed i po treningu.</p>
          <button className="coach-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="coach-modal-tabs">
          {(['pre', 'post'] as const).map(t => (
            <button key={t} className={`coach-modal-tab ${tab === t ? 'coach-active' : ''}`} onClick={() => setTab(t)}>
              {t === 'pre' ? `🩺 Gotowość do treningu (${pre.length})` : `🏁 Feedback po treningu (${post.length})`}
            </button>
          ))}
        </div>

        {/* Param list */}
        <div className="coach-modal-body">
          {catalog.map(param => {
            const on = active.includes(param.id)
            return (
              <div key={param.id} className={`coach-fb-item ${on ? 'coach-checked' : ''}`} onClick={() => toggle(active, setActive, param.id)}>
                <span className="coach-fb-emoji">{param.emoji}</span>
                <div>
                  <div className="coach-fb-item-title">{param.label}</div>
                  <div className="coach-fb-item-sub">{param.desc}</div>
                </div>
                <div className="coach-fb-toggle">
                  {on && <Check size={10} />}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="coach-modal-foot">
          <div className="coach-modal-foot-info">Przed: {pre.length} param. · Po: {post.length} param.</div>
          <div className="coach-modal-foot-actions">
            <button className="coach-btn coach-btn-ghost" onClick={onClose}>Anuluj</button>
            <button className="coach-btn coach-btn-dark" onClick={handleSave} disabled={saving} style={{ minWidth: 100 }}>
              {saving ? 'Zapisuję...' : saved ? '✓ Zapisano' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
