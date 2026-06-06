// src/app/athlete/wellness/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId } from '@/lib/training'
import WellnessClient from './WellnessClient'

interface Props {
  searchParams: Promise<{ date?: string; backTo?: string }>
}

export default async function AthleteWellnessPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const { date: dateParam, backTo } = await searchParams

  // Jeśli podano datę w URL (?date=YYYY-MM-DD), użyj jej; w przeciwnym razie dzisiaj
  let targetDate: Date
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = new Date(dateParam + 'T00:00:00')
  } else {
    targetDate = new Date()
    targetDate.setHours(0, 0, 0, 0)
  }

  const dateIso = targetDate.toISOString()
  const dateStr = targetDate.toISOString().split('T')[0]

  // Pobierz istniejący wpis wellness dla tej daty
  const { data: wellness } = await supabase
    .from('wellness_logs')
    .select('*')
    .eq('athlete_id', athlete.id)
    .eq('date', dateStr)
    .maybeSingle()

  return (
    <WellnessClient
      athlete={athlete}
      existingWellness={wellness || null}
      dateIso={dateIso}
      backTo={backTo || null}
    />
  )
}
