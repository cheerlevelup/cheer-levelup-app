'use client'
// src/app/coach/groups/CoachGroupsClient.tsx
import { useRouter } from 'next/navigation'

const C = {
  navy: '#0D1B2A',
  navyLight: '#1A2E45',
  navyBorder: '#243652',
  gold: '#F5C842',
  white: '#FFFFFF',
  offWhite: '#F4F6F9',
  gray: '#8A9BB0',
  grayLight: '#E8ECF2',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = {
  id: number
  name: string
  training_level?: string | null
}

type Athlete = {
  id: number
  full_name: string
  group_id?: number | null
}

interface Props {
  groups: Group[]
  athletes: Athlete[]
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>
      {children}
    </div>
  )
}

export default function CoachGroupsClient({ groups, athletes }: Props) {
  const router = useRouter()

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
            <button onClick={() => router.push('/coach')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← Panel
            </button>
            <h1 style={{ color: C.white, fontSize: '1.45rem', fontWeight: 800, marginTop: '1rem' }}>Grupy</h1>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>Zarzadzanie zawodniczkami w grupach.</p>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
            <Card>
              <div style={{ padding: '0.875rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Grupy</div>
                <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 800, color: C.gold, lineHeight: 1 }}>{groups.length}</div>
              </div>
            </Card>
            <Card>
              <div style={{ padding: '0.875rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Zawodniczki</div>
                <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 800, color: C.navy, lineHeight: 1 }}>{athletes.length}</div>
              </div>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map(group => {
              const groupAthletes = athletes.filter(a => a.group_id === group.id)
              return (
                <Card key={group.id}>
                  <button onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ width: '100%', background: 'none', border: 'none', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: C.navy }}>{group.name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 4 }}>
                        {groupAthletes.length} zawodniczek{group.training_level ? ` · ${group.training_level}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        {groupAthletes.slice(0, 5).map(athlete => (
                          <span key={athlete.id} style={{ fontFamily: mono, fontSize: '0.65rem', color: C.navy, background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, padding: '3px 8px' }}>
                            {athlete.full_name.split(' ')[0]}
                          </span>
                        ))}
                        {groupAthletes.length > 5 && <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, padding: '3px 0' }}>+{groupAthletes.length - 5}</span>}
                      </div>
                    </div>
                    <span style={{ color: C.gray, marginLeft: 12 }}>›</span>
                  </button>
                </Card>
              )
            })}
          </div>
        </main>
      </div>
    </>
  )
}
