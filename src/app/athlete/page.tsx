// src/app/athlete/page.tsx
// Panel główny zawodniczki — /athlete

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  getAthleteByUserId,
  getNextTrainingForAthlete,
  getAthleteTrainingHistory,
} from '@/lib/training'
import AthleteClient from './AthleteClient'

export const dynamic = 'force-dynamic'

export default async function AthletePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) {
    // Konto auth istnieje ale brak rekordu athlete — pokaż komunikat
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F0EEE9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif",
        padding: '2rem',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', marginBottom: '0.5rem' }}>
            Profil nie znaleziony
          </p>
          <p style={{ color: '#555', fontSize: '0.95rem' }}>
            Skontaktuj się z trenerem — Twoje konto nie zostało jeszcze skonfigurowane.
          </p>
        </div>
      </div>
    )
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const todayDateStr = todayStart.toISOString().split('T')[0]

  // Wszystkie zapytania równolegle — zamiast sekwencyjnie
  const [nextTraining, history, { data: todayWellnessLog }, { data: todayDietLog }, { data: athleteDietConfig }, { data: groupDietConfig }, { data: athleteWellnessConfig }, { data: groupWellnessConfig }] = await Promise.all([
    getNextTrainingForAthlete(athlete.id, athlete.group_id || undefined),
    getAthleteTrainingHistory(athlete.id, 5),
    supabase
      .from('wellness_logs')
      .select('sleep_hours, sleep_quality, energy, stress, muscle_sorness, readiness, body_weight_kg, hydration_glasses, resting_hr, cycle_phase, recovery_score, sitting_hours, activity_data, pain_data, supplements_data, concerns')
      .eq('athlete_id', athlete.id)
      .eq('date', todayDateStr)          // tylko dzienne wellness (zapisane przez stronę wellness)
      .not('date', 'is', null)           // wyklucza wpisy z treningu (brak pola date)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('diet_logs')
      .select('id')
      .eq('athlete_id', athlete.id)
      .eq('date', todayDateStr)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('group_module_config')
      .select('group_id, athlete_id, module, enabled, pre_params, post_params')
      .eq('module', 'diet')
      .eq('athlete_id', athlete.id)
      .maybeSingle(),
    athlete.group_id
      ? supabase
          .from('group_module_config')
          .select('group_id, athlete_id, module, enabled, pre_params, post_params')
          .eq('module', 'diet')
          .eq('group_id', athlete.group_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('group_module_config')
      .select('group_id, athlete_id, module, enabled, pre_params, post_params')
      .eq('module', 'wellness')
      .eq('athlete_id', athlete.id)
      .maybeSingle(),
    athlete.group_id
      ? supabase
          .from('group_module_config')
          .select('group_id, athlete_id, module, enabled, pre_params, post_params')
          .eq('module', 'wellness')
          .eq('group_id', athlete.group_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const dietConfig = athleteDietConfig || groupDietConfig || null
  const dietEnabled = dietConfig?.enabled !== false
  const wellnessConfig = athleteWellnessConfig || groupWellnessConfig || null
  const wellnessEnabled = wellnessConfig?.enabled !== false

  const defaultWellnessFields = ['sleep_hours', 'sleep_quality', 'readiness', 'energy', 'stress', 'muscle_soreness', 'hydration', 'recovery_score']
  const wellnessFields: string[] = wellnessConfig?.pre_params?.length ? wellnessConfig.pre_params : defaultWellnessFields
  const wellnessFieldValue = (field: string) => {
    const log = todayWellnessLog as any
    if (!log) return null
    if (field === 'muscle_soreness') return log.muscle_sorness
    if (field === 'body_weight') return log.body_weight_kg
    if (field === 'hydration') return log.hydration_glasses
    if (field === 'resting_hr') return log.resting_hr
    if (field === 'cycle') return log.cycle_phase
    if (field === 'activity') return log.activity_data?.type || log.activity_data?.duration || log.activity_data?.note
    if (field === 'pain_during') return log.pain_data?.painDuring
    if (field === 'menstrual_pain') return log.pain_data?.menstrualPain
    if (field === 'headache') return log.pain_data?.headache
    if (field === 'stomachache') return log.pain_data?.stomachache
    if (field === 'joint_stiffness') return log.pain_data?.jointStiffness
    if (field === 'anxiety') return log.pain_data?.anxiety
    if (field === 'mental_overload') return log.pain_data?.mentalOverload
    if (field === 'supplements') return Object.values(log.supplements_data?.counts || {}).some((v: any) => Number(v) > 0)
    if (field === 'notes') return log.concerns
    return log[field]
  }
  const completedWellnessFields = wellnessFields.filter(field => {
    const value = wellnessFieldValue(field)
    return value !== null && value !== undefined
  }).length

  return (
    <AthleteClient
      athlete={athlete}
      nextTraining={nextTraining}
      history={history}
      todayWellness={{
        dateIso: todayStart.toISOString(),
        completedFields: completedWellnessFields,
        totalFields: wellnessFields.length,
        isComplete: completedWellnessFields === wellnessFields.length,
      }}
      todayDiet={!!todayDietLog}
      dietEnabled={dietEnabled}
      wellnessEnabled={wellnessEnabled}
      wellnessFields={wellnessFields}
    />
  )
}
