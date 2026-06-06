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

  // Daty do szukania wellness: bierzemy ±1 dzień od daty sesji żeby pokryć różnice stref czasowych
  const sessionTs = session.date_completed
    ? new Date(session.date_completed).getTime()
    : Date.now()
  const dateMinus1 = new Date(sessionTs - 86400000).toISOString().split('T')[0]
  const datePlus1  = new Date(sessionTs + 86400000).toISOString().split('T')[0]
  const sessionDate = new Date(sessionTs).toISOString().split('T')[0]

  const [{ data: setLogs }, { data: feedback }, { data: painLogs }, { data: wellnessCandidates }] = await Promise.all([
    supabase.from('set_logs').select('*')
      .eq('workout_session_id', sessionId).eq('athlete_id', athlete.id)
      .order('created_at', { ascending: true }),
    supabase.from('post_session_feedback').select('*')
      .eq('workout_session_id', sessionId).maybeSingle(),
    supabase.from('pain_logs').select('*')
      .eq('workout_session_id', sessionId),
    // Szukamy wellness w zakresie ±1 dzień (pokrycie strefy czasowej)
    supabase.from('wellness_logs').select('*')
      .eq('athlete_id', athlete.id)
      .gte('date', dateMinus1)
      .lte('date', datePlus1)
      .order('date', { ascending: false }),
  ])

  // Wybieramy wellness najbliższy dacie sesji
  const wellness = (() => {
    const candidates = wellnessCandidates || []
    if (!candidates.length) return null
    // Priorytet: dokładne trafienie, potem +1, potem -1
    return candidates.find(w => w.date === sessionDate)
      || candidates.find(w => w.date === datePlus1)
      || candidates.find(w => w.date === dateMinus1)
      || candidates[0]
  })()

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
