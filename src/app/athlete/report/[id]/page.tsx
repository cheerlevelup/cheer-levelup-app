// src/app/athlete/report/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId } from '@/lib/training'
import ReportClient from './ReportClient'

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = parseInt(id)
  if (isNaN(sessionId)) redirect('/athlete')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  // Pobierz sesję z pełnymi detalami
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

  if (!session) redirect('/athlete')

  // Set logi
  const { data: setLogs } = await supabase
    .from('set_logs')
    .select('*')
    .eq('workout_session_id', sessionId)
    .eq('athlete_id', athlete.id)
    .order('created_at', { ascending: true })

  // Wellness (po dacie sesji)
  const sessionDate = (session.date_started || session.date_completed || new Date().toISOString()).split('T')[0]
  const { data: wellness } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('athlete_id', athlete.id)
    .eq('date', sessionDate)
    .maybeSingle()

  // Pain logs
  const { data: painLogs } = await supabase
    .from('pain_logs')
    .select('*')
    .eq('athlete_id', athlete.id)
    .gte('created_at', new Date(new Date(sessionDate).getTime() - 2 * 60 * 60 * 1000).toISOString())
    .lte('created_at', new Date(new Date(sessionDate).getTime() + 24 * 60 * 60 * 1000).toISOString())

  // Feedback
  const { data: feedback } = await supabase
    .from('post_session_feedback')
    .select('*')
    .eq('workout_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <ReportClient
      session={session}
      athlete={athlete}
      setLogs={setLogs || []}
      wellness={wellness || null}
      painLogs={painLogs || []}
      feedback={feedback || null}
    />
  )
}
