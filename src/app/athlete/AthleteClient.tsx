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
  todayDiet: boolean
  dietEnabled: boolean
  wellnessEnabled: boolean
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
  red: '#EF4444',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"
const trainerName = 'Urszula Papka'
const contentMaxWidth = 520

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function AthleteClient({ athlete, nextTraining, history, todayWellness, todayDiet, dietEnabled, wellnessEnabled }: Props) {
  const router = useRouter()
  const [wellnessOpen, setWellnessOpen] = useState(false)
  const [dietOpen, setDietOpen] = useState(false)
  const [wellnessDone, setWellnessDone] = useState(todayWellness.isComplete)
  const [dietDone, setDietDone] = useState(todayDiet)

  // Prefetch kluczowych tras przy ładowaniu panelu
  useState(() => {
    if (nextTraining) {
      router.prefetch(`/athlete/training?day=${nextTraining.day.id}&assignment=${nextTraining.assignment.id}`)
    }
    router.prefetch('/athlete/history')
    router.prefetch('/athlete/stats')
  })

  const planName = nextTraining?.assignment.plan?.name || history[0]?.workout_day?.week?.plan?.name || 'Plan treningowy'
  const nextTrainingLabel = nextTraining ? `Trening ${nextTraining.completedCount + 1}` : ''
  const lastSession = history[0] as any
  const reportSent = lastSession?.report_sent === true

  const pct = nextTraining?.totalCount
    ? Math.round((nextTraining.completedCount / nextTraining.totalCount) * 100)
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
        .action-card { transition: transform 0.12s, box-shadow 0.12s; }
        .action-card:active { transform: scale(0.985); }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>

        {/* ── HEADER ── */}
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.25rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: contentMaxWidth, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', position: 'relative' }}>
              <button onClick={() => router.push('/athlete')} style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: 'none', padding: 0, flexShrink: 0 }}>
                <img src="/level up.jpg" alt="Level Up" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: C.white }}>{athlete.full_name}</div>
                <div style={{ fontSize: '0.72rem', color: C.gold, marginTop: 2, fontWeight: 700 }}>Trener: {trainerName}</div>
              </div>
              <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.navyBorder}`, background: C.navyLight }}>
                <img src="/unique.png" alt="Unique" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, background: C.white }} />
              </div>
            </div>

            {/* Pasek postępu planu */}
            {nextTraining ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gray, letterSpacing: '0.04em' }}>Postęp planu</span>
                  <span style={{ fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, color: C.gold }}>{nextTraining.completedCount}/{nextTraining.totalCount} · {pct}%</span>
                </div>
                <div style={{ height: 5, background: C.navyBorder, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: C.gold, borderRadius: 3 }} />
                </div>
              </div>
            ) : (
              <div style={{ fontFamily: mono, fontSize: '0.72rem', color: C.green, textAlign: 'center', fontWeight: 700 }}>✓ Wszystkie treningi wykonane</div>
            )}
          </div>
        </header>

        <main style={{ maxWidth: contentMaxWidth, margin: '0 auto', padding: '1rem 1rem 7rem' }}>

          {/* ── WELLNESS ── */}
          {wellnessEnabled && <button
            className="action-card"
            onClick={() => setWellnessOpen(true)}
            style={{ width: '100%', border: 'none', background: 'none', padding: 0, marginBottom: '0.75rem', textAlign: 'left' }}
          >
            <div style={{
              background: wellnessDone ? '#F0FDF4' : C.white,
              border: `1.5px solid ${wellnessDone ? '#86EFAC' : C.grayLight}`,
              borderRadius: 16,
              padding: '1rem 1.25rem',
              boxShadow: '0 2px 12px rgba(13,27,42,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: wellnessDone ? C.green : C.navy,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem',
              }}>
                {wellnessDone ? '✓' : '🩺'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: wellnessDone ? '#16A34A' : C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3, fontWeight: 700 }}>
                  Wellness · {formatDate(todayWellness.dateIso)}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: wellnessDone ? '#15803D' : C.navy }}>
                  {wellnessDone ? 'Wypełniony i wysłany ✓' : 'Uzupełnij przed treningiem'}
                </div>
                {!wellnessDone && (
                  <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 2 }}>
                    {formatLongDate(todayWellness.dateIso)}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, fontFamily: mono, fontSize: '0.8rem', color: wellnessDone ? '#16A34A' : C.gold, fontWeight: 800 }}>
                {wellnessDone ? '' : '›'}
              </div>
            </div>
          </button>}

          {/* ── DIETA ── */}
          {dietEnabled && <button
            className="action-card"
            onClick={() => setDietOpen(true)}
            style={{ width: '100%', border: 'none', background: 'none', padding: 0, marginBottom: '0.75rem', textAlign: 'left' }}
          >
            <div style={{
              background: dietDone ? '#F0FDF4' : C.white,
              border: `1.5px solid ${dietDone ? '#86EFAC' : C.grayLight}`,
              borderRadius: 16,
              padding: '1rem 1.25rem',
              boxShadow: '0 2px 12px rgba(13,27,42,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: dietDone ? C.green : C.navy,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem',
              }}>
                {dietDone ? '✓' : '🥗'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: dietDone ? '#16A34A' : C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3, fontWeight: 700 }}>
                  Dieta · {formatDate(todayWellness.dateIso)}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: dietDone ? '#15803D' : C.navy }}>
                  {dietDone ? 'Zapisana ✓' : 'Uzupełnij dziennik diety'}
                </div>
                {!dietDone && (
                  <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: 2 }}>Posiłki, woda, suplementy</div>
                )}
              </div>
              <div style={{ flexShrink: 0, fontFamily: mono, fontSize: '0.8rem', color: dietDone ? '#16A34A' : C.gold, fontWeight: 800 }}>
                {dietDone ? '' : '›'}
              </div>
            </div>
          </button>}

          {/* ── TRENING ── */}
          {nextTraining ? (
            <button
              className="action-card"
              onClick={() => router.push(`/athlete/training?day=${nextTraining.day.id}&assignment=${nextTraining.assignment.id}`)}
              style={{ width: '100%', border: 'none', background: 'none', padding: 0, marginBottom: '0.75rem', textAlign: 'left' }}
            >
              <div style={{
                background: C.navy,
                borderRadius: 16,
                padding: '1.25rem',
                boxShadow: '0 4px 20px rgba(13,27,42,0.18)',
              }}>
                {/* Nagłówek */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Dzisiejszy trening</div>
                    <div style={{ fontWeight: 900, fontSize: '1.3rem', color: C.white, lineHeight: 1.1 }}>{nextTrainingLabel}</div>
                    <div style={{ fontSize: '0.8rem', color: C.gray, marginTop: 4 }}>{planName}</div>
                  </div>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '1.4rem' }}>🏋️</span>
                  </div>
                </div>

                {/* Pasek postępu */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>Postęp planu</span>
                    <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gold, fontWeight: 700 }}>{nextTraining.completedCount}/{nextTraining.totalCount}</span>
                  </div>
                  <div style={{ height: 5, background: C.navyBorder, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: C.gold, borderRadius: 3 }} />
                  </div>
                </div>

                {/* Przycisk CTA */}
                <div style={{ padding: '0.875rem', borderRadius: 12, background: C.gold, color: C.navy, textAlign: 'center', fontWeight: 900, fontSize: '0.95rem' }}>
                  Rozpocznij trening →
                </div>

                {/* Status ostatniego raportu */}
                {lastSession && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {reportSent ? (
                      <>
                        <span style={{ fontSize: '0.75rem' }}>📋</span>
                        <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.green, fontWeight: 700 }}>
                          Raport z ostatniego treningu wysłany do trenera ✓
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.7rem' }}>⚠️</span>
                        <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray }}>
                          Ostatni trening bez raportu — wyślij po kolejnym
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </button>
          ) : (
            <div style={{ background: C.navy, borderRadius: 16, padding: '1.5rem', marginBottom: '0.75rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(13,27,42,0.18)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏆</div>
              <div style={{ fontWeight: 800, color: C.white, fontSize: '1.1rem', marginBottom: 4 }}>Wszystkie treningi wykonane!</div>
              <div style={{ fontSize: '0.85rem', color: C.gray }}>Trener wkrótce przypisze nowy plan.</div>
              {reportSent && (
                <div style={{ marginTop: '0.75rem', fontFamily: mono, fontSize: '0.62rem', color: C.green }}>📋 Ostatni raport wysłany ✓</div>
              )}
            </div>
          )}

          {/* ── KAFELKI HISTORIA / STATYSTYKI ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '0.75rem' }}>
            <button
              className="action-card"
              onClick={() => router.push('/athlete/history')}
              style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem', textAlign: 'left', boxShadow: '0 2px 8px rgba(13,27,42,0.04)' }}
            >
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Historia</div>
              <div style={{ fontFamily: mono, fontSize: '1.8rem', fontWeight: 900, color: C.navy, lineHeight: 1 }}>{history.length}</div>
              <div style={{ color: C.gray, fontSize: '0.75rem', marginTop: 4 }}>ukończonych treningów</div>
            </button>

            <button
              className="action-card"
              onClick={() => router.push('/athlete/stats')}
              style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem', textAlign: 'left', boxShadow: '0 2px 8px rgba(13,27,42,0.04)' }}
            >
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Statystyki</div>
              <div style={{ fontFamily: mono, fontSize: '1.8rem', fontWeight: 900, color: C.gold, lineHeight: 1 }}>↗</div>
              <div style={{ color: C.gray, fontSize: '0.75rem', marginTop: 4 }}>wellness i tonaż</div>
            </button>
          </div>

          {/* ── OSTATNI TRENING ── */}
          {lastSession && (
            <button
              className="action-card"
              onClick={() => router.push(`/athlete/history/${lastSession.id}`)}
              style={{ width: '100%', background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '0.75rem', textAlign: 'left', boxShadow: '0 2px 8px rgba(13,27,42,0.04)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Ostatni trening</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: C.navy }}>{lastSession.workout_day?.day_name || 'Trening'}</div>
                  {lastSession.date_completed && (
                    <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, marginTop: 2 }}>{formatDate(lastSession.date_completed)}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {reportSent && <span style={{ fontFamily: mono, fontSize: '0.58rem', color: C.green, background: '#F0FDF4', border: `1px solid #86EFAC`, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>📋 wysłany</span>}
                  <span style={{ color: C.gray, fontSize: '1rem' }}>›</span>
                </div>
              </div>
            </button>
          )}

          {/* ── WYLOGUJ ── */}
          <button
            onClick={handleLogout}
            style={{ width: '100%', padding: '0.875rem', borderRadius: 12, border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.gray, fontWeight: 700, fontSize: '0.88rem' }}
          >
            Wyloguj się
          </button>
        </main>
      </div>

      {wellnessEnabled && wellnessOpen && (
        <WellnessModal
          athlete={athlete}
          onClose={() => setWellnessOpen(false)}
          onSaved={() => { setWellnessOpen(false); setWellnessDone(true) }}
        />
      )}

      {dietEnabled && dietOpen && (
        <DietModal
          athleteId={athlete.id}
          onClose={() => setDietOpen(false)}
          onSaved={() => { setDietDone(true); setDietOpen(false) }}
        />
      )}
    </>
  )
}
