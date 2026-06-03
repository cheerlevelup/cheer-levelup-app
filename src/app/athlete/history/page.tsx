// src/app/athlete/history/page.tsx
// Historia treningów zawodniczki

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId, getAthleteTrainingHistory } from '@/lib/training'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const history = await getAthleteTrainingHistory(athlete.id, 90)

  return <HistoryClient athlete={athlete} history={history} />
}
