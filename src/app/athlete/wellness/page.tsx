// src/app/athlete/wellness/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId } from '@/lib/training'
import WellnessClient from './WellnessClient'

export default async function AthleteWellnessPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const { data: wellness } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('athlete_id', athlete.id)
    .gte('created_at', todayStart.toISOString())
    .lt('created_at', tomorrowStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <WellnessClient
      athlete={athlete}
      existingWellness={wellness || null}
      dateIso={todayStart.toISOString()}
    />
  )
}
