'use client'
// src/components/coach/GroupHero.tsx
// Granatowy nagłówek grupy — nazwa (edytowalna), liczba zawodniczek, skład sztabu
// (trener główny / motoryczny / asystenci), poziom treningu i aktualny plan
// (jeśli przypisany). Używany na wszystkich zakładkach grupy (zorganizowanej i
// samodzielnej).
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from './ui'

type Group = {
  id: number
  name: string
  training_level?: string | null
  trainer_name?: string | null
  head_coach_name?: string | null
  assistant_coaches?: string[] | null
}

interface Props {
  group: Group
  athletesCount: number
  onGroupUpdated?: (updated: any) => void
}

const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.07)', border: `1px solid var(--navy-600)`, borderRadius: 8, color: '#fff', padding: '0.35rem 0.75rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.72rem', outline: 'none', width: '100%' }

export default function GroupHero({ group, athletesCount, onGroupUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [localGroup, setLocalGroup] = useState(group)
  const [assistants, setAssistants] = useState<string[]>(group.assistant_coaches?.length ? group.assistant_coaches : [''])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [currentPlanName, setCurrentPlanName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('athlete_workout_assignments')
      .select('plan:workout_plans(name)')
      .eq('group_id', group.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancelled) setCurrentPlanName(data?.plan?.name ?? null)
      })
    return () => { cancelled = true }
  }, [group.id])

  function cancelEdit() {
    setEditing(false)
    setLocalGroup(group)
    setAssistants(group.assistant_coaches?.length ? group.assistant_coaches : [''])
    setError('')
  }

  async function save() {
    setSaving(true)
    setError('')
    const cleanAssistants = assistants.map(a => a.trim()).filter(Boolean)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('groups')
      .update({
        name: localGroup.name?.trim() || group.name,
        training_level: localGroup.training_level?.trim() || null,
        trainer_name: localGroup.trainer_name?.trim() || null,
        head_coach_name: localGroup.head_coach_name?.trim() || null,
        assistant_coaches: cleanAssistants,
      })
      .eq('id', group.id)
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) {
      setLocalGroup(data)
      setAssistants(data.assistant_coaches?.length ? data.assistant_coaches : [''])
      onGroupUpdated?.(data)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setEditing(false)
  }

  const assistantNames = (localGroup.assistant_coaches || []).filter(Boolean)

  return (
    <div className="coach-group-hero">
      <div className="coach-group-hero-title">
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 360 }}>
            <input
              value={localGroup.name || ''}
              onChange={e => setLocalGroup((g: any) => ({ ...g, name: e.target.value }))}
              placeholder="Nazwa grupy"
              style={{ ...inputStyle, fontSize: '1rem', fontWeight: 800, padding: '0.45rem 0.75rem', background: 'rgba(255,255,255,0.1)' }}
            />
            <input
              value={localGroup.training_level || ''}
              onChange={e => setLocalGroup((g: any) => ({ ...g, training_level: e.target.value }))}
              placeholder="Poziom treningu (np. zaawansowany)"
              style={inputStyle}
            />
            <input
              value={localGroup.head_coach_name || ''}
              onChange={e => setLocalGroup((g: any) => ({ ...g, head_coach_name: e.target.value }))}
              placeholder="Trener główny"
              style={inputStyle}
            />
            <input
              value={localGroup.trainer_name || ''}
              onChange={e => setLocalGroup((g: any) => ({ ...g, trainer_name: e.target.value }))}
              placeholder="Trener motoryczny"
              style={inputStyle}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', color: 'var(--muted-light)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Trenerzy asystenci</div>
              {assistants.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 4 }}>
                  <input
                    value={a}
                    onChange={e => setAssistants(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`Asystent ${i + 1}`}
                    style={inputStyle}
                  />
                  <button onClick={() => setAssistants(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : [''])}
                    style={{ border: `1px solid var(--navy-600)`, background: 'rgba(255,255,255,0.07)', color: 'var(--muted-light)', borderRadius: 8, padding: '0 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={() => setAssistants(prev => [...prev, ''])}
                style={{ alignSelf: 'flex-start', border: `1px dashed var(--navy-600)`, background: 'transparent', color: 'var(--muted-light)', borderRadius: 8, padding: '0.3rem 0.6rem', fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                + Dodaj asystenta
              </button>
            </div>
            {error && <div style={{ fontSize: '0.72rem', color: '#EF4444', fontFamily: 'var(--font-inter),sans-serif' }}>❌ {error}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="gold" size="small" onClick={save} disabled={saving}>
                {saving ? '...' : saved ? '✓ Zapisano' : 'Zapisz'}
              </Button>
              <Button variant="ghost" size="small" onClick={cancelEdit}>
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2>{localGroup.name}</h2>
            <button onClick={() => setEditing(true)}
              style={{ padding: '3px 10px', background: 'var(--navy-700)', color: 'var(--muted-light)', border: `1px solid var(--navy-600)`, borderRadius: 7, fontFamily: 'var(--font-inter),sans-serif', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              ✎ Edytuj
            </button>
          </>
        )}
      </div>
      <div className="coach-group-hero-sub">
        {athletesCount} zawodniczek
        {localGroup.head_coach_name && <><span className="coach-dot-sep">·</span> Trener główny: <b>{localGroup.head_coach_name}</b></>}
        <span className="coach-dot-sep">·</span> Trener motoryczny: <b>{localGroup.trainer_name || 'Urszula Papka'}</b>
        {assistantNames.length > 0 && <><span className="coach-dot-sep">·</span> Asystenci: {assistantNames.join(', ')}</>}
        {localGroup.training_level && <><span className="coach-dot-sep">·</span> {localGroup.training_level}</>}
        {currentPlanName && <><span className="coach-dot-sep">·</span> 📋 {currentPlanName}</>}
      </div>
    </div>
  )
}
