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

  // Treningi grupy zorganizowanej (np. Ultra) — ostatnie 28 dni.
  // Zawodniczka „zrobiła” trening grupowy, jeśli tego dnia był trening grupy
  // i nie była oznaczona jako nieobecna.
  const { data: groupTrainings } = athlete.group_id
    ? await supabase
        .from('group_trainings')
        .select('id, training_date, absent_athlete_ids')
        .eq('group_id', athlete.group_id)
        .gte('training_date', daysAgo28.toISOString().split('T')[0])
        .order('training_date', { ascending: false })
    : { data: [] }

  // Pain logs — przez sesje zawodniczki (tabela nie ma athlete_id)
  const athleteSessionIds = (sessions || []).map((s: any) => s.id).slice(0, 20)
  const { data: painLogs } = athleteSessionIds.length > 0
    ? await supabase.from('pain_logs').select('*')
        .in('workout_session_id', athleteSessionIds)
        .order('created_at', { ascending: false }).limit(10)
    : { data: [] }

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

  // Wszystkie grupy i plany (do edycji profilu)
  const { data: allGroups } = await supabase
    .from('groups')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: allPlans } = await supabase
    .from('workout_plans')
    .select('id, name, is_archived')
    .order('created_at', { ascending: false })

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
      groupTrainings={groupTrainings || []}
      painLogs={painLogs || []}
      groupModuleConfigs={groupModuleConfigs || []}
      athleteModuleConfigs={athleteModuleConfigs || []}
      allGroups={allGroups || []}
      allPlans={allPlans || []}
    />
  )
}
