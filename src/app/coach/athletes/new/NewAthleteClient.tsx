'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Card, Field, FieldGrid, Button } from '@/components/coach/ui'

type Group = { id: number; name: string }

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function NewAthleteClient({ groups }: { groups: Group[] }) {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [birthYear, setBirthYear] = useState('')
  const [groupId, setGroupId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const canSave = fullName.trim().length > 0 && email.includes('@') && password.length >= 6

  async function handleCreate() {
    if (!canSave) return
    setSaving(true)
    setError('')

    let res: Response
    let json: any = {}

    try {
      res = await fetch('/api/athletes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          birth_year: birthYear || null,
          group_id: groupId || null,
        }),
      })
      const text = await res.text()
      if (text) json = JSON.parse(text)
    } catch (e: any) {
      setSaving(false)
      setError(`Błąd połączenia: ${e?.message || e}`)
      return
    }

    setSaving(false)

    if (!res!.ok) {
      setError(json?.error || `Błąd serwera (${res!.status})`)
      return
    }

    setDone(true)
    setTimeout(() => router.push(`/coach/athletes/${json.athlete.id}`), 1500)
  }

  return (
    <>
      <SetPageMeta title="Dodaj zawodniczkę" backHref="/coach/groups" backLabel="Grupy" />
      <div className="coach-content" style={{ maxWidth: 560 }}>
        <Card>
          <div style={{ padding: '1.25rem' }}>
            <Field label="Imię i nazwisko *" full>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="np. Anna Kowalska"
                autoFocus
              />
            </Field>

            <FieldGrid>
              <Field label="Rok urodzenia">
                <input
                  type="number"
                  value={birthYear}
                  onChange={e => setBirthYear(e.target.value)}
                  placeholder="np. 2008"
                  min={1990} max={2020}
                />
              </Field>
              <Field label="Grupa">
                <select value={groupId} onChange={e => setGroupId(e.target.value)}>
                  <option value="">Bez grupy</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
            </FieldGrid>

            <div style={{ height: 1, background: 'var(--border)', margin: '1.25rem 0' }} />
            <div style={{
              fontFamily: 'var(--font-inter),sans-serif', fontSize: 10.5, color: 'var(--muted-light)',
              letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: 700,
            }}>
              Dane do logowania
            </div>

            <Field label="Email *" full>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="np. anna.kowalska@gmail.com"
              />
            </Field>

            <Field label="Hasło tymczasowe *" full>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
                <Button type="button" variant="ghost" onClick={() => setShowPassword(p => !p)} style={{ flexShrink: 0 }}>
                  {showPassword ? 'Ukryj' : 'Pokaż'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPassword(generatePassword())} title="Generuj nowe hasło" style={{ flexShrink: 0 }}>
                  ↻
                </Button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, fontFamily: 'var(--font-inter),sans-serif' }}>
                Podaj to hasło zawodniczce — będzie mogła je zmienić po pierwszym logowaniu.
              </div>
            </Field>

            {error && (
              <div style={{ padding: '0.75rem', background: '#fdecec', border: '1.5px solid #c23b3b', borderRadius: 10, color: '#c23b3b', fontWeight: 700, fontSize: 13.5, marginBottom: '1rem' }}>
                Błąd: {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: '0.5rem' }}>
              <Button variant="ghost" onClick={() => router.push('/coach')}>Anuluj</Button>
              <Button
                variant={done ? 'default' : 'dark'}
                onClick={handleCreate}
                disabled={saving || !canSave || done}
                style={{ flex: 1, ...(done ? { background: '#1f9d64', color: '#fff' } : {}) }}
              >
                {done ? '✓ Konto utworzone!' : saving ? 'Tworzę konto...' : 'Utwórz zawodniczkę'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
