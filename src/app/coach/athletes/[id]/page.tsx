// src/app/coach/athletes/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachAthleteClient from './CoachAthleteClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoachAthletePage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params

  const athleteId = parseInt(id)

  const { data: athlete } = await supabase
    .from('athletes')
    .select('*, group:groups(*)')
    .eq('id', athleteId)
    .single()

  if (!athlete) redirect('/coach')

  // Historia treningów
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      workout_day:workout_days(
        day_name,
        week:workout_weeks(week_number, plan:workout_plans(name))
      )
    `)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Ostatni feedback
  const { data: feedbacks } = await supabase
    .from('post_session_feedback')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Ostatni wellness
  const { data: wellnessList } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Pain logs
  const { data: painLogs } = await supabase
    .from('pain_logs')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <CoachAthleteClient
      athlete={athlete}
      sessions={sessions || []}
      feedbacks={feedbacks || []}
      wellnessList={wellnessList || []}
      painLogs={painLogs || []}
    />
  )
}
