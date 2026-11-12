'use client'
// src/app/athlete/AthleteClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Athlete, WorkoutSession, AthleteWorkoutAssignment, WorkoutDay } from '@/types/workout'
import WellnessModal from '@/components/WellnessModal'
import { C, sans, display, shadow, radius } from '@/lib/athleteTheme'

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
  wellnessEnabled: boolean
  wellnessFields: string[]
}

type WellnessStatus = {
  dateIso: string
  completedFields: number
  totalFields: number
  isComplete: boolean
}

const trainerName = 'Urszula Papka'
const contentMaxWidth = 520

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function AthleteClient({ athlete, nextTraining, history, todayWellness, wellnessEnabled, wellnessFields }: Props) {
  const router = useRouter()
  const [wellnessOpen, setWellnessOpen] = useState(false)
  const [wellnessDone, setWellnessDone] = useState(todayWellness.isComplete)

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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button { cursor: pointer; font-family: inherit; }
        .ath-card { transition: transform 0.12s, box-shadow 0.12s; }
        .ath-card:active { transform: scale(0.985); }
        .ath-eyebrow { font-family: ${sans}; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
        .ath-display { font-family: ${display}; font-weight: 700; letter-spacing: .01em; line-height: 1.05; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.ink }}>

        {/* ── NAGŁÓWEK: logo, zawodniczka, trener, postęp planu ── */}
        <header style={{ background: C.navy, padding: 'calc(env(safe-area-inset-top) + 14px) 16px 18px', position: 'sticky', top: 0, zIndex: 10, borderBottom: `2px solid ${C.gold}` }}>
          <div style={{ maxWidth: contentMaxWidth, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.push('/athlete')} aria-label="Panel główny" style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: 'none', background: C.white, padding: 0, flexShrink: 0 }}>
                <img src="/level up.jpg" alt="Level Up" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ath-eyebrow" style={{ color: C.goldLight, fontSize: 10 }}>Trener: {trainerName}</div>
                <div className="ath-display" style={{ fontSize: 22, color: C.white, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{athlete.full_name}</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: C.white, flexShrink: 0 }}>
                <img src="/unique.png" alt="Unique" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
              </div>
            </div>

            {nextTraining ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span className="ath-eyebrow" style={{ color: C.gray, fontSize: 10 }}>Postęp planu · {planName}</span>
                  <span style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.gold }}>{nextTraining.completedCount}/{nextTraining.totalCount} <span style={{ color: C.gray, fontWeight: 600 }}>· {pct}%</span></span>
                </div>
                <div style={{ height: 6, background: C.navyLight, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: C.gold, borderRadius: 3, transition: 'width .4s' }} />
                </div>
              </div>
            ) : (
              <div className="ath-eyebrow" style={{ marginTop: 12, color: C.green, textAlign: 'center' }}>✓ Wszystkie treningi wykonane</div>
            )}
          </div>
        </header>

        <main style={{ maxWidth: contentMaxWidth, margin: '0 auto', padding: '16px 16px calc(env(safe-area-inset-bottom) + 32px)', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── TRENING ── */}
          {nextTraining ? (
            <button
              className="ath-card"
              onClick={() => router.push(`/athlete/training?day=${nextTraining.day.id}&assignment=${nextTraining.assignment.id}`)}
              style={{ width: '100%', border: 'none', padding: 0, textAlign: 'left', background: C.navy, borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 24px rgba(11,18,32,.22)' }}
            >
              <div style={{ padding: '18px 18px 16px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(circle at top right, ${C.gold}33, transparent 70%)` }} />
                <div className="ath-eyebrow" style={{ color: C.gold }}>Dzisiejszy trening</div>
                <div className="ath-display" style={{ fontSize: 34, color: C.white, marginTop: 6 }}>{nextTrainingLabel}</div>
                <div style={{ fontSize: 14, color: C.gray, marginTop: 4 }}>{nextTraining.day.day_name && nextTraining.day.day_name !== nextTrainingLabel ? `${nextTraining.day.day_name} · ` : ''}{planName}</div>
                <div style={{ marginTop: 16, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, background: C.gold, color: C.navy, fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: '.02em' }}>
                  Rozpocznij trening <span style={{ fontSize: 22 }}>→</span>
                </div>
              </div>
              {lastSession && (
                <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.navyLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: reportSent ? C.green : C.gray }}>
                  {reportSent ? '✓ Raport z ostatniego treningu wysłany do trenera' : '⚠️ Ostatni trening bez raportu — wyślij po kolejnym'}
                </div>
              )}
            </button>
          ) : (
            <div style={{ background: C.navy, borderRadius: 18, padding: '24px 18px', textAlign: 'center', boxShadow: '0 8px 24px rgba(11,18,32,.22)' }}>
              <div style={{ fontSize: 34, marginBottom: 6 }}>🏆</div>
              <div className="ath-display" style={{ color: C.white, fontSize: 26 }}>Wszystkie treningi wykonane!</div>
              <div style={{ fontSize: 14, color: C.gray, marginTop: 6 }}>Trener wkrótce przypisze nowy plan.</div>
              {reportSent && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: C.green }}>✓ Ostatni raport wysłany</div>}
            </div>
          )}

          {/* ── WELLNESS ── */}
          {wellnessEnabled && (
            <button
              className="ath-card"
              onClick={() => setWellnessOpen(true)}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius, background: wellnessDone ? '#ecfaf3' : C.white, border: `1px solid ${wellnessDone ? '#bfe9d3' : C.grayLight}`, boxShadow: shadow }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: wellnessDone ? C.green : C.offWhite, color: wellnessDone ? C.white : C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {wellnessDone ? '✓' : '🩺'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ath-eyebrow" style={{ color: wellnessDone ? '#1f9d68' : C.muted, fontSize: 10 }}>Wellness · {formatDate(todayWellness.dateIso)}</div>
                <div className="ath-display" style={{ fontSize: 20, color: wellnessDone ? '#167a52' : C.ink, marginTop: 3 }}>{wellnessDone ? 'Wypełniony' : 'Dzienny monitoring'}</div>
                {!wellnessDone && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{formatLongDate(todayWellness.dateIso)}</div>}
              </div>
              {!wellnessDone && <span style={{ flexShrink: 0, color: C.gold, fontSize: 24, fontWeight: 700 }}>›</span>}
            </button>
          )}

          {/* ── HISTORIA / STATYSTYKI ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button className="ath-card" onClick={() => router.push('/athlete/history')}
              style={{ textAlign: 'left', padding: 16, borderRadius: radius, background: C.white, border: `1px solid ${C.grayLight}`, boxShadow: shadow, minHeight: 112 }}>
              <div className="ath-eyebrow" style={{ color: C.muted, fontSize: 10 }}>Historia</div>
              <div className="ath-display" style={{ fontSize: 40, color: C.ink, marginTop: 8 }}>{history.length}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>ukończonych treningów</div>
            </button>
            <button className="ath-card" onClick={() => router.push('/athlete/stats')}
              style={{ textAlign: 'left', padding: 16, borderRadius: radius, background: C.white, border: `1px solid ${C.grayLight}`, boxShadow: shadow, minHeight: 112 }}>
              <div className="ath-eyebrow" style={{ color: C.muted, fontSize: 10 }}>Statystyki</div>
              <div className="ath-display" style={{ fontSize: 40, color: C.gold, marginTop: 8 }}>↗</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>wellness i tonaż</div>
            </button>
          </div>

          {/* ── OSTATNI TRENING ── */}
          {lastSession && (
            <button className="ath-card" onClick={() => router.push(`/athlete/history/${lastSession.id}`)}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius, background: C.white, border: `1px solid ${C.grayLight}`, boxShadow: shadow }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ath-eyebrow" style={{ color: C.muted, fontSize: 10 }}>Ostatni trening</div>
                <div className="ath-display" style={{ fontSize: 20, color: C.ink, marginTop: 3 }}>{lastSession.workout_day?.day_name || 'Trening'}</div>
                {lastSession.date_completed && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{formatDate(lastSession.date_completed)}</div>}
              </div>
              {reportSent && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#1f9d68', background: '#ecfaf3', border: '1px solid #bfe9d3', borderRadius: 999, padding: '3px 10px' }}>raport wysłany</span>}
              <span style={{ flexShrink: 0, color: C.gray, fontSize: 22 }}>›</span>
            </button>
          )}

          {/* ── WYLOGUJ ── */}
          <button onClick={handleLogout}
            style={{ marginTop: 8, width: '100%', minHeight: 48, borderRadius: 12, border: 'none', background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 14 }}>
            Wyloguj się
          </button>
        </main>
      </div>

      {wellnessEnabled && wellnessOpen && (
        <WellnessModal
          athlete={athlete}
          enabledFields={wellnessFields}
          onClose={() => setWellnessOpen(false)}
          onSaved={() => { setWellnessOpen(false); setWellnessDone(true) }}
        />
      )}
    </>
  )
}
