'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = { id: number; name: string }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem', border: `1.5px solid #E8ECF2`,
  borderRadius: 10, background: C.offWhite, color: C.navy,
  fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.95rem', outline: 'none',
}

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

    const res = await fetch('/api/athletes/create', {
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

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error || 'Nieznany błąd')
      return
    }

    setDone(true)
    setTimeout(() => router.push(`/coach/athletes/${json.athlete.id}`), 1500)
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} body{background:#F4F6F9;}`}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.25rem' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/coach')} style={{ border: `1.5px solid ${C.gold}`, background: 'transparent', color: C.gold, borderRadius: 10, padding: '0.6rem 0.9rem', fontWeight: 800, fontFamily: sans, cursor: 'pointer' }}>
              ← Powrót
            </button>
            <div>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Panel trenera</div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: '1.15rem' }}>Dodaj zawodniczkę</div>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 1rem' }}>
          <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, padding: '1.5rem', boxShadow: '0 4px 20px rgba(13,27,42,0.06)' }}>

            <Field label="Imię i nazwisko *">
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="np. Anna Kowalska"
                style={inputStyle}
                autoFocus
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Rok urodzenia">
                <input
                  type="number"
                  value={birthYear}
                  onChange={e => setBirthYear(e.target.value)}
                  placeholder="np. 2008"
                  min={1990} max={2020}
                  style={inputStyle}
                />
              </Field>
              <Field label="Grupa">
                <select
                  value={groupId}
                  onChange={e => setGroupId(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  <option value="">Bez grupy</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ height: 1, background: C.grayLight, margin: '1.25rem 0' }} />
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: 700 }}>
              Dane do logowania
            </div>

            <Field label="Email *">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="np. anna.kowalska@gmail.com"
                style={inputStyle}
              />
            </Field>

            <Field label="Hasło tymczasowe *">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontFamily: mono }}
                />
                <button
                  onClick={() => setShowPassword(p => !p)}
                  style={{ padding: '0 0.85rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.gray, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  {showPassword ? 'Ukryj' : 'Pokaż'}
                </button>
                <button
                  onClick={() => setPassword(generatePassword())}
                  title="Generuj nowe hasło"
                  style={{ padding: '0 0.85rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.gray, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  ↻
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: C.gray, marginTop: 6 }}>
                Podaj to hasło zawodniczce — będzie mogła je zmienić po pierwszym logowaniu.
              </div>
            </Field>

            {error && (
              <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.86rem', marginBottom: '1rem' }}>
                ❌ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: '0.5rem' }}>
              <button
                onClick={() => router.push('/coach')}
                style={{ padding: '0.875rem 1.1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700, cursor: 'pointer' }}
              >
                Anuluj
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !canSave || done}
                style={{
                  flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12,
                  background: done ? C.green : !canSave ? C.grayLight : C.navy,
                  color: done ? C.white : !canSave ? C.gray : C.gold,
                  fontWeight: 900, fontSize: '0.95rem', cursor: canSave && !saving ? 'pointer' : 'default',
                }}
              >
                {done ? '✓ Konto utworzone!' : saving ? 'Tworzę konto...' : 'Utwórz zawodniczkę'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
