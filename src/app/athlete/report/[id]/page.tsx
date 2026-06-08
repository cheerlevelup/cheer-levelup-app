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

  // Wellness po session_id (tabela nie ma kolumny 'date')
  const { data: wellness } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('workout_session_id', sessionId)
    .maybeSingle()

  // Pain logs — deduplikacja po pain_location (bierz najnowszy wpis na lokalizację)
  const { data: rawPainLogs } = await supabase
    .from('pain_logs')
    .select('*')
    .eq('workout_session_id', sessionId)
    .order('created_at', { ascending: false })

  const painLogsMap = new Map<string, any>()
  for (const p of rawPainLogs || []) {
    const key = (p.pain_location || '').toLowerCase().trim()
    if (!painLogsMap.has(key)) painLogsMap.set(key, p)
  }
  const painLogs = Array.from(painLogsMap.values())

  // Feedback
  const { data: feedback } = await supabase
    .from('post_session_feedback')
    .select('*')
    .eq('workout_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Wellness preFields — z plan_wellness_config (te same co w formularzu treningu)
  const planId = (session as any)?.workout_day?.week?.plan?.id
  const { data: wellnessConfig } = planId
    ? await supabase.from('plan_wellness_config').select('pre_params').eq('plan_id', planId).maybeSingle()
    : { data: null }
  const wellnessPreFields: string[] | null = (wellnessConfig as any)?.pre_params || null

  return (
    <ReportClient
      session={session}
      athlete={athlete}
      setLogs={setLogs || []}
      wellness={wellness || null}
      painLogs={painLogs}
      feedback={feedback || null}
      wellnessPreFields={wellnessPreFields}
    />
  )
}
