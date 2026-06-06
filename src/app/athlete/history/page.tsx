// src/app/athlete/history/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId, getAthleteTrainingHistory } from '@/lib/training'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const since90 = new Date()
  since90.setDate(since90.getDate() - 90)
  const since90iso = since90.toISOString()
  const since90date = since90.toISOString().split('T')[0]

  const [history, { data: feedbacks }, { data: wellnessLogs }, { data: painLogs }, { data: dietLogs }] = await Promise.all([
    getAthleteTrainingHistory(athlete.id, 90),
    supabase.from('post_session_feedback').select('*').eq('athlete_id', athlete.id)
      .order('created_at', { ascending: false }).limit(90),
    supabase.from('wellness_logs').select('*').eq('athlete_id', athlete.id)
      .gte('created_at', since90iso).order('date', { ascending: true }),
    supabase.from('pain_logs').select('*').eq('athlete_id', athlete.id)
      .gte('created_at', since90iso).order('created_at', { ascending: true }),
    supabase.from('diet_logs').select('date,water_ml,coffee_count').eq('athlete_id', athlete.id)
      .gte('date', since90date).order('date', { ascending: true }),
  ])

  return (
    <HistoryClient
      athlete={athlete}
      history={history}
      feedbacks={feedbacks || []}
      wellnessLogs={wellnessLogs || []}
      painLogs={painLogs || []}
      dietLogs={dietLogs || []}
    />
  )
}
