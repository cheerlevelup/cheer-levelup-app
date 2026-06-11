'use client'
// src/app/coach/groups/[id]/readiness/ReadinessKioskClient.tsx
// Kiosk gotowości treningowej — tablet na sali, zawodniczki wybierają siebie
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import WellnessModal from '@/components/WellnessModal'
import { localDateStr, dayRangeIso, findTrainingForDate } from '@/lib/groupTraining'
import type { Athlete } from '@/types/workout'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

type Group = { id: number; name: string }

interface Props {
  group: Group
  athletes: Athlete[]
  wellnessFields: string[]
}

export default function ReadinessKioskClient({ group, athletes, wellnessFields }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [doneIds, setDoneIds] = useState<Set<number>>(new Set())
  const [active, setActive] = useState<Athlete | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDone = useCallback(async () => {
    if (athletes.length === 0) { setLoading(false); return }
    const { startIso, endIso } = dayRangeIso(localDateStr())
    const { data } = await supabase
      .from('wellness_logs')
      .select('athlete_id')
      .in('athlete_id', athletes.map(a => a.id))
      .gte('created_at', startIso)
      .lt('created_at', endIso)
    setDoneIds(new Set((data || []).map((w: any) => w.athlete_id)))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadDone() }, [loadDone])

  // Po zapisie: podepnij wpis pod dzisiejszy trening grupy (jeśli istnieje)
  async function handleSaved(athlete: Athlete) {
    setDoneIds(prev => new Set(prev).add(athlete.id))
    const today = localDateStr()
    const training = await findTrainingForDate(supabase, group.id, today)
    if (training) {
      const { startIso, endIso } = dayRangeIso(today)
      await supabase
        .from('wellness_logs')
        .update({ group_training_id: training.id })
        .eq('athlete_id', athlete.id)
        .is('group_training_id', null)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
    }
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
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button onClick={() => router.push(`/coach/groups/${group.id}`)} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
              ← {group.name}
            </button>
            <h1 style={{ color: C.white, fontSize: '1.4rem', fontWeight: 800, marginTop: '1rem' }}>
              ✅ Gotowość treningowa
            </h1>
            <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>
              Wybierz siebie z listy i wypełnij arkusz. Po zapisaniu wracasz do listy.
            </p>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: C.gray, padding: '2rem', fontFamily: mono, fontSize: '0.8rem' }}>
              Wczytuję...
            </div>
          ) : athletes.length === 0 ? (
            <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: C.gray }}>
              Brak zawodniczek w grupie.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {athletes.map(a => {
                const done = doneIds.has(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => setActive(a)}
                    style={{
                      width: '100%', padding: '1.1rem 1.25rem', borderRadius: 14,
                      border: `2px solid ${done ? '#86EFAC' : C.grayLight}`,
                      background: done ? '#F0FDF4' : C.white,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      textAlign: 'left', boxShadow: '0 4px 20px rgba(13,27,42,0.05)',
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: C.navy }}>{a.full_name}</span>
                    {done ? (
                      <span style={{ fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ✅ uzupełnione
                      </span>
                    ) : (
                      <span style={{ fontFamily: mono, fontSize: '0.7rem', color: C.gray }}>wypełnij →</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {active && (
        <WellnessModal
          athlete={active}
          enabledFields={wellnessFields}
          onClose={() => setActive(null)}
          onSaved={() => handleSaved(active)}
        />
      )}
    </>
  )
}
