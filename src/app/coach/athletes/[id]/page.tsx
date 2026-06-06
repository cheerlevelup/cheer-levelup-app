export const dynamic = 'force-dynamic'

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

  // Wszystkie przypisania (aktywne + historia)
  const conditions = [`athlete_id.eq.${athleteId}`]
  if (athlete.group_id) conditions.push(`group_id.eq.${athlete.group_id}`)
  const { data: allAssignments } = await supabase
    .from('athlete_workout_assignments')
    .select('*, plan:workout_plans(*)')
    .or(conditions.join(','))
    .order('created_at', { ascending: false })
  const assignment = (allAssignments || []).find(a => a.is_active) || null
  const pastAssignments = (allAssignments || []).filter(a => !a.is_active)

  // Historia treningów (z pełnym kontekstem)
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select(`*, workout_day:workout_days(id, day_name, week:workout_weeks(week_number, plan:workout_plans(name)))`)
    .eq('athlete_id', athleteId)
    .order('date_completed', { ascending: false })
    .limit(50)

  // Feedback po treningu
  const { data: feedbacks } = await supabase
    .from('post_session_feedback')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Wellness — ostatnie 28 dni, pełne dane (kalendarz + raporty + statystyki)
  const daysAgo28 = new Date()
  daysAgo28.setDate(daysAgo28.getDate() - 28)
  const { data: wellnessLogs } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('created_at', daysAgo28.toISOString())
    .order('created_at', { ascending: false })

  // Wellness — ostatni wpis (dla sekcji "ostatni wellness")
  const wellnessList = wellnessLogs || []

  // Dieta — ostatnie 28 dni
  const { data: dietLogs } = await supabase
    .from('diet_logs')
    .select('id, date, water_ml, meal_count, hunger_level')
    .eq('athlete_id', athleteId)
    .gte('date', daysAgo28.toISOString().split('T')[0])
    .order('date', { ascending: false })

  // Pain logs
  const { data: painLogs } = await supabase
    .from('pain_logs')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: groupModuleConfigs } = athlete.group_id
    ? await supabase
        .from('group_module_config')
        .select('id, group_id, athlete_id, module, enabled, pre_params, post_params, updated_at')
        .eq('group_id', athlete.group_id)
    : { data: [] }

  const { data: athleteModuleConfigs } = await supabase
    .from('group_module_config')
    .select('id, group_id, athlete_id, module, enabled, pre_params, post_params, updated_at')
    .eq('athlete_id', athleteId)

  return (
    <CoachAthleteClient
      athlete={athlete}
      assignment={assignment}
      pastAssignments={pastAssignments}
      sessions={sessions || []}
      feedbacks={feedbacks || []}
      wellnessLogs={wellnessLogs || []}
      wellnessList={wellnessList}
      dietLogs={dietLogs || []}
      painLogs={painLogs || []}
      groupModuleConfigs={groupModuleConfigs || []}
      athleteModuleConfigs={athleteModuleConfigs || []}
    />
  )
}
