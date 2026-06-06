// src/app/athlete/stats/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId } from '@/lib/training'
import StatsClient from './StatsClient'

export default async function AthleteStatsPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const since90 = new Date()
  since90.setDate(since90.getDate() - 90)
  const since90iso = since90.toISOString()
  const since90date = since90.toISOString().split('T')[0]

  const [
    { data: wellnessLogs },
    { data: feedbacks },
    { data: painLogs },
    { data: setLogs },
    { data: sessions },
    { data: dietLogs },
  ] = await Promise.all([
    supabase.from('wellness_logs').select('*').eq('athlete_id', athlete.id)
      .gte('created_at', since90iso).order('date', { ascending: true }),
    supabase.from('post_session_feedback').select('*').eq('athlete_id', athlete.id)
      .gte('created_at', since90iso).order('created_at', { ascending: true }),
    supabase.from('pain_logs').select('*').eq('athlete_id', athlete.id)
      .gte('created_at', since90iso).order('created_at', { ascending: true }),
    supabase.from('set_logs').select('*, workout_session:workout_sessions(date_completed, workout_day_id), block_exercise:workout_block_exercises(exercise_id, exercise_code, exercise:exercises(name))')
      .eq('athlete_id', athlete.id).eq('completed', true).eq('is_warmup', false)
      .gte('created_at', since90iso).order('created_at', { ascending: true }),
    supabase.from('workout_sessions').select('*, workout_day:workout_days(day_name, week:workout_weeks(week_number, plan:workout_plans(name, is_archived)))')
      .eq('athlete_id', athlete.id).eq('completed', true)
      .order('date_completed', { ascending: true }).limit(90),
    supabase.from('diet_logs').select('*').eq('athlete_id', athlete.id)
      .gte('date', since90date).order('date', { ascending: true }),
  ])

  return (
    <StatsClient
      athlete={athlete}
      wellnessLogs={wellnessLogs || []}
      feedbacks={feedbacks || []}
      painLogs={painLogs || []}
      setLogs={setLogs || []}
      sessions={sessions || []}
      dietLogs={dietLogs || []}
    />
  )
}
