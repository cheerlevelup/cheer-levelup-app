// src/app/athlete/history/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId } from '@/lib/training'
import HistoryDetailClient from './HistoryDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function HistoryDetailPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const { id } = await params
  const sessionId = parseInt(id)

  const { data: session } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      workout_day:workout_days(
        *,
        week:workout_weeks(*, plan:workout_plans(*)),
        workout_day_blocks(
          *,
          workout_block_exercises(*, exercise:exercises(*))
        )
      )
    `)
    .eq('id', sessionId)
    .eq('athlete_id', athlete.id)
    .single()

  if (!session) redirect('/athlete/history')

  const { data: setLogs } = await supabase
    .from('set_logs')
    .select('*')
    .eq('workout_session_id', sessionId)
    .eq('athlete_id', athlete.id)
    .order('created_at', { ascending: true })

  const { data: wellness } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('workout_session_id', sessionId)
    .maybeSingle()

  const { data: feedback } = await supabase
    .from('post_session_feedback')
    .select('*')
    .eq('workout_session_id', sessionId)
    .maybeSingle()

  const { data: painLogs } = await supabase
    .from('pain_logs')
    .select('*')
    .eq('workout_session_id', sessionId)

  return (
    <HistoryDetailClient
      athlete={athlete}
      session={session}
      setLogs={setLogs || []}
      wellness={wellness || null}
      feedback={feedback || null}
      painLogs={painLogs || []}
    />
  )
}
