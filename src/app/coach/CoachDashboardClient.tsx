'use client'
// src/app/coach/CoachDashboardClient.tsx

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = {
  navy: '#0D1B2A',
  navyLight: '#1A2E45',
  navyBorder: '#243652',
  gold: '#F5C842',
  white: '#FFFFFF',
  offWhite: '#F4F6F9',
  gray: '#8A9BB0',
  grayLight: '#E8ECF2',
  green: '#22C55E',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type CoachGroup = {
  id: number
  name: string
}

type CoachAthlete = {
  id: number
  group_id?: number | null
}

type RecentSession = {
  id: number
  athlete_id: number
  date_completed?: string | null
  report_sent?: boolean | null
  athlete?: { full_name?: string | null } | null
  workout_day?: { day_name?: string | null } | null
}

interface Props {
  groups: CoachGroup[]
  athletes: CoachAthlete[]
  recentSessions: RecentSession[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${C.grayLight}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(13,27,42,0.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function StatCard({ label, value, hint, tone = 'navy' }: { label: string; value: string | number; hint: string; tone?: 'navy' | 'gold' | 'green' }) {
  const color = tone === 'gold' ? C.gold : tone === 'green' ? C.green : C.navy
  return (
    <Card>
      <div style={{ padding: '0.875rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
        <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ color: C.gray, fontSize: '0.76rem', marginTop: 5 }}>{hint}</div>
      </div>
    </Card>
  )
}

export default function CoachDashboardClient({ groups, athletes, recentSessions }: Props) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

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
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/level up.jpg" alt="Level Up" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.navyBorder}` }} />
                <div>
                  <div style={{ fontFamily: mono, fontWeight: 800, fontSize: '0.78rem', color: C.gold, letterSpacing: '0.08em' }}>CHEER LEVELUP</div>
                  <div style={{ color: C.white, fontWeight: 800, fontSize: '1.15rem' }}>Panel trenera</div>
                </div>
              </div>
              <button onClick={handleLogout} style={{ background: C.navyLight, border: 'none', color: C.gray, borderRadius: 10, padding: '0.65rem 0.85rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
                Wyloguj
              </button>
            </div>
            <div style={{ color: C.gray, fontSize: '0.9rem' }}>Szybki przeglad grup, zawodniczek i ostatnich treningow.</div>
          </div>
        </header>

        <main style={{ maxWidth: 960, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1rem' }}>
            <StatCard label="Zawodniczki" value={athletes.length} hint="aktywnych profili" />
            <StatCard label="Grupy" value={groups.length} hint="zespolow" tone="gold" />
            <StatCard label="7 dni" value={recentSessions.length} hint="treningow" tone="green" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Card>
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Grupy</div>
                  <button onClick={() => router.push('/coach/groups')} style={{ border: 'none', background: C.offWhite, color: C.navy, borderRadius: 9, padding: '0.45rem 0.65rem', fontSize: '0.74rem', fontWeight: 800 }}>Wszystkie</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groups.map(group => {
                    const count = athletes.filter(a => a.group_id === group.id).length
                    return (
                      <button key={group.id} onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, borderRadius: 12, padding: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: C.navy }}>{group.name}</div>
                          <div style={{ fontFamily: mono, color: C.gray, fontSize: '0.68rem', marginTop: 2 }}>{count} zawodniczek</div>
                        </div>
                        <span style={{ color: C.gray }}>›</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ padding: '1rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Ostatnie treningi</div>
                {recentSessions.length === 0 ? (
                  <div style={{ color: C.gray, fontSize: '0.9rem' }}>Brak treningow w ostatnich 7 dniach.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentSessions.map(session => (
                      <button key={session.id} onClick={() => router.push(`/coach/athletes/${session.athlete_id}`)} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, borderRadius: 12, padding: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: C.navy }}>{session.athlete?.full_name || 'Zawodniczka'}</div>
                          <div style={{ fontFamily: mono, color: C.gray, fontSize: '0.68rem', marginTop: 2 }}>
                            {session.workout_day?.day_name || 'Trening'} · {session.date_completed ? formatDate(session.date_completed) : '—'}
                          </div>
                        </div>
                        <span style={{ color: session.report_sent ? C.green : C.gray }}>{session.report_sent ? '✓' : '›'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card style={{ marginTop: '1rem' }}>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Zarzadzanie</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <button onClick={() => router.push('/coach/athletes/new')} style={{ padding: '0.8rem', borderRadius: 10, border: 'none', background: C.navy, color: C.gold, fontWeight: 800 }}>Dodaj zawodniczke</button>
                <button onClick={() => router.push('/coach/groups')} style={{ padding: '0.8rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, fontWeight: 700 }}>Grupy</button>
                <button onClick={() => router.push('/coach/plans')} style={{ padding: '0.8rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, fontWeight: 700 }}>Plany</button>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </>
  )
}
