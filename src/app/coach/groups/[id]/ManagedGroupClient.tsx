'use client'
// src/app/coach/groups/[id]/ManagedGroupClient.tsx
// Panel grupy zorganizowanej — trener prowadzi grupę i wpisuje wszystko sam
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { localDateStr, formatDatePl, linkLogsToTraining } from '@/lib/groupTraining'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = { id: number; name: string; group_type?: string }
type Athlete = { id: number; full_name: string; birth_year?: number | null }
type Training = { id: number; group_id: number; training_date: string; created_at: string }

interface Props {
  group: Group
  athletes: Athlete[]
  trainings: Training[]
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>
      {children}
    </div>
  )
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function AddAthleteModal({ group, onClose, onAdded }: { group: Group; onClose: () => void; onAdded: () => void }) {
  const [fullName, setFullName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!fullName.trim()) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/athletes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          birth_year: birthYear || null,
          group_id: group.id,
          password: generatePassword(),
          // bez maila — konto powstaje z mailem technicznym,
          // można później podpiąć prawdziwy mail zawodniczki lub rodzica
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json?.error || `Błąd serwera (${res.status})`); setSaving(false); return }
      onAdded()
      onClose()
    } catch (e: any) {
      setError(`Błąd połączenia: ${e?.message || e}`)
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`,
    borderRadius: 10, background: C.offWhite, color: C.navy,
    fontFamily: sans, fontSize: '0.95rem', outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 440, background: C.white, borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${C.grayLight}` }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{group.name}</div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: C.white }}>Dodaj zawodniczkę</div>
          <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 4 }}>Bez maila — konto tworzy się automatycznie, mail można podpiąć później.</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Imię i nazwisko *</div>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="np. Anna Kowalska" autoFocus style={{ ...inputStyle, marginBottom: '1rem' }} />
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Rok urodzenia</div>
          <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="np. 2014" min={1990} max={2025} style={{ ...inputStyle, marginBottom: '1.1rem' }} />
          {error && <div style={{ color: C.red, fontSize: '0.82rem', marginBottom: '0.75rem' }}>❌ {error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '0.8rem 1.1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700, cursor: 'pointer' }}>
              Anuluj
            </button>
            <button onClick={handleCreate} disabled={saving || !fullName.trim()}
              style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: 12, background: !fullName.trim() ? C.grayLight : C.navy, color: !fullName.trim() ? C.gray : C.gold, fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer' }}>
              {saving ? 'Dodaję...' : 'Dodaj zawodniczkę'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ManagedGroupClient({ group, athletes, trainings }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [addOpen, setAddOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const today = localDateStr()
  const todayTraining = trainings.find(t => t.training_date === today)

  async function handleStartTraining() {
    setStarting(true); setError('')
    if (todayTraining) {
      router.push(`/coach/groups/${group.id}/training/${todayTraining.id}`)
      return
    }
    const { data, error: err } = await supabase
      .from('group_trainings')
      .insert({ group_id: group.id, training_date: today })
      .select()
      .single()
    if (err || !data) {
      setError(err?.message || 'Nie udało się utworzyć treningu')
      setStarting(false)
      return
    }
    // Gotowość i feedback wpisane dziś podpinają się pod ten trening
    await linkLogsToTraining(supabase, athletes.map(a => a.id), data.id, today)
    router.push(`/coach/groups/${group.id}/training/${data.id}`)
  }

  async function handleDeleteTraining(t: Training) {
    if (!confirm(`Usunąć trening z dnia ${t.training_date}? Wszystkie wpisane serie i ciężary z tego treningu zostaną usunięte.`)) return
    setDeletingId(t.id)
    const { error: err } = await supabase.from('group_trainings').delete().eq('id', t.id)
    setDeletingId(null)
    if (err) { setError(err.message); return }
    router.refresh()
  }

  const actionTiles = [
    {
      label: todayTraining ? 'Kontynuuj dzisiejszy trening' : 'Rozpocznij trening',
      desc: 'Tabela: zawodniczki × ćwiczenia — serie, powtórzenia, tempo, ciężar, ból',
      icon: '🏋️',
      onClick: handleStartTraining,
      primary: true,
    },
    {
      label: 'Podsumowanie',
      desc: 'Tabela treningu — ciężary i ból, wybór po dacie',
      icon: '📊',
      onClick: () => router.push(`/coach/groups/${group.id}/summary`),
    },
    {
      label: 'Uzupełnij gotowość treningową',
      desc: 'Zawodniczki podchodzą do tabletu i wypełniają arkusz przed treningiem',
      icon: '✅',
      onClick: () => router.push(`/coach/groups/${group.id}/readiness`),
    },
    {
      label: 'Feedback po treningu',
      desc: 'Zawodniczki wypełniają RPE i samopoczucie po treningu',
      icon: '💬',
      onClick: () => router.push(`/coach/groups/${group.id}/feedback`),
    },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button onClick={() => router.push('/coach/groups')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← Grupy
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '1rem', flexWrap: 'wrap' }}>
              <h1 style={{ color: C.white, fontSize: '1.45rem', fontWeight: 800 }}>{group.name}</h1>
              <span style={{ fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, color: C.navy, background: C.gold, borderRadius: 6, padding: '2px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                zorganizowana
              </span>
            </div>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>
              {athletes.length} zawodniczek · grupa prowadzona przez trenera
            </p>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.86rem', marginBottom: '1rem' }}>
              ❌ {error}
            </div>
          )}

          {/* ── AKCJE ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
            {actionTiles.map(tile => (
              <Card key={tile.label} style={tile.primary ? { border: `2px solid ${C.gold}` } : undefined}>
                <button
                  onClick={tile.onClick}
                  disabled={tile.primary && starting}
                  style={{ width: '100%', background: tile.primary ? C.navy : 'none', border: 'none', padding: '1rem', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}
                >
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{tile.icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: tile.primary ? C.gold : C.navy }}>
                      {tile.primary && starting ? 'Otwieram...' : tile.label}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 3, lineHeight: 1.4 }}>{tile.desc}</div>
                  </div>
                  <span style={{ color: C.gray }}>›</span>
                </button>
              </Card>
            ))}
          </div>

          {/* ── ZAWODNICZKI ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
              Zawodniczki ({athletes.length})
            </div>
            <button onClick={() => setAddOpen(true)} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.5rem 0.9rem', fontWeight: 800, fontSize: '0.8rem' }}>
              ＋ Dodaj
            </button>
          </div>
          <Card style={{ marginBottom: '1.5rem' }}>
            {athletes.length === 0 ? (
              <div style={{ padding: '1.25rem', color: C.gray, fontSize: '0.88rem', textAlign: 'center' }}>
                Brak zawodniczek — dodaj pierwszą przyciskiem „＋ Dodaj”.
              </div>
            ) : (
              athletes.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => router.push(`/coach/athletes/${a.id}`)}
                  style={{ width: '100%', background: 'none', border: 'none', borderTop: i > 0 ? `1.5px solid ${C.grayLight}` : 'none', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.navy }}>{a.full_name}</span>
                    {a.birth_year && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginLeft: 8 }}>{a.birth_year}</span>}
                  </div>
                  <span style={{ color: C.gray }}>›</span>
                </button>
              ))
            )}
          </Card>

          {/* ── HISTORIA TRENINGÓW ── */}
          <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
            Treningi ({trainings.length})
          </div>
          <Card>
            {trainings.length === 0 ? (
              <div style={{ padding: '1.25rem', color: C.gray, fontSize: '0.88rem', textAlign: 'center' }}>
                Jeszcze nie było żadnego treningu. Kliknij „Rozpocznij trening”.
              </div>
            ) : (
              trainings.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', borderTop: i > 0 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                  <button
                    onClick={() => router.push(`/coach/groups/${group.id}/training/${t.id}`)}
                    style={{ flex: 1, background: 'none', border: 'none', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                  >
                    <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 700, color: C.navy }}>{t.training_date}</span>
                    <span style={{ fontSize: '0.78rem', color: C.gray }}>{formatDatePl(t.training_date)}</span>
                    {t.training_date === today && (
                      <span style={{ fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 6, padding: '2px 7px' }}>
                        dziś
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteTraining(t)}
                    disabled={deletingId === t.id}
                    title="Usuń trening"
                    style={{ border: 'none', background: 'none', color: C.gray, padding: '0.8rem', fontSize: '0.85rem' }}
                  >
                    {deletingId === t.id ? '...' : '✕'}
                  </button>
                </div>
              ))
            )}
          </Card>
        </main>
      </div>

      {addOpen && (
        <AddAthleteModal
          group={group}
          onClose={() => setAddOpen(false)}
          onAdded={() => router.refresh()}
        />
      )}
    </>
  )
}
