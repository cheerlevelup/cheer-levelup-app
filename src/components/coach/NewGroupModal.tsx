'use client'
// src/components/coach/NewGroupModal.tsx
// Modal tworzenia nowej grupy (zorganizowanej/samodzielnej) — po utworzeniu
// przenosi od razu do panelu nowej grupy.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Modal, Field, Button } from './ui'

type Group = { sort_order?: number | null }

export default function NewGroupModal({ groups, onClose }: { groups: Group[]; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [groupType, setGroupType] = useState<'self' | 'managed'>('self')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true); setError('')
    const supabase = createClient()
    const maxSort = Math.max(0, ...groups.map(g => g.sort_order ?? 0))
    const { data, error: err } = await supabase
      .from('groups')
      .insert({ name: name.trim(), group_type: groupType, sort_order: maxSort + 1 })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    router.push(`/coach/groups/${data.id}`)
    router.refresh()
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Grupy"
      title="Nowa grupa"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="dark" onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? 'Tworzę...' : 'Utwórz grupę'}
          </Button>
        </>
      }
    >
      <Field label="Nazwa grupy">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="np. Ultra 2" autoFocus />
      </Field>
      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'block', fontSize: 10.5, letterSpacing: '.04em', color: 'var(--muted-light)', fontFamily: 'var(--font-inter),sans-serif', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
          Rodzaj grupy
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            { value: 'self' as const, label: 'Samodzielna', desc: 'Zawodniczki mają własne konta, trenują z planów i same wpisują wyniki.' },
            { value: 'managed' as const, label: 'Zorganizowana', desc: 'Trener prowadzi grupę i wpisuje wszystko sam (np. grupa dzieci). Zawodniczki dodaje się z widoku grupy, bez maila.' },
          ]).map(opt => (
            <div
              key={opt.value}
              onClick={() => setGroupType(opt.value)}
              style={{
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${groupType === opt.value ? 'var(--gold)' : 'var(--border)'}`,
                background: groupType === opt.value ? 'var(--navy-900)' : '#fff',
              }}
            >
              <div style={{ fontWeight: 700, color: groupType === opt.value ? 'var(--gold)' : 'var(--ink)', fontSize: 14 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: groupType === opt.value ? 'var(--muted-light)' : 'var(--muted)', marginTop: 3, lineHeight: 1.4, fontFamily: 'var(--font-inter),sans-serif' }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>
      {error && <div style={{ color: '#c23b3b', fontSize: 12.5, marginTop: 10 }}>Błąd: {error}</div>}
    </Modal>
  )
}
