// src/app/athlete/page.tsx
// Panel główny zawodniczki — /athlete

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  getAthleteByUserId,
  getNextTrainingForAthlete,
  getAthleteTrainingHistory,
} from '@/lib/training'
import AthleteClient from './AthleteClient'

export default async function AthletePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) {
    // Konto auth istnieje ale brak rekordu athlete — pokaż komunikat
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F0EEE9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif",
        padding: '2rem',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', marginBottom: '0.5rem' }}>
            Profil nie znaleziony
          </p>
          <p style={{ color: '#555', fontSize: '0.95rem' }}>
            Skontaktuj się z trenerem — Twoje konto nie zostało jeszcze skonfigurowane.
          </p>
        </div>
      </div>
    )
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const todayDateStr = todayStart.toISOString().split('T')[0]

  // Wszystkie zapytania równolegle — zamiast sekwencyjnie
  const [nextTraining, history, { data: todayWellnessLog }, { data: todayDietLog }] = await Promise.all([
    getNextTrainingForAthlete(athlete.id, athlete.group_id || undefined),
    getAthleteTrainingHistory(athlete.id, 5),
    supabase
      .from('wellness_logs')
      .select('sleep_hours, sleep_quality, energy, stress, muscle_sorness, readiness')
      .eq('athlete_id', athlete.id)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('diet_logs')
      .select('id')
      .eq('athlete_id', athlete.id)
      .eq('date', todayDateStr)
      .limit(1)
      .maybeSingle(),
  ])

  const wellnessFields = ['sleep_hours', 'sleep_quality', 'energy', 'stress', 'muscle_sorness', 'readiness'] as const
  const completedWellnessFields = wellnessFields.filter(field => {
    const value = todayWellnessLog?.[field]
    return value !== null && value !== undefined
  }).length

  return (
    <AthleteClient
      athlete={athlete}
      nextTraining={nextTraining}
      history={history}
      todayWellness={{
        dateIso: todayStart.toISOString(),
        completedFields: completedWellnessFields,
        totalFields: wellnessFields.length,
        isComplete: completedWellnessFields === wellnessFields.length,
      }}
      todayDiet={!!todayDietLog}
    />
  )
}
