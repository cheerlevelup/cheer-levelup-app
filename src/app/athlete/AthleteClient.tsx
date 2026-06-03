'use client'
// src/app/athlete/AthleteClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Athlete, WorkoutSession, AthleteWorkoutAssignment, WorkoutDay } from '@/types/workout'
import DietModal from '@/components/DietModal'
import WellnessModal from '@/components/WellnessModal'

interface Props {
  athlete: Athlete
  nextTraining: {
    assignment: AthleteWorkoutAssignment
    day: WorkoutDay
    completedCount: number
    totalCount: number
  } | null
  history: WorkoutSession[]
  todayWellness: WellnessStatus
}

type WellnessStatus = {
  dateIso: string
  completedFields: number
  totalFields: number
  isComplete: boolean
}

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
const trainerName = 'Urszula Papka'
const contentMaxWidth = 520

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
  })
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, letterSpacing: '0.04em' }}>Postep planu</span>
        <span style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 700, color: C.gold }}>
          {value}/{max} treningow · {pct}%
        </span>
      </div>
      <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: C.gold, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
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

export default function AthleteClient({ athlete, nextTraining, history, todayWellness }: Props) {
  const router = useRouter()
  const [wellnessOpen, setWellnessOpen] = useState(false)
  const [dietOpen, setDietOpen] = useState(false)
  const [dietSavedToday, setDietSavedToday] = useState(false)
  const planName = nextTraining?.assignment.plan?.name || history[0]?.workout_day?.week?.plan?.name || 'Plan treningowy'
  const nextTrainingLabel = nextTraining ? `Trening ${nextTraining.completedCount + 1}` : ''
  const lastSession = history[0]
  const wellnessPct = todayWellness.totalFields > 0
    ? Math.round((todayWellness.completedFields / todayWellness.totalFields) * 100)
    : 0

  async function handleLogout() {
    const { createClient } = await import('@/utils/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
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
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.25rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', position: 'relative' }}>
            <button onClick={() => router.push('/athlete')} style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: 'none', padding: 0, flexShrink: 0 }}>
              <img src="/level up.jpg" alt="Level Up" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>

            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: `min(60vw, ${contentMaxWidth}px)`, textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: C.white }}>{athlete.full_name}</div>
              <div style={{ fontSize: '0.72rem', color: C.gold, marginTop: 2, fontWeight: 700 }}>Trener: {trainerName}</div>
            </div>

            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: C.navyLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/unique.png" alt="Unique" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, background: C.white }} />
            </div>
          </div>

          {nextTraining ? (
            <div style={{ maxWidth: contentMaxWidth, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, letterSpacing: '0.04em' }}>Nastepny trening</span>
                <span style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 700, color: C.gold }}>{nextTrainingLabel}</span>
              </div>
              <div style={{ height: 6, background: C.navyBorder, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${nextTraining.totalCount > 0 ? Math.round((nextTraining.completedCount / nextTraining.totalCount) * 100) : 0}%`, background: C.gold, borderRadius: 3 }} />
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: contentMaxWidth, margin: '0 auto', fontFamily: mono, fontSize: '0.72rem', color: C.green, textAlign: 'center', fontWeight: 700 }}>
              Wszystkie treningi wykonane
            </div>
          )}
        </header>

        <main style={{ maxWidth: contentMaxWidth, margin: '0 auto', padding: '1.25rem 1rem 7rem' }}>
          <Card style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setWellnessOpen(true)}
              style={{ width: '100%', border: 'none', background: 'none', padding: '1rem', textAlign: 'left' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontFamily: mono, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Dzisiejszy wellness
                  </div>
                  <h1 style={{ fontSize: '1.25rem', lineHeight: 1.1, fontWeight: 800, color: C.navy }}>
                    {formatLongDate(todayWellness.dateIso)}
                  </h1>
                  <div style={{ color: C.gray, fontSize: '0.84rem', marginTop: 5 }}>
                    {todayWellness.isComplete ? 'Wszystko uzupełnione' : 'Uzupełnij przed treningiem'}
                  </div>
                </div>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 13,
                  background: todayWellness.isComplete ? C.green : C.navy,
                  color: todayWellness.isComplete ? C.white : C.gold,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: mono,
                  fontWeight: 900,
                  fontSize: '1rem',
                  flexShrink: 0,
                }}>
                  {todayWellness.isComplete ? 'OK' : `${wellnessPct}%`}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, letterSpacing: '0.04em' }}>Postep wellness</span>
                  <span style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 700, color: todayWellness.isComplete ? C.green : C.gold }}>
                    {todayWellness.completedFields}/{todayWellness.totalFields} pól · {wellnessPct}%
                  </span>
                </div>
                <div style={{ height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${wellnessPct}%`, background: todayWellness.isComplete ? C.green : C.gold, borderRadius: 3, transition: 'width 0.4s ease' }} />
                </div>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.875rem', borderRadius: 12, background: todayWellness.isComplete ? C.offWhite : C.navy, color: todayWellness.isComplete ? C.navy : C.gold, textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                {todayWellness.isComplete ? 'Zobacz wellness' : 'Uzupełnij wellness'}
              </div>
            </button>
          </Card>

          {/* Diet card */}
          <Card style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setDietOpen(true)}
              style={{ width: '100%', border: 'none', background: 'none', padding: '1rem', textAlign: 'left' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontFamily: mono, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Dzisiejsza dieta
                  </div>
                  <h2 style={{ fontSize: '1.25rem', lineHeight: 1.1, fontWeight: 800, color: C.navy }}>
                    {formatLongDate(todayWellness.dateIso)}
                  </h2>
                  <div style={{ color: C.gray, fontSize: '0.84rem', marginTop: 5 }}>
                    {dietSavedToday ? 'Wszystko uzupełnione' : 'Uzupełnij dietę'}
                  </div>
                </div>
                <div style={{
                  width: 52, height: 52, borderRadius: 13,
                  background: dietSavedToday ? C.green : C.navy,
                  color: dietSavedToday ? C.white : C.gold,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: mono, fontWeight: 900, fontSize: '1.4rem', flexShrink: 0,
                }}>
                  🥗
                </div>
              </div>

              <div style={{ marginTop: '0.25rem', padding: '0.875rem', borderRadius: 12, background: dietSavedToday ? C.offWhite : C.navy, color: dietSavedToday ? C.navy : C.gold, textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                {dietSavedToday ? 'Zobacz dietę' : 'Uzupełnij dietę'}
              </div>
            </button>
          </Card>

          <Card style={{ marginBottom: '1rem' }}>
            {nextTraining ? (
              <button
                onClick={() => router.push(`/athlete/training?day=${nextTraining.day.id}&assignment=${nextTraining.assignment.id}`)}
                style={{ width: '100%', border: 'none', background: 'none', padding: '1rem', textAlign: 'left' }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontFamily: mono, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Dzisiejszy trening</div>
                    <h1 style={{ fontSize: '1.35rem', lineHeight: 1.1, fontWeight: 800, color: C.navy }}>{nextTrainingLabel}</h1>
                    <div style={{ color: C.gray, fontSize: '0.84rem', marginTop: 5 }}>{planName}</div>
                  </div>
                </div>

                <ProgressBar value={nextTraining.completedCount} max={nextTraining.totalCount} />

                <div style={{ marginTop: '1rem', padding: '0.875rem', borderRadius: 12, background: C.navy, color: C.gold, textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                  Rozpocznij trening
                </div>
              </button>
            ) : (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>✓</div>
                <div style={{ fontWeight: 800, color: C.navy }}>Wszystkie treningi wykonane</div>
                <div style={{ fontSize: '0.85rem', color: C.gray, marginTop: 4 }}>Trener wkrotce przypisze nowy plan.</div>
              </div>
            )}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
            <Card>
              <button onClick={() => router.push('/athlete/history')} style={{ width: '100%', border: 'none', background: 'none', padding: '0.875rem', textAlign: 'left' }}>
                <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Historia</div>
                <div style={{ fontFamily: mono, fontSize: '1.6rem', fontWeight: 800, color: C.navy, lineHeight: 1 }}>{history.length}</div>
                <div style={{ color: C.gray, fontSize: '0.76rem', marginTop: 4 }}>ostatnich treningow</div>
              </button>
            </Card>

            <Card>
              <button onClick={() => router.push('/athlete/stats')} style={{ width: '100%', border: 'none', background: 'none', padding: '0.875rem', textAlign: 'left' }}>
                <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Statystyki</div>
                <div style={{ fontFamily: mono, fontSize: '1.6rem', fontWeight: 800, color: C.gold, lineHeight: 1 }}>↗</div>
                <div style={{ color: C.gray, fontSize: '0.76rem', marginTop: 4 }}>wellness i tonaz</div>
              </button>
            </Card>
          </div>

          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.875rem' }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Ostatni trening</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: C.navy }}>{lastSession?.workout_day?.day_name || 'Brak historii'}</div>
                </div>
                {lastSession?.date_completed && (
                  <span style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray }}>{formatDate(lastSession.date_completed)}</span>
                )}
              </div>

              {lastSession ? (
                <button onClick={() => router.push(`/athlete/history/${lastSession.id}`)} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.75rem', fontWeight: 700, fontSize: '0.86rem' }}>
                  Zobacz szczegoly
                </button>
              ) : (
                <div style={{ color: C.gray, fontSize: '0.85rem' }}>Pierwszy trening dopiero przed Toba.</div>
              )}
            </div>
          </Card>

          <Card>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Szybkie akcje</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button onClick={() => router.push('/athlete/history')} style={{ padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, fontWeight: 700 }}>Historia</button>
                <button onClick={() => router.push('/athlete/stats')} style={{ padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, fontWeight: 700 }}>Statystyki</button>
                <button onClick={handleLogout} style={{ padding: '0.75rem', borderRadius: 10, border: 'none', background: C.navy, color: C.gold, fontWeight: 800 }}>Wyloguj</button>
              </div>
            </div>
          </Card>
        </main>
      </div>

      {wellnessOpen && (
        <WellnessModal
          athlete={athlete}
          onClose={() => setWellnessOpen(false)}
          onSaved={() => { setWellnessOpen(false); router.refresh() }}
        />
      )}

      {dietOpen && (
        <DietModal
          athleteId={athlete.id}
          onClose={() => setDietOpen(false)}
          onSaved={() => setDietSavedToday(true)}
        />
      )}
    </>
  )
}
