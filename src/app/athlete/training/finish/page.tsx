// src/app/athlete/training/finish/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId } from '@/lib/training'
import FinishClient from './FinishClient'

interface Props {
  searchParams: Promise<{ session?: string }>
}

export default async function FinishPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const params = await searchParams
  const sessionId = params.session ? parseInt(params.session) : null
  if (!sessionId) redirect('/athlete')

  // Pobierz sesję z detalami
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

  // Pobierz set_logs dla tej sesji
  const { data: setLogs } = await supabase
    .from('set_logs')
    .select('*')
    .eq('workout_session_id', sessionId)
    .eq('athlete_id', athlete.id)
    .order('created_at', { ascending: true })

  // Pobierz wellness
  const { data: wellness } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('workout_session_id', sessionId)
    .maybeSingle()

  // Pobierz pain_logs
  const { data: painLogs } = await supabase
    .from('pain_logs')
    .select('*')
    .eq('workout_session_id', sessionId)

  return (
    <FinishClient
      athlete={athlete}
      session={session}
      setLogs={setLogs || []}
      wellness={wellness || null}
      painLogs={painLogs || []}
    />
  )
}
