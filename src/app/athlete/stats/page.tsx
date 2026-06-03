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

  const since30DaysDate = new Date()
  since30DaysDate.setDate(since30DaysDate.getDate() - 30)
  const since30Days = since30DaysDate.toISOString()

  const [
    { data: wellnessLogs },
    { data: feedbacks },
    { data: painLogs },
    { data: setLogs },
    { data: sessions },
  ] = await Promise.all([
    supabase
      .from('wellness_logs')
      .select('*')
      .eq('athlete_id', athlete.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('post_session_feedback')
      .select('*')
      .eq('athlete_id', athlete.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('pain_logs')
      .select('*')
      .eq('athlete_id', athlete.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('set_logs')
      .select('*')
      .eq('athlete_id', athlete.id)
      .eq('completed', true)
      .eq('is_warmup', false)
      .gte('created_at', since30Days)
      .order('created_at', { ascending: false }),
    supabase
      .from('workout_sessions')
      .select('id, date_started, date_completed, completed')
      .eq('athlete_id', athlete.id)
      .eq('completed', true)
      .order('date_completed', { ascending: false })
      .limit(30),
  ])

  return (
    <StatsClient
      athlete={athlete}
      wellnessLogs={wellnessLogs || []}
      feedbacks={feedbacks || []}
      painLogs={painLogs || []}
      setLogs={setLogs || []}
      sessions={sessions || []}
    />
  )
}
