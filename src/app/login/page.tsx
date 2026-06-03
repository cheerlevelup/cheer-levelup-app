'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const C = {
  navy: '#0D1B2A',
  navyLight: '#1A2E45',
  navyBorder: '#243652',
  gold: '#F5C842',
  white: '#FFFFFF',
  offWhite: '#F4F6F9',
  gray: '#8A9BB0',
  grayLight: '#E8ECF2',
  red: '#EF4444',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) {
      setError('Wpisz email i haslo.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      setError('Nieprawidlowy email lub haslo.')
      setLoading(false)
      return
    }

    window.location.replace('/athlete')
  }

  return (
    <main style={{ fontFamily: sans, background: C.offWhite, minHeight: '100vh', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
      `}</style>

      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minHeight: '100vh' }}>
        <div style={{ background: C.navy, color: C.white, padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '2.5rem' }}>
              <img src="/level up.jpg" alt="Level Up" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.navyBorder}`, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 1, background: C.navyBorder }} />
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>powered by</div>
              <div style={{ flex: 1, height: 1, background: C.navyBorder }} />
              <img src="/unique.png" alt="Unique" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'contain', border: `2px solid ${C.navyBorder}`, background: C.white, padding: 2, flexShrink: 0 }} />
            </div>

            <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>Cheer LevelUP</div>
              <h1 style={{ fontSize: '2.25rem', lineHeight: 1, fontWeight: 800, color: C.white }}>Witaj z powrotem</h1>
              <p style={{ color: C.gray, fontSize: '0.9rem', marginTop: 10 }}>Zaloguj sie do panelu treningowego.</p>
            </div>

            <div style={{ background: C.white, borderRadius: 16, padding: '1rem', border: `1.5px solid ${C.grayLight}` }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: mono, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.gray, marginBottom: 7 }}>Email</div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="twoj@email.pl"
                  style={{ width: '100%', height: 52, padding: '0 14px', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, fontSize: 15, fontFamily: sans, background: C.offWhite, outline: 'none', color: C.navy }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: mono, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.gray, marginBottom: 7 }}>Haslo</div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="........"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    style={{ width: '100%', height: 52, padding: '0 72px 0 14px', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, fontSize: 15, fontFamily: sans, background: C.offWhite, outline: 'none', color: C.navy }}
                  />
                  <button
                    onClick={() => setShowPassword(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.gray, fontFamily: mono, fontSize: '0.7rem', fontWeight: 700 }}
                  >
                    {showPassword ? 'ukryj' : 'pokaz'}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ fontSize: '0.84rem', color: C.red, marginBottom: 12, padding: '0.75rem', background: '#FEF2F2', borderRadius: 10, border: '1.5px solid #FECACA' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                style={{ width: '100%', padding: '0.95rem', background: loading ? C.gray : C.navy, color: loading ? C.white : C.gold, border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 800 }}
              >
                {loading ? 'Logowanie...' : 'Zaloguj sie'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
