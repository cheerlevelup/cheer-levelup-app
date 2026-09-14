'use client'
// src/components/coach/MoveToGroupModal.tsx
// Modal przenoszenia zawodniczki do innej grupy — plan treningowy zostaje bez zmian.
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Modal, Button } from './ui'

export default function MoveToGroupModal({ athlete, allGroups, onClose, onMoved }: {
  athlete: any; allGroups: any[]; onClose: () => void; onMoved: (newGroup: any) => void
}) {
  const [targetGroupId, setTargetGroupId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleMove() {
    if (!targetGroupId) return
    setSaving(true); setError('')
    const supabase = createClient()
    const groupId = parseInt(targetGroupId)
    const { data, error: err } = await supabase
      .from('athletes')
      .update({ group_id: groupId })
      .eq('id', athlete.id)
      .select('*, group:groups(*)')
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    onMoved(data?.group)
    onClose()
  }

  const others = allGroups.filter(g => g.id !== athlete.group_id)

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Zarządzanie zawodniczką"
      title="Przenieś do innej grupy"
      sub="Plan treningowy pozostanie bez zmian."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleMove} disabled={!targetGroupId || saving}>
            {saving ? 'Przenoszę...' : 'Przenieś'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '45vh', overflowY: 'auto' }}>
        {others.map(g => (
          <div
            key={g.id}
            onClick={() => setTargetGroupId(String(g.id))}
            style={{
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${targetGroupId === String(g.id) ? 'var(--gold)' : 'var(--border)'}`,
              background: targetGroupId === String(g.id) ? 'var(--navy-900)' : '#fff',
              color: targetGroupId === String(g.id) ? 'var(--gold)' : 'var(--ink)',
              fontWeight: 600, fontFamily: 'var(--font-inter),sans-serif', fontSize: 13.5,
            }}
          >
            {g.name}
            {g.group_type === 'managed' && <span style={{ fontSize: 10, marginLeft: 8, textTransform: 'uppercase', letterSpacing: '.05em', opacity: 0.7 }}>zorganizowana</span>}
            {g.training_level && <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7 }}>{g.training_level}</span>}
          </div>
        ))}
        {others.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', fontFamily: 'var(--font-inter),sans-serif' }}>Brak innych grup.</div>}
      </div>
      {error && <div style={{ color: '#c23b3b', fontSize: 12.5, marginTop: 10 }}>Błąd: {error}</div>}
    </Modal>
  )
}
