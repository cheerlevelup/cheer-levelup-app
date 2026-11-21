// src/app/athlete/page.tsx
// Panel główny zawodniczki — /athlete

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  getAthleteByUserId,
  getNextTrainingForAthlete,
  getPlanTrainingsForAthlete,
  getAthleteTrainingHistory,
} from '@/lib/training'
import AthleteClient from './AthleteClient'
import { getAthleteGroupTrainings } from '@/lib/athleteGroupTraining'

export const dynamic = 'force-dynamic'

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

  // Wszystkie zapytania równolegle — zamiast sekwencyjnie
  const [nextTraining, planTrainings, groupTrainings, history] = await Promise.all([
    getNextTrainingForAthlete(athlete.id, athlete.group_id || undefined),
    getPlanTrainingsForAthlete(athlete.id, athlete.group_id || undefined),
    getAthleteGroupTrainings(athlete.id, athlete.group_id),
    getAthleteTrainingHistory(athlete.id, 5),
  ])

  return (
    <AthleteClient
      athlete={athlete}
      nextTraining={nextTraining}
      planTrainings={planTrainings}
      groupTrainings={groupTrainings}
      today={new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' })}
      history={history}
    />
  )
}
